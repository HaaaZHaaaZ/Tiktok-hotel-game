'use client';

import { hotelBroadcast } from './broadcastSync';
import { browserReport } from './browserReport';

export interface TikTokLiveStatus {
  isConnected: boolean;
  streamer: string;
  roomId?: string;
  error?: string;
  // Estado real del servidor: la UI distingue "conectando" de "en vivo".
  connectionState?: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';
  viewers?: number;
  counts?: { chat: number; gift: number; like: number; member: number; social: number };
}

class TikTokLiveConnectorService {
  private status: TikTokLiveStatus = {
    isConnected: false,
    streamer: '',
  };
  private pollTimer: any = null;
  // Cursor de lectura. Empieza en 0 a proposito: asi la primera carga recibe TODO
  // lo que haya en el buffer del servidor. Solo avanza con los eventos realmente
  // entregados; nunca por reloj (ver notas de bug en el bucle de polling).
  private lastPolledTimestamp = 0;
  // Marca de vida del polling: si pasan 20s sin una lectura correcta, el
  // intervalo se considera muerto y se reinicia. Esto es lo que hacia falta para
  // que el usuario NO tenga que desconectar y reconectar a mano nunca.
  private lastOkPollAt = 0;
  private guard: any = null;

  public getStatus(): TikTokLiveStatus {
    return this.status;
  }

  /**
   * Reengancharse a una conexion ya abierta en el servidor.
   *
   * Este servicio es un singleton del NAVEGADOR: cada pantalla (/ y /admin)
   * monta su propio HotelProvider, asi que al navegar el estado y el timer de
   * polling se pierden aunque el WebSocket del servidor siga vivo. Por eso, al
   * montar, se pregunta al servidor que estado real tiene y se retoma donde
   * estaba en vez de exigir pulsar "Conectar" otra vez.
   */
  public async resumeIfActive(): Promise<TikTokLiveStatus | null> {
    if (this.pollTimer) return this.status; // ya estamos enganchados

    try {
      const res = await fetch('/api/tiktok/connect', { cache: 'no-store' });
      const data = await res.json();
      const c = data?.connection;
      if (!c || c.state === 'idle' || !c.streamer) return null;

      // Retomar SIN tocar el cursor de lectura.
      //
      // BUG (2026-10-04): aqui se ponia el cursor al reloj del servidor, lo que
      // descartaba de golpe todo lo acumulado en el buffer. Con eso, al cambiar
      // de /admin a / se perdian los eventos pendientes — y era el sintoma de
      // "solo sale el personaje del live, los demas no llegan".
      //
      // El cursor SOLO avanza con los eventos realmente leidos. Si nunca se ha
      // leido nada (primera carga de la pagina), sigue en 0 para no perder nada
      // de lo que haya en el buffer del servidor.
      browserReport.info('conexion', 'reanudando desde el servidor', {
        estado: c.state,
        streamer: c.streamer,
      });
      this.status = {
        isConnected: c.state === 'connected',
        streamer: c.streamer.startsWith('@') ? c.streamer : `@${c.streamer}`,
        roomId: c.roomId ?? undefined,
        connectionState: c.state,
        viewers: c.viewers,
        counts: c.counts,
        error: c.lastError || undefined,
      };
      this.startWebhookPolling();
      return this.status;
    } catch {
      return null;
    }
  }

  public async connect(username: string): Promise<TikTokLiveStatus> {
    const cleanUser = username.replace(/^@/, '').trim();
    if (!cleanUser) {
      return { isConnected: false, streamer: '', error: 'Nombre de usuario requerido' };
    }

    try {
      const res = await fetch('/api/tiktok/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser }),
      });
      const data = await res.json();
      if (data.success) {
        this.status = {
          isConnected: data.connectionState === 'connected',
          streamer: `@${cleanUser}`,
          roomId: data.roomId,
          connectionState: data.connectionState,
          error: data.lastError || undefined,
        };

        this.startWebhookPolling();
        return this.status;
      } else {
        throw new Error(data.error || 'Error al conectar');
      }
    } catch (err: any) {
      this.status = {
        isConnected: false,
        streamer: `@${cleanUser}`,
        error: err.message || 'Error de red',
      };
      return this.status;
    }
  }

  public disconnect() {
    this.status = { isConnected: false, streamer: '' };
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    // Parar tambien el guardian: si siguiera vivo, relanzaria el polling solo y
    // la conexion "desconectada" volveria sola sola.
    if (this.guard) {
      clearInterval(this.guard);
      this.guard = null;
    }
    // Cerrar tambien el WebSocket del servidor; si no, sigue recibiendo eventos.
    fetch('/api/tiktok/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disconnect' }),
    }).catch(() => {
      // el servidor puede reiniciarse; el polling ya esta parado
    });
  }

  private startWebhookPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    // NO reiniciar el cursor a 'ahora'. Ese era otro bug (2026-10-04): al
    // (re)arrancar el polling se ponia el cursor al reloj del servidor, lo que
    // descartaba de golpe todo lo que hubiera en el buffer. El guardian del
    // polling llama a este metodo, asi que cada reinicio perdia eventos.
    // El cursor solo avanza con lo que realmente se ha leido.
    this.lastOkPollAt = Date.now();
    this.startPollGuard();

    this.pollTimer = setInterval(async () => {
      // NUNCA dejar de leer por el estado.
      //
      // BUG (2026-10-04): aqui havia `if (!this.status.connectionState) return;`
      // que hacia que el polling se detuviera en cuanto el estado se quedaba
      // vacio. El guardian lo relanzaba, pero cada ciclo se perdian los eventos
      // de en medio — el sintoma de "deja de entrar gente y tengo que recargar".
      //
      // El webhook SIEMPRE se lee: el propio servidor dice si hay live o no.
      // Si no hay, el bucle simplemente no recibe eventos, que es lo correcto.
      try {
        const res = await fetch(`/api/tiktok/webhook?since=${this.lastPolledTimestamp}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          // Un error HTTP NO debe parar el polling: se reintenta al siguiente tick.
          return;
        }
        const data = await res.json();
        // Lectura correcta: renovar el pulso que mantiene vivo el polling.
        this.lastOkPollAt = Date.now();

        // Reflejar el estado real que reporta el servidor.
        if (data.connection) {
          const c = data.connection;
          this.status = {
            ...this.status,
            connectionState: c.state,
            isConnected: c.state === 'connected',
            roomId: c.roomId || this.status.roomId,
            viewers: c.viewers ?? this.status.viewers,
            counts: c.counts ?? this.status.counts,
            error: c.lastError || undefined,
          };
          // Si el servidor sigue reconectando, sigue leyendo: el stream volvera solo.
          //
          // BUG CORREGIDO: antes, en 'idle' se hacía clearInterval() y el polling
          // se destruia PARA SIEMPRE. Nada lo reiniciaba salvo que el usuario
          // pulsara "Conectar" de nuevo o cambiara de pantalla — de ahi el sintoma
          // "los eventos dejan de responder y tengo que reconectar a mano".
          // Ahora 'idle' solo se refleja en el estado; el intervalo sigue vivo y
          // el servidor vuelve a conectado solo cuando el stream se recupere.
          if (c.state === 'idle') {
            this.status = {
              ...this.status,
              isConnected: false,
              connectionState: 'idle',
            };
          }
        }

        if (data.events && Array.isArray(data.events) && data.events.length > 0) {
          let newest = this.lastPolledTimestamp;

          // Reportar al servidor lo que se ha recibido. Esta linea es la que
          // hace visible el lado del navegador: si los eventos llegan aqui pero
          // no entran usuarios, el problema esta aguas abajo, no en la conexion.
          browserReport.info('eventos', `${data.events.length} eventos recibidos`, {
            tipos: data.events.reduce((m: Record<string, number>, e: any) => {
              m[e.event] = (m[e.event] || 0) + 1;
              return m;
            }, {}),
            cursorAntes: this.lastPolledTimestamp,
          });

          data.events.forEach((ev: any) => {
            this.emitEvent({
              eventType: ev.event,
              username: ev.username,
              comment: ev.comment,
              giftName: ev.giftName,
              giftId: ev.giftId,
              giftCoins: ev.giftCoins,
              likeCount: ev.likeCount,
            });
            // BUG CRITICO CORREGIDO: comparar contra un cursor mezclando relojes.
            //
            // El cursor arrancaba en Date.now() del NAVEGADOR y los eventos llevan
            // timestamp del SERVIDOR. Si el navegador va adelantado (zona horaria o
            // reloj desfasado), el cursor queda por delante de todos los eventos
            // futuros y drain(since) los descarta para siempre: los eventos dejan
            // de llegar de forma permanente y solo se recupera reconectando.
            //
            // La unica fuente de verdad es el reloj del servidor. El propio GET
            // trae 'timestamp': se usa ese como base al iniciar el cursor, y si
            // falta, el backup de Date.now() avanza hacia atras para no perder.
            if (ev.timestamp > newest) newest = ev.timestamp;
          });
          this.lastPolledTimestamp = newest;
        }

        // Sincronizar el cursor con el reloj del servidor en cada respuesta.
        //
        // BUG GRAVE (2026-10-04): el cursor se avanzaba a `serverNow - 2s` en CADA
        // lectura. Como los eventos pueden tener bastante antiguedad (el buffer
        // llegó a tener eventos de 11 minutos), ese salto temporal se los saltaba
        // TODOS de un golpe: el cliente recibia 0 eventos con 48 esperando en el
        // buffer. Es el sintoma de "solo sale el personaje del live, los demas no".
        //
        // El cursor SOLO avanza con eventos realmente entregados. El reloj del
        // servidor unicamente se usa para corregir una desincronizacion (cursor en
        // el futuro), nunca para adelantar la lectura.
        if (typeof data.timestamp === 'number') {
          const serverNow = data.timestamp;
          if (this.lastPolledTimestamp > serverNow + 5_000) {
            // Cursor envenenado (reloj del navegador desfasado): alinearlo.
            this.lastPolledTimestamp = serverNow - 8_000;
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 1500);
  }

  /**
   * Guardian del polling.
   *
   * El sintoma queixas ("los eventos dejan de llegar y tengo que reconectar")
   * tiene una causa comun: el intervalo de polling se queda muerto por lo que
   * sea (una excepcion no capturada, una pestana suspendida, un fallo de red) y
   * ya no vuelve. Antes no habia NADA que lo reviviera.
   *
   * Aqui, cada 10s se comprueba que hubo una lectura correcta en los ultimos 25s.
   * Si no, se relanza el polling por dentro — sin que el usuario toque nada.
   */
  private startPollGuard() {
    if (this.guard) clearInterval(this.guard);
    this.guard = setInterval(() => {
      const stale = Date.now() - this.lastOkPollAt > 25_000;
      const dead = !this.pollTimer;
      if (stale || dead) {
        // Relanzar conservando el cursor: NO se pone a Date.now(), porque eso
        // saltaria todo lo acumulado. Ademas se pide al servidor que reconecte
        // si el socket del servidor estuviera caido.
        browserReport.warn('polling', 'el polling se habia muerto; relanzando', {
          sinLecturaHaceSeg: Math.round((Date.now() - this.lastOkPollAt) / 1000),
          timerVivo: !dead,
          cursor: this.lastPolledTimestamp,
        });
        this.startWebhookPolling();
      }
    }, 10_000);
  }

  public emitEvent(event: {
    eventType: 'comment' | 'gift' | 'like' | 'share' | 'follow' | 'join';
    username: string;
    comment?: string;
    giftId?: string;
    giftName?: string;
    giftCoins?: number;
    likeCount?: number;
  }) {
    hotelBroadcast.post({
      type: 'TIKTOK_EVENT',
      payload: event,
    });
  }
}

export const tiktokLiveConnector = new TikTokLiveConnectorService();
