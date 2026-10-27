'use client';

/* MAQUETA: la vista de relleno de las secciones que no viajan a la maqueta.
 *
 * Las entradas de las otras áreas SE VEN en la barra, para que la carcasa se vea completa, y al
 * abrirlas dicen de quién son. Cada una conserva su `id="v-<clave>"`: `lib/aios/shell.js` abre las
 * vistas por ese id, así que la navegación de la carcasa funciona sin tocarla. */

import { useSesion } from '../../app/sesion-contexto.tsx';

/** Una vista de relleno atada a su clave, con la misma forma que las del mapa `VISTAS`. */
export function vistaDeMaqueta(clave) {
  function Vista({ activa }) {
    const sesion = useSesion();
    const nombre = sesion?.secciones.find((s) => s.clave === clave)?.nombre ?? clave;
    return (
      <section className={activa ? 'view on' : 'view'} id={`v-${clave}`}>
        <div className="view-scroll">
          <div className="card vm-relleno">
            <div className="card-head">{nombre}</div>
            <div className="card-body">Esta sección pertenece a la plataforma ARIA y no forma parte de esta maqueta.</div>
          </div>
        </div>
      </section>
    );
  }
  Vista.displayName = `VistaDeMaqueta(${clave})`;
  return Vista;
}

export default vistaDeMaqueta;
