'use client';

import React from 'react';
import { Resident, TimeOfDay } from '../../types/hotel';
import { CharacterRenderer } from './CharacterRenderer';

interface PenthouseRendererProps {
  vipResidents: Resident[];
  timeOfDay: TimeOfDay;
  isFocused?: boolean;
}

export const PenthouseRenderer: React.FC<PenthouseRendererProps> = ({
  vipResidents,
  timeOfDay,
  isFocused = false,
}) => {
  return (
    <div
      className={`relative w-full rounded-t-2xl border-t-4 border-x-4 border-amber-400 bg-gradient-to-b from-slate-900 via-amber-950 to-slate-950 p-2 shadow-2xl overflow-hidden transition-all duration-500 ${
        isFocused ? 'ring-4 ring-amber-300 scale-[1.02] z-30' : ''
      }`}
    >
      {/* Golden Penthouse Neon Sign */}
      <div className="flex items-center justify-between border-b border-amber-500/40 pb-1 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-base animate-bounce">👑</span>
          <span className="text-xs font-black tracking-widest text-amber-300 drop-shadow-[0_0_8px_#F59E0B]">
            VIP PENTHOUSE ROOFTOP
          </span>
          <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-400/40 px-1.5 py-0.2 rounded font-bold">
            EXCLUSIVO
          </span>
        </div>
        <div className="text-[10px] text-amber-200/80 font-semibold flex items-center gap-1">
          <span>{vipResidents.length} Residentes VIP</span>
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
        </div>
      </div>

      {/* Panoramic Skyline & Terrace Scene */}
      <div className="grid grid-cols-3 gap-2 items-end">
        {/* Left: Luxury Jacuzzi with bubbles */}
        <div className="relative h-28 bg-amber-900/30 rounded-xl border border-amber-400/50 p-1.5 flex flex-col justify-between overflow-hidden shadow-inner">
          <div className="flex items-center justify-between text-[8px] font-bold text-amber-300">
            <span>♨️ JACUZZI</span>
            <span className="text-cyan-300 animate-pulse">40°C</span>
          </div>

          {/* Jacuzzi Tub */}
          <div className="relative w-full h-16 bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-b-xl border-2 border-amber-400 shadow-md flex items-center justify-center overflow-hidden">
            {/* Water Ripples & Steam Bubbles */}
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
            <div className="absolute -top-1 w-2 h-2 bg-white/70 rounded-full animate-bounce" />
            <div className="absolute -top-2 left-4 w-1.5 h-1.5 bg-white/60 rounded-full animate-ping" />
            <div className="text-[10px] text-white/80 font-black">BUBBLES</div>

            {/* Resident soaking in Jacuzzi if available */}
            {vipResidents[0] && (
              <div className="absolute -bottom-1 z-10 scale-75">
                <CharacterRenderer resident={vipResidents[0]} showName={true} />
              </div>
            )}
          </div>
        </div>

        {/* Center: VIP Lounge Terrace & Gold Sunbeds */}
        <div className="relative h-28 bg-gradient-to-b from-indigo-950/60 to-amber-950/40 rounded-xl border border-amber-400/40 p-1.5 flex flex-col justify-between items-center overflow-hidden">
          <div className="text-[9px] font-bold text-amber-200 tracking-wider">
            🍸 SKY LOUNGE
          </div>

          {/* Center Residents Lounging */}
          <div className="flex items-end justify-center gap-2 h-16 w-full">
            {vipResidents.length > 1 ? (
              vipResidents.slice(1, 3).map((res) => (
                <div key={res.id} className="scale-75">
                  <CharacterRenderer resident={res} showName={true} />
                </div>
              ))
            ) : (
              <div className="text-[9px] text-amber-300/60 italic text-center py-2">
                Envía una Corona 👑 o León 🦁 para subir aquí
              </div>
            )}
          </div>

          {/* Terrace Golden Balustrade */}
          <div className="w-full h-2.5 border-t-2 border-amber-400/70 flex justify-around">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="w-[2px] h-full bg-amber-400/60" />
            ))}
          </div>
        </div>

        {/* Right: VIP Bar & Private Gold Elevator */}
        <div className="relative h-28 bg-amber-900/30 rounded-xl border border-amber-400/50 p-1.5 flex flex-col justify-between overflow-hidden shadow-inner">
          <div className="flex items-center justify-between text-[8px] font-bold text-amber-300">
            <span>🍹 BAR PRIVADO</span>
            <span className="text-amber-400">★ ★ ★</span>
          </div>

          {/* Bar Counter & Bottles */}
          <div className="relative w-full h-16 bg-slate-900 rounded-b-xl border border-amber-400/60 p-1 flex flex-col justify-between">
            <div className="flex justify-around items-end h-6 border-b border-amber-500/30">
              <div className="w-1.5 h-4 bg-emerald-400 rounded-t-xs" />
              <div className="w-1.5 h-5 bg-amber-400 rounded-t-xs" />
              <div className="w-1.5 h-4 bg-red-400 rounded-t-xs" />
              <div className="w-1.5 h-5 bg-cyan-400 rounded-t-xs" />
            </div>
            <div className="w-full h-4 bg-amber-700 rounded text-[7px] text-amber-200 font-bold flex items-center justify-center">
              BAR VIP
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
