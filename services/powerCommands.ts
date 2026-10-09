import type { SuperpowerId } from '../types/hotel';

/**
 * Comandos de chat para lanzar cada poder.
 *
 * Vive en su propio modulo (no en `HotelContext`) a proposito: tanto el contexto
 * como el banner de comandos necesitan esta lista, y si el banner importara del
 * contexto se crearia un ciclo (contexto -> componentes -> contexto).
 *
 * Un residente que ya desbloqueo el poder lo lanza escribiendo su comando; el
 * poder viaja con su animacion hasta otro residente al azar.
 */
export const COMANDOS_PODER: {
  cmd: string;
  power: SuperpowerId;
  nombre: string;
  icono: string;
  likes: number;
}[] = [
  { cmd: '!regen', power: 'regen', nombre: 'Regeneración', icono: '💚', likes: 100 },
  { cmd: '!escudo', power: 'escudo', nombre: 'Escudo', icono: '🛡️', likes: 200 },
  { cmd: '!iman', power: 'imán', nombre: 'Imán de Regalos', icono: '🧲', likes: 300 },
  { cmd: '!aura', power: 'aura', nombre: 'Aura', icono: '✨', likes: 400 },
  { cmd: '!suite', power: 'habitacion_doble', nombre: 'Habitación Doble', icono: '🏰', likes: 500 },
];
