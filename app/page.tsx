'use client';

import React from 'react';
import { useEffect, useState, useCallback } from 'react';
import { HotelProvider, useHotel } from '../context/HotelContext';
import { TikTokLiveFrame } from '../components/hotel/TikTokLiveFrame';
import { HotelView } from '../components/hotel/HotelView';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { hotelBroadcast } from '../services/broadcastSync';
import { tiktokLiveConnector } from '../services/tiktokLiveConnector';
import { instalarReportes } from '../services/browserReport';
import { audioEngine } from '../services/audioEngine';

function HomeLiveScreen() {
  const { joinViewer, state } = useHotel();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  // Reportar al servidor cualquier excepcion del navegador. Sin esto, una
  // excepcion en un render deja la pagina muerta sin dejar rastro observable.
  useEffect(() => {
    instalarReportes();
  }, []);

  // Al montar, reengancharse a la conexion del servidor si sigue abierta.
  // Navegar entre / y /admin desmonta este componente y el conector del
  // navegador, pero el WebSocket vive en el servidor: aqui se recupera.
  useEffect(() => {
    tiktokLiveConnector.resumeIfActive();
  }, []);

  // Sincronizar estado de pantalla completa con eventos del navegador
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const toggleOrientation = useCallback(() => {
    setOrientation((prev) => {
      const next = prev === 'portrait' ? 'landscape' : 'portrait';
      // Intentar usar la Screen Orientation API (solo en algunos navegadores)
      try {
        const orient = screen.orientation as any;
        if (next === 'landscape') {
          orient.lock?.('landscape').catch(() => {});
        } else {
          orient.lock?.('portrait').catch(() => {});
        }
      } catch {
        // Fallback: la rotación se aplica con CSS transform en el contenedor
      }
      return next;
    });
  }, []);

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
      className="relative w-screen h-screen bg-slate-950 flex items-center justify-center overflow-hidden transition-transform duration-500"
      style={orientation === 'landscape' ? { transform: 'rotate(90deg) scale(1.78)' } : undefined}
    >
      {/* Barra discreta del streamer.
          NO lleva enlace al panel de administracion: los espectadores ven esta
          misma pantalla, y no deben tener el panel a un clic. El admin entra
          escribiendo /admin directamente (y con contrasena). */}
      <div className="absolute top-2 right-2 z-50 flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 px-2 py-1.5 rounded-xl shadow-2xl backdrop-blur-md opacity-80 hover:opacity-100 transition-opacity">
        <button
          onClick={handleQuickAdd}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-2.5 py-1 rounded-lg text-[10px] flex items-center gap-1 shadow-sm transition-all"
          title="Simular nuevo usuario entrando por recepción"
        >
          <span>👤</span>
          <span>+ Usuario</span>
        </button>
        <button
          onClick={() => audioEngine.resetAudio()}
          className="bg-amber-600 hover:bg-amber-500 text-white font-black px-2.5 py-1 rounded-lg text-[10px] flex items-center gap-1 shadow-sm transition-all"
          title="Reiniciar audio si se queda atascado — cierra y recrea el AudioContext"
        >
          <span>🔊</span>
          <span>Reset</span>
        </button>
        <button
          onClick={toggleFullscreen}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-2.5 py-1 rounded-lg text-[10px] flex items-center gap-1 shadow-sm transition-all"
          title={isFullscreen ? 'Salir de pantalla completa' : 'Entrar a pantalla completa'}
        >
          <span>{isFullscreen ? '🗗' : '🗖'}</span>
          <span>{isFullscreen ? 'Salir' : 'Full'}</span>
        </button>
        <button
          onClick={toggleOrientation}
          className="bg-teal-600 hover:bg-teal-500 text-white font-black px-2.5 py-1 rounded-lg text-[10px] flex items-center gap-1 shadow-sm transition-all"
          title={orientation === 'portrait' ? 'Cambiar a horizontal' : 'Cambiar a vertical'}
        >
          <span>{orientation === 'portrait' ? '🔄' : '↕️'}</span>
          <span>{orientation === 'portrait' ? 'Horizontal' : 'Vertical'}</span>
        </button>
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
    // El boundary envuelve TODO: si un personaje o un dato restaurado revienta
    // el render, se aisla el fallo en vez de dejar la pantalla generica de Next.
    <ErrorBoundary etiqueta="hotel">
      <HotelProvider>
        <HomeLiveScreen />
      </HotelProvider>
    </ErrorBoundary>
  );
}
