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
} from '../types/hotel';
import { createInitialHotel, createFloorRooms } from '../services/hotelService';
import { generateRandomAvatar } from '../services/avatarGenerator';
import { audioEngine } from '../services/audioEngine';
import { mockTikTokProvider, DEFAULT_GIFT_RULES, TikTokCommentEvent, TikTokGiftEvent, TikTokJoinEvent } from '../services/tiktokProvider';
import { hotelBroadcast } from '../services/broadcastSync';

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
}

const HotelContext = createContext<HotelContextValue | null>(null);

const HOTEL_STORAGE_KEY = 'tiktok_hotel_active_state_v2';

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
        residentStaySeconds: 0, // 0 = Permanente (no desaparecen)
      },
      stats: {
        totalResidentsJoined: 0,
        totalGiftsReceived: 0,
        totalComments: 0,
        peakResidents: 0,
      },
      notifications: [],
    };
  });

  const stateRef = useRef(state);
  const isHydratedRef = useRef(false);
  const lastProgressTimestampRef = useRef<number>(0);

  // Client-side mount: restore persistent hotel state from localStorage after hydration asynchronously
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = localStorage.getItem(HOTEL_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && Array.isArray(parsed.floors) && parsed.floors.length > 0 && parsed.rooms) {
            const restored = {
              ...parsed,
              weather: parsed.weather || 'SOL',
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
                ...parsed.entryRules,
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
              ...parsed,
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

  // Global Event Triggers (Declared early so sendGift and others can access it)
  const triggerEvent = useCallback((eventType: GlobalEventType) => {
    if (eventType === 'NONE') {
      if (stateRef.current.globalEvent.type === 'FIESTA') {
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
        if (prev.globalEvent.type === eventType) {
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
      speechBubble: null,
    };

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

    setCameraFocus('ELEVATOR', assignedFloor, targetRoom.number, 3, Math.round(2800 * speed));
    audioEngine.playElevatorChime();

    await new Promise((r) => setTimeout(r, Math.round(800 * speed)));

    // PASO 5: Sale del ascensor en el piso asignado y camina por el pasillo
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
            location: 'corridor',
            coordX: 50,
            currentAction: 'walking',
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

    // Volver a la vista general completa
    resetCamera();
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
      const isStuck =
        state.entryQueue.length > 0 &&
        isProcessingEntryRef.current &&
        Date.now() - lastProgressTimestampRef.current > 9000;

      if (isStuck) {
        // True stall detected (over 9s with zero progress)
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
      const alreadyResident = Object.values(prev.residents).some((r) => r.username.toLowerCase() === uname.toLowerCase());
      const alreadyInQueue = prev.entryQueue.some((q) => q.username.toLowerCase() === uname.toLowerCase());
      if (alreadyResident || alreadyInQueue) {
        return prev;
      }

      return {
        ...prev,
        entryQueue: [...prev.entryQueue, queueResident],
      };
    });
  }, []);

  const sendComment = useCallback((username?: string, comment?: string) => {
    const s = stateRef.current;
    const residentsList = Object.values(s.residents);
    if (residentsList.length === 0) {
      // If hotel is empty, invite user to enter first
      joinViewer(username);
      return;
    }

    // Match resident by username, or pick a random resident if commenter isn't resident yet
    let targetResident: Resident | undefined;
    if (username) {
      const clean = username.replace('@', '').toLowerCase();
      targetResident = residentsList.find((r) => r.username.toLowerCase() === clean);
    }
    if (!targetResident) {
      targetResident = residentsList[Math.floor(Math.random() * residentsList.length)];
    }

    const commentText = comment || '¡Saludos a todos desde el stream! 👋';
    const lower = commentText.toLowerCase();

    // Check if command is !entrar and user not yet inside
    if (lower.includes('!entrar') && username) {
      const clean = username.replace('@', '').toLowerCase();
      const isAlreadyIn = Object.values(s.residents).some((r) => r.username.toLowerCase() === clean);
      if (!isAlreadyIn) {
        joinViewer(username);
        return;
      }
    }

    const bubbleId = `bubble_${Date.now()}`;

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
              durationMs: 3800,
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
    }, 4000);
  }, [joinViewer]);

  const sendGift = useCallback((giftId: string, username?: string) => {
    const gift = DEFAULT_GIFT_RULES.find((g) => g.id === giftId) || DEFAULT_GIFT_RULES[0];
    const s = stateRef.current;
    const residentsList = Object.values(s.residents);

    let targetResident: Resident | undefined;
    if (username) {
      const clean = username.replace('@', '').toLowerCase();
      targetResident = residentsList.find((r) => r.username.toLowerCase() === clean);
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
            stability: Math.min(100, res.stability + gift.stabilityBoost),
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

  // Evict resident
  const evictResident = useCallback((residentId: string) => {
    const s = stateRef.current;
    const res = s.residents[residentId];
    if (!res) return;

    audioEngine.playEvict();

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
            location: 'corridor',
            direction: 'right',
          },
        },
      };
    });

    addNotification({
      type: 'leave',
      icon: '🚪',
      text: `${res.displayName} abandonó la habitación ${s.rooms[res.roomId]?.number || ''}`,
    });

    // Remove from residents map after walking animation
    setTimeout(() => {
      setState((prev) => {
        const updatedResidents = { ...prev.residents };
        delete updatedResidents[residentId];
        const updatedVip = prev.vipPenthouseResidents.filter((id) => id !== residentId);

        return {
          ...prev,
          residents: updatedResidents,
          vipPenthouseResidents: updatedVip,
        };
      });

      // If an upper floor is now empty, destroy it!
      setTimeout(() => {
        checkUpperFloorsEmptyStatus();
      }, 500);
    }, 2000);
  }, [addNotification, checkUpperFloorsEmptyStatus]);

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
        (r) => r.username.toLowerCase() === ev.user.uniqueId.toLowerCase()
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
    const interval = setInterval(() => {
      const s = stateRef.current;
      const residentsList = Object.values(s.residents);
      if (residentsList.length === 0) return;

      const updatedResidents = { ...s.residents };
      const toEvict: string[] = [];

      residentsList.forEach((res) => {
        // Stability decay: based on configurable residentStaySeconds (0 = Permanent / Infinite)
        const staySecs = s.entryRules?.residentStaySeconds ?? 0;
        let newStability = res.stability;
        if (staySecs > 0) {
          const decayPerTick = 100 / (staySecs / 3.5);
          newStability = Math.max(0, res.stability - decayPerTick);
          if (newStability <= 0) {
            toEvict.push(res.id);
            return;
          }
        }

        // Random actions based on personality & event
        let nextAction = res.currentAction;
        let coordX = res.coordX;
        let direction = res.direction;

        // If in global event, participate
        if (s.globalEvent.type === 'FIESTA') {
          nextAction = 'dancing';
        } else if (s.globalEvent.type === 'APAGON') {
          nextAction = 'worried';
        } else if (s.globalEvent.type === 'INCENDIO') {
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
          currentAction: nextAction,
          coordX,
          direction,
        };
      });

      setState((prev) => ({
        ...prev,
        residents: updatedResidents,
      }));

      // Evict residents with 0 stability
      toEvict.forEach((id) => {
        evictResident(id);
      });
    }, 3500);

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

  const simulateUserShare = useCallback((username?: string) => {
    const uname = username || `@compartidor_${Math.floor(Math.random() * 900 + 100)}`;
    addNotification({
      type: 'join',
      icon: '🔁',
      text: `${uname} compartió el LIVE!`,
    });
    joinViewer(uname);
  }, [addNotification, joinViewer]);

  const simulateUserLikes = useCallback((username?: string, count = 25) => {
    const uname = username || `@liker_${Math.floor(Math.random() * 900 + 100)}`;
    addNotification({
      type: 'join',
      icon: '❤️',
      text: `${uname} envió ${count} Likes!`,
    });
    joinViewer(uname);
  }, [addNotification, joinViewer]);

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
        case 'TIKTOK_EVENT':
          if (msg.payload.eventType === 'comment') {
            const comment = msg.payload.comment || '';
            const uname = msg.payload.username;
            const isEntryKeyword = comment.toLowerCase().includes('entrar') || comment.toLowerCase().includes('hotel');
            if (isEntryKeyword) {
              joinViewer(uname);
            } else {
              sendComment(uname, comment);
            }
          } else if (msg.payload.eventType === 'gift') {
            sendGift(msg.payload.giftId || 'gift_rose', msg.payload.username);
          } else if (msg.payload.eventType === 'share') {
            simulateUserShare(msg.payload.username);
          } else if (msg.payload.eventType === 'like') {
            simulateUserLikes(msg.payload.username, msg.payload.likeCount || 20);
          } else if (msg.payload.eventType === 'follow') {
            simulateUserFollow(msg.payload.username);
          }
          break;
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
