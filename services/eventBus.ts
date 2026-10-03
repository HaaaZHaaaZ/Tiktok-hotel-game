'use client';

export type HotelEventType =
  | 'USER_JOINED'
  | 'USER_LEFT'
  | 'COMMENT_RECEIVED'
  | 'GIFT_RECEIVED'
  | 'FOLLOW_RECEIVED'
  | 'ROOM_ASSIGNED'
  | 'ROOM_RELEASED'
  | 'FLOOR_CREATED'
  | 'FLOOR_DESTROYED'
  | 'VIP_GRANTED'
  | 'EVENT_STARTED'
  | 'EVENT_ENDED'
  | 'TIME_CHANGED'
  | 'ACTION_STARTED'
  | 'ACTION_FINISHED';

export interface HotelEventPayload<T = any> {
  type: HotelEventType;
  payload: T;
  timestamp: number;
}

type EventCallback<T = any> = (event: HotelEventPayload<T>) => void;

class EventBus {
  private listeners: Map<HotelEventType, Set<EventCallback>> = new Map();

  public on<T = any>(eventType: HotelEventType, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    // Return unbind function
    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  public emit<T = any>(eventType: HotelEventType, payload: T): void {
    const callbacks = this.listeners.get(eventType);
    if (!callbacks || callbacks.size === 0) return;

    const eventObj: HotelEventPayload<T> = {
      type: eventType,
      payload,
      timestamp: Date.now(),
    };

    callbacks.forEach((cb) => {
      try {
        cb(eventObj);
      } catch (err) {
        console.error(`Error executing listener for ${eventType}:`, err);
      }
    });
  }

  public clearAll(): void {
    this.listeners.clear();
  }
}

export const hotelEventBus = new EventBus();
