'use client';

import React from 'react';

const TICKER_COMMANDS = [
  { icon: '🏨', cmd: '!entrar', desc: 'Consigue tu habitación gratis comentando en el LIVE' },
  { icon: '💬', cmd: 'Comenta', desc: 'Habla con burbuja de cómic y recarga +6% de estabilidad' },
  { icon: '💃', cmd: '!bailar', desc: 'Haz que tu personaje baile al ritmo de la música' },
  { icon: '💤', cmd: '!dormir', desc: 'Descansa en la cama y recupera energía' },
  { icon: '🎮', cmd: '!pc / !jugar', desc: 'Enciende tu computadora gamer RGB' },
  { icon: '📺', cmd: '!tv', desc: 'Mira la transmisión en vivo en tu habitación' },
  { icon: '🌹', cmd: 'Rosa', desc: '+15 Energía y +20 Estabilidad a tu personaje' },
  { icon: '🐶', cmd: 'Corgi', desc: '+Decoración temática y muebles exclusivos' },
  { icon: '🚀', cmd: 'Cohete', desc: 'Mejora tu habitación a nivel PREMIUM' },
  { icon: '👑', cmd: 'Corona / León', desc: '¡Sube de inmediato al VIP Penthouse en la cima!' },
  { icon: '⚠️', cmd: 'Estabilidad', desc: 'Mantente activo en el chat para evitar el desalojo' },
];

export const CommandsAnnouncementBar: React.FC = () => {
  return (
    <div className="w-full bg-slate-950/95 border-b border-amber-500/50 py-1 flex items-center overflow-hidden select-none shadow-md">
      {/* Static Left Badge */}
      <div className="flex items-center gap-1 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 px-2 py-0.5 rounded-r-md font-black text-[9px] tracking-wider uppercase shrink-0 z-10 shadow-sm mr-2">
        <span className="text-xs">📢</span>
        <span>COMANDOS TIKTOK LIVE</span>
      </div>

      {/* Infinite Horizontal Scrolling Ticker (Moving from Right to Left) */}
      <div className="relative flex-1 overflow-hidden">
        <div className="animate-marquee flex items-center gap-6 whitespace-nowrap">
          {/* Render commands list twice for seamless continuous loop */}
          {[...TICKER_COMMANDS, ...TICKER_COMMANDS].map((item, idx) => (
            <div key={idx} className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs">{item.icon}</span>
              <span className="text-[10px] font-mono font-black text-amber-300 bg-slate-900 px-1 rounded border border-slate-700">
                {item.cmd}
              </span>
              <span className="text-[9px] text-slate-200 font-medium">
                {item.desc}
              </span>
              <span className="text-amber-500/40 text-[10px] ml-2">✦</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
