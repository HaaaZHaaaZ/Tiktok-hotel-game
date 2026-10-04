/**
 * Conexion directa a TikTok LIVE via tiktok-live-connector.
 *
 * Corre en el servidor (Node) y mantiene UN solo WebSocket por streamer.
 * Los eventos se empujan a la cola en memoria que expone /api/tiktok/webhook,
 * de modo que el cliente sigue leyendo el mismo endpoint que antes.
 *
 * Antes: los eventos solo llegaban si alguien hacia POST a mano (Tikfinity).
 * Ahora: llegan del live real.
 *
 * Formas reales de los mensajes (verificadas contra un live con trafico):
 *   chat    -> d.content            (NO existe d.comment)
 *   gift    -> d.giftName/giftId/diamondCount/repeatCount
 *   like    -> d.count
 *   member  -> entrada al room
 *   social  -> d.shareType (1=compartir, 3=follow)
 * El usuario viene en d.user.nickname; uniqueId no viene en estos mensajes.
 */

import { tiktokLogger } from './logger';

import {
  TikTokLiveConnection,
  WebcastEvent,
  ControlEvent,
  TikTokLiveConnectionState,
} from 'tiktok-live-connector';

export type HotelEventType = 'comment' | 'gift' | 'like' | 'share' | 'follow';

export interface HotelEvent {
  id: string;
  timestamp: number;
  event: HotelEventType;
  username: string;
  comment?: string;
  giftName?: string;
  giftId?: string;
  giftCoins?: number;
  likeCount?: number;
}

type Push = (ev: HotelEvent) => void;

const RECONNECT_BASE_MS = 5000;
const RECONNECT_MAX_MS = 60_000;

/** El proto no expone uniqueId en estos eventos; el nickname es lo unico fiable. */
function uname(u?: { nickname?: string; uniqueId?: string } | null): string {
  const s = (u?.nickname || u?.uniqueId || '').trim() || 'espectador';
  return s.startsWith('@') ? s : `@${s}`;
}

class LiveBridge {
  private conn: TikTokLiveConnection | null = null;
  private streamer = '';
  private state: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error' = 'idle';
  private lastError = '';
  private attempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private startedAt = 0;
  private roomId = '';
  private viewers = 0;
  private counts = { chat: 0, gift: 0, like: 0, member: 0, social: 0 };
  private push: Push | null = null;
  // Keepalive: el socket de tiktok-live-connector se cae solo cada ~15-30s cuando
  // el stream esta tranquilo (diagnostico 2026-10-04: caida a los ~25s, luego
  // reconexion correcta). Un PING periodico lo mantiene abierto; si aun asi
  // muere, se reconecta con backoff como hasta ahora.
  private keepAlive: ReturnType<typeof setInterval> | null = null;
  // Ultimo evento recibido; el keepalive lo usa para detectar sockets mudos.
  private lastEventAt = 0;

  // Diagnostico servidor -> cliente. Distingue "TikTok dejo de emitir" de
  // "el servidor emite pero el navegador dejo de leer":
  //   polls        -> cuantas veces ha venido el cliente a leer
  //   lastPollAt   -> ultimo GET del webhook (si envejece, el cliente se detuvo)
  //   lastPollSince-> cursor 'since' que trae el cliente
  private polls = 0;
  private lastPollAt = 0;
  private lastPollSince = 0;

  /** Lo llama la route del webhook en cada GET. */
  notePoll(since: number) {
    this.polls++;
    this.lastPollAt = Date.now();
    this.lastPollSince = since;

    // Registro espaciado de la salud del pipeline servidor -> navegador: una linea
    // cada 20s, mas una extra si el cursor llega envenenado (reloj desfasado).
    // Sin esto el buffer se llenaria de lineas identicas.
    const serverNow = Date.now();
    const cursorEnFuturo = since > serverNow + 5_000;
    const toca = cursorEnFuturo || serverNow - this._lastPollLogAt > 20_000;
    if (toca) {
      this._lastPollLogAt = serverNow;
      tiktokLogger.info('cliente', 'lectura del webhook', {
        polls: this.polls,
        desfaseSeg: Math.round((since - serverNow) / 1000),
        buffer: this.buffer.length,
        chat: this.counts.chat,
      });
    }
  }

  private _lastPollLogAt = 0;
  // Buffer propio: los eventos empiezan a llegar en cuanto se abre el socket,
  // normalmente ANTES de que el cliente pollee el webhook por primera vez. Si la
  // cola viviera en el consumidor, todo lo anterior al primer GET se perderia.
  private buffer: HotelEvent[] = [];

  /** Registra el consumidor (la route del webhook). */
  subscribe(push: Push) {
    this.push = push;
  }

  /**
   * Eventos acumulados posteriores a `since`.
   *
   * El `since` del cliente es un cursor de lectura que SOLO avanza con los
   * eventos que ya ha recibido, asi que nunca esta en el futuro salvo por reloj
   * desfasado. Se mantiene un clamp defensivo para ese caso: si llega muy por
   * delante, se usa `serverNow - 8s` en vez de `serverNow` a secas, porque clampar
   * al instante exacto descartaria los eventos encolados hace un momento.
   */
  drain(since = 0): HotelEvent[] {
    const serverNow = Date.now();
    const effective = since > serverNow + 5_000 ? serverNow - 8_000 : since;
    return this.buffer.filter((e) => e.timestamp > effective);
  }

  /** Ingesta manual (POST de webhook externo o pruebas). */
  ingest(ev: Omit<HotelEvent, 'id' | 'timestamp'>) {
    this.enqueue({
      id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      ...ev,
    });
  }

  /**
   * Mantener vivo el WebSocket.
   *
   * tiktok-live-connector no manda keepalive propio y el proxy intermedia puede
   * cerrar la conexion por inactividad: se caia sola cada ~15-30s. Cada 10s se
   * manda un PING por el protocolo websocket; ademas, si pasan 40s sin un solo
   * evento, se fuerza la reconexion aunque el socket parezca abierto (estaba
   * vivo en la apariencia pero mudo).
   */
  private startKeepAlive() {
    this.stopKeepAlive();
    this.lastEventAt = Date.now();
    this.keepAlive = setInterval(() => {
      const ws: any = (this.conn as any)?.ws ?? (this.conn as any)?._ws;
      try {
        if (ws && typeof ws.ping === 'function') ws.ping();
      } catch {
        // si el ping falla, el socket esta muerto: reconectar
        this.scheduleReconnect();
        return;
      }
      // Silencio prolongado: el socket sigue abierto pero no llega nada.
      //
      // NO reconectar por silencio. Error de diseño mio (2026-10-04): un live
      // tranquilo no emite eventos y eso es NORMAL, no una conexion muerta.
      // Con un umbral de 40s el bridge se reconectaba en bucle, reiniciaba
      // el buffer en cada connect() y los eventos se perdian — de ahi que
      // 'no entra ningun usuario'. Para que un socket se considere muerto
      // tiene que fallar el ping, que ya se cubre mas arriba.
      if (Date.now() - this.lastEventAt > 5 * 60_000) {
        // 5 minutos sin un solo evento: solo informativo, sin reconexion. Si el
        // live lleva tanto tiempo sin actividad, no hay nada que perder.
        this.lastError = 'Live sin actividad';
        tiktokLogger.info('socket', '5 min sin actividad (sin reconectar)', {
          estado: this.state,
        });
      }
    }, 10_000);
  }

  private stopKeepAlive() {
    if (this.keepAlive) {
      clearInterval(this.keepAlive);
      this.keepAlive = null;
    }
  }

  private enqueue(ev: HotelEvent) {
    this.lastEventAt = Date.now();
    this.buffer.unshift(ev);
    if (this.buffer.length > 200) this.buffer.length = 200;
    this.push?.(ev);
  }

  status() {
    return {
      state: this.state,
      streamer: this.streamer,
      roomId: this.roomId || null,
      viewers: this.viewers,
      connectedAt: this.startedAt || null,
      uptimeMs: this.startedAt ? Date.now() - this.startedAt : 0,
      lastError: this.lastError,
      counts: this.counts,
      // Diagnostico de la tuberia hacia el navegador.
      bufferSize: this.buffer.length,
      lastEventAt: this.lastEventAt || null,
      polls: this.polls,
      lastPollAt: this.lastPollAt || null,
      lastPollSince: this.lastPollSince || null,
      // Segundos desde el ultimo GET del cliente. Si crece, el NAVEGADOR dejo de
      // leer (no es TikTok); si es 0 y aun asi no hay eventos, es el socket.
      pollAgeSec: this.lastPollAt ? Math.round((Date.now() - this.lastPollAt) / 1000) : null,
    };
  }

  async connect(username: string) {
    const clean = username.replace(/^@/, '').trim();
    if (!clean) throw new Error('Nombre de usuario requerido');

    tiktokLogger.info('conectar', `pedido conectar @${clean}`, {
      actual: this.streamer || null,
    });

    if (this.streamer && this.streamer !== clean) {
      // Cambiar de streamer de verdad: limpio el buffer accumulated del anterior.
      this.disconnect();
      this.buffer = [];
    }

    this.streamer = clean;
    this.state = 'connecting';
    this.lastError = '';
    this.roomId = '';
    this.viewers = 0;
    // BUG (2026-10-04): conectar VACIABA el buffer SIEMPRE. Como el keepalive
    // reconectaba cada 40s en un live tranquilo, los eventos acumulados se
    // perdian en cada reconnect y el usuario no veia nada. Ahora el buffer solo
    // se limpia al cambiar de streamer; una reconexion del mismo conserva lo
    // pendiente.
    this.counts = { chat: 0, gift: 0, like: 0, member: 0, social: 0 };
    await this.open();
  }

  private async open() {
    const user = this.streamer;
    if (!user) return;

    try {
      const conn = new TikTokLiveConnection(user, {
        fetchRoomInfoOnConnect: true,
        processInitialData: true,
      });

      this.conn = conn;
      this.wire(conn, user);
      this.startKeepAlive();
      tiktokLogger.info('socket', `abriendo socket a @${user}`, {
        intento: this.attempts + 1,
      });

      await conn.connect();
      // connect() puede rechazar tarde (p.ej. al parsear el room info) DESPUES
      // de que el WebSocket ya este recibiendo eventos. Si Hear CONNECTED, la
      // conexion es real: no dejar que ese error la marque como caida.
      if (this.state !== 'connected') {
        this.state = 'connected';
        this.startedAt = Date.now();
      }
      this.attempts = 0;
    } catch (err: any) {
      this.lastError = err?.message || String(err);
      tiktokLogger.error('socket', `fallo al conectar: ${this.lastError}`, {
        estadoPrevio: this.state,
        intento: this.attempts + 1,
      });
      // Si ya estamos conectados y con eventos entrando, esto es ruido post-conexion.
      if (this.state === 'connected') {
        this.startedAt = this.startedAt || Date.now();
      } else {
        this.state = 'error';
        // No relanzamos: una cuenta offline no debe romper la UI. El cliente ve el
        // estado real por polling y reintentamos solos con backoff.
        this.scheduleReconnect();
      }
    }
  }

  private wire(conn: TikTokLiveConnection, user: string) {
    const emit = (e: Omit<HotelEvent, 'id' | 'timestamp'>) => {
      // Señal de vida real: si entran eventos, el socket funciona. El estado se
      // fija aqui porque en Alpine/musl el connect() puede rechazar por el
      // parseo del room info (b.mask) ANTES de que dispare CONNECTED, dejando
      // el estado en 'error' con un socket perfectamente sano.
      if (this.state !== 'connected') {
        this.state = 'connected';
        this.startedAt = this.startedAt || Date.now();
        this.lastError = '';
      }
      this.enqueue({
        id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
        ...e,
      });
    };

    conn.on(ControlEvent.CONNECTED, (s: TikTokLiveConnectionState) => {
          this.state = 'connected';
          this.startedAt = Date.now();
          this.roomId = (s as any)?.roomId || this.roomId;
          this.lastError = '';
          this.attempts = 0;
          tiktokLogger.info('socket', `conectado a @${user}`, {
            roomId: this.roomId || null,
          });
        });

        conn.on(ControlEvent.ERROR, (e: any) => {
          this.lastError = e?.message || String(e);
          tiktokLogger.error('socket', `error del socket: ${this.lastError}`, {
            estado: this.state,
          });
          // Un error aislado no tumba una conexion que sigue recibiendo eventos
          // (el protobuf lanza avisos spurios). Solo reconectamos si no hay socket vivo.
          if (this.state === 'connected') return;
          this.state = 'error';
          this.scheduleReconnect();
        });

        conn.on(ControlEvent.DISCONNECTED, () => {
          tiktokLogger.warn('socket', `socket cerrado para @${user}`, {
            estado: this.state,
          });
          if (this.streamer === user) this.scheduleReconnect();
        });

    // --- chat: el texto real esta en `content` --
        conn.on(WebcastEvent.CHAT, (d: any) => {
          const comment = d?.content;
          if (!comment) return;
          this.counts.chat++;
          const u = uname(d.user);
          tiktokLogger.countEvent('chat', u);
          emit({
            event: 'comment',
            username: u,
            comment: String(comment),
          });
        });

        // --- regalos ---
        conn.on(WebcastEvent.GIFT, (d: any) => {
          this.counts.gift++;
          const u = uname(d.user);
          tiktokLogger.countEvent('gift', u);
          tiktokLogger.info('evento', 'regalo recibido', {
            usuario: u,
            regalo: d?.giftName || 'Regalo',
            diamantes: Number(d?.diamondCount) || 0,
            racha: Number(d?.repeatCount) || 0,
          });
          emit({
            event: 'gift',
            username: u,
            giftName: d?.giftName || 'Regalo',
            giftId: String(d?.giftId ?? ''),
            giftCoins: Number(d?.diamondCount) || 1, // diamantes = valor real
            likeCount: Number(d?.repeatCount) || 1,   // repeat = racha
          });
        });

        // --- likes: el campo es `count`, no `likeCount` --
        conn.on(WebcastEvent.LIKE, (d: any) => {
          this.counts.like++;
          tiktokLogger.countEvent('like', uname(d.user));
          emit({
            event: 'like',
            username: uname(d.user),
            likeCount: Number(d?.count) || 1,
          });
        });

        // --- entradas al room ---
        conn.on(WebcastEvent.MEMBER, (d: any) => {
          this.counts.member++;
          tiktokLogger.countEvent('member', uname(d.user));
          emit({ event: 'share', username: uname(d.user) });
        });

        // --- follow / compartir ---
        conn.on(WebcastEvent.SOCIAL, (d: any) => {
          this.counts.social++;
          tiktokLogger.countEvent('social', uname(d?.user));
          const type = Number(d?.shareType ?? 0);
          emit({
            event: type === 3 ? 'follow' : 'share',
            username: uname(d?.user),
          });
        });

        conn.on(WebcastEvent.FOLLOW, (d: any) => {
          tiktokLogger.countEvent('follow', uname(d?.user));
          emit({ event: 'follow', username: uname(d?.user) });
        });

    // --- audiencia (solo informativo, no genera eventos de hotel) ---
    conn.on(WebcastEvent.ROOM_USER, (d: any) => {
      const t = Number(d?.totalUser ?? d?.total ?? 0);
      if (Number.isFinite(t)) this.viewers = t;
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    // Si ya entran eventos, el socket actual sirve: no abrir otro encima.
    if (this.state === 'connected') return;
    this.attempts++;
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** (this.attempts - 1),
      RECONNECT_MAX_MS
    );
    this.state = 'reconnecting';
    tiktokLogger.warn('socket', `reconectando en ${Math.round(delay / 1000)}s`, {
      intento: this.attempts,
      ultimoError: this.lastError || null,
      eventosHastaAhora: this.counts,
    });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.streamer) this.open();
    }, delay);
  }

  disconnect() {
    this.stopKeepAlive();
    if (this.streamer) {
      tiktokLogger.info('conectar', `desconectando @${this.streamer}`, {
        eventosRecibidos: this.counts,
      });
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      this.conn?.disconnect();
    } catch {
      /* ignore */
    }
    this.conn = null;
    this.streamer = '';
    this.roomId = '';
    this.viewers = 0;
    this.startedAt = 0;
    this.state = 'idle';
    this.attempts = 0;
    this.lastError = '';
  }
}

// singleton en globalThis: los route handlers de Next pueden recargar el modulo
// y perder el WebSocket si el estado viviera en el scope del modulo.
const g = globalThis as unknown as { __tiktokLiveBridge?: LiveBridge };
export const liveBridge: LiveBridge =
  g.__tiktokLiveBridge ?? (g.__tiktokLiveBridge = new LiveBridge());