'use client';

/* La pestaña «Reglas de marca»: el corpus de la versión vigente agrupado por eje, el selector para
 * consultar las versiones anteriores (sólo lectura) y el formulario «Agregar restricción».
 *
 * Agregar una restricción crea la versión N+1 del corpus (`lib/validador/corpus.ts`): los análisis nuevos
 * la usan y los anteriores siguen mostrando la suya.
 *
 * ── CANDIDATAS A AJUSTE ─────────────────────────────────────────────────────
 * Es el mecanismo de ajuste manual del proyecto: las reglas cuyos hallazgos el jefe del área marcó
 * «Incorrecto» más veces se señalan, con la cuenta, para revisarlas. Una regla es candidata si tiene al
 * menos un «Incorrecto» y no más «Correcto» que «Incorrecto». */

import { useCallback, useEffect, useRef, useState } from 'react';
import { EJES, SEVERIDADES, fecha, pedir, textoDelRechazo } from './comun.js';

const TIPOS_DE_VERIFICACION = { deterministica: 'Determinística', modelo: 'Modelo' };

function esCandidata(r) {
  return r.veredictos.incorrectos > 0 && r.veredictos.incorrectos >= r.veredictos.correctos;
}

/** La fuente de una regla: el texto, y la URL como enlace en vez de una cadena larga que parte la columna. */
function Fuente({ texto }) {
  const url = texto.match(/https?:\/\/\S+/)?.[0];
  if (!url) return texto;
  const resto = texto
    .replace(url, '')
    .split('·')
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' · ');
  return (
    <>
      {resto}{' '}
      <a href={url} target="_blank" rel="noreferrer" className="val-enlace">
        ver fuente ↗
      </a>
    </>
  );
}

function FormularioDeRestriccion({ alGuardar }) {
  const [descripcion, setDescripcion] = useState('');
  const [ejemplo, setEjemplo] = useState('');
  const [severidad, setSeveridad] = useState('media');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const enviar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setAviso(null);
    const r = await pedir('/api/validador/reglas', {
      metodo: 'POST',
      cuerpo: { descripcion, ejemplo_incumple: ejemplo, severidad },
    });
    setGuardando(false);
    if (r.tipo !== 'datos') {
      setAviso({ tipo: 'mal', texto: textoDelRechazo(r) });
      return;
    }
    setDescripcion('');
    setEjemplo('');
    setSeveridad('media');
    setAviso({ tipo: 'bien', texto: `Se creó la versión ${r.datos.version.numero} del corpus con la restricción ${r.datos.codigo}. Los análisis nuevos ya la usan.` });
    alGuardar();
  };

  return (
    <form className="card val-restriccion" id="valAgregarRestriccion" onSubmit={enviar}>
      <div className="card-head">
        Agregar restricción
        <span className="hint">crea una versión nueva del corpus</span>
      </div>
      <div className="card-body val-restriccion-campos">
        <div className="val-campo val-campo-ancho">
          <label className="val-rotulo" htmlFor="valResDescripcion">
            Lo que la marca no debe comunicar
          </label>
          <input
            id="valResDescripcion"
            className="val-entrada"
            required
            minLength={5}
            maxLength={500}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="No mencionar a la competencia por su nombre"
          />
        </div>
        <div className="val-campo val-campo-ancho">
          <label className="val-rotulo" htmlFor="valResEjemplo">
            Ejemplo de lo que no debe decirse
          </label>
          <input
            id="valResEjemplo"
            className="val-entrada"
            required
            maxLength={500}
            value={ejemplo}
            onChange={(e) => setEjemplo(e.target.value)}
            placeholder="«Somos mejores que la agencia X»"
          />
        </div>
        <div className="val-campo">
          <label className="val-rotulo" htmlFor="valResSeveridad">
            Severidad
          </label>
          <select id="valResSeveridad" className="val-entrada" value={severidad} onChange={(e) => setSeveridad(e.target.value)}>
            {Object.entries(SEVERIDADES).map(([clave, nombre]) => (
              <option key={clave} value={clave}>
                {nombre}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="fd-btn val-guardar-restriccion" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar restricción'}
        </button>
      </div>
      {aviso ? (
        <div className={`fd-aviso ${aviso.tipo} val-aviso-restriccion`} role="status">
          <i>◍</i>
          <span>{aviso.texto}</span>
        </div>
      ) : null}
    </form>
  );
}

export default function ReglasDeMarca({ visible, cambios, alCambiar }) {
  const [versionPedida, setVersionPedida] = useState('');
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const ultimo = useRef(0);

  const cargar = useCallback(async () => {
    const mio = ++ultimo.current;
    const r = await pedir(`/api/validador/reglas${versionPedida ? `?version=${versionPedida}` : ''}`);
    if (mio !== ultimo.current) return;
    if (r.tipo === 'datos') {
      setDatos(r.datos);
      setError(null);
    } else setError(textoDelRechazo(r));
  }, [versionPedida]);

  useEffect(() => {
    if (visible) void cargar();
  }, [visible, cargar, cambios]);

  const alGuardar = () => {
    setVersionPedida('');
    alCambiar();
  };

  const candidatas = datos ? datos.reglas.filter(esCandidata).sort((a, b) => b.veredictos.incorrectos - a.veredictos.incorrectos) : [];

  return (
    <div className="val-reglas">
      <section className="card">
        <div className="card-head">
          Corpus de reglas
          {datos ? (
            <span className="hint">
              versión {datos.version.numero} · {datos.reglas.length} reglas{datos.vigente ? ' · vigente' : ' · sólo lectura'}
            </span>
          ) : null}
        </div>
        <div className="card-body">
          {datos ? (
            <div className="val-version">
              <label className="val-rotulo" htmlFor="valVersion">
                Versión
              </label>
              <select id="valVersion" className="val-entrada" value={versionPedida} onChange={(e) => setVersionPedida(e.target.value)}>
                {datos.versiones.map((v, i) => (
                  <option key={v.id} value={i === 0 ? '' : v.id}>
                    v{v.numero} · {fecha(v.creada_en)} · {v.reglas} reglas{i === 0 ? ' (vigente)' : ''}
                  </option>
                ))}
              </select>
              <p className="val-nota">{datos.version.nota}</p>
            </div>
          ) : null}
          {error ? (
            <div className="fd-aviso mal">
              <i>◍</i>
              <span>{error}</span>
            </div>
          ) : null}
        </div>

        {candidatas.length > 0 ? (
          <div className="fd-aviso falta val-candidatas">
            <i>◍</i>
            <span>
              <b>Candidatas a ajuste:</b>{' '}
              {candidatas.map((r) => `${r.codigo} (${r.veredictos.incorrectos} incorrecto${r.veredictos.incorrectos === 1 ? '' : 's'})`).join(', ')}. Sus hallazgos
              se marcaron «Incorrecto» tantas o más veces que «Correcto»: revisa su criterio con el área.
            </span>
          </div>
        ) : null}

        {datos
          ? ['marca', 'plataforma'].map((eje) => (
              <div className="val-eje-bloque" key={eje}>
                <h3 className="val-eje-titulo">
                  <span className={`val-eje ${eje}`}>{EJES[eje]}</span>
                  {datos.reglas.filter((r) => r.eje === eje).length} reglas
                </h3>
                <div className="val-tabla-caja">
                  <table className="val-tabla val-tabla-reglas">
                    <thead>
                      <tr>
                        <th scope="col">Código</th>
                        <th scope="col">Descripción</th>
                        <th scope="col">Severidad</th>
                        <th scope="col">Verificación</th>
                        <th scope="col">Fuente</th>
                        <th scope="col">Vigente desde</th>
                        <th scope="col">Veredictos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.reglas
                        .filter((r) => r.eje === eje)
                        .map((r) => (
                          <tr key={r.id} className={esCandidata(r) ? 'val-candidata' : undefined}>
                            <td className="val-mono">
                              {r.codigo}
                              {r.origen === 'restriccion_del_jefe' ? <span className="val-marca-jefe">restricción</span> : null}
                            </td>
                            <td>
                              <b className="val-regla-categoria">{r.categoria}</b> {r.descripcion}
                            </td>
                            <td>
                              <span className={`val-sev ${r.severidad}`}>{SEVERIDADES[r.severidad]}</span>
                            </td>
                            <td>{TIPOS_DE_VERIFICACION[r.tipo_de_verificacion]}</td>
                            <td className="val-fuente">
                              <Fuente texto={r.fuente} />
                            </td>
                            <td className="val-mono">{fecha(r.vigente_desde)}</td>
                            <td className="val-mono">
                              ✓{r.veredictos.correctos} ✗{r.veredictos.incorrectos}
                              {esCandidata(r) ? <span className="val-marca-ajuste">ajustar</span> : null}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          : null}
      </section>

      <FormularioDeRestriccion alGuardar={alGuardar} />
    </div>
  );
}
