// GET: la imagen de un análisis, para la vista previa y la miniatura del historial. Se sirve desde el
// almacén local por el id del análisis, nunca por una ruta que mande el navegador.

import { readFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { rechazo } from '../../../../../../lib/autorizacion/respuesta.ts';
import { base, organizacionActual } from '../../../../../../lib/validador/base.ts';
import { ALMACEN } from '../../../../../../lib/validador/flujo.ts';
import { archivoDelAnalisis } from '../../../../../../lib/validador/registro.ts';
import { esUuid, responder } from '../../../../../../lib/validador/rutas.ts';

const TIPOS: Readonly<Record<string, string>> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

export async function GET(_peticion: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return responder(async () => {
    const { id } = await params;
    if (!esUuid(id)) return rechazo('no_encontrado');
    const fila = await archivoDelAnalisis(base(), organizacionActual(), id);
    if (!fila?.ruta_del_archivo) return rechazo('no_encontrado');
    const ruta = resolve(join(ALMACEN, fila.ruta_del_archivo));
    if (!ruta.startsWith(ALMACEN + sep)) return rechazo('no_encontrado');
    let bytes: Buffer;
    try {
      bytes = await readFile(ruta);
    } catch {
      return rechazo('almacen_no_disponible', 'La imagen ya no está en el almacén local.');
    }
    const extension = ruta.slice(ruta.lastIndexOf('.') + 1).toLowerCase();
    return new Response(new Uint8Array(bytes), {
      headers: { 'content-type': TIPOS[extension] ?? 'application/octet-stream', 'cache-control': 'private, max-age=86400' },
    });
  });
}
