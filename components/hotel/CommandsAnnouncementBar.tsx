'use client';

import React from 'react';
import { COMANDOS_PODER } from '../../services/powerCommands';

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
  // Los comandos de PODER van en este mismo ticker, no en una etiqueta aparte:
  // aquella ocupaba mucho ancho y le robaba espacio al hotel. Se sacan de
  // COMANDOS_PODER (la misma fuente que usa el chat para reconocerlos), asi que
  // anadir un poder no obliga a tocar este componente.
  const comandosPoder = COMANDOS_PODER.map((p) => ({
    icon: p.icono,
    cmd: p.cmd,
    desc: `${p.nombre} · se lanza sobre otro residente (${p.likes}❤️)`,
    poder: true,
  }));

  const todos: { icon: string; cmd: string; desc: string; poder?: boolean }[] = [
    ...TICKER_COMMANDS,
    ...comandosPoder,
  ];

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
          {[...todos, ...todos].map((item, idx) => (
            <div key={idx} className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs">{item.icon}</span>
              <span
                className={`text-[10px] font-mono font-black px-1 rounded border ${
                  item.poder
                    ? 'text-purple-200 bg-purple-950/80 border-purple-500/60'
                    : 'text-amber-300 bg-slate-900 border-slate-700'
                }`}
              >
                {item.cmd}
              </span>
              <span
                className={`text-[9px] font-medium ${
                  item.poder ? 'text-purple-200/90' : 'text-slate-200'
                }`}
              >
                {item.desc}
              </span>
              <span
                className={`text-[10px] ml-2 ${
                  item.poder ? 'text-purple-400/60' : 'text-amber-500/40'
                }`}
              >
                {item.poder ? '⚡' : '✦'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
