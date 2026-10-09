'use client';

import React from 'react';
import { browserReport } from '../services/browserReport';

interface Props {
  children: React.ReactNode;
  /** Texto que se muestra si algo revienta dentro. */
  etiqueta?: string;
}

interface State {
  error: Error | null;
}

/**
 * Red de seguridad del hotel.
 *
 * Sin esto, CUALQUIER excepcion durante el render tumba el arbol de React entero
 * y el usuario ve la pantalla generica de Next:
 *   "Application error: a client-side exception has occurred"
 * sin pista de que paso. Paso justo asi con un residente restaurado de
 * localStorage sin `username`: un solo objeto mal formado dejaba la app
 * inutilizable en ese dispositivo.
 *
 * Con el boundary, el fallo se aisla: se reporta al servidor (aparece en
 * /api/tiktok/log) y se ofrece recargar. Es preferible perder una seccion a
 * perder la aplicacion completa.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Al servidor: es lo que permite diagnosticar sin acceso a la consola del
    // dispositivo del usuario.
    browserReport.error('render', `excepcion en ${this.props.etiqueta || 'la app'}`, {
      mensaje: error?.message || String(error),
      stack: (error?.stack || '').split('\n').slice(0, 4).join(' | '),
      componente: (info?.componentStack || '').split('\n').slice(0, 4).join(' | '),
    });
  }

  private reintentar = () => {
    this.setState({ error: null });
  };

  private limpiarYRecargar = () => {
    // El estado persistido suele ser el origen del fallo: se descarta para que
    // el proximo arranque sea limpio en vez de volver a reventar.
    try {
      localStorage.removeItem('tiktok_hotel_active_state_v2');
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="w-full h-full min-h-[320px] flex items-center justify-center p-4 bg-slate-950">
        <div className="max-w-md w-full bg-slate-900 border-2 border-amber-500/60 rounded-xl p-5 text-center shadow-2xl">
          <div className="text-3xl mb-2">🏨💥</div>
          <h2 className="text-amber-300 font-black text-sm mb-1">
            El hotel tuvo un problema al dibujarse
          </h2>
          <p className="text-slate-300 text-[11px] leading-relaxed mb-3">
            Se ha registrado el error. Puedes reintentar; si vuelve a pasar, el
            botón de abajo limpia el estado guardado y recarga de cero.
          </p>

          <pre className="text-left text-[9px] text-red-300 bg-black/60 border border-red-500/30 rounded p-2 mb-3 overflow-x-auto whitespace-pre-wrap break-words max-h-24">
            {this.state.error?.message || 'Error desconocido'}
          </pre>

          <div className="flex gap-2 justify-center">
            <button
              onClick={this.reintentar}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] transition-colors"
            >
              Reintentar
            </button>
            <button
              onClick={this.limpiarYRecargar}
              className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-black text-[11px] transition-colors"
            >
              Limpiar y recargar
            </button>
          </div>
        </div>
      </div>
    );
  }
}
