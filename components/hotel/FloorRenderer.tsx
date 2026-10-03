'use client';

import React from 'react';
import { Floor, Room, Resident, TimeOfDay, GlobalEventType, DemolitionState } from '../../types/hotel';
import { RoomRenderer } from './RoomRenderer';
import { ElevatorRenderer } from './ElevatorRenderer';
import { CharacterRenderer } from './CharacterRenderer';

interface FloorRendererProps {
  floor: Floor;
  rooms: Record<string, Room>;
  residents: Record<string, Resident>;
  timeOfDay: TimeOfDay;
  globalEvent: GlobalEventType;
  focusedRoomNumber?: number;
  isElevatorOpen?: boolean;
  demolitionState?: DemolitionState;
}

export const FloorRenderer: React.FC<FloorRendererProps> = ({
  floor,
  rooms,
  residents,
  timeOfDay,
  globalEvent,
  focusedRoomNumber,
  isElevatorOpen = false,
  demolitionState,
}) => {
  // Exactly 4 rooms on this floor, sorted by number (e.g. 101, 102, 103, 104)
  const floorRooms = floor.rooms
    .map((id) => rooms[id])
    .filter(Boolean)
    .sort((a, b) => a.number - b.number);

  // Corridor residents (walking or emerging from elevator)
  const corridorResidents = Object.values(residents).filter(
    (res) =>
      res.floorNumber === floor.floorNumber &&
      (res.location === 'corridor' || res.isEntering || res.isLeaving)
  );

  const isThisFloorDemolishing =
    demolitionState?.isDemolishing && demolitionState.demolishingFloorNumber === floor.floorNumber;

  const isCrackingAndFlickering = isThisFloorDemolishing && demolitionState?.phase === 'cracks_and_flicker';
  const isExplodingBricks = isThisFloorDemolishing && demolitionState?.phase === 'exploding_bricks';
  const isCollapsingHeight =
    isThisFloorDemolishing &&
    (demolitionState?.phase === 'exploding_bricks' || demolitionState?.phase === 'upper_floors_falling');

  const isThisFloorFalling =
    demolitionState?.isDemolishing &&
    demolitionState.affectedUpperFloors.includes(floor.floorNumber) &&
    demolitionState.phase === 'upper_floors_falling';

  return (
    <div
      className={`relative w-full border-x-4 border-t-2 border-b-2 border-slate-700 bg-stone-900 shadow-2xl transition-all duration-1000 ease-in-out ${
        isCollapsingHeight
          ? 'max-h-0 py-0 opacity-0 border-y-0 overflow-hidden scale-95'
          : 'max-h-[350px] p-2'
      } ${
        isCrackingAndFlickering ? 'animate-shake shadow-[0_0_30px_rgba(239,68,68,0.9)]' : ''
      }`}
    >
      {/* 1. Structural Demolition: Cracks & Electrical Outages */}
      {isCrackingAndFlickering && (
        <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden rounded">
          {/* Electrical power outage strobe light flashes */}
          <div className="absolute inset-0 bg-yellow-400/35 mix-blend-color-dodge animate-flicker" />
          <div className="absolute inset-0 bg-black/60 animate-pulse" />

          {/* Red jagged structural crack lines */}
          <svg className="absolute inset-0 w-full h-full stroke-red-500 stroke-2 fill-none drop-shadow-[0_0_8px_#FF0000]">
            <polyline points="20,0 60,35 50,65 90,95 80,130 130,170" />
            <polyline points="180,0 160,40 190,75 170,110 210,160" />
            <polyline points="320,0 300,45 330,80 310,120 350,170" />
            <polyline points="450,15 410,50 430,90 380,125 400,170" />
            <polyline points="0,90 80,105 160,85 240,100 360,90 480,100" />
          </svg>

          {/* Sparks & falling debris */}
          <div className="absolute top-2 left-8 text-xl animate-bounce">⚡</div>
          <div className="absolute top-4 right-12 text-lg animate-ping">💥</div>
          <div className="absolute top-1/2 left-1/3 text-xl animate-bounce">⚡</div>
          <div className="absolute bottom-4 right-1/4 text-sm animate-pulse">🪨</div>

          {/* Warning Banner */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/65 backdrop-blur-xs p-2 text-center">
            <div className="bg-red-600 text-white font-black text-xs px-3 py-1.5 rounded-lg border-2 border-yellow-300 shadow-2xl animate-bounce flex items-center gap-1.5">
              <span>🚨</span>
              <span>¡FALLO ELÉCTRICO & DEMOLICIÓN EN CURSO!</span>
              <span>🚨</span>
            </div>
            <div className="text-[9px] text-amber-300 font-mono font-bold mt-1 bg-black/80 px-2 py-0.5 rounded border border-amber-500/50">
              Desmantelando Piso {floor.floorNumber}...
            </div>
          </div>
        </div>
      )}

      {/* 2. Spectacular Explosion into Bricks & Pixel Debris */}
      {isExplodingBricks && (
        <div className="absolute inset-0 z-50 pointer-events-none overflow-visible flex items-center justify-center">
          {/* Central fireball flash */}
          <div className="w-48 h-48 rounded-full bg-gradient-to-r from-yellow-300 via-orange-500 to-red-600 blur-md animate-ping" />
          <div className="text-4xl animate-bounce absolute">💥</div>

          {/* Flying Brick & Pixel Particles Scattering Outwards */}
          <div className="absolute text-2xl animate-brick-1">🧱</div>
          <div className="absolute text-2xl animate-brick-2">🧱</div>
          <div className="absolute text-xl animate-brick-3">🪨</div>
          <div className="absolute text-2xl animate-brick-4">🧱</div>

          <div className="absolute text-lg animate-brick-1">🟧</div>
          <div className="absolute text-lg animate-brick-2">🟫</div>
          <div className="absolute text-xl animate-brick-3">💨</div>
          <div className="absolute text-lg animate-brick-4">🟧</div>

          <div className="absolute -top-4 text-2xl animate-brick-2">🔥</div>
          <div className="absolute -bottom-4 text-2xl animate-brick-3">💨</div>
        </div>
      )}

      {/* Floor Top Bar: Floor Indicator & Central Elevator/Corridor Strip */}
      <div className="flex items-center justify-between px-2 py-1 mb-1.5 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded border border-slate-600 shadow-md">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#F59E0B]" />
          <span className="text-[11px] font-black tracking-wider text-amber-300">
            {floor.name.toUpperCase()}
          </span>
          <span className="text-[9px] text-slate-300 font-medium">
            (4 Habitaciones en Fila)
          </span>
        </div>

        {/* Mini Floor Elevator */}
        <div className="flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded border border-slate-700">
          <span className="text-[8px] text-amber-400 font-black animate-pulse">▲</span>
          <span className="text-[9px] font-mono font-bold text-amber-300">
            ASCENSOR P{floor.floorNumber}
          </span>
          <div className={`w-1.5 h-1.5 rounded-full ${isElevatorOpen ? 'bg-emerald-400 shadow-[0_0_4px_#10B981]' : 'bg-amber-500'}`} />
        </div>

        <div className="text-[9px] text-slate-400 font-mono font-bold">
          HAB. {floor.floorNumber}01 - {floor.floorNumber}04
        </div>
      </div>

      {/* Hallway Walkers Strip (When resident is walking down corridor) */}
      {corridorResidents.length > 0 && (
        <div className="relative w-full h-8 bg-amber-950/80 rounded border border-amber-600/50 mb-1.5 px-2 flex items-center overflow-hidden">
          <div className="text-[8px] text-amber-400 font-black mr-2 uppercase">PASILLO:</div>
          {corridorResidents.map((res) => (
            <div
              key={res.id}
              className="flex items-center gap-1 animate-in fade-in duration-300"
            >
              <CharacterRenderer resident={res} scale={0.75} showName={true} />
              <span className="text-[8px] font-bold text-slate-200">➔ Dirigiéndose a Hab. {res.roomId ? res.roomId.replace('room_', '') : ''}</span>
            </div>
          ))}
        </div>
      )}

      {/* SINGLE ROW OF 4 ROOMS: EXACTLY 4 ROOMS PER ROW! */}
      <div className="grid grid-cols-4 gap-1.5 w-full">
        {floorRooms.map((room) => {
          const occupant = room.occupantId ? residents[room.occupantId] : undefined;
          // Character must ONLY be rendered inside room if their current location is physically 'room'
          const roomResident = occupant && occupant.location === 'room' ? occupant : undefined;
          return (
            <RoomRenderer
              key={room.id}
              room={room}
              resident={roomResident}
              timeOfDay={timeOfDay}
              globalEvent={globalEvent}
              isFocused={focusedRoomNumber === room.number}
              isFalling={isThisFloorFalling}
            />
          );
        })}
      </div>
    </div>
  );
};
