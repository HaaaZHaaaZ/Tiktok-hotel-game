'use client';

import React from 'react';
import { APP_VERSION, APP_VERSION_NOTES } from '../../version';
import { useHotel } from '../../context/HotelContext';
import { CommandsAnnouncementBar } from './CommandsAnnouncementBar';

export const HotelHud: React.FC = () => {
  const {
    state,
    activeFloorNumber,
    setActiveFloorNumber,
    isAudioMuted,
    setIsAudioMuted,
    isSpeechMuted,
    setIsSpeechMuted,
    showSafeZoneGuides,
    setShowSafeZoneGuides,
  } = useHotel();

  const totalResidents = Object.keys(state.residents).length;
  const totalHotelRooms = state.floors.length * 4;
  const currentFloor = state.floors.find((f) => f.floorNumber === activeFloorNumber) || state.floors[0];
  const maxFloorRooms = currentFloor ? currentFloor.rooms.length : 4;
  const floorOccupiedCount = Object.values(state.rooms).filter(
    (r) => r.floorNumber === activeFloorNumber && (r.status === 'OCUPADA' || r.status === 'RESERVADA')
  ).length;

  const activeVip = state.vipPenthouseResidents.length > 0
    ? state.residents[state.vipPenthouseResidents[state.vipPenthouseResidents.length - 1]]
    : null;

  return (
    <div className="w-full select-none z-30 pointer-events-auto" suppressHydrationWarning>
      {/* Top Main Status Bar */}
      <div className="bg-black/85 backdrop-blur-md border-b-2 border-amber-500/70 px-3 py-2 flex items-center justify-between shadow-xl" suppressHydrationWarning>
        {/* Brand & Floor Indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-gradient-to-r from-red-600 via-pink-600 to-amber-500 px-2 py-0.5 rounded shadow-sm">
            <span className="text-sm">🏨</span>
            <span className="text-xs font-black tracking-tight text-white uppercase drop-shadow-xs">
              TikTok Hotel
            </span>
          </div>

          {/* Version visible: con el despliegue por archivo el navegador puede
              quedarse con un bundle viejo en cache. Con la version en pantalla
              se comprueba de un vistazo si lo que se prueba es lo desplegado. */}
          <span
            title={`Cambios: ${APP_VERSION_NOTES.join(' · ')}`}
            className="text-[10px] bg-black/50 text-slate-400 px-1.5 py-0.5 rounded border border-slate-800 font-mono cursor-help"
          >
            v{APP_VERSION}
          </span>

          {/* Building Floors Indicator Badge (Broadcast display only) */}
          <span className="text-[10px] bg-slate-800/90 text-amber-300 px-2 py-0.5 rounded border border-slate-700 font-bold font-mono">
            {state.floors.length} PISOS ACTIVOS
          </span>
        </div>

        {/* Center: Live Occupancy & VIP Indicator */}
        <div className="flex items-center gap-3">
          {/* Residents Occupancy */}
          <div className="flex items-center gap-1 text-[11px] font-bold text-white">
            <span className="text-emerald-400">👥</span>
            <span>{totalResidents}/{totalHotelRooms}</span>
            <span className="text-[9px] text-amber-300 font-mono">({state.floors.length}P)</span>
          </div>

          {/* VIP Badge */}
          <div className="flex items-center gap-1 bg-amber-950/80 border border-amber-400/50 px-2 py-0.5 rounded text-[10px] font-bold text-amber-300 shadow-xs">
            <span>👑</span>
            <span>{activeVip ? activeVip.displayName : 'SIN VIP'}</span>
          </div>
        </div>

        {/* Right: Broadcast Status & Link to Admin */}
        <div className="flex items-center gap-2">
          <span className="text-xs" title={`Hora: ${state.timeOfDay}`}>
            {state.timeOfDay === 'day' ? '☀️' : state.timeOfDay === 'evening' ? '🌇' : '🌙'}
          </span>
          <a
            href="/admin"
            className="text-[9px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded font-black tracking-wider uppercase transition-colors"
          >
            ⚙️ Admin
          </a>
        </div>
      </div>

      {/* Ephemeral Notification Banner (Max 1 discreet alert line) */}
      {state.notifications.length > 0 && (
        <div
          suppressHydrationWarning
          className="w-full bg-slate-900/90 border-b border-amber-500/30 px-3 py-1 flex items-center justify-between text-[10px] text-amber-200 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-center gap-1.5 truncate" suppressHydrationWarning>
            <span>{state.notifications[0].icon}</span>
            <span className="truncate">{state.notifications[0].text}</span>
          </div>
          <span className="text-[8px] text-slate-400 shrink-0 ml-2">reciente</span>
        </div>
      )}

      {/* Live Stream Commands Announcement Ticker Bar */}
      <CommandsAnnouncementBar />
    </div>
  );
};
