'use client';

import React, { useEffect, useState } from 'react';

/**
 * Pantalla de acceso al panel de administración.
 *
 * El objetivo no es esconder secretos, sino saber QUIÉN manda en el hotel: hasta
 * ahora cualquiera que abriera `/admin` podía cambiar reglas, demoler pisos o
 * reiniciar el directo.
 *
 * La contraseña se comprueba en el SERVIDOR (`/api/admin/auth`) y la sesión
 * queda en una cookie `httpOnly`, que el JavaScript de esta página no puede
 * leer. Aquí solo se pregunta y se muestra el resultado.
 */
export const AdminLogin: React.FC<{ onAcceso: () => void }> = ({ onAcceso }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [usandoPorDefecto, setUsandoPorDefecto] = useState(false);

  // Al montar, comprobar si ya hay sesión (por ejemplo, al recargar).
  useEffect(() => {
    fetch('/api/admin/auth', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d?.autenticado) onAcceso();
        if (d?.usandoPasswordPorDefecto) setUsandoPorDefecto(true);
      })
      .catch(() => {
        // Sin respuesta del servidor: se queda en la pantalla de acceso.
      });
  }, [onAcceso]);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const d = await res.json();
      if (d?.ok) {
        if (d.usandoPasswordPorDefecto) setUsandoPorDefecto(true);
        onAcceso();
      } else {
        setError(d?.error || 'No se pudo entrar');
        setPassword('');
      }
    } catch {
      setError('No hay conexión con el servidor');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm">
        <div className="bg-slate-900 border-2 border-amber-500/60 rounded-2xl p-6 shadow-2xl">
          <div className="text-center mb-5">
            <div className="text-4xl mb-2">🏨</div>
            <h1 className="text-lg font-black text-amber-400 tracking-tight">
              TIKTOK HOTEL
            </h1>
            <p className="text-xs text-slate-400 mt-1">Panel de administración</p>
          </div>

          <form onSubmit={entrar} className="flex flex-col gap-3">
            <label className="text-xs font-bold text-slate-300">
              Contraseña de administrador
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
            />

            {error && (
              <div className="bg-rose-950/80 border border-rose-500/50 rounded-xl p-2.5 text-xs text-rose-200 flex items-center gap-2">
                <span>❌</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={cargando || !password}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black py-2.5 rounded-xl text-sm transition-all shadow-md"
            >
              {cargando ? '⏳ Entrando...' : '🔓 Entrar'}
            </button>
          </form>

          {usandoPorDefecto && (
            <div className="mt-4 bg-amber-950/60 border border-amber-500/40 rounded-xl p-3 text-[11px] text-amber-200 leading-relaxed">
              <div className="font-black mb-1">⚠️ Contraseña por defecto</div>
              <p>
                Ahora mismo la contraseña es <code className="bg-black/50 px-1 rounded">hermes</code>.
                Para cambiarla, define la variable de entorno{' '}
                <code className="bg-black/50 px-1 rounded">ADMIN_PASSWORD</code> al
                arrancar el contenedor.
              </p>
            </div>
          )}

          <a
            href="/"
            className="block text-center text-[11px] text-slate-500 hover:text-slate-300 mt-4 transition-colors"
          >
            ← Volver al hotel
          </a>
        </div>

        <p className="text-center text-[10px] text-slate-600 mt-3">
          La sesión dura 12 horas. La cookie es <code>httpOnly</code>: el JavaScript
          de la página no puede leerla.
        </p>
      </div>
    </div>
  );
};
