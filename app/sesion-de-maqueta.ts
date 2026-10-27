// MAQUETA: la sesión que en ARIA arma `GET /api/auth/sesion` tras autenticar.
//
// ═══════════════════════════════════════════════════════════════════════════════
// CON LAS FUNCIONES REALES, NO ESCRITA A MANO
//
// El menú, la navegación por departamentos y las secciones salen de `menuVisible()`,
// `menuPorDepartamentos()` y `seccionesConAlcance()` —las mismas que llama la ruta de ARIA— aplicadas
// sobre una persona ficticia con TODAS las capacidades y sin alcance restringido. Así la forma de los
// datos es idéntica a la real, y la sección `validador` aparece porque está registrada, no porque
// alguien la haya agregado al menú.
//
// Lo único que se decide acá es la pantalla de arranque: en ARIA la da `seccionDeArranque()` (el
// Inicio, para quien lo ve); la maqueta abre en el validador.
// ═══════════════════════════════════════════════════════════════════════════════

import type { DatosDeSesion } from './sesion-contexto.tsx';
import { CAPACIDADES } from '../lib/autorizacion/capacidades.ts';
import { menuVisible, seccionDeArranque, seccionesConAlcance } from '../lib/autorizacion/secciones.ts';
import { menuPorDepartamentos } from '../lib/autorizacion/departamentos.ts';

/** La persona y la empresa ficticias de la demo. */
export const PERSONA_DE_MAQUETA = {
  id: '00000000-0000-4000-8000-000000000001',
  nombre: 'Gabriel Iglesias',
  rol: 'Jefe del área de marketing',
} as const;

const permisos: ReadonlySet<string> = new Set(CAPACIDADES);
const alcance = { restringido: false } as const;
const desdeLaPrincipal = true;

const menu = menuVisible(permisos, alcance, desdeLaPrincipal);
const deArranque = (() => {
  for (const g of menu) {
    const seccion = g.secciones.find((s) => s.clave === 'validador');
    if (seccion) return { seccion, grupo: g.grupo.clave };
  }
  // Sin el validador registrado, el mismo arranque que ARIA.
  return seccionDeArranque(menu);
})();

export const SESION_DE_MAQUETA: DatosDeSesion = {
  menu: menu.map((g) => ({ grupo: g.grupo, secciones: g.secciones.map((s) => ({ clave: s.clave, nombre: s.nombre, menu: s.menu })) })),
  arranque: deArranque,
  navegacion: menuPorDepartamentos(menu),
  restringido: alcance.restringido,
  usuarioNombre: PERSONA_DE_MAQUETA.nombre,
  usuarioId: PERSONA_DE_MAQUETA.id,
  puedeCambiarDeEmpresa: false,
  puedeConfigurarComisiones: false,
  puedeBorrarPersonas: false,
  secciones: seccionesConAlcance(permisos, alcance, desdeLaPrincipal).map((s) => ({ clave: s.clave, nombre: s.nombre })),
  organizacion: {
    id: '00000000-0000-4000-8000-0000000000a1',
    nombre: 'ARIA High Ticket',
    activa: true,
    zonaHoraria: 'America/Lima',
    esPrincipal: true,
  },
  mirandoOtraOrganizacion: false,
};
