'use client';

import React from 'react';
import { WeatherType } from '../../types/hotel';

interface WeatherOverlayProps {
  weather: WeatherType;
}

export const WeatherOverlay: React.FC<WeatherOverlayProps> = ({ weather }) => {
  if (weather === 'SOL') {
    return (
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
        {/* Warm sunlight gradient ray */}
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-amber-300/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/15 rounded-full blur-xl" />
      </div>
    );
  }

  if (weather === 'LLUVIA') {
    return (
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden bg-blue-950/15">
        {/* Animated raindrops */}
        {[...Array(24)].map((_, i) => (
          <div
            key={i}
            className="absolute w-[1.5px] h-6 bg-gradient-to-b from-transparent via-cyan-200 to-white/70 animate-bounce"
            style={{
              left: `${(i * 4.2 + 2) % 98}%`,
              top: `${(i * 7 + 5) % 90}%`,
              animationDuration: `${0.45 + (i % 5) * 0.1}s`,
              animationIterationCount: 'infinite',
              opacity: 0.75,
              transform: 'rotate(15deg)',
            }}
          />
        ))}
        {/* Water puddle splash effect at base */}
        <div className="absolute bottom-1 inset-x-0 h-1 bg-cyan-400/20 blur-xs" />
      </div>
    );
  }

  if (weather === 'TORMENTA') {
    return (
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden bg-slate-950/30">
        {/* Lightning flashes */}
        <div className="absolute inset-0 bg-cyan-200/20 mix-blend-screen animate-pulse" style={{ animationDuration: '2.5s' }} />

        {/* Heavy slanted rain */}
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute w-[2px] h-8 bg-gradient-to-b from-transparent via-sky-200 to-white animate-bounce"
            style={{
              left: `${(i * 3.4 + 1) % 98}%`,
              top: `${(i * 6 + 2) % 92}%`,
              animationDuration: `${0.35 + (i % 4) * 0.08}s`,
              animationIterationCount: 'infinite',
              transform: 'rotate(22deg)',
            }}
          />
        ))}

        {/* Occasional Lightning Bolt */}
        <div className="absolute top-2 left-1/4 text-2xl animate-ping opacity-60">⚡</div>
      </div>
    );
  }

  if (weather === 'NIEVE') {
    return (
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden bg-indigo-950/10">
        {[...Array(22)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white shadow-[0_0_4px_#FFF] animate-pulse"
            style={{
              width: `${(i % 3) * 2 + 3}px`,
              height: `${(i % 3) * 2 + 3}px`,
              left: `${(i * 4.6 + 3) % 96}%`,
              top: `${(i * 8 + 4) % 94}%`,
              animationDuration: `${1.8 + (i % 4) * 0.4}s`,
              opacity: 0.85,
            }}
          >
            <span className="text-[8px] text-white/90 select-none">❄</span>
          </div>
        ))}
      </div>
    );
  }

  if (weather === 'NIEBLA') {
    return (
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
        {/* Atmospheric mist drifting across building */}
        <div className="absolute inset-0 bg-slate-300/15 backdrop-blur-[0.5px] animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute -inset-x-20 top-1/4 h-32 bg-white/10 blur-2xl animate-marquee" />
        <div className="absolute -inset-x-20 bottom-1/4 h-32 bg-white/10 blur-2xl animate-marquee" style={{ animationDirection: 'reverse' }} />
      </div>
    );
  }

  if (weather === 'ESTRELLAS') {
    return (
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
        {[...Array(18)].map((_, i) => (
          <div
            key={i}
            className="absolute text-amber-200 animate-ping select-none"
            style={{
              left: `${(i * 5.5 + 4) % 95}%`,
              top: `${(i * 7.5 + 3) % 85}%`,
              fontSize: `${(i % 3) * 2 + 7}px`,
              animationDuration: `${1.2 + (i % 5) * 0.5}s`,
            }}
          >
            ★
          </div>
        ))}
        {/* Shooting star streak */}
        <div className="absolute top-10 right-10 w-24 h-0.5 bg-gradient-to-r from-transparent via-amber-200 to-white rotate-[-35deg] animate-pulse" />
      </div>
    );
  }

  return null;
};
