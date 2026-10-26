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
 * Se normaliza al CARGAR, que es donde esta la causa: asi cualquier campo que
 * se anada en el futuro no puede reventar el arranque por venir ausente.
 *
 * Vive aparte de HotelContext porque es logica pura (entradas -> salida, sin
 * React): asi se puede probar con `node --test`.
 */

/**
 * Numero finito o defecto.
 *
 * Sustituye a `Number.isFinite(Number(x)) ? Number(x) : d`, que aparecia 11
 * veces. OJO: `num(null, 0)` es 0 y `num(undefined, 0)` es 0 — `Number(null)`
 * vale 0. Cuando el defecto tenga que ser `null` (hueco real, no cero),
 * comprueba `null`/`undefined` ANTES de llamar a `num`.
 */
export function num(v: unknown, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

/** Debe coincidir con .animate-power-shock y .animate-room-shock de globals.css.
 *  Exportado: HotelContext lo usa tambien para caducar avisos en vida. */
export const POWER_HIT_MS = 1400;

/** Exportado por el mismo motivo: la expiracion de la celebracion vive en
 *  HotelContext y tiene que usar el mismo numero. */
export const GIFT_CELEBRATION_MS = 4000;

const AVATAR_DEFECTO = {
  skinColor: '#F5CBA7',
  hairStyle: 'sleek',
  hairColor: '#2C1810',
  outfitStyle: 'casual',
  outfitColor: '#3498DB',
  accessory: 'none',
  eyeType: 'normal',
};

export function sanitizeRestoredState(parsed: any): any {
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

    // Se replica LITERALMENTE la expresion original (verificada por diferencia
    // contra HotelContext con 32 entradas x 10 campos). Ojo con lo que hace
    // realmente: Number(null) es 0 y 0 es finito, asi que un
    // `stayRemainingSec: null` restaurado acaba como 0, no como null — y null
    // (hotel permanente) con basura (null) se quedan igual de distintos, pero
    // al reves de lo que uno esperaria. Si eso es un bug latente es cuestion
    // aparte; aqui NO se cambia el comportamiento.
    const stayRemainingSec = Number.isFinite(Number(raw.stayRemainingSec))
      ? Number(raw.stayRemainingSec)
      : null;

    residents[id] = {
      ...raw,
      id,
      username,
      displayName,
      // Campos anadidos despues: sin estos, el contador y la animacion de
      // desalojo leen undefined.
      likes: num(raw.likes, 0),
      evicting: raw.evicting ?? null,
      superpowers: Array.isArray(raw.superpowers) ? raw.superpowers : [],
      stayRemainingSec,
      stayTotalSec: num(raw.stayTotalSec, 0),
      expandedRoomIds: Array.isArray(raw.expandedRoomIds) ? raw.expandedRoomIds : [],
      // roomSpan 1 = tamano normal; nunca 0 ni negativo (rompe el grid del piso).
      roomSpan: Math.max(1, num(raw.roomSpan, 1)),
      // El impacto de poder es un aviso momentaneo: no debe sobrevivir a una
      // recarga (el temporizador que lo limpia vive en memoria).
      powerHit:
        raw.powerHit && typeof raw.powerHit === 'object' &&
        Date.now() - (Number(raw.powerHit.at) || 0) < POWER_HIT_MS
          ? raw.powerHit
          : null,
      // Los trofeos SI sobreviven: son el historial de donaciones del residente.
      giftTrophies: Array.isArray(raw.giftTrophies)
        ? raw.giftTrophies.filter(
            (t: any) => t && typeof t === 'object' && typeof t.icon === 'string'
          )
        : [],
      // La marca del watchdog no debe sobrevivir a una recarga: si venia de una
      // sesion anterior, el residente se consideraria atascado al instante.
      enteringSince: 0,
      giftCount: num(raw.giftCount, 0),
      // La celebracion si es momentanea. Equivalente al original: Number(null)=0
      // cae dentro del isFinite pero 0 queda fuera de la ventana, asi que sale
      // null igual.
      giftAt: (() => {
        const t = num(raw.giftAt, NaN);
        return Number.isFinite(t) && Date.now() - t < GIFT_CELEBRATION_MS ? t : null;
      })(),
      energy: num(raw.energy, 80),
      stability: num(raw.stability, 100),
      vipLevel: num(raw.vipLevel, 0),
      coordX: num(raw.coordX, 50),
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
    // `absorbedBy` solo se conserva mientras el residente que absorbio siga en
    // el mapa: es quien dibuja el bloque ancho que la tapa. Si el absorbente ya
    // no esta, se limpia para que la habitacion vuelva a ser normal (si no,
    // quedaria invisible para siempre).
    const absorbenteValido =
      raw.absorbedBy && Object.prototype.hasOwnProperty.call(residents, raw.absorbedBy);
    rooms[id] = {
      ...raw,
      id,
      occupantId: ocupanteValido ? raw.occupantId : null,
      status: ocupanteValido ? raw.status || 'OCUPADA' : 'VACIA',
      absorbedBy: absorbenteValido ? raw.absorbedBy : null,
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
      floorNumber: num(f.floorNumber, 1),
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
