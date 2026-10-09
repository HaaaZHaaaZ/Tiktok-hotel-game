'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Resident } from '../../types/hotel';
import { CharacterRenderer } from './CharacterRenderer';

interface EvictionOverlayProps {
  /**
   * Residentes que estan siendo desalojados AHORA. Se dibujan cayendo por la
   * fachada desde la altura de su habitacion hasta la calle.
   *
   * La caida NO puede animarse dentro de RoomRenderer: su contenedor lleva
   * `overflow-hidden` y el personaje desapareceria al salir del recuadro a los
   * pocos pixeles. Por eso la animacion vive aqui, en un overlay que cubre todo
   * el edificio y puede salirse de la habitacion sin recortarse.
   */
  evictingResidents: Resident[];
  /** Contenedor del edificio: se mide para situar cada habitacion. */
  buildingRef: React.RefObject<HTMLDivElement | null>;
  /** Se llama cuando la caida de un residente ha terminado. */
  onFallComplete: (residentId: string) => void;
  /**
   * 1 / escala del autoFit del edificio. El overlay vive DENTRO del div que
   * lleva `transform: scale(...)`, asi que el personaje que cae heredaria ese
   * encogimiento. Con esto se contra-escala y se ve a tamano real.
   */
  inverseScale?: number;
}

interface Faller {
  resident: Resident;
  leftPx: number;
  topPx: number;
  distancePx: number;
}

/** Debe coincidir con la duracion de `.animate-evict-fall` en globals.css. */
const FALL_MS = 2600;

export const EvictionOverlay: React.FC<EvictionOverlayProps> = ({
  evictingResidents,
  buildingRef,
  onFallComplete,
  inverseScale = 1,
}) => {
  const [fallers, setFallers] = useState<Faller[]>([]);
  // Evita reprogramar el mismo residente en cada render.
  const scheduledRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const building = buildingRef.current;
    if (!building) return;

    const bRect = building.getBoundingClientRect();
    if (!bRect.height) return;

    // El edificio va con `transform: scale(...)` (autoFit). getBoundingClientRect
    // devuelve medidas YA escaladas, pero los `top`/`left` que se ponen en el
    // overlay son offsets CSS DENTRO del edificio, que se vuelven a escalar. Hay
    // que dividir por el factor de escala para volver al espacio local; sin esto
    // el personaje caia en una posicion y una distancia equivocadas (se veia
    // caer 38px empezando por encima de su propia habitacion).
    const layoutWidth = building.offsetWidth || bRect.width;
    const escala = layoutWidth > 0 ? bRect.width / layoutWidth : 1;
    const inv = escala > 0 ? 1 / escala : 1;

    const nuevos: Faller[] = [];

    for (const res of evictingResidents) {
      if (scheduledRef.current.has(res.id)) continue;

      // Columna real de su habitacion, medida en el DOM. Las habitaciones se
      // marcan con data-room-number en RoomRenderer.
      const roomNumber = Number(String(res.roomId || '').replace('room_', ''));
      const roomNode = building.querySelector<HTMLElement>(
        `[data-room-number="${roomNumber}"]`
      );

      let leftPx = layoutWidth * 0.5;
      let topPx = (building.offsetHeight || bRect.height) * 0.35;
      let distancePx = (building.offsetHeight || bRect.height) * 0.6;

      if (roomNode) {
        const rRect = roomNode.getBoundingClientRect();
        if (rRect.height) {
          // Centro horizontal de su habitacion, en coordenadas LOCALES del edificio.
          leftPx = (rRect.left - bRect.left + rRect.width / 2) * inv;
          // Arranca a la altura del suelo de la habitacion (donde esta el personaje).
          topPx = (rRect.bottom - bRect.top) * inv - 12;
          // Y cae hasta la base del edificio: la calle.
          const altoLocal = building.offsetHeight || bRect.height;
          distancePx = Math.max(140, altoLocal - topPx);
        }
      }

      scheduledRef.current.add(res.id);
      nuevos.push({ resident: res, leftPx, topPx, distancePx });

      // Al terminar la caida, el residente se borra del mapa. Su contador de
      // likes se va con el: al no existir el personaje, vuelve a 0 solo.
      window.setTimeout(() => {
        scheduledRef.current.delete(res.id);
        onFallComplete(res.id);
      }, FALL_MS);
    }

    if (nuevos.length) {
      setFallers((prev) => {
        const vivos = prev.filter((f) =>
          evictingResidents.some((r) => r.id === f.resident.id)
        );
        return [...vivos, ...nuevos];
      });
    }
  }, [evictingResidents, buildingRef, onFallComplete]);

  // Limpia los que ya no estan en la lista de desalojos.
  useEffect(() => {
    setFallers((prev) =>
      prev.filter((f) => evictingResidents.some((r) => r.id === f.resident.id))
    );
  }, [evictingResidents]);

  if (!fallers.length) return null;

  return (
    <div className="absolute inset-0 z-40 pointer-events-none overflow-hidden">
      {fallers.map((f) => (
        // Wrapper: posicion + contra-escala. NO lleva animacion, porque el
        // keyframe `evict-fall` escribe su propio `transform` y machacaria el
        // translateX/scale de aqui.
        <div
          key={f.resident.id}
          className="absolute"
          style={{
            left: `${f.leftPx}px`,
            top: `${f.topPx}px`,
            // Contra-escala: el overlay va dentro del div del edificio, que ya
            // lleva su propio `scale()`. Sin esto el personaje se encogeria.
            transform: `translateX(-50%) scale(${inverseScale})`,
            transformOrigin: 'top center',
          }}
        >
          {/* Capa animada: cae por la fachada. */}
          <div
            className="relative animate-evict-fall flex flex-col items-center"
            style={{
              // Distancia real hasta la calle; el keyframe la consume.
              ['--fall-distance' as any]: `${f.distancePx}px`,
            }}
          >
            {/* El personaje gira mientras cae. */}
            <CharacterRenderer resident={f.resident} scale={0.8} showName={true} />

            {/* Estela de panico y polvo. */}
            <div className="absolute -top-2 -right-2 text-sm animate-ping">💨</div>
            <div className="absolute top-2 -left-2 text-xs animate-pulse">😱</div>
          </div>
        </div>
      ))}
    </div>
  );
};
