// El cliente de LanguageTool, la ortografía de `MARCA-ORT-01` (sección 5.3).
//
// Un servicio auxiliar NUNCA bloquea el flujo: si no responde, el análisis sigue y deja la advertencia
// «Ortografía no verificada», visible en el resultado.

import type { HallazgoPropuesto } from './hallazgos.ts';

const ESPERA_MS = 10_000;

/** Reglas de LanguageTool que no son ortografía ni gramática del mensaje. */
const IGNORADAS = new Set(['WHITESPACE_RULE', 'COMMA_PARENTHESIS_WHITESPACE', 'UPPERCASE_SENTENCE_START']);

interface Coincidencia {
  message: string;
  offset: number;
  length: number;
  replacements: { value: string }[];
  rule: { id: string };
}

export type ResultadoDeOrtografia = { tipo: 'verificada'; hallazgos: HallazgoPropuesto[] } | { tipo: 'no_verificada'; causa: string };

export async function verificarOrtografia(textos: readonly { texto: string; ubicacion: 'copy' | 'guion' }[]): Promise<ResultadoDeOrtografia> {
  const url = process.env.LANGUAGETOOL_URL?.trim();
  if (!url) return { tipo: 'no_verificada', causa: 'LANGUAGETOOL_URL no está configurada' };

  const hallazgos: HallazgoPropuesto[] = [];
  for (const { texto, ubicacion } of textos) {
    if (texto.trim() === '') continue;
    let coincidencias: Coincidencia[];
    try {
      const r = await fetch(`${url.replace(/\/$/, '')}/v2/check`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ text: texto, language: 'es' }),
        signal: AbortSignal.timeout(ESPERA_MS),
      });
      if (!r.ok) return { tipo: 'no_verificada', causa: `LanguageTool respondió ${r.status}` };
      coincidencias = ((await r.json()) as { matches?: Coincidencia[] }).matches ?? [];
    } catch (e) {
      return { tipo: 'no_verificada', causa: e instanceof Error ? e.message : 'sin respuesta' };
    }
    for (const c of coincidencias) {
      if (IGNORADAS.has(c.rule.id)) continue;
      const fragmento = texto.slice(c.offset, c.offset + c.length);
      // Una sigla en mayúsculas (ARIA, ICP) es un nombre propio de la marca, no una errata.
      if (/^[A-ZÁÉÍÓÚÑ0-9]{2,}$/.test(fragmento)) continue;
      const correccion = c.replacements[0]?.value;
      hallazgos.push({
        codigo_de_regla: 'MARCA-ORT-01',
        evidencia: correccion ? `«${fragmento}» → corregir a «${correccion}». ${c.message}` : `«${fragmento}»: ${c.message}`,
        ubicacion,
        confianza: 1,
        sugerencia: correccion ? `Reemplazar «${fragmento}» por «${correccion}».` : c.message,
        origen: 'deterministica',
      });
    }
  }
  return { tipo: 'verificada', hallazgos };
}
