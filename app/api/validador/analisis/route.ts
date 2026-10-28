// POST: analiza una pieza (multipart/form-data): hasta 20 imágenes en `archivos` o en `enlaces_drive`,
// el `copy` y el `formato_destino` (`feed` o `historia`). GET: el historial, paginado y filtrado.

import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { base, organizacionActual } from '../../../../lib/validador/base.ts';
import { descargarDeDrive } from '../../../../lib/validador/drive.ts';
import type { FormatoDestino, NivelDeRiesgo } from '../../../../lib/validador/esquema.ts';
import { analizarPieza, FORMATOS, type ArchivoDeLaPieza } from '../../../../lib/validador/flujo.ts';
import { MAXIMO_DE_IMAGENES } from '../../../../lib/validador/hallazgos.ts';
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
      return rechazo('peticion_invalida', 'El formato destino debe ser feed (post) o historia.');
    }

    // Las imágenes llegan en el orden en que se publican: varios campos `archivos`, o enlaces de Drive en
    // `enlaces_drive`, uno por línea. Si hay archivos, los enlaces no se usan.
    const subidos = formulario.getAll('archivos').filter((f): f is File => f instanceof File && f.size > 0);
    const enlaces = (texto(formulario.get('enlaces_drive')) ?? '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const cuantas = subidos.length > 0 ? subidos.length : enlaces.length;
    if (cuantas > MAXIMO_DE_IMAGENES) {
      return rechazo('peticion_invalida', `Una pieza admite hasta ${MAXIMO_DE_IMAGENES} imágenes, el máximo de un carrusel de Instagram.`);
    }

    const archivos: ArchivoDeLaPieza[] = [];
    if (subidos.length > 0) {
      for (const [i, subido] of subidos.entries()) {
        if (subido.size > PESO_MAXIMO_DE_SUBIDA) return rechazo('cuerpo_demasiado_grande', `La imagen ${i + 1} supera los 30 MB que admite Meta.`);
        archivos.push({ nombre: subido.name, tipo: subido.type, bytes: new Uint8Array(await subido.arrayBuffer()) });
      }
    } else {
      for (const [i, enlace] of enlaces.entries()) {
        const drive = await descargarDeDrive(enlace);
        if (drive.tipo === 'error') return rechazo('peticion_invalida', enlaces.length > 1 ? `Enlace ${i + 1}: ${drive.detalle}` : drive.detalle);
        archivos.push({ nombre: drive.nombre, tipo: drive.tipoMime, bytes: drive.bytes });
      }
    }

    const organizacionId = organizacionActual();
    const r = await analizarPieza({
      organizacionId,
      archivos,
      copy: texto(formulario.get('copy')),
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
