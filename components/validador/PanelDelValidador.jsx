'use client';

/* El validador por dentro: la pestaña abierta, una de cuatro.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * LAS PESTAÑAS, CON EL MECANISMO DE ARIA
 *
 * No hay una barra de pestañas propia: las cuatro son entradas del grupo «Validador de contenido» en
 * `lib/autorizacion/departamentos.ts`, y las dibuja la cabecera del departamento como sub-pestañas.
 * Esta pantalla hace lo mismo que `PanelDeAnalizadores.jsx`:
 *
 *   · lee la pestaña PEDIDA con `usarPedidoDeVista` y la atiende una vez por número de secuencia;
 *   · anuncia la que DIBUJA con `anunciarPestana`, antes de pintar, para que la barra y la cabecera
 *     marquen la entrada correcta aunque la pestaña cambie por dentro (el «Agregar restricción» del
 *     dashboard lleva a Reglas sin pasar por la barra).
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useLayoutEffect, useState } from 'react';
import { anunciarPestana, irALaVista } from '../../lib/aios/shell.js';
import { usarPedidoDeVista } from '../../lib/vista.ts';
import NuevoAnalisis from './NuevoAnalisis.jsx';
import Historial from './Historial.jsx';
import ReglasDeMarca from './ReglasDeMarca.jsx';
import Dashboard from './Dashboard.jsx';

const PESTANAS = ['dashboard', 'nuevo', 'historial', 'reglas'];

export default function PanelDelValidador() {
  // La primera del grupo, como la abre la barra al tocar «Validador de contenido».
  const [pestana, setPestana] = useState('dashboard');
  const pedido = usarPedidoDeVista('validador');
  const [atendido, setAtendido] = useState(0);
  if (pedido && pedido.secuencia !== atendido) {
    setAtendido(pedido.secuencia);
    if (PESTANAS.includes(pedido.pestana) && pedido.pestana !== pestana) setPestana(pedido.pestana);
  }
  useLayoutEffect(() => {
    anunciarPestana('validador', pestana);
  }, [pestana]);

  /* Un número que sube cada vez que algo cambia los datos —un análisis nuevo, un veredicto, una
     restricción—: el dashboard, el historial y las reglas lo miran para volver a pedir. */
  const [cambios, setCambios] = useState(0);
  const huboCambios = useCallback(() => setCambios((n) => n + 1), []);
  const irAReglas = useCallback(() => irALaVista('validador', { pestana: 'reglas' }), []);

  return (
    <div className="val">
      <div className="val-cuerpo">
        {/* Las cuatro quedan montadas y se esconden: un análisis en curso no se pierde por mirar el historial. */}
        <div hidden={pestana !== 'dashboard'}>
          <Dashboard visible={pestana === 'dashboard'} cambios={cambios} alAgregarRestriccion={irAReglas} />
        </div>
        <div hidden={pestana !== 'nuevo'}>
          <NuevoAnalisis alCambiar={huboCambios} />
        </div>
        <div hidden={pestana !== 'historial'}>
          <Historial visible={pestana === 'historial'} cambios={cambios} alCambiar={huboCambios} />
        </div>
        <div hidden={pestana !== 'reglas'}>
          <ReglasDeMarca visible={pestana === 'reglas'} cambios={cambios} alCambiar={huboCambios} />
        </div>
      </div>
    </div>
  );
}
