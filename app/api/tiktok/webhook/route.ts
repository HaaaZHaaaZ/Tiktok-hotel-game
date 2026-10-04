import { NextRequest, NextResponse } from 'next/server';
import { liveBridge } from '../../../../services/tiktok/liveBridge';

// Force runtime Node: tiktok-live-connector usa ws/protobuf y no funciona en Edge.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * La cola de eventos vive DENTRO del bridge (singleton en globalThis), no aqui.
 *
 * Antes estaba en el scope de este modulo y se perdia de dos maneras:
 *  1. Next recarga el modulo de la route en cada request -> la cola se reinicia.
 *  2. Los eventos empiezan a llegar al abrir el socket, antes del primer GET del
 *     cliente -> se descartaban porque no habia consumidor todavia.
 * El bridge acumula siempre; esta route solo lee.
 */

export async function GET(req: NextRequest) {
  const since = Number(req.nextUrl.searchParams.get('since')) || 0;
  // Registrar la lectura: permite distinguir "TikTok dejo de emitir" de
  // "el navegador dejo de pedir eventos" sin depender del cliente.
  liveBridge.notePoll(since);
  const events = liveBridge.drain(since);
  const st = liveBridge.status();

  return NextResponse.json({
    status: st.state === 'connected' ? 'online' : 'waiting',
    service: 'TikTok LIVE Hotel Webhook Gateway',
    source: 'tiktok-live-connector',
    timestamp: Date.now(),
    connection: {
      state: st.state,
      streamer: st.streamer,
      roomId: st.roomId,
      viewers: st.viewers,
      connectedAt: st.connectedAt,
      uptimeMs: st.uptimeMs,
      lastError: st.lastError,
      counts: st.counts,
    },
    events,
    totalQueued: events.length,
    instructions: {
      events: ['comment', 'gift', 'like', 'share', 'follow'],
      note: 'Los eventos vienen del live real. El POST manual sigue soportado.',
    },
  });
}

/**
 * Ingesta manual. Se conserva por compatibilidad: si TikTok manda un webhook
 * externo o quieres probar sin live, sigue funcionando.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      event = 'comment',
      username = 'espectador_tiktok',
      comment = '',
      giftName = '',
      giftId = '',
      giftCoins = 1,
      likeCount = 1,
    } = body;

    const payload = {
      event,
      username: username.startsWith('@') ? username : `@${username}`,
      comment,
      giftName,
      giftId,
      giftCoins: Number(giftCoins) || 1,
      likeCount: Number(likeCount) || 1,
    };

    liveBridge.ingest(payload);

    return NextResponse.json({
      success: true,
      message: 'Evento recibido y despachado al hotel',
      event: { id: 'manual', timestamp: Date.now(), ...payload },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error procesando webhook' },
      { status: 400 }
    );
  }
}