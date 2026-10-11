import { NextRequest } from 'next/server';

/**
 * Comprobacion de la sesion de administrador.
 *
 * Vive aparte de la ruta de login porque la usan varias rutas (la de sincronia,
 * para no dejar que una pantalla de espectador publique cambios de admin). Si
 * estuviera dentro de `app/api/admin/auth/route.ts`, importarla arrastraria el
 * handler de la ruta entera.
 */

export const ADMIN_COOKIE = 'hotel_admin';

/** Contrasena por defecto, para que el proyecto funcione sin configurar nada. */
export const PASSWORD_POR_DEFECTO = 'hermes';

/** Cuanto dura la sesion. */
export const SESION_MS = 12 * 60 * 60 * 1000; // 12 horas

export function passwordValida(): { pass: string; porDefecto: boolean } {
  const env = (process.env.ADMIN_PASSWORD || '').trim();
  if (env) return { pass: env, porDefecto: false };
  return { pass: PASSWORD_POR_DEFECTO, porDefecto: true };
}

/**
 * Firma el token de sesion.
 *
 * No es un JWT: no hace falta. Es un valor derivado de la contrasena y la fecha,
 * que el servidor puede volver a calcular para comprobar que la cookie es suya.
 * Sin la contrasena no se puede fabricar.
 */
export function firmarSesion(marca: number, pass: string): string {
  let h = 2166136261;
  const texto = `${marca}:${pass}:hotel`;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** El token es valido y no ha caducado? */
export function tokenValido(token: string | undefined): boolean {
  if (!token) return false;
  const [marcaStr, firma] = token.split('.');
  const marca = Number(marcaStr);
  if (!marca || !firma) return false;
  if (Date.now() - marca > SESION_MS) return false;
  const { pass } = passwordValida();
  return firmarSesion(marca, pass) === firma;
}

/** Hay sesion de administrador en esta peticion? */
export function sesionAdminValida(req: NextRequest): boolean {
  return tokenValido(req.cookies.get(ADMIN_COOKIE)?.value);
}
