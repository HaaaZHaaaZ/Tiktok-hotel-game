/**
 * Comparticion estructural: devuelve `next`, pero reutilizando los objetos de
 * `prev` que no han cambiado.
 *
 * El estado remoto llega del servidor como JSON (cada ~1.2 s si hay cambios), asi
 * que TODOS sus objetos son nuevos aunque solo haya cambiado un residente. Sin
 * esto, React ve referencias nuevas en todo el arbol y vuelve a pintar el hotel
 * entero en el panel de admin y en cada pantalla que no escribe. Con esto, los
 * componentes memoizados (pisos, habitaciones, personajes) solo se repintan si
 * SU dato cambio de verdad.
 *
 * Logica pura (sin React) para poder probarla con `node --test`.
 */
export function shareUnchanged<T>(prev: unknown, next: T): T {
  if (Object.is(prev, next)) return prev as T;
  if (
    prev === null ||
    next === null ||
    typeof prev !== 'object' ||
    typeof next !== 'object'
  ) {
    return next;
  }

  if (Array.isArray(next)) {
    if (!Array.isArray(prev)) return next;
    let same = prev.length === next.length;
    const out = next.map((item, i) => {
      const shared = shareUnchanged(prev[i], item);
      if (shared !== prev[i]) same = false;
      return shared;
    });
    return (same ? prev : out) as T;
  }

  if (Array.isArray(prev)) return next;
  const p = prev as Record<string, unknown>;
  const n = next as Record<string, unknown>;
  const keys = Object.keys(n);
  let same = keys.length === Object.keys(p).length;
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const shared = shareUnchanged(p[k], n[k]);
    if (!(k in p) || shared !== p[k]) same = false;
    out[k] = shared;
  }
  return (same ? prev : out) as T;
}
