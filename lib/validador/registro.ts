// El registro histórico: lo que se guarda de cada análisis y lo que se lee para el historial, el detalle,
// la retroalimentación y el panel lateral.

import { sql } from 'kysely';
import type { Db } from './base.ts';
import { enSoles } from './costos.ts';
import type { Eje, NivelDeRiesgo, OrigenDelHallazgo, Severidad, Veredicto } from './esquema.ts';

export interface HallazgoDelDetalle {
  id: string;
  codigo_de_regla: string;
  eje: Eje;
  severidad: Severidad;
  evidencia: string;
  ubicacion: string;
  confianza: number;
  sugerencia: string | null;
  origen: OrigenDelHallazgo;
  regla: { categoria: string; descripcion: string; fuente: string };
  retroalimentacion: { veredicto: Veredicto; comentario: string | null; creada_en: Date } | null;
}

const ORDEN_DE_SEVERIDAD: Readonly<Record<Severidad, number>> = { alta: 0, media: 1, baja: 2 };

export async function detalleDelAnalisis(db: Db, organizacionId: string, id: string) {
  const a = await db
    .selectFrom('validador.analisis as a')
    .innerJoin('validador.versiones_del_corpus as v', 'v.id', 'a.version_id')
    .selectAll('a')
    .select(['v.numero as version_numero'])
    .select((eb) =>
      eb.selectFrom('validador.reglas as r').whereRef('r.version_id', '=', 'a.version_id').select(eb.fn.countAll<string>().as('n')).as('reglas_en_version'),
    )
    .where('a.organizacion_id', '=', organizacionId)
    .where('a.id', '=', id)
    .executeTakeFirst();
  if (!a) return null;

  const filas = await db
    .selectFrom('validador.hallazgos as h')
    .innerJoin('validador.reglas as r', 'r.id', 'h.regla_id')
    .leftJoin('validador.retroalimentacion as f', 'f.hallazgo_id', 'h.id')
    .select([
      'h.id',
      'h.codigo_de_regla',
      'h.eje',
      'h.severidad',
      'h.evidencia',
      'h.ubicacion',
      'h.confianza',
      'h.sugerencia',
      'h.origen',
      'r.categoria',
      'r.descripcion',
      'r.fuente',
      'f.veredicto',
      'f.comentario',
      'f.creada_en as veredicto_en',
    ])
    .where('h.analisis_id', '=', id)
    .execute();

  const hallazgos: HallazgoDelDetalle[] = filas
    .map((f) => ({
      id: f.id,
      codigo_de_regla: f.codigo_de_regla,
      eje: f.eje,
      severidad: f.severidad,
      evidencia: f.evidencia,
      ubicacion: f.ubicacion,
      confianza: Number(f.confianza),
      sugerencia: f.sugerencia,
      origen: f.origen,
      regla: { categoria: f.categoria, descripcion: f.descripcion, fuente: f.fuente },
      retroalimentacion: f.veredicto ? { veredicto: f.veredicto, comentario: f.comentario, creada_en: f.veredicto_en! } : null,
    }))
    .sort((x, y) => ORDEN_DE_SEVERIDAD[x.severidad] - ORDEN_DE_SEVERIDAD[y.severidad] || x.codigo_de_regla.localeCompare(y.codigo_de_regla));

  const costo = Number(a.costo_usd);
  return {
    id: a.id,
    creado_en: a.creado_en,
    tipo_de_pieza: a.tipo_de_pieza,
    formato_destino: a.formato_destino,
    nombre_del_archivo: a.nombre_del_archivo,
    tiene_archivo: a.ruta_del_archivo !== null,
    ancho: a.ancho,
    alto: a.alto,
    peso_en_bytes: a.peso_en_bytes,
    copy: a.copy,
    guion: a.guion,
    nivel_de_riesgo: a.nivel_de_riesgo,
    advertencias: a.advertencias,
    hallazgos_descartados: a.hallazgos_descartados,
    modelo: a.modelo,
    tokens: { entrada: a.tokens_de_entrada, salida: a.tokens_de_salida, cache: a.tokens_de_cache },
    costo_usd: costo,
    costo_soles: enSoles(costo),
    duracion_ms: a.duracion_ms,
    version: { id: a.version_id, numero: a.version_numero, reglas: Number(a.reglas_en_version ?? 0) },
    conteo: {
      marca: hallazgos.filter((h) => h.eje === 'marca').length,
      plataforma: hallazgos.filter((h) => h.eje === 'plataforma').length,
    },
    hallazgos,
  };
}

export type DetalleDelAnalisis = NonNullable<Awaited<ReturnType<typeof detalleDelAnalisis>>>;

/** La ruta del archivo de un análisis, para servir la vista previa. */
export async function archivoDelAnalisis(db: Db, organizacionId: string, id: string) {
  return db
    .selectFrom('validador.analisis')
    .select(['ruta_del_archivo', 'nombre_del_archivo'])
    .where('organizacion_id', '=', organizacionId)
    .where('id', '=', id)
    .executeTakeFirst();
}

export const TAMANO_DE_PAGINA = 20;

export interface FiltrosDelHistorial {
  riesgo: NivelDeRiesgo | null;
  /** Fechas `AAAA-MM-DD`, inclusivas, en la zona de la organización. */
  desde: string | null;
  hasta: string | null;
  pagina: number;
}

export const ZONA_HORARIA = 'America/Lima';

export async function historial(db: Db, organizacionId: string, filtros: FiltrosDelHistorial) {
  let consulta = db.selectFrom('validador.analisis as a').where('a.organizacion_id', '=', organizacionId);
  if (filtros.riesgo) consulta = consulta.where('a.nivel_de_riesgo', '=', filtros.riesgo);
  if (filtros.desde) consulta = consulta.where(sql<boolean>`(a.creado_en at time zone ${ZONA_HORARIA})::date >= ${filtros.desde}::date`);
  if (filtros.hasta) consulta = consulta.where(sql<boolean>`(a.creado_en at time zone ${ZONA_HORARIA})::date <= ${filtros.hasta}::date`);

  const total = await consulta.select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await consulta
    .innerJoin('validador.versiones_del_corpus as v', 'v.id', 'a.version_id')
    .select([
      'a.id',
      'a.creado_en',
      'a.tipo_de_pieza',
      'a.formato_destino',
      'a.nombre_del_archivo',
      'a.ruta_del_archivo',
      'a.copy',
      'a.nivel_de_riesgo',
      'a.duracion_ms',
      'a.costo_usd',
      'v.numero as version_numero',
    ])
    .select((eb) => [
      eb.selectFrom('validador.hallazgos as h').whereRef('h.analisis_id', '=', 'a.id').where('h.eje', '=', 'marca').select(eb.fn.countAll<string>().as('n')).as('marca'),
      eb.selectFrom('validador.hallazgos as h').whereRef('h.analisis_id', '=', 'a.id').where('h.eje', '=', 'plataforma').select(eb.fn.countAll<string>().as('n')).as('plataforma'),
      eb
        .selectFrom('validador.hallazgos as h')
        .innerJoin('validador.retroalimentacion as f', 'f.hallazgo_id', 'h.id')
        .whereRef('h.analisis_id', '=', 'a.id')
        .select(eb.fn.countAll<string>().as('n'))
        .as('con_veredicto'),
    ])
    .orderBy('a.creado_en', 'desc')
    .limit(TAMANO_DE_PAGINA)
    .offset((filtros.pagina - 1) * TAMANO_DE_PAGINA)
    .execute();

  return {
    total: Number(total.n),
    pagina: filtros.pagina,
    tamano: TAMANO_DE_PAGINA,
    analisis: filas.map(({ ruta_del_archivo, marca, plataforma, con_veredicto, costo_usd, copy, ...f }) => ({
      ...f,
      extracto: copy ? copy.slice(0, 80) : null,
      tiene_archivo: ruta_del_archivo !== null,
      costo_usd: Number(costo_usd),
      hallazgos: { marca: Number(marca ?? 0), plataforma: Number(plataforma ?? 0) },
      con_veredicto: Number(con_veredicto ?? 0),
    })),
  };
}

/** Guarda o cambia el veredicto del jefe del área sobre un hallazgo. `null` si el hallazgo no es suyo. */
export async function guardarRetroalimentacion(db: Db, organizacionId: string, hallazgoId: string, veredicto: Veredicto, comentario: string | null) {
  const hallazgo = await db
    .selectFrom('validador.hallazgos as h')
    .innerJoin('validador.analisis as a', 'a.id', 'h.analisis_id')
    .select('h.id')
    .where('h.id', '=', hallazgoId)
    .where('a.organizacion_id', '=', organizacionId)
    .executeTakeFirst();
  if (!hallazgo) return null;
  return db
    .insertInto('validador.retroalimentacion')
    .values({ hallazgo_id: hallazgoId, veredicto, comentario })
    .onConflict((oc) => oc.column('hallazgo_id').doUpdateSet({ veredicto, comentario, creada_en: sql`now()` }))
    .returning(['veredicto', 'comentario', 'creada_en'])
    .executeTakeFirstOrThrow();
}

/** Los errores recurrentes de los últimos 30 días y la primera revisión del mes en curso. */
export async function resumen(db: Db, organizacionId: string) {
  const recurrentes = await db
    .selectFrom('validador.hallazgos as h')
    .innerJoin('validador.analisis as a', 'a.id', 'h.analisis_id')
    .innerJoin('validador.reglas as r', 'r.id', 'h.regla_id')
    .select(['h.codigo_de_regla', 'h.eje', 'h.severidad'])
    .select((eb) => [eb.fn.max('r.categoria').as('categoria'), eb.fn.countAll<string>().as('veces')])
    .where('a.organizacion_id', '=', organizacionId)
    .where('a.creado_en', '>=', sql<Date>`now() - interval '30 days'`)
    .groupBy(['h.codigo_de_regla', 'h.eje', 'h.severidad'])
    .orderBy('veces', 'desc')
    .orderBy('h.codigo_de_regla')
    .limit(5)
    .execute();

  const mes = await db
    .selectFrom('validador.analisis')
    .select((eb) => [
      eb.fn.countAll<string>().as('piezas'),
      eb.fn.count<string>(eb.case().when('nivel_de_riesgo', '=', 'sin_hallazgos').then(1).end()).as('sin_hallazgos'),
    ])
    .where('organizacion_id', '=', organizacionId)
    .where(sql<boolean>`date_trunc('month', creado_en at time zone ${ZONA_HORARIA}) = date_trunc('month', now() at time zone ${ZONA_HORARIA})`)
    .executeTakeFirstOrThrow();

  const piezas = Number(mes.piezas);
  const sinHallazgos = Number(mes.sin_hallazgos);
  return {
    recurrentes: recurrentes.map((r) => ({ ...r, veces: Number(r.veces) })),
    primeraRevision: { piezas, sinHallazgos, porcentaje: piezas === 0 ? null : (sinHallazgos / piezas) * 100 },
  };
}

/**
 * Cuántas veces el jefe del área marcó «correcto» e «incorrecto» los hallazgos de cada regla, por código
 * y a través de todas las versiones: las que más «incorrecto» acumulan son las candidatas a ajuste.
 */
export async function veredictosPorRegla(db: Db, organizacionId: string) {
  const filas = await db
    .selectFrom('validador.retroalimentacion as f')
    .innerJoin('validador.hallazgos as h', 'h.id', 'f.hallazgo_id')
    .innerJoin('validador.analisis as a', 'a.id', 'h.analisis_id')
    .select(['h.codigo_de_regla', 'f.veredicto'])
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where('a.organizacion_id', '=', organizacionId)
    .groupBy(['h.codigo_de_regla', 'f.veredicto'])
    .execute();
  const porCodigo = new Map<string, { correctos: number; incorrectos: number }>();
  for (const f of filas) {
    const v = porCodigo.get(f.codigo_de_regla) ?? { correctos: 0, incorrectos: 0 };
    if (f.veredicto === 'correcto') v.correctos += Number(f.n);
    else v.incorrectos += Number(f.n);
    porCodigo.set(f.codigo_de_regla, v);
  }
  return porCodigo;
}
