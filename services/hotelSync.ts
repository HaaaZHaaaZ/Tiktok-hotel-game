'use client';

/**
 * Cliente de sincronizacion del hotel entre dispositivos.
 *
 * Habla con `/api/hotel/sync`, que guarda el estado canonico. Cada pantalla:
 *  - Lee el estado del servidor y lo adopta cuando cambia.
 *  - Publica sus cambios locales.
 *  - Pelea por ser el PROPIETARIO (uno solo) para aplicar los eventos del live
 *    y correr la simulacion.
 *
 * Sin el paso del propietario, cada pestana aplicaria los mismos eventos por su
 * cuenta y el hotel se desviaria en segundos (cada una con sus aleatorios).
 *
 * `localStorage` y `BroadcastChannel` se mantienen como cache y para la
 * sincronia instantanea dentro del mismo navegador, pero la fuente de verdad es
 * el servidor: es lo unico que alcanza a otros dispositivos.
 */

const POLL_MS = 1200;
const HEARTBEAT_MS = 3000;

export interface HotelSyncStatus {
  isOwner: boolean;
  revision: number;
  peers: number;
  online: boolean;
  clientId: string;
}

class HotelSyncService {
  /**
   * Identidad de esta PESTANA (no de esta carga de pagina).
   *
   * Antes se generaba con `Math.random()` en cada carga del modulo. Como cada
   * recarga de la pagina vuelve a ejecutar el modulo, cada F5 creaba una
   * identidad nueva: el servidor las acumulaba y en dos pestanas con varias
   * recargas se veian 15 "pantallas conectadas" cuando solo habia dos.
   *
   * `sessionStorage` es exactamente el ambito que se necesita: sobrevive a las
   * recargas de la misma pestana, es independiente entre pestanas, y se borra
   * solo al cerrarla. Asi recargar NO crea una sesion nueva.
   */
  private clientId = obtenerClientIdDePestana();

  /** Ultima revision conocida: cursor de lectura. */
  private revision = 0;
  private owner = false;
  private peers = 0;
  private online = false;

  private pollTimer: any = null;
  private beatTimer: any = null;

  /** Ultimo estado publicado, para no reenviar lo mismo. */
  private lastPushed = '';
  /** Verdadero mientras se aplica estado del servidor (evita el eco). */
  private applyingRemote = false;

  private stateListeners: Array<(state: any) => void> = [];
  private statusListeners: Array<(status: HotelSyncStatus) => void> = [];
  /** Se avisa una sola vez, si el servidor no tenia estado que dar. */
  private seedListeners: Array<() => void> = [];

  private started = false;
  /**
   * Ya se ha hablado con el servidor al menos una vez?
   *
   * Hasta que no se sepa que hay en el servidor, una pestana NO debe publicar su
   * estado local: podria tener un hotel viejo en `localStorage` y machacaria el
   * canonico que comparten los demas dispositivos. Solo despues del primer poll
   * (con el estado ya adoptado, o sabiendo que el servidor esta vacio) tiene
   * sentido publicar.
   */
  private synced = false;
  /** Ya se aviso de que el servidor estaba vacio? (evita repetirlo cada poll). */
  private seedAvisado = false;

  public hasSynced(): boolean {
    return this.synced;
  }

  public getClientId(): string {
    return this.clientId;
  }

  /** Es esta pantalla la que manda (aplica eventos y publica)? */
  public isOwner(): boolean {
    return this.owner;
  }

  /** Se esta aplicando estado del servidor ahora mismo? */
  public isApplyingRemote(): boolean {
    return this.applyingRemote;
  }

  public getStatus(): HotelSyncStatus {
    return {
      isOwner: this.owner,
      revision: this.revision,
      peers: this.peers,
      online: this.online,
      clientId: this.clientId,
    };
  }

  public onRemoteState(cb: (state: any) => void): () => void {
    this.stateListeners.push(cb);
    return () => {
      this.stateListeners = this.stateListeners.filter((fn) => fn !== cb);
    };
  }

  public onStatus(cb: (status: HotelSyncStatus) => void): () => void {
    this.statusListeners.push(cb);
    return () => {
      this.statusListeners = this.statusListeners.filter((fn) => fn !== cb);
    };
  }

  /**
   * Avisa cuando el servidor NO tiene estado (primer arranque tras un reinicio).
   *
   * Sin esto, el hotel se quedaba vacio para siempre: nadie publica porque
   * "el estado no ha cambiado", y el servidor no tiene nada que repartir. La
   * pantalla que recibe el aviso siembra el servidor con su estado local.
   */
  public onSeedNeeded(cb: () => void): () => void {
    this.seedListeners.push(cb);
    return () => {
      this.seedListeners = this.seedListeners.filter((fn) => fn !== cb);
    };
  }

  private emitStatus(): void {
    const st = this.getStatus();
    this.statusListeners.forEach((fn) => fn(st));
  }

  public start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;

    // Reclamar cuanto antes: si esta es la unica pantalla, debe mandar ya, sin
    // esperar al primer latido, o se perderian los eventos que lleguen entretanto.
    this.beat();
    this.poll();

    this.pollTimer = setInterval(() => this.poll(), POLL_MS);
    this.beatTimer = setInterval(() => this.beat(), HEARTBEAT_MS);

    // Al cerrar, soltar la propiedad para que otra pantalla la tome al instante
    // en vez de esperar a que caduque el latido.
    window.addEventListener('pagehide', this.handleUnload);
  }

  public stop(): void {
    if (!this.started) return;
    this.started = false;
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.beatTimer) clearInterval(this.beatTimer);
    this.pollTimer = null;
    this.beatTimer = null;
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.handleUnload);
    }
  }

  private handleUnload = (): void => {
    // NO soltar la propiedad al recargar.
    //
    // `pagehide` tambien se dispara en un F5, asi que al recargar se soltaba el
    // mando y otra pantalla lo tomaba; al volver, la primera lo recuperaba. Con
    // dos pestanas eso es un vaiven constante de propiedad (y cada cambio
    // reinicia el reloj de estadia en la nueva duena).
    //
    // Solo se suelta si la pestana se CIERRA de verdad. `persisted` distingue
    // el paso a la cache de navegacion (atras/adelante) de un cierre real.
    // Para el cierre real, el latido caduca solo en 10s: es margen de sobra y
    // evita el vaiven.
    try {
      const nav = performance.getEntriesByType('navigation')[0] as
        | PerformanceNavigationTiming
        | undefined;
      // `reload` = el usuario recargo. No soltar.
      if (nav && nav.type === 'reload') return;
    } catch {
      // Si no se puede saber, se prefiere NO soltar (el latido caduca igual).
      return;
    }

    try {
      fetch('/api/hotel/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'release', clientId: this.clientId }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // ignore
    }
  };

  private async beat(): Promise<void> {
    try {
      const res = await fetch('/api/hotel/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claim', clientId: this.clientId }),
      });
      if (!res.ok) return;
      const d = await res.json();
      const era = this.owner;
      this.owner = d.ownerId === this.clientId;
      this.online = true;
      if (typeof d.peers === 'number') this.peers = d.peers;
      if (era !== this.owner) {
        // Cambio de mando: interesa saberlo (la UI lo muestra y el bucle de
        // simulacion se enciende o se apaga con esto).
        this.emitStatus();
      }
    } catch {
      this.online = false;
    }
  }

  private async poll(): Promise<void> {
    try {
      const res = await fetch(
        `/api/hotel/sync?since=${this.revision}&clientId=${this.clientId}`,
        { cache: 'no-store' }
      );
      if (!res.ok) return;
      const d = await res.json();

      this.online = true;
      this.synced = true;
      if (typeof d.peers === 'number') this.peers = d.peers;
      if (typeof d.ownerId !== 'undefined') {
        this.owner = d.ownerId === this.clientId;
      }

      // El estado solo llega cuando hay algo nuevo (`stateRevision > since`).
      if (typeof d.stateRevision === 'number' && d.stateRevision > this.revision) {
        this.revision = d.stateRevision;
        if (d.state) {
          // El PROPIETARIO no adopta su propio estado.
          //
          // Es la causa del parpadeo continuo con el live conectado: el dueno
          // aplicaba un evento, publicaba el estado, y en el siguiente poll el
          // servidor se lo devolvia como "novedad". Adoptarlo creaba un arbol
          // con referencias nuevas -> React remontaba el edificio entero. Y como
          // los eventos del live llegan sin parar, el edificio parpadeaba en
          // cada uno.
          //
          // El dueno ya tiene ese estado (es suyo); no necesita re-adoptarlo.
          // Los espejos SI lo adoptan, que es justo su trabajo.
          if (this.owner) {
            this.lastPushed = safeStringify(d.state);
          } else {
            // Se marca ANTES de avisar, para que el guardado automatico no
            // reenvie al servidor lo que acaba de llegar de el (seria un eco
            // infinito entre pantallas).
            this.applyingRemote = true;
            this.lastPushed = safeStringify(d.state);
            this.stateListeners.forEach((fn) => fn(d.state));
            window.setTimeout(() => {
              this.applyingRemote = false;
            }, 500);
          }
        }
      } else if (d.stateRevision === 0 && !this.seedAvisado) {
        // El servidor no tiene estado (primer arranque, o se reinicio el
        // contenedor). Se avisa UNA vez para que alguien lo siembre; si no, el
        // hotel se quedaria vacio para siempre porque nadie publica.
        this.seedAvisado = true;
        this.seedListeners.forEach((fn) => fn());
      }

      if (typeof d.revision === 'number') {
        this.revision = Math.max(this.revision, d.revision);
      }

      this.emitStatus();
    } catch {
      this.online = false;
      this.emitStatus();
    }
  }

  /**
   * Publica el estado local.
   *
   * `force` = cambio iniciado por una persona (panel de administracion). Esos
   * se envian siempre, aunque esta pantalla no sea la propietaria, para que el
   * ajuste se vea al instante en todas partes. Los cambios automaticos (bucle de
   * simulacion, eventos del live) solo los manda el propietario.
   */
  public pushState(state: any, force = false): void {
    if (!this.started || typeof window === 'undefined') return;
    if (this.applyingRemote) return;
    // Sin haber leido aun del servidor no se publica: una pestana recien abierta
    // podria llevar un hotel viejo en `localStorage` y machacaria el canonico.
    if (!this.synced) return;
    if (!force && !this.owner) return;

    const json = safeStringify(state);
    if (!json || json === this.lastPushed) return;
    this.lastPushed = json;

    try {
      fetch('/api/hotel/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'push', clientId: this.clientId, state }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d && typeof d.stateRevision === 'number') {
            this.revision = Math.max(this.revision, d.stateRevision);
          }
        })
        .catch(() => {
          // Si falla, el proximo cambio lo reintenta. No se bloquea la app.
        });
    } catch {
      // ignore
    }
  }
}

/** `JSON.stringify` que no revienta con referencias circulares. */
function safeStringify(value: any): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
}

/** Clave donde se guarda la identidad de la pestaña. */
const CLIENT_ID_KEY = 'tiktok_hotel_client_id';

/**
 * Identidad estable de esta pestaña.
 *
 * Se guarda en `sessionStorage`, que sobrevive a las recargas pero no se
 * comparte entre pestañas ni dispositivos, y se borra al cerrar la pestaña.
 * Es justo el ciclo de vida de una "pantalla conectada".
 *
 * Si `sessionStorage` no está disponible (modo privado muy restrictivo, o
 * bloqueado), se cae a una identidad en memoria: se pierde al recargar, pero la
 * app sigue funcionando.
 */
function obtenerClientIdDePestana(): string {
  const nuevo = () => `c_${Math.random().toString(36).slice(2, 10)}`;
  if (typeof window === 'undefined') return nuevo();

  try {
    const guardado = window.sessionStorage.getItem(CLIENT_ID_KEY);
    if (guardado) return guardado;
    const id = nuevo();
    window.sessionStorage.setItem(CLIENT_ID_KEY, id);
    return id;
  } catch {
    return nuevo();
  }
}

export const hotelSync = new HotelSyncService();
