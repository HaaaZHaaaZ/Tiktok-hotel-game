'use client';

import React from 'react';
import { GlobalEventState } from '../../types/hotel';

export const GlobalEventOverlay: React.FC<{ eventState: GlobalEventState }> = ({ eventState }) => {
  if (eventState.type === 'NONE') return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
      {/* Event Title Banner Toast at top */}
      <div className="absolute top-16 inset-x-4 flex justify-center z-50 animate-in fade-in slide-in-from-top-4 duration-300">
        <div className="bg-black/85 backdrop-blur-md border-2 border-amber-400 px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-3">
          <span className="text-2xl animate-bounce">
            {eventState.type === 'FIESTA'
              ? '🎉'
              : eventState.type === 'APAGON'
              ? '⚡'
              : eventState.type === 'INCENDIO'
              ? '🔥'
              : eventState.type === 'RATAS'
              ? '🐀'
              : eventState.type === 'TORMENTA'
              ? '⛈️'
              : eventState.type === 'FUEGOS'
              ? '🎆'
              : '🛸'}
          </span>
          <div>
            <div className="text-xs font-black text-amber-300 tracking-wider">
              {eventState.title}
            </div>
            <div className="text-[10px] text-white/90 font-medium">
              {eventState.message}
            </div>
          </div>
        </div>
      </div>

      {/* Fiesta: Disco Ball & Party Lights */}
      {eventState.type === 'FIESTA' && (
        <>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce">
            <div className="w-0.5 h-12 bg-white/70" />
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-slate-300 via-white to-slate-400 shadow-[0_0_20px_#FFF] border border-white flex items-center justify-center text-lg animate-spin">
              🪩
            </div>
          </div>
          {/* Strobe Color Flashes */}
          <div className="absolute inset-0 bg-gradient-to-tr from-pink-500/15 via-purple-500/10 to-cyan-500/15 animate-pulse mix-blend-screen" />
        </>
      )}

      {/* Apagón: Flashlight Beams */}
      {eventState.type === 'APAGON' && (
        <div className="absolute inset-0 bg-black/80">
          {/* Wandering flashlight beam */}
          <div className="absolute top-1/3 left-1/4 w-44 h-44 rounded-full bg-yellow-100/20 blur-xl animate-[pulse_1.5s_infinite]" />
          <div className="absolute top-2/3 right-1/4 w-36 h-36 rounded-full bg-yellow-100/15 blur-xl animate-[pulse_2s_infinite]" />
        </div>
      )}

      {/* Incendio: Emergency Red Beacons */}
      {eventState.type === 'INCENDIO' && (
        <div className="absolute inset-0 bg-red-600/20 animate-pulse pointer-events-none">
          <div className="absolute top-4 left-6 text-2xl animate-spin">🚨</div>
          <div className="absolute top-4 right-6 text-2xl animate-spin">🚨</div>
        </div>
      )}

      {/* Rat Invasion: Cartoon mice running along hallway */}
      {eventState.type === 'RATAS' && (
        <div className="absolute inset-x-0 bottom-1/2 flex justify-around">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="text-base animate-[bounce_0.6s_ease-in-out_infinite]"
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              🐀
            </div>
          ))}
        </div>
      )}

      {/* Tormenta: Rain streaks and lightning */}
      {eventState.type === 'TORMENTA' && (
        <div className="absolute inset-0 bg-blue-950/25">
          {/* Lightning Flash */}
          <div className="absolute inset-0 bg-white/30 animate-[ping_2s_infinite]" />
          <div className="absolute inset-0 flex justify-around opacity-40">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="w-[1px] h-full bg-gradient-to-b from-transparent via-cyan-200 to-transparent animate-[pulse_0.8s_infinite]"
              />
            ))}
          </div>
        </div>
      )}

      {/* Fuegos Artificiales */}
      {eventState.type === 'FUEGOS' && (
        <div className="absolute inset-0">
          <div className="absolute top-12 left-10 text-3xl animate-ping">✨</div>
          <div className="absolute top-24 right-12 text-3xl animate-ping" style={{ animationDelay: '0.4s' }}>🌟</div>
          <div className="absolute top-36 left-1/3 text-4xl animate-bounce" style={{ animationDelay: '0.7s' }}>🎆</div>
        </div>
      )}

      {/* Visita OVNI */}
      {eventState.type === 'OVNI' && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 flex flex-col items-center">
          <div className="text-4xl animate-bounce">🛸</div>
          <div className="w-32 h-64 bg-gradient-to-b from-cyan-400/40 to-transparent clip-path-polygon blur-xs animate-pulse" />
        </div>
      )}
    </div>
  );
};
