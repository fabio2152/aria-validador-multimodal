// El nivel de riesgo de una pieza, de la severidad de sus hallazgos (sección 5.6).
//
//   al menos una alta              → alto
//   sin altas, al menos una media  → medio
//   sólo bajas                     → bajo
//   ninguno                        → sin_hallazgos

import type { NivelDeRiesgo, Severidad } from './esquema.ts';

export function nivelDeRiesgo(hallazgos: readonly { severidad: Severidad }[]): NivelDeRiesgo {
  if (hallazgos.some((h) => h.severidad === 'alta')) return 'alto';
  if (hallazgos.some((h) => h.severidad === 'media')) return 'medio';
  if (hallazgos.length > 0) return 'bajo';
  return 'sin_hallazgos';
}

export const NOMBRE_DEL_RIESGO: Readonly<Record<NivelDeRiesgo, string>> = {
  alto: 'Riesgo alto',
  medio: 'Riesgo medio',
  bajo: 'Riesgo bajo',
  sin_hallazgos: 'Sin hallazgos',
};
