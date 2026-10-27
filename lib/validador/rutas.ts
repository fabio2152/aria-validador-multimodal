// Lo común a las rutas de `app/api/validador/`: el rechazo cuando la base no responde y la forma de los
// identificadores. Las respuestas usan `ok()` y `rechazo()` de `lib/autorizacion/respuesta.ts`, como toda
// ruta de ARIA.
//
// MAQUETA: sin `exigir()` del portero de ARIA: no hay sesión. Al integrar, cada ruta empieza con
// `exigir(peticion, ...)` y corre dentro de `conOrganizacion(contexto.orgEfectiva, …)`.

import { ok, rechazo } from '../autorizacion/respuesta.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esUuid(x: string): boolean {
  return UUID.test(x);
}

function esFaltaDeBase(e: unknown): boolean {
  const codigo = (e as { code?: unknown } | null)?.code;
  const mensaje = e instanceof Error ? e.message : '';
  return codigo === 'ECONNREFUSED' || codigo === '57P03' || codigo === '3D000' || /DATABASE_URL|ECONNREFUSED|Connection terminated|timeout exceeded when trying to connect/i.test(mensaje);
}

/** Corre la ruta y traduce una base caída a un rechazo legible, en vez de un 500 mudo. */
export async function responder(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (esFaltaDeBase(e)) {
      return rechazo('base_no_disponible', 'La base del validador no responde. Levántala con «docker compose up -d» y «npm run db:reset».');
    }
    console.error('[validador]', e);
    return ok({ codigo: 'error_interno', detalle: 'Algo falló en el servidor. El detalle quedó en la consola de npm run dev.' }, 500);
  }
}
