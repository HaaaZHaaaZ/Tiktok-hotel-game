import { NextRequest, NextResponse } from 'next/server';
import {
  getStore,
  pruneClients,
  countClients,
  isWriterAlive,
} from '../../../../services/hotelSyncStore';
import { sesionAdminValida } from '../../../../services/adminAuth';

/**
 * Estado compartido del hotel.
 *
 * MODELO: una sola fuente de verdad, sin hoteles paralelos.
 *
 *   - El servidor guarda EL hotel. Todas las pantallas leen el mismo.
 *   - UNA pantalla lo escribe: la del live (la que se emite). Es la unica que
 *     aplica los eventos de TikTok y el reloj de estadia.
 *   - El panel de admin NO tiene hotel propio. Lee el estado y MANDA ORDENES
 *     (reglas, clima, eventos, demoler...), que la pantalla del hotel aplica.
 *
 * Antes cada pantalla publicaba su hotel entero y peleaba por ser el "dueno".
 * Con el panel montando tambien un hotel completo habia DOS escritores: el valor
 * de "tiempo de duracion" oscilaba entre el que ponia el admin (10) y el que
 * tenia el hotel (30) porque cada uno reescribia el estado entero con el suyo.
 *
 * Aqui se acaba con eso:
 *   - El push solo se acepta de la pantalla que es el escritor. Una pestana
 *     cualquiera no puede machacar el hotel.
 *   - Los ajustes de administracion viajan como ORDENES, que exigen sesion de
 *     admin. Asi un espectador con la pagina abierta no puede cambiar reglas.
 *
 * GET  ?since=<rev>&clientId=<id>   -> estado si cambio + quien escribe
 * POST {action:'claimWriter'|'push'|'order'|'takeOrders', ...}
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const since = Number(url.searchParams.get('since') || 0) || 0;
  const clientId = url.searchParams.get('clientId') || '';

  const s = getStore();
  if (clientId) s.clients[clientId] = Date.now();
  pruneClients(s);

  const vivo = isWriterAlive(s);
  const esEscritor = vivo && s.writerId === clientId;
  // El que escribe renueva su puesto con cada lectura (el poll va cada 1.2s).
  if (esEscritor) s.writerSeenAt = Date.now();

  return NextResponse.json({
    revision: s.revision,
    // El estado solo viaja cuando hay algo nuevo: es el mensaje mas grande.
    state: s.revision > since ? s.state : undefined,
    // Las ordenes solo se entregan a quien las va a aplicar (la pantalla del
    // hotel). Si las recibiera el panel, se gastarian antes de llegar al hotel.
    orders: esEscritor && s.orders.length ? s.orders : undefined,
    // Quien escribe ahora mismo, para que cada pantalla sepa si le toca a ella.
    writerId: vivo ? s.writerId : null,
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

  // --- Pedir ser la pantalla que escribe ---
  //
  // Se concede si no hay nadie, si el que habia dejo de dar senal, o si ya era
  // esta misma pantalla (recarga, reenganche). No es una eleccion con votos: es
  // un puesto con caducidad, que es lo unico que hace falta.
  if (action === 'claimWriter') {
    const libre = !isWriterAlive(s);
    if (libre || s.writerId === clientId) {
      s.writerId = clientId;
      s.writerSeenAt = Date.now();
    }
    const esEscritor = isWriterAlive(s) && s.writerId === clientId;
    return NextResponse.json({
      ok: true,
      isWriter: esEscritor,
      writerId: isWriterAlive(s) ? s.writerId : null,
    });
  }

  // --- Publicar el estado del hotel ---
  //
  // Solo la pantalla que escribe. Antes se aceptaba de cualquiera, y por eso una
  // segunda pestana (o el panel) podia reescribir el hotel entero con su version
  // y el estado rebotaba entre las dos.
  if (action === 'push') {
    const esEscritor = isWriterAlive(s) && s.writerId === clientId;
    if (!esEscritor) {
      return NextResponse.json(
        { ok: false, error: 'esta pantalla no escribe el hotel', revision: s.revision },
        { status: 409 }
      );
    }
    if (body?.state && typeof body.state === 'object') {
      s.state = body.state;
      s.revision += 1;
      s.updatedAt = Date.now();
      s.writerSeenAt = Date.now();
    }
    return NextResponse.json({ ok: true, revision: s.revision });
  }

  // --- Enviar una orden de administracion ---
  //
  // Requiere sesion de admin: es lo que hace que solo el streamer pueda cambiar
  // reglas, clima o demoler.
  if (action === 'order') {
    if (!sesionAdminValida(req)) {
      return NextResponse.json(
        { ok: false, error: 'Se requiere sesión de administrador' },
        { status: 401 }
      );
    }
    const order = body?.order;
    if (!order || typeof order !== 'object' || typeof order.type !== 'string') {
      return NextResponse.json({ ok: false, error: 'orden inválida' }, { status: 400 });
    }
    s.orders.push({
      id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: order.type,
      payload: order.payload ?? {},
      at: Date.now(),
    });
    // Tope de seguridad: si no hay hotel abierto que las aplique, no se acumulan
    // sin fin.
    if (s.orders.length > 100) s.orders = s.orders.slice(-100);
    return NextResponse.json({ ok: true, pendientes: s.orders.length });
  }

  // --- Confirmar que las ordenes se aplicaron ---
  //
  // El GET entrega las ordenes SIN borrarlas. La pantalla del hotel las aplica y
  // entonces llama aqui. Si se borraran al entregarlas, una orden se perderia si
  // la aplicacion fallaba a mitad; si no se borraran nunca, se reaplicarian en
  // cada poll (uno cada 1.2s) y el ajuste no pararia de repetirse.
  if (action === 'takeOrders') {
    const esEscritor = isWriterAlive(s) && s.writerId === clientId;
    if (!esEscritor) {
      return NextResponse.json({ ok: false, error: 'solo la pantalla del hotel' }, { status: 403 });
    }
    s.orders = [];
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { ok: false, error: 'accion desconocida' },
    { status: 400 }
  );
}
