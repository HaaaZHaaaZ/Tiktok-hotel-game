import { NextRequest, NextResponse } from 'next/server';

interface TikTokIncomingEvent {
  id: string;
  timestamp: number;
  event: 'comment' | 'gift' | 'like' | 'share' | 'follow';
  username: string;
  comment?: string;
  giftName?: string;
  giftId?: string;
  giftCoins?: number;
  likeCount?: number;
}

// Global buffer in memory for active stream
const eventQueue: TikTokIncomingEvent[] = [];

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

    const formattedUsername = username.startsWith('@') ? username : `@${username}`;

    const newEvent: TikTokIncomingEvent = {
      id: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      event,
      username: formattedUsername,
      comment,
      giftName,
      giftId,
      giftCoins: Number(giftCoins) || 1,
      likeCount: Number(likeCount) || 1,
    };

    eventQueue.unshift(newEvent);
    if (eventQueue.length > 100) {
      eventQueue.pop();
    }

    return NextResponse.json({
      success: true,
      message: 'Evento recibido y despachado al hotel',
      event: newEvent,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error procesando webhook' },
      { status: 400 }
    );
  }
}

export async function GET(req: NextRequest) {
  const since = Number(req.nextUrl.searchParams.get('since')) || 0;
  const recentEvents = eventQueue.filter((ev) => ev.timestamp > since);

  return NextResponse.json({
    status: 'online',
    service: 'TikTok LIVE Hotel Webhook Gateway',
    timestamp: Date.now(),
    events: recentEvents,
    totalQueued: eventQueue.length,
    instructions: {
      tikfinity: 'Configura un Webhook Action apuntando a esta URL con método POST y JSON body.',
      fields: ['event (comment/gift/like/share/follow)', 'username', 'comment', 'giftName', 'giftCoins', 'likeCount'],
    },
  });
}
