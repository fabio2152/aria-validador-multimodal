'use client';

/* El validador de contenido: Marketing › Validador de contenido.
 *
 * La forma de `CreativeView.jsx` —la sección con su `id="v-<clave>"`, que es por donde
 * `lib/aios/shell.js` abre las vistas— y adentro el panel, que lleva las tres pestañas. */

import PanelDelValidador from '../validador/PanelDelValidador.jsx';

export default function ValidadorView({ activa }) {
  return (
    <section className={activa ? 'view on' : 'view'} id="v-validador">
      <div className="view-scroll val-scroll">
        <PanelDelValidador />
      </div>
    </section>
  );
}
