'use client';

/* El panel de ingreso, en una fila: la zona para arrastrar la imagen, el enlace de Google Drive, el copy,
 * el guion o transcripción, el formato destino y «Analizar pieza».
 *
 * Una pieza necesita al menos imagen, copy o guion: el botón se habilita con cualquiera de los tres. El
 * enlace de Drive (Fase 6) es la otra forma de dar la imagen; con un archivo cargado, se ignora. */

import { useEffect, useRef, useState } from 'react';
import { FORMATOS } from './comun.js';

const ACEPTADAS = 'image/jpeg,image/png,image/webp,image/gif';

export default function PanelDeIngreso({ ocupado, alAnalizar }) {
  const [archivo, setArchivo] = useState(null);
  const [vista, setVista] = useState(null);
  const [encima, setEncima] = useState(false);
  const [enlace, setEnlace] = useState('');
  const [copy, setCopy] = useState('');
  const [guion, setGuion] = useState('');
  const [formato, setFormato] = useState('feed');
  const selector = useRef(null);

  // La vista previa local de la imagen elegida; la URL se suelta al cambiarla.
  useEffect(() => {
    if (!archivo) {
      setVista(null);
      return undefined;
    }
    const url = URL.createObjectURL(archivo);
    setVista(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  const elegir = (lista) => {
    const f = lista?.[0];
    if (f && f.type.startsWith('image/')) setArchivo(f);
  };

  const hayPieza = archivo !== null || enlace.trim() !== '' || copy.trim() !== '' || guion.trim() !== '';

  const enviar = (e) => {
    e.preventDefault();
    if (!hayPieza || ocupado) return;
    const formulario = new FormData();
    if (archivo) formulario.set('archivo', archivo);
    else if (enlace.trim() !== '') formulario.set('enlace_drive', enlace.trim());
    formulario.set('copy', copy);
    formulario.set('guion', guion);
    formulario.set('formato_destino', formato);
    alAnalizar(formulario);
  };

  return (
    <form className="card val-ingreso" onSubmit={enviar}>
      <div className="val-ingreso-fila">
        <div className="val-campo">
          <span className="val-rotulo">Cargar pieza</span>
          <div
            className={`val-zona${encima ? ' encima' : ''}${archivo ? ' con-archivo' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={archivo ? `Imagen cargada: ${archivo.name}. Cambiar imagen` : 'Arrastra una imagen o haz clic para elegirla'}
            onClick={() => selector.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
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
              elegir(e.dataTransfer.files);
            }}
          >
            {vista ? <img src={vista} alt="" className="val-zona-vista" /> : null}
            <span className="val-zona-texto">{archivo ? archivo.name : '⇪ Arrastra una imagen'}</span>
            {archivo ? (
              <button
                type="button"
                className="val-quitar"
                aria-label="Quitar la imagen"
                onClick={(e) => {
                  e.stopPropagation();
                  setArchivo(null);
                  if (selector.current) selector.current.value = '';
                }}
              >
                ✕
              </button>
            ) : null}
          </div>
          <input ref={selector} type="file" accept={ACEPTADAS} hidden onChange={(e) => elegir(e.target.files)} />
        </div>

        <div className="val-campo">
          <label className="val-rotulo" htmlFor="valEnlace">
            O enlace de Google Drive
          </label>
          <input
            id="valEnlace"
            className="val-entrada val-mono"
            type="url"
            placeholder="drive.google.com/file/d/…"
            value={enlace}
            disabled={archivo !== null}
            onChange={(e) => setEnlace(e.target.value)}
          />
          <span className="val-ayuda">{archivo ? 'Se usa la imagen cargada.' : 'Una imagen pública («cualquier persona con el enlace»).'}</span>
        </div>

        <div className="val-campo val-campo-ancho">
          <label className="val-rotulo" htmlFor="valCopy">
            Copy de la publicación
          </label>
          <textarea id="valCopy" className="val-entrada" rows={3} value={copy} onChange={(e) => setCopy(e.target.value)} placeholder="El texto principal del anuncio" />
          <span className="val-ayuda">{copy.trim() ? `${[...copy.trim()].length} caracteres` : 'Opcional si hay imagen o guion.'}</span>
        </div>

        <div className="val-campo val-campo-ancho">
          <label className="val-rotulo" htmlFor="valGuion">
            Guion o transcripción
          </label>
          <textarea
            id="valGuion"
            className="val-entrada"
            rows={3}
            value={guion}
            onChange={(e) => setGuion(e.target.value)}
            placeholder="Opcional: lo que se dice en el reel"
          />
          <span className="val-ayuda">El video llega en una fase posterior: pega aquí su transcripción.</span>
        </div>

        <div className="val-campo val-campo-final">
          <label className="val-rotulo" htmlFor="valFormato">
            Formato destino
          </label>
          <select id="valFormato" className="val-entrada" value={formato} onChange={(e) => setFormato(e.target.value)}>
            {Object.entries(FORMATOS).map(([clave, nombre]) => (
              <option key={clave} value={clave}>
                {nombre}
              </option>
            ))}
          </select>
          <button type="submit" className="fd-btn val-analizar" disabled={!hayPieza || ocupado}>
            {ocupado ? 'Analizando…' : 'Analizar pieza'}
          </button>
        </div>
      </div>
    </form>
  );
}
