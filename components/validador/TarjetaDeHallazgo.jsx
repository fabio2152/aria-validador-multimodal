'use client';

/* Un hallazgo: la barra de color de su severidad, el eje, la regla (categoría, código, descripción), la
 * ubicación, la evidencia entre comillas, la sugerencia y el veredicto del jefe del área.
 *
 * «Correcto» se guarda al tocarlo. «Incorrecto» abre un comentario opcional —el porqué es lo que sirve
 * para ajustar la regla— y se guarda al confirmar. El veredicto se puede cambiar. */

import { useState } from 'react';
import { EJES, ORIGENES, SEVERIDADES, UBICACIONES, pedir, textoDelRechazo } from './comun.js';

export default function TarjetaDeHallazgo({ hallazgo, alCambiar }) {
  const [comentando, setComentando] = useState(false);
  const [comentario, setComentario] = useState(hallazgo.retroalimentacion?.comentario ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const veredicto = hallazgo.retroalimentacion?.veredicto ?? null;

  const guardar = async (nuevo, texto) => {
    setGuardando(true);
    setError(null);
    const r = await pedir(`/api/validador/hallazgos/${hallazgo.id}/retroalimentacion`, {
      metodo: 'POST',
      cuerpo: { veredicto: nuevo, comentario: texto },
    });
    setGuardando(false);
    if (r.tipo !== 'datos') {
      setError(textoDelRechazo(r));
      return;
    }
    setComentando(false);
    alCambiar(hallazgo.id, r.datos);
  };

  const confianza = Math.round(hallazgo.confianza * 100);
  const meta = [
    hallazgo.codigo_de_regla,
    `severidad ${SEVERIDADES[hallazgo.severidad].toLowerCase()}`,
    UBICACIONES[hallazgo.ubicacion] ?? hallazgo.ubicacion,
    ORIGENES[hallazgo.origen],
    hallazgo.origen === 'deterministica' ? null : `confianza ${confianza} %`,
  ].filter(Boolean);

  return (
    <article className={`val-hallazgo sev-${hallazgo.severidad}${veredicto ? ` con-${veredicto}` : ''}`}>
      <div className="val-hallazgo-texto">
        <h3 className="val-hallazgo-titulo">
          <span className={`val-eje ${hallazgo.eje}`}>{EJES[hallazgo.eje]}</span>
          <span>{hallazgo.regla.categoria}</span>
        </h3>
        <p className="val-hallazgo-meta val-mono">{meta.join(' · ')}</p>
        <p className="val-hallazgo-regla">{hallazgo.regla.descripcion}</p>
        <p className="val-evidencia">
          Evidencia: <q>{hallazgo.evidencia}</q>
        </p>
        {hallazgo.sugerencia ? <p className="val-sugerencia">Sugerencia: {hallazgo.sugerencia}</p> : null}
        {veredicto === 'incorrecto' && hallazgo.retroalimentacion?.comentario && !comentando ? (
          <p className="val-comentario">Comentario del jefe del área: {hallazgo.retroalimentacion.comentario}</p>
        ) : null}
        {comentando ? (
          <form
            className="val-comentar"
            onSubmit={(e) => {
              e.preventDefault();
              void guardar('incorrecto', comentario);
            }}
          >
            <label className="val-rotulo" htmlFor={`com-${hallazgo.id}`}>
              ¿Por qué es incorrecto? (opcional)
            </label>
            <textarea id={`com-${hallazgo.id}`} className="val-entrada" rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} autoFocus />
            <div className="val-comentar-acciones">
              <button type="button" className="fd-btn sec" onClick={() => setComentando(false)} disabled={guardando}>
                Cancelar
              </button>
              <button type="submit" className="fd-btn" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Marcar incorrecto'}
              </button>
            </div>
          </form>
        ) : null}
        {error ? (
          <p className="val-error-linea" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <div className="val-veredicto" role="group" aria-label="Veredicto del jefe del área">
        <button
          type="button"
          className={`val-boton-veredicto correcto${veredicto === 'correcto' ? ' on' : ''}`}
          aria-pressed={veredicto === 'correcto'}
          disabled={guardando}
          onClick={() => void guardar('correcto', null)}
        >
          ✓ Correcto
        </button>
        <button
          type="button"
          className={`val-boton-veredicto incorrecto${veredicto === 'incorrecto' ? ' on' : ''}`}
          aria-pressed={veredicto === 'incorrecto'}
          disabled={guardando}
          onClick={() => setComentando(true)}
        >
          ✗ Incorrecto
        </button>
        {veredicto ? <span className="val-estado-veredicto">{veredicto === 'correcto' ? 'Confirmado' : 'Falsa alerta'}</span> : null}
      </div>
    </article>
  );
}
