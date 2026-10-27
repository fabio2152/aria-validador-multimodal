'use client';

/* El resultado de un análisis: la vista previa de la pieza con sus metadatos, la insignia del nivel de
 * riesgo, los hallazgos por eje, la versión del corpus con que se evaluó, el tiempo y el costo, y una
 * tarjeta por hallazgo. Lo usan «Nuevo análisis» y el detalle del historial. */

import { useState } from 'react';
import { EJES, FORMATOS, NIVELES, dolares, fechaYHora, pesoLegible, segundos, soles, urlDelArchivo } from './comun.js';
import TarjetaDeHallazgo from './TarjetaDeHallazgo.jsx';

export function InsigniaDeRiesgo({ nivel, chica = false }) {
  const n = NIVELES[nivel] ?? { nombre: nivel, clase: 'bajo' };
  return <span className={`val-riesgo ${n.clase}${chica ? ' chica' : ''}`}>{n.nombre}</span>;
}

function VistaPrevia({ analisis }) {
  const metadatos = [
    analisis.ancho && analisis.alto ? `${analisis.ancho}×${analisis.alto}` : null,
    pesoLegible(analisis.peso_en_bytes),
    FORMATOS[analisis.formato_destino],
  ].filter(Boolean);
  return (
    <aside className="val-pieza">
      {analisis.tiene_archivo ? (
        <img className="val-pieza-imagen" src={urlDelArchivo(analisis.id)} alt={`Pieza analizada: ${analisis.nombre_del_archivo ?? 'imagen'}`} />
      ) : (
        <div className="val-pieza-texto">
          <span className="val-rotulo">{analisis.tipo_de_pieza === 'texto' ? 'Pieza de texto' : 'Sin imagen'}</span>
          <p>{analisis.copy ?? analisis.guion}</p>
        </div>
      )}
      <div className="val-pieza-datos">
        {analisis.nombre_del_archivo ? <span className="val-mono val-pieza-nombre">{analisis.nombre_del_archivo}</span> : null}
        <span className="val-mono">{metadatos.join(' · ')}</span>
      </div>
    </aside>
  );
}

export default function ResultadoDelAnalisis({ analisis: inicial, alCambiar }) {
  // Los veredictos cambian el hallazgo en el lugar: se guarda la copia local.
  const [analisis, setAnalisis] = useState(inicial);
  const [visto, setVisto] = useState(inicial);
  if (inicial !== visto) {
    setVisto(inicial);
    setAnalisis(inicial);
  }

  const actualizarHallazgo = (id, retroalimentacion) => {
    setAnalisis((a) => ({ ...a, hallazgos: a.hallazgos.map((h) => (h.id === id ? { ...h, retroalimentacion } : h)) }));
    alCambiar?.();
  };

  const conVeredicto = analisis.hallazgos.filter((h) => h.retroalimentacion).length;

  return (
    <section className="card val-resultado" aria-label="Resultado del análisis">
      <VistaPrevia analisis={analisis} />
      <div className="val-resultado-cuerpo">
        <div className="val-resumen">
          <InsigniaDeRiesgo nivel={analisis.nivel_de_riesgo} />
          <span className="val-conteo">
            {EJES.marca} <b>{analisis.conteo.marca}</b>
          </span>
          <span className="val-conteo">
            {EJES.plataforma} <b>{analisis.conteo.plataforma}</b>
          </span>
          <span className="val-meta val-mono" title={`Versión ${analisis.version.numero} del corpus, ${analisis.version.reglas} reglas`}>
            corpus v{analisis.version.numero} · {analisis.version.reglas} reglas
          </span>
        </div>
        <div className="val-metricas val-mono">
          <span title="Duración del análisis completo">⏱ {segundos(analisis.duracion_ms)}</span>
          <span title={`${dolares(analisis.costo_usd)} · tipo de cambio referencial`}>{soles(analisis.costo_soles)}</span>
          <span title="Tokens de entrada / salida / caché">
            {analisis.tokens.entrada.toLocaleString('es-PE')} / {analisis.tokens.salida.toLocaleString('es-PE')} / {analisis.tokens.cache.toLocaleString('es-PE')} tokens
          </span>
          <span>{analisis.modelo}</span>
          <span>{fechaYHora(analisis.creado_en)}</span>
          {analisis.hallazgos.length > 0 ? (
            <span>
              {conVeredicto} de {analisis.hallazgos.length} revisados
            </span>
          ) : null}
        </div>

        {analisis.advertencias.map((a) => (
          <div className="fd-aviso falta" key={a}>
            <i>◍</i>
            <span>{a}</span>
          </div>
        ))}
        {analisis.hallazgos_descartados > 0 ? (
          <p className="val-nota">
            Se descartaron {analisis.hallazgos_descartados} hallazgo{analisis.hallazgos_descartados === 1 ? '' : 's'} del modelo por citar una regla que no
            está en la versión o no traer evidencia.
          </p>
        ) : null}

        {analisis.hallazgos.length === 0 ? (
          <div className="fd-aviso bien">
            <i>◍</i>
            <span>
              <b>Sin hallazgos.</b> La pieza cumple las {analisis.version.reglas} reglas de la versión {analisis.version.numero} del corpus.
            </span>
          </div>
        ) : (
          <div className="val-hallazgos">
            {analisis.hallazgos.map((h) => (
              <TarjetaDeHallazgo key={h.id} hallazgo={h} alCambiar={actualizarHallazgo} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
