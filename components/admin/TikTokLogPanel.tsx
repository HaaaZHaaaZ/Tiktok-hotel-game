'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Panel de log de la conexion con TikTok, para el dashboard de /admin.
 *
 * Muestra el estado de la tuberia (resumen del servidor) y las ultimas lineas,
 * con refresco automatico y un boton para copiarlo TODO. El log se pide en
 * texto plano al servidor (`/api/tiktok/log?format=text`) porque asi se pega
 * directamente en un chat sin limpiar nada.
 *
 * El resumen es lo que dice donde se rompe, asi que va en prominente:
 *  - lecturasCliente subiendo + bufferPendiente subiendo -> el navegador no
 *    procesa lo que recibe
 *  - eventos quietos + estado 'connected' -> no llega nada de TikTok
 *  - desfaseCursorSeg muy positivo -> cursor envenenado
 */

interface Summary {
  estado: string;
  streamer: string;
  uptimeSeg: number;
  eventos: Record<string, number>;
  recibidoPorTikTok: Record<string, number>;
  lecturasCliente: number;
  segundosDesdeUltimaLectura: number | null;
  desfaseCursorSeg: number | null;
  bufferPendiente: number;
  ultimoError: string | null;
}

const STATE_STYLES: Record<string, string> = {
  connected: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  connecting: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  reconnecting: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  error: 'bg-red-500/20 text-red-300 border-red-500/40',
  idle: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
};

export const TikTokLogPanel: React.FC = () => {
  const [text, setText] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [copied, setCopied] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLPreElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/tiktok/log?format=text', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const t = await res.text();
      setText(t);
      setError(null);

      // El resumen llega como el primer bloque JSON del texto plano.
      const m = t.match(/=== ESTADO DE LA TUBERIA TIKTOK ===\s*(\{[\s\S]*?\n\})/);
      if (m) {
        try {
          setSummary(JSON.parse(m[1]) as Summary);
        } catch {
          setSummary(null);
        }
      }
    } catch (e: any) {
      setError(e?.message || 'No se pudo leer el log');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  // Mantener el final del log a la vista cuando hay auto-refresco.
  useEffect(() => {
    if (autoRefresh && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [text, autoRefresh]);

  const handleCopy = async () => {
    const toCopy = text || '(log vacio)';
    try {
      await navigator.clipboard.writeText(toCopy);
    } catch {
      // Fallback para navegadores sin permiso de portapapeles.
      const ta = document.createElement('textarea');
      ta.value = toCopy;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* si tampoco funciona, el texto sigue seleccionable a mano */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Diagnostico automatico a partir del resumen: lo que mas se necesita ver.
  const diagnosis = (() => {
    if (!summary) return null;
    if (
      summary.lecturasCliente > 5 &&
      summary.bufferPendiente > 20 &&
      summary.segundosDesdeUltimaLectura !== null &&
      summary.segundosDesdeUltimaLectura < 15
    ) {
      return {
        tone: 'warn' as const,
        text: 'El servidor entrega y el cliente LEE, pero los eventos se acumulan sin procesarse. El problema esta en el navegador, no en TikTok.',
      };
    }
    if (summary.desfaseCursorSeg !== null && summary.desfaseCursorSeg > 30) {
      return {
        tone: 'error' as const,
        text: `Cursor envenenado: va ${summary.desfaseCursorSeg}s por delante del servidor. Recargar la pagina lo reinicia.`,
      };
    }
    if (
      summary.estado === 'connected' &&
      (summary.segundosDesdeUltimaLectura ?? 0) > 30
    ) {
      return {
        tone: 'error' as const,
        text: 'El navegador dejo de pedir eventos. Recargar la pagina; el guardian deberia Bastar pero no haelo.',
      };
    }
    if (summary.estado !== 'connected' && summary.estado !== 'idle') {
      return { tone: 'warn' as const, text: `Conexion en estado '${summary.estado}'.` };
    }
    return null;
  })();

  return (
    <div className="flex flex-col gap-3">
      {/* Controles */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={load}
          className="bg-slate-700 hover:bg-slate-600 text-white font-black text-[10px] px-2.5 py-1.5 rounded-lg border border-slate-600"
        >
          ↻ Actualizar
        </button>
        <button
          onClick={handleCopy}
          className={`font-black text-[10px] px-2.5 py-1.5 rounded-lg border transition-colors ${
            copied
              ? 'bg-emerald-600 text-white border-emerald-500'
              : 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-500'
          }`}
          title="Copiar todo el log al portapapeles"
        >
          {copied ? '✓ Copiado' : '📋 Copiar todo el log'}
        </button>
        <label className="flex items-center gap-1.5 text-[10px] text-slate-300 font-bold cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="accent-cyan-500 w-3 h-3"
          />
          Auto-refresco (5s)
        </label>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-500/40 text-red-300 text-[11px] font-bold px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Resumen de la tuberia */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-slate-800/70 border border-slate-700 rounded-lg px-2.5 py-1.5">
            <div className="text-[9px] text-slate-400 font-black uppercase">Estado</div>
            <div
              className={`text-[11px] font-black mt-0.5 px-1.5 py-0.5 rounded border inline-block ${
                STATE_STYLES[summary.estado] || STATE_STYLES.idle
              }`}
            >
              {summary.estado}
            </div>
            {summary.streamer && (
              <div className="text-[10px] text-slate-300 font-bold mt-0.5 truncate">
                {summary.streamer}
              </div>
            )}
          </div>

          <div className="bg-slate-800/70 border border-slate-700 rounded-lg px-2.5 py-1.5">
            <div className="text-[9px] text-slate-400 font-black uppercase">Del live</div>
            <div className="text-[11px] font-black mt-0.5 text-emerald-300">
              {Object.values(summary.recibidoPorTikTok || {}).reduce((a, b) => a + b, 0)}
            </div>
            <div className="text-[9px] text-slate-400 font-bold mt-0.5 truncate">
              {Object.entries(summary.recibidoPorTikTok || {})
                .map(([k, v]) => `${k}:${v}`)
                .join(' ') || 'nada'}
            </div>
          </div>

          <div className="bg-slate-800/70 border border-slate-700 rounded-lg px-2.5 py-1.5">
            <div className="text-[9px] text-slate-400 font-black uppercase">Buffer</div>
            <div
              className={`text-[11px] font-black mt-0.5 ${
                summary.bufferPendiente > 20 ? 'text-amber-300' : 'text-slate-200'
              }`}
            >
              {summary.bufferPendiente}
            </div>
            <div className="text-[9px] text-slate-400 font-bold mt-0.5">
              lecturas: {summary.lecturasCliente}
            </div>
          </div>

          <div className="bg-slate-800/70 border border-slate-700 rounded-lg px-2.5 py-1.5">
            <div className="text-[9px] text-slate-400 font-black uppercase">Ultima lectura</div>
            <div
              className={`text-[11px] font-black mt-0.5 ${
                (summary.segundosDesdeUltimaLectura ?? 0) > 30
                  ? 'text-red-300'
                  : 'text-slate-200'
              }`}
            >
              {summary.segundosDesdeUltimaLectura ?? '—'}s
            </div>
            <div className="text-[9px] text-slate-400 font-bold mt-0.5">
              desfase: {summary.desfaseCursorSeg ?? '—'}s
            </div>
          </div>
        </div>
      )}

      {/* Diagnostico */}
      {diagnosis && (
        <div
          className={`text-[11px] font-bold px-3 py-2 rounded-lg border ${
            diagnosis.tone === 'error'
              ? 'bg-red-900/40 border-red-500/40 text-red-200'
              : 'bg-amber-900/40 border-amber-500/40 text-amber-200'
          }`}
        >
          {diagnosis.text}
        </div>
      )}

      {/* Lineas del log */}
      <pre
        ref={logRef}
        className="bg-black/60 border border-slate-700 rounded-lg p-3 text-[10px] font-mono leading-relaxed text-slate-300 overflow-auto max-h-[320px] whitespace-pre-wrap break-all"
      >
        {text || 'Sin datos. Pulsa "Actualizar".'}
      </pre>

      {summary?.ultimoError && (
        <div className="text-[10px] text-slate-500 font-mono">
          ultimoError del servidor: {summary.ultimoError}
        </div>
      )}
    </div>
  );
};