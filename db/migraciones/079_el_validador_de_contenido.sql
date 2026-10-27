-- 079 · El validador de contenido (Marketing › Validador de contenido).
--
-- Un esquema propio, `validador`, en UNA migración. Todas las tablas que cuelgan de una organización
-- llevan `organizacion_id`: el diseño es multimarca. Al integrar a ARIA se renumera al siguiente número
-- libre y se le agrega el aislamiento por organización de ARIA (`aplicar_aislamiento()`, `app.org_id`).
--
-- ── EL VERSIONADO ES POR COPIA COMPLETA ──────────────────────────────────────
-- Cambiar o agregar una regla crea una versión nueva con TODAS las reglas copiadas. Una regla de una
-- versión existente no se edita nunca: así cada análisis queda atado a las reglas exactas con que se
-- evaluó, y un análisis viejo sigue mostrando su versión aunque el corpus haya cambiado.

create schema if not exists validador;

create table validador.marcas (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null,
  nombre text not null,
  creada_en timestamptz not null default now(),
  unique (organizacion_id, nombre)
);

create table validador.versiones_del_corpus (
  id uuid primary key default gen_random_uuid(),
  marca_id uuid not null references validador.marcas (id),
  numero integer not null check (numero > 0),
  nota text not null,
  creada_en timestamptz not null default now(),
  unique (marca_id, numero)
);

create table validador.reglas (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references validador.versiones_del_corpus (id),
  codigo text not null,
  eje text not null check (eje in ('marca', 'plataforma')),
  categoria text not null,
  descripcion text not null,
  criterio_verificable text not null,
  ejemplo_cumple text,
  ejemplo_incumple text,
  severidad text not null check (severidad in ('alta', 'media', 'baja')),
  tipo_de_verificacion text not null check (tipo_de_verificacion in ('deterministica', 'modelo')),
  fuente text not null,
  vigente_desde date not null default current_date,
  origen text not null default 'corpus' check (origen in ('corpus', 'restriccion_del_jefe')),
  -- Un código es único DENTRO de una versión: es lo que cita cada hallazgo.
  unique (version_id, codigo)
);

create table validador.analisis (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null,
  marca_id uuid not null references validador.marcas (id),
  version_id uuid not null references validador.versiones_del_corpus (id),
  -- `video` ya es un valor válido: el flujo tiene su punto de extensión (`lib/validador/flujo.ts`).
  tipo_de_pieza text not null check (tipo_de_pieza in ('imagen', 'texto', 'video')),
  formato_destino text not null check (formato_destino in ('feed', 'historia', 'reel')),
  nombre_del_archivo text,
  ruta_del_archivo text,
  ancho integer,
  alto integer,
  peso_en_bytes integer,
  copy text,
  guion text,
  nivel_de_riesgo text not null check (nivel_de_riesgo in ('alto', 'medio', 'bajo', 'sin_hallazgos')),
  -- Lo que el análisis tiene que decir aunque haya terminado: «Ortografía no verificada», hallazgos
  -- del modelo descartados por citar una regla inexistente.
  advertencias jsonb not null default '[]'::jsonb,
  hallazgos_descartados integer not null default 0,
  modelo text,
  tokens_de_entrada integer not null default 0,
  tokens_de_salida integer not null default 0,
  tokens_de_cache integer not null default 0,
  costo_usd numeric(12, 6) not null default 0,
  duracion_ms integer not null default 0,
  creado_en timestamptz not null default now()
);

create index analisis_por_organizacion_y_fecha on validador.analisis (organizacion_id, creado_en);

create table validador.hallazgos (
  id uuid primary key default gen_random_uuid(),
  analisis_id uuid not null references validador.analisis (id) on delete cascade,
  regla_id uuid not null references validador.reglas (id),
  codigo_de_regla text not null,
  eje text not null check (eje in ('marca', 'plataforma')),
  severidad text not null check (severidad in ('alta', 'media', 'baja')),
  evidencia text not null,
  ubicacion text not null,
  confianza numeric(4, 3) not null check (confianza between 0 and 1),
  sugerencia text,
  origen text not null check (origen in ('deterministica', 'modelo', 'revision'))
);

create index hallazgos_por_analisis on validador.hallazgos (analisis_id);

-- Un veredicto por hallazgo: cambiarlo reemplaza el anterior.
create table validador.retroalimentacion (
  id uuid primary key default gen_random_uuid(),
  hallazgo_id uuid not null unique references validador.hallazgos (id) on delete cascade,
  veredicto text not null check (veredicto in ('correcto', 'incorrecto')),
  comentario text,
  creada_en timestamptz not null default now()
);
