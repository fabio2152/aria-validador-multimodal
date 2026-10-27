'use client';

/* La pestaña «Dashboard», la primera del validador: los errores recurrentes de los últimos 30 días, la
 * primera revisión del mes (porcentaje de piezas sin hallazgos) y las restricciones de marca vigentes, con
 * «Agregar restricción», que lleva a la pestaña de reglas. Todo sale de `GET /api/validador/resumen`. */

import { useEffect, useState } from 'react';
import { EJES, pedir, textoDelRechazo } from './comun.js';

export default function Dashboard({ visible, cambios, alAgregarRestriccion }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!visible) return undefined;
    let vigente = true;
    void (async () => {
      const r = await pedir('/api/validador/resumen');
      if (!vigente) return;
      if (r.tipo === 'datos') {
        setDatos(r.datos);
        setError(null);
      } else setError(textoDelRechazo(r));
    })();
    return () => {
      vigente = false;
    };
  }, [visible, cambios]);

  const porcentaje = datos?.primeraRevision.porcentaje;

  return (
    <div className="val-dashboard">
      {error ? (
        <div className="fd-aviso mal val-dashboard-ancho">
          <i>◍</i>
          <span>{error}</span>
        </div>
      ) : null}

      <section className="card val-dashboard-recurrentes">
        <div className="card-head">
          Errores recurrentes
          <span className="hint">últimos 30 días</span>
        </div>
        {datos && datos.recurrentes.length === 0 ? <p className="val-vacio-corto">Sin hallazgos en los últimos 30 días.</p> : null}
        <ul className="val-lista">
          {(datos?.recurrentes ?? []).map((r) => (
            <li key={`${r.codigo_de_regla}-${r.severidad}`} className={`val-recurrente sev-${r.severidad}`}>
              <span className="val-recurrente-texto">
                <span>{r.categoria}</span>
                <em className="val-mono">
                  {r.codigo_de_regla} · {EJES[r.eje]}
                </em>
              </span>
              <b className="val-mono">{r.veces}</b>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="card-head">
          Primera revisión
          <span className="hint">este mes</span>
        </div>
        <div className="card-body">
          <div className="val-primera">
            <span>Piezas sin hallazgos</span>
            <b className="val-mono">{porcentaje == null ? '—' : `${Math.round(porcentaje)} %`}</b>
          </div>
          <div
            className="val-barra"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={porcentaje == null ? undefined : Math.round(porcentaje)}
            aria-label="Piezas sin hallazgos este mes"
          >
            <span style={{ width: `${porcentaje ?? 0}%` }} />
          </div>
          <p className="val-nota">
            {datos ? `${datos.primeraRevision.sinHallazgos} de ${datos.primeraRevision.piezas} piezas` : ''}
            {datos?.version ? ` · corpus v${datos.version.numero}` : ''}
          </p>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          Restricciones de marca
          <span className="hint">{datos ? `${datos.restricciones.length} activa${datos.restricciones.length === 1 ? '' : 's'}` : ''}</span>
        </div>
        {datos && datos.restricciones.length === 0 ? <p className="val-vacio-corto">El jefe del área aún no definió restricciones.</p> : null}
        <ul className="val-lista">
          {(datos?.restricciones ?? []).map((r) => (
            <li key={r.codigo} className="val-restriccion-item">
              <span>{r.descripcion}</span>
              <em className="val-mono">{r.codigo}</em>
            </li>
          ))}
        </ul>
        <button type="button" className="val-agregar" onClick={alAgregarRestriccion}>
          + Agregar restricción
        </button>
      </section>
    </div>
  );
}
