// La revisión de los casos dudosos (sección 5.5).
//
// Si algún hallazgo del motor tiene confianza menor que `UMBRAL_DE_REVISION`, se repite el análisis
// SÓLO con las reglas implicadas, con el modelo de revisión. Un hallazgo dudoso queda si la revisión
// vuelve a encontrar su regla —con la evidencia de la revisión y `origen = 'revision'`— y se descarta si
// no. Los hallazgos seguros del motor no se tocan. Los tokens y el costo se suman al análisis.

import { analizarConClaude, type PiezaParaElModelo } from './motor.ts';
import { ESFUERZO_DE_REVISION_DEL_VALIDADOR, MODELO_DE_REVISION_DEL_VALIDADOR } from './modelos.ts';
import { USO_EN_CERO, type Uso } from './costos.ts';
import type { Regla } from './corpus.ts';
import type { HallazgoPropuesto } from './hallazgos.ts';

export const UMBRAL_DE_REVISION = 0.6;

export type ResultadoDeLaRevision =
  | { tipo: 'sin_dudas'; hallazgos: HallazgoPropuesto[] }
  | { tipo: 'revisada'; hallazgos: HallazgoPropuesto[]; confirmados: number; descartados: number; uso: Uso; modelo: string }
  // La revisión falló: se quedan los dudosos como están y se avisa, en vez de perder el análisis.
  | { tipo: 'no_revisada'; hallazgos: HallazgoPropuesto[]; causa: string; uso: Uso };

export async function revisarDudosos(opciones: {
  llave: string;
  hallazgos: readonly HallazgoPropuesto[];
  reglas: readonly Regla[];
  pieza: PiezaParaElModelo;
}): Promise<ResultadoDeLaRevision> {
  const dudosos = opciones.hallazgos.filter((h) => h.confianza < UMBRAL_DE_REVISION);
  if (dudosos.length === 0) return { tipo: 'sin_dudas', hallazgos: [...opciones.hallazgos] };

  const seguros = opciones.hallazgos.filter((h) => h.confianza >= UMBRAL_DE_REVISION);
  const implicadas = new Set(dudosos.map((h) => h.codigo_de_regla));
  const reglas = opciones.reglas.filter((r) => implicadas.has(r.codigo));

  const r = await analizarConClaude({
    llave: opciones.llave,
    modelo: MODELO_DE_REVISION_DEL_VALIDADOR,
    esfuerzo: ESFUERZO_DE_REVISION_DEL_VALIDADOR,
    reglas,
    noAplican: [],
    pieza: opciones.pieza,
    instruccion:
      'Eres la segunda revisión: otro revisor marcó posibles incumplimientos de estas reglas con poca confianza. ' +
      'Confírmalos sólo si la pieza realmente las incumple; si no, no los registres.',
  });
  if (r.tipo === 'fallo') return { tipo: 'no_revisada', hallazgos: [...opciones.hallazgos], causa: r.detalle, uso: r.uso ?? USO_EN_CERO };

  const confirmados = r.hallazgos.filter((h) => implicadas.has(h.codigo_de_regla)).map((h) => ({ ...h, origen: 'revision' as const }));
  const codigosConfirmados = new Set(confirmados.map((h) => h.codigo_de_regla));
  return {
    tipo: 'revisada',
    hallazgos: [...seguros, ...confirmados],
    confirmados: confirmados.length,
    descartados: dudosos.filter((h) => !codigosConfirmados.has(h.codigo_de_regla)).length,
    uso: r.uso,
    modelo: r.modelo,
  };
}
