// Los modelos del validador, como `lib/agentes/modelos.ts` de ARIA: CONSTANTES y no variables de
// entorno. Cambiar de modelo es un cambio de código que se revisa, no un valor que alguien edita en un
// panel sin que nadie mida el efecto en los KPIs. Al integrar se mudan a `lib/agentes/modelos.ts` y
// entran a la prueba de modelos válidos de ARIA.

/** El motor de análisis: una llamada por pieza. */
export const MODELO_DEL_VALIDADOR = 'claude-sonnet-5-5';

/** La segunda revisión, sólo para los hallazgos dudosos (`lib/validador/revision.ts`). */
export const MODELO_DE_REVISION_DEL_VALIDADOR = 'claude-opus-5-5';

/**
 * El esfuerzo de cada llamada (`output_config.effort`). `medium` en los dos: la tarea es leer una pieza
 * contra un corpus corto, y la meta de tiempo es de 60 s por pieza (KPI K4). Se fija explícito porque el
 * valor por omisión NO es el mismo en los dos modelos (Sonnet 5.5: `high`; Opus 5.5: `medium`).
 */
export const ESFUERZO_DEL_VALIDADOR = 'medium';
export const ESFUERZO_DE_REVISION_DEL_VALIDADOR = 'medium';
