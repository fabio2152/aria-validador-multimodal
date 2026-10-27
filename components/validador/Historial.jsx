'use client';

/* La pestaña «Historial»: el registro de análisis, con filtros por nivel de riesgo y rango de fechas.
 * Cada fila dice cuándo, qué pieza, el formato, el riesgo, los hallazgos por eje, la versión del corpus y
 * cuántos hallazgos ya tienen veredicto. Al abrir una se ve su detalle completo, con la misma tarjeta que
 * «Nuevo análisis»: ahí se dan o cambian los veredictos. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { FORMATOS, NIVELES, fechaYHora, pedir, textoDelRechazo, urlDelArchivo } from './comun.js';
import ResultadoDelAnalisis, { InsigniaDeRiesgo } from './ResultadoDelAnalisis.jsx';

const SIN_FILTROS = { riesgo: '', desde: '', hasta: '' };

export default function Historial({ visible, cambios, alCambiar }) {
  const [filtros, setFiltros] = useState(SIN_FILTROS);
  const [pagina, setPagina] = useState(1);
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const ultimo = useRef(0);

  const cargar = useCallback(async () => {
    const mio = ++ultimo.current;
    const q = new URLSearchParams({ pagina: String(pagina) });
    for (const [k, v] of Object.entries(filtros)) if (v) q.set(k, v);
    const r = await pedir(`/api/validador/analisis?${q}`);
    if (mio !== ultimo.current) return;
    if (r.tipo === 'datos') {
      setLista(r.datos);
      setError(null);
    } else setError(textoDelRechazo(r));
  }, [filtros, pagina]);

  useEffect(() => {
    if (visible) void cargar();
  }, [visible, cargar, cambios]);

  const abrir = async (id) => {
    setAbierto({ id, analisis: null, error: null });
    const r = await pedir(`/api/validador/analisis/${id}`);
    setAbierto(r.tipo === 'datos' ? { id, analisis: r.datos, error: null } : { id, analisis: null, error: textoDelRechazo(r) });
  };

  const cambiarFiltro = (clave, valor) => {
    setFiltros((f) => ({ ...f, [clave]: valor }));
    setPagina(1);
  };

  if (abierto) {
    return (
      <div className="val-detalle">
        <button type="button" className="fd-btn sec val-volver" onClick={() => setAbierto(null)}>
          ← Volver al historial
        </button>
        {abierto.error ? (
          <div className="fd-aviso mal">
            <i>◍</i>
            <span>{abierto.error}</span>
          </div>
        ) : null}
        {abierto.analisis ? <ResultadoDelAnalisis analisis={abierto.analisis} alCambiar={alCambiar} /> : null}
        {!abierto.analisis && !abierto.error ? <p className="val-nota">Cargando el análisis…</p> : null}
      </div>
    );
  }

  const paginas = lista ? Math.max(1, Math.ceil(lista.total / lista.tamano)) : 1;
  const hayFiltros = Object.values(filtros).some(Boolean);

  return (
    <section className="card val-historial" aria-label="Historial de análisis">
      <div className="card-head">
        Historial de análisis
        <span className="hint">{lista ? `${lista.total} análisis` : ''}</span>
      </div>
      <div className="val-filtros">
        <div className="val-campo">
          <label className="val-rotulo" htmlFor="valFiltroRiesgo">
            Nivel de riesgo
          </label>
          <select id="valFiltroRiesgo" className="val-entrada" value={filtros.riesgo} onChange={(e) => cambiarFiltro('riesgo', e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(NIVELES).map(([clave, n]) => (
              <option key={clave} value={clave}>
                {n.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="val-campo">
          <label className="val-rotulo" htmlFor="valDesde">
            Desde
          </label>
          <input id="valDesde" className="val-entrada" type="date" value={filtros.desde} onChange={(e) => cambiarFiltro('desde', e.target.value)} />
        </div>
        <div className="val-campo">
          <label className="val-rotulo" htmlFor="valHasta">
            Hasta
          </label>
          <input id="valHasta" className="val-entrada" type="date" value={filtros.hasta} onChange={(e) => cambiarFiltro('hasta', e.target.value)} />
        </div>
        {hayFiltros ? (
          <button type="button" className="fd-btn sec val-limpiar" onClick={() => {
              setFiltros(SIN_FILTROS);
              setPagina(1);
            }}
          >
            Quitar filtros
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="fd-aviso mal">
          <i>◍</i>
          <span>{error}</span>
        </div>
      ) : null}

      {lista && lista.analisis.length === 0 ? (
        <p className="val-nota val-sin-filas">{hayFiltros ? 'Ningún análisis coincide con los filtros.' : 'Todavía no hay análisis. Analiza una pieza en «Nuevo análisis».'}</p>
      ) : null}

      {lista && lista.analisis.length > 0 ? (
        <div className="val-tabla-caja">
          <table className="val-tabla">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Pieza</th>
                <th scope="col">Formato</th>
                <th scope="col">Riesgo</th>
                <th scope="col">Marca</th>
                <th scope="col">Plataforma</th>
                <th scope="col">Corpus</th>
                <th scope="col">Revisión</th>
              </tr>
            </thead>
            <tbody>
              {lista.analisis.map((a) => {
                const total = a.hallazgos.marca + a.hallazgos.plataforma;
                return (
                  <tr key={a.id} onClick={() => void abrir(a.id)} className="val-fila">
                    <td className="val-mono">{fechaYHora(a.creado_en)}</td>
                    <td>
                      <button type="button" className="val-fila-pieza" onClick={(e) => (e.stopPropagation(), void abrir(a.id))}>
                        {a.tiene_archivo ? (
                          <img className="val-miniatura" src={urlDelArchivo(a.id)} alt="" loading="lazy" />
                        ) : (
                          <span className="val-miniatura val-miniatura-texto" aria-hidden="true">
                            Aa
                          </span>
                        )}
                        <span className="val-fila-nombre">{a.nombre_del_archivo ?? a.extracto ?? 'Pieza de texto'}</span>
                      </button>
                    </td>
                    <td>{FORMATOS[a.formato_destino]}</td>
                    <td>
                      <InsigniaDeRiesgo nivel={a.nivel_de_riesgo} chica />
                    </td>
                    <td className="val-num">{a.hallazgos.marca}</td>
                    <td className="val-num">{a.hallazgos.plataforma}</td>
                    <td className="val-mono">v{a.version_numero}</td>
                    <td className="val-mono">{total === 0 ? '—' : `${a.con_veredicto}/${total}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {paginas > 1 ? (
        <div className="val-paginas">
          <button type="button" className="fd-btn sec" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
            ← Anterior
          </button>
          <span className="val-mono">
            {pagina} de {paginas}
          </span>
          <button type="button" className="fd-btn sec" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>
            Siguiente →
          </button>
        </div>
      ) : null}
    </section>
  );
}
