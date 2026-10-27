// GET: las reglas de la versión vigente (o de `?version=<id>`, sólo lectura), las versiones y los
// veredictos por regla. POST: agrega una restricción del jefe del área y crea la versión N+1.

import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { base, organizacionActual } from '../../../../lib/validador/base.ts';
import { agregarRestriccion, marcaDeLaOrganizacion, reglasDeLaVersion, versionDeLaMarca, versiones, versionVigente } from '../../../../lib/validador/corpus.ts';
import type { Severidad } from '../../../../lib/validador/esquema.ts';
import { veredictosPorRegla } from '../../../../lib/validador/registro.ts';
import { esUuid, responder } from '../../../../lib/validador/rutas.ts';

const SEVERIDADES: readonly Severidad[] = ['alta', 'media', 'baja'];

export async function GET(peticion: Request): Promise<Response> {
  return responder(async () => {
    const db = base();
    const organizacionId = organizacionActual();
    const marcaId = await marcaDeLaOrganizacion(db, organizacionId);
    if (!marcaId) return rechazo('no_encontrado', 'La organización no tiene marca. Corre npm run db:reset.');
    const pedida = new URL(peticion.url).searchParams.get('version');
    if (pedida && !esUuid(pedida)) return rechazo('no_encontrado');
    const vigente = await versionVigente(db, marcaId);
    const version = pedida ? await versionDeLaMarca(db, marcaId, pedida) : vigente;
    if (!version || !vigente) return rechazo('no_encontrado', 'Esa versión del corpus no existe.');
    const veredictos = await veredictosPorRegla(db, organizacionId);
    const reglas = (await reglasDeLaVersion(db, version.id)).map((r) => ({
      ...r,
      veredictos: veredictos.get(r.codigo) ?? { correctos: 0, incorrectos: 0 },
    }));
    return ok({ version, vigente: version.id === vigente.id, versiones: await versiones(db, marcaId), reglas });
  });
}

export async function POST(peticion: Request): Promise<Response> {
  return responder(async () => {
    let cuerpo: { descripcion?: unknown; ejemplo_incumple?: unknown; severidad?: unknown };
    try {
      cuerpo = (await peticion.json()) as typeof cuerpo;
    } catch {
      return rechazo('peticion_invalida', 'El cuerpo es JSON: { descripcion, ejemplo_incumple, severidad }.');
    }
    const descripcion = typeof cuerpo.descripcion === 'string' ? cuerpo.descripcion.trim() : '';
    const ejemplo = typeof cuerpo.ejemplo_incumple === 'string' ? cuerpo.ejemplo_incumple.trim() : '';
    if (descripcion.length < 5) return rechazo('peticion_invalida', 'Describe la restricción: qué no debe comunicar la marca.');
    if (descripcion.length > 500 || ejemplo.length > 500) return rechazo('peticion_invalida', 'La descripción y el ejemplo admiten hasta 500 caracteres.');
    if (ejemplo === '') return rechazo('peticion_invalida', 'Agrega un ejemplo de lo que no debe decirse.');
    if (!(SEVERIDADES as readonly unknown[]).includes(cuerpo.severidad)) return rechazo('peticion_invalida', 'La severidad es alta, media o baja.');

    const db = base();
    const marcaId = await marcaDeLaOrganizacion(db, organizacionActual());
    if (!marcaId) return rechazo('no_encontrado', 'La organización no tiene marca. Corre npm run db:reset.');
    const r = await agregarRestriccion(db, marcaId, { descripcion, ejemploIncumple: ejemplo, severidad: cuerpo.severidad as Severidad });
    return ok(r, 201);
  });
}
