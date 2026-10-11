/**
 * Estado canonico del hotel, compartido por TODAS las pantallas y dispositivos.
 *
 * Vive en el servidor (`globalThis`) porque es lo unico que ven todos los
 * navegadores: `localStorage` y `BroadcastChannel` solo alcanzan al MISMO
 * navegador, asi que cada dispositivo tenia su propio hotel y divergian (el
 * sintoma de "abro el movil y veo otra cosa").
 *
 * Modelo de PROPIETARIO ("owner"): solo un cliente aplica los eventos del live y
 * escribe el estado; los demas lo adoptan. Sin esto, cada pestana aplicaria los
 * MISMOS eventos de TikTok por su cuenta (cada una con sus propios aleatorios y
 * temporizadores) y volverian a divergir en segundos.
 *
 * El propietario se elige por latido: el primero que reclama lo tiene mientras
 * siga vivo; si deja de latir (pestana cerrada, movil bloqueado), cualquiera
 * puede reclamarlo. Asi nunca se queda un hotel congelado sin dueno.
 *
 * Igual que el bridge de TikTok, todo vive en `globalThis`: las rutas de Next
 * recargan su modulo en cada peticion y una variable de modulo se perderia.
 */

/** Si el dueno no late en este tiempo, el puesto queda libre. */
export const OWNER_TTL_MS = 10_000;

/** Cuanto tiempo se recuerda a una pantalla para contarla como conectada. */
export const CLIENT_TTL_MS = 15_000;

export interface HotelSyncStore {
  /** Sube con CADA cambio aceptado. Es el cursor que usan los clientes. */
  revision: number;
  /** Ultimo estado publicado. `null` = nadie ha publicado todavia. */
  state: any | null;
  /**
   * Revision en la que se publico el estado. Separada de `revision` para poder
   * avanzar el cursor con los cambios de propiedad sin reenviar el estado
   * entero en cada latido.
   */
  stateRevision: number;
  /** Cliente que manda ahora mismo (aplica eventos y publica). */
  ownerId: string | null;
  /** Ultimo latido del dueno, para detectar que se ha ido. */
  ownerHeartbeat: number;
  updatedAt: number;
  /** Pantallas vistas hace poco: clientId -> ultima vez visto. */
  clients: Record<string, number>;
}

function crearStore(): HotelSyncStore {
  return {
    revision: 0,
    state: null,
    stateRevision: 0,
    ownerId: null,
    ownerHeartbeat: 0,
    updatedAt: 0,
    clients: {},
  };
}

const g = globalThis as unknown as { __hotelSyncStore?: HotelSyncStore };

if (!g.__hotelSyncStore) {
  g.__hotelSyncStore = crearStore();
}

export function getStore(): HotelSyncStore {
  // Si el proceso se recicla y el objeto queda a medias, se reconstruye.
  if (!g.__hotelSyncStore || typeof g.__hotelSyncStore.revision !== 'number') {
    g.__hotelSyncStore = crearStore();
  }
  return g.__hotelSyncStore;
}

/** El dueno actual sigue vivo (ha latido hace poco)? */
export function isOwnerAlive(s: HotelSyncStore): boolean {
  return !!s.ownerId && Date.now() - s.ownerHeartbeat < OWNER_TTL_MS;
}

/** Olvida las pantallas que llevan rato sin dar senal. */
export function pruneClients(s: HotelSyncStore): void {
  const limite = Date.now() - CLIENT_TTL_MS;
  for (const [id, visto] of Object.entries(s.clients)) {
    if (visto < limite) delete s.clients[id];
  }
}

/** Cuantas pantallas estan viendo el hotel ahora mismo. */
export function countClients(s: HotelSyncStore): number {
  return Object.keys(s.clients).length;
}
