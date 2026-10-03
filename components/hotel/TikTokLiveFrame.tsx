'use client';

import React from 'react';
import { useHotel } from '../../context/HotelContext';

export const TikTokLiveFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showSafeZoneGuides } = useHotel();

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-slate-950 overflow-hidden">
      {/* 9:16 Aspect Ratio Canvas Container (1080 x 1920 logical proportions) */}
      <div className="relative w-full max-w-[500px] h-[96vh] max-h-[960px] aspect-[9/16] bg-slate-900 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] border-4 border-slate-800 overflow-hidden flex flex-col">
        {/* Core Game View Area */}
        <div className="relative flex-1 w-full h-full overflow-hidden flex flex-col">
          {children}
        </div>

        {/* TikTok LIVE Safe Zone Overlays (Streamer visual check guide) */}
        {showSafeZoneGuides && (
          <div className="absolute inset-0 pointer-events-none z-50 flex flex-col justify-between p-4 border-2 border-dashed border-pink-500/40">
            {/* Top TikTok Live Header simulation overlay */}
            <div className="w-full flex items-center justify-between opacity-70">
              <div className="flex items-center gap-2 bg-black/60 px-2 py-1 rounded-full border border-white/20">
                <div className="w-6 h-6 rounded-full bg-pink-500 text-[10px] text-white font-bold flex items-center justify-center">
                  LIVE
                </div>
                <div className="text-[10px] text-white font-bold">@tiktok_hotel</div>
                <div className="bg-pink-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                  + Seguir
                </div>
              </div>

              <div className="flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded-full text-white text-[10px] font-bold border border-white/20">
                <span>👁️ 1.4K</span>
              </div>
            </div>

            {/* Middle Safe Zone Indicator */}
            <div className="self-center bg-pink-600/30 text-pink-200 border border-pink-400/40 px-3 py-1 rounded-full text-[10px] font-bold backdrop-blur-xs">
              ZONA SEGURA 9:16 PARA TIKTOK LIVE
            </div>

            {/* Bottom TikTok Live Chat & Gift Tray Overlay */}
            <div className="w-full flex flex-col gap-2 opacity-60">
              {/* Fake Live Chat box area */}
              <div className="w-3/5 bg-black/50 rounded-xl p-2 flex flex-col gap-1 border border-white/10">
                <div className="text-[9px] text-yellow-300 font-bold">user123: ¡Hola hotel! 👋</div>
                <div className="text-[9px] text-cyan-300 font-bold">sofia: ¡Quiero ser VIP! 👑</div>
                <div className="text-[9px] text-pink-300 font-bold">carlos: ¡Mandé una rosa! 🌹</div>
              </div>

              {/* Bottom Buttons Tray */}
              <div className="flex items-center justify-between">
                <div className="bg-white/10 text-white text-[10px] px-3 py-1.5 rounded-full">
                  Añadir comentario...
                </div>
                <div className="flex items-center gap-2 text-lg">
                  <span>🎁</span>
                  <span>❤️</span>
                  <span>↗️</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
