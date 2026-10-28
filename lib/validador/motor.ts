// El motor de análisis con Claude (sección 5.4).
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA LLAMADA
//
// `fetch` a la API de Messages, sin SDK, como `lib/agentes/` de ARIA. Las instrucciones de sistema van en
// DOS bloques: el rol, y las reglas `modelo` de la versión en JSON. El segundo lleva `cache_control`: el
// corpus se repite idéntico en cada pieza, y desde la segunda se lee de la caché a 0,05 × la entrada.
//
// Para que la caché acierte, el prefijo tiene que ser IDÉNTICO entre piezas —herramienta, rol y
// reglas—. Por eso el bloque lleva TODAS las reglas `modelo` de la versión y no sólo las que aplican a
// esta pieza: lo que cambia de una pieza a otra (qué no aplica) va en el mensaje, después del prefijo.
//
// ── LA SALIDA ESTRUCTURADA ──────────────────────────────────────────────────
//
// Con la herramienta `registrar_hallazgos` y `strict: true`, que garantiza argumentos válidos contra el
// esquema. Las instrucciones pedían forzarla con `tool_choice: { type: 'tool' }`, pero Sonnet 5.5 y
// Opus 5.5 RECHAZAN la herramienta forzada con un 400; va `auto` con la instrucción explícita, y si el
// modelo no la llama se reintenta una vez (ver `CAMBIOS-RESPECTO-A-ARIA.md`).
//
// ── LA TRAZABILIDAD (KPI K3) ────────────────────────────────────────────────
//
// Todo hallazgo cuyo código no esté entre las reglas enviadas, o sin evidencia, se DESCARTA y se cuenta.
// ═══════════════════════════════════════════════════════════════════════════════

import { BETA_DEL_RESPALDO, CON_RESPALDO_ANTE_RECHAZO, DIRECCION_DE_LA_API, VERSION_DE_LA_API } from './proveedor.ts';
import { USO_EN_CERO, sumarUso, type Uso } from './costos.ts';
import type { Regla } from './corpus.ts';
import type { FormatoDestino } from './esquema.ts';
import { UBICACIONES, type HallazgoPropuesto } from './hallazgos.ts';

const MAX_TOKENS = 16_000;
const ESPERA_MS = 120_000;
const PAUSA_ANTES_DE_REINTENTAR_MS = 3_000;

/** Los tipos de imagen que acepta la API, y su tope por imagen en base64. */
export const TIPOS_DE_IMAGEN = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export type TipoDeImagen = (typeof TIPOS_DE_IMAGEN)[number];
export const PESO_MAXIMO_PARA_EL_MODELO = 5 * 1024 * 1024;

/** Una imagen de la pieza, con su lugar en el carrusel o en la secuencia de historias (desde 1). */
export interface ImagenParaElModelo {
  orden: number;
  base64: string;
  tipo: TipoDeImagen;
}

export interface PiezaParaElModelo {
  /** Todas van en la MISMA llamada: el carrusel se lee entero, como lo ve quien lo desliza. */
  imagenes: readonly ImagenParaElModelo[];
  /** Cuántas tiene la pieza; puede ser más que `imagenes` si alguna no se pudo enviar por su peso. */
  totalDeImagenes: number;
  copy: string | null;
  formato: FormatoDestino;
}

export type ResultadoDelMotor =
  | { tipo: 'datos'; hallazgos: HallazgoPropuesto[]; descartados: number; uso: Uso; modelo: string }
  | { tipo: 'fallo'; codigo: CodigoDeFallo; detalle: string; uso: Uso };

export type CodigoDeFallo = 'IA-LLAVE' | 'IA-SATURADO' | 'IA-CONEXION' | 'IA-RECHAZADO' | 'IA-DECLINO' | 'IA-TRUNCADO' | 'IA-SIN_ESTRUCTURA';

const ROL = [
  'Eres el revisor de conformidad de contenido publicitario de la marca ARIA, una aceleradora de negocios high ticket.',
  'Evalúas cada pieza —un post de Instagram con una o varias imágenes (carrusel), o una secuencia de historias consecutivas, y su copy— en dos ejes: el criterio de marca de ARIA y las políticas publicitarias de Meta.',
  '',
  'Reglas de tu trabajo:',
  '- Sólo reportas un hallazgo si incumple una regla del corpus que recibes, y citas su código exacto en `codigo_de_regla`. Nunca inventes códigos ni reportes problemas que no estén en el corpus.',
  '- La evidencia es literal: el fragmento exacto del copy entre comillas, o una descripción precisa de lo que se ve en la imagen o del texto que aparece en ella.',
  '- `ubicacion` es una de: copy, imagen, texto_en_imagen.',
  '- `imagen` es el número de la imagen donde está el hallazgo (1 = la primera del carrusel o de la secuencia), según el rótulo «Imagen N de M» que la precede. Usa 0 si el hallazgo es del copy o de la pieza entera. Si el mismo problema se repite en varias imágenes, un hallazgo por imagen.',
  '- Lee el carrusel o la secuencia como un todo: también es un hallazgo un mensaje que se arma entre varias imágenes.',
  '- `confianza` va de 0 a 1: qué tan seguro estás de que la pieza incumple la regla. Usa menos de 0,6 cuando sea discutible.',
  '- La sugerencia dice cómo corregirlo, en una frase.',
  '- Un mismo fragmento puede incumplir varias reglas: un hallazgo por regla.',
  '- La ortografía del copy ya la revisa otra herramienta: de `MARCA-ORT-01` sólo reportas errores del texto que aparece dentro de las imágenes.',
  '- Si la pieza cumple todo, registras una lista vacía. No busques hallazgos donde no los hay.',
  '',
  'Respondes SIEMPRE llamando una sola vez a la herramienta `registrar_hallazgos`, en español.',
].join('\n');

const HERRAMIENTA = {
  name: 'registrar_hallazgos',
  description: 'Registra los hallazgos de conformidad de la pieza analizada. Una lista vacía si la pieza cumple todas las reglas.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['hallazgos'],
    properties: {
      hallazgos: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['codigo_de_regla', 'eje', 'severidad', 'evidencia', 'ubicacion', 'imagen', 'confianza', 'sugerencia'],
          properties: {
            codigo_de_regla: { type: 'string', description: 'El código exacto de la regla del corpus, p. ej. META-PUB-01.' },
            eje: { type: 'string', enum: ['marca', 'plataforma'] },
            severidad: { type: 'string', enum: ['alta', 'media', 'baja'] },
            evidencia: { type: 'string', description: 'Fragmento literal o descripción precisa de lo visto en la imagen.' },
            ubicacion: { type: 'string', enum: ['copy', 'imagen', 'texto_en_imagen'] },
            imagen: { type: 'integer', description: 'Número de la imagen (1 = la primera); 0 si es del copy o de la pieza entera.' },
            confianza: { type: 'number', description: 'De 0 a 1.' },
            sugerencia: { type: 'string', description: 'Cómo corregirlo.' },
          },
        },
      },
    },
  },
} as const;

/** El bloque de reglas, en JSON y en orden estable: cualquier byte distinto invalida la caché. */
function bloqueDeReglas(reglas: readonly Regla[]): string {
  const corpus = [...reglas]
    .sort((a, b) => a.codigo.localeCompare(b.codigo))
    .map((r) => ({
      codigo: r.codigo,
      eje: r.eje,
      categoria: r.categoria,
      descripcion: r.descripcion,
      criterio_verificable: r.criterio_verificable,
      ejemplo_cumple: r.ejemplo_cumple,
      ejemplo_incumple: r.ejemplo_incumple,
      severidad: r.severidad,
    }));
  return `Corpus de reglas vigente (JSON):\n${JSON.stringify(corpus, null, 2)}`;
}

function textoDeLaPieza(pieza: PiezaParaElModelo, noAplican: readonly string[], instruccion: string | null): string {
  const donde = pieza.formato === 'historia' ? 'historias consecutivas' : 'post del feed';
  const partes = [`Formato destino: ${donde}.`];
  if (pieza.totalDeImagenes === 0) partes.push('Imágenes: la pieza no tiene imágenes.');
  else if (pieza.totalDeImagenes === 1) partes.push('Imágenes: una, adjunta arriba.');
  else partes.push(`Imágenes: ${pieza.totalDeImagenes}, adjuntas arriba en el orden en que se publican (${pieza.formato === 'historia' ? 'una historia tras otra' : 'carrusel'}).`);
  const faltan = pieza.totalDeImagenes - pieza.imagenes.length;
  if (faltan > 0) partes.push(`${faltan} imagen(es) no se adjuntaron por su peso: no las evalúes.`);
  partes.push(pieza.copy ? `Copy de la publicación:\n"""\n${pieza.copy}\n"""` : 'Copy: la pieza no tiene copy.');
  if (noAplican.length > 0) partes.push(`Reglas que NO aplican a esta pieza (no las reportes): ${noAplican.join(', ')}.`);
  if (instruccion) partes.push(instruccion);
  partes.push('Analiza la pieza contra el corpus y llama a `registrar_hallazgos`.');
  return partes.join('\n\n');
}

interface RespuestaDeLaApi {
  model?: string;
  stop_reason?: string;
  content?: { type: string; name?: string; input?: unknown }[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  error?: { type?: string; message?: string };
}

function usoDe(r: RespuestaDeLaApi): Uso {
  return {
    entrada: r.usage?.input_tokens ?? 0,
    salida: r.usage?.output_tokens ?? 0,
    escrituraDeCache: r.usage?.cache_creation_input_tokens ?? 0,
    lecturaDeCache: r.usage?.cache_read_input_tokens ?? 0,
  };
}

type Intento = { tipo: 'respuesta'; cuerpo: RespuestaDeLaApi } | { tipo: 'fallo'; codigo: CodigoDeFallo; detalle: string };

async function pedirUnaVez(llave: string, cuerpo: unknown): Promise<Intento> {
  let r: Response;
  try {
    r = await fetch(DIRECCION_DE_LA_API, {
      method: 'POST',
      headers: {
        'x-api-key': llave,
        'anthropic-version': VERSION_DE_LA_API,
        'content-type': 'application/json',
        ...(CON_RESPALDO_ANTE_RECHAZO ? { 'anthropic-beta': BETA_DEL_RESPALDO } : {}),
      },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(ESPERA_MS),
    });
  } catch (e) {
    return { tipo: 'fallo', codigo: 'IA-CONEXION', detalle: e instanceof Error ? e.message : 'sin respuesta' };
  }
  let leido: RespuestaDeLaApi;
  try {
    leido = (await r.json()) as RespuestaDeLaApi;
  } catch {
    return { tipo: 'fallo', codigo: r.ok ? 'IA-SIN_ESTRUCTURA' : 'IA-CONEXION', detalle: `la API respondió ${r.status} sin JSON` };
  }
  if (r.ok) return { tipo: 'respuesta', cuerpo: leido };
  const mensaje = leido.error?.message ?? `la API respondió ${r.status}`;
  if (r.status === 401 || r.status === 403) return { tipo: 'fallo', codigo: 'IA-LLAVE', detalle: mensaje };
  if (r.status === 429 || r.status === 529 || r.status >= 500) return { tipo: 'fallo', codigo: 'IA-SATURADO', detalle: mensaje };
  return { tipo: 'fallo', codigo: 'IA-RECHAZADO', detalle: mensaje };
}

/**
 * Una petición con UN reintento ante una falla pasajera (saturación o conexión), después de una pausa,
 * como `llamarAlModelo` de ARIA. Una llave rechazada o una petición inválida no se reintentan.
 */
async function pedirConReintento(llave: string, cuerpo: unknown): Promise<Intento> {
  const primero = await pedirUnaVez(llave, cuerpo);
  if (primero.tipo === 'respuesta' || (primero.codigo !== 'IA-SATURADO' && primero.codigo !== 'IA-CONEXION')) return primero;
  await new Promise((r) => setTimeout(r, PAUSA_ANTES_DE_REINTENTAR_MS));
  return pedirUnaVez(llave, cuerpo);
}

function numero(x: unknown): number {
  const n = typeof x === 'number' ? x : Number(x);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

/**
 * Analiza una pieza contra `reglas` (las `modelo` de la versión). `noAplican` son los códigos de esas
 * reglas que no aplican a esta pieza; `instruccion`, un texto extra para la revisión.
 */
export async function analizarConClaude(opciones: {
  llave: string;
  modelo: string;
  esfuerzo: string;
  reglas: readonly Regla[];
  noAplican: readonly string[];
  pieza: PiezaParaElModelo;
  instruccion?: string;
}): Promise<ResultadoDelMotor> {
  const { llave, modelo, esfuerzo, reglas, noAplican, pieza } = opciones;
  const contenido: unknown[] = [];
  for (const imagen of pieza.imagenes) {
    // El rótulo antes de cada imagen es lo que le permite al modelo decir en cuál está cada hallazgo.
    contenido.push({ type: 'text', text: `Imagen ${imagen.orden} de ${pieza.totalDeImagenes}:` });
    contenido.push({ type: 'image', source: { type: 'base64', media_type: imagen.tipo, data: imagen.base64 } });
  }
  contenido.push({ type: 'text', text: textoDeLaPieza(pieza, noAplican, opciones.instruccion ?? null) });

  const cuerpo = {
    model: modelo,
    max_tokens: MAX_TOKENS,
    output_config: { effort: esfuerzo },
    system: [
      { type: 'text', text: ROL },
      { type: 'text', text: bloqueDeReglas(reglas), cache_control: { type: 'ephemeral' } },
    ],
    tools: [HERRAMIENTA],
    tool_choice: { type: 'auto', disable_parallel_tool_use: true },
    messages: [{ role: 'user', content: contenido }],
    ...(CON_RESPALDO_ANTE_RECHAZO ? { fallbacks: 'default' } : {}),
  };

  let uso = USO_EN_CERO;
  // Dos vueltas como máximo: la segunda sólo si el modelo respondió sin llamar a la herramienta.
  for (let vuelta = 0; vuelta < 2; vuelta += 1) {
    const intento = await pedirConReintento(llave, cuerpo);
    if (intento.tipo === 'fallo') return { tipo: 'fallo', codigo: intento.codigo, detalle: intento.detalle, uso };
    const r = intento.cuerpo;
    uso = sumarUso(uso, usoDe(r));

    if (r.stop_reason === 'refusal') return { tipo: 'fallo', codigo: 'IA-DECLINO', detalle: 'El modelo declinó analizar la pieza.', uso };
    if (r.stop_reason === 'max_tokens') return { tipo: 'fallo', codigo: 'IA-TRUNCADO', detalle: 'La respuesta del modelo se cortó.', uso };

    const llamada = r.content?.find((b) => b.type === 'tool_use' && b.name === HERRAMIENTA.name);
    if (!llamada) continue;

    const crudos = (llamada.input as { hallazgos?: unknown } | undefined)?.hallazgos;
    const lista = Array.isArray(crudos) ? (crudos as Record<string, unknown>[]) : [];
    const validos = new Set(reglas.filter((x) => !noAplican.includes(x.codigo)).map((x) => x.codigo));
    const enviadas = new Set(pieza.imagenes.map((i) => i.orden));
    const hallazgos: HallazgoPropuesto[] = [];
    let descartados = 0;
    for (const h of lista) {
      const codigo = typeof h.codigo_de_regla === 'string' ? h.codigo_de_regla.trim() : '';
      const evidencia = typeof h.evidencia === 'string' ? h.evidencia.trim() : '';
      if (!validos.has(codigo) || evidencia === '') {
        descartados += 1;
        continue;
      }
      const ubicacion = typeof h.ubicacion === 'string' && (UBICACIONES as readonly string[]).includes(h.ubicacion) ? h.ubicacion : 'imagen';
      // Sólo un número de imagen que de verdad se envió; 0 o uno fuera de rango es «la pieza entera».
      const imagen = ubicacion !== 'copy' && typeof h.imagen === 'number' && enviadas.has(h.imagen) ? h.imagen : null;
      hallazgos.push({
        codigo_de_regla: codigo,
        evidencia,
        ubicacion,
        imagen,
        confianza: numero(h.confianza),
        sugerencia: typeof h.sugerencia === 'string' && h.sugerencia.trim() !== '' ? h.sugerencia.trim() : null,
        origen: 'modelo',
      });
    }
    return { tipo: 'datos', hallazgos, descartados, uso, modelo: r.model ?? modelo };
  }
  return { tipo: 'fallo', codigo: 'IA-SIN_ESTRUCTURA', detalle: 'El modelo respondió sin registrar hallazgos.', uso };
}
