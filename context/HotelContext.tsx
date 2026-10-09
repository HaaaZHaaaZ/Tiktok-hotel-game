'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import {
  HotelState,
  Resident,
  Room,
  Floor,
  TimeOfDay,
  GlobalEventType,
  PersonalityType,
  ResidentAvatar,
  LiveNotification,
  CameraState,
  EntryRulesConfig,
  ReceptionAttendingState,
  QueueResident,
  WeatherType,
  SuperpowerId,
  PowerCast,
  SUPERPOWERS,
  STAY_REWARDS,
} from '../types/hotel';
import { createInitialHotel, createFloorRooms } from '../services/hotelService';
import { COMANDOS_PODER } from '../services/powerCommands';
import { generateRandomAvatar } from '../services/avatarGenerator';
import { audioEngine } from '../services/audioEngine';
import { mockTikTokProvider, DEFAULT_GIFT_RULES, TikTokCommentEvent, TikTokGiftEvent, TikTokJoinEvent } from '../services/tiktokProvider';
import { hotelBroadcast } from '../services/broadcastSync';
import { browserReport } from '../services/browserReport';

const triggerConfetti = (opts: any = {}) => {
  if (typeof window !== 'undefined') {
    import('canvas-confetti').then((mod) => {
      const c = mod.default || mod;
      if (typeof c === 'function') {
        c(opts);
      }
    }).catch(() => {});
  }
};

interface HotelContextValue {
  state: HotelState;
  // Simulation & Admin actions
  joinViewer: (username?: string, personality?: PersonalityType, avatar?: Partial<ResidentAvatar>) => void;
  sendComment: (username?: string, comment?: string) => void;
  sendGift: (giftId: string, username?: string) => void;
  triggerEvent: (eventType: GlobalEventType) => void;
  setTimeOfDay: (time: TimeOfDay) => void;
  advanceTime: () => void;
  createNextFloor: () => void;
  destroyUpperFloor: (floorNumber: number) => void;
  evictResident: (residentId: string) => void;
  /** Cierra el desalojo tras la animacion de caida (lo llama EvictionOverlay). */
  finalizeEviction: (residentId: string) => void;
  upgradeResidentRoom: (roomId: string) => void;
  promoteToVip: (residentId: string) => void;
  boostStability: (residentId: string, amount: number) => void;
  resetLiveSession: (mode: 'NEW_LIVE' | 'CONTINUE_LIVE') => void;
  toggleAutoSimulation: () => void;
  isAutoSimulating: boolean;
  activeFloorNumber: number;
  setActiveFloorNumber: (floor: number) => void;
  showSafeZoneGuides: boolean;
  setShowSafeZoneGuides: (show: boolean) => void;
  isAudioMuted: boolean;
  setIsAudioMuted: (muted: boolean) => void;
  isSpeechMuted: boolean;
  setIsSpeechMuted: (muted: boolean) => void;
  setCameraFocus: (target: CameraState['targetType'], floor?: number, roomNumber?: number, priority?: number) => void;
  resetCamera: () => void;
  updateEntryRules: (newRules: Partial<EntryRulesConfig>) => void;
  setWeather: (weather: WeatherType) => void;
  simulateUserShare: (username?: string) => void;
  simulateUserLikes: (username?: string, count?: number) => void;
  simulateUserFollow: (username?: string) => void;
  /** Cierra la animacion de un poder cuando termina. */
  finalizePowerCast: (castId: string) => void;
}

const HotelContext = createContext<HotelContextValue | null>(null);

const HOTEL_STORAGE_KEY = 'tiktok_hotel_active_state_v2';

/**
 * Cuanto dura una burbuja de comentario en pantalla (2-3s, pedido del usuario).
 * Fuente unica: la usan el `durationMs` de la burbuja y el barrido de respaldo.
 */
const BUBBLE_MS = 2800;

/**
 * Umbrales de expansion de la habitacion: +1 habitacion por cada 500 likes,
 * con tope de 4 (un piso entero).
 *
 *   500  likes -> 2 habitaciones
 *   1000 likes -> 3 habitaciones
 *   1500 likes -> 4 habitaciones (tope)
 *
 * Es progresivo a proposito: antes el poder de 500 absorvia las 3 contiguas de
 * golpe. Ahora crece de una en una, asi que la recompensa se nota escalonada.
 *
 * Si se quiere que llegue a 4 mas tarde, basta cambiar estos numeros (el tope de
 * 4 por piso lo aplica el propio algoritmo, no esta atado a estos valores).
 */
export const ROOM_EXPANSION_THRESHOLDS = [500, 1000, 1500] as const;

/** Habitaciones que corresponden a un total de likes (1 = tamano normal). */
export function habitacionesPorLikes(likes: number): number {
  const total = Math.max(0, Number(likes) || 0);
  let span = 1;
  for (const umbral of ROOM_EXPANSION_THRESHOLDS) {
    if (total >= umbral) span += 1;
  }
  // Tope duro: un piso entero. No puede haber mas de 4 habitaciones por piso,
  // ni fusionadas.
  return Math.min(4, span);
}

/**
 * Superpoderes que corresponden a un numero de likes.
 *
 * Uno cada 100 likes: a los 100 el primero, a los 200 el segundo, etc. Es
 * acumulativo y determinista (se recalcula desde el total de likes), asi que no
 * hace falta ir marcando hitos ni puede desincronizarse al restaurar estado.
 */
function superpowersParaLikes(
  likes: number,
  reglas?: { superpowersEnabled?: boolean }
): SuperpowerId[] {
  if (reglas && reglas.superpowersEnabled === false) return [];
  const total = Math.max(0, Number(likes) || 0);
  return SUPERPOWERS.filter((p) => total >= p.likesRequired).map((p) => p.id);
}

/**
 * Sanea un estado restaurado de localStorage.
 *
 * El estado persistido es de una version ANTERIOR de la app en cuanto se anade
 * un campo, asi que puede traer residentes incompletos. Un solo residente con
 * `username` undefined tumbaba la pagina ENTERA con
 * "Cannot read properties of undefined (reading 'toLowerCase')" — el error que
 * veian movil y tablet, que tenian estado viejo guardado, mientras que en un
 * navegador limpio no aparecia nunca.
 *
 * Es el mismo fallo que ya se parcheo para `avatar` en CharacterRenderer: se
 * arregla el sintoma en el render en vez de la causa. Aqui se normaliza al
 * CARGAR, que es donde esta la causa: asi cualquier campo que se anada en el
 * futuro no puede reventar el arranque por venir ausente.
 */
function sanitizeRestoredState(parsed: any): any {
  const AVATAR_DEFECTO = {
    skinColor: '#F5CBA7',
    hairStyle: 'sleek',
    hairColor: '#2C1810',
    outfitStyle: 'casual',
    outfitColor: '#3498DB',
    accessory: 'none',
    eyeType: 'normal',
  };

  const residentsEntrada = parsed?.residents && typeof parsed.residents === 'object'
    ? parsed.residents
    : {};

  const residents: Record<string, any> = {};
  for (const [id, raw] of Object.entries<any>(residentsEntrada)) {
    if (!raw || typeof raw !== 'object') continue;

    // username es la clave de identidad y lo primero que se lee con
    // .toLowerCase(): sin el, el residente es inservible. Se reconstruye desde
    // displayName y, si tampoco hay, se descarta.
    let username = typeof raw.username === 'string' ? raw.username.trim() : '';
    if (!username && typeof raw.displayName === 'string') {
      username = raw.displayName.replace(/^@/, '').trim();
    }
    if (!username) continue;

    const displayName =
      typeof raw.displayName === 'string' && raw.displayName.trim()
        ? raw.displayName
        : `@${username}`;

    residents[id] = {
      ...raw,
      id,
      username,
      displayName,
      // Campos anadidos despues: sin estos, el contador y la animacion de
      // desalojo leen undefined.
      likes: Number.isFinite(Number(raw.likes)) ? Number(raw.likes) : 0,
      evicting: raw.evicting ?? null,
      superpowers: Array.isArray(raw.superpowers) ? raw.superpowers : [],
      stayRemainingSec: Number.isFinite(Number(raw.stayRemainingSec))
        ? Number(raw.stayRemainingSec)
        : null,
      stayTotalSec: Number.isFinite(Number(raw.stayTotalSec)) ? Number(raw.stayTotalSec) : 0,
      expandedRoomIds: Array.isArray(raw.expandedRoomIds) ? raw.expandedRoomIds : [],
      roomSpan: Number.isFinite(Number(raw.roomSpan)) && Number(raw.roomSpan) > 0
        ? Number(raw.roomSpan)
        : 1,
      energy: Number.isFinite(Number(raw.energy)) ? Number(raw.energy) : 80,
      stability: Number.isFinite(Number(raw.stability)) ? Number(raw.stability) : 100,
      vipLevel: Number.isFinite(Number(raw.vipLevel)) ? Number(raw.vipLevel) : 0,
      coordX: Number.isFinite(Number(raw.coordX)) ? Number(raw.coordX) : 50,
      direction: raw.direction === 'left' ? 'left' : 'right',
      currentAction: raw.currentAction || 'idle',
      location: raw.location || 'room',
      // Un residente sin avatar reventaba el render de su personaje.
      avatar: { ...AVATAR_DEFECTO, ...(raw.avatar && typeof raw.avatar === 'object' ? raw.avatar : {}) },
      // Una burbuja de dialogo NO debe sobrevivir a una recarga.
      //
      // Se persiste en localStorage, pero el setTimeout que la borra vive en
      // memoria: al recargar, la burbuja se quedaba pegada al personaje PARA
      // SIEMPRE (nadie la limpiaba). Es el sintoma de "las burbujas no se
      // quitan". Aqui se descarta si ya paso su duracion, y si no, se conserva
      // solo si le queda vida util.
      speechBubble: (() => {
        const b = raw.speechBubble;
        if (!b || typeof b !== 'object' || typeof b.text !== 'string') return null;
        const inicio = Number(b.timestamp) || 0;
        const dur = Number(b.durationMs) || 3000;
        if (!inicio || Date.now() - inicio >= dur) return null;
        return b;
      })(),
    };
  }

  const entryQueue = Array.isArray(parsed?.entryQueue)
    ? parsed.entryQueue.filter(
        (q: any) =>
          q && typeof q === 'object' && typeof q.username === 'string' && q.username.trim()
      )
    : [];

  // Cualquier ocupante que apunte a un residente descartado deja la habitacion
  // libre: si no, queda marcada OCUPADA para siempre sin nadie dentro.
  const rooms: Record<string, any> = {};
  for (const [id, raw] of Object.entries<any>(
    parsed?.rooms && typeof parsed.rooms === 'object' ? parsed.rooms : {}
  )) {
    if (!raw || typeof raw !== 'object') continue;
    const ocupanteValido =
      raw.occupantId && Object.prototype.hasOwnProperty.call(residents, raw.occupantId);
    rooms[id] = {
      ...raw,
      id,
      occupantId: ocupanteValido ? raw.occupantId : null,
      status: ocupanteValido ? raw.status || 'OCUPADA' : 'VACIA',
    };
  }

  // Recortar una cola heredada que se haya quedado desbordada.
  //
  // Antes de existir el tope, la fila crecia sin limite (se vieron 130+
  // personas esperando con 60 espectadores). Un estado guardado asi seguiria
  // mostrando la fila enorme aunque el codigo nuevo ya no la deje crecer: hay
  // que podarla al cargar. Se conservan los primeros, que son los que Don Pepe
  // va a atender antes.
  const totalRoomsGuardadas = Object.keys(rooms).length || 4;
  const libresGuardadas = Object.values(rooms).filter((r: any) => !r.occupantId).length;
  const topeCola = Math.max(8, Math.min(totalRoomsGuardadas * 2, libresGuardadas + totalRoomsGuardadas));

  // Las habitaciones de cada piso: `floor.rooms` lo recorre FloorRenderer con
  // .map() sin proteccion. Un piso restaurado sin `rooms` (o con un valor que no
  // sea array) tumbaba la app entera con "Cannot read properties of undefined
  // (reading 'map')". Se normaliza y se descartan los pisos inservibles.
  const floors = (Array.isArray(parsed?.floors) ? parsed.floors : [])
    .filter((f: any) => f && typeof f === 'object')
    .map((f: any) => ({
      ...f,
      rooms: Array.isArray(f.rooms)
        ? f.rooms.filter((id: any) => typeof id === 'string' && rooms[id])
        : [],
      name: typeof f.name === 'string' && f.name ? f.name : `Piso ${f.floorNumber ?? 1}`,
      floorNumber: Number.isFinite(Number(f.floorNumber)) ? Number(f.floorNumber) : 1,
      status: f.status || 'active',
      isDestroyable: !!f.isDestroyable,
    }))
    // Un piso sin habitaciones validas no se puede dibujar: se descarta.
    .filter((f: any) => f.rooms.length > 0);

  return {
    ...parsed,
    floors,
    residents,
    rooms,
    entryQueue: entryQueue.slice(0, topeCola),
    // `globalEvent` lo lee el render como `globalEvent.type` sin proteccion: si
    // falta (estado viejo o manipulado), la app entera revienta con
    // "Cannot read properties of undefined (reading 'type')". Se normaliza.
    globalEvent:
      parsed?.globalEvent && typeof parsed.globalEvent === 'object'
        ? {
            type: parsed.globalEvent.type || 'NONE',
            title: parsed.globalEvent.title || '',
            message: parsed.globalEvent.message || '',
            durationMs: Number(parsed.globalEvent.durationMs) || 0,
            startedAt: Number(parsed.globalEvent.startedAt) || 0,
          }
        : { type: 'NONE', title: '', message: '', durationMs: 0, startedAt: 0 },
    // `camera` tambien se lee sin proteccion en el render.
    camera:
      parsed?.camera && typeof parsed.camera === 'object'
        ? parsed.camera
        : { targetType: 'GENERAL', targetFloor: 1, zoom: 1.0, priority: 5, lockUntil: 0 },
    // `demolitionState` lo consume FloorRenderer con campos anidados.
    demolitionState:
      parsed?.demolitionState && typeof parsed.demolitionState === 'object'
        ? parsed.demolitionState
        : { isDemolishing: false, demolishingFloorNumber: null, phase: 'none', affectedUpperFloors: [] },
    stats:
      parsed?.stats && typeof parsed.stats === 'object'
        ? parsed.stats
        : { totalResidentsJoined: 0, totalGiftsReceived: 0, totalComments: 0, peakResidents: 0 },
    notifications: Array.isArray(parsed?.notifications) ? parsed.notifications : [],
    // Los poderes en vuelo son efimeros: nunca se restauran (una animacion a
    // medias de la sesion anterior no tiene sentido).
    powerCasts: [],
  };
}

export const HotelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<HotelState>(() => {
    const initial = createInitialHotel();
    return {
      floors: initial.floors,
      rooms: initial.rooms,
      residents: {},
      entryQueue: [],
      receptionAttending: null,
      demolitionState: {
        isDemolishing: false,
        demolishingFloorNumber: null,
        phase: 'none',
        affectedUpperFloors: [],
      },
      vipPenthouseResidents: [],
      timeOfDay: 'day',
      weather: 'SOL',
      timeHour: 12,
      globalEvent: {
        type: 'NONE',
        title: '',
        message: '',
        durationMs: 0,
        startedAt: 0,
      },
      camera: {
        targetType: 'GENERAL',
        targetFloor: 1,
        zoom: 1.0,
        priority: 5,
        lockUntil: 0,
      },
      activeFloorView: 1,
      liveActive: true,
      entryRules: {
        entryMode: 'ANY_COMMENT',
        keyword: '!entrar',
        likesRequired: 20,
        sharesRequired: 1,
        requireFollow: false,
        minGiftCoins: 1,
        autoApprove: true,
        welcomeMessage: '¡Bienvenido al hotel! Tu habitación te espera.',
        residentStaySeconds: 0,
                superpowersEnabled: true, // 0 = Permanente (no desaparecen)
      },
      stats: {
        totalResidentsJoined: 0,
        totalGiftsReceived: 0,
        totalComments: 0,
        peakResidents: 0,
      },
      notifications: [],
      powerCasts: [],
    };
  });

  const stateRef = useRef(state);
  const isHydratedRef = useRef(false);
  const lastProgressTimestampRef = useRef<number>(0);
  /**
   * Mensajes escritos por alguien que aun no es residente, indexados por
   * usuario en minusculas. Se muestran en cuanto el personaje aparece: sin
   * esto, escribir antes de entrar perdia el mensaje.
   */
  const pendingMessagesRef = useRef<Record<string, string>>({});

  // Client-side mount: restore persistent hotel state from localStorage after hydration asynchronously
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = localStorage.getItem(HOTEL_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && Array.isArray(parsed.floors) && parsed.floors.length > 0 && parsed.rooms) {
            // Saneado: un estado guardado por una version anterior puede traer
            // residentes incompletos que tumban la pagina al entrar alguien.
            const limpio = sanitizeRestoredState(parsed);
            const restored = {
              ...limpio,
              weather: limpio.weather || 'SOL',
              receptionAttending: null,
              demolitionState: {
                isDemolishing: false,
                demolishingFloorNumber: null,
                phase: 'none',
                affectedUpperFloors: [],
              },
              entryRules: {
                entryMode: 'ANY_COMMENT',
                keyword: '!entrar',
                likesRequired: 20,
                sharesRequired: 1,
                requireFollow: false,
                minGiftCoins: 1,
                autoApprove: true,
                welcomeMessage: '¡Bienvenido al hotel! Tu habitación te espera.',
                residentStaySeconds: 0,
                superpowersEnabled: true,
                ...limpio.entryRules,
              },
            };
            setState(restored);
          }
        }
      } catch {
        // ignore
      } finally {
        isHydratedRef.current = true;
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  // Persistent storage auto-save (ONLY AFTER HYDRATION HAS COMPLETED)
  useEffect(() => {
    if (!isHydratedRef.current) return;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(HOTEL_STORAGE_KEY, JSON.stringify(state));
      } catch {
        // ignore
      }
    }
  }, [state]);

  // Sync across tabs via storage event
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === HOTEL_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && Array.isArray(parsed.floors)) {
            setState((prev) => ({
              ...sanitizeRestoredState(parsed),
              receptionAttending: prev.receptionAttending, // keep local animation smooth
              camera: prev.camera,
            }));
          }
        } catch {
          // ignore
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }
  }, []);

  const [isAutoSimulating, setIsAutoSimulating] = useState(false);
  const [showSafeZoneGuides, setShowSafeZoneGuides] = useState(false);
  const [isAudioMuted, setIsAudioMutedState] = useState(false);
  const [isSpeechMuted, setIsSpeechMutedState] = useState(false);

  // Active Floor view for multi-floor hotels
  const [activeFloorNumber, setActiveFloorNumber] = useState(1);

  // Keep latest state synced for intervals and async loops
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const isProcessingEntryRef = useRef(false);

  // Audio toggles
  const setIsAudioMuted = (muted: boolean) => {
    setIsAudioMutedState(muted);
    audioEngine.setMuted(muted);
  };

  const setIsSpeechMuted = (muted: boolean) => {
    setIsSpeechMutedState(muted);
    audioEngine.setSpeechMuted(muted);
  };

  // Helper to add notification
  const addNotification = useCallback((notif: Omit<LiveNotification, 'id' | 'timestamp'>) => {
    setState((prev) => {
      const newNotif: LiveNotification = {
        ...notif,
        id: `notif_${Date.now()}_${Math.random()}`,
        timestamp: Date.now(),
      };
      return {
        ...prev,
        notifications: [newNotif, ...prev.notifications.slice(0, 4)],
      };
    });
  }, []);

  // Camera Focus
  const setCameraFocus = useCallback((
    targetType: CameraState['targetType'],
    floor = 1,
    roomNumber?: number,
    priority = 3,
    durationMs = 3500
  ) => {
    const now = Date.now();
    setState((prev) => {
      if (prev.camera.priority < priority && prev.camera.lockUntil > now) {
        return prev; // Current camera has higher priority locked
      }

      return {
        ...prev,
        camera: {
          targetType,
          targetFloor: floor,
          targetRoomNumber: roomNumber,
          zoom: targetType === 'GENERAL' ? 1.0 : 1.25,
          priority,
          lockUntil: now + durationMs,
        },
      };
    });
  }, []);

  const resetCamera = useCallback(() => {
    setState((prev) => ({
      ...prev,
      camera: {
        targetType: 'GENERAL',
        targetFloor: activeFloorNumber,
        zoom: 1.0,
        priority: 5,
        lockUntil: 0,
      },
    }));
  }, [activeFloorNumber]);

  /**
   * Watchdog de camara: suelta el zoom cuando el bloqueo expira.
   *
   * `lockUntil` se escribia pero NADIE lo leia para liberar la camara: el unico
   * reset vivia al final de processNextEntry. Si algo cortaba el flujo a mitad
   * (una excepcion, el anti-stall, o simplemente que el tour se quedara sin
   * siguiente paso) la camara se quedaba clavada en ese encuadre para siempre.
   *
   * Aqui se comprueba periodicamente: si el lock expiro y no hay ninguna
   * entrada en curso, se vuelve a la vista general. Nunca se pisa una camara
   * que aun esta en uso.
   */
  useEffect(() => {
    const camWatchdog = setInterval(() => {
      const s = stateRef.current;
      const cam = s.camera;
      if (cam.targetType === 'GENERAL') return;
      if (cam.lockUntil > Date.now()) return;      // aun dentro del tiempo
      if (isProcessingEntryRef.current) return;   // hay una animacion en curso

      setState((prev) => {
        if (prev.camera.targetType === 'GENERAL') return prev;
        if (prev.camera.lockUntil > Date.now()) return prev;
        return {
          ...prev,
          camera: {
            targetType: 'GENERAL',
            targetFloor: prev.activeFloorView || 1,
            zoom: 1.0,
            priority: 5,
            lockUntil: 0,
          },
        };
      });
    }, 700);

    return () => clearInterval(camWatchdog);
  }, []);

  /**
   * Recorre el hotel piso por piso con zoom in suave: desde el piso 1 hasta la
   * cima, mostrando las 4 habitaciones de cada piso a la vez, y termina
   * mostrando el edificio completo a la espera del siguiente evento.
   *
   * Se interrumpe si el nucleo del hotel crea/derriba pisos mientras dura
   * (compara `floors.length` antes y despues de cada pausa).
   */
  const runFloorTour = useCallback(
    async (speed = 1.0, pisoDestino?: number) => {
      const total = stateRef.current.floors.length;
      const stepMs = Math.round(1500 * speed);
      const dwellMs = Math.round(1400 * speed);

      // El tour NO recorre todo el edificio cuando ya es alto.
      //
      // Antes subia por TODOS los pisos: con 7 pisos y speed 0.35 son ~20s por
      // ingreso, mientras la cola sumaba ~5 personas en ese tiempo. El tour se
      // volvia el cuello de botella y Don Pepe nunca alcanzaba la fila.
      //
      // Ahora, si hay muchos pisos, se muestran solo los ultimos (donde esta
      // pasando la accion) mas el del residente nuevo. Se conserva el recorrido
      // completo cuando el edificio es pequeno, que es cuando luce.
      const MAX_PISOS_TOUR = 4;
      let pisos: number[];
      if (total <= MAX_PISOS_TOUR) {
        pisos = Array.from({ length: total }, (_, i) => i + 1);
      } else {
        // Los ultimos MAX_PISOS_TOUR-1 pisos + el destino del residente.
        const ultimos = Array.from(
          { length: MAX_PISOS_TOUR - 1 },
          (_, i) => total - (MAX_PISOS_TOUR - 2) + i
        ).filter((p) => p >= 1 && p <= total);
        pisos = Array.from(new Set([...(pisoDestino ? [pisoDestino] : []), ...ultimos])).sort(
          (a, b) => a - b
        );
      }

      for (const floor of pisos) {
        // El watchdog anti-stall reinicia el ingreso si pasan 9s sin progreso.
        // El tour puede durarlo, asi que hay que refrescar la marca en cada
        // piso o el watchdog abortaria la entrada a mitad del recorrido.
        lastProgressTimestampRef.current = Date.now();
        setCameraFocus('TOUR', floor, undefined, 3, stepMs);
        await new Promise((r) => setTimeout(r, dwellMs));
      }

      lastProgressTimestampRef.current = Date.now();
      // La cima del edificio (penthouse) antes de cerrar.
      setCameraFocus('PENTHOUSE', total, undefined, 2, stepMs);
      await new Promise((r) => setTimeout(r, dwellMs));

      lastProgressTimestampRef.current = Date.now();
      // Cierre: edificio completo y quieto, esperando donation o nuevo ingreso.
      resetCamera();
    },
    [setCameraFocus, resetCamera]
  );

  // Global Event Triggers (Declared early so sendGift and others can access it)
  const triggerEvent = useCallback((eventType: GlobalEventType) => {
    if (eventType === 'NONE') {
      if ((stateRef.current.globalEvent?.type || 'NONE') === 'FIESTA') {
        audioEngine.stopPartyMusic();
      }
      setState((prev) => ({
        ...prev,
        globalEvent: {
          type: 'NONE',
          title: '',
          message: '',
          durationMs: 0,
          startedAt: 0,
        },
      }));
      return;
    }

    let title = '';
    let message = '';
    let durationMs = 12000;

    switch (eventType) {
      case 'FIESTA':
        title = '¡GRAN FIESTA EN EL HOTEL!';
        message = '¡Todos los residentes a bailar en el lobby!';
        durationMs = 15000;
        audioEngine.startPartyMusic();
        audioEngine.speakAnnouncement('¡Atención residentes! ¡El hotel está de fiesta!');
        triggerConfetti({ particleCount: 100, spread: 90 });
        break;
      case 'APAGON':
        title = '¡APAGÓN EN EL HOTEL!';
        message = '¡Se fue la luz! Encendiendo linternas de emergencia...';
        durationMs = 9000;
        audioEngine.playPowerDown();
        audioEngine.speakAnnouncement('¡Alerta! Se ha producido un apagón en el edificio.');
        break;
      case 'INCENDIO':
        title = '¡SIMULACRO DE INCENDIO!';
        message = '¡Alarma activada! Los residentes evacúan con cubetas.';
        durationMs = 10000;
        audioEngine.playAlarm();
        audioEngine.speakAnnouncement('¡Atención! Simulacro de emergencia activado. Mantengan la calma.');
        break;
      case 'RATAS':
        title = '¡INVASIÓN DE RATAS CHIBI!';
        message = '¡Ratones traviesos por los pasillos! ¡Súbanse a las camas!';
        durationMs = 11000;
        audioEngine.playDoorKnock();
        audioEngine.speakAnnouncement('¡Cuidado! ¡Tenemos visitas inesperadas en los pasillos!');
        break;
      case 'TORMENTA':
        title = '¡TORMENTA ELÉCTRICA!';
        message = 'Relámpagos y truenos azotando las ventanas del hotel.';
        durationMs = 14000;
        audioEngine.playThunder();
        break;
      case 'FUEGOS':
        title = '¡FUEGOS ARTIFICIALES!';
        message = 'Luces brillantes iluminando el cielo del TikTok Hotel.';
        durationMs = 12000;
        audioEngine.playBigGiftFanfare();
        triggerConfetti({ particleCount: 120, spread: 100 });
        break;
      case 'OVNI':
        title = '¡AVISTAMIENTO EXTRATERRESTRE!';
        message = 'Un platillo volador sobrevuela el VIP Penthouse.';
        durationMs = 10000;
        audioEngine.playElevatorChime();
        break;
    }

    setState((prev) => ({
      ...prev,
      globalEvent: {
        type: eventType,
        title,
        message,
        durationMs,
        startedAt: Date.now(),
      },
    }));

    addNotification({
      type: 'event',
      icon: eventType === 'FIESTA' ? '🎉' : eventType === 'APAGON' ? '⚡' : eventType === 'INCENDIO' ? '🔥' : '🐀',
      text: title,
    });

    // Auto-clear event after duration
    setTimeout(() => {
      setState((prev) => {
        if ((prev.globalEvent?.type || 'NONE') === eventType) {
          if (eventType === 'FIESTA') {
            audioEngine.stopPartyMusic();
          }
          return {
            ...prev,
            globalEvent: {
              type: 'NONE',
              title: '',
              message: '',
              durationMs: 0,
              startedAt: 0,
            },
          };
        }
        return prev;
      });
    }, durationMs);
  }, [addNotification]);

  // Create Floor Internal (Synchronously updates stateRef and state so queue never pauses)
  const createNextFloorInternal = useCallback((): Room | null => {
    const s = stateRef.current;
    const currentHighest = Math.max(...s.floors.map((f) => f.floorNumber));
    const newFloorNum = currentHighest + 1;
    if (newFloorNum > 10) return null; // Initial max 10 floors

    const { rooms: newRooms, roomIds } = createFloorRooms(newFloorNum);
    const newFloor: Floor = {
      id: `floor_${newFloorNum}`,
      floorNumber: newFloorNum,
      name: `Piso ${newFloorNum}`,
      rooms: roomIds,
      status: 'active',
      isDestroyable: true,
    };

    setState((prev) => ({
      ...prev,
      floors: [...prev.floors, newFloor],
      rooms: {
        ...prev.rooms,
        ...newRooms,
      },
    }));

    // Play ceremony
    audioEngine.playUpgrade();
    audioEngine.speakAnnouncement(
      `¡Atención residentes! El piso ${newFloorNum - 1} está completo. ¡Un nuevo piso acaba de abrir!`,
      true
    );

    triggerConfetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.4 },
    });

    addNotification({
      type: 'event',
      icon: '🏢',
      text: `¡Nuevo piso ${newFloorNum} abierto en el hotel!`,
    });

    return newRooms[roomIds[0]] || null;
  }, [addNotification]);

  // Check if floor is full -> proactively build next floor so the queue never freezes
  const checkFloorFullStatus = useCallback((floorNum: number) => {
    const s = stateRef.current;
    const floorRooms = Object.values(s.rooms).filter((r) => r.floorNumber === floorNum);
    const occupiedCount = floorRooms.filter((r) => r.status === 'OCUPADA' || r.status === 'RESERVADA').length;

    // 4 rooms per floor! Immediately create next floor so subsequent entries never stall
    if (occupiedCount >= 4) {
      const nextFloorNum = floorNum + 1;
      const nextFloorExists = s.floors.some((f) => f.floorNumber === nextFloorNum);
      if (!nextFloorExists && nextFloorNum <= 10) {
        createNextFloorInternal();
      }
    }
  }, [createNextFloorInternal]);

  // Find next available room
  const findAvailableRoom = useCallback((targetFloor?: number): Room | null => {
    const s = stateRef.current;
    // Prefer targetFloor if specified and not full
    if (targetFloor) {
      const floorRooms = Object.values(s.rooms).filter(
        (r) => r.floorNumber === targetFloor && r.status === 'VACIA' && !r.occupantId
      );
      if (floorRooms.length > 0) return floorRooms[0];
    }

    // Otherwise check all floors in order
    for (const floor of s.floors) {
      const floorRooms = Object.values(s.rooms).filter(
        (r) => r.floorNumber === floor.floorNumber && r.status === 'VACIA' && !r.occupantId
      );
      if (floorRooms.length > 0) return floorRooms[0];
    }
    return null;
  }, []);

  // Process Entry Queue (One user entrance at a time with smooth cinematics)
  const processNextEntry = useCallback(async () => {
    if (isProcessingEntryRef.current) return;
    const s = stateRef.current;
    if (s.entryQueue.length === 0) return;

    isProcessingEntryRef.current = true;
    try {
      const nextUser = s.entryQueue[0];

      // Find available room (or create next floor instantly with 0ms pause)
      let targetRoom = findAvailableRoom();

      // If all rooms are full, create the next floor synchronously
      if (!targetRoom) {
        targetRoom = createNextFloorInternal();
      }

    if (!targetRoom) {
      // Hotel is completely full!
      addNotification({
        type: 'alert',
        icon: '🏨',
        text: `Hotel completo. ¡${nextUser.username} en lista de espera!`,
      });
      // Remove from queue
      setState((prev) => ({
        ...prev,
        entryQueue: prev.entryQueue.slice(1),
      }));
      isProcessingEntryRef.current = false;
      return;
    }

    const assignedRoomId = targetRoom.id;
    const assignedFloor = targetRoom.floorNumber;
    const residentId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const avatar = nextUser.avatar || generateRandomAvatar(nextUser.personality || 'gamer');
    const personality = nextUser.personality || 'gamer';
    const displayName = nextUser.displayName || (nextUser.username.startsWith('@') ? nextUser.username : `@${nextUser.username}`);

    // PASO 1: Atención en Recepción con Don Pepe (Check-in & entrega de llaves)
    setCameraFocus('RECEPTION', 0, undefined, 3, 4000);
    audioEngine.playElevatorChime();
    audioEngine.speakAnnouncement(`¡Bienvenido ${nextUser.username}! Don Pepe te asigna la habitación ${targetRoom.number}`);

    addNotification({
      type: 'join',
      icon: '🛎️',
      text: `Don Pepe atendió a ${displayName} en recepción (Hab. ${targetRoom.number})`,
    });

    // Crear residente en recepción y reservar habitación
    //
    // Si el usuario escribio en el chat ANTES de entrar, su mensaje quedo
    // guardado a la espera. Se le coloca aqui para que vea su propio texto
    // sobre la cabeza nada mas aparecer en pantalla.
    const pendingMsg = pendingMessagesRef.current[
      nextUser.username.replace('@', '').toLowerCase()
    ];

    // Tiempo de estadía inicial. Con `residentStaySeconds = 0` el hotel es
    // permanente y `stayRemainingSec` queda en null (no hay reloj).
    const stayTotal = Number(s.entryRules?.residentStaySeconds) || 0;

    const newResident: Resident = {
      id: residentId,
      username: nextUser.username,
      displayName,
      avatar,
      personality,
      roomId: assignedRoomId,
      floorNumber: assignedFloor,
      energy: 95,
      stability: 100,
      popularity: 100,
      points: 50,
      vipLevel: 0,
      currentAction: 'visiting_reception',
      location: 'reception',
      coordX: 50,
      direction: 'right',
      isEntering: true,
      likes: 0,
      superpowers: [],
      stayRemainingSec: stayTotal > 0 ? stayTotal : null,
      stayTotalSec: stayTotal > 0 ? stayTotal : 0,
      expandedRoomIds: [],
      roomSpan: 1,
      evicting: null,
      speechBubble: pendingMsg
        ? {
            id: `bubble_pending_${residentId}`,
            text: pendingMsg,
            timestamp: Date.now(),
            durationMs: BUBBLE_MS,
          }
        : null,
    };

    if (pendingMsg) {
      delete pendingMessagesRef.current[
        nextUser.username.replace('@', '').toLowerCase()
      ];
    }

    setState((prev) => {
      const updatedRooms = { ...prev.rooms };
      updatedRooms[assignedRoomId] = {
        ...updatedRooms[assignedRoomId],
        status: 'RESERVADA',
        occupantId: residentId,
      };

      return {
        ...prev,
        entryQueue: prev.entryQueue.slice(1),
        receptionAttending: {
          residentId,
          username: nextUser.username,
          displayName,
          assignedRoomNumber: targetRoom.number,
          assignedFloor,
          step: 'at_desk',
          dialogueText: `¡Bienvenido ${displayName}! Habitación ${targetRoom.number} 🔑`,
          avatar,
          personality,
        },
        residents: {
          ...prev.residents,
          [residentId]: newResident,
        },
        rooms: updatedRooms,
        stats: {
          ...prev.stats,
          totalResidentsJoined: prev.stats.totalResidentsJoined + 1,
          peakResidents: Math.max(prev.stats.peakResidents, Object.keys(prev.residents).length + 1),
        },
      };
    });

    const queueLength = s.entryQueue.length;
    // Dynamic cinematic pace: faster if viewers are waiting in queue so nobody is kept waiting
    const speed = queueLength > 4 ? 0.35 : queueLength > 1 ? 0.6 : 1.0;

    lastProgressTimestampRef.current = Date.now();
    // Esperar en mostrador mientras Don Pepe entrega llaves
    await new Promise((r) => setTimeout(r, Math.round(1400 * speed)));

    // PASO 2: El usuario camina al ascensor de Planta Baja
    lastProgressTimestampRef.current = Date.now();
    audioEngine.playFootstep();
    setState((prev) => ({
      ...prev,
      receptionAttending: prev.receptionAttending
        ? { ...prev.receptionAttending, step: 'walking_to_elevator' }
        : null,
      residents: {
        ...prev.residents,
        [residentId]: {
          ...prev.residents[residentId],
          coordX: 72,
          currentAction: 'walking',
        },
      },
    }));

    await new Promise((r) => setTimeout(r, Math.round(900 * speed)));

    // PASO 3: Entra al ascensor de Planta Baja y se cierran las puertas
    lastProgressTimestampRef.current = Date.now();
    setState((prev) => ({
      ...prev,
      receptionAttending: prev.receptionAttending
        ? { ...prev.receptionAttending, step: 'in_elevator' }
        : null,
      residents: {
        ...prev.residents,
        [residentId]: {
          ...prev.residents[residentId],
          location: 'elevator',
          currentAction: 'entering_hotel',
          // Se fija el piso destino aqui tambien, no solo en el PASO 5.
          //
          // BUG: FloorRenderer mete en el pasillo a todo residente con
          // isEntering=true que coincida en floorNumber. Como aqui el piso
          // seguia siendo 0 (planta baja), el personaje se dibujaba en el
          // pasillo de abajo y se quedaba ahi atascado: si el PASO 5 no
          // llegaba a ejecutarse, nunca se movia de sitio.
          floorNumber: assignedFloor,
        },
      },
    }));

    await new Promise((r) => setTimeout(r, Math.round(700 * speed)));

    // PASO 4: El ascensor sube al piso asignado; Don Pepe queda libre para el siguiente en fila
    lastProgressTimestampRef.current = Date.now();
    setState((prev) => ({
      ...prev,
      receptionAttending: null,
    }));

    // Zoom OUT a la vista completa del hotel al entrar al ascensor: el espectador
    // ve el edificio entero justo cuando el personaje deja de estar en planta baja.
    resetCamera();
    audioEngine.playElevatorChime();

    await new Promise((r) => setTimeout(r, Math.round(800 * speed)));

    // PASO 5: Sale del ascensor y entra directamente en su habitacion.
    // Antes pasaba por 'corridor' (PASO 5) y luego 'room' (PASO 6), lo que dejaba
    // a los residentes atascados en el pasillo cuando el piso no coincidia con el
    // que dibujaba FloorRenderer. Ahora va directo del ascensor a la habitacion,
    // que es adonde va el personaje de todas formas.
    lastProgressTimestampRef.current = Date.now();
    setState((prev) => {
      const r = prev.residents[residentId];
      if (!r) return prev;
      return {
        ...prev,
        residents: {
          ...prev.residents,
          [residentId]: {
            ...r,
            // floorNumber debe ser el destino: si no, el renderer lo dibuja en
            // el piso equivocado y parece congelado en el pasillo.
            floorNumber: assignedFloor,
            location: 'room',
            coordX: 50,
            currentAction: 'celebrating',
            isEntering: false,
          },
        },
      };
    });

    audioEngine.playFootstep();
    setCameraFocus('ROOM', assignedFloor, targetRoom.number, 3, Math.round(2400 * speed));

    await new Promise((r) => setTimeout(r, Math.round(900 * speed)));

    // PASO 6: El residente ingresa a su habitación y celebra
    lastProgressTimestampRef.current = Date.now();
    setState((prev) => {
      const r = prev.residents[residentId];
      const updatedRooms = { ...prev.rooms };
      if (updatedRooms[assignedRoomId]) {
        updatedRooms[assignedRoomId] = {
          ...updatedRooms[assignedRoomId],
          status: 'OCUPADA',
        };
      }
      if (!r) return { ...prev, rooms: updatedRooms };

      return {
        ...prev,
        rooms: updatedRooms,
        residents: {
          ...prev.residents,
          [residentId]: {
            ...r,
            location: 'room',
            coordX: 50,
            currentAction: 'celebrating',
            isEntering: false,
          },
        },
      };
    });

    checkFloorFullStatus(assignedFloor);
    await new Promise((r) => setTimeout(r, Math.round(800 * speed)));

    // PASO 7: Zoom out a la vista completa del hotel
    resetCamera();
    await new Promise((r) => setTimeout(r, Math.round(1200 * speed)));

    // PASO 8: Tour panoramico. Zoom in suave piso por piso desde el 1 hasta la
    // cima, mostrando las 4 habitaciones de cada piso, y termina con el
    // edificio completo esperando al siguiente evento.
    await runFloorTour(speed, assignedFloor);
    } catch {
      // safely handle any unexpected exception
    } finally {
      isProcessingEntryRef.current = false;
    }
  }, [findAvailableRoom, createNextFloorInternal, setCameraFocus, addNotification, checkFloorFullStatus, resetCamera]);

  // Queue watcher & safe anti-stall watchdog
  useEffect(() => {
    if (state.entryQueue.length > 0 && !isProcessingEntryRef.current) {
      processNextEntry();
    }

    const watchdog = setInterval(() => {
      const stalled = Date.now() - lastProgressTimestampRef.current > 9000;
      const isStuck =
        state.entryQueue.length > 0 && isProcessingEntryRef.current && stalled;

      if (isStuck) {
        // True stall (over 9s with zero progress). El flag se libera para
        // permitir el relanzamiento; el try/finally de processNextEntry lo
        // vuelve a poner, asi que un ingreso largo no se solapa consigo mismo.
        isProcessingEntryRef.current = false;
        processNextEntry();
      } else if (state.entryQueue.length > 0 && !isProcessingEntryRef.current) {
        processNextEntry();
      }
    }, 2000);

    return () => clearInterval(watchdog);
  }, [state.entryQueue, processNextEntry]);

  // Public Actions
  const joinViewer = useCallback((username?: string, personality?: PersonalityType, avatar?: Partial<ResidentAvatar>) => {
    const rawUname = username || `usuario_${Math.floor(100 + Math.random() * 900)}`;
    const uname = rawUname.startsWith('@') ? rawUname.slice(1) : rawUname;
    const finalPersonality = personality || 'gamer';
    const generatedAvatar = generateRandomAvatar(finalPersonality);
    if (avatar) {
      Object.assign(generatedAvatar, avatar);
    }

    const queueResident: QueueResident = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      username: uname,
      displayName: uname.startsWith('@') ? uname : `@${uname}`,
      personality: finalPersonality,
      avatar: generatedAvatar,
    };

    setState((prev) => {
      // Check if already in hotel or queue
      const alreadyResident = Object.values(prev.residents).some((r) => (r.username || '').toLowerCase() === uname.toLowerCase());
      const alreadyInQueue = prev.entryQueue.some((q) => (q.username || '').toLowerCase() === uname.toLowerCase());
      if (alreadyResident || alreadyInQueue) {
        return prev;
      }

      // TOPE DE LA COLA.
      //
      // Sin tope, la fila crecia sin limite: en un live real de 60 espectadores
      // llego a 130+ personas esperando. La causa es que TikTok emite `member`
      // (entradas al room) de forma masiva y repetida, y cada una metia a
      // alguien. Con 4 habitaciones por piso, Don Pepe nunca alcanza y la fila
      // solo genera frustracion: el que esta en el puesto 60 jamas entra.
      //
      // El tope se dimensiona con la capacidad REAL de habitaciones libres: si
      // el hotel esta lleno, no tiene sentido encolar mas gente. El multiplicador
      // deja margen para las habitaciones que se crean al llenarse un piso.
      const totalRooms = Object.keys(prev.rooms).length || 4;
      const libres = Object.values(prev.rooms).filter((r) => !r.occupantId).length;
      // Margen generoso (2x la capacidad total) para no rechazar a nadie que
      // pueda entrar pronto, pero acotado para que la fila sea legible.
      const tope = Math.max(8, Math.min(totalRooms * 2, libres + totalRooms));
      if (prev.entryQueue.length >= tope) {
        return prev;
      }

      return {
        ...prev,
        entryQueue: [...prev.entryQueue, queueResident],
      };
    });
  }, []);

  /**
   * Lanza un poder sobre un residente AL AZAR (distinto de quien lo gano).
   *
   * Crea el `powerCast` que el overlay usa para dibujar el rayo de origen a
   * destino, y aplica el efecto sobre el receptor. Si solo hay un residente, no
   * hay a quien lanzarlo: se omite.
   *
   * Se declara ANTES de sendComment porque los comandos de chat (`!regen` etc.)
   * lo invocan.
   */
  const lanzarPoder = useCallback((powerId: SuperpowerId, fromId: string) => {
    const s = stateRef.current;
    const emisor = s.residents[fromId];
    if (!emisor) return;

    // Destinatario: cualquier otro residente, al azar.
    const otros = Object.values(s.residents).filter((r) => r.id !== fromId);
    if (!otros.length) return;
    const receptor = otros[Math.floor(Math.random() * otros.length)];

    const def = SUPERPOWERS.find((p) => p.id === powerId);
    const duracion = 1100;

    setState((prev) => {
      const dest = prev.residents[receptor.id];
      const src = prev.residents[fromId];
      if (!dest || !src) return prev;

      // Efecto sobre el receptor, segun el poder.
      let afectado = { ...dest };
      const limitado = (Number(prev.entryRules?.residentStaySeconds) || 0) > 0;
      if (powerId === 'regen') {
        afectado.energy = Math.min(100, dest.energy + 25);
        if (limitado && typeof dest.stayRemainingSec === 'number') {
          afectado.stayRemainingSec = dest.stayRemainingSec + 30;
        }
      } else if (powerId === 'escudo') {
        afectado.stability = Math.min(100, dest.stability + 20);
      } else if (powerId === 'imán') {
        afectado.points = dest.points + 500;
      } else if (powerId === 'aura') {
        afectado.popularity = dest.popularity + 50;
      }

      const cast: PowerCast = {
        id: `cast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        power: powerId,
        fromId,
        fromName: src.displayName,
        toId: receptor.id,
        toName: receptor.displayName,
        startedAt: Date.now(),
        durationMs: duracion,
      };

      return {
        ...prev,
        residents: { ...prev.residents, [receptor.id]: afectado },
        powerCasts: [...(prev.powerCasts || []), cast],
      };
    });

    addNotification({
      type: 'event',
      icon: def?.icon || '⚡',
      text: `${emisor.displayName} lanzó ${def?.name || 'un poder'} sobre ${receptor.displayName}`,
    });
  }, [addNotification]);

  const sendComment = useCallback((username?: string, comment?: string) => {
    const s = stateRef.current;
    const residentsList = Object.values(s.residents);
    if (residentsList.length === 0) {
      // If hotel is empty, invite user to enter first
      joinViewer(username);
      return;
    }

    // A quien se atribuye el comentario: SIEMPRE su autor.
    //
    // BUG (2026-10-04, dos veces): la version original elegia un residente al
    // azar cuando el autor no estaba dentro, y el mensaje salia sobre la cabeza
    // de otra persona. El arreglo siguiente lo cambio por "descartar", que
    // tampoco vale: en un live real casi nadie esta dentro todavia, asi que
    // los comentarios desaparecian.
    //
    // Lo correcto: el comentario es de quien escribe. Si todavia no es
    // residente, se registra su intencion y se le hace entrar; cuando llegue
    // al hotel su mensaje aparecera sobre su propia cabeza.
    const clean = (username || '').replace('@', '').toLowerCase();
    let targetResident: Resident | undefined = username
      ? residentsList.find((r) => (r.username || '').toLowerCase() === clean)
      : undefined;

    const commentText = comment || '¡Saludos a todos desde el stream! 👋';

    if (!targetResident) {
      // El autor todavia no ha entrado: se hace entrar y se guarda el mensaje
      // para que aparezca en cuanto tenga avatar.
      browserReport.info('comentario', 'autor no residente: entra y guarda el mensaje', {
        usuario: username || '(anonimo)',
        texto: commentText.slice(0, 60),
      });
      pendingMessagesRef.current[`${clean}`] = commentText;
      if (username) joinViewer(username);
      return;
    }

    const lower = commentText.toLowerCase();

    // Check if command is !entrar and user not yet inside
    if (lower.includes('!entrar') && username) {
      const clean = username.replace('@', '').toLowerCase();
      const isAlreadyIn = Object.values(s.residents).some((r) => (r.username || '').toLowerCase() === clean);
      if (!isAlreadyIn) {
        joinViewer(username);
        return;
      }
    }

    const bubbleId = `bubble_${Date.now()}`;

    // --- Comandos de PODER ---
    //
    // Un residente que ya desbloqueo un poder puede lanzarlo escribiendolo en el
    // chat. Los comandos son los que anuncia la etiqueta lateral del edificio.
    // Se comprueba antes del setState para poder lanzar (que ya hace su propio
    // setState) sin pisarse.
    //
    // OJO: se comprueba SIEMPRE, no solo si ya tiene poderes. Si se condiciona a
    // `superpowers.length > 0`, quien escribe el comando sin haberlo desbloqueado
    // recibe silencio absoluto y no sabe por que no pasa nada.
    const poderPedido = COMANDOS_PODER.find((c) => lower.includes(c.cmd));
    if (poderPedido) {
      const loTiene = (targetResident.superpowers || []).includes(poderPedido.power);
      if (loTiene) {
        // Se lanza sobre otro residente al azar, con su animacion.
        lanzarPoder(poderPedido.power, targetResident.id);
      } else {
        // Lo pide pero aun no lo tiene: se le dice como conseguirlo.
        addNotification({
          type: 'alert',
          icon: '🔒',
          text: `${targetResident.displayName} aún no tiene ${poderPedido.nombre} (necesita ${poderPedido.likes} likes)`,
        });
      }
      return;
    }

    setState((prev) => {
      const res = prev.residents[targetResident.id];
      if (!res) return prev;

      // Determine if a command overrides action
      let actionOverride = res.currentAction;
      if (lower.includes('!bailar') || lower.includes('bailar')) actionOverride = 'dancing';
      else if (lower.includes('!dormir') || lower.includes('dormir')) actionOverride = 'sleeping';
      else if (lower.includes('!pc') || lower.includes('!jugar') || lower.includes('game')) actionOverride = 'gaming';
      else if (lower.includes('!tv')) actionOverride = 'watching_tv';
      else if (lower.includes('!celebrar') || lower.includes('!fiesta')) actionOverride = 'celebrating';

      return {
        ...prev,
        stats: {
          ...prev.stats,
          totalComments: prev.stats.totalComments + 1,
        },
        residents: {
          ...prev.residents,
          [res.id]: {
            ...res,
            currentAction: actionOverride,
            stability: Math.min(100, res.stability + 6), // Comments boost stability!
            speechBubble: {
              id: bubbleId,
              text: commentText.length > 40 ? commentText.substring(0, 38) + '...' : commentText,
              timestamp: Date.now(),
              // 2.8s: el usuario pidio que la burbuja dure 2-3 segundos en
              // pantalla. El barrido del bucle de vida usa este mismo valor como
              // respaldo, asi que los dos numeros deben coincidir.
              durationMs: BUBBLE_MS,
            },
          },
        },
      };
    });

    // Remove speech bubble after duration
    setTimeout(() => {
      setState((prev) => {
        const res = prev.residents[targetResident.id];
        if (!res || res.speechBubble?.id !== bubbleId) return prev;
        return {
          ...prev,
          residents: {
            ...prev.residents,
            [res.id]: {
              ...res,
              speechBubble: null,
            },
          },
        };
      });
    }, BUBBLE_MS + 200);
  }, [joinViewer, lanzarPoder, addNotification]);

  const sendGift = useCallback((giftId: string, username?: string) => {
    const gift = DEFAULT_GIFT_RULES.find((g) => g.id === giftId) || DEFAULT_GIFT_RULES[0];
    const s = stateRef.current;
    const residentsList = Object.values(s.residents);

    let targetResident: Resident | undefined;
    if (username) {
      const clean = username.replace('@', '').toLowerCase();
      targetResident = residentsList.find((r) => (r.username || '').toLowerCase() === clean);
    }
    if (!targetResident && residentsList.length > 0) {
      targetResident = residentsList[Math.floor(Math.random() * residentsList.length)];
    }

    if (!targetResident) return;

    // Sounds & FX based on gift tier
    if (gift.tier === 'small') {
      audioEngine.playGiftChime();
    } else if (gift.tier === 'medium') {
      audioEngine.playGiftChime();
      triggerConfetti({ particleCount: 25, spread: 45, origin: { y: 0.5 } });
    } else if (gift.tier === 'large') {
      audioEngine.playBigGiftFanfare();
      triggerConfetti({ particleCount: 80, spread: 80, origin: { y: 0.5 } });
      setCameraFocus('ROOM', targetResident.floorNumber, undefined, 2, 3500);
    } else if (gift.tier === 'vip') {
      audioEngine.playBigGiftFanfare();
      triggerConfetti({ particleCount: 150, spread: 100, origin: { y: 0.4 } });
      setCameraFocus('PENTHOUSE', 1, undefined, 1, 4500);
      audioEngine.speakAnnouncement(`¡Regalo VIP! ¡${targetResident.displayName} ha recibido la Corona Real!`, true);
    }

    setState((prev) => {
      const res = prev.residents[targetResident.id];
      if (!res) return prev;

      let nextVipLevel = res.vipLevel;
      if (gift.makesVip) {
        nextVipLevel = Math.min(3, res.vipLevel + 1);
      }

      // Check room upgrade
      const room = prev.rooms[res.roomId];
      let updatedRooms = { ...prev.rooms };
      if (room && gift.upgradesRoom) {
        const nextLevel = room.level === 'NORMAL' ? 'MEJORADA' : room.level === 'MEJORADA' ? 'PREMIUM' : 'VIP';
        updatedRooms[res.roomId] = {
          ...room,
          level: nextLevel,
          decorLevel: Math.min(5, room.decorLevel + 1),
        };
      }

      let updatedPenthouse = prev.vipPenthouseResidents;
      if (gift.makesVip && !updatedPenthouse.includes(res.id)) {
        updatedPenthouse = [...updatedPenthouse, res.id];
      }

      // --- Estadía por regalo ---
      //
      // Cada regalo suma segundos, y "van aumentando": el multiplicador crece
      // con el nivel del regalo (small=1s, medium=2s, large=4s, vip=8s). Con el
      // superpoder Imán, el triple.
      const segundosPorNivel: Record<string, number> = {
        small: 1,
        medium: 2,
        large: 4,
        vip: 8,
      };
      const factor = segundosPorNivel[gift.tier] ?? 1;
      const conIman = res.superpowers?.includes('imán') ? 3 : 1;
      const segundosGanados = STAY_REWARDS.giftSecondsBase * factor * conIman;

      const limitado = (Number(prev.entryRules?.residentStaySeconds) || 0) > 0;
      let stayRemaining = res.stayRemainingSec ?? null;
      if (limitado && stayRemaining !== null) {
        stayRemaining += segundosGanados;
      }

      const total = res.stayTotalSec && res.stayTotalSec > 0
        ? res.stayTotalSec
        : Number(prev.entryRules?.residentStaySeconds) || 0;

      return {
        ...prev,
        vipPenthouseResidents: updatedPenthouse,
        rooms: updatedRooms,
        stats: {
          ...prev.stats,
          totalGiftsReceived: prev.stats.totalGiftsReceived + 1,
        },
        residents: {
          ...prev.residents,
          [res.id]: {
            ...res,
            energy: Math.min(100, res.energy + gift.energyBoost),
            // Con tiempo limitado la barra refleja el reloj real; si no, el
            // boost clasico de estabilidad del regalo.
            stability: limitado && stayRemaining !== null && total > 0
              ? Math.max(0, Math.min(100, (stayRemaining / total) * 100))
              : Math.min(100, res.stability + gift.stabilityBoost),
            stayRemainingSec: limitado ? stayRemaining : null,
            points: res.points + gift.pointsBoost,
            vipLevel: nextVipLevel,
            currentAction: 'celebrating',
          },
        },
      };
    });

    addNotification({
      type: 'gift',
      icon: gift.icon,
      text: `${targetResident.displayName} recibió ${gift.name}!`,
    });

    if (gift.triggersEvent) {
      triggerEvent(gift.triggersEvent);
    }
  }, [setCameraFocus, addNotification, triggerEvent]);

  // Day / Evening / Night advance
  const advanceTime = useCallback(() => {
    setState((prev) => {
      const nextTime: TimeOfDay = prev.timeOfDay === 'day' ? 'evening' : prev.timeOfDay === 'evening' ? 'night' : 'day';
      const hour = nextTime === 'day' ? 12 : nextTime === 'evening' ? 18 : 23;
      return {
        ...prev,
        timeOfDay: nextTime,
        timeHour: hour,
      };
    });
  }, []);

  const setTimeOfDay = useCallback((time: TimeOfDay) => {
    setState((prev) => ({
      ...prev,
      timeOfDay: time,
      timeHour: time === 'day' ? 12 : time === 'evening' ? 18 : 23,
    }));
  }, []);

  // Floor management
  const createNextFloor = useCallback(() => {
    createNextFloorInternal();
  }, [createNextFloorInternal]);

  const destroyUpperFloor = useCallback(async (floorNumber: number) => {
    if (floorNumber <= 1) return; // Floor 1 cannot be destroyed
    const s = stateRef.current;
    const upperFloors = s.floors
      .filter((f) => f.floorNumber > floorNumber)
      .map((f) => f.floorNumber);

    // FASE 1: Grietas y Fallos de Luz (0 - 2200ms)
    audioEngine.playAlarm();
    audioEngine.playPowerDown();
    audioEngine.speakAnnouncement(`¡Alerta! Fallo estructural y demolición en el piso ${floorNumber}. Evacuando área.`, true);

    addNotification({
      type: 'alert',
      icon: '⚡',
      text: `¡Fallo eléctrico y grietas en Piso ${floorNumber}!`,
    });

    setState((prev) => ({
      ...prev,
      floors: prev.floors.map((f) => (f.floorNumber === floorNumber ? { ...f, status: 'destroying' } : f)),
      demolitionState: {
        isDemolishing: true,
        demolishingFloorNumber: floorNumber,
        phase: 'cracks_and_flicker',
        affectedUpperFloors: upperFloors,
      },
    }));

    await new Promise((r) => setTimeout(r, 2200));

    // FASE 2: Explosión en Ladrillos y Píxeles (2200 - 3400ms)
    audioEngine.playExplosion();
    addNotification({
      type: 'alert',
      icon: '💥',
      text: `¡El Piso ${floorNumber} colapsa en una explosión de ladrillos!`,
    });

    setState((prev) => ({
      ...prev,
      demolitionState: {
        ...prev.demolitionState,
        phase: 'exploding_bricks',
      },
    }));

    await new Promise((r) => setTimeout(r, 1200));

    // FASE 3: Caída de Pisos Superiores y Caída de Personajes (3400 - 4500ms)
    if (upperFloors.length > 0) {
      audioEngine.playStumble();
      setState((prev) => ({
        ...prev,
        demolitionState: {
          ...prev.demolitionState,
          phase: 'upper_floors_falling',
        },
      }));

      await new Promise((r) => setTimeout(r, 900));
      audioEngine.playHeavySlam();
      audioEngine.playThunder();
    }

    await new Promise((r) => setTimeout(r, 600));

    // FASE 4: Reorganización estructural final y retirada del piso
    setState((prev) => {
      const remainingFloors = prev.floors.filter((f) => f.floorNumber !== floorNumber);
      const remainingRooms = { ...prev.rooms };
      Object.keys(remainingRooms).forEach((roomId) => {
        if (remainingRooms[roomId].floorNumber === floorNumber) {
          delete remainingRooms[roomId];
        }
      });

      return {
        ...prev,
        floors: remainingFloors,
        rooms: remainingRooms,
        activeFloorView: 1,
        demolitionState: {
          isDemolishing: false,
          demolishingFloorNumber: null,
          phase: 'none',
          affectedUpperFloors: [],
        },
      };
    });
    setActiveFloorNumber(1);
  }, [addNotification]);

  // Check if any upper floor (floorNumber > 1) has all rooms liberated (0 occupants)
  const checkUpperFloorsEmptyStatus = useCallback(() => {
    const s = stateRef.current;
    const upperFloors = s.floors.filter((f) => f.floorNumber > 1 && f.status === 'active');
    for (const floor of upperFloors) {
      const floorRooms = Object.values(s.rooms).filter((r) => r.floorNumber === floor.floorNumber);
      const hasOccupants = floorRooms.some(
        (r) => (r.status === 'OCUPADA' || r.status === 'RESERVADA') && r.occupantId
      );
      if (!hasOccupants) {
        destroyUpperFloor(floor.floorNumber);
        break; // Demolish one at a time
      }
    }
  }, [destroyUpperFloor]);

  /**
   * Desalojo de un residente.
   *
   * Dos fases, para que se vea caer al personaje:
   *  1. Se marca `evicting` y la habitacion queda libre de inmediato. El
   *     personaje SIGUE en el mapa (con sus likes) porque EvictionOverlay lo
   *     necesita para dibujarlo cayendo por la fachada.
   *  2. A los 2.6s (lo que dura la caida) se borra del mapa. Al desaparecer el
   *     personaje, su contador de likes desaparece con el: vuelve a 0 solo.
   */
  const evictResident = useCallback((residentId: string) => {
    const s = stateRef.current;
    const res = s.residents[residentId];
    if (!res) return;
    // Ya se estaba desalojando: no relanzar la animacion.
    if (res.evicting) return;

    audioEngine.playEvict();
    audioEngine.playStumble();

    // Mark resident as leaving
    setState((prev) => {
      const updatedRooms = { ...prev.rooms };
      if (updatedRooms[res.roomId]) {
        updatedRooms[res.roomId] = {
          ...updatedRooms[res.roomId],
          status: 'VACIA',
          occupantId: null,
        };
      }

      return {
        ...prev,
        rooms: updatedRooms,
        residents: {
          ...prev.residents,
          [residentId]: {
            ...res,
            currentAction: 'leaving_hotel',
            // Sigue en 'room' a proposito: el overlay mide su habitacion para
            // saber por donde empieza a caer.
            location: 'room',
            direction: 'right',
            evicting: { startedAt: Date.now() },
          },
        },
      };
    });

    addNotification({
      type: 'leave',
      icon: '🚪',
      text: `${res.displayName} fue desalojado de la habitación ${s.rooms[res.roomId]?.number || ''}`,
    });
  }, [addNotification]);

  /**
   * Cierre del desalojo: borra al residente despues de la caida.
   * Lo llama EvictionOverlay cuando termina la animacion.
   */
  const finalizeEviction = useCallback((residentId: string) => {
    setState((prev) => {
      const saliente = prev.residents[residentId];
      if (!saliente) return prev;

      const updatedResidents = { ...prev.residents };
      delete updatedResidents[residentId];
      const updatedVip = prev.vipPenthouseResidents.filter((id) => id !== residentId);

      // Liberar TODA habitacion cuyo ocupante fuera este residente: la suya y
      // todas las absorbidas por el superpoder de expansion.
      //
      // No basta con `expandedRoomIds`: la habitacion puede haber quedado
      // marcada OCUPADA con `occupantId` ya borrado (si el residente salio por
      // otra via), y entonces se quedaba OCUPADA para siempre sin nadie dentro.
      // Se comprueba por ocupante, que es la fuente de verdad.
      const updatedRooms = { ...prev.rooms };
      for (const [id, room] of Object.entries(updatedRooms)) {
        if (room.occupantId === residentId) {
          updatedRooms[id] = { ...room, status: 'VACIA', occupantId: null };
        }
      }

      return {
        ...prev,
        rooms: updatedRooms,
        residents: updatedResidents,
        vipPenthouseResidents: updatedVip,
      };
    });

    // If an upper floor is now empty, destroy it!
    setTimeout(() => {
      checkUpperFloorsEmptyStatus();
    }, 500);
  }, [checkUpperFloorsEmptyStatus]);

  const upgradeResidentRoom = useCallback((roomId: string) => {
    setState((prev) => {
      const room = prev.rooms[roomId];
      if (!room) return prev;
      const nextLevel = room.level === 'NORMAL' ? 'MEJORADA' : room.level === 'MEJORADA' ? 'PREMIUM' : 'VIP';
      audioEngine.playUpgrade();
      return {
        ...prev,
        rooms: {
          ...prev.rooms,
          [roomId]: {
            ...room,
            level: nextLevel,
            decorLevel: Math.min(5, room.decorLevel + 1),
          },
        },
      };
    });
  }, []);

  const promoteToVip = useCallback((residentId: string) => {
    setState((prev) => {
      const res = prev.residents[residentId];
      if (!res) return prev;
      audioEngine.playBigGiftFanfare();
      const updatedVip = prev.vipPenthouseResidents.includes(residentId)
        ? prev.vipPenthouseResidents
        : [...prev.vipPenthouseResidents, residentId];

      return {
        ...prev,
        vipPenthouseResidents: updatedVip,
        residents: {
          ...prev.residents,
          [residentId]: {
            ...res,
            vipLevel: Math.min(3, res.vipLevel + 1),
          },
        },
      };
    });
  }, []);

  const boostStability = useCallback((residentId: string, amount: number) => {
    setState((prev) => {
      const res = prev.residents[residentId];
      if (!res) return prev;
      return {
        ...prev,
        residents: {
          ...prev.residents,
          [residentId]: {
            ...res,
            stability: Math.min(100, Math.max(0, res.stability + amount)),
          },
        },
      };
    });
  }, []);

  // Reset Live session
  const resetLiveSession = useCallback((mode: 'NEW_LIVE' | 'CONTINUE_LIVE') => {
    if (mode === 'NEW_LIVE') {
      const initial = createInitialHotel();
      setState({
        floors: initial.floors,
        rooms: initial.rooms,
        residents: {},
        entryQueue: [],
        receptionAttending: null,
        demolitionState: {
          isDemolishing: false,
          demolishingFloorNumber: null,
          phase: 'none',
          affectedUpperFloors: [],
        },
        vipPenthouseResidents: [],
        timeOfDay: 'day',
        weather: 'SOL',
        timeHour: 12,
        globalEvent: {
          type: 'NONE',
          title: '',
          message: '',
          durationMs: 0,
          startedAt: 0,
        },
        camera: {
          targetType: 'GENERAL',
          targetFloor: 1,
          zoom: 1.0,
          priority: 5,
          lockUntil: 0,
        },
        activeFloorView: 1,
        liveActive: true,
        entryRules: {
          entryMode: 'ANY_COMMENT',
          keyword: '!entrar',
          likesRequired: 20,
          sharesRequired: 1,
          requireFollow: false,
          minGiftCoins: 1,
          autoApprove: true,
          welcomeMessage: '¡Bienvenido al hotel! Tu habitación te espera.',
          residentStaySeconds: 0,
                superpowersEnabled: true,
        },
        stats: {
          totalResidentsJoined: 0,
          totalGiftsReceived: 0,
          totalComments: 0,
          peakResidents: 0,
        },
        notifications: [
          {
            id: 'start_1',
            type: 'alert',
            icon: '✨',
            text: '¡Nuevo LIVE comenzado! Piso 1 abierto con 4 habitaciones y Planta Baja.',
            timestamp: Date.now(),
          },
        ],
        powerCasts: [],
      });
      setActiveFloorNumber(1);
    }
  }, []);

  // Auto simulation toggle
  const toggleAutoSimulation = useCallback(() => {
    if (isAutoSimulating) {
      mockTikTokProvider.stopAutoSimulation();
      setIsAutoSimulating(false);
    } else {
      mockTikTokProvider.startAutoSimulation('medium');
      setIsAutoSimulating(true);
    }
  }, [isAutoSimulating]);

  // Hook up mock TikTok provider events to context
  useEffect(() => {
    const unsubJoin = mockTikTokProvider.onViewerJoin((ev: TikTokJoinEvent) => {
      joinViewer(ev.user.uniqueId, ev.personality, ev.customAvatar);
    });

    const unsubComment = mockTikTokProvider.onComment((ev: TikTokCommentEvent) => {
      sendComment(ev.user.uniqueId, ev.comment);
    });

    const unsubGift = mockTikTokProvider.onGift((ev: TikTokGiftEvent) => {
      sendGift(ev.giftId, ev.user.uniqueId);
    });

    const unsubFollow = mockTikTokProvider.onFollow((ev) => {
      addNotification({
        type: 'join',
        icon: '💖',
        text: `@${ev.user.uniqueId} comenzó a seguir el LIVE!`,
      });
      // Find resident if inside and trigger celebration
      const res = Object.values(stateRef.current.residents).find(
        (r) => (r.username || '').toLowerCase() === ev.user.uniqueId.toLowerCase()
      );
      if (res) {
        setState((prev) => ({
          ...prev,
          residents: {
            ...prev.residents,
            [res.id]: {
              ...res,
              currentAction: 'celebrating',
              popularity: res.popularity + 20,
            },
          },
        }));
      }
    });

    return () => {
      unsubJoin();
      unsubComment();
      unsubGift();
      unsubFollow();
    };
  }, [joinViewer, sendComment, sendGift, addNotification]);

  // Autonomous Living & Stability Loop (runs every 3.5 seconds)
  useEffect(() => {
    const TICK_MS = 3500;
    const TICK_SEC = TICK_MS / 1000;

    const interval = setInterval(() => {
      const s = stateRef.current;
      const residentsList = Object.values(s.residents);
      if (residentsList.length === 0) return;

      const updatedResidents = { ...s.residents };
      const toEvict: string[] = [];
      const staySecs = Number(s.entryRules?.residentStaySeconds) || 0;
      const limitado = staySecs > 0;

      residentsList.forEach((res) => {
        // --- Tiempo de estadía ---
        //
        // El reloj es `stayRemainingSec` (segundos reales). La barra de
        // `stability` se DERIVA de el, en vez de ser el reloj: asi "un like
        // suma 0.3s" es literal y no depende del total configurado.
        let newStability = res.stability;
        let stayRemaining = res.stayRemainingSec ?? null;

        if (limitado) {
          // Un residente restaurado sin reloj (estado de version anterior) lo
          // estrena aqui, en vez de quedar inmortal o desaparecer de golpe.
          if (stayRemaining === null) stayRemaining = staySecs;

          stayRemaining = stayRemaining - TICK_SEC;

          // Superpoder de regeneración: recupera estadía sola. Se aplica antes
          // de comprobar el desalojo para que se note el efecto.
          if (res.superpowers?.includes('regen')) {
            stayRemaining += TICK_SEC * 0.6;
          }

          if (stayRemaining <= 0) {
            toEvict.push(res.id);
            return;
          }

          const total = res.stayTotalSec && res.stayTotalSec > 0 ? res.stayTotalSec : staySecs;
          newStability = Math.max(0, Math.min(100, (stayRemaining / total) * 100));
        }

        // --- Superpoder Aura: reparte estadía a los vecinos de su piso ---
        if (res.superpowers?.includes('aura') && limitado && stayRemaining !== null) {
          residentsList.forEach((vecino) => {
            if (
              vecino.id !== res.id &&
              vecino.floorNumber === res.floorNumber &&
              vecino.stayRemainingSec !== null &&
              vecino.stayRemainingSec !== undefined
            ) {
              updatedResidents[vecino.id] = {
                ...(updatedResidents[vecino.id] || vecino),
                stayRemainingSec: (vecino.stayRemainingSec || 0) + TICK_SEC * 0.15,
              };
            }
          });
        }

        // Random actions based on personality & event
        let nextAction = res.currentAction;
        let coordX = res.coordX;
        let direction = res.direction;

        // If in global event, participate
        if ((s.globalEvent?.type || 'NONE') === 'FIESTA') {
          nextAction = 'dancing';
        } else if ((s.globalEvent?.type || 'NONE') === 'APAGON') {
          nextAction = 'worried';
        } else if ((s.globalEvent?.type || 'NONE') === 'INCENDIO') {
          nextAction = 'walking';
          coordX = (coordX + (direction === 'right' ? 20 : -20) + 100) % 100;
        } else if (Math.random() < 0.28 && !res.isEntering && !res.isLeaving) {
          // Autonomous action shift
          const roll = Math.random();
          if (res.personality === 'gamer') {
            nextAction = roll < 0.6 ? 'gaming' : roll < 0.8 ? 'dancing' : 'idle';
          } else if (res.personality === 'fiestero') {
            nextAction = roll < 0.6 ? 'dancing' : roll < 0.85 ? 'walking' : 'celebrating';
          } else if (res.personality === 'tímido') {
            nextAction = roll < 0.6 ? 'sleeping' : roll < 0.85 ? 'watching_tv' : 'idle';
          } else if (res.personality === 'loco') {
            nextAction = roll < 0.4 ? 'dancing' : roll < 0.7 ? 'prank' : 'walking';
          } else {
            // General variety
            const actions: Resident['currentAction'][] = [
              'idle',
              'walking',
              'gaming',
              'watching_tv',
              'sleeping',
              'dancing',
              'celebrating',
            ];
            nextAction = actions[Math.floor(Math.random() * actions.length)];
          }

          if (nextAction === 'walking') {
            direction = direction === 'left' ? 'right' : 'left';
            coordX = Math.floor(20 + Math.random() * 60);
          }
        }

        updatedResidents[res.id] = {
          ...res,
          stability: newStability,
          stayRemainingSec: limitado ? stayRemaining : null,
          currentAction: nextAction,
          coordX,
          direction,
          // Barrido de burbujas huerfanas.
          //
          // El setTimeout que borra cada burbuja vive en memoria; si el estado
          // se restaura de localStorage o el temporizador se pierde, la burbuja
          // se quedaba pegada para siempre. Este barrido garantiza que ninguna
          // sobreviva mas de lo que dice su `durationMs`.
          speechBubble:
            res.speechBubble &&
            Date.now() - (Number(res.speechBubble.timestamp) || 0) >=
              (Number(res.speechBubble.durationMs) || 3000)
              ? null
              : res.speechBubble ?? null,
        };
      });

      setState((prev) => ({
        ...prev,
        residents: updatedResidents,
      }));

      // Evict residents whose stay ran out
      toEvict.forEach((id) => {
        evictResident(id);
      });
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [evictResident]);

  // Autonomous Day/Night ambient shift (every 75 seconds)
  useEffect(() => {
    const timeInterval = setInterval(() => {
      advanceTime();
    }, 75000);
    return () => clearInterval(timeInterval);
  }, [advanceTime]);

  const updateEntryRules = useCallback((newRules: Partial<EntryRulesConfig>) => {
    setState((prev) => ({
      ...prev,
      entryRules: {
        ...prev.entryRules,
        ...newRules,
      },
    }));
    addNotification({
      type: 'alert',
      icon: '⚙️',
      text: 'Reglas de entrada actualizadas',
    });
  }, [addNotification]);

  /**
   * Suma segundos de estadía a un residente por su username.
   *
   * Helper para las recompensas que no tienen un destinatario calculado (como
   * compartir, que puede venir de alguien que acaba de entrar). Si el usuario no
   * esta dentro, no hace nada: no se inventa un residente para darle tiempo.
   */
  const sumarEstadia = useCallback((username: string, segundos: number) => {
    if (!segundos || segundos <= 0) return;
    const s = stateRef.current;
    const clean = (username || '').replace('@', '').toLowerCase();
    const objetivo = Object.values(s.residents).find(
      (r) => (r.username || '').toLowerCase() === clean
    );
    if (!objetivo) return;
    if ((Number(s.entryRules?.residentStaySeconds) || 0) <= 0) return;
    if (objetivo.stayRemainingSec === null || objetivo.stayRemainingSec === undefined) return;

    setState((prev) => {
      const res = prev.residents[objetivo.id];
      if (!res || res.stayRemainingSec === null || res.stayRemainingSec === undefined) return prev;

      const stayRemaining = res.stayRemainingSec + segundos;
      const total = res.stayTotalSec && res.stayTotalSec > 0
        ? res.stayTotalSec
        : Number(prev.entryRules?.residentStaySeconds) || 0;

      return {
        ...prev,
        residents: {
          ...prev.residents,
          [res.id]: {
            ...res,
            stayRemainingSec: stayRemaining,
            stability: total > 0
              ? Math.max(0, Math.min(100, (stayRemaining / total) * 100))
              : res.stability,
          },
        },
      };
    });
  }, []);

  const simulateUserShare = useCallback((username?: string) => {
    const uname = username || `@compartidor_${Math.floor(Math.random() * 900 + 100)}`;
    addNotification({
      type: 'join',
      icon: '🔁',
      text: `${uname} compartió el LIVE!`,
    });
    joinViewer(uname);
    // Compartir suma estadía (0.5s) al residente que lo hizo, si ya esta dentro.
    sumarEstadia(uname, STAY_REWARDS.shareSeconds);
  }, [addNotification, joinViewer, sumarEstadia]);

  /**
 * Recarga energia con likes.
 *
 * TikTok agrupa los likes en rafagas grandes (un usuario puede enviar cientos
 * de golpe), asi que se convierte el numero de likes en puntos de energia con
 * un rendimiento decreciente y un tope por evento: si no, una sola rafaga
 * dejaria a todos los residentes al 100% y el juego perderia su LIMIT.
 *
 * Prioriza a quien tiene menos energia, para que los likes sirvan para
 * revivir a los que se han quedado parados y no como plus sobre los que ya
 * estan bien.
 */
  /**
   * Superpoder "Habitación Doble": el residente ABSORBE habitaciones contiguas
   * hasta ocupar el piso entero (maximo 4).
   *
   * Se apropia de las contiguas a su columna, primero las libres y luego las
   * ocupadas (desalojando a su inquilino). Su habitacion principal se marca con
   * `roomSpan` = cuantas columnas ocupa, y la fila del piso la dibuja como UN
   * solo bloque ancho: el personaje NO se duplica.
   *
   * Al irse el residente, `finalizeEviction` libera todas las habitaciones
   * absorbidas y el piso vuelve a la normalidad.
   */
  const expandirHabitacion = useCallback((residentId: string, likesOverride?: number) => {
    const s = stateRef.current;
    const res = s.residents[residentId];
    if (!res) return;

    const suPiso = s.floors.find((f) => f.floorNumber === res.floorNumber);
    if (!suPiso) return;

    const propia = s.rooms[res.roomId];
    if (!propia) return;

    // Cuantas habitaciones le tocan por sus likes (+1 cada 500, tope 4).
    //
    // `likesOverride` es importante: quien llama suele venir de una tanda de
    // likes recien sumada, y `stateRef.current` todavia tiene el total VIEJO
    // (React no ha re-renderizado). Sin el override la ampliacion se quedaba una
    // tanda por detras: expandia a los 1000 en vez de a los 500.
    const likesActuales = likesOverride ?? res.likes ?? 0;
    const spanObjetivo = habitacionesPorLikes(likesActuales);
    const absorbidas = res.expandedRoomIds || [];
    const spanActual = absorbidas.length + 1;

    // Nada que hacer si ya esta en el tamano que le corresponde (o si el piso
    // tiene menos de 4 habitaciones).
    const topeDelPiso = Math.min(4, suPiso.rooms.length);
    const objetivo = Math.min(spanObjetivo, topeDelPiso);
    if (objetivo <= spanActual) return;

    // Cuantas absorbe en ESTA ampliacion: solo las que faltan para llegar al
    // tamano que le toca. Asi crece de una en una cada 500 likes.
    const cuantas = objetivo - spanActual;

    // Contiguas ordenadas por cercania a su columna, sin contar las que ya tiene.
    const candidatas = suPiso.rooms
      .map((id) => s.rooms[id])
      .filter((r) => r && r.id !== res.roomId && !absorbidas.includes(r.id))
      .sort(
        (a, b) =>
          Math.abs(a.colIndex - propia.colIndex) - Math.abs(b.colIndex - propia.colIndex)
      );

    // Prefiere las libres; las ocupadas entran despues (y desalojan al vecino).
    const libres = candidatas.filter((r) => !r.occupantId);
    const ocupadas = candidatas.filter((r) => r.occupantId);
    const elegidas = [...libres, ...ocupadas].slice(0, cuantas);
    if (!elegidas.length) return;

    const idsNuevas = elegidas.map((r) => r.id);
    const todasAbsorbidas = [...absorbidas, ...idsNuevas];
    const vecinosAExpulsar = ocupadas
      .filter((r) => idsNuevas.includes(r.id))
      .map((r) => ({ room: r, resident: s.residents[r.occupantId!] }))
      .filter((x) => !!x.resident);

    setState((prev) => {
      const actual = prev.residents[residentId];
      if (!actual) return prev;

      const rooms = { ...prev.rooms };
      // Las recien absorbidas pasan a ser suyas.
      for (const id of idsNuevas) {
        rooms[id] = { ...rooms[id], status: 'OCUPADA', occupantId: residentId };
      }
      // Su habitacion principal se ensancha tantas columnas como junte.
      rooms[res.roomId] = {
        ...rooms[res.roomId],
        status: 'OCUPADA',
        occupantId: residentId,
      };

      return {
        ...prev,
        rooms,
        residents: {
          ...prev.residents,
          [residentId]: {
            ...actual,
            expandedRoomIds: todasAbsorbidas,
            roomSpan: todasAbsorbidas.length + 1,
          },
        },
      };
    });

    addNotification({
      type: 'upgrade',
      icon: '🏰',
      text: `${res.displayName} amplió su suite a ${todasAbsorbidas.length + 1} habitaciones (${propia.number}${todasAbsorbidas.map((id) => ' + ' + s.rooms[id].number).join('')})`,
    });

    // Los vecinos de las habitaciones ocupadas son expulsados (caen por la fachada).
    vecinosAExpulsar.forEach(({ room, resident }, i) => {
      addNotification({
        type: 'alert',
        icon: '💥',
        text: `¡${resident.displayName} fue desalojado de la ${room.number} por una ampliación de suite!`,
      });
      // Escalonado para que se vea una caida tras otra, no todas de golpe.
      setTimeout(() => evictResident(resident.id), 400 + i * 500);
    });
  }, [addNotification, evictResident]);

  /**
   * Lanza un poder sobre un residente AL AZAR (distinto de quien lo gano).
   *
   * Crea el `powerCast` que el overlay usa para dibujar el rayo de origen a
   * destino, y aplica el efecto sobre el receptor. Si solo hay un residente, no
   * hay a quien lanzarlo: se omite.
   */
  /**
   * Cierra la animacion de un poder (la llama PowerCastOverlay al terminar).
   * Se quita de la lista para que el overlay deje de dibujarlo.
   */
  const finalizePowerCast = useCallback((castId: string) => {
    setState((prev) => {
      const casts = (prev.powerCasts || []).filter((c) => c.id !== castId);
      if (casts.length === (prev.powerCasts || []).length) return prev;
      return { ...prev, powerCasts: casts };
    });
  }, []);

  /**
   * Likes: recargan energía Y suman estadía.
   *
   * La estadía se suma en SEGUNDOS reales (0.3s por like, ver STAY_REWARDS), no
   * en puntos de estabilidad: con el reloj explicito, "un like = 0.3s" es
   * literal. Solo aplica si el hotel usa tiempo limitado.
   *
   * Ademas se comprueban los hitos de superpoderes (uno cada 100 likes).
   */
  const rechargeWithLikes = useCallback((username?: string, likeCount = 20) => {
    const s = stateRef.current;
    const residentsList = Object.values(s.residents);
    if (residentsList.length === 0) return;

    // Topes: minimo 1 punto por evento y maximo 12, para que ni un like
    // insignificante mueva la aguja ni una rafaga masiva llene el hotel.
    const boost = Math.max(1, Math.min(12, Math.round(likeCount / 25)));

    // El destinatario es quien da los likes si esta dentro; si no, el
    // residente con menos energia (el que mas lo necesita).
    const clean = (username || '').replace('@', '').toLowerCase();
    const liker = residentsList.find((r) => (r.username || '').toLowerCase() === clean);
    const target = liker || residentsList.reduce((a, b) => (a.energy <= b.energy ? a : b));

    // El contador de likes es de QUIEN los da: solo sube si el autor esta
    // dentro del hotel. Si los manda alguien de fuera, se recarga igual la
    // energia del residente que lo necesita, pero no se le apunta a nadie un
    // like que no dio.
    const likesDelEvento = liker ? Math.max(1, Number(likeCount) || 1) : 0;

    // Superpoderes: se calculan AQUI (fuera del updater) para poder anunciar
    // los nuevos sin llamar a addNotification dentro de setState, que React
    // puede ejecutar dos veces.
    const antes = target.superpowers || [];
    const despues = superpowersParaLikes((target.likes || 0) + likesDelEvento, s.entryRules);
    const recienGanados = despues.filter((p) => !antes.includes(p));

    const limitado = (Number(s.entryRules?.residentStaySeconds) || 0) > 0;
    const multiplicador = antes.includes('escudo') ? 2 : 1;

    setState((prev) => {
      const res = prev.residents[target.id];
      if (!res) return prev;

      let stayRemaining = res.stayRemainingSec ?? null;
      if (limitado && stayRemaining !== null) {
        stayRemaining += likesDelEvento * STAY_REWARDS.likeSeconds * multiplicador;
      }

      const total = res.stayTotalSec && res.stayTotalSec > 0
        ? res.stayTotalSec
        : Number(prev.entryRules?.residentStaySeconds) || 0;

      return {
        ...prev,
        residents: {
          ...prev.residents,
          [res.id]: {
            ...res,
            energy: Math.min(100, res.energy + boost),
            stability: limitado && stayRemaining !== null && total > 0
              ? Math.max(0, Math.min(100, (stayRemaining / total) * 100))
              : Math.min(100, res.stability + Math.ceil(boost / 2)),
            likes: (res.likes || 0) + likesDelEvento,
            stayRemainingSec: limitado ? stayRemaining : null,
            superpowers: superpowersParaLikes((res.likes || 0) + likesDelEvento, prev.entryRules),
          },
        },
      };
    });

    // Anunciar y activar los superpoderes recien ganados.
    recienGanados.forEach((id) => {
      const def = SUPERPOWERS.find((p) => p.id === id);
      if (!def) return;
      addNotification({
        type: 'upgrade',
        icon: def.icon,
        text: `¡${target.displayName} desbloqueó ${def.name}! (${def.likesRequired} likes)`,
      });
      // Los poderes se LANZAN sobre otro residente al azar, con su animacion.
      // Se espera un poco para que primero se vea el anuncio del desbloqueo.
      // (El de habitacion doble no se lanza: amplia la habitacion de su dueno,
      // y eso se comprueba abajo en cada umbral de 500 likes.)
      if (id !== 'habitacion_doble') {
        setTimeout(() => lanzarPoder(id, target.id), 900);
      }
    });

    // --- Ampliacion de la habitacion ---
    //
    // Se comprueba en CADA tanda de likes, no solo al desbloquear el poder: el
    // tamano depende del total acumulado (+1 habitacion cada 500 likes), asi que
    // crece de una en una y la funcion no hace nada si ya esta en su tamano.
    // Se pasa el total YA actualizado: stateRef todavia tiene el viejo.
    expandirHabitacion(target.id, (target.likes || 0) + likesDelEvento);
  }, [addNotification, expandirHabitacion, lanzarPoder]);

  const simulateUserLikes = useCallback((username?: string, count = 25) => {
    const uname = username || `@liker_${Math.floor(Math.random() * 900 + 100)}`;
    addNotification({
      type: 'join',
      icon: '❤️',
      text: `${uname} envió ${count} Likes!`,
    });
    joinViewer(uname);
    // Los likes tambien recargan energia: es lo que hace que un residente que
    // se ha quedado sin fuerzas vuelva a moverse sin esperar a un regalo.
    rechargeWithLikes(uname, count);
  }, [addNotification, joinViewer, rechargeWithLikes]);

  const simulateUserFollow = useCallback((username?: string) => {
    const uname = username || `@seguidor_${Math.floor(Math.random() * 900 + 100)}`;
    addNotification({
      type: 'join',
      icon: '⭐',
      text: `¡${uname} comenzó a seguir el canal!`,
    });
    joinViewer(uname);
  }, [addNotification, joinViewer]);

  const setWeather = useCallback((newWeather: WeatherType) => {
    setState((prev) => ({
      ...prev,
      weather: newWeather,
    }));
    addNotification({
      type: 'event',
      icon:
        newWeather === 'LLUVIA'
          ? '🌧️'
          : newWeather === 'TORMENTA'
          ? '⛈️'
          : newWeather === 'NIEVE'
          ? '❄️'
          : newWeather === 'NIEBLA'
          ? '🌫️'
          : newWeather === 'ESTRELLAS'
          ? '🌠'
          : '☀️',
      text: `Clima cambiado a ${newWeather}`,
    });
  }, [addNotification]);

  // Cross-Tab Broadcast Synchronization from Admin Window or Webhook
  useEffect(() => {
    const unsubscribe = hotelBroadcast.subscribe((msg) => {
      switch (msg.type) {
        case 'JOIN_VIEWER':
          joinViewer(msg.payload.username, msg.payload.personality, msg.payload.avatar);
          break;
        case 'SEND_COMMENT':
          sendComment(msg.payload.username, msg.payload.comment);
          break;
        case 'SEND_GIFT':
          sendGift(msg.payload.giftId, msg.payload.username);
          break;
        case 'TRIGGER_EVENT':
          triggerEvent(msg.payload.eventType);
          break;
        case 'SET_TIME':
          setTimeOfDay(msg.payload.timeOfDay);
          break;
        case 'SET_WEATHER':
          setWeather(msg.payload.weather);
          break;
        case 'CREATE_FLOOR':
          createNextFloor();
          break;
        case 'DESTROY_FLOOR':
          destroyUpperFloor(msg.payload.floorNumber);
          break;
        case 'EVICT_RESIDENT':
          evictResident(msg.payload.residentId);
          break;
        case 'BOOST_STABILITY':
          boostStability(msg.payload.residentId, msg.payload.amount);
          break;
        case 'RESET_LIVE':
          resetLiveSession(msg.payload.mode);
          break;
        case 'UPDATE_RULES':
          updateEntryRules(msg.payload.rules);
          break;
        case 'SYNC_STATE':
          if (msg.payload?.state) {
            setState(msg.payload.state);
          }
          break;
        case 'TIKTOK_EVENT': {
          // BUG (2026-10-04): la entrada a un comentario que contenga 'entrar' o
          // 'hotel', fijo y escrito aqui. Los rules del panel de admin
          // (entryMode, keyword, likes, regalos) se ignoraban por completo, asi
          // que en un live real NUNCA entraba nadie: los espectadores escriben
          // cualquier cosa y casi ninguno decia esas dos palabras. De ahi el
          // 'no entra ningun usuario' con la conexion perfectamente sana.
          //
          // Ahora se respeta la configuracion del hotel.
          const p = msg.payload as any;
          const uname = p.username;
          const comment = (p.comment || '').toString();

          if (p.eventType === 'comment') {
            const rules = stateRef.current.entryRules;
            const keyword = (rules?.keyword || '').toString().toLowerCase().trim();
            const matchesKeyword = keyword
              ? comment.toLowerCase().includes(keyword)
              : false;

            let shouldEnter = true;
            switch (rules?.entryMode) {
              case 'KEYWORD_ONLY':
                shouldEnter = matchesKeyword;
                break;
              case 'SHARE_LIVE':
              case 'LIKE_COUNT':
              case 'GIFT_ONLY':
              case 'FOLLOWER_ONLY':
                // Estos los dispara el propio evento correspondiente, no un
                // comentario suelto: aqui solo se muestra el comentario.
                shouldEnter = false;
                break;
              case 'ANY_COMMENT':
              default:
                // Cualquier comentario hace entrar. La palabra clave NO se exige
                // aqui: en ANY_COMMENT el hotel abre a todo el que habla, que es
                // lo que un streamer quiere para llenar el hotel. Si lo que quiere
                // es exigirla, debe elegir KEYWORD_ONLY en el panel de admin.
                shouldEnter = true;
                break;
            }

            if (shouldEnter) {
              browserReport.info('entrada', `usuario entra: ${uname}`, {
                modo: rules?.entryMode,
                comentario: comment.slice(0, 60),
              });
              // BUG: aqui solo se llamaba a joinViewer() y el comentario se
              // perdia. En ANY_COMMENT (el modo por defecto) TODO comentario
              // hace entrar, asi que esta rama se comia el 100% de los
              // mensajes y NUNCA aparecia ningun globo sobre ningun personaje.
              // sendComment() guarda el texto: si el autor aun no es residente
              // lo deja pendiente y lo pinta en cuanto su personaje aparece.
              sendComment(uname, comment);
              joinViewer(uname);
            } else {
              browserReport.info('entrada', `comentario sin entrada: ${uname}`, {
                modo: rules?.entryMode,
                motivo: rules?.entryMode === 'KEYWORD_ONLY' ? 'falta palabra clave' : 'modo sin entrada por comentario',
              });
              sendComment(uname, comment);
            }
          } else if (p.eventType === 'gift') {
            sendGift(p.giftId || 'gift_rose', p.username);
          } else if (p.eventType === 'join') {
            // Entrada al room de TikTok (`member`).
            //
            // NO se encola: es el evento mas masivo del live (cientos, repetido
            // por usuario) y meterlos a todos es lo que hacia crecer la fila muy
            // por encima de los espectadores reales. Se registra como
            // notificacion para que el streamer vea que llega gente.
            if (uname) {
              addNotification({
                type: 'join',
                icon: '👋',
                text: `${uname} entró al LIVE`,
              });
            }
          } else if (p.eventType === 'share') {
            // Compartir el live SI es una de las formas de entrar.
            const rules = stateRef.current.entryRules;
            if (rules?.entryMode === 'ANY_COMMENT' || rules?.entryMode === 'SHARE_LIVE') {
              joinViewer(uname);
            } else {
              simulateUserShare(uname);
            }
          } else if (p.eventType === 'like') {
            const rules = stateRef.current.entryRules;
            if (rules?.entryMode === 'LIKE_COUNT') {
              joinViewer(uname);
            } else {
              simulateUserLikes(uname, p.likeCount || 20);
            }
          } else if (p.eventType === 'follow') {
            const rules = stateRef.current.entryRules;
            if (rules?.entryMode === 'FOLLOWER_ONLY' || rules?.entryMode === 'ANY_COMMENT') {
              joinViewer(uname);
            } else {
              simulateUserFollow(uname);
            }
          }
          break;
        }
      }
    });

    return () => unsubscribe();
  }, [
    joinViewer,
    sendComment,
    sendGift,
    triggerEvent,
    setTimeOfDay,
    setWeather,
    createNextFloor,
    destroyUpperFloor,
    evictResident,
    boostStability,
    resetLiveSession,
    updateEntryRules,
    simulateUserShare,
    simulateUserLikes,
    simulateUserFollow,
  ]);

  return (
    <HotelContext.Provider
      value={{
        state,
        joinViewer,
        sendComment,
        sendGift,
        triggerEvent,
        setTimeOfDay,
        setWeather,
        advanceTime,
        createNextFloor,
        destroyUpperFloor,
        evictResident,
        finalizeEviction,
        upgradeResidentRoom,
        promoteToVip,
        boostStability,
        resetLiveSession,
        toggleAutoSimulation,
        isAutoSimulating,
        activeFloorNumber,
        setActiveFloorNumber,
        showSafeZoneGuides,
        setShowSafeZoneGuides,
        isAudioMuted,
        setIsAudioMuted,
        isSpeechMuted,
        setIsSpeechMuted,
        setCameraFocus,
        resetCamera,
        updateEntryRules,
        simulateUserShare,
        simulateUserLikes,
        simulateUserFollow,
        finalizePowerCast,
      }}
    >
      {children}
    </HotelContext.Provider>
  );
};

export const useHotel = () => {
  const context = useContext(HotelContext);
  if (!context) {
    throw new Error('useHotel must be used within a HotelProvider');
  }
  return context;
};
