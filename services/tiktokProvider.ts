'use client';

import { hotelEventBus } from './eventBus';
import { GiftDefinition, PersonalityType, ResidentAvatar } from '../types/hotel';

export interface TikTokUser {
  uniqueId: string; // @username
  nickname: string;
  avatarUrl?: string;
}

export interface TikTokCommentEvent {
  user: TikTokUser;
  comment: string;
  createTime: number;
}

export interface TikTokGiftEvent {
  user: TikTokUser;
  giftId: string;
  giftName: string;
  repeatCount: number;
  diamondCount: number;
}

export interface TikTokFollowEvent {
  user: TikTokUser;
}

export interface TikTokJoinEvent {
  user: TikTokUser;
  personality?: PersonalityType;
  customAvatar?: Partial<ResidentAvatar>;
}

export interface ITikTokProvider {
  connect(channelId?: string): Promise<boolean>;
  disconnect(): void;
  isConnected(): boolean;
  onComment(callback: (event: TikTokCommentEvent) => void): () => void;
  onGift(callback: (event: TikTokGiftEvent) => void): () => void;
  onFollow(callback: (event: TikTokFollowEvent) => void): () => void;
  onViewerJoin(callback: (event: TikTokJoinEvent) => void): () => void;
  onViewerLeave(callback: (user: TikTokUser) => void): () => void;
}

// Configurable Gift Rules
export const DEFAULT_GIFT_RULES: GiftDefinition[] = [
  {
    id: 'gift_rose',
    name: 'Rosa',
    icon: '🌹',
    tier: 'small',
    costCoins: 1,
    effectDescription: 'Energía +15 & Estabilidad +20',
    stabilityBoost: 20,
    energyBoost: 15,
    pointsBoost: 50,
    upgradesRoom: false,
    makesVip: false,
  },
  {
    id: 'gift_corgi',
    name: 'Corgi Feliz',
    icon: '🐶',
    tier: 'medium',
    costCoins: 10,
    effectDescription: 'Decoración +1 & Estabilidad +45',
    stabilityBoost: 45,
    energyBoost: 30,
    pointsBoost: 200,
    upgradesRoom: false,
    makesVip: false,
  },
  {
    id: 'gift_fireworks',
    name: 'Fuegos Artificiales',
    icon: '🚀',
    tier: 'large',
    costCoins: 100,
    effectDescription: '¡Mejora Habitación a nivel superior!',
    stabilityBoost: 80,
    energyBoost: 60,
    pointsBoost: 1000,
    upgradesRoom: true,
    makesVip: false,
  },
  {
    id: 'gift_crown',
    name: 'Corona Real',
    icon: '👑',
    tier: 'vip',
    costCoins: 500,
    effectDescription: '¡Acceso VIP Penthouse & Corona Dorada!',
    stabilityBoost: 100,
    energyBoost: 100,
    pointsBoost: 5000,
    upgradesRoom: true,
    makesVip: true,
  },
  {
    id: 'gift_leon',
    name: 'León Dorado',
    icon: '🦁',
    tier: 'vip',
    costCoins: 1000,
    effectDescription: '¡Evento Global FIESTA & VIP Máximo!',
    stabilityBoost: 100,
    energyBoost: 100,
    pointsBoost: 10000,
    upgradesRoom: true,
    makesVip: true,
    triggersEvent: 'FIESTA',
  },
];

// Realistic Spanish Live comments for the simulation engine
const SAMPLE_SPANISH_COMMENTS = [
  '¡Hola a todos! 👋',
  '¡Vaya hotelazo! Me encanta 😍',
  '¿Hay habitación libre arriba?',
  'Vecino baja la música jajaja 🎶',
  '¡Vamos a llenar el piso!',
  'JAJAJA qué divertido 🤣',
  'Quiero la habitación VIP 👑',
  '¡Miren a mi personaje bailar! 💃',
  'Toc toc vecino abreme 🚪',
  '¡Saludos desde México! 🇲🇽',
  '¿Quién es el de la 104? 💻',
  'A dormir un rato... zzz 😴',
  '¡Mandé una rosa! 🌹',
  '¡Qué buen stream! 🔥',
  '¡Fiesta en el pasillo! 🎉',
  'Ese vecino no me cae bien 😂',
  '¡Piso 2 ya por favor!',
  'Me quedo hasta que me echen 🏃',
];

const SAMPLE_USERNAMES = [
  'alex_gamer99',
  'sofia_vibes',
  'carlos_flow',
  'laura_star',
  'mateo_pro',
  'valen_tiktoker',
  'nacho_music',
  'dani_art',
  'clara_smile',
  'pablo_speed',
  'lucia_queen',
  'santi_chill',
  'elena_dancer',
  'javi_crazy',
  'marina_vip',
  'diego_live',
];

const PERSONALITIES: PersonalityType[] = [
  'tranquilo',
  'fiestero',
  'gamer',
  'deportista',
  'gracioso',
  'tímido',
  'artista',
  'trabajador',
  'elegante',
  'loco',
];

export class MockTikTokProvider implements ITikTokProvider {
  private connected: boolean = false;
  private commentListeners: Set<(event: TikTokCommentEvent) => void> = new Set();
  private giftListeners: Set<(event: TikTokGiftEvent) => void> = new Set();
  private followListeners: Set<(event: TikTokFollowEvent) => void> = new Set();
  private joinListeners: Set<(event: TikTokJoinEvent) => void> = new Set();
  private leaveListeners: Set<(user: TikTokUser) => void> = new Set();

  private autoSimulationInterval: any = null;
  private autoSimulationActive: boolean = false;

  async connect(channelId: string = 'TikTokHotel_Live'): Promise<boolean> {
    this.connected = true;
    return true;
  }

  disconnect(): void {
    this.connected = false;
    this.stopAutoSimulation();
  }

  isConnected(): boolean {
    return this.connected;
  }

  onComment(callback: (event: TikTokCommentEvent) => void): () => void {
    this.commentListeners.add(callback);
    return () => this.commentListeners.delete(callback);
  }

  onGift(callback: (event: TikTokGiftEvent) => void): () => void {
    this.giftListeners.add(callback);
    return () => this.giftListeners.delete(callback);
  }

  onFollow(callback: (event: TikTokFollowEvent) => void): () => void {
    this.followListeners.add(callback);
    return () => this.followListeners.delete(callback);
  }

  onViewerJoin(callback: (event: TikTokJoinEvent) => void): () => void {
    this.joinListeners.add(callback);
    return () => this.joinListeners.delete(callback);
  }

  onViewerLeave(callback: (user: TikTokUser) => void): () => void {
    this.leaveListeners.add(callback);
    return () => this.leaveListeners.delete(callback);
  }

  // --- Manual triggers for Simulation & Admin mode ---

  public simulateViewerJoin(customUsername?: string, customPersonality?: PersonalityType): void {
    const rawName = customUsername || SAMPLE_USERNAMES[Math.floor(Math.random() * SAMPLE_USERNAMES.length)] + Math.floor(Math.random() * 100);
    const username = rawName.startsWith('@') ? rawName.slice(1) : rawName;
    const personality = customPersonality || PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];

    const event: TikTokJoinEvent = {
      user: {
        uniqueId: username,
        nickname: username.charAt(0).toUpperCase() + username.slice(1),
      },
      personality,
    };

    this.joinListeners.forEach((cb) => cb(event));
    hotelEventBus.emit('USER_JOINED', event);
  }

  public simulateComment(username?: string, text?: string): void {
    const uname = username || (SAMPLE_USERNAMES[Math.floor(Math.random() * SAMPLE_USERNAMES.length)]);
    const commentText = text || SAMPLE_SPANISH_COMMENTS[Math.floor(Math.random() * SAMPLE_SPANISH_COMMENTS.length)];

    const event: TikTokCommentEvent = {
      user: {
        uniqueId: uname,
        nickname: uname,
      },
      comment: commentText,
      createTime: Date.now(),
    };

    this.commentListeners.forEach((cb) => cb(event));
    hotelEventBus.emit('COMMENT_RECEIVED', event);
  }

  public simulateGift(giftId: string, username?: string): void {
    const gift = DEFAULT_GIFT_RULES.find((g) => g.id === giftId) || DEFAULT_GIFT_RULES[0];
    const uname = username || SAMPLE_USERNAMES[Math.floor(Math.random() * SAMPLE_USERNAMES.length)];

    const event: TikTokGiftEvent = {
      user: {
        uniqueId: uname,
        nickname: uname,
      },
      giftId: gift.id,
      giftName: gift.name,
      repeatCount: 1,
      diamondCount: gift.costCoins,
    };

    this.giftListeners.forEach((cb) => cb(event));
    hotelEventBus.emit('GIFT_RECEIVED', { ...event, giftDefinition: gift });
  }

  public simulateFollow(username?: string): void {
    const uname = username || SAMPLE_USERNAMES[Math.floor(Math.random() * SAMPLE_USERNAMES.length)];
    const event: TikTokFollowEvent = {
      user: {
        uniqueId: uname,
        nickname: uname,
      },
    };

    this.followListeners.forEach((cb) => cb(event));
    hotelEventBus.emit('FOLLOW_RECEIVED', event);
  }

  // --- Auto-Simulation loop for live testing ---

  public startAutoSimulation(speed: 'slow' | 'medium' | 'fast' = 'medium'): void {
    if (this.autoSimulationActive) return;
    this.autoSimulationActive = true;

    const intervalMs = speed === 'fast' ? 1800 : speed === 'slow' ? 5000 : 3200;

    this.autoSimulationInterval = setInterval(() => {
      if (!this.autoSimulationActive) return;

      const dice = Math.random();
      if (dice < 0.25) {
        // New user joins
        this.simulateViewerJoin();
      } else if (dice < 0.70) {
        // Random chat comment
        this.simulateComment();
      } else if (dice < 0.90) {
        // Gift received!
        const randomGift = DEFAULT_GIFT_RULES[Math.floor(Math.random() * (DEFAULT_GIFT_RULES.length - 1))];
        this.simulateGift(randomGift.id);
      } else {
        // Follow or big gift
        if (Math.random() < 0.5) {
          this.simulateFollow();
        } else {
          this.simulateGift('gift_crown');
        }
      }
    }, intervalMs);
  }

  public stopAutoSimulation(): void {
    this.autoSimulationActive = false;
    if (this.autoSimulationInterval) {
      clearInterval(this.autoSimulationInterval);
      this.autoSimulationInterval = null;
    }
  }

  public isAutoSimulating(): boolean {
    return this.autoSimulationActive;
  }
}

export const mockTikTokProvider = new MockTikTokProvider();
