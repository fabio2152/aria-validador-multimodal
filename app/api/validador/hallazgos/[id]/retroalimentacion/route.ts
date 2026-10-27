// POST: el veredicto del jefe del área sobre un hallazgo («correcto» o «incorrecto», con un comentario
// opcional). Se puede cambiar: el último reemplaza al anterior.

import { ok, rechazo } from '../../../../../../lib/autorizacion/respuesta.ts';
import { base, organizacionActual } from '../../../../../../lib/validador/base.ts';
import { guardarRetroalimentacion } from '../../../../../../lib/validador/registro.ts';
import { esUuid, responder } from '../../../../../../lib/validador/rutas.ts';

const LARGO_MAXIMO_DEL_COMENTARIO = 1000;

export async function POST(peticion: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return responder(async () => {
    const { id } = await params;
    if (!esUuid(id)) return rechazo('no_encontrado');
    let cuerpo: { veredicto?: unknown; comentario?: unknown };
    try {
      cuerpo = (await peticion.json()) as typeof cuerpo;
    } catch {
      return rechazo('peticion_invalida', 'El cuerpo es JSON: { veredicto, comentario }.');
    }
    if (cuerpo.veredicto !== 'correcto' && cuerpo.veredicto !== 'incorrecto') {
      return rechazo('peticion_invalida', 'El veredicto es «correcto» o «incorrecto».');
    }
    const comentario = typeof cuerpo.comentario === 'string' && cuerpo.comentario.trim() !== '' ? cuerpo.comentario.trim() : null;
    if ((comentario?.length ?? 0) > LARGO_MAXIMO_DEL_COMENTARIO) {
      return rechazo('peticion_invalida', `El comentario admite hasta ${LARGO_MAXIMO_DEL_COMENTARIO} caracteres.`);
    }
    const guardada = await guardarRetroalimentacion(base(), organizacionActual(), id, cuerpo.veredicto, comentario);
    return guardada ? ok(guardada) : rechazo('no_encontrado');
  });
}
