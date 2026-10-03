'use client';

import React, { useState } from 'react';
import { useHotel } from '../../context/HotelContext';
import { GlobalEventType, TimeOfDay } from '../../types/hotel';

export const SimulationDock: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'quick' | 'events' | 'floors'>('quick');

  const {
    state,
    joinViewer,
    sendComment,
    sendGift,
    triggerEvent,
    setTimeOfDay,
    advanceTime,
    createNextFloor,
    destroyUpperFloor,
    toggleAutoSimulation,
    isAutoSimulating,
    showSafeZoneGuides,
    setShowSafeZoneGuides,
    activeFloorNumber,
  } = useHotel();

  return (
    <div className="fixed bottom-3 right-3 z-50 select-none">
      {/* Minimized Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-gradient-to-r from-red-600 via-pink-600 to-amber-500 text-white font-bold px-3 py-2 rounded-full shadow-2xl border-2 border-white/40 flex items-center gap-2 hover:scale-105 transition-all text-xs"
        >
          <span>🎮</span>
          <span>Panel Simulación TikTok</span>
          {isAutoSimulating && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          )}
        </button>
      )}

      {/* Expanded Dock */}
      {isOpen && (
        <div className="w-[330px] bg-slate-900/95 backdrop-blur-md rounded-2xl border-2 border-amber-500/60 shadow-2xl p-2.5 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-700 pb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm">🎮</span>
              <span className="text-xs font-black text-amber-300">
                MODO SIMULACIÓN TIKTOK
              </span>
            </div>
            <div className="flex items-center gap-1">
              <a
                href="/admin"
                className="text-[10px] bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 px-2 py-0.5 rounded font-bold border border-amber-400/40"
              >
                ⚙️ /admin
              </a>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 text-xs"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Auto Simulator Switch & Safe Zone Toggle */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={toggleAutoSimulation}
              className={`px-2 py-1.5 rounded-lg text-[10px] font-black flex items-center justify-center gap-1.5 transition-all border ${
                isAutoSimulating
                  ? 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>🤖</span>
              <span>{isAutoSimulating ? 'SIMULADOR: ON' : 'AUTO-SIM: OFF'}</span>
            </button>

            <button
              onClick={() => setShowSafeZoneGuides(!showSafeZoneGuides)}
              className={`px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all border ${
                showSafeZoneGuides
                  ? 'bg-blue-600 border-blue-400 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>🛡️</span>
              <span>{showSafeZoneGuides ? 'Guías LIVE: ON' : 'Guías 9:16'}</span>
            </button>
          </div>

          {/* Subtabs */}
          <div className="flex rounded-lg bg-slate-800 p-0.5 border border-slate-700 text-[10px] font-bold">
            <button
              onClick={() => setActiveTab('quick')}
              className={`flex-1 py-1 rounded-md transition-all ${
                activeTab === 'quick' ? 'bg-amber-500 text-black shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Interacciones
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`flex-1 py-1 rounded-md transition-all ${
                activeTab === 'events' ? 'bg-amber-500 text-black shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Eventos
            </button>
            <button
              onClick={() => setActiveTab('floors')}
              className={`flex-1 py-1 rounded-md transition-all ${
                activeTab === 'floors' ? 'bg-amber-500 text-black shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Pisos & Clima
            </button>
          </div>

          {/* Tab 1: Interacciones (Users, Comments, Gifts) */}
          {activeTab === 'quick' && (
            <div className="flex flex-col gap-1.5">
              {/* Users & Comments */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => joinViewer()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1.5 rounded-lg text-[10px] font-bold shadow-xs active:scale-95 flex items-center justify-center gap-1"
                >
                  <span>+</span>
                  <span>Nuevo Usuario</span>
                </button>
                <button
                  onClick={() => sendComment()}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1.5 rounded-lg text-[10px] font-bold shadow-xs active:scale-95 flex items-center justify-center gap-1"
                >
                  <span>💬</span>
                  <span>Comentario</span>
                </button>
              </div>

              {/* TikTok Gifts */}
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                Regalos TikTok LIVE:
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => sendGift('gift_rose')}
                  className="bg-rose-950 hover:bg-rose-900 border border-rose-500/50 text-rose-200 px-2 py-1.5 rounded-lg text-[10px] font-bold active:scale-95 flex items-center justify-between"
                >
                  <span>🌹 Rosa</span>
                  <span className="text-[8px] bg-rose-500/30 px-1 rounded">Chico</span>
                </button>
                <button
                  onClick={() => sendGift('gift_corgi')}
                  className="bg-amber-950 hover:bg-amber-900 border border-amber-500/50 text-amber-200 px-2 py-1.5 rounded-lg text-[10px] font-bold active:scale-95 flex items-center justify-between"
                >
                  <span>🐶 Corgi</span>
                  <span className="text-[8px] bg-amber-500/30 px-1 rounded">Medio</span>
                </button>
                <button
                  onClick={() => sendGift('gift_fireworks')}
                  className="bg-indigo-950 hover:bg-indigo-900 border border-indigo-500/50 text-indigo-200 px-2 py-1.5 rounded-lg text-[10px] font-bold active:scale-95 flex items-center justify-between"
                >
                  <span>🚀 Cohete</span>
                  <span className="text-[8px] bg-indigo-500/30 px-1 rounded">Grande</span>
                </button>
                <button
                  onClick={() => sendGift('gift_crown')}
                  className="bg-yellow-950 hover:bg-yellow-900 border border-yellow-400 text-yellow-300 px-2 py-1.5 rounded-lg text-[10px] font-black active:scale-95 flex items-center justify-between shadow-[0_0_8px_rgba(250,204,21,0.3)]"
                >
                  <span>👑 Corona VIP</span>
                  <span className="text-[8px] bg-yellow-400 text-black px-1 rounded font-black">VIP</span>
                </button>
              </div>

              {/* Special Global Gift */}
              <button
                onClick={() => sendGift('gift_leon')}
                className="bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 text-slate-950 font-black px-2 py-1.5 rounded-lg text-[10px] active:scale-95 flex items-center justify-center gap-1 shadow-md"
              >
                <span>🦁</span>
                <span>León Dorado (Mega Regalo + Fiesta)</span>
              </button>
            </div>
          )}

          {/* Tab 2: Eventos Globales */}
          {activeTab === 'events' && (
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => triggerEvent('FIESTA')}
                className="bg-purple-900 hover:bg-purple-800 border border-purple-400/50 text-purple-200 px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1"
              >
                <span>🎉</span>
                <span>Fiesta Hotel</span>
              </button>
              <button
                onClick={() => triggerEvent('APAGON')}
                className="bg-slate-800 hover:bg-slate-700 border border-yellow-500/40 text-yellow-300 px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1"
              >
                <span>⚡</span>
                <span>Apagón</span>
              </button>
              <button
                onClick={() => triggerEvent('INCENDIO')}
                className="bg-red-950 hover:bg-red-900 border border-red-500/50 text-red-200 px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1"
              >
                <span>🔥</span>
                <span>Incendio</span>
              </button>
              <button
                onClick={() => triggerEvent('RATAS')}
                className="bg-stone-800 hover:bg-stone-700 border border-stone-500/50 text-stone-200 px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1"
              >
                <span>🐀</span>
                <span>Invasión Ratas</span>
              </button>
              <button
                onClick={() => triggerEvent('TORMENTA')}
                className="bg-blue-950 hover:bg-blue-900 border border-blue-500/50 text-blue-200 px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1"
              >
                <span>⛈️</span>
                <span>Tormenta</span>
              </button>
              <button
                onClick={() => triggerEvent('FUEGOS')}
                className="bg-pink-950 hover:bg-pink-900 border border-pink-500/50 text-pink-200 px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1"
              >
                <span>🎆</span>
                <span>Fuegos Artif.</span>
              </button>
              <button
                onClick={() => triggerEvent('OVNI')}
                className="col-span-2 bg-teal-950 hover:bg-teal-900 border border-teal-500/50 text-teal-200 px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1"
              >
                <span>🛸</span>
                <span>Visita Extraterrestre</span>
              </button>
            </div>
          )}

          {/* Tab 3: Pisos & Clima */}
          {activeTab === 'floors' && (
            <div className="flex flex-col gap-2">
              {/* Floor Management */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={createNextFloor}
                  className="bg-emerald-800 hover:bg-emerald-700 text-white px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1"
                >
                  <span>🏢</span>
                  <span>+ Abrir Nuevo Piso</span>
                </button>
                <button
                  onClick={() => destroyUpperFloor(Math.max(...state.floors.map((f) => f.floorNumber)))}
                  disabled={state.floors.length <= 1}
                  className="bg-red-900 hover:bg-red-800 disabled:opacity-40 text-white px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1"
                >
                  <span>💥</span>
                  <span>Demoler Piso Sup.</span>
                </button>
              </div>

              {/* Time of Day Cycle */}
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                Ciclo Horario ({state.timeOfDay.toUpperCase()}):
              </div>
              <div className="grid grid-cols-3 gap-1">
                <button
                  onClick={() => setTimeOfDay('day')}
                  className={`py-1 rounded text-[10px] font-bold flex items-center justify-center gap-1 ${
                    state.timeOfDay === 'day' ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  <span>☀️</span>
                  <span>Día</span>
                </button>
                <button
                  onClick={() => setTimeOfDay('evening')}
                  className={`py-1 rounded text-[10px] font-bold flex items-center justify-center gap-1 ${
                    state.timeOfDay === 'evening' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  <span>🌇</span>
                  <span>Tarde</span>
                </button>
                <button
                  onClick={() => setTimeOfDay('night')}
                  className={`py-1 rounded text-[10px] font-bold flex items-center justify-center gap-1 ${
                    state.timeOfDay === 'night' ? 'bg-indigo-900 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  <span>🌙</span>
                  <span>Noche</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
