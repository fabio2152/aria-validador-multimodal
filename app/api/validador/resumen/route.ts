// GET: lo del dashboard del validador. Los errores recurrentes de los últimos 30 días, el porcentaje de piezas sin
// hallazgos del mes y las restricciones de marca de la versión vigente.

import { ok } from '../../../../lib/autorizacion/respuesta.ts';
import { base, organizacionActual } from '../../../../lib/validador/base.ts';
import { marcaDeLaOrganizacion, reglasDeLaVersion, versionVigente } from '../../../../lib/validador/corpus.ts';
import { resumen } from '../../../../lib/validador/registro.ts';
import { responder } from '../../../../lib/validador/rutas.ts';

export async function GET(): Promise<Response> {
  return responder(async () => {
    const db = base();
    const organizacionId = organizacionActual();
    const marcaId = await marcaDeLaOrganizacion(db, organizacionId);
    const version = marcaId ? await versionVigente(db, marcaId) : null;
    const reglas = version ? await reglasDeLaVersion(db, version.id) : [];
    return ok({
      ...(await resumen(db, organizacionId)),
      version: version ? { id: version.id, numero: version.numero, reglas: reglas.length } : null,
      restricciones: reglas
        .filter((r) => r.origen === 'restriccion_del_jefe')
        .map((r) => ({ codigo: r.codigo, descripcion: r.descripcion, severidad: r.severidad })),
    });
  });
}
