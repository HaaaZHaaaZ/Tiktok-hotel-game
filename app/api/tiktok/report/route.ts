import { NextRequest, NextResponse } from 'next/server';
import { tiktokLogger } from '../../../../services/tiktok/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Endpoint para que el NAVEGADOR reporte lo que le pasa.
 *
 * Motivacion (2026-10-04): el servidor estaba ciego a partir de aqui. Se ve que
 * TikTok emite y que el buffer se llena, pero NO se ve que hace el navegador con
 * los eventos — y ahi estaba el bug real. Este endpoint cierra el circulo: el
 * cliente reporta sus errores, su estado del polling y las entradas al hotel, y
 * todo queda en el mismo log que ya se puede consultar y copiar.
 *
 * Uso desde el navegador:
 *   POST /api/tiktok/report
 *   { nivel:'error', tag:'eventos', msg:'...', data:{...} }
 *
 * Orestable via GET (util para probar desde curl):
 *   GET /api/tiktok/report?evento=entrada&usuario=@fulano
 */
export async function POST(req: NextRequest) {
  // Lectura defensiva del cuerpo. req.json()/req.text() pueden lanzar si el
  // cuerpo ya fue consumido o esta corrupto, y como el reporte es solo
  // diagnostico NUNCA debe romper nada: se envuelve todo y se sigue.
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  if (!body || typeof body !== 'object') body = {};

  const nivel = (body?.nivel || 'info').toString();
  const tag = (body?.tag || 'navegador').toString().slice(0, 40);
  const msg = (body?.msg || '').toString().slice(0, 500);
  const data = body?.data && typeof body.data === 'object' ? body.data : undefined;

  try {
    const registrar =
      nivel === 'error'
        ? tiktokLogger.error
        : nivel === 'warn'
          ? tiktokLogger.warn
          : tiktokLogger.info;
    registrar(tag, msg || '(sin mensaje)', data);
  } catch {
    // Si el logger falla, se responde igual: reportar nunca debe ser un problema.
  }

  // Responder siempre 200: un fallo al reportar nunca debe romper la app.
  return NextResponse.json({ success: true });
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const evento = q.get('evento');
  const usuario = q.get('usuario') || '';
  const detalle = q.get('detalle') || '';

  if (evento) {
    tiktokLogger.info('navegador', evento, {
      usuario: usuario || undefined,
      detalle: detalle || undefined,
    });
  }

  return NextResponse.json({ success: true, recibido: evento || null });
}