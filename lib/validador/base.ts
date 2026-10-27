// La conexión del validador a su base.
//
// MAQUETA: una sola cadena, `DATABASE_URL`. En ARIA la capa de datos tiene un cliente por rol
// (`lib/datos/capa.ts`: inquilino, identidad, migrador) y el inquilino filtra por organización con la
// política de la base. Al integrar, `base()` se reemplaza por el cliente del inquilino y
// `organizacionActual()` por el contexto de `lib/datos/contexto.ts`.

import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { BaseDelValidador } from './esquema.ts';

/** La organización de la maqueta: la misma de `app/sesion-de-maqueta.ts` y del sembrado. */
export const ORGANIZACION_DE_MAQUETA = '00000000-0000-4000-8000-0000000000a1';

/** La organización de la petición. En la maqueta hay una sola. */
export function organizacionActual(): string {
  return ORGANIZACION_DE_MAQUETA;
}

export type Db = Kysely<BaseDelValidador>;

// En `globalThis` y no en una variable del módulo: en desarrollo Next recarga los módulos y cada
// recarga abriría un agrupador nuevo sin cerrar el anterior.
const global = globalThis as unknown as { baseDelValidador?: Db };

export function base(): Db {
  if (global.baseDelValidador) return global.baseDelValidador;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL en .env.local (ver .env.example).');
  global.baseDelValidador = new Kysely<BaseDelValidador>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString: url, max: 5, connectionTimeoutMillis: 10_000 }),
    }),
  });
  return global.baseDelValidador;
}

export async function cerrarBase(): Promise<void> {
  const db = global.baseDelValidador;
  delete global.baseDelValidador;
  await db?.destroy();
}
