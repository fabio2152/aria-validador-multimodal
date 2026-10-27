'use client';

import { useEffect } from 'react';

import { bootAios } from '@/lib/aios';
import { useSesion } from '../app/sesion-contexto.tsx';

import IconSprite from './IconSprite';
import TopBar from './TopBar';
import Nav from './Nav';
import CabeceraDeDepartamento from './CabeceraDeDepartamento';

// MAQUETA: de las vistas de ARIA sólo viaja el validador; las demás abren la vista de relleno.
import ValidadorView from './views/ValidadorView';
import { vistaDeMaqueta } from './views/VistaDeMaqueta';

/* La vista de cada pantalla, por su clave.
 *
 * Es la CUARTA de las cuatro copias que `lib/autorizacion/secciones.ts` nombraba —los
 * `id="v-…"` de `components/views/*View.jsx`— y acá pasa a estar atada a la clave de la
 * sección, en vez de repetida en un archivo aparte. Una clave sin entrada en este mapa no se
 * dibuja, y eso es rojo en la prueba que cruza las dos listas. */
// MAQUETA: todas las claves que no son `validador` apuntan a la vista de relleno, con su mismo `id="v-…"`.
const VISTAS = {
  executive: vistaDeMaqueta('executive'),
  contacts: vistaDeMaqueta('contacts'),
  icp: vistaDeMaqueta('icp'),
  acquisition: vistaDeMaqueta('acquisition'),
  creative: vistaDeMaqueta('creative'),
  validador: ValidadorView,
  conversion: vistaDeMaqueta('conversion'),
  conversation: vistaDeMaqueta('conversation'),
  sales: vistaDeMaqueta('sales'),
  setter: vistaDeMaqueta('setter'),
  closer: vistaDeMaqueta('closer'),
  analizadores: vistaDeMaqueta('analizadores'),
  tools: vistaDeMaqueta('tools'),
  monitoreo: vistaDeMaqueta('monitoreo'),
  incidentes: vistaDeMaqueta('incidentes'),
  credenciales: vistaDeMaqueta('credenciales'),
  clientos: vistaDeMaqueta('clientos'),
};

export default function CommandCenter() {
  const sesion = useSesion();

  /* La capa imperativa que queda es el armazón (`lib/aios/shell.js`): abre las pantallas y maneja el
     menú del teléfono. Ya no rellena el contenido de ninguna vista: cada una es React. */
  useEffect(() => {
    bootAios();
  }, []);

  // Las pantallas visibles, en el orden del menú. Se dibujan SOLO ésas.
  //
  // Antes se dibujaban las diez siempre. Con el menú filtrado eso dejaría nueve `<section
  // class="view">` en el DOM que ninguna entrada del menú puede alcanzar — inalcanzables pero
  // presentes, que es la clase de cosa que después alguien encuentra y no entiende. No cierra una
  // fuga —los datos de una vista los sirve el API, donde decide el portero—: cierra una
  // confusión.
  const visibles = (sesion?.menu ?? []).flatMap((g) => g.secciones.map((s) => s.clave));
  const arranque = sesion?.arranque?.seccion.clave;

  return (
    <>
      <IconSprite />

      <div className="app">
        <TopBar />
        <Nav />
        {/* ANTES de `<main>`, por el orden de lectura y del tabulador: el nombre de la pantalla y sus
            pestañas se leen antes que el contenido, como se ven. Fuera de `.main`, para no cortarles
            el pie a las pantallas de operación. */}
        <CabeceraDeDepartamento />

        <main className="main">
          {visibles.map((clave, i) => {
            const Vista = VISTAS[clave];
            if (!Vista) return null;
            // La de arranque arranca activa, no `executive` fijo: para un closer esa pantalla no
            // existe, y el `on` escrito a mano en `ExecutiveView` dejaba el área principal en
            // blanco sin que nada falle.
            //
            // Se compara por CLAVE y no por `i === 0`. Con el índice, esto y la barra coincidían
            // solo mientras las dos listas se recorrieran igual — y eran dos listas distintas: acá
            // se aplanan los grupos y allá no, así que la regla «cuerpo antes que pie» no se podía
            // ni expresar. Ahora las dos preguntan lo mismo: `arranque`.
            return <Vista key={clave} activa={clave === arranque} />;
          })}
        </main>
        {/* MAQUETA: sin la caja «Pregúntale al cerebro» (`ConsultaAlCerebro`): el cerebro es de ARIA y no
            viaja. Sin ella, la fila `consulta` de la rejilla (`app/armazon.css`) mide 0. */}
      </div>
    </>
  );
}
