import { NextRequest, NextResponse } from 'next/server';
import { liveBridge } from '../../../../services/tiktok/liveBridge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Conecta (o desconecta) el live de un streamer.
 *
 * Antes esto solo scrapeaba el HTML de TikTok para ver si estaba en vivo y
 * devolvia exito SIEMPRE, aunque no ocurriese nada: los eventos solo llegaban
 * si alguien hacia POST al webhook. Ahora abre un WebSocket real al live y los
 * eventos fluyen solos.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, action } = body || {};

    if (action === 'disconnect') {
      liveBridge.disconnect();
      return NextResponse.json({
        success: true,
        status: 'disconnected',
        message: 'Conexion cerrada',
      });
    }

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Debes proporcionar un nombre de usuario de TikTok válido' },
        { status: 400 }
      );
    }

    const cleanUsername = username.replace(/^@/, '').trim();

    if (!/^[A-Za-z0-9_.-]{2,24}$/.test(cleanUsername)) {
      return NextResponse.json(
        {
          success: false,
          error: `El nombre "${cleanUsername}" no tiene un formato válido de TikTok (2-24 caracteres: letras, números, puntos o guiones bajos).`,
        },
        { status: 400 }
      );
    }

    await liveBridge.connect(cleanUsername);
    const st = liveBridge.status();

    return NextResponse.json({
      success: true,
      status: 'connected',
      streamer: `@${cleanUsername}`,
      isLive: st.state === 'connected',
      roomId: st.roomId,
      connectionState: st.state,
      lastError: st.lastError || undefined,
      connectedAt: st.connectedAt ? new Date(st.connectedAt).toISOString() : null,
      source: 'tiktok-live-connector',
      message:
        st.state === 'connected'
          ? `Conectado al live de @${cleanUsername}. Los comentarios, regalos y likes entran solos.`
          : st.state === 'connecting' || st.state === 'reconnecting'
            ? `Conectando con @${cleanUsername}... Si no está en vivo, se reintentará automáticamente.`
            : `No se pudo conectar con @${cleanUsername}${st.lastError ? `: ${st.lastError}` : ''}.`,
      webhookUrl: `/api/tiktok/webhook`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error conectando con TikTok LIVE' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const st = liveBridge.status();
  return NextResponse.json({
    success: true,
    connection: {
      state: st.state,
      streamer: st.streamer,
      roomId: st.roomId,
      connectedAt: st.connectedAt,
      uptimeMs: st.uptimeMs,
      lastError: st.lastError,
      counts: st.counts,
      // Medidores de la tuberia servidor -> navegador. Si 'pollAgeSec' crece, el
      // NAVEGADOR dejo de pedir eventos (no es TikTok). Consultar en caliente:
      //   curl http://192.168.1.37:8095/api/tiktok/connect | jq .connection
      polls: st.polls,
      pollAgeSec: st.pollAgeSec,
      bufferSize: st.bufferSize,
      lastPollSince: st.lastPollSince,
      serverTime: Date.now(),
    },
  });
}