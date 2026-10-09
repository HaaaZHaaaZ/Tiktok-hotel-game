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
  /** Columnas que ocupa esta habitacion (superpoder de expansion). */
  span?: number;
}

export const RoomRenderer: React.FC<RoomRendererProps> = ({
  room,
  resident,
  timeOfDay,
  globalEvent,
  isFocused = false,
  isFalling = false,
  span = 1,
}) => {
  const isOccupied = room.status === 'OCUPADA' || room.status === 'RESERVADA';
  const isVip = room.level === 'VIP';
  // Suite expandida: la habitacion principal ocupa varias columnas y se dibuja
  // como un unico bloque ancho.
  const esHabitacionDoble = span > 1;

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
      data-room-number={room.number}
      className={`relative w-full h-[155px] rounded-lg border-2 flex flex-col justify-between transition-all duration-300 shadow-sm ${wallpaperBg} ${
        isFocused ? 'ring-2 ring-yellow-400 scale-[1.01] z-20 shadow-md' : ''
      } ${isFalling ? 'animate-shake' : ''} ${
        esHabitacionDoble
          ? 'ring-2 ring-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.55)]'
          : ''
      }`}
    >
      {/* Marca de suite expandida: esta habitacion ocupa varias columnas. */}
      {esHabitacionDoble && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-45 pointer-events-none bg-amber-500 text-slate-950 font-black text-[7px] px-1.5 py-[1px] rounded-full border border-amber-200 shadow-lg animate-pulse whitespace-nowrap">
          🏰 SUITE {span}/4
        </div>
      )}
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

      {/* Contador de likes del ocupante, arriba a la derecha de la habitacion.
          Suma los likes que ESE usuario ha dado al live mientras esta dentro y
          vuelve a 0 cuando se va (el residente se borra del mapa). */}
      {resident && resident.likes > 0 && (
        <div
          key={resident.likes}
          className={`absolute top-0.5 right-0.5 z-45 pointer-events-none flex items-center gap-0.5 rounded-full px-1.5 py-[1px] border shadow-lg animate-like-pop ${
            resident.likes >= 500
              ? 'bg-rose-600/95 border-rose-200 text-white'
              : resident.likes >= 100
              ? 'bg-pink-500/95 border-pink-200 text-white'
              : 'bg-white/95 border-rose-300 text-rose-700'
          }`}
          title={`${resident.displayName || resident.username || 'residente'}: ${resident.likes || 0} likes`}
        >
          <span className="text-[7px] leading-none">❤️</span>
          <span className="text-[8px] font-black leading-none tabular-nums">
            {resident.likes >= 1000
              ? `${(resident.likes / 1000).toFixed(1)}k`
              : resident.likes}
          </span>
        </div>
      )}

      {/* Tiempo de estadía restante (solo si el hotel usa tiempo limitado).
          Va debajo del contador de likes, tambien arriba a la derecha. */}
      {resident && typeof resident.stayRemainingSec === 'number' && (
        <div
          className={`absolute z-45 pointer-events-none flex items-center gap-0.5 rounded-full px-1.5 py-[1px] border shadow-md tabular-nums ${
            resident.likes > 0 ? 'top-[15px]' : 'top-0.5'
          } right-0.5 ${
            resident.stayRemainingSec <= 10
              ? 'bg-red-600/95 border-red-200 text-white animate-pulse'
              : 'bg-black/75 border-white/25 text-amber-200'
          }`}
          title="Tiempo de estadía restante"
        >
          <span className="text-[7px] leading-none">⏳</span>
          <span className="text-[8px] font-black leading-none">
            {Math.max(0, Math.round(resident.stayRemainingSec))}s
          </span>
        </div>
      )}

      {/* Falling panic effect if floor is collapsing down */}
      {isFalling && (
        <div className="absolute inset-0 z-35 pointer-events-none flex flex-col items-center justify-center bg-black/25">
          <div className="text-xs animate-bounce">😱 💫 💦</div>
        </div>
      )}

      {/* Globo de dialogo.
          OJO: el globo lo dibuja CharacterRenderer, anclado al personaje.
          Aqui se dibujaba ADEMAS, asi que cuando el residente estaba en su
          habitacion salian DOS burbujas superpuestas (esta y la del personaje
          que va dentro). Se deja solo la del personaje, que es la que sigue su
          cabeza si se mueve. */}

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

          {/* Sleeping character head on pillow.
              Mismo fallo que en CharacterRenderer: si el residente se guardo sin
              avatar (localStorage de una version anterior), leer
              resident.avatar.skinColor reventaba el render. Se cae al color por defecto. */}
          {isSleeping && resident && (
            <div className="absolute -top-2.5 right-0.5 z-15 scale-65 rotate-[-5deg]">
              <div
                className="w-4.5 h-4.5 rounded-full border border-black/30 shadow-xs flex items-center justify-center text-[7px]"
                style={{ backgroundColor: resident.avatar?.skinColor || '#F5CBA7' }}
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
                {resident.displayName || resident.username || 'residente'}
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Roaming Character (Moves freely across room between desk and bed with zero vertical crop!) */}
        {resident ? (
          <>
            {/* Desalojo en curso: el personaje lo dibuja EvictionOverlay cayendo
                por la fachada (aqui no cabria, el recuadro lo recortaria). En su
                lugar queda el destello rojo de la expulsion. */}
            {resident.evicting && (
              <div className="absolute inset-0 z-35 pointer-events-none flex items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-red-500/70 animate-evict-pop" />
                <div className="absolute text-2xl animate-bounce">💥</div>
                <div className="absolute bottom-1 text-[8px] font-black text-red-700 bg-white/90 border border-red-400 rounded px-1 animate-pulse">
                  ¡DESALOJADO!
                </div>
              </div>
            )}

            {!isSleeping && !resident.evicting && (
              <div
                className="absolute bottom-0.5 z-30 overflow-visible flex flex-col items-center select-none transition-all duration-700 ease-out"
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
