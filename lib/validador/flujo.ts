// El flujo completo de un análisis:
//
//   ingreso → capa determinística → motor (Claude) → revisión de dudosos → riesgo → registro
//
// Una pieza es un post de Instagram —una imagen o un carrusel de hasta `MAXIMO_DE_IMAGENES`— o una
// secuencia de historias consecutivas, con su copy. Las imágenes se verifican una por una en la capa
// determinística, pero van TODAS juntas en una sola llamada al motor: el carrusel se lee entero, como lo
// ve quien lo desliza, y un mensaje que se arma entre varias imágenes también se detecta.
//
// Mide `duracion_ms` de punta a punta (KPI K4). Un análisis que falla en el motor NO se guarda: un
// análisis a medias, sin la mitad de sus hallazgos, se leería en el historial como una pieza más limpia
// de lo que es.
//
// ── PUNTO DE EXTENSIÓN: VIDEO (fuera de alcance de la maqueta) ──────────────
//
// `tipo_de_pieza` ya admite `video` y `formato_destino` admite `reel` en la base, y la columna `guion` de
// `validador.analisis` sigue ahí. Cuando llegue el servicio en contenedor con FFmpeg y Whisper, una pieza de
// video entra por `analizarPieza` con su archivo, y ANTES de la capa determinística se agrega un paso
// `prepararVideo()` que devuelve: los metadatos (duración, dimensiones, peso → reglas FMT de video), unos
// fotogramas clave (→ `PiezaParaElModelo.imagenes`) y la transcripción (→ `guion`, con marcas de tiempo en
// `ubicacion`). El resto del flujo no cambia.

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { CodigoRechazo } from '../autorizacion/respuesta.ts';
import { base } from './base.ts';
import { aplica, marcaDeLaOrganizacion, reglasDeLaVersion, versionVigente, type FormaDeLaPieza } from './corpus.ts';
import { costoEnDolares, sumarUso } from './costos.ts';
import { dimensionesDe, verificarCarrusel, verificarCopy, verificarImagen, type Dimensiones } from './deterministicas.ts';
import type { FormatoDestino, TipoDePieza } from './esquema.ts';
import { MAXIMO_DE_IMAGENES, type HallazgoPropuesto } from './hallazgos.ts';
import { verificarOrtografia } from './lenguaje.ts';
import { llaveDeClaude } from './llave.ts';
import { ESFUERZO_DEL_VALIDADOR, MODELO_DE_REVISION_DEL_VALIDADOR, MODELO_DEL_VALIDADOR } from './modelos.ts';
import {
  analizarConClaude,
  PESO_MAXIMO_PARA_EL_MODELO,
  TIPOS_DE_IMAGEN,
  type CodigoDeFallo,
  type ImagenParaElModelo,
  type PiezaParaElModelo,
  type TipoDeImagen,
} from './motor.ts';
import { revisarDudosos } from './revision.ts';
import { nivelDeRiesgo } from './riesgo.ts';

/** Dónde se publica: un post del feed (una imagen o un carrusel) o historias consecutivas. */
export const FORMATOS: readonly FormatoDestino[] = ['feed', 'historia'];
export const LARGO_MAXIMO_DE_TEXTO = 20_000;

/**
 * Cuánto pueden pesar, sumadas, las imágenes que viajan al motor en una llamada. La API acepta peticiones
 * de hasta 32 MB y el base64 agranda un tercio: 22 MB de imágenes dejan margen para el resto del mensaje.
 */
export const PESO_MAXIMO_DEL_CARRUSEL_PARA_EL_MODELO = 22 * 1024 * 1024;

/** Donde viven las piezas subidas (ignorado por git). La tabla guarda la ruta relativa. */
export const ALMACEN = resolve(process.cwd(), 'almacen');

const EXTENSIONES: Readonly<Record<TipoDeImagen, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const ADVERTENCIA_SIN_ORTOGRAFIA = 'Ortografía no verificada: el servicio de LanguageTool no respondió.';

export interface ArchivoDeLaPieza {
  nombre: string;
  tipo: string;
  bytes: Uint8Array;
}

export interface EntradaDelAnalisis {
  organizacionId: string;
  /** En el orden en que se publican. Vacío para una pieza sólo de texto. */
  archivos: readonly ArchivoDeLaPieza[];
  copy: string | null;
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

function megas(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export async function analizarPieza(entrada: EntradaDelAnalisis): Promise<ResultadoDelFlujo> {
  const inicio = performance.now();
  const copy = limpio(entrada.copy);
  const archivos = entrada.archivos;
  const total = archivos.length;

  // ── Ingreso ─────────────────────────────────────────────────────────────
  if (total === 0 && !copy) {
    return { tipo: 'rechazo', codigo: 'peticion_invalida', detalle: 'La pieza necesita al menos una imagen o un copy.' };
  }
  if (!FORMATOS.includes(entrada.formato)) {
    return { tipo: 'rechazo', codigo: 'peticion_invalida', detalle: 'El formato destino debe ser un post o historias.' };
  }
  if (total > MAXIMO_DE_IMAGENES) {
    return {
      tipo: 'rechazo',
      codigo: 'peticion_invalida',
      detalle: `Una pieza admite hasta ${MAXIMO_DE_IMAGENES} imágenes, el máximo de un carrusel de Instagram. Llegaron ${total}.`,
    };
  }
  if ((copy?.length ?? 0) > LARGO_MAXIMO_DE_TEXTO) {
    return { tipo: 'rechazo', codigo: 'cuerpo_demasiado_grande', detalle: `El copy admite hasta ${LARGO_MAXIMO_DE_TEXTO} caracteres.` };
  }
  const dimensiones: Dimensiones[] = [];
  for (const [i, archivo] of archivos.entries()) {
    const cual = total > 1 ? `La imagen ${i + 1} (${archivo.nombre})` : 'La imagen';
    if (!(TIPOS_DE_IMAGEN as readonly string[]).includes(archivo.tipo)) {
      return { tipo: 'rechazo', codigo: 'peticion_invalida', detalle: `${cual} debe ser JPG, PNG, WEBP o GIF.` };
    }
    const d = dimensionesDe(archivo.bytes);
    if (!d) return { tipo: 'rechazo', codigo: 'peticion_invalida', detalle: `No se pudo leer ${cual.toLowerCase()}: está dañada o no es una imagen.` };
    dimensiones.push(d);
  }

  // Lo que viaja al motor: cada imagen hasta 5 MB, y todas juntas dentro del tope de una petición.
  const paraElModelo = archivos.filter((a) => a.bytes.byteLength <= PESO_MAXIMO_PARA_EL_MODELO);
  const pesoParaElModelo = paraElModelo.reduce((s, a) => s + a.bytes.byteLength, 0);
  if (pesoParaElModelo > PESO_MAXIMO_DEL_CARRUSEL_PARA_EL_MODELO) {
    return {
      tipo: 'rechazo',
      codigo: 'cuerpo_demasiado_grande',
      detalle: `Las imágenes suman ${megas(pesoParaElModelo)} y Claude acepta unos ${megas(PESO_MAXIMO_DEL_CARRUSEL_PARA_EL_MODELO)} por análisis. Comprímelas (JPG) y vuelve a intentar.`,
    };
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
  const forma: FormaDeLaPieza = { conImagen: total > 0, conCopy: copy !== null, formato: entrada.formato };
  const advertencias: string[] = [];

  // ── Capa determinística ─────────────────────────────────────────────────
  const propuestos: HallazgoPropuesto[] = [];
  archivos.forEach((archivo, i) => propuestos.push(...verificarImagen(dimensiones[i]!, archivo.bytes.byteLength, entrada.formato, i + 1, total)));
  propuestos.push(...verificarCarrusel(dimensiones, entrada.formato));
  if (copy) propuestos.push(...verificarCopy(copy));
  const ortografia = await verificarOrtografia(copy ? [{ texto: copy, ubicacion: 'copy' }] : []);
  if (ortografia.tipo === 'verificada') propuestos.push(...ortografia.hallazgos);
  else if (copy) advertencias.push(ADVERTENCIA_SIN_ORTOGRAFIA);

  // ── Motor ───────────────────────────────────────────────────────────────
  // Las reglas `modelo`, y la de ortografía: el copy lo revisa LanguageTool, pero el texto DENTRO de las
  // imágenes sólo lo puede leer el modelo.
  const reglasDelModelo = reglas.filter((r) => r.tipo_de_verificacion === 'modelo' || r.codigo === 'MARCA-ORT-01');
  const noAplican = reglasDelModelo.filter((r) => !aplica(r, forma) || (r.codigo === 'MARCA-ORT-01' && total === 0)).map((r) => r.codigo);
  const imagenes: ImagenParaElModelo[] = [];
  archivos.forEach((archivo, i) => {
    if (archivo.bytes.byteLength <= PESO_MAXIMO_PARA_EL_MODELO) {
      imagenes.push({ orden: i + 1, base64: Buffer.from(archivo.bytes).toString('base64'), tipo: archivo.tipo as TipoDeImagen });
    } else {
      advertencias.push(`${total > 1 ? `La imagen ${i + 1}` : 'La imagen'} supera los 5 MB que acepta Claude por imagen: se verificó su formato, pero no su contenido.`);
    }
  });
  const pieza: PiezaParaElModelo = { imagenes, totalDeImagenes: total, copy, formato: entrada.formato };

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
  const tipoDePieza: TipoDePieza = total === 0 ? 'texto' : total > 1 && entrada.formato === 'feed' ? 'carrusel' : 'imagen';

  const id = randomUUID();
  const rutas: (string | null)[] = [];
  if (total > 0) {
    try {
      await mkdir(join(ALMACEN, entrada.organizacionId), { recursive: true });
      for (const [i, archivo] of archivos.entries()) {
        const relativa = `${entrada.organizacionId}/${id}-${i + 1}.${EXTENSIONES[archivo.tipo as TipoDeImagen]}`;
        await writeFile(join(ALMACEN, relativa), archivo.bytes);
        rutas.push(relativa);
      }
    } catch {
      advertencias.push('No se pudieron guardar las imágenes en el almacén: el análisis queda sin vista previa.');
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
        copy,
        guion: null,
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
    if (total > 0) {
      await trx
        .insertInto('validador.imagenes_del_analisis')
        .values(
          archivos.map((archivo, i) => ({
            analisis_id: id,
            orden: i + 1,
            nombre_del_archivo: archivo.nombre,
            ruta_del_archivo: rutas[i] ?? null,
            ancho: dimensiones[i]!.ancho,
            alto: dimensiones[i]!.alto,
            peso_en_bytes: archivo.bytes.byteLength,
          })),
        )
        .execute();
    }
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
            imagen: h.imagen,
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
