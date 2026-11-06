import { useEffect, useReducer } from 'react';

/**
 * Vuelve a pintar el componente cuando llega el instante `hasta` (ms epoch).
 *
 * Los efectos temporales (celebracion de regalo, impacto de poder) se deciden
 * en el render con `Date.now()`. Con los componentes memoizados ya no hay
 * repintados "de rebote" por eventos ajenos, asi que sin esto el efecto podia
 * seguir hasta el siguiente tic de estadia (hasta 3.5 s de mas).
 */
export function useRerenderAt(...hasta: Array<number | null | undefined>): void {
  const [, repintar] = useReducer((x: number) => x + 1, 0);
  const proximo = hasta
    .filter((t): t is number => typeof t === 'number' && Number.isFinite(t))
    .reduce((min, t) => Math.min(min, t), Infinity);
  useEffect(() => {
    if (!Number.isFinite(proximo)) return;
    const ms = proximo - Date.now();
    if (ms <= 0) return;
    const id = setTimeout(repintar, ms + 20);
    return () => clearTimeout(id);
  }, [proximo]);
}
