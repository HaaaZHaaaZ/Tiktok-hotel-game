'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useHotel } from '../../context/HotelContext';
import { HotelHud } from './HotelHud';
import { FloorRenderer } from './FloorRenderer';
import { GroundFloorRenderer } from './GroundFloorRenderer';
import { PenthouseRenderer } from './PenthouseRenderer';
import { GlobalEventOverlay } from './GlobalEventOverlay';
import { WeatherOverlay } from './WeatherOverlay';

export const HotelView: React.FC = () => {
  const { state, resetCamera } = useHotel();
  const { floors, rooms, residents, timeOfDay, weather, globalEvent, camera, vipPenthouseResidents } = state;

  const viewportRef = useRef<HTMLDivElement>(null);
  const buildingRef = useRef<HTMLDivElement>(null);
  // Referencias a las filas reales de cada piso. El encuadre se calcula midiendo
  // el DOM en vez de estimando un porcentaje: el render apila los pisos en orden
  // INVERSO (el mas alto arriba) y los pisos se crean y derriban en caliente, asi
  // que cualquier formula fija acaba apuntando a zonas vacias.
  const floorRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Posicion vertical medida de cada piso (porcentaje sobre la altura del
  // edificio). Se declara ANTES de floorYPercent porque este lo consume.
  const [floorYMap, setFloorYMap] = useState<Record<number, number>>({});

  // Dynamic scale so the ENTIRE building fits 100% in GENERAL view without anyone cut off
  const [autoFitScale, setAutoFitScale] = useState(0.75);

  const vipResidentsList = vipPenthouseResidents.map((id) => residents[id]).filter(Boolean);

  // Dynamic Outdoor Sky / City Backdrop
  let skyGradient = 'from-sky-400 via-sky-300 to-amber-100'; // Day
  if (timeOfDay === 'evening') {
    skyGradient = 'from-indigo-950 via-purple-900 to-orange-500';
  } else if (timeOfDay === 'night') {
    skyGradient = 'from-slate-950 via-slate-900 to-indigo-950';
  }
  if (globalEvent.type === 'TORMENTA') {
    skyGradient = 'from-slate-950 via-blue-950 to-slate-900';
  }

  // Calculate perfect auto-fit scale so all users are in view
  const calculateAutoFit = useCallback(() => {
    if (!viewportRef.current || !buildingRef.current) return;
    const vHeight = viewportRef.current.clientHeight;
    const vWidth = viewportRef.current.clientWidth;
    const bHeight = buildingRef.current.scrollHeight;
    const bWidth = buildingRef.current.scrollWidth || 480;

    if (vHeight > 50 && bHeight > 50) {
      // Leave safety margins for HUD and safe zones
      const verticalScale = (vHeight - 16) / bHeight;
      const horizontalScale = (vWidth - 12) / Math.max(bWidth, 460);
      const computedScale = Math.min(verticalScale, horizontalScale, 1.0);
      // Floor at 0.35 minimum for extreme height
      setAutoFitScale(Math.max(0.35, Math.min(1.0, Number(computedScale.toFixed(3)))));
    }
  }, []);

  useEffect(() => {
    calculateAutoFit();
    const handleResize = () => calculateAutoFit();
    window.addEventListener('resize', handleResize);

    const ro = new ResizeObserver(() => calculateAutoFit());
    if (viewportRef.current) ro.observe(viewportRef.current);
    if (buildingRef.current) ro.observe(buildingRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      ro.disconnect();
    };
  }, [calculateAutoFit, floors.length]);

  // Determine active transform based on camera state for dynamic broadcast prominence
  let transformValue = `scale(${autoFitScale})`;
  let transformOriginValue = 'center center';

  const totalBuildingLevels = Math.max(1, floors.length) + 1.2;

  /**
   * Origen vertical MEDIDO de un piso, como porcentaje sobre la altura del
   * edificio. Antes se estimaba con `(1 - piso/niveles) * 100`, que es
   * exactamente lo que apuntaba a zonas equivocadas: el render invierte el orden
   * de los pisos y la planta baja y el rooftop ocupan alto propio, asi que la
   * formula no coincide con la posicion real de nada.
   *
   * Si el nodo no esta montado todavia, cae a una estimacion conservadora.
   */
  const floorYPercent = (floorNumber: number): number => {
    const measured = floorYMap[floorNumber];
    if (typeof measured === 'number') return measured;
    // Sin medicion todavia: estimacion conservadora, se corrige al pintar el DOM.
    const b = buildingRef.current;
    const row = floorRefs.current[floorNumber];
    if (!b || !row) return 50;
    const bRect = b.getBoundingClientRect();
    const rRect = row.getBoundingClientRect();
    if (!bRect.height || !rRect.height) return 50;
    const centerInBuilding = rRect.top - bRect.top + rRect.height / 2;
    return Math.max(4, Math.min(96, (centerInBuilding / bRect.height) * 100));
  };

  // =====================================================================
  // ZOOM DESACTIVADO (2026-10-04)
  //
  // La camara se queda en la vista general siempre. El zoom por piso daba
  // problemas: apuntaba a zonas vacias y, con la medicion del DOM, Provoco una
  // excepcion en el navegador. Se conserva TODO el codigo debajo para poder
  // reactivarlo poniendo ZOOM_ENABLED = true, una vez se entienda por que
  // enfocaba donde no era.
  // =====================================================================
  const ZOOM_ENABLED = false;

  if (ZOOM_ENABLED && camera.targetType === 'RECEPTION') {
    // Don Pepe y el residente nuevo, en el mostrador de planta baja.
    transformValue = 'scale(2.15)';
    transformOriginValue = '50% 92%';
  } else if (ZOOM_ENABLED && camera.targetType === 'ELEVATOR') {
    if (!camera.targetFloor || camera.targetFloor === 0) {
      // Entrada del ascensor en planta baja
      transformValue = 'scale(2.15)';
      transformOriginValue = '50% 90%';
    } else {
      // Puerta del ascensor en el piso destino (medido, no estimado)
      transformValue = 'scale(2.1)';
      transformOriginValue = `50% ${floorYPercent(camera.targetFloor)}%`;
    }
  } else if (ZOOM_ENABLED && camera.targetType === 'ROOM') {
    // Zoom al residente y su habitacion
    const roomNum = camera.targetRoomNumber || 101;
    // Left rooms (101, 103) vs Right rooms (102, 104)
    const isLeftRoom = roomNum % 2 !== 0;
    const xPercent = isLeftRoom ? '30%' : '70%';

    const levelIndex = camera.targetFloor || Math.floor(roomNum / 100) || 1;
    transformValue = 'scale(2.25)';
    transformOriginValue = `${xPercent} ${floorYPercent(levelIndex)}%`;
  } else if (ZOOM_ENABLED && camera.targetType === 'PENTHOUSE') {
    // Zoom in on VIP Penthouse
    transformValue = 'scale(2.0)';
    transformOriginValue = '50% 8%';
  } else if (ZOOM_ENABLED && camera.targetType === 'TOUR') {
    // Tour panoramico: enfoca el PISO COMPLETO (las 4 habitaciones a la vez),
    // no una habitacion suelta.
    const levelIndex = camera.targetFloor || 1;
    transformValue = 'scale(1.45)';
    transformOriginValue = `50% ${floorYPercent(levelIndex)}%`;
  } else {
    // GENERAL VIEW: Always fits 100% of users and building on screen!
    transformValue = `scale(${autoFitScale})`;
    transformOriginValue = 'center center';
  }

  const cameraStyle: React.CSSProperties = {
    transform: transformValue,
    transformOrigin: transformOriginValue,
    transition: 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
  };

  // floorYPercent() mide el DOM, asi que el transformOrigin se recalcula con
  // ResizeObserver + un re-render cuando cambia el encuadre.
  //
  // Antes se usaba un useReducer + useEffect que se disparaba en cascada: el
  // dispatch provocaba un render que volvia a medir, y con floors cambiando de
  // alto (pisos que se crean/derriban) el efecto se repetia sin fin — la
  // "client-side exception" que veia el usuario. Ahora la medicion vive en el
  // estado floorYMap (declarado arriba) y solo cambia cuando el DOM cambia de
  // verdad.
  const measureFloors = useCallback(() => {
    const b = buildingRef.current;
    if (!b) return;
    const bRect = b.getBoundingClientRect();
    if (!bRect.height) return;
    const next: Record<number, number> = {};
    let changed = false;
    for (const key of Object.keys(floorRefs.current)) {
      const row = floorRefs.current[Number(key)];
      if (!row) continue;
      const rRect = row.getBoundingClientRect();
      if (!rRect.height) continue;
      const pct = Math.max(
        4,
        Math.min(96, ((rRect.top - bRect.top + rRect.height / 2) / bRect.height) * 100)
      );
      next[Number(key)] = pct;
      const prev = floorYMap[Number(key)];
      if (prev === undefined || Math.abs(prev - pct) > 0.5) changed = true;
    }
    if (changed) setFloorYMap(next);
  }, [floorYMap]);

  // Recalcular cuando cambia el encuadre o el numero de pisos, y despues de
  // pintar el DOM (requestAnimationFrame) para que las refs ya existan.
  useEffect(() => {
    const raf = requestAnimationFrame(measureFloors);
    return () => cancelAnimationFrame(raf);
  }, [measureFloors, camera.targetType, camera.targetFloor, camera.targetRoomNumber, floors.length]);

  // Y de nuevo cuando cambia el tamano de la ventana o el del edificio.
  useEffect(() => {
    const b = buildingRef.current;
    if (!b || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measureFloors());
    ro.observe(b);
    for (const key of Object.keys(floorRefs.current)) {
      const row = floorRefs.current[Number(key)];
      if (row) ro.observe(row);
    }
    window.addEventListener('resize', measureFloors);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measureFloors);
    };
  }, [measureFloors, floors.length]);

  // Lobby corridor residents (visiting reception)
  const groundFloorResidents = Object.values(residents).filter(
    (res) => res.location === 'reception' || (res.isEntering && res.location === 'elevator')
  );

  // Stack floors in descending order: Highest floor on top, down to Floor 1
  const sortedFloors = [...floors].sort((a, b) => b.floorNumber - a.floorNumber);

  return (
    <div
      className={`relative w-full h-full flex flex-col justify-between overflow-hidden bg-gradient-to-b ${skyGradient} transition-colors duration-1000`}
    >
      {/* City Skyline Silhouette & Atmospheric Clouds */}
      <div className="absolute inset-0 pointer-events-none opacity-20 flex flex-col justify-between overflow-hidden">
        {/* Sky Stars at night */}
        {timeOfDay === 'night' && (
          <div className="w-full h-44 relative">
            <div className="absolute top-4 left-10 w-1 h-1 bg-white rounded-full animate-ping" />
            <div className="absolute top-12 right-20 w-1 h-1 bg-yellow-200 rounded-full" />
            <div className="absolute top-24 left-1/2 w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          </div>
        )}
        {/* City Buildings Silhouette at bottom */}
        <div className="w-full h-24 bg-repeat-x opacity-40 flex items-end justify-between px-2">
          {[...Array(14)].map((_, i) => (
            <div
              key={i}
              className="bg-black/60 w-6 rounded-t"
              style={{ height: `${20 + (i % 5) * 15}px` }}
            />
          ))}
        </div>
      </div>

      {/* Top HUD with metrics, live indicators and commands marquee */}
      <HotelHud />

      {/* Viewport Container: Centers the entire skyscraper so NO USER is ever left out of frame */}
      <div
        ref={viewportRef}
        className="relative flex-1 w-full flex flex-col items-center justify-center overflow-hidden p-1 select-none"
      >
        {/* The Entire Skyscraper Building Facade: Perfectly Scaled to Fit 100% of Residents */}
        <div
          ref={buildingRef}
          className="relative w-full max-w-[480px] flex flex-col shadow-2xl shrink-0"
          style={cameraStyle}
        >
          {/* Building Crown & Roof Sign */}
          <div className="w-full bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600 py-1 px-3 rounded-t-2xl shadow-lg border-t-2 border-x-2 border-yellow-200 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-950 font-black text-[11px] tracking-widest drop-shadow-xs">
              <span>★</span>
              <span>TIKTOK HOTEL TOWER</span>
              <span>★</span>
            </div>
            <div className="text-[9px] font-mono font-bold bg-black/80 text-amber-300 px-2 py-0.5 rounded">
              {floors.length} PISOS + PB ({Object.keys(residents).length} RESIDENTES)
            </div>
          </div>

          {/* 1. VIP Penthouse Rooftop (At the very summit) */}
          <PenthouseRenderer
            vipResidents={vipResidentsList}
            timeOfDay={timeOfDay}
            isFocused={camera.targetType === 'PENTHOUSE'}
          />

          {/* 2. Vertically Stacked Hotel Floors (Highest floor on top, down to Floor 1) */}
          <div className="w-full flex flex-col divide-y-2 divide-slate-700">
            {sortedFloors.map((floor) => {
              const isElevatorOperating = Object.values(residents).some(
                (r) =>
                  r.floorNumber === floor.floorNumber &&
                  (r.isEntering || r.currentAction === 'entering_hotel')
              );
              return (
                <div
                  key={floor.id}
                  ref={(el) => {
                    floorRefs.current[floor.floorNumber] = el;
                  }}
                >
                  <FloorRenderer
                    floor={floor}
                    rooms={rooms}
                    residents={residents}
                    timeOfDay={timeOfDay}
                    globalEvent={globalEvent.type}
                    focusedRoomNumber={camera.targetRoomNumber}
                    isElevatorOpen={isElevatorOperating}
                    demolitionState={state.demolitionState}
                  />
                </div>
              );
            })}
          </div>

          {/* 3. Ground Floor / Planta Baja (Reception, Don Pepe & Lobby at base) */}
          <GroundFloorRenderer
            timeOfDay={timeOfDay}
            globalEvent={globalEvent.type}
            isElevatorOpen={camera.targetType === 'ELEVATOR' && camera.targetFloor === 0}
            corridorResidents={groundFloorResidents}
            entryQueue={state.entryQueue}
            receptionAttending={state.receptionAttending}
          />

          {/* Hotel Sidewalk & Street Entrance Foundation */}
          <div className="w-full bg-stone-800 border-x-4 border-b-4 border-stone-900 rounded-b-xl py-1 px-3 flex items-center justify-between shadow-2xl">
            <div className="flex items-center gap-2 text-[9px] font-bold text-amber-400">
              <span>🏮</span>
              <span>AVENIDA TIKTOK LIVE</span>
              <span>🏮</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span>🚗</span>
              <span className="w-8 h-1 bg-yellow-400 rounded-full" />
              <span>🚕</span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Weather Effects Overlay */}
      <WeatherOverlay weather={weather || 'SOL'} />

      {/* Global Event Spectacular Overlay */}
      <GlobalEventOverlay eventState={globalEvent} />
    </div>
  );
};
