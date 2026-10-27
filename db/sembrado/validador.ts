// El sembrado del validador: la organización ARIA, la marca ARIA y la versión 1 del corpus con las
// reglas semilla. Idempotente: si la marca ya tiene versiones, no toca nada.

import { ORGANIZACION_DE_MAQUETA, type Db } from '../../lib/validador/base.ts';
import { CORPUS_SEMILLA } from './corpus-semilla.ts';

export const MARCA_DE_MAQUETA = 'ARIA';

export async function sembrar(db: Db): Promise<string> {
  return db.transaction().execute(async (trx) => {
    let marca = await trx
      .selectFrom('validador.marcas')
      .select('id')
      .where('organizacion_id', '=', ORGANIZACION_DE_MAQUETA)
      .where('nombre', '=', MARCA_DE_MAQUETA)
      .executeTakeFirst();
    marca ??= await trx
      .insertInto('validador.marcas')
      .values({ organizacion_id: ORGANIZACION_DE_MAQUETA, nombre: MARCA_DE_MAQUETA })
      .returning('id')
      .executeTakeFirstOrThrow();

    const yaHay = await trx.selectFrom('validador.versiones_del_corpus').select('id').where('marca_id', '=', marca.id).executeTakeFirst();
    if (yaHay) return 'la marca ARIA ya tiene corpus: no se sembró nada';

    const version = await trx
      .insertInto('validador.versiones_del_corpus')
      .values({ marca_id: marca.id, numero: 1, nota: 'Corpus semilla (sección 10 de las instrucciones)' })
      .returning('id')
      .executeTakeFirstOrThrow();
    await trx
      .insertInto('validador.reglas')
      .values(CORPUS_SEMILLA.map((r) => ({ ...r, version_id: version.id, origen: 'corpus' as const })))
      .execute();
    return `marca ARIA · versión 1 del corpus con ${CORPUS_SEMILLA.length} reglas`;
  });
}
