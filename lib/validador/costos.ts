// El costo de cada análisis.
//
// Fuente: Anthropic, Pricing — https://platform.claude.com/docs/en/about-claude/pricing
// (consultado el 27 de octubre de 2026). Precios en US$ por millón de tokens.
//
// Los tokens de caché tienen tarifa propia y se verificaron en la misma página: la ESCRITURA con TTL de
// 5 minutos cuesta 1,25 × la entrada, y la LECTURA 0,05 × la entrada en Opus 5.5 y Sonnet 5.5 (no el
// 0,1 × de otros modelos). Por eso se guardan separados de la entrada al calcular, aunque la tabla
// `analisis` los sume en `tokens_de_cache`.

export const PRECIOS: Readonly<Record<string, { entrada: number; salida: number; escrituraDeCache: number; lecturaDeCache: number }>> = {
  'claude-sonnet-5-5': { entrada: 2, salida: 10, escrituraDeCache: 2.5, lecturaDeCache: 0.1 },
  'claude-opus-5-5': { entrada: 4, salida: 20, escrituraDeCache: 5, lecturaDeCache: 0.2 },
};

/** S/ por US$. Supuesto del presupuesto del proyecto, no un tipo de cambio del día. */
export const TIPO_DE_CAMBIO_REFERENCIAL = 3.4;

export interface Uso {
  entrada: number;
  salida: number;
  escrituraDeCache: number;
  lecturaDeCache: number;
}

export const USO_EN_CERO: Uso = { entrada: 0, salida: 0, escrituraDeCache: 0, lecturaDeCache: 0 };

export function sumarUso(a: Uso, b: Uso): Uso {
  return {
    entrada: a.entrada + b.entrada,
    salida: a.salida + b.salida,
    escrituraDeCache: a.escrituraDeCache + b.escrituraDeCache,
    lecturaDeCache: a.lecturaDeCache + b.lecturaDeCache,
  };
}

/**
 * El costo en US$ de una llamada. `modelo` es el que RESPONDIÓ (con el respaldo ante rechazos puede
 * ser otro que el pedido); si no está en la tabla se cobra con el pedido y se avisa.
 */
export function costoEnDolares(modelo: string, pedido: string, uso: Uso): { costo: number; modeloSinPrecio: boolean } {
  const precio = PRECIOS[modelo] ?? PRECIOS[pedido];
  if (!precio) return { costo: 0, modeloSinPrecio: true };
  const costo =
    (uso.entrada * precio.entrada +
      uso.salida * precio.salida +
      uso.escrituraDeCache * precio.escrituraDeCache +
      uso.lecturaDeCache * precio.lecturaDeCache) /
    1_000_000;
  return { costo, modeloSinPrecio: PRECIOS[modelo] === undefined };
}

export function enSoles(dolares: number): number {
  return dolares * TIPO_DE_CAMBIO_REFERENCIAL;
}
