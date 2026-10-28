// La forma de un hallazgo antes de guardarse, la misma venga de donde venga: la capa determinística,
// el motor o la revisión. La regla se resuelve después (`flujo.ts`), contra la versión del análisis.

import type { OrigenDelHallazgo } from './esquema.ts';

export interface HallazgoPropuesto {
  codigo_de_regla: string;
  evidencia: string;
  /** `copy`, `imagen`, `texto_en_imagen` o `archivo` (los metadatos de la imagen). */
  ubicacion: string;
  /** En qué imagen del carrusel o de la secuencia está, desde 1; `null` si es del copy o de la pieza entera. */
  imagen: number | null;
  /** De 0 a 1. Las determinísticas valen 1. */
  confianza: number;
  sugerencia: string | null;
  origen: OrigenDelHallazgo;
}

export const UBICACIONES = ['copy', 'imagen', 'texto_en_imagen', 'archivo'] as const;

/**
 * Cuántas imágenes admite una pieza: el tope de Instagram para un carrusel de fotos en un post, que sube de
 * 10 a 20 en 2024. Se usa el mismo para una secuencia de historias consecutivas. Fuentes (consultadas el
 * 28 de octubre de 2026): https://contentstudio.io/blog/how-many-photos-can-you-post-on-instagram ·
 * https://www.socialsamosa.com/news-2/instagram-carousel-feature-20-frames-6810438
 */
export const MAXIMO_DE_IMAGENES = 20;
