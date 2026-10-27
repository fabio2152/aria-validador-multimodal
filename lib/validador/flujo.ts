// El flujo completo de un análisis:
//
//   ingreso → capa determinística → motor (Claude) → revisión de dudosos → riesgo → registro
//
// Mide `duracion_ms` de punta a punta (KPI K4). Un análisis que falla en el motor NO se guarda: un
// análisis a medias, sin la mitad de sus hallazgos, se leería en el historial como una pieza más limpia
// de lo que es.
//
// ── PUNTO DE EXTENSIÓN: VIDEO (fuera de alcance de la maqueta) ──────────────
//
// `tipo_de_pieza` ya admite `video` en la base. Cuando llegue el servicio en contenedor con FFmpeg y
// Whisper, una pieza de video entra por `analizarPieza` con su archivo, y ANTES de la capa determinística
// se agrega un paso `prepararVideo()` que devuelve: los metadatos (duración, dimensiones, peso → reglas
// FMT de video), unos fotogramas clave (→ `PiezaParaElModelo.imagen`, uno o varios bloques `image`) y la
// transcripción (→ `guion`, con marcas de tiempo en `ubicacion`). El resto del flujo no cambia. Hasta
// entonces, el mensaje hablado de un reel se analiza pegando su transcripción en el campo de guion.

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { CodigoRechazo } from '../autorizacion/respuesta.ts';
import { base } from './base.ts';
import { aplica, marcaDeLaOrganizacion, reglasDeLaVersion, versionVigente, type FormaDeLaPieza } from './corpus.ts';
import { costoEnDolares, sumarUso } from './costos.ts';
import { dimensionesDe, verificarCopy, verificarImagen, type Dimensiones } from './deterministicas.ts';
import type { FormatoDestino, TipoDePieza } from './esquema.ts';
import type { HallazgoPropuesto } from './hallazgos.ts';
import { verificarOrtografia } from './lenguaje.ts';
import { llaveDeClaude } from './llave.ts';
import { ESFUERZO_DEL_VALIDADOR, MODELO_DE_REVISION_DEL_VALIDADOR, MODELO_DEL_VALIDADOR } from './modelos.ts';
import { analizarConClaude, PESO_MAXIMO_PARA_EL_MODELO, TIPOS_DE_IMAGEN, type CodigoDeFallo, type PiezaParaElModelo, type TipoDeImagen } from './motor.ts';
import { revisarDudosos } from './revision.ts';
import { nivelDeRiesgo } from './riesgo.ts';

export const FORMATOS: readonly FormatoDestino[] = ['feed', 'historia', 'reel'];
export const LARGO_MAXIMO_DE_TEXTO = 20_000;

/** Donde viven las piezas subidas (ignorado por git). La tabla guarda la ruta relativa. */
export const ALMACEN = resolve(process.cwd(), 'almacen');

const EXTENSIONES: Readonly<Record<TipoDeImagen, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const ADVERTENCIA_SIN_ORTOGRAFIA = 'Ortografía no verificada: el servicio de LanguageTool no respondió.';

export interface EntradaDelAnalisis {
  organizacionId: string;
  archivo: { nombre: string; tipo: string; bytes: Uint8Array } | null;
  copy: string | null;
  guion: string | null;
  formato: FormatoDestino;
}

export type ResultadoDelFlujo = { tipo: 'datos'; id: string } | { tipo: 'rechazo'; codigo: CodigoRechazo; detalle: string };

const RECHAZO_POR_FALLO: Readonly<Record<CodigoDeFallo, CodigoRechazo>> = {
  'IA-LLAVE': 'llave_de_ia_rechazada',
  'IA-SATURADO': 'servicio_externo_saturado',
  'IA-CONEXION': 'modelo_no_disponible',
  'IA-RECHAZADO': 'modelo_no_disponible',
  'IA-DECLINO': 'modelo_no_disponible',
  'IA-TRUNCADO': 'modelo_no_disponible',
  'IA-SIN_ESTRUCTURA': 'modelo_no_disponible',
};

const TEXTO_POR_FALLO: Readonly<Record<CodigoDeFallo, string>> = {
  'IA-LLAVE': 'Claude rechazó la llave de ANTHROPIC_API_KEY. Revísala en .env.local y reinicia el servidor.',
  'IA-SATURADO': 'Claude está saturado en este momento. Vuelve a intentar en unos segundos.',
  'IA-CONEXION': 'No se pudo conectar con Claude.',
  'IA-RECHAZADO': 'Claude rechazó la petición.',
  'IA-DECLINO': 'Claude declinó analizar esta pieza.',
  'IA-TRUNCADO': 'La respuesta de Claude se cortó antes de terminar.',
  'IA-SIN_ESTRUCTURA': 'Claude respondió sin registrar los hallazgos.',
};

function limpio(texto: string | null): string | null {
  const t = texto?.trim() ?? '';
  return t === '' ? null : t;
}

export async function analizarPieza(entrada: EntradaDelAnalisis): Promise<ResultadoDelFlujo> {
  const inicio = performance.now();
  const copy = limpio(entrada.copy);
  const guion = limpio(entrada.guion);
  const archivo = entrada.archivo;

  // ── Ingreso ─────────────────────────────────────────────────────────────
  if (!archivo && !copy && !guion) {
    return { tipo: 'rechazo', codigo: 'peticion_invalida', detalle: 'La pieza necesita al menos una imagen, un copy o un guion.' };
  }
  if (!FORMATOS.includes(entrada.formato)) {
    return { tipo: 'rechazo', codigo: 'peticion_invalida', detalle: 'El formato destino debe ser feed, historia o reel.' };
  }
  if ((copy?.length ?? 0) > LARGO_MAXIMO_DE_TEXTO || (guion?.length ?? 0) > LARGO_MAXIMO_DE_TEXTO) {
    return { tipo: 'rechazo', codigo: 'cuerpo_demasiado_grande', detalle: `El copy y el guion admiten hasta ${LARGO_MAXIMO_DE_TEXTO} caracteres.` };
  }
  let dimensiones: Dimensiones | null = null;
  if (archivo) {
    if (!(TIPOS_DE_IMAGEN as readonly string[]).includes(archivo.tipo)) {
      return { tipo: 'rechazo', codigo: 'peticion_invalida', detalle: 'La imagen debe ser JPG, PNG, WEBP o GIF. El video llega en una fase posterior.' };
    }
    dimensiones = dimensionesDe(archivo.bytes);
    if (!dimensiones) return { tipo: 'rechazo', codigo: 'peticion_invalida', detalle: 'No se pudo leer la imagen: el archivo está dañado o no es una imagen.' };
  }

  const llave = llaveDeClaude(entrada.organizacionId);
  if (!llave) {
    return {
      tipo: 'rechazo',
      codigo: 'sin_llave_de_ia',
      detalle: 'Falta la llave de Claude: pega tu ANTHROPIC_API_KEY en .env.local y reinicia el servidor (npm run dev).',
    };
  }

  const db = base();
  const marcaId = await marcaDeLaOrganizacion(db, entrada.organizacionId);
  const version = marcaId ? await versionVigente(db, marcaId) : null;
  if (!marcaId || !version) {
    return { tipo: 'rechazo', codigo: 'no_encontrado', detalle: 'La organización no tiene marca ni corpus. Corre npm run db:reset.' };
  }
  const reglas = await reglasDeLaVersion(db, version.id);
  const forma: FormaDeLaPieza = { conImagen: archivo !== null, conCopy: copy !== null, conGuion: guion !== null, formato: entrada.formato };
  const advertencias: string[] = [];

  // ── Capa determinística ─────────────────────────────────────────────────
  const propuestos: HallazgoPropuesto[] = [];
  if (archivo && dimensiones) propuestos.push(...verificarImagen(dimensiones, archivo.bytes.byteLength, entrada.formato));
  if (copy) propuestos.push(...verificarCopy(copy));
  const ortografia = await verificarOrtografia([
    ...(copy ? [{ texto: copy, ubicacion: 'copy' as const }] : []),
    ...(guion ? [{ texto: guion, ubicacion: 'guion' as const }] : []),
  ]);
  if (ortografia.tipo === 'verificada') propuestos.push(...ortografia.hallazgos);
  else if (copy || guion) advertencias.push(ADVERTENCIA_SIN_ORTOGRAFIA);

  // ── Motor ───────────────────────────────────────────────────────────────
  const reglasDelModelo = reglas.filter((r) => r.tipo_de_verificacion === 'modelo');
  const noAplican = reglasDelModelo.filter((r) => !aplica(r, forma)).map((r) => r.codigo);
  let imagenParaElModelo: PiezaParaElModelo['imagen'] = null;
  if (archivo) {
    if (archivo.bytes.byteLength <= PESO_MAXIMO_PARA_EL_MODELO) {
      imagenParaElModelo = { base64: Buffer.from(archivo.bytes).toString('base64'), tipo: archivo.tipo as TipoDeImagen };
    } else {
      advertencias.push('La imagen supera los 5 MB que acepta Claude: se analizaron el copy y el guion, no la imagen.');
    }
  }
  const pieza: PiezaParaElModelo = { imagen: imagenParaElModelo, copy, guion, formato: entrada.formato };

  const motor = await analizarConClaude({ llave, modelo: MODELO_DEL_VALIDADOR, esfuerzo: ESFUERZO_DEL_VALIDADOR, reglas: reglasDelModelo, noAplican, pieza });
  if (motor.tipo === 'fallo') {
    return { tipo: 'rechazo', codigo: RECHAZO_POR_FALLO[motor.codigo], detalle: `${TEXTO_POR_FALLO[motor.codigo]} (${motor.detalle})` };
  }
  let costo = costoEnDolares(motor.modelo, MODELO_DEL_VALIDADOR, motor.uso).costo;
  let uso = motor.uso;
  const modelos = [motor.modelo];

  // ── Revisión de dudosos ─────────────────────────────────────────────────
  const revision = await revisarDudosos({ llave, hallazgos: motor.hallazgos, reglas: reglasDelModelo, pieza });
  if (revision.tipo !== 'sin_dudas') {
    uso = sumarUso(uso, revision.uso);
    const modeloDeRevision = revision.tipo === 'revisada' ? revision.modelo : MODELO_DE_REVISION_DEL_VALIDADOR;
    costo += costoEnDolares(modeloDeRevision, MODELO_DE_REVISION_DEL_VALIDADOR, revision.uso).costo;
    if (revision.tipo === 'revisada') modelos.push(modeloDeRevision);
    else advertencias.push(`La segunda revisión no respondió (${revision.causa}): los hallazgos dudosos quedan sin confirmar.`);
  }
  propuestos.push(...revision.hallazgos);

  // ── Riesgo y registro ───────────────────────────────────────────────────
  const porCodigo = new Map(reglas.map((r) => [r.codigo, r]));
  const hallazgos = propuestos.flatMap((h) => {
    const regla = porCodigo.get(h.codigo_de_regla);
    return regla ? [{ ...h, regla }] : [];
  });
  const riesgo = nivelDeRiesgo(hallazgos.map((h) => h.regla));
  const tipoDePieza: TipoDePieza = archivo ? 'imagen' : 'texto';

  const id = randomUUID();
  let ruta: string | null = null;
  if (archivo) {
    const relativa = `${entrada.organizacionId}/${id}.${EXTENSIONES[archivo.tipo as TipoDeImagen]}`;
    try {
      await mkdir(join(ALMACEN, entrada.organizacionId), { recursive: true });
      await writeFile(join(ALMACEN, relativa), archivo.bytes);
      ruta = relativa;
    } catch {
      advertencias.push('No se pudo guardar la imagen en el almacén: el análisis queda sin vista previa.');
    }
  }

  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('validador.analisis')
      .values({
        id,
        organizacion_id: entrada.organizacionId,
        marca_id: marcaId,
        version_id: version.id,
        tipo_de_pieza: tipoDePieza,
        formato_destino: entrada.formato,
        nombre_del_archivo: archivo?.nombre ?? null,
        ruta_del_archivo: ruta,
        ancho: dimensiones?.ancho ?? null,
        alto: dimensiones?.alto ?? null,
        peso_en_bytes: archivo?.bytes.byteLength ?? null,
        copy,
        guion,
        nivel_de_riesgo: riesgo,
        advertencias: JSON.stringify(advertencias),
        hallazgos_descartados: motor.descartados,
        modelo: modelos.join(' + '),
        tokens_de_entrada: uso.entrada,
        tokens_de_salida: uso.salida,
        tokens_de_cache: uso.escrituraDeCache + uso.lecturaDeCache,
        costo_usd: costo.toFixed(6),
        duracion_ms: Math.round(performance.now() - inicio),
      })
      .execute();
    if (hallazgos.length > 0) {
      await trx
        .insertInto('validador.hallazgos')
        .values(
          hallazgos.map((h) => ({
            analisis_id: id,
            regla_id: h.regla.id,
            codigo_de_regla: h.codigo_de_regla,
            eje: h.regla.eje,
            // La severidad es la de la REGLA, no la que proponga el modelo: es lo que hace comparable el
            // riesgo entre piezas y lo que el jefe del área fijó al escribir la regla.
            severidad: h.regla.severidad,
            evidencia: h.evidencia,
            ubicacion: h.ubicacion,
            confianza: h.confianza.toFixed(3),
            sugerencia: h.sugerencia,
            origen: h.origen,
          })),
        )
        .execute();
    }
  });
  return { tipo: 'datos', id };
}

