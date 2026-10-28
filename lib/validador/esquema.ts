// Los tipos de las tablas del validador, para el constructor de consultas.
//
// Escritos a mano contra `db/migraciones/079_el_validador_de_contenido.sql` y `080_las_imagenes_del_carrusel.sql`, no generados, igual que
// `lib/datos/esquema.ts` de ARIA: el SQL es la fuente de verdad.
//
// Las claves van CALIFICADAS (`validador.analisis`) y no sueltas como en ARIA: la maqueta no tiene la
// ruta de búsqueda por rol que en ARIA deja escribir `pedidos` en vez de `negocio.pedidos`. Al integrar
// se decide si el esquema entra a esa ruta o se sigue calificando.

import type { ColumnType, Generated } from 'kysely';

export type Eje = 'marca' | 'plataforma';
export type Severidad = 'alta' | 'media' | 'baja';
export type TipoDeVerificacion = 'deterministica' | 'modelo';
export type OrigenDeLaRegla = 'corpus' | 'restriccion_del_jefe';
export type TipoDePieza = 'imagen' | 'carrusel' | 'texto' | 'video';
export type FormatoDestino = 'feed' | 'historia' | 'reel';
export type NivelDeRiesgo = 'alto' | 'medio' | 'bajo' | 'sin_hallazgos';
export type OrigenDelHallazgo = 'deterministica' | 'modelo' | 'revision';
export type Veredicto = 'correcto' | 'incorrecto';

/**
 * `numeric` viaja como TEXTO en `pg` y se escribe como número: convertirlo acá sería pasar por un
 * `double` sin decirlo. Quien lo lee decide.
 */
type Numerico = ColumnType<string, number | string, number | string>;

export interface TablaMarcas {
  id: Generated<string>;
  organizacion_id: string;
  nombre: string;
  creada_en: Generated<Date>;
}

export interface TablaVersionesDelCorpus {
  id: Generated<string>;
  marca_id: string;
  numero: number;
  nota: string;
  creada_en: Generated<Date>;
}

export interface TablaReglas {
  id: Generated<string>;
  version_id: string;
  codigo: string;
  eje: Eje;
  categoria: string;
  descripcion: string;
  criterio_verificable: string;
  ejemplo_cumple: string | null;
  ejemplo_incumple: string | null;
  severidad: Severidad;
  tipo_de_verificacion: TipoDeVerificacion;
  fuente: string;
  vigente_desde: ColumnType<Date, Date | string | undefined, Date | string>;
  origen: Generated<OrigenDeLaRegla>;
}

export interface TablaAnalisis {
  id: Generated<string>;
  organizacion_id: string;
  marca_id: string;
  version_id: string;
  tipo_de_pieza: TipoDePieza;
  formato_destino: FormatoDestino;
  copy: string | null;
  guion: string | null;
  nivel_de_riesgo: NivelDeRiesgo;
  /** Lo que el análisis dice aunque haya terminado («Ortografía no verificada»). */
  advertencias: ColumnType<string[], string | undefined, string>;
  /** Hallazgos del modelo descartados por citar una regla que no está en la versión (KPI K3). */
  hallazgos_descartados: Generated<number>;
  modelo: string | null;
  tokens_de_entrada: Generated<number>;
  tokens_de_salida: Generated<number>;
  tokens_de_cache: Generated<number>;
  costo_usd: Numerico;
  duracion_ms: Generated<number>;
  creado_en: Generated<Date>;
}

export interface TablaHallazgos {
  id: Generated<string>;
  analisis_id: string;
  regla_id: string;
  codigo_de_regla: string;
  eje: Eje;
  severidad: Severidad;
  evidencia: string;
  ubicacion: string;
  confianza: Numerico;
  sugerencia: string | null;
  origen: OrigenDelHallazgo;
  /** En qué imagen del carrusel o de la secuencia está, desde 1. Nulo si es del copy o de la pieza entera. */
  imagen: number | null;
}

export interface TablaImagenesDelAnalisis {
  id: Generated<string>;
  analisis_id: string;
  /** Su lugar en el carrusel o en la secuencia de historias, desde 1. */
  orden: number;
  nombre_del_archivo: string | null;
  ruta_del_archivo: string | null;
  ancho: number;
  alto: number;
  peso_en_bytes: number;
}

export interface TablaRetroalimentacion {
  id: Generated<string>;
  hallazgo_id: string;
  veredicto: Veredicto;
  comentario: string | null;
  creada_en: Generated<Date>;
}

export interface BaseDelValidador {
  'validador.marcas': TablaMarcas;
  'validador.versiones_del_corpus': TablaVersionesDelCorpus;
  'validador.reglas': TablaReglas;
  'validador.analisis': TablaAnalisis;
  'validador.hallazgos': TablaHallazgos;
  'validador.imagenes_del_analisis': TablaImagenesDelAnalisis;
  'validador.retroalimentacion': TablaRetroalimentacion;
}
