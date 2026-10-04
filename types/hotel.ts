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
  // Position within floor/room coordinates
  location: 'room' | 'corridor' | 'elevator' | 'reception' | 'penthouse';
  coordX: number; // 0 to 100% relative within location
  direction: 'left' | 'right';
  isEntering?: boolean;
  isLeaving?: boolean;
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
}

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
}
