/**
 * Log de la conexion con TikTok.
 *
 * Vive en el SERVIDOR (singleton en globalThis) y guarda un buffer circular de
 * las ultimas lineas. Sirve para dos cosas:
 *
 *  1. Diagnostico en caliente sin depender del navegador: si el contador 'polls'
 *     sube y 'pollAgeSec' crece, el que dejo de leer es el navegador; si los
 *     contadores de eventos no suben, es el socket.
 *  2. Poder COPIAR el log entero cuando algo falla y pegarlo en el chat, para
 *     tener el rastro completo sin depender de acceso al servidor.
 *
 * Cada linea guarda timestamp y un nivel. Los eventos de TikTok se registran
 * agregados por tipo (no uno por comentario) para que el buffer no se llene de
 * ruido en un live con trafico; el detalle se puede pedir con ?verbose=1.
 */

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  ts: number;
  level: LogLevel;
  tag: string;
  msg: string;
  data?: Record<string, unknown>;
}

const MAX_LINES = 500;

// singleton en globalThis: los route handlers de Next pueden recargar el modulo
const g = globalThis as unknown as { __tiktokLogger?: TikTokLogger };

export class TikTokLogger {
  private lines: LogEntry[] = [];
  private listeners = new Set<(e: LogEntry) => void>();

  /** Numero de eventos vistos por tipo desde el ultimo reset. */
  private tally: Record<string, number> = {};

  private push(level: LogLevel, tag: string, msg: string, data?: Record<string, unknown>) {
    const e: LogEntry = { ts: Date.now(), level, tag, msg, data };
    this.lines.push(e);
    if (this.lines.length > MAX_LINES) this.lines.shift();
    // reflejo inmediato en la consola del contenedor (docker logs)
    const t = new Date(e.ts).toISOString().slice(11, 23);
    console.log(`[tiktok] ${t} ${level.padEnd(5)} ${tag.padEnd(9)} ${msg}`, data ?? '');
    this.listeners.forEach((fn) => {
      try {
        fn(e);
      } catch {
        /* un listener roto no debe tumbar el log */
      }
    });
  }

  info(tag: string, msg: string, data?: Record<string, unknown>) {
    this.push('INFO', tag, msg, data);
  }
  warn(tag: string, msg: string, data?: Record<string, unknown>) {
    this.push('WARN', tag, msg, data);
  }
  error(tag: string, msg: string, data?: Record<string, unknown>) {
    this.push('ERROR', tag, msg, data);
  }

  /** Acumula un evento de TikTok sin volcar una linea por cada comentario. */
  countEvent(kind: string, username?: string) {
    this.tally[kind] = (this.tally[kind] || 0) + 1;
    if (username && this.tally[kind] <= 3) {
      this.push('INFO', 'evento', `primer ${kind}`, { usuario: username });
    }
  }

  tallySnapshot(): Record<string, number> {
    return { ...this.tally };
  }

  since(ts: number): LogEntry[] {
    return this.lines.filter((e) => e.ts >= ts);
  }

  all(): LogEntry[] {
    return [...this.lines];
  }

  /** Texto plano para copiar y pegar tal cual en un chat. */
  toText(entries = this.lines): string {
    return entries
      .map((e) => {
        const t = new Date(e.ts).toISOString().replace('T', ' ').slice(0, 23);
        const d = e.data ? ` ${JSON.stringify(e.data)}` : '';
        return `${t} ${e.level.padEnd(5)} ${e.tag.padEnd(9)} ${e.msg}${d}`;
      })
      .join('\n');
  }

  clear() {
    this.lines = [];
    this.tally = {};
  }
}

export const tiktokLogger: TikTokLogger =
  g.__tiktokLogger ?? (g.__tiktokLogger = new TikTokLogger());