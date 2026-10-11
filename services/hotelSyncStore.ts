/**
 * Estado canonico del hotel, compartido por todas las pantallas.
 *
 * Vive en el servidor (`globalThis`) porque es lo unico que ven todos los
 * navegadores: `localStorage` y `BroadcastChannel` solo alcanzan al MISMO
 * navegador.
 *
 * MODELO: una sola fuente de verdad, sin hoteles paralelos.
 *
 *   - `state`: el hotel. Lo escribe UNA pantalla (la del live). Las demas LEEN
 *     ese mismo estado. No hay un hotel por pantalla, ni un hotel en el panel.
 *   - `writerId`: que pantalla es la que escribe. Es un dato de coordinacion
 *     interno (algo tiene que decidir quien aplica los eventos del live y corre
 *     el reloj; si lo hicieran todas, un espectador entraria una vez por
 *     pestana). NO se muestra como "maestro/espejo" en la interfaz.
 *   - `orders`: cambios que pide el panel de administracion (reglas, clima,
 *     eventos, demoler...). Se encolan, la pantalla del hotel los aplica sobre
 *     el estado real, y se borran.
 *
 * POR QUE ASI
 *
 * Antes cada pantalla publicaba su hotel ENTERO y peleaba por ser el dueno. Como
 * el panel de admin montaba tambien un hotel completo (con sus reglas por
 * defecto), habia dos escritores reescribiendo el mismo campo con su version: el
 * "pongo 10 y cambia solo entre 30 y 10" era eso, dos hoteles peleando.
 *
 * Ahora el panel no tiene hotel propio: lee el estado del servidor y solo manda
 * ordenes. Un escritor, cero peleas.
 *
 * Igual que el bridge de TikTok, todo vive en `globalThis`: las rutas de Next
 * recargan su modulo en cada peticion y una variable de modulo se perderia.
 */

/** Cuanto tiempo se recuerda a una pantalla para contarla como conectada. */
export const CLIENT_TTL_MS = 15_000;

/**
 * Si el escritor no da senal en este tiempo, el puesto queda libre.
 *
 * Es lo que evita que el hotel se quede congelado si la pestana que escribia se
 * cierra o el movil se bloquea. Se renueva en cada poll (1.2s), asi que el
 * margen es amplio a proposito.
 */
export const WRITER_TTL_MS = 10_000;

/** Una orden de administracion pendiente de aplicar. */
export interface HotelOrder {
  id: string;
  type: string;
  payload: any;
  at: number;
}

export interface HotelSyncStore {
  /** Sube con CADA cambio del estado. Es el cursor que usan los clientes. */
  revision: number;
  /** El hotel. `null` = nadie ha publicado todavia. */
  state: any | null;
  /** Ordenes de administracion sin aplicar. */
  orders: HotelOrder[];
  /** Pantalla que escribe el hotel. `null` = ninguna. */
  writerId: string | null;
  /** Ultima senal del escritor, para detectar que se ha ido. */
  writerSeenAt: number;
  updatedAt: number;
  /** Pantallas vistas hace poco: clientId -> ultima vez visto. */
  clients: Record<string, number>;
}

function crearStore(): HotelSyncStore {
  return {
    revision: 0,
    state: null,
    orders: [],
    writerId: null,
    writerSeenAt: 0,
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
  if (
    !g.__hotelSyncStore ||
    typeof g.__hotelSyncStore.revision !== 'number' ||
    !Array.isArray(g.__hotelSyncStore.orders)
  ) {
    g.__hotelSyncStore = crearStore();
  }
  return g.__hotelSyncStore;
}

/** El escritor actual sigue vivo (ha dado senal hace poco)? */
export function isWriterAlive(s: HotelSyncStore): boolean {
  return !!s.writerId && Date.now() - s.writerSeenAt < WRITER_TTL_MS;
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
