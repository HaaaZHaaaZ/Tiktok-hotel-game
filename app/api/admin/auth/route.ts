import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  SESION_MS,
  passwordValida,
  passwordCorrecta,
  firmarSesion,
  tokenValido,
} from '../../../../services/adminAuth';

/**
 * Login simple del administrador.
 *
 * El objetivo NO es proteger secretos: es saber QUIEN manda en el hotel. Hasta
 * ahora cualquiera que abriera `/admin` podia cambiar reglas, demoler pisos o
 * reiniciar el live, y no habia forma de distinguir al streamer de un curioso.
 *
 * La sesion vive en una cookie `httpOnly`, asi que el navegador la manda sola en
 * cada peticion y el JavaScript de la pagina no puede leerla ni robarla.
 *
 * La contrasena se configura con `ADMIN_PASSWORD`. Si no se define:
 * - en desarrollo se usa una por defecto y se avisa en la respuesta;
 * - en produccion el panel queda BLOQUEADO (503): el repo es publico y la clave
 *   por defecto la conoce cualquiera.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET -> hay sesion activa? */
export async function GET(req: NextRequest) {
  const { porDefecto, bloqueado } = passwordValida();
  return NextResponse.json({
    autenticado: tokenValido(req.cookies.get(ADMIN_COOKIE)?.value),
    usandoPasswordPorDefecto: porDefecto,
    bloqueado,
  });
}

/** POST -> iniciar o cerrar sesion. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const accion = String(body?.action || 'login');

  if (accion === 'logout') {
    const res = NextResponse.json({ ok: true, autenticado: false });
    res.cookies.set(ADMIN_COOKIE, '', { path: '/', maxAge: 0 });
    return res;
  }

  const { pass, porDefecto, bloqueado } = passwordValida();
  if (bloqueado || !pass) {
    return NextResponse.json(
      {
        ok: false,
        bloqueado: true,
        error: 'Panel bloqueado: falta ADMIN_PASSWORD en el servidor',
      },
      { status: 503 }
    );
  }
  if (!passwordCorrecta(String(body?.password || ''))) {
    return NextResponse.json(
      { ok: false, error: 'Contraseña incorrecta' },
      { status: 401 }
    );
  }

  const marca = Date.now();
  const res = NextResponse.json({
    ok: true,
    autenticado: true,
    usandoPasswordPorDefecto: porDefecto,
  });
  res.cookies.set(ADMIN_COOKIE, `${marca}.${firmarSesion(marca, pass)}`, {
    // `httpOnly` = el JavaScript de la pagina no puede leer la cookie.
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESION_MS / 1000,
    // Sin `secure` a proposito: el hotel suele servirse por HTTP en la red local
    // (192.168.x.x), y con `secure` la cookie no se guardaria ahi.
  });
  return res;
}
