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

/**
 * Las verificaciones de UNA imagen. `orden` es su lugar en el carrusel o en la secuencia (desde 1), y
 * `total`, cuántas tiene la pieza: con una sola, la evidencia no la numera.
 */
export function verificarImagen(dimensiones: Dimensiones, pesoEnBytes: number, formato: FormatoDestino, orden = 1, total = 1): HallazgoPropuesto[] {
  const hallazgos: HallazgoPropuesto[] = [];
  const { ancho, alto } = dimensiones;
  const aspecto = ancho / alto;
  const admitidos = ASPECTOS[formato];
  const cual = total > 1 ? `La imagen ${orden}` : 'La imagen';
  const base = { ubicacion: 'archivo', imagen: orden, confianza: 1, origen: 'deterministica' as const };

  if (!admitidos.some((a) => Math.abs(aspecto - a.valor) / a.valor <= TOLERANCIA_DE_ASPECTO)) {
    const lista = admitidos.map((a) => a.nombre).join(' o ');
    hallazgos.push({
      ...base,
      codigo_de_regla: 'FMT-01',
      evidencia: `${cual} mide ${ancho} × ${alto} px (${razon(ancho, alto)}); ${formato === 'historia' ? 'una historia' : 'un post'} pide ${lista}.`,
      sugerencia: `Recortar o rediseñar la imagen en ${lista}.`,
    });
  }
  if (Math.min(ancho, alto) < LADO_CORTO_MINIMO) {
    hallazgos.push({
      ...base,
      codigo_de_regla: 'FMT-02',
      evidencia: `${cual}: el lado corto mide ${Math.min(ancho, alto)} px; el mínimo es ${LADO_CORTO_MINIMO} px.`,
      sugerencia: `Exportar la imagen con el lado corto de al menos ${LADO_CORTO_MINIMO} px.`,
    });
  }
  if (pesoEnBytes > PESO_MAXIMO_EN_BYTES) {
    hallazgos.push({
      ...base,
      codigo_de_regla: 'FMT-03',
      evidencia: `${cual} pesa ${(pesoEnBytes / 1024 / 1024).toFixed(1)} MB; Meta admite hasta 30 MB.`,
      sugerencia: 'Comprimir la imagen o exportarla en JPG.',
    });
  }
  return hallazgos;
}

/**
 * En un carrusel, Instagram recorta todas las imágenes a la relación de aspecto de la PRIMERA: una con otra
 * relación se publica cortada. Es parte de `FMT-01` (relación de aspecto), y sólo aplica a un post con más
 * de una imagen: cada historia se ve sola.
 */
export function verificarCarrusel(dimensiones: readonly Dimensiones[], formato: FormatoDestino): HallazgoPropuesto[] {
  if (formato !== 'feed' || dimensiones.length < 2) return [];
  const primera = dimensiones[0]!;
  const aspecto = primera.ancho / primera.alto;
  return dimensiones.flatMap((d, i): HallazgoPropuesto[] => {
    if (i === 0 || Math.abs(d.ancho / d.alto - aspecto) / aspecto <= TOLERANCIA_DE_ASPECTO) return [];
    return [
      {
        codigo_de_regla: 'FMT-01',
        evidencia: `La imagen ${i + 1} es ${razon(d.ancho, d.alto)} y la primera, ${razon(primera.ancho, primera.alto)}: Instagram recorta todo el carrusel a la relación de la primera.`,
        ubicacion: 'archivo',
        imagen: i + 1,
        confianza: 1,
        sugerencia: 'Exportar todas las imágenes del carrusel con la misma relación de aspecto.',
        origen: 'deterministica',
      },
    ];
  });
}

export function verificarCopy(copy: string): HallazgoPropuesto[] {
  const largo = [...copy.trim()].length;
  if (largo <= LARGO_VISIBLE_DEL_COPY) return [];
  return [
    {
      codigo_de_regla: 'FMT-04',
      evidencia: `El copy tiene ${largo} caracteres; lo visible antes de «Ver más» son unos ${LARGO_VISIBLE_DEL_COPY}.`,
      ubicacion: 'copy',
      imagen: null,
      confianza: 1,
      sugerencia: `Llevar el mensaje principal a los primeros ${LARGO_VISIBLE_DEL_COPY} caracteres.`,
      origen: 'deterministica',
    },
  ];
}
