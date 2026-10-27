// La capa determinística: reglas exactas que corren ANTES de Claude (sección 5.3).
//
// Cada hallazgo cita su regla con `origen = 'deterministica'` y `confianza = 1`. Los límites salen de
// la Guía de anuncios de Meta (ver `db/sembrado/corpus-semilla.ts`, con la fecha de la consulta).

import { imageSize } from 'image-size';
import type { FormatoDestino } from './esquema.ts';
import type { HallazgoPropuesto } from './hallazgos.ts';

/** Meta acepta la relación de aspecto con un 3 % de tolerancia. */
export const TOLERANCIA_DE_ASPECTO = 0.03;
export const LADO_CORTO_MINIMO = 1080;
export const PESO_MAXIMO_EN_BYTES = 30 * 1024 * 1024;
export const LARGO_VISIBLE_DEL_COPY = 150;

const ASPECTOS: Readonly<Record<FormatoDestino, readonly { nombre: string; valor: number }[]>> = {
  feed: [
    { nombre: '1:1', valor: 1 },
    { nombre: '4:5', valor: 4 / 5 },
  ],
  historia: [{ nombre: '9:16', valor: 9 / 16 }],
  reel: [{ nombre: '9:16', valor: 9 / 16 }],
};

export interface Dimensiones {
  ancho: number;
  alto: number;
}

/** El ancho y el alto sin procesar la imagen; `null` si el archivo no es una imagen legible. */
export function dimensionesDe(bytes: Uint8Array): Dimensiones | null {
  try {
    const d = imageSize(bytes);
    if (!d.width || !d.height) return null;
    // Una foto girada por EXIF se ve con los lados cambiados: se mide como se ve.
    const girada = d.orientation !== undefined && d.orientation >= 5;
    return girada ? { ancho: d.height, alto: d.width } : { ancho: d.width, alto: d.height };
  } catch {
    return null;
  }
}

function razon(a: number, b: number): string {
  const mcd = (x: number, y: number): number => (y === 0 ? x : mcd(y, x % y));
  const m = mcd(a, b);
  return `${a / m}:${b / m}`;
}

export function verificarImagen(dimensiones: Dimensiones, pesoEnBytes: number, formato: FormatoDestino): HallazgoPropuesto[] {
  const hallazgos: HallazgoPropuesto[] = [];
  const { ancho, alto } = dimensiones;
  const aspecto = ancho / alto;
  const admitidos = ASPECTOS[formato];

  if (!admitidos.some((a) => Math.abs(aspecto - a.valor) / a.valor <= TOLERANCIA_DE_ASPECTO)) {
    const lista = admitidos.map((a) => a.nombre).join(' o ');
    hallazgos.push({
      codigo_de_regla: 'FMT-01',
      evidencia: `La imagen mide ${ancho} × ${alto} px (${razon(ancho, alto)}); el formato ${formato} pide ${lista}.`,
      ubicacion: 'archivo',
      confianza: 1,
      sugerencia: `Recortar o rediseñar la pieza en ${lista}.`,
      origen: 'deterministica',
    });
  }
  if (Math.min(ancho, alto) < LADO_CORTO_MINIMO) {
    hallazgos.push({
      codigo_de_regla: 'FMT-02',
      evidencia: `El lado corto mide ${Math.min(ancho, alto)} px; el mínimo es ${LADO_CORTO_MINIMO} px.`,
      ubicacion: 'archivo',
      confianza: 1,
      sugerencia: `Exportar la pieza con el lado corto de al menos ${LADO_CORTO_MINIMO} px.`,
      origen: 'deterministica',
    });
  }
  if (pesoEnBytes > PESO_MAXIMO_EN_BYTES) {
    hallazgos.push({
      codigo_de_regla: 'FMT-03',
      evidencia: `El archivo pesa ${(pesoEnBytes / 1024 / 1024).toFixed(1)} MB; Meta admite hasta 30 MB.`,
      ubicacion: 'archivo',
      confianza: 1,
      sugerencia: 'Comprimir la imagen o exportarla en JPG.',
      origen: 'deterministica',
    });
  }
  return hallazgos;
}

export function verificarCopy(copy: string): HallazgoPropuesto[] {
  const largo = [...copy.trim()].length;
  if (largo <= LARGO_VISIBLE_DEL_COPY) return [];
  return [
    {
      codigo_de_regla: 'FMT-04',
      evidencia: `El copy tiene ${largo} caracteres; lo visible antes de «Ver más» son unos ${LARGO_VISIBLE_DEL_COPY}.`,
      ubicacion: 'copy',
      confianza: 1,
      sugerencia: `Llevar el mensaje principal a los primeros ${LARGO_VISIBLE_DEL_COPY} caracteres.`,
      origen: 'deterministica',
    },
  ];
}
