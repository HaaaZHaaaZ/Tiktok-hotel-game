import { NextRequest, NextResponse } from 'next/server';
import { clear, logFilePath, since as sinceTs, tallySnapshot, toText } from '../../../../services/tiktok/logger';
import { liveBridge } from '../../../../services/tiktok/liveBridge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Log de la conexion con TikTok, para diagnostico y para pegar en un chat.
 *
 * Uso:
 *   /api/tiktok/log                 -> ultimas lineas en JSON
 *   /api/tiktok/log?format=text     -> texto plano, listo para copiar y pegar
 *   /api/tiktok/log?since=60        -> solo el ultimo minuto (segundos)
 *   /api/tiktok/log?clear=1         -> vaciar el log (POST tambien vale)
 *
 * El texto plano incluye un resumen al final con el estado de la tuberia, que
 * es lo que de verdad dice donde se rompe:
 *   - si 'polls' deja de subir pero el socket sigue conectado -> fallo el navegador
 *   - si los contadores de eventos no suben -> fallo el socket o TikTok
 *   - si 'desfaseSeg' es grande y positivo -> cursor envenenado
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const format = q.get('format') || 'json';
  const sinceSec = Number(q.get('since') || 0);

  if (q.get('clear')) clear();

  const desde = sinceSec > 0 ? Date.now() - sinceSec * 1000 : 0;
  const entries = sinceTs(desde);
  const st = liveBridge.status();

  const summary = {
    estado: st.state,
    streamer: st.streamer,
    uptimeSeg: Math.round(st.uptimeMs / 1000),
    eventos: st.counts,
    recibidoPorTikTok: tallySnapshot(),
    lecturasCliente: st.polls,
    segundosDesdeUltimaLectura: st.pollAgeSec,
    desfaseCursorSeg: st.lastPollSince
      ? Math.round((st.lastPollSince - Date.now()) / 1000)
      : null,
    bufferPendiente: st.bufferSize,
    ultimoError: st.lastError,
    ficheroLog: logFilePath(),
  };

  if (format === 'text') {
    const lines = [
      '=== ESTADO DE LA TUBERIA TIKTOK ===',
      JSON.stringify(summary, null, 2),
      '',
      '=== LOG ===',
      entries.length ? toText(entries) : '(sin lineas)',
    ].join('\n');
    return new NextResponse(lines, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  return NextResponse.json({
    summary,
    total: entries.length,
    entries,
  });
}

export async function POST(req: NextRequest) {
  clear();
  return NextResponse.json({ success: true, message: 'Log vaciado' });
}