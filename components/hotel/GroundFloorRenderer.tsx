'use client';

import React from 'react';
import { Resident, TimeOfDay, GlobalEventType, ReceptionAttendingState, QueueResident, PersonalityType } from '../../types/hotel';
import { ElevatorRenderer } from './ElevatorRenderer';
import { CharacterRenderer } from './CharacterRenderer';

interface GroundFloorRendererProps {
  timeOfDay: TimeOfDay;
  globalEvent: GlobalEventType;
  isElevatorOpen?: boolean;
  corridorResidents?: Resident[];
  entryQueue?: QueueResident[];
  receptionAttending?: ReceptionAttendingState | null;
}

export const GroundFloorRenderer: React.FC<GroundFloorRendererProps> = ({
  timeOfDay,
  globalEvent,
  isElevatorOpen = false,
  corridorResidents = [],
  entryQueue = [],
  receptionAttending = null,
}) => {
  // NPC Receptionist: "Don Pepe" (friendly concierge/clerk)
  const receptionistNPC: Resident = {
    id: 'npc_receptionist',
    username: 'DonPepe_Recepción',
    displayName: '🛎️ Don Pepe',
    avatar: {
      skinColor: '#F0C08A',
      hairStyle: 'sleek',
      hairColor: '#D4A373',
      outfitStyle: 'suit',
      outfitColor: '#C0392B',
      accessory: 'glasses',
      eyeType: 'happy',
    },
    personality: 'elegante',
    roomId: '',
    floorNumber: 0,
    energy: 100,
    stability: 100,
    popularity: 500,
    points: 1000,
    vipLevel: 0,
    currentAction: 'idle',
    location: 'reception',
    coordX: 50,
    direction: 'left',
  };

  const isBlackout = globalEvent === 'APAGON';
  const isPbElevatorOperating = isElevatorOpen || receptionAttending?.step === 'in_elevator';

  // Helper to convert queue/attending user into a full Resident to render with exact same appearance
  const toResident = (
    id: string,
    username: string,
    displayName: string,
    avatar: QueueResident['avatar'],
    personality: PersonalityType = 'gamer',
    action: Resident['currentAction'] = 'idle',
    direction: Resident['direction'] = 'right'
  ): Resident => ({
    id,
    username,
    displayName,
    avatar,
    personality,
    roomId: '',
    floorNumber: 0,
    energy: 100,
    stability: 100,
    popularity: 100,
    points: 0,
    vipLevel: 0,
    currentAction: action,
    location: 'reception',
    coordX: 50,
    direction,
  });

  return (
    <div className="relative w-full rounded-b-2xl border-4 border-slate-700 bg-gradient-to-r from-red-950 via-stone-900 to-red-950 p-2 shadow-2xl flex flex-col justify-between overflow-hidden">
      {/* Blackout Dimming Overlay */}
      {isBlackout && (
        <div className="absolute inset-0 bg-black/92 z-30 pointer-events-none flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-yellow-200/25 blur-md animate-pulse" />
        </div>
      )}

      {/* Lobby Header Marquee */}
      <div className="flex items-center justify-between px-3 py-1 mb-2 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 rounded-lg shadow-md border border-amber-300/60">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">🛎️</span>
          <span className="text-xs font-black text-slate-950 tracking-wider">
            PLANTA BAJA — RECEPCIÓN & LOBBY DE DON PEPE
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-950 bg-amber-400 px-2 py-0.5 rounded shadow-xs">
          <span>FILA: {entryQueue.length} ESPERANDO</span>
          {entryQueue.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />}
        </div>
      </div>

      {/* Main Lobby Scene */}
      <div className="relative w-full h-36 bg-stone-900/90 rounded-xl border-2 border-amber-600/70 p-2 flex items-center justify-between shadow-inner overflow-hidden">
        {/* Hallway carpet runner pattern */}
        <div className="absolute inset-x-0 bottom-2 h-10 bg-red-800/80 border-y border-amber-400/50 shadow-md flex justify-around items-center">
          {[...Array(16)].map((_, i) => (
            <div key={i} className="w-2 h-full border-r border-amber-500/20" />
          ))}
        </div>

        {/* 1. Left Side: Entrance Double Doors from the street */}
        <div className="relative flex items-end gap-1 z-10 shrink-0">
          <div className="flex flex-col items-center">
            <div className="text-[7px] font-bold text-emerald-400 mb-0.5 animate-pulse">
              ◄ ENTRADA
            </div>
            <div className="w-12 h-22 bg-gradient-to-b from-sky-900/60 to-slate-900 rounded-t border-2 border-cyan-400/60 p-0.5 flex justify-between shadow-md">
              <div className="w-[48%] h-full bg-cyan-200/20 rounded-t-xs border-r border-cyan-400/40" />
              <div className="w-[48%] h-full bg-cyan-200/20 rounded-t-xs border-l border-cyan-400/40" />
            </div>
          </div>
        </div>

        {/* 2. Visual Waiting Line (Fila de espera de espectadores con SU AVATAR REAL IDÉNTICO) */}
        <div className="relative flex-1 h-full flex items-end justify-start pl-2 z-15 overflow-hidden">
          {entryQueue.length > 0 && (
            <div className="flex items-end gap-2 animate-in fade-in duration-300 pb-1">
              {entryQueue.slice(0, 3).map((item, idx) => {
                const waitingRes = toResident(
                  item.id,
                  item.username,
                  item.displayName,
                  item.avatar,
                  item.personality,
                  'idle',
                  'right'
                );
                return (
                  <div key={item.id || idx} className="flex items-end gap-0.5 scale-75 origin-bottom opacity-90">
                    <CharacterRenderer resident={waitingRes} scale={0.78} showName={true} />
                    <span className="text-xs pb-1">🧳</span>
                  </div>
                );
              })}

              {entryQueue.length > 3 && (
                <div className="bg-amber-500 text-slate-950 font-black text-[8px] px-1.5 py-0.5 rounded-full shadow-md animate-pulse">
                  +{entryQueue.length - 3} más
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Center: Reception Counter with Don Pepe & Currently Attended User (AVATAR REAL IDÉNTICO) */}
        <div className="relative flex flex-col items-center z-20 shrink-0">
          {/* Don Pepe Speech Bubble when assigning room */}
          {receptionAttending && (
            <div className="absolute top-1 left-1/2 -translate-x-1/2 z-40 bg-white text-slate-950 px-2.5 py-1 rounded-xl border-2 border-slate-900 shadow-2xl text-[9px] font-black animate-bounce whitespace-nowrap flex items-center gap-1">
              <span>{receptionAttending.dialogueText}</span>
              <div className="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-slate-900" />
            </div>
          )}

          <div className="flex items-end gap-1">
            {/* Don Pepe the Clerk */}
            <div className="scale-85 origin-bottom">
              <CharacterRenderer resident={receptionistNPC} showName={true} />
            </div>

            {/* Reception Desk */}
            <div className="relative w-24 h-14 bg-gradient-to-b from-amber-800 to-amber-950 rounded-t-lg border-2 border-amber-500 shadow-xl flex flex-col justify-between p-1">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs">🛎️</span>
                <span className="text-[7px] font-black text-amber-300">CHECK-IN</span>
              </div>
              <div className="w-full bg-black/70 rounded py-0.5 text-center text-[8px] font-black text-amber-400">
                DON PEPE
              </div>
            </div>

            {/* User currently at desk receiving keycard (EXACT REAL CHIBI AVATAR) */}
            {receptionAttending && receptionAttending.step === 'at_desk' && (
              <div className="flex items-end gap-0.5 scale-80 origin-bottom animate-in fade-in zoom-in-95 duration-200">
                <CharacterRenderer
                  resident={toResident(
                    receptionAttending.residentId,
                    receptionAttending.username,
                    receptionAttending.displayName,
                    receptionAttending.avatar,
                    receptionAttending.personality || 'gamer',
                    'celebrating',
                    'left'
                  )}
                  scale={0.82}
                  showName={true}
                />
                <span className="text-xs pb-1">🧳</span>
              </div>
            )}
          </div>
        </div>

        {/* 4. User Walking towards PB Elevator (EXACT REAL CHIBI AVATAR) */}
        {receptionAttending && receptionAttending.step === 'walking_to_elevator' && (
          <div className="absolute bottom-2 left-[62%] z-25 flex items-end gap-0.5 scale-80 origin-bottom transition-all duration-700">
            <CharacterRenderer
              resident={toResident(
                receptionAttending.residentId,
                receptionAttending.username,
                receptionAttending.displayName,
                receptionAttending.avatar,
                receptionAttending.personality || 'gamer',
                'walking',
                'right'
              )}
              scale={0.82}
              showName={true}
            />
            <span className="text-xs pb-1">🧳</span>
          </div>
        )}

        {/* 5. Main Ground Floor Elevator */}
        <div className="relative z-10 shrink-0 scale-95">
          <ElevatorRenderer
            floorNumber={0}
            isOpen={isPbElevatorOperating}
            passengerName={receptionAttending?.step === 'in_elevator' ? receptionAttending.displayName : undefined}
          />
        </div>

        {/* 6. Right Side: Waiting Lounge & Sofa */}
        <div className="relative flex items-end gap-1 z-10 shrink-0 pl-1">
          <div className="flex flex-col items-center pb-1">
            <div className="w-12 h-6 bg-red-700 rounded-t-lg border-2 border-red-500 shadow-md flex items-center justify-center text-[7px] font-bold text-white">
              SOFÁ
            </div>
            <div className="w-12 h-1.5 bg-amber-900 rounded-b" />
          </div>

          <div className="flex flex-col items-center pb-1">
            <span className="text-base">🌴</span>
            <div className="w-4 h-2.5 bg-amber-900 rounded-b border border-amber-700" />
          </div>
        </div>
      </div>
    </div>
  );
};
