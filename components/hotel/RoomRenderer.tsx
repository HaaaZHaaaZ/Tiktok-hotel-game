'use client';

import React from 'react';
import { Room, Resident, TimeOfDay, GlobalEventType } from '../../types/hotel';
import { CharacterRenderer } from './CharacterRenderer';

interface RoomRendererProps {
  room: Room;
  resident?: Resident;
  timeOfDay: TimeOfDay;
  globalEvent: GlobalEventType;
  isFocused?: boolean;
  isFalling?: boolean;
}

export const RoomRenderer: React.FC<RoomRendererProps> = ({
  room,
  resident,
  timeOfDay,
  globalEvent,
  isFocused = false,
  isFalling = false,
}) => {
  const isOccupied = room.status === 'OCUPADA' || room.status === 'RESERVADA';
  const isVip = room.level === 'VIP';

  const currentAction = resident?.currentAction || 'idle';
  const isSleeping = currentAction === 'sleeping';
  const isGaming = currentAction === 'gaming';
  const isWatchingTv = currentAction === 'watching_tv';
  const isDancing = currentAction === 'dancing';
  const isCelebrating = currentAction === 'celebrating';
  const isWorried = currentAction === 'worried' || (resident && resident.stability <= 20);

  // Window background based on time & events
  let windowBg = 'bg-sky-300';
  if (timeOfDay === 'evening') windowBg = 'bg-gradient-to-b from-orange-400 via-pink-500 to-indigo-600';
  if (timeOfDay === 'night' || isSleeping) windowBg = 'bg-gradient-to-b from-slate-900 to-indigo-950';
  if (globalEvent === 'TORMENTA') windowBg = 'bg-slate-800';

  // Room wallpaper & styling per level
  let wallpaperBg = 'bg-amber-50 border-amber-300';
  let floorColor = 'bg-amber-200 border-amber-400';
  let bedColor = '#3498DB';

  if (room.level === 'MEJORADA') {
    wallpaperBg = 'bg-teal-50 border-teal-300';
    floorColor = 'bg-teal-100 border-teal-400';
    bedColor = '#9B59B6';
  } else if (room.level === 'PREMIUM') {
    wallpaperBg = 'bg-indigo-950 text-white border-indigo-500/70 shadow-[inset_0_0_12px_rgba(99,102,241,0.3)]';
    floorColor = 'bg-indigo-900 border-indigo-500';
    bedColor = '#E74C3C';
  } else if (room.level === 'VIP') {
    wallpaperBg = 'bg-gradient-to-b from-amber-950 to-slate-900 border-amber-400 shadow-[inset_0_0_15px_rgba(251,191,36,0.35)]';
    floorColor = 'bg-amber-900/80 border-amber-400';
    bedColor = '#F1C40F';
  }

  const isBlackout = globalEvent === 'APAGON';

  // Compute character X position across the open room floor (no dividing bars)
  let targetXPercent = resident?.coordX || 48;
  if (isGaming) targetXPercent = 26; // Sitting right by the PC desk

  return (
    <div
      className={`relative w-full h-[155px] rounded-lg border-2 flex flex-col justify-between transition-all duration-300 shadow-sm ${wallpaperBg} ${
        isFocused ? 'ring-2 ring-yellow-400 scale-[1.01] z-20 shadow-md' : ''
      } ${isFalling ? 'animate-shake' : ''}`}
    >
      {/* Lights-Out Dimming Overlay when Sleeping */}
      {isSleeping && (
        <div className="absolute inset-0 bg-indigo-950/80 z-25 pointer-events-none transition-opacity duration-1000 flex items-start justify-end p-1">
          <div className="w-8 h-8 rounded-full bg-amber-300/15 blur-sm" />
        </div>
      )}

      {/* Blackout Dimming Overlay during blackout event */}
      {isBlackout && (
        <div className="absolute inset-0 bg-black/92 rounded-lg z-30 pointer-events-none flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-yellow-200/25 blur-md animate-pulse" />
        </div>
      )}

      {/* Falling panic effect if floor is collapsing down */}
      {isFalling && (
        <div className="absolute inset-0 z-35 pointer-events-none flex flex-col items-center justify-center bg-black/25">
          <div className="text-xs animate-bounce">😱 💫 💦</div>
        </div>
      )}

      {/* Globo de dialogo, sobre la cabeza del residente.
          Antes se renderizaba en top-1, encima de la pared de la habitacion, y
          quedabahidden tras el marco: no se leia nada. Ahora se centra en el
          espacio del personaje y se dibuja DESPUES (z-40) para que nada lo tape. */}
      {resident?.speechBubble && (
        <div className="absolute inset-x-0 top-8 z-40 flex justify-center pointer-events-none px-1">
          <div className="relative bg-white text-slate-950 px-1.5 py-1 rounded-md border-2 border-slate-900 shadow-xl text-[8px] font-black max-w-[110px] text-center leading-tight break-words whitespace-normal animate-in zoom-in-95 duration-200">
            <span className="text-amber-500 mr-0.5">💬</span>
            {resident.speechBubble.text}
            {/* Rabito apuntando al personaje */}
            <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[4px] border-t-slate-900" />
            <div className="absolute left-1/2 -bottom-0.5 -translate-x-1/2 w-0 h-0 border-l-[2px] border-l-transparent border-r-[2px] border-r-transparent border-t-[3px] border-t-white" />
          </div>
        </div>
      )}

      {/* Top Wall Zone: Room Number, Window & Wall TV */}
      <div className="relative h-10 px-1 pt-1 flex items-start justify-between border-b border-black/10 z-10 shrink-0">
        {/* Room Number Sign */}
        <div className="flex items-center gap-0.5 bg-black/85 px-1 py-0.5 rounded shadow-xs border border-white/10 shrink-0">
          <div
            className={`w-1 h-1 rounded-full ${
              isOccupied
                ? isSleeping
                  ? 'bg-indigo-400 animate-pulse'
                  : isVip
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-emerald-400'
                : 'bg-slate-400'
            }`}
          />
          <span className="text-[8px] font-black text-white tracking-tight">
            {room.number}
          </span>
          {room.level !== 'NORMAL' && (
            <span className="text-[7px] text-amber-300 font-bold">
              {room.level === 'VIP' ? '★' : room.level === 'PREMIUM' ? '✦' : '+'}
            </span>
          )}
        </div>

        {/* Scenic Window */}
        <div
          className={`relative w-8 h-6 rounded-xs border border-white/50 overflow-hidden shadow-inner ${windowBg} shrink-0`}
        >
          {timeOfDay === 'day' && !isSleeping && (
            <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-yellow-300 shadow-[0_0_3px_#F59E0B]" />
          )}
          {(timeOfDay === 'night' || isSleeping) && (
            <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-slate-100 shadow-[0_0_2px_#FFF]" />
          )}
        </div>

        {/* Wall TV */}
        <div className="w-7 h-5 bg-slate-900 rounded-xs border border-slate-600 flex items-center justify-center overflow-hidden shadow-xs shrink-0">
          {isWatchingTv ? (
            <div className="w-full h-full bg-cyan-400 animate-pulse flex items-center justify-center text-[6px] text-black font-black">
              LIVE
            </div>
          ) : (
            <div className="text-[6px] text-slate-400 font-bold font-mono">TV</div>
          )}
        </div>
      </div>

      {/* UNIFIED OPEN FLOOR ZONE (No dividing vertical bars, free movement left and right!) */}
      <div className={`relative flex-1 ${floorColor} border-t-2 px-1 pb-0.5 overflow-hidden`}>
        {/* Left Side: Gamer Desk with PC Monitor */}
        <div className="absolute bottom-1 left-1 w-7 flex flex-col items-center z-10 pointer-events-none">
          <div
            className={`w-5.5 h-4 rounded-xs border flex items-center justify-center text-[5px] font-bold ${
              isGaming
                ? 'bg-purple-600 border-cyan-400 text-cyan-200 animate-pulse shadow-[0_0_4px_#00F]'
                : 'bg-slate-800 border-slate-600 text-slate-400'
            }`}
          >
            {isGaming ? '🎮' : 'PC'}
          </div>
          <div className="w-6.5 h-2 bg-amber-800 rounded-t-xs border-t border-amber-700 shadow-xs" />
        </div>

        {/* Right Side: Bed with Pillow and Blanket */}
        <div className="absolute bottom-1 right-1 w-9 flex flex-col items-end z-10 pointer-events-none">
          {isSleeping && (
            <div className="absolute -top-4 right-1 z-30 flex items-center gap-0.5 text-indigo-300 font-mono font-black text-[8px] animate-bounce">
              <span>💤</span>
              <span className="text-[9px]">Z</span>
            </div>
          )}

          <div className="w-3 h-1 bg-white rounded-t border border-slate-300 mr-0.5" />

          {/* Sleeping character head on pillow */}
          {isSleeping && resident && (
            <div className="absolute -top-2.5 right-0.5 z-15 scale-65 rotate-[-5deg]">
              <div
                className="w-4.5 h-4.5 rounded-full border border-black/30 shadow-xs flex items-center justify-center text-[7px]"
                style={{ backgroundColor: resident.avatar.skinColor }}
              >
                <span>😴</span>
              </div>
            </div>
          )}

          <div
            className={`w-9 h-4.5 rounded-t border shadow-xs relative overflow-hidden transition-all ${
              isSleeping ? 'ring-1 ring-indigo-400 shadow-[0_0_6px_rgba(99,102,241,0.5)]' : ''
            }`}
            style={{ backgroundColor: bedColor }}
          >
            <div className="w-full h-1 bg-white/80 border-b border-black/10" />
            {isSleeping && resident && (
              <div className="absolute inset-x-0 bottom-0.5 flex justify-center text-[5px] text-white/90 font-black truncate px-0.5">
                {resident.displayName}
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Roaming Character (Moves freely across room between desk and bed with zero vertical crop!) */}
        {resident ? (
          <>
            {!isSleeping && (
              <div
                className={`absolute bottom-0.5 z-30 overflow-visible flex flex-col items-center select-none transition-all duration-700 ease-out ${
                  isFalling ? 'animate-tumble' : ''
                }`}
                style={{
                  left: `${Math.max(22, Math.min(72, targetXPercent))}%`,
                  transform: 'translateX(-50%)',
                }}
              >
                {/* Character Chibi Renderer with integrated z-50 superior layer animations */}
                <div style={{ transform: `scaleX(${resident.direction === 'left' ? -1 : 1})` }}>
                  <CharacterRenderer resident={resident} scale={0.84} showName={true} />
                </div>
              </div>
            )}

            {isSleeping && (
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[7px] text-slate-400 opacity-60 flex items-center gap-0.5 select-none">
                <span>🩴</span>
                <span>🩴</span>
              </div>
            )}
          </>
        ) : room.occupantId ? (
          <div className="absolute bottom-1.5 inset-x-0 text-slate-500 text-[7px] font-bold tracking-tight flex flex-col items-center select-none animate-pulse">
            <span className="text-amber-500">🚪 ENTRANDO</span>
          </div>
        ) : (
          <div className="absolute bottom-1.5 inset-x-0 text-slate-400 text-[8px] font-bold flex flex-col items-center select-none opacity-60">
            <span className="text-[7px] text-emerald-600 uppercase">LIBRE</span>
          </div>
        )}
      </div>
    </div>
  );
};
