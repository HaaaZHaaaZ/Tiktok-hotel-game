/**
 * Log de la conexion con TikTok.
 *
 * Vive en el SERVIDOR y guarda un buffer circular de las ultimas lineas.
 * Sirve para dos cosas:
 *
 *  1. Diagnostico en caliente sin depender del navegador: si el contador 'polls'
 *     sube y 'pollAgeSec' crece, el que dejo de leer es el navegador; si los
 *     contadores de eventos no suben, es el socket.
 *  2. Poder COPIAR el log entero cuando algo falla y pegarlo en el chat, para
 *     tener el rastro completo sin depender de acceso al servidor.
 *
 * ---------------------------------------------------------------------------
 * POR QUE SON FUNCIONES Y NO UNA CLASE, Y POR QUE EL ESTADO ESTA EN UN FICHERO
 *
 * Este modulo se reescribio cuatro veces intentando compartir el buffer entre
 * /api/tiktok/log y /api/tiktok/report, y las cuatro fallaron con
 * "Cannot read properties of undefined (reading 'push')", con el endpoint
 * respondiendo success:true y el log vacio.
 *
 * Lo que se comprobo en caliente, en este servidor:
 *   - Next.js standalone empaqueta el modulo por route handler.
 *   - Con este runtime, cada copia ve un `globalThis` DISTINTO: el store
 *     devolvia `existe: false` desde la propia ruta que acababa de escribir.
 *   - E `import fs from 'node:fs'` dentro de una clase se rompia al ejecutarse
 *     dentro del bundle minificado.
 *
 * Asi que: nada de estado en memoria ni en globalThis. Funciones sueltas que
 * leen y escriben un fichero, que es lo unico que el servidor_si_ comparte
 * entre rutas. Cada operacion vuelve a leer del disco, de modo que el orden de
 * las escrituras no importa y no hay estado que se quede obsoleto.
 *
 * Ventaja extra: reiniciar el contenedor ya no borra el historial.
 * ---------------------------------------------------------------------------
 */

import fs from 'node:fs';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  ts: number;
  level: LogLevel;
  tag: string;
  msg: string;
  data?: Record<string, unknown>;
}

const MAX_LINES = 500;
const LOG_FILE = process.env.TIKTOK_LOG_FILE || '/tmp/tiktok-log.json';

interface LogFile {
  lines: LogEntry[];
}

/** Lee el buffer del disco. Devuelve vacio si aun no existe. */
function readAll(): LogEntry[] {
  try {
    const raw = fs.readFileSync(LOG_FILE, 'utf8');
    const parsed = JSON.parse(raw) as LogFile;
    if (parsed && Array.isArray(parsed.lines)) return parsed.lines;
  } catch {
    /* todavia no hay log */
  }
  return [];
}

/** Escribe el buffer completo. El buffer es pequeno, no hace falta append. */
function writeAll(lines: LogEntry[]): void {
  try {
    fs.writeFileSync(LOG_FILE, JSON.stringify({ lines }), 'utf8');
  } catch {
    /* si el disco falla, el log no se guarda pero la app sigue */
  }
}

/** Anade una linea, reflaja en consola y persiste. */
export function logLine(level: LogLevel, tag: string, msg: string, data?: Record<string, unknown>): void {
  const lines = readAll();
  lines.push({ ts: Date.now(), level, tag, msg, data });
  while (lines.length > MAX_LINES) lines.shift();
  writeAll(lines);

  const t = new Date().toISOString().slice(11, 23);
  console.log(`[tiktok] ${t} ${level.padEnd(5)} ${tag.padEnd(9)} ${msg}`, data ?? '');
}

export function logInfo(tag: string, msg: string, data?: Record<string, unknown>): void {
  logLine('INFO', tag, msg, data);
}

export function logWarn(tag: string, msg: string, data?: Record<string, unknown>): void {
  logLine('WARN', tag, msg, data);
}

export function logError(tag: string, msg: string, data?: Record<string, unknown>): void {
  logLine('ERROR', tag, msg, data);
}

/**
 * Acumula un evento de TikTok. Se registra como una linea de tipo 'contador',
 * de la que tallySnapshot() vuelve a extraer los totales. Asi el contador queda
 * en el fichero y sobrevive a que otra ruta lea el log.
 */
export function countEvent(kind: string, username?: string): void {
  const snapshot = tallySnapshot();
  const n = (snapshot[kind] || 0) + 1;
  logInfo('contador', `${kind}: ${n}`);
  if (username && n <= 3) logInfo('evento', `primer ${kind}`, { usuario: username });
}

/** Totales por tipo, reconstruidos a partir de las lineas de 'contador'. */
export function tallySnapshot(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of readAll()) {
    if (e.tag !== 'contador') continue;
    const m = /^(\w+):\s*(\d+)$/.exec(e.msg);
    if (m) out[m[1]] = Number(m[2]);
  }
  return out;
}

export function since(ts: number): LogEntry[] {
  return readAll().filter((e) => e.ts >= ts);
}

export function all(): LogEntry[] {
  return readAll();
}

export function count(): number {
  return readAll().length;
}

/** Ruta del fichero, para mostrarlo en el panel de diagnostico del admin. */
export function logFilePath(): string {
  return LOG_FILE;
}

/** Texto plano para copiar y pegar tal cual en un chat. */
export function toText(entries?: LogEntry[]): string {
  const list = entries ?? readAll();
  return list
    .map((e) => {
      const t = new Date(e.ts).toISOString().replace('T', ' ').slice(0, 23);
      const d = e.data ? ` ${JSON.stringify(e.data)}` : '';
      return `${t} ${e.level.padEnd(5)} ${e.tag.padEnd(9)} ${e.msg}${d}`;
    })
    .join('\n');
}

export function clear(): void {
  writeAll([]);
}