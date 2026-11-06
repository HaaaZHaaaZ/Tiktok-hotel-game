'use client';

import React from 'react';

/**
 * Efectos de obra mientras se construye un piso nuevo.
 *
 * Se monta SOLO durante CONSTRUCCION_MS desde `floor.builtAt` (lo controla
 * FloorRenderer), asi que las animaciones CSS arrancan al montarse y no hace
 * falta ningun temporizador aqui. El propio piso baja de la grua con
 * `.animate-floor-build` (globals.css); esto dibuja lo de alrededor.
 *
 * Reglas: solo transform/opacity, retardos con animation-delay, keyframes con
 * prefijo `build-` en globals.css.
 */
export const CONSTRUCCION_MS = 2600;

export const FloorConstructionOverlay: React.FC<{ floorNumber: number }> = ({ floorNumber }) => {
  return (
    <div className="absolute inset-0 z-40 pointer-events-none overflow-visible">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-amber-400 text-slate-950 font-black text-xs px-3 py-1 rounded-lg border-2 border-slate-900 shadow-2xl animate-alert-pop">
          🏗️ ¡PISO {floorNumber} INAUGURADO!
        </div>
      </div>
    </div>
  );
};
