// El corpus de reglas versionado.
//
// ═══════════════════════════════════════════════════════════════════════════════
// VERSIONADO POR COPIA COMPLETA
//
// Una versión es un conjunto cerrado de reglas. Agregar una restricción no edita la versión vigente:
// crea la N+1 con TODAS las reglas copiadas más la nueva. Cada análisis guarda su `version_id`, así que
// un análisis viejo sigue mostrando las reglas exactas con que se evaluó (KPI K3, trazabilidad).
// ═══════════════════════════════════════════════════════════════════════════════

import type { Selectable } from 'kysely';
import type { Db } from './base.ts';
import type { Eje, FormatoDestino, Severidad, TablaReglas } from './esquema.ts';

export type Regla = Selectable<TablaReglas>;

export interface Version {
  id: string;
  numero: number;
  nota: string;
  creada_en: Date;
}

/** Lo que importa de la pieza para decidir qué reglas aplican. */
export interface FormaDeLaPieza {
  conImagen: boolean;
  conCopy: boolean;
  conGuion: boolean;
  formato: FormatoDestino;
}

export const FUENTE_DEL_JEFE = 'Jefe del área de contenido y marketing';
export const CATEGORIA_DE_RESTRICCION = 'Restricción de marca';
const PREFIJO_DE_RESTRICCION = 'MARCA-RES-';

export async function marcaDeLaOrganizacion(db: Db, organizacionId: string): Promise<string | null> {
  const marca = await db
    .selectFrom('validador.marcas')
    .select('id')
    .where('organizacion_id', '=', organizacionId)
    .orderBy('creada_en')
    .executeTakeFirst();
  return marca?.id ?? null;
}

export async function versionVigente(db: Db, marcaId: string): Promise<Version | null> {
  const version = await db
    .selectFrom('validador.versiones_del_corpus')
    .select(['id', 'numero', 'nota', 'creada_en'])
    .where('marca_id', '=', marcaId)
    .orderBy('numero', 'desc')
    .executeTakeFirst();
  return version ?? null;
}

export async function versiones(db: Db, marcaId: string): Promise<(Version & { reglas: number })[]> {
  const filas = await db
    .selectFrom('validador.versiones_del_corpus as v')
    .leftJoin('validador.reglas as r', 'r.version_id', 'v.id')
    .select(['v.id', 'v.numero', 'v.nota', 'v.creada_en'])
    .select((eb) => eb.fn.count<string>('r.id').as('reglas'))
    .where('v.marca_id', '=', marcaId)
    .groupBy(['v.id', 'v.numero', 'v.nota', 'v.creada_en'])
    .orderBy('v.numero', 'desc')
    .execute();
  return filas.map((f) => ({ ...f, reglas: Number(f.reglas) }));
}

export async function versionDeLaMarca(db: Db, marcaId: string, versionId: string): Promise<Version | null> {
  const version = await db
    .selectFrom('validador.versiones_del_corpus')
    .select(['id', 'numero', 'nota', 'creada_en'])
    .where('marca_id', '=', marcaId)
    .where('id', '=', versionId)
    .executeTakeFirst();
  return version ?? null;
}

export async function reglasDeLaVersion(db: Db, versionId: string): Promise<Regla[]> {
  return db.selectFrom('validador.reglas').selectAll().where('version_id', '=', versionId).orderBy('eje').orderBy('codigo').execute();
}

export function reglasDelEje(reglas: readonly Regla[], eje: Eje): Regla[] {
  return reglas.filter((r) => r.eje === eje);
}

/**
 * ¿La regla aplica a esta pieza? Las de formato miran la imagen o el copy; la de ortografía, el copy o el
 * guion; la de coherencia del copy, que haya copy y además algo con qué compararlo. Las demás, siempre.
 */
export function aplica(regla: Pick<Regla, 'codigo'>, pieza: FormaDeLaPieza): boolean {
  switch (regla.codigo) {
    case 'FMT-01':
    case 'FMT-02':
    case 'FMT-03':
      return pieza.conImagen;
    case 'FMT-04':
      return pieza.conCopy;
    case 'MARCA-ORT-01':
      return pieza.conCopy || pieza.conGuion;
    case 'MARCA-COPY-01':
      return pieza.conCopy && (pieza.conImagen || pieza.conGuion);
    default:
      return true;
  }
}

export interface Restriccion {
  descripcion: string;
  ejemploIncumple: string;
  severidad: Severidad;
}

/**
 * Agrega una restricción del jefe del área: crea la versión N+1 con todas las reglas de la vigente
 * copiadas y la restricción nueva, en UNA transacción. La marca se bloquea mientras tanto, para que dos
 * restricciones guardadas a la vez no peleen por el mismo número de versión.
 */
export async function agregarRestriccion(db: Db, marcaId: string, restriccion: Restriccion): Promise<{ version: Version; codigo: string }> {
  return db.transaction().execute(async (trx) => {
    await trx.selectFrom('validador.marcas').select('id').where('id', '=', marcaId).forUpdate().executeTakeFirstOrThrow();
    const vigente = await versionVigente(trx, marcaId);
    const reglas = vigente ? await reglasDeLaVersion(trx, vigente.id) : [];

    const usados = reglas
      .filter((r) => r.codigo.startsWith(PREFIJO_DE_RESTRICCION))
      .map((r) => Number(r.codigo.slice(PREFIJO_DE_RESTRICCION.length)))
      .filter(Number.isFinite);
    const codigo = `${PREFIJO_DE_RESTRICCION}${String(Math.max(0, ...usados) + 1).padStart(2, '0')}`;

    const version = await trx
      .insertInto('validador.versiones_del_corpus')
      .values({ marca_id: marcaId, numero: (vigente?.numero ?? 0) + 1, nota: `Restricción ${codigo}: ${restriccion.descripcion}` })
      .returning(['id', 'numero', 'nota', 'creada_en'])
      .executeTakeFirstOrThrow();

    const copiadas = reglas.map(({ id: _id, version_id: _version, ...resto }) => ({ ...resto, version_id: version.id }));
    const nueva = {
      version_id: version.id,
      codigo,
      eje: 'marca' as const,
      categoria: CATEGORIA_DE_RESTRICCION,
      descripcion: restriccion.descripcion,
      criterio_verificable: `Incumple si la pieza comunica lo que esta restricción prohíbe: ${restriccion.descripcion}`,
      ejemplo_cumple: null,
      ejemplo_incumple: restriccion.ejemploIncumple,
      severidad: restriccion.severidad,
      tipo_de_verificacion: 'modelo' as const,
      fuente: FUENTE_DEL_JEFE,
      origen: 'restriccion_del_jefe' as const,
    };
    await trx.insertInto('validador.reglas').values([...copiadas, nueva]).execute();
    return { version, codigo };
  });
}
