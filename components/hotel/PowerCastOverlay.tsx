'use client';

import React, { useEffect, useRef, useState } from 'react';
import { PowerCast, SUPERPOWERS } from '../../types/hotel';

interface PowerCastOverlayProps {
  /** Poderes en vuelo. Cada uno se limpia solo al terminar su animacion. */
  casts: PowerCast[];
  /** Contenedor del edificio: se mide para situar origen y destino. */
  buildingRef: React.RefObject<HTMLDivElement | null>;
  /** Se llama cuando la animacion de un poder ha terminado. */
  onCastComplete: (castId: string) => void;
  /** 1 / escala del autoFit, para contra-escalar el rayo. */
  inverseScale?: number;
}

interface Travel {
  cast: PowerCast;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

/**
 * Dibuja los poderes en vuelo: un rayo de energia que sale del residente que lo
 * gano y viaja hasta el residente sobre el que se lanza.
 *
 * Las posiciones se miden del DOM (los personajes reales), no se estiman, asi
 * que el rayo apunta bien aunque el piso se haya movido o el edificio cambie de
 * escala. Los personajes se marcan con `data-resident-id` en CharacterRenderer.
 */
export const PowerCastOverlay: React.FC<PowerCastOverlayProps> = ({
  casts,
  buildingRef,
  onCastComplete,
  inverseScale = 1,
}) => {
  const [travels, setTravels] = useState<Travel[]>([]);
  const scheduledRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const building = buildingRef.current;
    if (!building || !casts.length) return;

    const bRect = building.getBoundingClientRect();
    if (!bRect.height) return;

    // El edificio va con `transform: scale(...)`: getBoundingClientRect devuelve
    // medidas YA escaladas, pero los offsets CSS del overlay se vuelven a
    // escalar. Sin dividir por la escala, el rayo apunta a otro sitio.
    const layoutWidth = building.offsetWidth || bRect.width;
    const escala = layoutWidth > 0 ? bRect.width / layoutWidth : 1;
    const inv = escala > 0 ? 1 / escala : 1;

    const nuevos: Travel[] = [];

    for (const cast of casts) {
      if (scheduledRef.current.has(cast.id)) continue;

      const nodoOrigen = building.querySelector<HTMLElement>(
        `[data-resident-id="${cast.fromId}"]`
      );
      const nodoDestino = building.querySelector<HTMLElement>(
        `[data-resident-id="${cast.toId}"]`
      );
      // Sin los dos extremos no hay rayo que dibujar (alguno ya se fue).
      if (!nodoOrigen || !nodoDestino) continue;

      const ro = nodoOrigen.getBoundingClientRect();
      const rd = nodoDestino.getBoundingClientRect();
      if (!ro.height || !rd.height) continue;

      // Centro del torso de cada personaje, en coordenadas locales del edificio.
      const fromX = (ro.left - bRect.left + ro.width / 2) * inv;
      const fromY = (ro.top - bRect.top + ro.height * 0.45) * inv;
      const toX = (rd.left - bRect.left + rd.width / 2) * inv;
      const toY = (rd.top - bRect.top + rd.height * 0.45) * inv;

      scheduledRef.current.add(cast.id);
      nuevos.push({ cast, fromX, fromY, toX, toY });

      window.setTimeout(() => {
        scheduledRef.current.delete(cast.id);
        onCastComplete(cast.id);
      }, cast.durationMs + 350);
    }

    if (nuevos.length) {
      setTravels((prev) => {
        const vivos = prev.filter((t) => casts.some((c) => c.id === t.cast.id));
        return [...vivos, ...nuevos];
      });
    }
  }, [casts, buildingRef, onCastComplete]);

  useEffect(() => {
    setTravels((prev) => prev.filter((t) => casts.some((c) => c.id === t.cast.id)));
  }, [casts]);

  if (!travels.length) return null;

  return (
    <div className="absolute inset-0 z-45 pointer-events-none overflow-hidden">
      {travels.map((t) => {
        const def = SUPERPOWERS.find((p) => p.id === t.cast.power);
        const color = def?.beamColor || '#FACC15';
        const dx = t.toX - t.fromX;
        const dy = t.toY - t.fromY;
        // Longitud y angulo del trayecto, para dibujar la estela recta.
        const dist = Math.hypot(dx, dy);
        const angulo = (Math.atan2(dy, dx) * 180) / Math.PI;

        return (
          <React.Fragment key={t.cast.id}>
            {/* 0. Rastro de energia: linea que une emisor y receptor y se
                dibuja sola al disparar. Da contexto al rayo (se ve de donde a
                donde va antes de que llegue el proyectil). */}
            <div
              className="absolute animate-power-trace"
              style={{
                left: `${t.fromX}px`,
                top: `${t.fromY}px`,
                width: `${dist}px`,
                height: 3,
                marginTop: -1.5,
                transformOrigin: 'left center',
                background: `linear-gradient(90deg, transparent 0%, ${color} 18%, #FFFFFF 50%, ${color} 82%, transparent 100%)`,
                boxShadow: `0 0 8px 2px ${color}cc`,
                ['--angulo' as any]: `${angulo}deg`,
              }}
            />

            {/* 1. Carga en el emisor: pulso que se agranda antes de disparar. */}
            <div
              className="absolute animate-power-charge rounded-full"
              style={{
                left: `${t.fromX}px`,
                top: `${t.fromY}px`,
                width: 26,
                height: 26,
                marginLeft: -13,
                marginTop: -13,
                background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
                transform: `scale(${inverseScale})`,
              }}
            />

            {/* 2. El proyectil: viaja del emisor al receptor. El keyframe usa
                --tx/--ty (el desplazamiento real medido) y le da un arco. */}
            <div
              className="absolute"
              style={{
                left: `${t.fromX}px`,
                top: `${t.fromY}px`,
                ['--tx' as any]: `${dx}px`,
                ['--ty' as any]: `${dy}px`,
                transform: `translateX(-50%) scale(${inverseScale})`,
                transformOrigin: 'top center',
              }}
            >
              <div className="relative animate-power-travel">
                {/* Halo del poder */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{
                    background: `radial-gradient(circle, ${color} 0%, ${color}55 45%, transparent 72%)`,
                    boxShadow: `0 0 12px 4px ${color}aa`,
                  }}
                >
                  <span className="text-sm leading-none">{def?.icon || '⚡'}</span>
                </div>
                {/* Chispas de estela */}
                <div
                  className="absolute top-1 -left-2 w-1.5 h-1.5 rounded-full animate-power-spark"
                  style={{ background: color }}
                />
                <div
                  className="absolute -top-1 left-2 w-1 h-1 rounded-full animate-power-spark"
                  style={{ background: color, animationDelay: '0.15s' }}
                />
              </div>
            </div>

            {/* 3. Impacto en el receptor: destello que crece y se apaga.
                Se retrasa para que coincida con la llegada del proyectil. */}
            <div
              className="absolute animate-power-impact rounded-full"
              style={{
                left: `${t.toX}px`,
                top: `${t.toY}px`,
                width: 34,
                height: 34,
                marginLeft: -17,
                marginTop: -17,
                background: `radial-gradient(circle, #FFFFFF 0%, ${color} 40%, transparent 72%)`,
                transform: `scale(${inverseScale})`,
                animationDelay: '1s',
                opacity: 0,
              }}
            />

            {/* 4. Etiqueta de origen -> destino, para que se lea quien lanza a quien. */}
            <div
              className="absolute whitespace-nowrap rounded-full px-1.5 py-[1px] border shadow-lg font-black text-[8px]"
              style={{
                left: `${(t.fromX + t.toX) / 2}px`,
                top: `${Math.min(t.fromY, t.toY) - 18}px`,
                transform: `translateX(-50%) scale(${inverseScale})`,
                background: 'rgba(0,0,0,0.85)',
                borderColor: color,
                color: color,
              }}
            >
              {def?.icon} {t.cast.fromName} ➜ {t.cast.toName}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};
