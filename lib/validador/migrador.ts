// El corredor de migraciones, con el patrón de `lib/datos/migrador.ts` de ARIA: el `Migrator` de
// Kysely sobre los `.sql` de `db/migraciones/`, en orden alfabético, y la contabilidad en el esquema
// `migraciones`.
//
// MAQUETA: sin la revisión de esquemas ni la comprobación del rol `migrador` de ARIA: la maqueta no
// tiene roles ni aislamiento. Corre con la misma cadena que la aplicación.

import { sql } from 'kysely';
import { Migrator, type Migration, type MigrationProvider } from 'kysely/migration';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Db } from './base.ts';

const DIR = fileURLToPath(new URL('../../db/migraciones/', import.meta.url));

export const ESQUEMA_CONTABILIDAD = 'migraciones';
export const TABLA_APLICADAS = 'migraciones_aplicadas';
export const TABLA_CANDADO = 'migraciones_candado';

export function archivosDeMigracion(): string[] {
  return readdirSync(DIR)
    .filter((n) => n.endsWith('.sql'))
    .sort();
}

const proveedor: MigrationProvider = {
  async getMigrations(): Promise<Record<string, Migration>> {
    const migraciones: Record<string, Migration> = {};
    for (const archivo of archivosDeMigracion()) {
      // `\r\n` → `\n`: en Windows el archivo puede estar en CRLF en el disco.
      const contenido = readFileSync(join(DIR, archivo), 'utf8').replace(/\r\n/g, '\n');
      migraciones[archivo.replace(/\.sql$/, '')] = {
        async up(db) {
          await sql.raw(contenido).execute(db);
        },
      };
    }
    return migraciones;
  },
};

/** Aplica las pendientes y devuelve sus nombres. Lanza con la primera que falle. */
export async function migrar(db: Db): Promise<string[]> {
  await sql`create schema if not exists ${sql.id(ESQUEMA_CONTABILIDAD)}`.execute(db);
  const migrador = new Migrator({
    db,
    provider: proveedor,
    migrationTableSchema: ESQUEMA_CONTABILIDAD,
    migrationTableName: TABLA_APLICADAS,
    migrationLockTableName: TABLA_CANDADO,
  });
  const { error, results } = await migrador.migrateToLatest();
  if (error) {
    const fallida = results?.find((r) => r.status === 'Error')?.migrationName ?? '¿?';
    throw new Error(`falló la migración ${fallida}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return (results ?? []).filter((r) => r.status === 'Success').map((r) => r.migrationName);
}
