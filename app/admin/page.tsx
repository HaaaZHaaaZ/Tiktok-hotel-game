'use client';

import React, { useState, useSyncExternalStore, useEffect } from 'react';
import Link from 'next/link';
import { useHotel, HotelProvider } from '../../context/HotelContext';
import { PersonalityType, GlobalEventType, TimeOfDay, EntryRulesConfig } from '../../types/hotel';
import { APP_VERSION, APP_VERSION_NOTES } from '../../version';
import { DEFAULT_GIFT_RULES } from '../../services/tiktokProvider';
import { hotelBroadcast } from '../../services/broadcastSync';
import { tiktokLiveConnector, TikTokLiveStatus } from '../../services/tiktokLiveConnector';
import { TikTokLiveFrame } from '../../components/hotel/TikTokLiveFrame';
import { TikTokLogPanel } from '../../components/admin/TikTokLogPanel';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { instalarReportes } from '../../services/browserReport';
import { HotelView } from '../../components/hotel/HotelView';

export const dynamic = 'force-dynamic';

const AdminPanelContent: React.FC = () => {
  const [showHotelPreview, setShowHotelPreview] = useState(false);
  const {
    state,
    joinViewer,
    sendComment,
    sendGift,
    triggerEvent,
    setTimeOfDay,
    createNextFloor,
    destroyUpperFloor,
    evictResident,
    upgradeResidentRoom,
    promoteToVip,
    boostStability,
    resetLiveSession,
    toggleAutoSimulation,
    isAutoSimulating,
    isAudioMuted,
    setIsAudioMuted,
    isSpeechMuted,
    setIsSpeechMuted,
    updateEntryRules,
    setWeather,
    simulateUserShare,
    simulateUserLikes,
    simulateUserFollow,
  } = useHotel();

  const [activeAdminTab, setActiveAdminTab] = useState<
    'tiktok' | 'log' | 'rules' | 'residents' | 'events' | 'gifts'
  >('tiktok');

  // TikTok Live Connection State
  const [tiktokUsername, setTiktokUsername] = useState('@streamer_hotel');
  const [connectionStatus, setConnectionStatus] = useState<TikTokLiveStatus>({
    isConnected: false,
    streamer: '',
  });
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [liveEventLogs, setLiveEventLogs] = useState<Array<{ id: string; time: string; type: string; text: string }>>([
    {
      id: 'log_init',
      time: 'HOTEL',
      type: 'info',
      text: 'Panel de administración listo. Ventana independiente sincronizada con la retransmisión.',
    },
  ]);

  const [newUsername, setNewUsername] = useState('');
  const [newPersonality, setNewPersonality] = useState<PersonalityType>('gamer');
  const [commentText, setCommentText] = useState('');
  const [selectedResidentId, setSelectedResidentId] = useState<string>('');

  const residentsList = Object.values(state.residents);
  const entryRules = state.entryRules || {
    entryMode: 'ANY_COMMENT',
    keyword: '!entrar',
    likesRequired: 20,
    sharesRequired: 1,
    requireFollow: false,
    minGiftCoins: 1,
    autoApprove: true,
    welcomeMessage: '¡Bienvenido al hotel! Tu habitación te espera.',
    residentStaySeconds: 0,
  };

  const addLog = (type: string, text: string) => {
    setLiveEventLogs((prev) => [
      { id: `log_${Date.now()}_${Math.random()}`, time: new Date().toLocaleTimeString(), type, text },
      ...prev.slice(0, 49),
    ]);
  };

  // Al montar, recuperar la conexion viva del servidor si la hay. Sin esto,
  // cambiar de /admin a / (o recargar) obligaba a volver a pulsar "Conectar"
  // aunque el WebSocket siguiera abierto en el servidor.
  useEffect(() => {
    let cancelled = false;
    instalarReportes();
    tiktokLiveConnector.resumeIfActive().then((res) => {
      if (cancelled || !res) return;
      setConnectionStatus(res);
      if (res.streamer) {
        setTiktokUsername(res.streamer);
        addLog('info', `Reconectado automaticamente a ${res.streamer}.`);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Connect to TikTok LIVE
  const handleConnectTikTok = async () => {
    setIsConnecting(true);
    setConnectionError(null);
    try {
      const res = await tiktokLiveConnector.connect(tiktokUsername);
      setConnectionStatus(res);
      if (res.isConnected) {
        setConnectionError(null);
        addLog('success', `¡Conectado exitosamente al directo de ${res.streamer}!`);
        hotelBroadcast.post({
          type: 'JOIN_VIEWER',
          payload: { username: res.streamer.replace('@', '') },
        });
      } else {
        setConnectionError(res.error || 'No se pudo conectar. Verifica que el nombre de usuario sea válido y esté activo.');
        addLog('error', `Error conectando con TikTok: ${res.error || 'Revisa tu usuario'}`);
      }
    } catch (err: any) {
      setConnectionError(err.message || 'Fallo de red al conectar con TikTok.');
      addLog('error', `Fallo de conexión: ${err.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectTikTok = () => {
    tiktokLiveConnector.disconnect();
    setConnectionStatus({ isConnected: false, streamer: '' });
    addLog('info', 'Desconectado de la transmisión de TikTok LIVE.');
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;
    const uname = newUsername.trim().replace(/^@/, '');
    joinViewer(uname, newPersonality);
    hotelBroadcast.post({
      type: 'JOIN_VIEWER',
      payload: { username: uname, personality: newPersonality },
    });
    addLog('join', `Nuevo residente creado: @${uname} (${newPersonality})`);
    setNewUsername('');
  };

  const handleSendCustomComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    const targetRes = residentsList.find((r) => r.id === selectedResidentId);
    const uname = targetRes?.username;
    sendComment(uname, commentText.trim());
    hotelBroadcast.post({
      type: 'SEND_COMMENT',
      payload: { username: uname, comment: commentText.trim() },
    });
    addLog('comment', `Comentario de @${uname || 'usuario'}: "${commentText.trim()}"`);
    setCommentText('');
  };

  const handleTriggerDemolition = (floorNum: number) => {
    if (confirm(`¿Estás seguro de iniciar la demolición con grietas y fallos de luz del Piso ${floorNum}?`)) {
      destroyUpperFloor(floorNum);
      hotelBroadcast.post({
        type: 'DESTROY_FLOOR',
        payload: { floorNumber: floorNum },
      });
      addLog('alert', `Demolición iniciada en Piso ${floorNum} con grietas y apagón`);
    }
  };

  const handleBroadcastEvent = (ev: GlobalEventType) => {
    triggerEvent(ev);
    hotelBroadcast.post({
      type: 'TRIGGER_EVENT',
      payload: { eventType: ev },
    });
    addLog('event', `Evento global lanzado: ${ev}`);
  };

  const handleBroadcastTime = (time: TimeOfDay) => {
    setTimeOfDay(time);
    hotelBroadcast.post({
      type: 'SET_TIME',
      payload: { timeOfDay: time },
    });
    addLog('time', `Ciclo horario cambiado a: ${time}`);
  };

  const webhookUrl = useSyncExternalStore(
    () => () => {},
    () => (typeof window !== 'undefined' ? `${window.location.origin}/api/tiktok/webhook` : '/api/tiktok/webhook'),
    () => '/api/tiktok/webhook'
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      {/* Top Header Bar */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏨</span>
            <h1 className="text-xl md:text-2xl font-black text-amber-400 tracking-tight">
              TIKTOK HOTEL — CONSOLA DE ADMINISTRACIÓN EXTERNA
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Esta ventana opera de manera independiente al directo. Las acciones se sincronizan automáticamente con la pantalla LIVE de OBS.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Return to Hotel in same tab */}
          <Link
            href="/"
            className="bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all border border-slate-700 shadow-sm"
          >
            <span>🏨</span>
            <span>Volver al Hotel</span>
          </Link>

          {/* Toggle Live Monitor */}
          <button
            onClick={() => setShowHotelPreview((prev) => !prev)}
            className="bg-cyan-900/80 hover:bg-cyan-800 text-cyan-200 border border-cyan-500/50 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm"
          >
            <span>👁️</span>
            <span>{showHotelPreview ? 'Ocultar Monitor' : 'Ver Hotel en Vivo'}</span>
          </button>

          {/* Open Live Screen in new window for OBS */}
          <Link
            href="/"
            target="_blank"
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md"
          >
            <span>📺</span>
            <span>Abrir en Nueva Ventana (OBS)</span>
          </Link>

          <button
            onClick={() => {
              if (confirm('¿Deseas reiniciar la sesión del hotel a su estado inicial?')) {
                resetLiveSession('NEW_LIVE');
                hotelBroadcast.post({ type: 'RESET_LIVE', payload: { mode: 'NEW_LIVE' } });
                addLog('reset', 'Sesión de LIVE reiniciada');
              }
            }}
            className="bg-rose-900/80 hover:bg-rose-800 text-rose-200 border border-rose-500/50 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1 transition-all"
          >
            <span>🔄</span>
            <span>Reiniciar LIVE</span>
          </button>
        </div>
      </div>

      {/* Embedded Live Hotel Monitor (Allows viewing hotel right here without switching tabs) */}
      {showHotelPreview && (
        <div className="max-w-6xl mx-auto mb-6 bg-slate-900/95 border-2 border-cyan-500/70 rounded-2xl p-4 shadow-2xl flex flex-col items-center animate-in fade-in duration-300">
          <div className="flex items-center justify-between w-full mb-3 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 text-xs font-black text-cyan-300">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span>MONITOR EN VIVO DEL HOTEL (TRANSMITIÉNDOSE EN DIRECTO)</span>
            </div>
            <button
              onClick={() => setShowHotelPreview(false)}
              className="text-[10px] text-slate-400 hover:text-white bg-slate-800 px-2 py-0.5 rounded"
            >
              ✕ Cerrar Monitor
            </button>
          </div>
          <div className="w-[340px] h-[580px] bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-700 flex items-center justify-center">
            <TikTokLiveFrame>
              <HotelView />
            </TikTokLiveFrame>
          </div>
        </div>
      )}

      {/* Permanent Quick Testing Bar: Always Visible for the Streamer */}
      <div className="max-w-6xl mx-auto bg-gradient-to-r from-amber-950/70 via-slate-900 to-amber-950/70 border-2 border-amber-500/60 rounded-2xl p-4 mb-6 shadow-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-black text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
            <span className="text-base">⚡</span>
            <span>Acciones Rápidas para el Streamer (Pruebas en Vivo)</span>
          </div>
          <p className="text-[11px] text-slate-300 mt-0.5">
            Haz clic para probar la llegada por recepción con Don Pepe, comentarios o demolición en vivo:
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Main User Simulation Button */}
          <button
            onClick={() => {
              const randomNames = ['pedrito_gamer', 'laura_dance', 'carlos_pro', 'sofi_flow', 'mateo_tt', 'camila_live', 'lucas_ok', 'valen_star'];
              const u = randomNames[Math.floor(Math.random() * randomNames.length)] + '_' + Math.floor(10 + Math.random() * 90);
              joinViewer(u);
              hotelBroadcast.post({
                type: 'JOIN_VIEWER',
                payload: { username: u },
              });
              addLog('join', `¡Simulado nuevo usuario! @${u} entra por recepción para que Don Pepe le asigne habitación.`);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg transition-all border border-emerald-400"
          >
            <span>👤</span>
            <span>+ Simular Nuevo Usuario (Entra por Recepción)</span>
          </button>

          <button
            onClick={() => {
              const u = `espectador_${Math.floor(100 + Math.random() * 900)}`;
              tiktokLiveConnector.emitEvent({ eventType: 'comment', username: u, comment: '!entrar' });
              addLog('tiktok', `Comentario simulado: @${u} '!entrar'`);
            }}
            className="bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold px-3 py-2 rounded-xl text-xs border border-slate-700 transition-all"
          >
            <span>💬</span>
            <span>Comentario !entrar</span>
          </button>

          <button
            onClick={() => {
              simulateUserLikes(undefined, 50);
              addLog('like', 'Simulados 50 Likes en pantalla');
            }}
            className="bg-slate-800 hover:bg-slate-700 text-rose-300 font-bold px-3 py-2 rounded-xl text-xs border border-slate-700 transition-all"
          >
            <span>❤️</span>
            <span>50 Likes</span>
          </button>

          <button
            onClick={() => {
              simulateUserShare();
              addLog('share', 'Simulado compartir directo');
            }}
            className="bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold px-3 py-2 rounded-xl text-xs border border-slate-700 transition-all"
          >
            <span>🔁</span>
            <span>Compartir LIVE</span>
          </button>

          <button
            onClick={() => {
              const highestFloor = Math.max(...state.floors.map((f) => f.floorNumber));
              if (highestFloor > 1) {
                handleTriggerDemolition(highestFloor);
              } else {
                alert('El Piso 1 no se puede demoler. Construye un Piso 2 primero desde la pestaña Demolición para probar la explosión.');
              }
            }}
            className="bg-rose-900/80 hover:bg-rose-800 text-rose-100 font-black px-3 py-2 rounded-xl text-xs border border-rose-500/50 shadow transition-all"
          >
            <span>💥</span>
            <span>Demoler Piso Superior</span>
          </button>
        </div>
      </div>

      {/* Admin Tab Switcher */}
      <div className="max-w-6xl mx-auto flex items-center gap-2 mb-6 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveAdminTab('tiktok')}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shrink-0 ${
            activeAdminTab === 'tiktok'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <span>🔴</span>
          <span>Conector TikTok LIVE (Producción)</span>
        </button>
        <button
          onClick={() => setActiveAdminTab('log')}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shrink-0 ${
            activeAdminTab === 'log'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <span>📋</span>
          <span>Log de Conexión</span>
        </button>
        <button
          onClick={() => setActiveAdminTab('rules')}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shrink-0 ${
            activeAdminTab === 'rules'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <span>🚪</span>
          <span>Reglas de Entrada (Comentarios, Likes, Shares)</span>
        </button>
        <button
          onClick={() => setActiveAdminTab('residents')}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shrink-0 ${
            activeAdminTab === 'residents'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <span>👥</span>
          <span>Residentes ({residentsList.length})</span>
        </button>
        <button
          onClick={() => setActiveAdminTab('events')}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shrink-0 ${
            activeAdminTab === 'events'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <span>💥</span>
          <span>Demolición & Eventos</span>
        </button>
        <button
          onClick={() => setActiveAdminTab('gifts')}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shrink-0 ${
            activeAdminTab === 'gifts'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <span>🎁</span>
          <span>Regalos & Penthouse</span>
        </button>
      </div>

      {/* TAB 1: TIKTOK LIVE CONNECTOR */}
      {activeAdminTab === 'tiktok' && (
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          {/* Connection Panel */}
          <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-black text-amber-400 uppercase tracking-wide flex items-center gap-2">
                  <span>🔴</span>
                  <span>Conexión Directa a TikTok LIVE</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Conecta el hotel con los comentarios, regalos, likes y compartidas en vivo de tu canal de TikTok.
                </p>
              </div>
              <div
                className={`px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border flex items-center gap-1.5 ${
                  connectionStatus.isConnected
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500/60 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${connectionStatus.isConnected ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
                <span>{connectionStatus.isConnected ? `CONECTADO: ${connectionStatus.streamer}` : 'DESCONECTADO'}</span>
              </div>
            </div>

            {/* Input & Connect Action */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
              <label className="text-xs font-bold text-slate-300 block">
                Tu usuario de TikTok (o canal transmitiendo en vivo):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={tiktokUsername}
                  onChange={(e) => setTiktokUsername(e.target.value)}
                  placeholder="@mi_canal_tiktok"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-400"
                />
                {!connectionStatus.isConnected ? (
                  <button
                    onClick={handleConnectTikTok}
                    disabled={isConnecting}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md transition-all shrink-0"
                  >
                    <span>{isConnecting ? '⏳ Conectando...' : '🟢 Conectar LIVE'}</span>
                  </button>
                ) : (
                  <button
                    onClick={handleDisconnectTikTok}
                    className="bg-rose-900 hover:bg-rose-800 text-rose-200 border border-rose-500/50 font-black px-5 py-2.5 rounded-xl text-xs transition-all shrink-0"
                  >
                    Desconectar
                  </button>
                )}
              </div>

              {connectionError && (
                <div className="bg-rose-950/80 border border-rose-500/50 rounded-xl p-3 text-xs text-rose-200 flex items-start gap-2">
                  <span className="text-base">❌</span>
                  <div>
                    <div className="font-bold">No se pudo verificar la conexión con TikTok:</div>
                    <div className="text-[11px] text-rose-300/90 mt-0.5">{connectionError}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Production Webhook Integration (TikFinity / Live Connector) */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                  <span>⚡</span>
                  <span>Webhook URL de Producción (TikFinity / OBS Bot)</span>
                </span>
                <span className="text-[10px] text-slate-400">Método POST JSON</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Puedes conectar TikFinity, TikTok Live Connector o cualquier script externo apuntando a este endpoint webhook:
              </p>
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 p-2 rounded-lg font-mono text-[11px] text-cyan-300 overflow-x-auto">
                <span suppressHydrationWarning className="truncate flex-1 font-bold">
                  {webhookUrl}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    alert('¡URL del Webhook copiada al portapapeles!');
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 rounded text-[10px] font-bold shrink-0 border border-slate-600"
                >
                  Copiar
                </button>
                <button
                  onClick={async () => {
                    try {
                      const u = `probador_${Math.floor(100 + Math.random() * 900)}`;
                      const res = await fetch('/api/tiktok/webhook', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          event: 'comment',
                          username: u,
                          comment: '!entrar',
                        }),
                      });
                      const d = await res.json();
                      if (d.success) {
                        addLog('tiktok', `Prueba de Webhook exitosa: @${u} '!entrar' procesado`);
                      }
                    } catch (e: any) {
                      addLog('error', `Error probando webhook: ${e.message}`);
                    }
                  }}
                  className="bg-cyan-700 hover:bg-cyan-600 text-white font-bold px-2 py-1 rounded text-[10px] shrink-0 border border-cyan-500"
                >
                  ⚡ Probar Envío
                </button>
              </div>
              <div className="text-[10px] text-slate-500 bg-slate-900/50 p-2 rounded border border-slate-800 font-mono">
                Payload compatible: <code>{'{ "event": "comment", "username": "@user", "comment": "!entrar" }'}</code>
              </div>
            </div>

            {/* Quick Live Simulators */}
            <div className="border-t border-slate-800 pt-3 flex flex-col gap-2">
              <span className="text-xs font-black text-amber-300 uppercase">Simuladores de Entrada Instantánea:</span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <button
                  onClick={() => {
                    const u = `usuario_${Math.floor(100 + Math.random() * 900)}`;
                    tiktokLiveConnector.emitEvent({ eventType: 'comment', username: u, comment: '!entrar' });
                    addLog('tiktok', `Comentario de prueba: @${u} '!entrar'`);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-2 rounded-xl text-xs font-bold text-center"
                >
                  💬 Comentario !entrar
                </button>
                <button
                  onClick={() => {
                    const u = `liker_${Math.floor(100 + Math.random() * 900)}`;
                    tiktokLiveConnector.emitEvent({ eventType: 'like', username: u, likeCount: 50 });
                    addLog('tiktok', `Likes de prueba: @${u} envió 50 Likes`);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-2 rounded-xl text-xs font-bold text-center"
                >
                  ❤️ 50 Likes
                </button>
                <button
                  onClick={() => {
                    const u = `share_${Math.floor(100 + Math.random() * 900)}`;
                    tiktokLiveConnector.emitEvent({ eventType: 'share', username: u });
                    addLog('tiktok', `Compartida de prueba: @${u} compartió LIVE`);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-2 rounded-xl text-xs font-bold text-center"
                >
                  🔁 Compartir LIVE
                </button>
                <button
                  onClick={() => {
                    const u = `vip_${Math.floor(100 + Math.random() * 900)}`;
                    tiktokLiveConnector.emitEvent({ eventType: 'gift', username: u, giftId: 'gift_lion', giftName: 'León Real' });
                    addLog('tiktok', `Regalo de prueba: @${u} León Real`);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-2 rounded-xl text-xs font-bold text-center"
                >
                  🦁 León VIP
                </button>
              </div>
            </div>
          </div>

          {/* Live Terminal & Event Feed */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between max-h-[580px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
              <span className="text-xs font-black text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                <span>📋</span>
                <span>Registro de Eventos LIVE</span>
              </span>
              <button
                onClick={() => setLiveEventLogs([])}
                className="text-[10px] text-slate-400 hover:text-slate-200"
              >
                Limpiar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 font-mono text-[10px]">
              {liveEventLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-1.5 rounded bg-slate-950/70 border border-slate-800/80 flex flex-col"
                >
                  <div className="flex justify-between text-slate-500 text-[9px]">
                    <span className="font-bold text-amber-400/90 uppercase">{log.type}</span>
                    <span>{log.time}</span>
                  </div>
                  <span className="text-slate-200 mt-0.5">{log.text}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-800 pt-2 mt-2 flex justify-between text-[10px] font-mono text-slate-400">
              <span>Hotel: {residentsList.length} ocupantes</span>
              <span>Cola: {state.entryQueue.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB: LOG DE CONEXION */}
      {activeAdminTab === 'log' && (
        <div className="max-w-4xl mx-auto animate-in fade-in duration-200">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            {/* Version desplegada. Si el panel y la app principal no coinciden,
                casi siempre es que el navegador tiene un bundle viejo en cache:
                recargar en duro (Ctrl+Shift+R) y volver a mirar aqui. */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className="text-[10px] bg-black/50 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 font-mono">
                app v{APP_VERSION}
              </span>
              {APP_VERSION_NOTES.map((n) => (
                <span
                  key={n}
                  className="text-[10px] bg-slate-800/80 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700"
                >
                  {n}
                </span>
              ))}
            </div>
            <div className="border-b border-slate-800 pb-3 mb-4">
              <h2 className="text-sm font-black text-amber-400 uppercase tracking-wide flex items-center gap-2">
                <span>📋</span>
                <span>Log de Conexión con TikTok</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Qué se mantiene conectado y qué eventos llegan. Si algo falla, pulsa
                «Copiar todo el log» y pégamelo: sale el estado de la tubería y las
                últimas líneas, que es justo lo que hace falta para localizar el
                problema.
              </p>
            </div>
            <TikTokLogPanel />
          </div>
        </div>
      )}

      {/* TAB 2: REGLAS DE ENTRADA */}
      {activeAdminTab === 'rules' && (
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
            <h2 className="text-sm font-black text-amber-400 uppercase tracking-wide border-b border-slate-800 pb-3">
              Configuración de Requisitos de Entrada
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { id: 'ANY_COMMENT', icon: '💬', title: 'Cualquier Comentario (Libre)', desc: 'Cualquier comentario otorga habitación.' },
                { id: 'KEYWORD_ONLY', icon: '🔑', title: 'Palabra Clave (!entrar)', desc: 'Solo quien escriba el comando configurado.' },
                { id: 'SHARE_LIVE', icon: '🔁', title: 'Por Compartir el LIVE', desc: 'Requiere compartir la transmisión.' },
                { id: 'LIKE_COUNT', icon: '❤️', title: 'Por Meta de Likes', desc: 'Requiere cantidad de taps en pantalla.' },
                { id: 'GIFT_ONLY', icon: '🎁', title: 'Solo con Regalos', desc: 'Solo con regalos como Rosa o Corgi.' },
                { id: 'FOLLOWER_ONLY', icon: '⭐', title: 'Solo Seguidores', desc: 'Solo nuevos seguidores del canal.' },
              ].map((m) => (
                <div
                  key={m.id}
                  onClick={() => {
                    const updated = { entryMode: m.id as EntryRulesConfig['entryMode'] };
                    updateEntryRules(updated);
                    hotelBroadcast.post({ type: 'UPDATE_RULES', payload: { rules: updated } });
                    addLog('rules', `Modo de entrada cambiado a: ${m.id}`);
                  }}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    entryRules.entryMode === m.id
                      ? 'bg-amber-500/15 border-amber-400 text-white shadow-md'
                      : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{m.icon}</span>
                    <span className="text-xs font-black">{m.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">{m.desc}</p>
                </div>
              ))}
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Palabra Clave:</label>
                <input
                  type="text"
                  value={entryRules.keyword}
                  onChange={(e) => {
                    const updated = { keyword: e.target.value };
                    updateEntryRules(updated);
                    hotelBroadcast.post({ type: 'UPDATE_RULES', payload: { rules: updated } });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-amber-300 font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Likes Requeridos:</label>
                <input
                  type="number"
                  value={entryRules.likesRequired}
                  onChange={(e) => {
                    const updated = { likesRequired: Number(e.target.value) || 1 };
                    updateEntryRules(updated);
                    hotelBroadcast.post({ type: 'UPDATE_RULES', payload: { rules: updated } });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-amber-300 font-mono"
                />
              </div>

              <div className="md:col-span-2 border-t border-slate-800 pt-3 mt-1 flex flex-col gap-2">
                <label className="text-[11px] font-black text-amber-300 flex items-center justify-between">
                  <span>⏱️ Tiempo de duración inicial de los personajes (en SEGUNDOS):</span>
                  <span className="text-[10px] text-cyan-300 font-mono">
                    {entryRules.residentStaySeconds === 0
                      ? '♾️ Infinito (Permanente)'
                      : `${entryRules.residentStaySeconds} segundos (${(entryRules.residentStaySeconds / 60).toFixed(1)} min)`}
                  </span>
                </label>

                {/* Direct Custom Input in Seconds */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={entryRules.residentStaySeconds ?? 0}
                      onChange={(e) => {
                        const secs = Math.max(0, parseInt(e.target.value, 10) || 0);
                        const updated = { residentStaySeconds: secs };
                        updateEntryRules(updated);
                        hotelBroadcast.post({ type: 'UPDATE_RULES', payload: { rules: updated } });
                        addLog('rules', `Tiempo de estancia configurado a: ${secs === 0 ? 'Infinito / Permanente' : `${secs} segundos`}`);
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-400"
                      placeholder="0 = Infinito / Permanente"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-bold">segundos</span>
                  </div>
                </div>

                {/* Quick Presets Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { label: '♾️ Permanente (0s)', secs: 0 },
                    { label: '⚡ 30 seg', secs: 30 },
                    { label: '⏱️ 60 seg (1m)', secs: 60 },
                    { label: '⏱️ 120 seg (2m)', secs: 120 },
                    { label: '⏱️ 300 seg (5m)', secs: 300 },
                    { label: '⏱️ 600 seg (10m)', secs: 600 },
                  ].map((p) => (
                    <button
                      key={p.secs}
                      type="button"
                      onClick={() => {
                        const updated = { residentStaySeconds: p.secs };
                        updateEntryRules(updated);
                        hotelBroadcast.post({ type: 'UPDATE_RULES', payload: { rules: updated } });
                        addLog('rules', `Tiempo de estancia configurado a: ${p.secs === 0 ? 'Infinito / Permanente' : `${p.secs} segundos`}`);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                        entryRules.residentStaySeconds === p.secs
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <p className="text-[10px] text-slate-400">
                  Campo totalmente personalizado: escribe cualquier cantidad exacta en segundos. Si colocas <code>0</code>, los residentes son permanentes y nunca se desalojan por tiempo.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <h2 className="text-xs font-black text-amber-400 uppercase tracking-wide border-b border-slate-800 pb-2 mb-3">
                Simulación Rápida de Entrada
              </h2>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    const u = `usuario_${Math.floor(100 + Math.random() * 900)}`;
                    joinViewer(u);
                    hotelBroadcast.post({ type: 'JOIN_VIEWER', payload: { username: u } });
                    addLog('join', `Simulado ingreso de @${u}`);
                  }}
                  className="w-full bg-emerald-700/80 hover:bg-emerald-600 text-white font-bold py-2 rounded-xl text-xs"
                >
                  💬 Simular Comentario Entrada
                </button>
                <button
                  onClick={() => {
                    simulateUserShare();
                    addLog('share', 'Simulada compartida de LIVE');
                  }}
                  className="w-full bg-blue-700/80 hover:bg-blue-600 text-white font-bold py-2 rounded-xl text-xs"
                >
                  🔁 Simular Compartida de LIVE
                </button>
                <button
                  onClick={() => {
                    simulateUserLikes(undefined, entryRules.likesRequired);
                    addLog('like', `Simulados ${entryRules.likesRequired} Likes`);
                  }}
                  className="w-full bg-rose-700/80 hover:bg-rose-600 text-white font-bold py-2 rounded-xl text-xs"
                >
                  ❤️ Simular Taps de Likes
                </button>
                <button
                  onClick={() => {
                    simulateUserFollow();
                    addLog('follow', 'Simulado nuevo seguidor');
                  }}
                  className="w-full bg-purple-700/80 hover:bg-purple-600 text-white font-bold py-2 rounded-xl text-xs"
                >
                  ⭐ Simular Nuevo Seguidor
                </button>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[10px] font-mono text-slate-400 mt-4">
              <span>Fila actual en recepción: </span>
              <span className="text-amber-400 font-bold">{state.entryQueue.length} esperando</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RESIDENTES */}
      {activeAdminTab === 'residents' && (
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
            <h2 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>👤</span>
              <span>Crear Residente Manual</span>
            </h2>
            <form onSubmit={handleCreateUser} className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Nombre de usuario:</label>
                <input
                  type="text"
                  placeholder="@usuario_tiktok"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl text-xs"
              >
                + Asignar Habitación
              </button>
            </form>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
            <h2 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>💬</span>
              <span>Lanzar Diálogo Flotante</span>
            </h2>
            <form onSubmit={handleSendCustomComment} className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Residente:</label>
                <select
                  value={selectedResidentId}
                  onChange={(e) => setSelectedResidentId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="">Aleatorio</option>
                  {residentsList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.displayName} (Hab. {state.rooms[r.roomId]?.number})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Texto del comentario:</label>
                <input
                  type="text"
                  placeholder="¡Qué gran hotel!"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-xl text-xs"
              >
                💬 Publicar Burbuja en Pantalla LIVE
              </button>
            </form>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-2">
            <h2 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-800 pb-2">
              <span>📋 Residentes Activos</span>
              <span className="text-[10px] text-slate-400">{residentsList.length}</span>
            </h2>
            <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1">
              {residentsList.map((res) => (
                <div key={res.id} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-black text-white">{res.displayName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Hab. {state.rooms[res.roomId]?.number || 'PB'} • {res.currentAction}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => boostStability(res.id, 25)}
                      className="bg-emerald-800/80 hover:bg-emerald-700 text-emerald-200 text-[10px] font-bold px-2 py-1 rounded"
                    >
                      +⚡
                    </button>
                    <button
                      onClick={() => evictResident(res.id)}
                      className="bg-rose-900/80 hover:bg-rose-800 text-rose-200 text-[10px] font-bold px-2 py-1 rounded"
                    >
                      Desalojar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DEMOLICIÓN & EVENTOS */}
      {activeAdminTab === 'events' && (
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
            <h2 className="text-sm font-black text-amber-400 uppercase tracking-wide flex items-center gap-2 border-b border-slate-800 pb-3">
              <span>💥</span>
              <span>Demolición de Pisos con Grietas & Fallos de Luz</span>
            </h2>
            <p className="text-xs text-slate-400">
              Al demoler un piso, se activan animaciones dramáticas de grietas en los muros, parpadeo estroboscópico de luces, chispas eléctricas y escombros.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {state.floors.map((floor) => (
                <div
                  key={floor.id}
                  className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-black text-white">{floor.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">Habitaciones {floor.floorNumber}01 - {floor.floorNumber}04</div>
                  </div>
                  <button
                    onClick={() => handleTriggerDemolition(floor.floorNumber)}
                    disabled={state.floors.length <= 1}
                    className="bg-rose-900/80 hover:bg-rose-800 disabled:opacity-40 text-rose-100 font-black px-3 py-1.5 rounded-lg text-xs border border-rose-500/50 shadow-md"
                  >
                    💥 Demoler
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-800 pt-3">
              <button
                onClick={() => {
                  createNextFloor();
                  hotelBroadcast.post({ type: 'CREATE_FLOOR' });
                  addLog('floor', 'Nuevo piso construido');
                }}
                className="bg-emerald-700 hover:bg-emerald-600 text-white font-black px-4 py-2 rounded-xl text-xs"
              >
                🏢 + Construir Nuevo Piso
              </button>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
            <h2 className="text-sm font-black text-amber-400 uppercase tracking-wide border-b border-slate-800 pb-3">
              ⚡ Eventos & Clima
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'FIESTA', icon: '🎉', name: 'Fiesta' },
                { id: 'APAGON', icon: '⚡', name: 'Apagón' },
                { id: 'INCENDIO', icon: '🔥', name: 'Incendio' },
                { id: 'RATAS', icon: '🐀', name: 'Ratas' },
                { id: 'TORMENTA', icon: '⛈️', name: 'Tormenta' },
                { id: 'FUEGOS', icon: '🎆', name: 'Fuegos' },
              ].map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => handleBroadcastEvent(ev.id as GlobalEventType)}
                  className="bg-slate-950 hover:bg-slate-800 p-2.5 rounded-xl border border-slate-800 text-xs font-bold text-center"
                >
                  <span className="text-lg block mb-0.5">{ev.icon}</span>
                  <span>{ev.name}</span>
                </button>
              ))}
            </div>

            <div className="border-t border-slate-800 pt-3">
              <span className="text-[10px] font-bold text-slate-400 block mb-2">Ciclo Horario:</span>
              <div className="grid grid-cols-3 gap-2">
                {(['day', 'evening', 'night'] as TimeOfDay[]).map((time) => (
                  <button
                    key={time}
                    onClick={() => handleBroadcastTime(time)}
                    className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-xs font-bold capitalize text-center"
                  >
                    {time === 'day' ? '☀️ Día' : time === 'evening' ? '🌇 Tarde' : '🌙 Noche'}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3">
              <span className="text-[10px] font-bold text-amber-300 block mb-2">🌦️ Efectos Climáticos en el Hotel:</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'SOL', icon: '☀️', name: 'Soleado' },
                  { id: 'LLUVIA', icon: '🌧️', name: 'Lluvia' },
                  { id: 'TORMENTA', icon: '⛈️', name: 'Tormenta' },
                  { id: 'NIEVE', icon: '❄️', name: 'Nieve' },
                  { id: 'NIEBLA', icon: '🌫️', name: 'Niebla' },
                  { id: 'ESTRELLAS', icon: '🌠', name: 'Estrellas' },
                ].map((w) => (
                  <button
                    key={w.id}
                    onClick={() => {
                      setWeather(w.id as any);
                      hotelBroadcast.post({ type: 'SET_WEATHER', payload: { weather: w.id as any } });
                      addLog('weather', `Clima cambiado a: ${w.name}`);
                    }}
                    className={`p-2 rounded-lg border text-xs font-bold text-center transition-all ${
                      state.weather === w.id
                        ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-md'
                        : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
                    }`}
                  >
                    <span className="block text-base">{w.icon}</span>
                    <span>{w.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: REGALOS */}
      {activeAdminTab === 'gifts' && (
        <div className="max-w-6xl mx-auto bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl animate-in fade-in duration-200">
          <h2 className="text-sm font-black text-amber-400 uppercase tracking-wide mb-4 flex items-center gap-2 border-b border-slate-800 pb-3">
            <span>🎁</span>
            <span>Simulador de Regalos TikTok LIVE</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {DEFAULT_GIFT_RULES.map((gift) => (
              <button
                key={gift.id}
                onClick={() => {
                  sendGift(gift.id);
                  hotelBroadcast.post({ type: 'SEND_GIFT', payload: { giftId: gift.id } });
                  addLog('gift', `Regalo enviado: ${gift.name} (${gift.costCoins} coins)`);
                }}
                className="bg-slate-950 hover:bg-slate-800 border border-slate-700 p-3 rounded-xl flex flex-col items-center gap-1.5 transition-all text-center shadow-sm"
              >
                <span className="text-3xl">{gift.icon}</span>
                <span className="text-xs font-black text-white">{gift.name}</span>
                <span className="text-[10px] text-amber-300 font-mono font-bold">
                  {gift.costCoins} monedas
                </span>
                <span className="text-[9px] text-slate-400 leading-tight">
                  {gift.effectDescription}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default function AdminPage() {
  return (
    <ErrorBoundary etiqueta="admin">
      <HotelProvider>
        <AdminPanelContent />
      </HotelProvider>
    </ErrorBoundary>
  );
}
