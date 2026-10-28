'use client';

/* El panel de ingreso: las imágenes de la pieza, los enlaces de Google Drive, el copy, el formato destino
 * y «Analizar pieza».
 *
 * Una pieza es un post —una imagen o un carrusel— o una secuencia de historias consecutivas: se cargan
 * hasta `MAXIMO_DE_IMAGENES` imágenes (el tope de un carrusel de Instagram), EN EL ORDEN EN QUE SE PUBLICAN,
 * y se analizan todas en una sola pasada. El orden se cambia con las flechas de cada miniatura.
 *
 * Una pieza necesita al menos una imagen o un copy. Los enlaces de Drive (Fase 6) son la otra forma de dar
 * las imágenes, uno por línea; con imágenes cargadas, se ignoran. El guion o transcripción salió mientras la
 * maqueta se centra en imágenes: vuelve con el video. */

import { useEffect, useRef, useState } from 'react';
import { FORMATOS_DE_INGRESO, MAXIMO_DE_IMAGENES } from './comun.js';

const ACEPTADAS = 'image/jpeg,image/png,image/webp,image/gif';

let siguienteId = 0;

export default function PanelDeIngreso({ ocupado, alAnalizar }) {
  // Cada imagen con su URL de vista previa local; las URL se sueltan al quitarlas o al desmontar.
  const [imagenes, setImagenes] = useState([]);
  const [aviso, setAviso] = useState(null);
  const [encima, setEncima] = useState(false);
  const [enlaces, setEnlaces] = useState('');
  const [copy, setCopy] = useState('');
  const [formato, setFormato] = useState('feed');
  const selector = useRef(null);
  const vistas = useRef(new Set());

  useEffect(() => {
    const abiertas = vistas.current;
    return () => {
      for (const url of abiertas) URL.revokeObjectURL(url);
    };
  }, []);

  const agregar = (lista) => {
    const nuevas = [...(lista ?? [])].filter((f) => f.type.startsWith('image/'));
    if (nuevas.length === 0) return;
    const caben = MAXIMO_DE_IMAGENES - imagenes.length;
    const entran = nuevas.slice(0, Math.max(0, caben));
    setAviso(
      nuevas.length > entran.length
        ? `Instagram admite hasta ${MAXIMO_DE_IMAGENES} imágenes por carrusel: ${nuevas.length - entran.length} no se agregaron.`
        : null,
    );
    const conVista = entran.map((archivo) => {
      const url = URL.createObjectURL(archivo);
      vistas.current.add(url);
      siguienteId += 1;
      return { id: siguienteId, archivo, url };
    });
    setImagenes((antes) => [...antes, ...conVista]);
  };

  const quitar = (id) => {
    setImagenes((antes) => {
      const fuera = antes.find((i) => i.id === id);
      if (fuera) {
        URL.revokeObjectURL(fuera.url);
        vistas.current.delete(fuera.url);
      }
      return antes.filter((i) => i.id !== id);
    });
    setAviso(null);
  };

  const mover = (desde, hacia) => {
    setImagenes((antes) => {
      if (hacia < 0 || hacia >= antes.length) return antes;
      const copia = [...antes];
      const [movida] = copia.splice(desde, 1);
      copia.splice(hacia, 0, movida);
      return copia;
    });
  };

  const listaDeEnlaces = enlaces
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const demasiadosEnlaces = imagenes.length === 0 && listaDeEnlaces.length > MAXIMO_DE_IMAGENES;
  const hayPieza = imagenes.length > 0 || listaDeEnlaces.length > 0 || copy.trim() !== '';

  const enviar = (e) => {
    e.preventDefault();
    if (!hayPieza || ocupado || demasiadosEnlaces) return;
    const formulario = new FormData();
    if (imagenes.length > 0) for (const i of imagenes) formulario.append('archivos', i.archivo);
    else if (listaDeEnlaces.length > 0) formulario.set('enlaces_drive', listaDeEnlaces.join('\n'));
    formulario.set('copy', copy);
    formulario.set('formato_destino', formato);
    alAnalizar(formulario);
  };

  const queEs = formato === 'historia' ? 'historia' : 'imagen';

  return (
    <form className="card val-ingreso" onSubmit={enviar}>
      <div className="val-ingreso-fila">
        <div className="val-campo val-campo-imagenes">
          <span className="val-rotulo">
            Imágenes de la pieza{' '}
            <span className="val-rotulo-cuenta">
              {imagenes.length}/{MAXIMO_DE_IMAGENES}
            </span>
          </span>
          <div
            className={`val-zona${encima ? ' encima' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={`Arrastra hasta ${MAXIMO_DE_IMAGENES} imágenes o haz clic para elegirlas`}
            aria-disabled={imagenes.length >= MAXIMO_DE_IMAGENES}
            onClick={() => imagenes.length < MAXIMO_DE_IMAGENES && selector.current?.click()}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && imagenes.length < MAXIMO_DE_IMAGENES) {
                e.preventDefault();
                selector.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setEncima(true);
            }}
            onDragLeave={() => setEncima(false)}
            onDrop={(e) => {
              e.preventDefault();
              setEncima(false);
              agregar(e.dataTransfer.files);
            }}
          >
            <span className="val-zona-texto">
              {imagenes.length >= MAXIMO_DE_IMAGENES
                ? `Llegaste al máximo de ${MAXIMO_DE_IMAGENES} imágenes`
                : imagenes.length > 0
                  ? '⇪ Agregar más imágenes'
                  : `⇪ Arrastra una o varias imágenes (hasta ${MAXIMO_DE_IMAGENES})`}
            </span>
          </div>
          <input
            ref={selector}
            type="file"
            accept={ACEPTADAS}
            multiple
            hidden
            onChange={(e) => {
              agregar(e.target.files);
              e.target.value = '';
            }}
          />
          <span className="val-ayuda">
            {formato === 'historia' ? 'Una imagen por historia, en el orden en que se publican.' : 'Una imagen es un post; varias, un carrusel. En el orden en que se deslizan.'}
          </span>
        </div>

        <div className="val-campo">
          <label className="val-rotulo" htmlFor="valEnlaces">
            O enlaces de Google Drive
          </label>
          <textarea
            id="valEnlaces"
            className="val-entrada val-mono"
            rows={3}
            placeholder={'drive.google.com/file/d/…\nuno por línea'}
            value={enlaces}
            disabled={imagenes.length > 0}
            onChange={(e) => setEnlaces(e.target.value)}
          />
          <span className={`val-ayuda${demasiadosEnlaces ? ' val-ayuda-mal' : ''}`}>
            {imagenes.length > 0
              ? 'Se usan las imágenes cargadas.'
              : demasiadosEnlaces
                ? `Son ${listaDeEnlaces.length} enlaces: el máximo es ${MAXIMO_DE_IMAGENES}.`
                : 'Imágenes públicas («cualquier persona con el enlace»).'}
          </span>
        </div>

        <div className="val-campo val-campo-ancho">
          <label className="val-rotulo" htmlFor="valCopy">
            Copy de la publicación
          </label>
          <textarea
            id="valCopy"
            className="val-entrada"
            rows={3}
            value={copy}
            onChange={(e) => setCopy(e.target.value)}
            placeholder={formato === 'historia' ? 'Opcional en historias' : 'El texto principal del post'}
          />
          <span className="val-ayuda">{copy.trim() ? `${[...copy.trim()].length} caracteres` : 'Opcional si hay imágenes.'}</span>
        </div>

        <div className="val-campo val-campo-final">
          <label className="val-rotulo" htmlFor="valFormato">
            Formato destino
          </label>
          <select id="valFormato" className="val-entrada" value={formato} onChange={(e) => setFormato(e.target.value)}>
            {Object.entries(FORMATOS_DE_INGRESO).map(([clave, nombre]) => (
              <option key={clave} value={clave}>
                {nombre}
              </option>
            ))}
          </select>
          <button type="submit" className="fd-btn val-analizar" disabled={!hayPieza || ocupado || demasiadosEnlaces}>
            {ocupado ? 'Analizando…' : imagenes.length > 1 ? `Analizar ${imagenes.length} ${formato === 'historia' ? 'historias' : 'imágenes'}` : 'Analizar pieza'}
          </button>
        </div>
      </div>

      {aviso ? (
        <div className="fd-aviso falta val-aviso-ingreso" role="status">
          <i>◍</i>
          <span>{aviso}</span>
        </div>
      ) : null}

      {imagenes.length > 0 ? (
        <ol className="val-carrusel" aria-label={formato === 'historia' ? 'Historias, en orden' : 'Imágenes del carrusel, en orden'}>
          {imagenes.map((img, i) => (
            <li key={img.id} className="val-carrusel-item">
              <img src={img.url} alt="" className="val-carrusel-vista" />
              <span className="val-carrusel-numero">{i + 1}</span>
              <span className="val-carrusel-nombre" title={img.archivo.name}>
                {img.archivo.name}
              </span>
              <span className="val-carrusel-acciones">
                <button type="button" onClick={() => mover(i, i - 1)} disabled={i === 0} aria-label={`Mover la ${queEs} ${i + 1} antes`}>
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => mover(i, i + 1)}
                  disabled={i === imagenes.length - 1}
                  aria-label={`Mover la ${queEs} ${i + 1} después`}
                >
                  →
                </button>
                <button type="button" onClick={() => quitar(img.id)} aria-label={`Quitar la ${queEs} ${i + 1}`} className="val-carrusel-quitar">
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </form>
  );
}
