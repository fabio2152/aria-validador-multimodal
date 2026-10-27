'use client';

/* La pestaña «Nuevo análisis»: el panel de ingreso y, debajo, el estado del análisis.
 *
 *   vacío       → todavía no se analizó nada en esta sesión
 *   analizando  → los tres pasos del flujo, con el tiempo que lleva
 *   resultado   → `ResultadoDelAnalisis`
 *   error       → el rechazo del servidor, legible, con lo que se puede hacer
 *
 * Los pasos no los informa el servidor —el análisis es UNA petición—: avanzan con el tiempo, con las
 * duraciones típicas de cada etapa, y el último espera la respuesta. Lo que se dice es el orden real del
 * flujo (`lib/validador/flujo.ts`), no un progreso medido. */

import { useEffect, useRef, useState } from 'react';
import { enviarPieza, textoDelRechazo } from './comun.js';
import PanelDeIngreso from './PanelDeIngreso.jsx';
import ResultadoDelAnalisis from './ResultadoDelAnalisis.jsx';

const PASOS = [
  { nombre: 'Verificaciones', detalle: 'Formato, peso y ortografía', desde: 0 },
  { nombre: 'Análisis', detalle: 'Claude contra el corpus de reglas', desde: 1500 },
  { nombre: 'Consolidando', detalle: 'Revisión de dudosos y nivel de riesgo', desde: 14000 },
];

function Analizando({ desde }) {
  const [ahora, setAhora] = useState(desde);
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const lleva = ahora - desde;
  const actual = PASOS.reduce((i, p, j) => (lleva >= p.desde ? j : i), 0);
  return (
    <div className="card val-estado" role="status" aria-live="polite">
      <div className="val-progreso">
        {PASOS.map((p, i) => (
          <div key={p.nombre} className={`val-paso${i < actual ? ' hecho' : ''}${i === actual ? ' en-curso' : ''}`}>
            <span className="val-paso-punto" aria-hidden="true" />
            <span className="val-paso-texto">
              <b>{p.nombre}</b>
              <em>{p.detalle}</em>
            </span>
          </div>
        ))}
      </div>
      <p className="val-nota">Analizando la pieza… {(lleva / 1000).toFixed(0)} s</p>
    </div>
  );
}

export default function NuevoAnalisis({ alCambiar }) {
  const [estado, setEstado] = useState({ tipo: 'vacio' });
  const resultado = useRef(null);

  const analizar = async (formulario) => {
    setEstado({ tipo: 'analizando', desde: Date.now() });
    const r = await enviarPieza(formulario);
    if (r.tipo === 'datos') {
      setEstado({ tipo: 'resultado', analisis: r.datos });
      alCambiar();
    } else {
      setEstado({ tipo: 'error', texto: textoDelRechazo(r), codigo: r.tipo === 'rechazado' ? r.codigo : null });
    }
  };

  // Al llegar el resultado, a la vista: en 1280 px queda debajo del panel de ingreso.
  useEffect(() => {
    if (estado.tipo === 'resultado') resultado.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [estado.tipo]);

  return (
    <div className="val-nuevo">
      <PanelDeIngreso ocupado={estado.tipo === 'analizando'} alAnalizar={analizar} />

      {estado.tipo === 'vacio' ? (
        <div className="card val-estado val-vacio">
          <p>
            Carga una imagen, pega el copy o el guion de la pieza y elige el formato destino. El validador la revisa en dos ejes —el
            criterio de la marca y las políticas de Meta— y cada hallazgo cita su regla y su evidencia.
          </p>
        </div>
      ) : null}

      {estado.tipo === 'analizando' ? <Analizando desde={estado.desde} /> : null}

      {estado.tipo === 'error' ? (
        <div className="fd-aviso mal val-error" role="alert">
          <i>◍</i>
          <span>
            <b>No se pudo analizar la pieza.</b> {estado.texto}
          </span>
        </div>
      ) : null}

      {estado.tipo === 'resultado' ? (
        <div ref={resultado}>
          <ResultadoDelAnalisis analisis={estado.analisis} alCambiar={alCambiar} />
        </div>
      ) : null}
    </div>
  );
}
