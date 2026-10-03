'use client';

import { hotelBroadcast } from './broadcastSync';

export interface TikTokLiveStatus {
  isConnected: boolean;
  streamer: string;
  roomId?: string;
  error?: string;
}

class TikTokLiveConnectorService {
  private status: TikTokLiveStatus = {
    isConnected: false,
    streamer: '',
  };
  private pollTimer: any = null;
  private lastPolledTimestamp = Date.now();

  public getStatus(): TikTokLiveStatus {
    return this.status;
  }

  public async connect(username: string): Promise<TikTokLiveStatus> {
    const cleanUser = username.replace(/^@/, '').trim();
    if (!cleanUser) {
      return { isConnected: false, streamer: '', error: 'Nombre de usuario requerido' };
    }

    try {
      const res = await fetch('/api/tiktok/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser }),
      });
      const data = await res.json();
      if (data.success) {
        this.status = {
          isConnected: true,
          streamer: `@${cleanUser}`,
          roomId: data.roomId,
        };

        this.startWebhookPolling();
        return this.status;
      } else {
        throw new Error(data.error || 'Error al conectar');
      }
    } catch (err: any) {
      this.status = {
        isConnected: false,
        streamer: `@${cleanUser}`,
        error: err.message || 'Error de red',
      };
      return this.status;
    }
  }

  public disconnect() {
    this.status = { isConnected: false, streamer: '' };
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private startWebhookPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.lastPolledTimestamp = Date.now();

    this.pollTimer = setInterval(async () => {
      if (!this.status.isConnected) return;
      try {
        const res = await fetch(`/api/tiktok/webhook?since=${this.lastPolledTimestamp}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.events && Array.isArray(data.events) && data.events.length > 0) {
          data.events.forEach((ev: any) => {
            this.emitEvent({
              eventType: ev.event,
              username: ev.username,
              comment: ev.comment,
              giftName: ev.giftName,
              giftId: ev.giftId,
              giftCoins: ev.giftCoins,
              likeCount: ev.likeCount,
            });
            if (ev.timestamp > this.lastPolledTimestamp) {
              this.lastPolledTimestamp = ev.timestamp;
            }
          });
        }
      } catch {
        // ignore polling errors
      }
    }, 1500);
  }

  public emitEvent(event: {
    eventType: 'comment' | 'gift' | 'like' | 'share' | 'follow';
    username: string;
    comment?: string;
    giftId?: string;
    giftName?: string;
    giftCoins?: number;
    likeCount?: number;
  }) {
    hotelBroadcast.post({
      type: 'TIKTOK_EVENT',
      payload: event,
    });
  }
}

export const tiktokLiveConnector = new TikTokLiveConnectorService();
