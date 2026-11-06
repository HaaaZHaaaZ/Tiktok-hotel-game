'use client';

import React from 'react';

export const CONSTRUCCION_MS = 2600;

export const FloorConstructionOverlay: React.FC<{ floorNumber: number }> = ({ floorNumber }) => {
  return (
    <div className="absolute inset-0 z-40 pointer-events-none overflow-visible">
      <style>{`
        /* 1. Grúa: cable vertical que baja del borde superior al centro, con gancho. */
        @keyframes build-cable {
          0%   { transform: translateY(-100%); opacity: 0; }
          8%   { transform: translateY(0); opacity: 1; }
          70%  { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-100%); opacity: 0; }
        }
        .build-cable {
          animation: build-cable 1.6s ease-in-out both;
        }

        /* Gancho en la punta del cable. */
        @keyframes build-hook {
          0%   { transform: translateY(-100%) scale(0.6); opacity: 0; }
          8%   { transform: translateY(0) scale(1); opacity: 1; }
          70%  { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-100%) scale(0.6); opacity: 0; }
        }
        .build-hook {
          animation: build-hook 1.6s ease-in-out both;
        }

        /* 2. Andamios: franjas verticales a cada lado. */
        @keyframes build-scaffold-left {
          0%   { transform: translateX(0); opacity: 1; }
          66%  { transform: translateX(0); opacity: 1; }
          100% { transform: translateX(-120%); opacity: 0; }
        }
        .build-scaffold-left {
          animation: build-scaffold-left 2.4s ease-in both;
        }

        @keyframes build-scaffold-right {
          0%   { transform: translateX(0); opacity: 1; }
          66%  { transform: translateX(0); opacity: 1; }
          100% { transform: translateX(120%); opacity: 0; }
        }
        .build-scaffold-right {
          animation: build-scaffold-right 2.4s ease-in both;
        }

        /* 3. Polvo: bocanadas en el borde inferior. */
        /* 0% en opacity 0: con animation-fill-mode both, el primer fotograma se
           ve DURANTE el retraso; si empezara visible, el polvo y las chispas
           aparecerian quietos desde t=0. */
        @keyframes build-dust {
          0%   { transform: scale(0.3); opacity: 0; }
          10%  { opacity: 0.8; }
          100% { transform: scale(2); opacity: 0; }
        }
        .build-dust {
          animation: build-dust 0.8s ease-out both;
        }

        /* Chispas en las esquinas inferiores. */
        @keyframes build-spark {
          0%   { transform: translateY(0) scale(1); opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: translateY(-18px) scale(0.3); opacity: 0; }
        }
        .build-spark {
          animation: build-spark 0.8s ease-out both;
        }

        /* 4. Luces: rectángulos que se encienden uno tras otro. */
        @keyframes build-light {
          0%   { opacity: 0; }
          40%  { opacity: 0.5; }
          100% { opacity: 0; }
        }
        .build-light {
          animation: build-light 1.3s ease-out both;
        }

        /* 5. Cinta: texto con rebote. */
        @keyframes build-ribbon {
          0%   { transform: scale(0.2); opacity: 0; }
          50%  { transform: scale(1.15); opacity: 1; }
          70%  { transform: scale(1); opacity: 1; }
          100% { transform: scale(1); opacity: 0; }
        }
        .build-ribbon {
          animation: build-ribbon 1.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
      `}</style>

      {/* 1. Grúa: cable + gancho */}
      <div
        className="build-cable absolute top-0 left-1/2 w-0.5 bg-slate-700"
        style={{ height: '50%', marginLeft: -1, transformOrigin: 'top center' }}
      />
      <div
        className="build-hook absolute top-1/2 left-1/2 text-lg"
        style={{ marginLeft: -10, marginTop: -10 }}
      >
        🪝
      </div>

      {/* 2. Andamios: franjas verticales a cada lado */}
      <div
        className="build-scaffold-left absolute left-0 top-0 bottom-0 w-3.5"
        style={{
          background: 'repeating-linear-gradient(45deg, #FACC15 0px, #FACC15 4px, #1e293b 4px, #1e293b 8px)',
        }}
      />
      <div
        className="build-scaffold-right absolute right-0 top-0 bottom-0 w-3.5"
        style={{
          background: 'repeating-linear-gradient(45deg, #FACC15 0px, #FACC15 4px, #1e293b 4px, #1e293b 8px)',
        }}
      />

      {/* 3. Polvo: bocanadas en el borde inferior */}
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={`dust-${i}`}
          className="build-dust absolute bottom-0 rounded-full bg-slate-400/60"
          style={{
            width: 30,
            height: 18,
            left: `${15 + i * 18}%`,
            animationDelay: `${1.1 + i * 0.05}s`,
          }}
        />
      ))}

      {/* Chispas en las esquinas inferiores */}
      {[0, 1, 2, 3].map((i) => (
        <div
          key={`spark-${i}`}
          className="build-spark absolute bottom-1 text-sm"
          style={{
            left: i < 2 ? `${8 + i * 4}%` : `${82 + (i - 2) * 4}%`,
            animationDelay: `${1.1 + i * 0.08}s`,
          }}
        >
          ✨
        </div>
      ))}

      {/* 4. Luces: 4 rectángulos repartidos por el ancho */}
      {[0, 1, 2, 3].map((i) => (
        <div
          key={`light-${i}`}
          className="build-light absolute top-1/2 h-3 bg-amber-200 rounded"
          style={{
            width: '25%',
            left: `${i * 25}%`,
            animationDelay: `${1.3 + i * 0.15}s`,
          }}
        />
      ))}

      {/* 5. Cinta: texto central */}
      <div
        className="build-ribbon absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap bg-amber-400 text-slate-950 font-black text-xs px-3 py-1 rounded-lg border-2 border-slate-900"
        style={{ animationDelay: '1.3s' }}
      >
        🏗️ ¡PISO {floorNumber} INAUGURADO!
      </div>
    </div>
  );
};
