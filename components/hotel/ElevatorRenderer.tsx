'use client';

import React from 'react';

interface ElevatorRendererProps {
  floorNumber: number;
  isOpen: boolean;
  passengerName?: string;
}

export const ElevatorRenderer: React.FC<ElevatorRendererProps> = ({
  floorNumber,
  isOpen,
  passengerName,
}) => {
  return (
    <div className="relative w-20 h-28 bg-gradient-to-b from-amber-700 via-amber-800 to-amber-950 rounded-t-lg border-2 border-amber-500 shadow-lg flex flex-col items-center justify-between p-1 overflow-hidden">
      {/* Top Header: Digital Floor Readout */}
      <div className="w-full flex items-center justify-between px-1.5 py-0.5 bg-black/80 rounded border border-amber-400/40">
        <span className="text-[8px] font-black text-amber-400 animate-pulse">▲</span>
        <span className="text-[10px] font-mono font-bold text-amber-300">
          PISO {floorNumber}
        </span>
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_#10B981]" />
      </div>

      {/* Elevator Cabin / Sliding Doors */}
      <div className="relative w-full flex-1 bg-stone-900 rounded-t border-t border-amber-600/40 overflow-hidden flex items-end justify-center">
        {/* Interior Chamber (visible when doors open) */}
        <div className="absolute inset-0 bg-gradient-to-b from-amber-100 to-amber-300 flex flex-col items-center justify-center p-1">
          {/* Interior Ceiling Light */}
          <div className="w-6 h-1 bg-white rounded-full shadow-[0_0_8px_#FFF] mb-auto" />
          {passengerName && (
            <div className="bg-black/80 text-amber-300 text-[8px] font-bold px-1 rounded animate-bounce">
              {passengerName}
            </div>
          )}
          {/* Mirror reflection effect */}
          <div className="w-12 h-14 bg-white/20 rounded border border-white/40 shadow-inner" />
        </div>

        {/* Left Sliding Door */}
        <div
          className={`absolute left-0 top-0 bottom-0 w-1/2 bg-gradient-to-r from-amber-700 to-amber-600 border-r border-amber-900 shadow-md transition-transform duration-700 ease-in-out z-10 ${
            isOpen ? '-translate-x-full' : 'translate-x-0'
          }`}
        >
          {/* Door Paneling */}
          <div className="h-full w-full flex flex-col justify-around p-1">
            <div className="w-full h-8 border border-amber-500/40 rounded-xs" />
            <div className="w-full h-8 border border-amber-500/40 rounded-xs" />
          </div>
        </div>

        {/* Right Sliding Door */}
        <div
          className={`absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-amber-700 to-amber-600 border-l border-amber-900 shadow-md transition-transform duration-700 ease-in-out z-10 ${
            isOpen ? 'translate-x-full' : 'translate-x-0'
          }`}
        >
          {/* Door Paneling */}
          <div className="h-full w-full flex flex-col justify-around p-1">
            <div className="w-full h-8 border border-amber-500/40 rounded-xs" />
            <div className="w-full h-8 border border-amber-500/40 rounded-xs" />
          </div>
        </div>
      </div>

      {/* Call Buttons panel on side */}
      <div className="absolute right-1 top-10 flex flex-col gap-1 bg-black/60 p-0.5 rounded border border-amber-400/40 z-20">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
        <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
      </div>
    </div>
  );
};
