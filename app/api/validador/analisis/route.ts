// POST: analiza una pieza (multipart/form-data). GET: el historial, paginado y filtrado.

import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { base, organizacionActual } from '../../../../lib/validador/base.ts';
import { descargarDeDrive } from '../../../../lib/validador/drive.ts';
import type { FormatoDestino, NivelDeRiesgo } from '../../../../lib/validador/esquema.ts';
import { analizarPieza, FORMATOS } from '../../../../lib/validador/flujo.ts';
import { detalleDelAnalisis, historial } from '../../../../lib/validador/registro.ts';
import { responder } from '../../../../lib/validador/rutas.ts';

const PESO_MAXIMO_DE_SUBIDA = 30 * 1024 * 1024;
const RIESGOS: readonly NivelDeRiesgo[] = ['alto', 'medio', 'bajo', 'sin_hallazgos'];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function texto(valor: FormDataEntryValue | null): string | null {
  return typeof valor === 'string' ? valor : null;
}

export async function POST(peticion: Request): Promise<Response> {
  return responder(async () => {
    let formulario: FormData;
    try {
      formulario = await peticion.formData();
    } catch {
      return rechazo('peticion_invalida', 'La pieza se envía como multipart/form-data.');
    }

    const formato = texto(formulario.get('formato_destino')) ?? 'feed';
    if (!(FORMATOS as readonly string[]).includes(formato)) {
      return rechazo('peticion_invalida', 'El formato destino debe ser feed, historia o reel.');
    }

    let archivo: { nombre: string; tipo: string; bytes: Uint8Array } | null = null;
    const subido = formulario.get('archivo');
    const enlace = texto(formulario.get('enlace_drive'))?.trim() ?? '';
    if (subido instanceof File && subido.size > 0) {
      if (subido.size > PESO_MAXIMO_DE_SUBIDA) return rechazo('cuerpo_demasiado_grande', 'La imagen supera los 30 MB que admite Meta.');
      archivo = { nombre: subido.name, tipo: subido.type, bytes: new Uint8Array(await subido.arrayBuffer()) };
    } else if (enlace !== '') {
      const drive = await descargarDeDrive(enlace);
      if (drive.tipo === 'error') return rechazo('peticion_invalida', drive.detalle);
      archivo = { nombre: drive.nombre, tipo: drive.tipoMime, bytes: drive.bytes };
    }

    const organizacionId = organizacionActual();
    const r = await analizarPieza({
      organizacionId,
      archivo,
      copy: texto(formulario.get('copy')),
      guion: texto(formulario.get('guion')),
      formato: formato as FormatoDestino,
    });
    if (r.tipo === 'rechazo') return rechazo(r.codigo, r.detalle);
    return ok(await detalleDelAnalisis(base(), organizacionId, r.id), 201);
  });
}

export async function GET(peticion: Request): Promise<Response> {
  return responder(async () => {
    const q = new URL(peticion.url).searchParams;
    const riesgo = q.get('riesgo');
    const desde = q.get('desde');
    const hasta = q.get('hasta');
    const pagina = Number(q.get('pagina') ?? '1');
    if (riesgo && !(RIESGOS as readonly string[]).includes(riesgo)) return rechazo('peticion_invalida', 'Nivel de riesgo desconocido.');
    if ((desde && !FECHA.test(desde)) || (hasta && !FECHA.test(hasta))) return rechazo('peticion_invalida', 'Las fechas van como AAAA-MM-DD.');
    if (!Number.isInteger(pagina) || pagina < 1) return rechazo('peticion_invalida', 'La página es un entero desde 1.');
    return ok(
      await historial(base(), organizacionActual(), {
        riesgo: (riesgo as NivelDeRiesgo | null) || null,
        desde: desde || null,
        hasta: hasta || null,
        pagina,
      }),
    );
  });
}
