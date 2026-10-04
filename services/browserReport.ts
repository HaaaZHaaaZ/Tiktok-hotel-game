'use client';

/**
 * Reporte del navegador al servidor.
 *
 * El servidor era el punto ciego: se veia que TikTok emitia y que el buffer se
 * llenaba, pero no lo que hacia el navegador con esos eventos — y ahi estaba el
 * bug. Este modulo envia al servidor lo que pasa en el lado del cliente:
 * errores de JS, estado del polling, y cada entrada al hotel.
 *
 * Es a prueba de fallos: si el reporte falla, no rompe nada silenciosamente
 * (nunca debe lanzar desde aqui).
 */

type Nivel = 'info' | 'warn' | 'error';

let instalado = false;
let ultimoReporte = 0;

async function enviar(nivel: Nivel, tag: string, msg: string, data?: Record<string, unknown>) {
  try {
    // No inundar: maximo un reporte cada 2s salvo errores, que siempre pasan.
    if (nivel !== 'error') {
      const now = Date.now();
      if (now - ultimoReporte < 2000) return;
      ultimoReporte = now;
    }
    await fetch('/api/tiktok/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nivel, tag, msg, data }),
      keepalive: true,
    });
  } catch {
    // Si falla el reporte, no pasa nada: es diagnostico, nunca critico.
  }
}

export const browserReport = {
  info: (tag: string, msg: string, data?: Record<string, unknown>) =>
    enviar('info', tag, msg, data),
  warn: (tag: string, msg: string, data?: Record<string, unknown>) =>
    enviar('warn', tag, msg, data),
  error: (tag: string, msg: string, data?: Record<string, unknown>) =>
    enviar('error', tag, msg, data),

  /** Estado del pipeline cliente: se manda al arrancar y cada 30s. */
  estado: (extra: Record<string, unknown> = {}) => {
    enviar('info', 'estado', 'latido del navegador', extra);
  },
};

/**
 * Captura los errores globales de JS. Sin esto, una excepcion en un render
 * deja la pagina a medias y no hay ninguna huella en el servidor: es
 * exactamente el tipo de fallo que no se puede ver desde fuera.
 */
export function instalarReportes() {
  if (instalado || typeof window === 'undefined') return;
  instalado = true;

  window.addEventListener('error', (e: ErrorEvent) => {
    enviar('error', 'excepcion', e.message || 'error desconocido', {
      archivo: e.filename,
      linea: e.lineno,
      columna: e.colno,
      url: location.pathname,
    });
  });

  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    const r: any = e.reason;
    enviar('error', 'promesa', r?.message || String(r || 'rechazo sin motivo'), {
      url: location.pathname,
    });
  });

  // Latido: confirma que el navegador esta vivo y leyendo.
  browserReport.estado({ url: location.pathname, urlCompleta: location.href });
  setInterval(() => {
    browserReport.estado({
      url: location.pathname,
      online: navigator.onLine,
      visibilidad: document.visibilityState,
    });
  }, 30_000);
}