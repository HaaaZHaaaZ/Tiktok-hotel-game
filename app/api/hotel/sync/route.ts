import { NextRequest, NextResponse } from 'next/server';
import {
  getStore,
  pruneClients,
  countClients,
  isOwnerAlive,
} from '../../../../services/hotelSyncStore';

/**
 * Sincronizacion del hotel entre dispositivos.
 *
 * Todas las pantallas (la del live, la de administracion, el movil...) hablan
 * con este endpoint y comparten UN solo estado. Antes la sincronia era solo por
 * `BroadcastChannel`, que no cruza de un navegador a otro: cada dispositivo
 * tenia su hotel.
 *
 * GET  ?since=<rev>&clientId=<id>  -> estado si ha cambiado + quien manda
 * POST {action:'claim'|'push'|'release', clientId, state}
 */

// ws/protobuf no van en Edge, y el store vive en el proceso Node.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const since = Number(url.searchParams.get('since') || 0) || 0;
  const clientId = url.searchParams.get('clientId') || '';

  const s = getStore();
  if (clientId) s.clients[clientId] = Date.now();
  pruneClients(s);

  const vivo = isOwnerAlive(s);

  return NextResponse.json({
    revision: s.revision,
    stateRevision: s.stateRevision,
    // El estado solo viaja cuando hay algo nuevo: es el mensaje mas grande.
    state: s.stateRevision > since ? s.state : undefined,
    // Si el dueno ha dejado de latir, se reporta como libre para que otro
    // pueda reclamarlo en vez de esperar a que caduque por su cuenta.
    ownerId: vivo ? s.ownerId : null,
    peers: countClients(s),
    timestamp: Date.now(),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const s = getStore();
  const clientId = String(body?.clientId || '');
  const action = String(body?.action || '');

  if (clientId) s.clients[clientId] = Date.now();
  pruneClients(s);

  // --- Reclamar / renovar la propiedad ---
  if (action === 'claim' || action === 'heartbeat') {
    const libre = !isOwnerAlive(s);
    if (libre || s.ownerId === clientId) {
      s.ownerId = clientId;
      s.ownerHeartbeat = Date.now();
    }
    const esDueno = s.ownerId === clientId && isOwnerAlive(s);
    return NextResponse.json({
      ok: true,
      ownerId: isOwnerAlive(s) ? s.ownerId : null,
      isOwner: esDueno,
      peers: countClients(s),
    });
  }

  // --- Soltar la propiedad (al cerrar la pestana) ---
  if (action === 'release') {
    if (s.ownerId === clientId) {
      s.ownerId = null;
      s.ownerHeartbeat = 0;
    }
    return NextResponse.json({ ok: true });
  }

  // --- Publicar estado ---
  //
  // Se acepta de cualquier cliente: los cambios iniciados por una persona
  // (panel de administracion) deben aplicarse al instante, y exigir ser el
  // dueno obligaria a esperar a una eleccion. El bucle de simulacion y los
  // eventos del live SI van limitados al dueno, pero eso se controla en el
  // cliente, que es quien sabe si esta aplicando algo automatico o no.
  if (action === 'push') {
    if (body?.state && typeof body.state === 'object') {
      s.state = body.state;
      s.revision += 1;
      s.stateRevision = s.revision;
      s.updatedAt = Date.now();
    }
    return NextResponse.json({
      ok: true,
      revision: s.revision,
      stateRevision: s.stateRevision,
    });
  }

  return NextResponse.json(
    { ok: false, error: 'accion desconocida' },
    { status: 400 }
  );
}
