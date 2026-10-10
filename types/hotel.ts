export type TimeOfDay = 'day' | 'evening' | 'night';

export type PersonalityType =
  | 'tranquilo'
  | 'fiestero'
  | 'gamer'
  | 'deportista'
  | 'gracioso'
  | 'tímido'
  | 'artista'
  | 'trabajador'
  | 'elegante'
  | 'loco';

export type RoomLevel = 'NORMAL' | 'MEJORADA' | 'PREMIUM' | 'VIP';

export type RoomStatus = 'VACIA' | 'RESERVADA' | 'OCUPADA' | 'VIP' | 'ABANDONADA';

/**
 * Superpoderes que se ganan acumulando likes (uno cada 100).
 *
 * Se asignan en orden: a los 100 likes el primero, a los 200 el segundo, etc.
 * Son acumulativos y no se pierden mientras el residente siga dentro.
 */
export type SuperpowerId =
  | 'regen'        // 100 likes: regenera estadía sola
  | 'escudo'       // 200: los likes valen el doble
  | 'imán'         // 300: atrae regalos
  | 'aura'         // 400: contagia estabilidad a los vecinos
  | 'habitacion_doble'; // 500: ocupa DOS habitaciones y echa al vecino

export interface SuperpowerDefinition {
  id: SuperpowerId;
  /** Likes necesarios para desbloquearlo. */
  likesRequired: number;
  name: string;
  icon: string;
  description: string;
  /** Color del rayo de energia al lanzarse sobre otro residente. */
  beamColor: string;
}

/**
 * Un poder lanzado sobre otro residente.
 *
 * Se usa para dibujar la animacion: el rayo sale del `from` (quien lo gano) y
 * viaja hasta el `to` (a quien le toco). Ambos son ids de residente, asi que el
 * render mide sus posiciones reales en el DOM.
 */
export interface PowerCast {
  id: string;
  power: SuperpowerId;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  /** Momento del lanzamiento; el overlay lo usa para limpiarse solo. */
  startedAt: number;
  /** Duracion de la animacion en ms. */
  durationMs: number;
}

/**
 * Escalado de recompensas de estadía. Cada accion suma SEGUNDOS a la estadía
 * del residente (solo si el hotel usa tiempo limitado).
 */
export const STAY_REWARDS = {
  /** Segundos por like. */
  likeSeconds: 0.3,
  /** Segundos por regalo (crece con el nivel del regalo). */
  giftSecondsBase: 1,
  /** Segundos por compartir el live. */
  shareSeconds: 0.5,
} as const;

export type ActionType =
  | 'idle'
  | 'walking'
  | 'sleeping'
  | 'gaming'
  | 'watching_tv'
  | 'dancing'
  | 'knocking_door'
  | 'angry'
  | 'prank'
  | 'celebrating'
  | 'visiting_reception'
  | 'worried'
  | 'entering_hotel'
  | 'leaving_hotel';

export interface ResidentAvatar {
  skinColor: string;
  hairStyle: 'spiky' | 'curly' | 'sleek' | 'bob' | 'afro' | 'ponytail' | 'cap' | 'headphones';
  hairColor: string;
  outfitStyle: 'casual' | 'gamer' | 'suit' | 'sport' | 'hoodie' | 'party';
  outfitColor: string;
  accessory?: 'glasses' | 'sunglasses' | 'headset' | 'crown' | 'party_hat' | 'flower' | 'none';
  eyeType: 'normal' | 'happy' | 'sleepy' | 'surprised' | 'cool';
}

export interface SpeechBubble {
  id: string;
  text: string;
  timestamp: number;
  durationMs: number;
}

export interface Resident {
  id: string;
  username: string;
  displayName: string;
  avatar: ResidentAvatar;
  personality: PersonalityType;
  roomId: string;
  floorNumber: number;
  energy: number; // 0 - 100
  stability: number; // 0 - 100 (decays over time)
  popularity: number;
  points: number;
  vipLevel: number; // 0: standard, 1, 2, 3
  currentAction: ActionType;
  actionTimer?: number;
  targetRoomId?: string; // e.g. for knocking neighbor
  speechBubble?: SpeechBubble | null;
  /**
   * Likes que este usuario ha dado al live desde que esta en el hotel.
   * Se muestra como contador dentro de su habitacion y vuelve a 0 al irse.
   */
  likes: number;
  /**
   * Superpoderes ganados por acumular likes. Se otorga uno cada 100 likes.
   */
  superpowers?: SuperpowerId[];
  /**
   * Estadía restante en SEGUNDOS (no en % de estabilidad).
   *
   * Antes el tiempo de vida solo existia como `stability` 100->0, asi que
   * "sumar 0.3s por un like" era imposible de expresar: habia que convertir
   * segundos a puntos de estabilidad con una regla de tres que dependia del
   * total configurado. Con el tiempo explicito, cada recompensa suma segundos
   * directamente y la barra de estabilidad se DERIVA de el.
   *
   * Solo tiene sentido cuando `residentStaySeconds > 0` (0 = permanente).
   * `null` = hotel permanente (sin reloj).
   */
  stayRemainingSec?: number | null;
  /** Total con el que entro, para calcular el porcentaje de la barra. */
  stayTotalSec?: number;
  /**
   * Habitaciones que ocupa por el superpoder de expansion, ademas de la suya.
   *
   * El residente puede absorber las contiguas hasta juntar las 4 del piso
   * (un piso entero). Se guarda la lista completa de ids para poder liberarlas
   * todas al irse.
   */
  expandedRoomIds?: string[];
  /**
   * Su habitacion PRINCIPAL ocupa varias columnas en la fila del piso.
   * Es lo que hace que se dibuje como un solo bloque ancho en vez de varias
   * habitaciones separadas. 1 = tamano normal.
   */
  roomSpan?: number;
  // Position within floor/room coordinates
  location: 'room' | 'corridor' | 'elevator' | 'reception' | 'penthouse';
  coordX: number; // 0 to 100% relative within location
  direction: 'left' | 'right';
  isEntering?: boolean;
  isLeaving?: boolean;
  /**
   * Desalojo en curso: el personaje sigue en el mapa (y en su habitacion)
   * mientras dura la animacion de caida. Al terminar se borra del todo.
   * `startedAt` permite que la animacion arranque una sola vez.
   */
  evicting?: { startedAt: number } | null;
  /**
   * Impacto de un poder recien recibido: el personaje y su habitacion tiemblan.
   *
   * Se guarda la marca de tiempo para poder expirar la animacion por si sola
   * (no hace falta un temporizador que la borre). `at` es `Date.now()`.
   */
  powerHit?: { power: SuperpowerId; at: number } | null;
}

export interface Room {
  id: string;
  number: number;
  floorNumber: number;
  row: 'top' | 'bottom' | 'penthouse';
  colIndex: number; // 0 to 4
  status: RoomStatus;
  occupantId: string | null;
  level: RoomLevel;
  decorLevel: number; // 1 to 5
  stability: number;
  points: number;
  lightOn: boolean;
  lastInteractionAt: number;
  /**
   * Id del residente que ABSORBIO esta habitacion con el superpoder de suite.
   *
   * Vive en la habitacion (no en el residente) a proposito: es la marca de que
   * esta habitacion forma parte del bloque ancho de otro. Asi el render la
   * oculta aunque su `occupantId` se haya limpiado, que es justo lo que hacia
   * que reapareciera como una habitacion suelta en una fila nueva del piso.
   */
  absorbedBy?: string | null;
}

export interface Floor {
  id: string;
  floorNumber: number;
  name: string;
  rooms: string[]; // room IDs
  status: 'active' | 'destroying' | 'creating';
  isDestroyable: boolean;
}

export type GlobalEventType =
  | 'NONE'
  | 'FIESTA'
  | 'APAGON'
  | 'INCENDIO'
  | 'RATAS'
  | 'TORMENTA'
  | 'FUEGOS'
  | 'OVNI';

export interface GlobalEventState {
  type: GlobalEventType;
  title: string;
  message: string;
  durationMs: number;
  startedAt: number;
}

export interface GiftDefinition {
  id: string;
  name: string;
  icon: string;
  tier: 'small' | 'medium' | 'large' | 'vip';
  costCoins: number;
  effectDescription: string;
  stabilityBoost: number;
  energyBoost: number;
  pointsBoost: number;
  upgradesRoom: boolean;
  makesVip: boolean;
  triggersEvent?: GlobalEventType;
}

export interface CameraState {
  targetType: 'GENERAL' | 'ELEVATOR' | 'ROOM' | 'RECEPTION' | 'PENTHOUSE' | 'TOUR';
  targetFloor: number;
  targetRoomNumber?: number;
  zoom: number; // 1.0 is full view, 1.6 is focused
  priority: number; // 1: huge gift, 2: event, 3: entry, 4: normal
  lockUntil: number;
}

export interface LiveNotification {
  id: string;
  type: 'join' | 'leave' | 'gift' | 'upgrade' | 'vip' | 'event' | 'alert';
  icon: string;
  text: string;
  timestamp: number;
}

export type WeatherType = 'SOL' | 'LLUVIA' | 'TORMENTA' | 'NIEVE' | 'NIEBLA' | 'ESTRELLAS';

export interface EntryRulesConfig {
  entryMode: 'ANY_COMMENT' | 'KEYWORD_ONLY' | 'SHARE_LIVE' | 'LIKE_COUNT' | 'GIFT_ONLY' | 'FOLLOWER_ONLY';
  keyword: string; // e.g. '!entrar' or 'hotel'
  likesRequired: number; // e.g. 20 likes
  sharesRequired: number; // e.g. 1 share
  requireFollow: boolean;
  minGiftCoins: number; // 0 for any gift
  autoApprove: boolean;
  welcomeMessage: string;
  residentStaySeconds: number; // 0 for infinite/permanent, or any custom seconds (e.g. 30, 60, 120, 300)
  /** Superpoderes por likes: activado por defecto. */
  superpowersEnabled?: boolean;
}

/**
 * Los cinco superpoderes, en orden de desbloqueo.
 * El de 500 es el mas visible: expande la habitacion a dos.
 */
export const SUPERPOWERS: SuperpowerDefinition[] = [
  {
    id: 'regen',
    likesRequired: 100,
    name: 'Regeneración',
    icon: '💚',
    description: 'Su estadía se recupera sola con el tiempo',
    beamColor: '#22C55E',
  },
  {
    id: 'escudo',
    likesRequired: 200,
    name: 'Escudo',
    icon: '🛡️',
    description: 'Sus likes valen el doble de estadía',
    beamColor: '#3B82F6',
  },
  {
    id: 'imán',
    likesRequired: 300,
    name: 'Imán de Regalos',
    icon: '🧲',
    description: 'Atrae regalos: cada regalo suma el triple',
    beamColor: '#A855F7',
  },
  {
    id: 'aura',
    likesRequired: 400,
    name: 'Aura',
    icon: '✨',
    description: 'Contagia estadía a los vecinos de su piso',
    beamColor: '#FACC15',
  },
  {
    id: 'habitacion_doble',
    likesRequired: 500,
    name: 'Habitación Doble',
    icon: '🏰',
    description: '+1 habitación cada 500 likes (máx. 4 = piso entero)',
    beamColor: '#F59E0B',
  },
];

export interface QueueResident {
  id: string;
  username: string;
  displayName: string;
  personality: PersonalityType;
  avatar: ResidentAvatar;
}

export interface ReceptionAttendingState {
  residentId: string;
  username: string;
  displayName: string;
  assignedRoomNumber: number;
  assignedFloor: number;
  step: 'at_desk' | 'walking_to_elevator' | 'in_elevator';
  dialogueText: string;
  avatar: ResidentAvatar;
  personality?: PersonalityType;
}

export interface DemolitionState {
  isDemolishing: boolean;
  demolishingFloorNumber: number | null;
  phase: 'cracks_and_flicker' | 'exploding_bricks' | 'upper_floors_falling' | 'none';
  affectedUpperFloors: number[];
}

export interface HotelState {
  floors: Floor[];
  rooms: Record<string, Room>;
  residents: Record<string, Resident>;
  entryQueue: QueueResident[];
  receptionAttending: ReceptionAttendingState | null;
  demolitionState: DemolitionState;
  vipPenthouseResidents: string[]; // resident IDs
  timeOfDay: TimeOfDay;
  weather: WeatherType;
  timeHour: number; // 0 - 24
  globalEvent: GlobalEventState;
  camera: CameraState;
  activeFloorView: number; // 1, 2, etc. (which floor is currently centered)
  liveActive: boolean;
  entryRules: EntryRulesConfig;
  stats: {
    totalResidentsJoined: number;
    totalGiftsReceived: number;
    totalComments: number;
    peakResidents: number;
  };
  notifications: LiveNotification[];
  /**
   * Poderes en vuelo (animacion de origen -> destino). Se limpian solos al
   * expirar; el overlay los dibuja entre residentes.
   */
  powerCasts: PowerCast[];
}
