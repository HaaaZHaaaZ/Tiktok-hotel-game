/**
 * Comparador para `React.memo(FloorRenderer)`.
 *
 * Un piso recibe `rooms` y `residents` del hotel ENTERO (los necesita para
 * buscar sus habitaciones y quien esta en su pasillo). Con la comparacion por
 * defecto de `React.memo`, cualquier cambio en cualquier residente cambiaria la
 * referencia de `residents` y repintaria TODOS los pisos. Este comparador mira
 * solo lo que el piso dibuja: sus habitaciones, sus ocupantes y quien esta en
 * su pasillo.
 *
 * Funciona porque el estado se actualiza de forma inmutable: un residente que
 * no cambio conserva su referencia (y `shareUnchanged` lo garantiza tambien con
 * el estado que llega del servidor).
 */

interface RoomLike {
  occupantId?: string | null;
}
interface ResidentLike {
  floorNumber?: number;
}
interface FloorLike {
  floorNumber: number;
  rooms?: string[];
}

export interface FloorPropsLike {
  floor: FloorLike;
  rooms: Record<string, RoomLike>;
  residents: Record<string, ResidentLike>;
  [k: string]: unknown;
}

const PROPS_SIMPLES = [
  'floor',
  'timeOfDay',
  'globalEvent',
  'focusedRoomNumber',
  'isElevatorOpen',
  'demolitionState',
] as const;

/** Residentes que este piso dibuja: los de su piso y los ocupantes de sus habitaciones. */
function residentesDelPiso(p: FloorPropsLike): Set<string> {
  const ids = new Set<string>();
  const n = p.floor.floorNumber;
  for (const [id, r] of Object.entries(p.residents || {})) {
    if (r && r.floorNumber === n) ids.add(id);
  }
  for (const roomId of Array.isArray(p.floor.rooms) ? p.floor.rooms : []) {
    const occ = p.rooms?.[roomId]?.occupantId;
    if (occ) ids.add(occ);
  }
  return ids;
}

export function floorPropsEqual(prev: FloorPropsLike, next: FloorPropsLike): boolean {
  for (const k of PROPS_SIMPLES) {
    if (!Object.is(prev[k], next[k])) return false;
  }

  if (prev.rooms !== next.rooms) {
    for (const roomId of Array.isArray(next.floor.rooms) ? next.floor.rooms : []) {
      if (prev.rooms?.[roomId] !== next.rooms?.[roomId]) return false;
    }
  }

  if (prev.residents !== next.residents) {
    const antes = residentesDelPiso(prev);
    const ahora = residentesDelPiso(next);
    if (antes.size !== ahora.size) return false;
    for (const id of ahora) {
      if (!antes.has(id)) return false;
      if (prev.residents[id] !== next.residents[id]) return false;
    }
  }

  return true;
}
