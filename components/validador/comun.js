'use client';

/* Lo que comparten las piezas del validador: los textos de los niveles y severidades, los formatos de
 * número y fecha, y el envío de una pieza (multipart, que `pedir()` de `lib/http/cliente.ts` no cubre). */

import { pedir } from '../../lib/http/cliente.ts';

export { pedir };

export const NIVELES = {
  alto: { nombre: 'Riesgo alto', clase: 'alto' },
  medio: { nombre: 'Riesgo medio', clase: 'medio' },
  bajo: { nombre: 'Riesgo bajo', clase: 'bajo' },
  sin_hallazgos: { nombre: 'Sin hallazgos', clase: 'limpio' },
};

export const EJES = { marca: 'Marca', plataforma: 'Plataforma' };
export const SEVERIDADES = { alta: 'Alta', media: 'Media', baja: 'Baja' };
export const FORMATOS = { feed: 'Feed', historia: 'Historia', reel: 'Reel' };
export const UBICACIONES = {
  copy: 'copy',
  guion: 'guion',
  imagen: 'imagen',
  texto_en_imagen: 'texto en la imagen',
  archivo: 'archivo',
};
export const ORIGENES = {
  deterministica: 'verificación determinística',
  modelo: 'análisis con Claude',
  revision: 'confirmado en segunda revisión',
};

const ZONA = 'America/Lima';

export function fecha(iso) {
  return new Intl.DateTimeFormat('es-PE', { timeZone: ZONA, day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
}

export function fechaYHora(iso) {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: ZONA,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function segundos(ms) {
  return `${(ms / 1000).toLocaleString('es-PE', { maximumFractionDigits: 1 })} s`;
}

export function soles(monto) {
  return `S/ ${monto.toLocaleString('es-PE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
}

export function dolares(monto) {
  return `US$ ${monto.toLocaleString('es-PE', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
}

export function pesoLegible(bytes) {
  if (bytes == null) return null;
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

/** El texto de un rechazo de `pedir()` o de `enviarPieza()`, para mostrar. */
export function textoDelRechazo(r) {
  if (r.tipo === 'sin_respuesta') return 'No se pudo contactar al servidor. ¿Sigue corriendo npm run dev?';
  return r.detalle ?? `El servidor respondió ${r.estado}.`;
}

/** Envía la pieza como `multipart/form-data`. Devuelve las mismas tres ramas que `pedir()`. */
export async function enviarPieza(formulario) {
  let respuesta;
  try {
    respuesta = await fetch('/api/validador/analisis', {
      method: 'POST',
      body: formulario,
      cache: 'no-store',
      signal: AbortSignal.timeout(300_000),
    });
  } catch (e) {
    return { tipo: 'sin_respuesta', causa: e instanceof Error ? e.message : 'desconocida' };
  }
  let cuerpo = null;
  try {
    cuerpo = await respuesta.json();
  } catch {
    // Sin cuerpo JSON: se informa con el estado.
  }
  if (!respuesta.ok) {
    return { tipo: 'rechazado', estado: respuesta.status, codigo: cuerpo?.codigo ?? 'sin_codigo', detalle: cuerpo?.detalle };
  }
  return { tipo: 'datos', datos: cuerpo };
}

/** La URL de la imagen de un análisis. */
export function urlDelArchivo(id) {
  return `/api/validador/analisis/${id}/archivo`;
}
