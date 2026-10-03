'use client';

import { PersonalityType, GlobalEventType, TimeOfDay, EntryRulesConfig, WeatherType } from '../types/hotel';

export type HotelBroadcastMessage =
  | { type: 'JOIN_VIEWER'; payload: { username: string; personality?: PersonalityType; avatar?: any } }
  | { type: 'SEND_COMMENT'; payload: { username?: string; comment: string } }
  | { type: 'SEND_GIFT'; payload: { giftId: string; username?: string } }
  | { type: 'TRIGGER_EVENT'; payload: { eventType: GlobalEventType } }
  | { type: 'SET_TIME'; payload: { timeOfDay: TimeOfDay } }
  | { type: 'SET_WEATHER'; payload: { weather: WeatherType } }
  | { type: 'CREATE_FLOOR' }
  | { type: 'DESTROY_FLOOR'; payload: { floorNumber: number } }
  | { type: 'EVICT_RESIDENT'; payload: { residentId: string } }
  | { type: 'BOOST_STABILITY'; payload: { residentId: string; amount: number } }
  | { type: 'RESET_LIVE'; payload: { mode: 'NEW_LIVE' | 'CONTINUE_LIVE' } }
  | { type: 'UPDATE_RULES'; payload: { rules: Partial<EntryRulesConfig> } }
  | { type: 'SYNC_STATE'; payload: { state: any } }
  | {
      type: 'TIKTOK_EVENT';
      payload: {
        eventType: 'comment' | 'gift' | 'like' | 'share' | 'follow';
        username: string;
        comment?: string;
        giftId?: string;
        giftName?: string;
        giftCoins?: number;
        likeCount?: number;
      };
    };

class BroadcastSyncService {
  private channel: BroadcastChannel | null = null;
  private listeners: Array<(msg: HotelBroadcastMessage) => void> = [];

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('tiktok_hotel_sync_channel');
        this.channel.onmessage = (event) => {
          if (event.data) {
            this.listeners.forEach((fn) => fn(event.data));
          }
        };
      } catch {
        this.channel = null;
      }
    }
  }

  public post(message: HotelBroadcastMessage) {
    if (this.channel) {
      try {
        this.channel.postMessage(message);
      } catch {
        // ignore
      }
    }
    // Also notify listeners in the same window
    this.listeners.forEach((fn) => fn(message));

    // Fallback to localStorage event for older browsers or cross-context
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          'tiktok_hotel_last_action',
          JSON.stringify({ ...message, _ts: Date.now() })
        );
      } catch {
        // ignore
      }
    }
  }

  public subscribe(callback: (msg: HotelBroadcastMessage) => void): () => void {
    this.listeners.push(callback);

    // Fallback storage listener
    const storageHandler = (e: StorageEvent) => {
      if (e.key === 'tiktok_hotel_last_action' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          delete parsed._ts;
          callback(parsed as HotelBroadcastMessage);
        } catch {
          // ignore
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', storageHandler);
    }

    return () => {
      this.listeners = this.listeners.filter((fn) => fn !== callback);
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', storageHandler);
      }
    };
  }
}

export const hotelBroadcast = new BroadcastSyncService();
