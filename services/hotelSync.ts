'use client';

/**
 * Cliente del estado compartido del hotel.
 *
 * MODELO: una sola fuente de verdad.
 *
 *   - El servidor guarda EL hotel. Todas las pantallas leen el mismo.
 *   - La PANTALLA DEL HOTEL es la que escribe: aplica los eventos del live y el
 *     reloj de estadia, y publica el resultado.
 *   - El PANEL DE ADMIN no tiene hotel propio. Lee el estado del servidor y
 *     manda ORDENES (reglas, clima, eventos, demoler...).
 *   - Cualquier otra pantalla solo LEE.
 *
 * POR QUE ASI
 *
 * Antes cada pantalla publicaba su hotel entero y peleaba por ser el "dueno".
 * Como el panel montaba tambien un hotel completo (con sus reglas por defecto),
 * los dos escribian y el estado oscilaba entre las dos versiones: el "pongo 10 y
 * cambia solo entre 30 y 10".
 *
 * Con este modelo hay UN solo escritor, asi que no hay nada que pelear.
 *
 * POR QUE HAY UN "ESCRITOR" Y NO SIMPLEMENTE "TODOS LEEN"
 *
 * Algo tiene que decidir quien aplica los eventos del live y corre el reloj de
 * estadia: si lo hicieran todas las pestanas, un espectador entraria una vez por
 * pestana (con un avatar distinto en cada una) y el reloj correria N veces mas
 * rapido. Es un detalle interno de coordinacion, no una jerarquia visible: la
 * interfaz ya no distingue "maestro" y "espejo", todas las pantallas muestran el
 * mismo hotel.
 */

const POLL_MS = 1200;

export interface HotelSyncStatus {
  /** Hay conexion con el servidor? */
  online: boolean;
  /** Cuantas pantallas estan viendo el hotel. */
  peers: number;
  clientId: string;
}

class HotelSyncService {
  /**
   * Identidad de esta PESTANA (no de esta carga de pagina).
   *
   * Se guarda en `sessionStorage`: sobrevive a las recargas de la misma pestana,
   * es independiente entre pestanas, y se borra al cerrarla. Asi recargar no
   * crea una sesion nueva (antes cada F5 generaba una identidad y el contador de
   * pantallas se disparaba).
   */
  private clientId = obtenerClientIdDePestana();

  /** Ultima revision conocida: cursor de lectura. */
  private revision = 0;
  private peers = 0;
  private online = false;
  private pollTimer: any = null;

  /** Ultimo estado publicado, para no reenviar lo mismo. */
  private lastPushed = '';

  /**
   * Esta pantalla escribe el hotel?
   *
   * Se concede desde el servidor (`claimWriter`), no se decide aqui. Solo la
   * pantalla del hotel lo pide; el panel manda ordenes y las demas solo leen.
   */
  private writer = false;

  private stateListeners: Array<(state: any) => void> = [];
  private orderListeners: Array<(orders: any[]) => void> = [];
  private statusListeners: Array<(status: HotelSyncStatus) => void> = [];
  private seedListeners: Array<() => void> = [];

  private started = false;
  /** Ya se hablo con el servidor al menos una vez? */
  private synced = false;
  /** Ya se aviso de que el servidor estaba vacio? */
  private seedAvisado = false;

  public getClientId(): string {
    return this.clientId;
  }

  public isWriter(): boolean {
    return this.writer;
  }

  public hasSynced(): boolean {
    return this.synced;
  }

  public getStatus(): HotelSyncStatus {
    return {
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

  /** Ordenes de administracion pendientes de aplicar. */
  public onOrders(cb: (orders: any[]) => void): () => void {
    this.orderListeners.push(cb);
    return () => {
      this.orderListeners = this.orderListeners.filter((fn) => fn !== cb);
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
   * Sin esto el hotel se quedaba vacio: nadie publica porque "el estado no ha
   * cambiado" y el servidor no tiene nada que repartir.
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

  /**
   * Arranca el ciclo.
   *
   * `quererEscribir` lo pone la pantalla del hotel. Se pide el puesto al
   * servidor; si lo concede, esta pantalla pasa a publicar el estado.
   */
  public start(quererEscribir: boolean): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    this.writer = false;

    if (quererEscribir) {
      // Reclamar cuanto antes: si esta es la unica pantalla, debe escribir ya,
      // sin esperar al primer poll, o se perderian los eventos que lleguen
      // entretanto.
      void this.claimWriter();
    }

    this.poll();
    this.pollTimer = setInterval(() => this.poll(), POLL_MS);
  }

  public stop(): void {
    if (!this.started) return;
    this.started = false;
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  /** Pide al servidor ser la pantalla que escribe. */
  private async claimWriter(): Promise<void> {
    try {
      const res = await fetch('/api/hotel/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claimWriter', clientId: this.clientId }),
      });
      if (!res.ok) return;
      const d = await res.json();
      this.writer = !!d?.isWriter;
    } catch {
      // Sin respuesta: se reintentara en el siguiente poll.
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

      // Si el servidor dice que el puesto de escritor esta libre (nadie, o el
      // que habia dejo de dar senal) y esta pantalla quiere escribirlo, se
      // reclama. Es el traspaso automatico: si la pantalla que mandaba se
      // cierra o el movil se bloquea, otra toma el control sola.
      if (this.quererEscribir && !this.writer && !d.writerId) {
        void this.claimWriter();
      } else if (this.quererEscribir && this.writer && d.writerId && d.writerId !== this.clientId) {
        // Otra pantalla lo tiene: esta deja de escribir en vez de pelearlo.
        this.writer = false;
      }

      // Estado nuevo: se adopta.
      //
      // Tambien lo hace la pantalla que escribe: si el servidor tiene una
      // revision distinta de la suya (por ejemplo tras un reinicio, o porque
      // acaba de reclamar el puesto), debe partir del estado canonico y no de
      // su copia local. Sin esto, cada pestana recien abierta arrancaba con su
      // hotel por defecto y lo publicaba encima del que ya habia.
      if (typeof d.revision === 'number' && d.revision > this.revision) {
        this.revision = d.revision;
        if (d.state) {
          this.lastPushed = safeStringify(d.state);
          this.stateListeners.forEach((fn) => fn(d.state));
        }
      } else if (d.revision === 0 && !this.seedAvisado) {
        // El servidor no tiene estado: se avisa una vez para que alguien lo
        // siembre (solo lo hara la pantalla del hotel).
        this.seedAvisado = true;
        this.seedListeners.forEach((fn) => fn());
      }

      // Ordenes de administracion pendientes. El servidor solo las entrega a la
      // pantalla que escribe, que es la unica que puede aplicarlas.
      if (Array.isArray(d.orders) && d.orders.length) {
        this.orderListeners.forEach((fn) => fn(d.orders));
      }

      this.emitStatus();
    } catch {
      this.online = false;
      this.emitStatus();
    }
  }

  /** Esta pantalla quiere escribir el hotel? (lo pide la del hotel) */
  private quererEscribir = false;

  /** Marca la intencion de escribir; se consume en `start`. */
  public setQuererEscribir(v: boolean): void {
    this.quererEscribir = v;
  }

  /**
   * Publica el estado del hotel.
   *
   * Solo la pantalla que escribe lo llama (`writer` lo concede el servidor).
   */
  public pushState(state: any): void {
    if (!this.started || typeof window === 'undefined') return;
    if (!this.writer) return;
    // Sin haber leido del servidor no se publica: una pestana recien abierta
    // podria llevar un hotel viejo en `localStorage` y machacaria el canonico.
    if (!this.synced) return;

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
          if (d && typeof d.revision === 'number') {
            this.revision = Math.max(this.revision, d.revision);
          }
        })
        .catch(() => {
          // Si falla, el proximo cambio lo reintenta.
        });
    } catch {
      // ignore
    }
  }

  /**
   * Confirma que las ordenes se han aplicado.
   *
   * El servidor las entrega SIN borrarlas. Hay que llamar a esto DESPUES de
   * aplicarlas: si no se confirmara, se reaplicarian en cada poll.
   */
  public async takeOrders(): Promise<void> {
    try {
      await fetch('/api/hotel/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'takeOrders', clientId: this.clientId }),
      });
    } catch {
      // Si falla, las ordenes seguirán ahi y se reintentaran en el proximo poll.
    }
  }

  /**
   * Envia una orden de administracion.
   *
   * La llama el panel de admin. La pantalla del hotel la recogera y la aplicara.
   * Asi el panel NO necesita tener su propio hotel para mandar cambios.
   */
  public async sendOrder(type: string, payload: any = {}): Promise<boolean> {
    try {
      const res = await fetch('/api/hotel/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'order', clientId: this.clientId, order: { type, payload } }),
      });
      return res.ok;
    } catch {
      return false;
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
