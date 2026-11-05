import type { NextRequest } from 'next/server';
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

/**
 * Comprobacion de la sesion de administrador.
 *
 * Vive aparte de la ruta de login porque la usan varias rutas (la de sincronia,
 * para no dejar que una pantalla de espectador publique cambios de admin). Si
 * estuviera dentro de `app/api/admin/auth/route.ts`, importarla arrastraria el
 * handler de la ruta entera.
 */

export const ADMIN_COOKIE = 'hotel_admin';

/**
 * Contrasena por defecto, SOLO para desarrollo (`next dev`).
 *
 * En produccion (`NODE_ENV=production`, que es lo que pone el Dockerfile) NO se
 * usa nunca: el repo es publico y cualquiera la conoce. Si falta
 * `ADMIN_PASSWORD`, el panel queda bloqueado en vez de abierto con una clave
 * conocida.
 */
export const PASSWORD_POR_DEFECTO = 'hermes';

/** Cuanto dura la sesion. */
export const SESION_MS = 12 * 60 * 60 * 1000; // 12 horas

export interface EstadoPassword {
  /** Contrasena vigente, o null si el panel esta bloqueado. */
  pass: string | null;
  /** Se esta usando la contrasena de desarrollo. */
  porDefecto: boolean;
  /** Produccion sin ADMIN_PASSWORD: nadie puede entrar. */
  bloqueado: boolean;
}

export function passwordValida(env: NodeJS.ProcessEnv = process.env): EstadoPassword {
  const propia = (env.ADMIN_PASSWORD || '').trim();
  if (propia) return { pass: propia, porDefecto: false, bloqueado: false };
  if (env.NODE_ENV === 'production') return { pass: null, porDefecto: false, bloqueado: true };
  return { pass: PASSWORD_POR_DEFECTO, porDefecto: true, bloqueado: false };
}

/** Compara en tiempo constante (no filtra por cuanto tarda cuantos caracteres acierta). */
function igualesSeguro(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** La contrasena enviada es la buena? Siempre false si el panel esta bloqueado. */
export function passwordCorrecta(enviada: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const { pass } = passwordValida(env);
  if (!pass) return false;
  return igualesSeguro(enviada, pass);
}

/**
 * Firma el token de sesion: HMAC-SHA256 de la marca de tiempo con la contrasena
 * como clave. Sin la contrasena no se puede fabricar, y al cambiar
 * `ADMIN_PASSWORD` todas las sesiones anteriores dejan de valer.
 */
export function firmarSesion(marca: number, pass: string): string {
  return createHmac('sha256', pass).update(`${marca}:hotel`).digest('base64url');
}

/** El token es valido y no ha caducado? */
export function tokenValido(
  token: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
  ahora: number = Date.now()
): boolean {
  if (!token) return false;
  const { pass } = passwordValida(env);
  if (!pass) return false;
  const [marcaStr, firma] = token.split('.');
  const marca = Number(marcaStr);
  if (!marca || !firma) return false;
  if (ahora - marca > SESION_MS || marca > ahora + 60_000) return false;
  return igualesSeguro(firmarSesion(marca, pass), firma);
}

/** Hay sesion de administrador en esta peticion? */
export function sesionAdminValida(req: NextRequest): boolean {
  return tokenValido(req.cookies.get(ADMIN_COOKIE)?.value);
}
