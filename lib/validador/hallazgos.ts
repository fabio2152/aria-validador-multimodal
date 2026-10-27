// La forma de un hallazgo antes de guardarse, la misma venga de donde venga: la capa determinística,
// el motor o la revisión. La regla se resuelve después (`flujo.ts`), contra la versión del análisis.

import type { OrigenDelHallazgo } from './esquema.ts';

export interface HallazgoPropuesto {
  codigo_de_regla: string;
  evidencia: string;
  /** `copy`, `guion`, `imagen`, `texto_en_imagen` o `archivo` (los metadatos de la imagen). */
  ubicacion: string;
  /** De 0 a 1. Las determinísticas valen 1. */
  confianza: number;
  sugerencia: string | null;
  origen: OrigenDelHallazgo;
}

export const UBICACIONES = ['copy', 'guion', 'imagen', 'texto_en_imagen', 'archivo'] as const;
