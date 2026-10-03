'use client';

import React from 'react';
import Link from 'next/link';
import { HotelProvider, useHotel } from '../context/HotelContext';
import { TikTokLiveFrame } from '../components/hotel/TikTokLiveFrame';
import { HotelView } from '../components/hotel/HotelView';
import { hotelBroadcast } from '../services/broadcastSync';

function HomeLiveScreen() {
  const { joinViewer, state } = useHotel();

  const handleQuickAdd = () => {
    const names = ['pedrito_gamer', 'laura_dance', 'carlos_pro', 'sofi_flow', 'mateo_tt', 'camila_live', 'lucas_ok', 'valen_star'];
    const u = names[Math.floor(Math.random() * names.length)] + '_' + Math.floor(10 + Math.random() * 90);
    joinViewer(u);
    hotelBroadcast.post({
      type: 'JOIN_VIEWER',
      payload: { username: u },
    });
  };

  return (
    <main
      suppressHydrationWarning
      className="relative w-screen h-screen bg-slate-950 flex items-center justify-center overflow-hidden"
    >
      {/* Discreet Streamer Quick Bar (Hover to reveal or stays subtle in corner) */}
      <div className="absolute top-2 right-2 z-50 flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 px-2 py-1.5 rounded-xl shadow-2xl backdrop-blur-md opacity-80 hover:opacity-100 transition-opacity">
        <button
          onClick={handleQuickAdd}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-2.5 py-1 rounded-lg text-[10px] flex items-center gap-1 shadow-sm transition-all"
          title="Simular nuevo usuario entrando por recepción"
        >
          <span>👤</span>
          <span>+ Usuario</span>
        </button>

        <Link
          href="/admin"
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-2.5 py-1 rounded-lg text-[10px] flex items-center gap-1 shadow-sm transition-all"
        >
          <span>⚙️</span>
          <span>Admin</span>
        </Link>
      </div>

      {/* Main 9:16 Vertical Container for TikTok LIVE Broadcast Window */}
      <TikTokLiveFrame>
        <HotelView />
      </TikTokLiveFrame>
    </main>
  );
}

export default function HomePage() {
  return (
    <HotelProvider>
      <HomeLiveScreen />
    </HotelProvider>
  );
}
