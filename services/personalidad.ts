import type { PersonalityType } from '../types/hotel';

export const PERSONALIDADES: PersonalityType[] = [
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

/**
 * Personalidad para quien entra sin una asignada.
 *
 * Antes era siempre 'gamer': quien entraba comentando en el live (la via mas
 * comun) era gamer, y los gamers solo juegan, bailan o se quedan quietos, asi
 * que nadie paseaba por su habitacion. Se deriva del nombre (hash FNV-1a) para
 * que el mismo usuario tenga siempre la misma personalidad si vuelve a entrar.
 */
export function personalidadPorNombre(username: string): PersonalityType {
  let h = 2166136261;
  const s = (username || '').toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return PERSONALIDADES[(h >>> 0) % PERSONALIDADES.length];
}
