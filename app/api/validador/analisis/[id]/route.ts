// GET: el detalle completo de un análisis, con sus hallazgos, su versión del corpus y los veredictos.

import { ok, rechazo } from '../../../../../lib/autorizacion/respuesta.ts';
import { base, organizacionActual } from '../../../../../lib/validador/base.ts';
import { detalleDelAnalisis } from '../../../../../lib/validador/registro.ts';
import { esUuid, responder } from '../../../../../lib/validador/rutas.ts';

export async function GET(_peticion: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return responder(async () => {
    const { id } = await params;
    if (!esUuid(id)) return rechazo('no_encontrado');
    const detalle = await detalleDelAnalisis(base(), organizacionActual(), id);
    return detalle ? ok(detalle) : rechazo('no_encontrado');
  });
}
