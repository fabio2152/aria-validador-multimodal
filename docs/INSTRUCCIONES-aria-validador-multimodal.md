# aria-validador-multimodal

## Instrucciones de construcción para Claude Code

> **Para Claude Code:** lee este documento completo antes de escribir código. Trabaja **fase por fase**, en orden. No avances a la siguiente fase hasta cumplir los **criterios de aceptación** de la actual. Si algo de este documento contradice lo que encuentras en el repositorio de ARIA, **manda el repositorio de ARIA**: detente, anota la diferencia en `CAMBIOS-RESPECTO-A-ARIA.md` y sigue la convención real.

---

## 0. Qué se construye y por qué

Una **maqueta funcional local** del *Sistema de validación multimodal de contenido* para la aceleradora ARIA, construida sobre la **carcasa** de su plataforma real, `aria-comando-central` (AIOS — Command Center).

La maqueta reproduce el armazón visual de la plataforma (barra lateral por departamentos, cabecera con pestañas, tema oscuro, tipografía y tokens de marca) y agrega **una sección nueva, `validador`, dentro del departamento Marketing**, donde se construye la herramienta de forma funcional.

**Alcance de esta maqueta (decidido):**

- Funcional con Claude para **imagen y texto** (copy, texto sobre la imagen y guion o transcripción pegada a mano).
- Base de datos **PostgreSQL 17 en Docker**, igual que ARIA.
- Despliegue **solo local**.
- El análisis de **video** (FFmpeg, Whisper) **no** se implementa ahora; se deja la arquitectura preparada (ver sección 11).

**Lo que la maqueta debe demostrar**, porque así se comprometió en el proyecto:

1. Cada pieza se evalúa en **dos ejes**: conformidad con el **criterio de marca** y con las **políticas de Meta**.
2. Primero una **capa determinística** (reglas exactas) y después un **motor de análisis con Claude**.
3. Cada hallazgo es **trazable**: regla, evidencia, ubicación, severidad y confianza.
4. El resultado se consolida en un **nivel de riesgo por pieza**.
5. Existe un **corpus de reglas versionado**: cada análisis guarda la versión con la que se hizo.
6. Existe un **registro histórico** con la **retroalimentación** del jefe del área (marcar hallazgos como correctos o incorrectos).
7. El jefe del área puede **definir restricciones de marca** (lo que la marca no debe comunicar).
8. Se pueden medir los **KPIs** del proyecto: detección, falsas alertas, trazabilidad, tiempo y costo por pieza.

---

## 1. Principio rector: transferibilidad

Todo lo que se construya debe poder **copiarse a `aria-comando-central` sin reescribirse**. Reglas obligatorias:

1. **Mismo stack y mismas versiones exactas** que ARIA (sección 2). Ninguna dependencia nueva sin justificarla en `CAMBIOS-RESPECTO-A-ARIA.md`.
2. **Mismas convenciones**: código, identificadores, comentarios y nombres de archivo en **español**, con el mismo estilo de ARIA. Antes de crear un archivo, busca en ARIA un archivo análogo y sigue su forma.
3. **La sección del validador vive en sus propias carpetas**, sin mezclarse con la carcasa:
   - `components/views/ValidadorView.jsx`
   - `components/validador/`
   - `lib/validador/`
   - `app/api/validador/`
   - `app/validador.css`
   - `db/migraciones/079_el_validador_de_contenido.sql` (siguiente número libre de ARIA; verifícalo)
4. **La carcasa copiada de ARIA no se modifica**, salvo lo mínimo para que corra sin la infraestructura de la empresa. Cada modificación lleva el comentario `// MAQUETA: <motivo>` y queda listada en `CAMBIOS-RESPECTO-A-ARIA.md`.
5. **Lo que en ARIA viene de su infraestructura se aísla en un solo punto**, para cambiarlo al integrar. Caso principal: la llave de Claude. En ARIA es **por organización** y vive en la base; en la maqueta sale de `.env.local`, leída solo desde `lib/validador/llave.ts`.

---

## 2. Stack obligatorio

Tomado de `package.json`, `.nvmrc` y `docker-compose.yml` de ARIA. **Copia las versiones exactas, sin `^` ni `~`.**

| Pieza | Versión | Notas |
|---|---|---|
| Node | 24.14.1 | `.nvmrc`; `engines` `>=24.14.1 <25` |
| Next.js | 16.3.1 | App Router; no existe `next lint` en Next 16 |
| React / React DOM | 19.2.8 | |
| TypeScript | 5.9.3 | Copia `tsconfig.json` de ARIA tal cual (strict, alias `@/*`) |
| Tailwind CSS | 4.3.3 | Con `@tailwindcss/postcss` 4.3.3; ARIA usa el **prefijo `tw:`** |
| PostgreSQL | 17 (`postgres:17-alpine`) | Mismo esquema de `docker-compose.yml` |
| Kysely | 0.29.5 | Constructor de consultas |
| pg | 8.23.0 | Con `@types/pg` 8.23.1 |
| Tipografías | Geist y Geist Mono | Por `next/font/google`, como en `app/layout.js` |
| Claude | API de Messages por `fetch` | **Sin SDK**, igual que ARIA (`lib/agentes/proveedor.ts`) |

**Dependencias nuevas permitidas** (anotarlas en `CAMBIOS-RESPECTO-A-ARIA.md`):

- `image-size`, para leer ancho y alto de la imagen sin procesarla. Fijar una versión exacta publicada hace más de 14 días.
- LanguageTool como **servicio en Docker**, no como dependencia de npm (sección 6.3).

**Prohibido:** SDK de Anthropic, librerías de UI (shadcn, MUI, etc.), ORMs distintos de Kysely, y cambiar las versiones de la tabla.

---

## 3. Fase 0 — Repositorio y carcasa

### 3.1 Preparar

```bash
# 1. ARIA como referencia de solo lectura, FUERA del repo nuevo
git clone https://github.com/Instalacionesaria/aria-comando-central.git ../aria-referencia

# 2. El repo nuevo
mkdir aria-validador-multimodal && cd aria-validador-multimodal
git init
```

Crear el repositorio remoto `aria-validador-multimodal` en GitHub como **privado**.

### 3.2 Qué copiar de ARIA

Copiar **como punto de partida** y luego podar lo que no compile:

- Configuración: `package.json` (renombrar `name` a `aria-validador-multimodal`), `package-lock.json`, `.nvmrc`, `.npmrc`, `tsconfig.json`, `next.config.mjs` (quitar `outputFileTracingIncludes`, que es de Fundaciones), `postcss.config.mjs`, `.gitignore`, `.gitattributes`.
- Raíz de la app: `app/layout.js`, `app/globals.css`, `app/tema.ts`, `app/temas.css`, `app/aios.css`, `app/armazon.css`, `app/departamentos.css` y las hojas que `globals.css` importe y la carcasa necesite.
- Marca: `public/brand/` completo (tokens, logos, mascota) y `app/brand/tokens-scope.css`.
- Carcasa: `components/CommandCenter.jsx`, `TopBar.jsx`, `Nav.jsx`, `IconSprite.jsx`, `CabeceraDeDepartamento.jsx`, `MenuDeUsuario.jsx`, `SelectorDeEmpresa.jsx`, `ConsultaAlCerebro.jsx`.
- Lógica de la carcasa: `lib/aios/` (`index.js`, `shell.js`), `lib/vista.ts`, `lib/menu.ts`, `lib/reloj.ts`, `lib/autorizacion/departamentos.ts`, `lib/autorizacion/secciones.ts` y lo mínimo que estos importen.
- Contexto de sesión: `app/sesion-contexto.tsx` (la **interfaz** se conserva intacta).
- Base: `docker-compose.yml` y el patrón de `scripts/db.mjs` y `lib/datos/` como referencia.

**No copiar:** el resto de `components/<seccion>/`, `components/views/*` (salvo como referencia), `app/api/*` existente, `db/migraciones/*` de ARIA, `pruebas/`, `docs/`, `proxy.ts`, `app/guardia.tsx`, `app/entrar/`, `aios-command-center_1.html`, `vercel.json`.

### 3.3 Sesión de maqueta (reemplaza login y permisos)

En ARIA, el menú llega del servidor tras autenticar (`app/guardia.tsx`, `proxy.ts`, `lib/autorizacion/*`). En la maqueta:

1. Crear `app/sesion-de-maqueta.ts`, que construya un objeto con **exactamente la forma** de `DatosDeSesion` de `app/sesion-contexto.tsx`.
2. **Construirlo con las funciones reales de ARIA** (`menuVisible()`, `menuPorDepartamentos()`, `seccionDeArranque()` o sus equivalentes en `lib/autorizacion/`) aplicadas sobre una persona ficticia con todas las secciones concedidas. No escribir el menú a mano: así la forma de los datos es idéntica a la real.
3. `app/page.js` envuelve `CommandCenter` con el proveedor del contexto usando esa sesión, en lugar de `Guardia`. Marcar con `// MAQUETA:`.
4. Persona y empresa ficticias: **Gabriel Iglesias**, rol *jefe del área de marketing*, empresa **ARIA High Ticket**.
5. La sección de arranque es `validador`.

### 3.4 Las demás secciones

Las entradas del menú de las otras áreas **se ven** en la barra lateral, para que la carcasa se vea completa, pero al abrirlas muestran una vista de relleno:

- Crear `components/views/VistaDeMaqueta.jsx`: el nombre de la sección y el texto *«Esta sección pertenece a la plataforma ARIA y no forma parte de esta maqueta.»*, con los estilos existentes.
- En el mapa `VISTAS` de `CommandCenter.jsx`, todas las claves que no sean `validador` apuntan a `VistaDeMaqueta`. Marcar con `// MAQUETA:`.
- Cualquier import de la carcasa que traiga lógica de otras secciones (por ejemplo, en `Nav.jsx`: cerebro, scrapers, traspaso de agentes) se reemplaza por un **stub mínimo** en `lib/maqueta/stubs/` con la misma firma, marcado con `// MAQUETA:`.

### 3.5 Registrar la sección `validador`

Igual que cualquier sección de ARIA, en sus **cuatro lugares**:

1. `lib/autorizacion/secciones.ts`: clave `validador`, nombre **«Validador de contenido»**, en el grupo correspondiente, con un ícono existente del `IconSprite` (o uno nuevo con el mismo trazo).
2. `lib/autorizacion/departamentos.ts`: entrada en el departamento **`marketing`**, después de `creative`, con tres pestañas:
   - `nuevo` — «Nuevo análisis»
   - `historial` — «Historial»
   - `reglas` — «Reglas de marca»
3. `components/CommandCenter.jsx`: `validador: ValidadorView` en el mapa `VISTAS`.
4. `components/views/ValidadorView.jsx`: la sección con `id="v-validador"` (`lib/aios/shell.js` abre las vistas por `'v-' + clave`), clases `view` / `view on` y el patrón de `CreativeView.jsx`. Las pestañas usan el mismo mecanismo que las secciones con pestañas de ARIA (`usarPestanaDibujada`, `lib/vista.ts`).

### 3.6 Puertos y Docker (para convivir con ARIA en la misma máquina)

- `npm run dev` en el **puerto 3200** (ARIA usa 3100).
- PostgreSQL en `127.0.0.1:55433` (ARIA usa 55432), contenedor `aria_validador_base`, base `validador`.
- Servicio LanguageTool en `127.0.0.1:8010` (sección 6.3).

### 3.7 Registro de cambios

Crear `CAMBIOS-RESPECTO-A-ARIA.md` con una tabla: archivo, cambio, motivo, cómo revertirlo al integrar. Mantenerlo al día en todas las fases.

### Criterios de aceptación — Fase 0

- [ ] `npm install` y `npm run dev` levantan la app en `http://localhost:3200` sin errores.
- [ ] La carcasa se ve **idéntica** a ARIA: barra lateral por departamentos, cabecera con pestañas, logo, tema oscuro y tipografía Geist.
- [ ] La app abre directo en **Marketing › Validador de contenido**, con sus tres pestañas.
- [ ] Las demás entradas abren la vista de relleno sin errores en consola.
- [ ] `npx tsc --noEmit` pasa.
- [ ] `CAMBIOS-RESPECTO-A-ARIA.md` lista cada `// MAQUETA:`.

---

## 4. Fase 1 — Base de datos

### 4.1 Esquema

Esquema propio `validador`, en **una migración**: `db/migraciones/079_el_validador_de_contenido.sql`. Todas las tablas llevan `organizacion_id` porque el diseño es **multimarca**.

| Tabla | Propósito | Campos principales |
|---|---|---|
| `validador.marcas` | Marcas por organización | `id`, `organizacion_id`, `nombre`, `creada_en` |
| `validador.versiones_del_corpus` | Cada versión del corpus | `id`, `marca_id`, `numero`, `nota`, `creada_en` |
| `validador.reglas` | Reglas de **una** versión (copia completa por versión) | `id`, `version_id`, `codigo`, `eje` (`marca`/`plataforma`), `categoria`, `descripcion`, `criterio_verificable`, `ejemplo_cumple`, `ejemplo_incumple`, `severidad` (`alta`/`media`/`baja`), `tipo_de_verificacion` (`deterministica`/`modelo`), `fuente`, `vigente_desde`, `origen` (`corpus`/`restriccion_del_jefe`) |
| `validador.analisis` | Cada pieza analizada | `id`, `organizacion_id`, `marca_id`, `version_id`, `tipo_de_pieza` (`imagen`/`texto`), `formato_destino` (`feed`/`historia`/`reel`), `nombre_del_archivo`, `ruta_del_archivo`, `ancho`, `alto`, `peso_en_bytes`, `copy`, `guion`, `nivel_de_riesgo`, `modelo`, `tokens_de_entrada`, `tokens_de_salida`, `tokens_de_cache`, `costo_usd`, `duracion_ms`, `creado_en` |
| `validador.hallazgos` | Cada hallazgo de un análisis | `id`, `analisis_id`, `regla_id`, `codigo_de_regla`, `eje`, `severidad`, `evidencia`, `ubicacion`, `confianza` (0 a 1), `sugerencia`, `origen` (`deterministica`/`modelo`/`revision`) |
| `validador.retroalimentacion` | Juicio del jefe del área | `id`, `hallazgo_id`, `veredicto` (`correcto`/`incorrecto`), `comentario`, `creada_en` |

Reglas de diseño:

- **Versionado por copia completa**: cambiar o agregar una regla crea una versión nueva con todas las reglas copiadas. Nunca se edita una regla de una versión existente. Así cada análisis queda atado a las reglas exactas con que se evaluó.
- Índices en `analisis(organizacion_id, creado_en)` y `hallazgos(analisis_id)`.
- Las imágenes se guardan en `almacen/` (ignorado por git); la tabla guarda la ruta.

### 4.2 Scripts y sembrado

- Replicar el patrón de ARIA (`scripts/db.mjs` con `--env-file-if-exists=.env.local`): `db:migrar`, `db:sembrar`, `db:reset`.
- El sembrado crea: organización **ARIA**, marca **ARIA**, versión **1** del corpus con las **reglas semilla** de la sección 10.

### Criterios de aceptación — Fase 1

- [ ] `docker compose up -d` levanta PostgreSQL 17 en el puerto 55433.
- [ ] `npm run db:reset` deja la base migrada y sembrada.
- [ ] La versión 1 del corpus contiene las reglas semilla.
- [ ] Los tipos de Kysely del esquema `validador` existen y compilan.

---

## 5. Fase 2 — El flujo principal (motor)

### 5.1 Rutas del API

Mismo estilo que los *route handlers* de `app/api/*` de ARIA, con validación de entrada y errores en español.

| Método y ruta | Qué hace |
|---|---|
| `POST /api/validador/analisis` | Recibe `multipart/form-data`: `archivo` (imagen, opcional), `copy`, `guion` (opcional), `formato_destino`. Ejecuta el flujo completo y devuelve el análisis con sus hallazgos. |
| `GET /api/validador/analisis` | Historial paginado. |
| `GET /api/validador/analisis/[id]` | Detalle de un análisis. |
| `POST /api/validador/hallazgos/[id]/retroalimentacion` | Guarda `correcto` o `incorrecto`, con comentario opcional. |
| `GET /api/validador/reglas` | Reglas de la versión vigente. |
| `POST /api/validador/reglas` | Agrega una restricción del jefe del área y **crea una versión nueva** del corpus. |
| `GET /api/validador/resumen` | Errores recurrentes de los últimos 30 días y porcentaje de piezas sin hallazgos. |

Una pieza debe tener al menos imagen, copy o guion.

### 5.2 Módulos de `lib/validador/`

| Archivo | Responsabilidad |
|---|---|
| `llave.ts` | **Único** lugar que lee `ANTHROPIC_API_KEY`. En ARIA se reemplazará por la llave de la organización. |
| `modelos.ts` | Constantes, como `lib/agentes/modelos.ts` de ARIA: `MODELO_DEL_VALIDADOR = 'claude-sonnet-5-5'` y `MODELO_DE_REVISION_DEL_VALIDADOR = 'claude-opus-5-5'`. **Constantes, no variables de entorno**, siguiendo la regla de ARIA. |
| `proveedor.ts` | Importa o replica `DIRECCION_DE_LA_API` y `VERSION_DE_LA_API` de `lib/agentes/proveedor.ts` de ARIA. |
| `corpus.ts` | Leer la versión vigente, crear versiones, filtrar reglas por eje, tipo y aplicabilidad a la pieza. |
| `deterministicas.ts` | Las reglas `deterministica` (5.3). |
| `lenguaje.ts` | Cliente de LanguageTool (5.3). |
| `motor.ts` | La llamada a Claude (5.4). |
| `revision.ts` | La segunda revisión con Opus (5.5). |
| `riesgo.ts` | Consolidación del nivel de riesgo (5.6). |
| `costos.ts` | Precios y cálculo del costo por análisis (5.7). |
| `flujo.ts` | Orquesta todo: ingreso → determinísticas → motor → revisión → riesgo → registro. Mide `duracion_ms`. |

### 5.3 Capa determinística

Se ejecuta **antes** de Claude. Cada hallazgo cita su regla con `origen = 'deterministica'` y `confianza = 1`.

- **Formato** (`FMT-01` a `FMT-04` de la sección 10): relación de aspecto según el formato destino, resolución mínima, peso máximo y longitud del copy. Dimensiones con `image-size`.
- **Ortografía** (`MARCA-ORT-01`) sobre el copy y el guion: `POST {LANGUAGETOOL_URL}/v2/check` con `language=es`. Cada coincidencia es un hallazgo con el fragmento como evidencia y la corrección sugerida.
- Si LanguageTool no responde, el análisis **continúa** y deja una advertencia visible («Ortografía no verificada»). Nunca se bloquea el flujo por un servicio auxiliar.

LanguageTool en `docker-compose.yml`:

```yaml
  lenguaje:
    image: erikvl87/languagetool
    container_name: aria_validador_lenguaje
    ports:
      - "127.0.0.1:8010:8010"
```

### 5.4 Motor de análisis con Claude

- `fetch` a `DIRECCION_DE_LA_API` con las cabeceras `x-api-key`, `anthropic-version: VERSION_DE_LA_API` y `content-type: application/json`. Replicar el manejo de errores y reintentos del transporte de ARIA (`lib/agentes/llamada.ts`).
- **Contenido del mensaje**: la imagen como bloque `image` en base64 (si hay), el copy, el guion y el formato destino.
- **Instrucciones de sistema** en dos bloques:
  1. El rol: revisor de conformidad de contenido para la marca ARIA, que solo reporta hallazgos sustentados en una regla del corpus y con evidencia literal.
  2. Las **reglas aplicables** de la versión vigente (solo las de tipo `modelo`), en JSON. Este bloque lleva `cache_control: { type: 'ephemeral' }` para aprovechar el **caché de instrucciones**, porque el corpus se repite en cada pieza.
- **Salida estructurada con una herramienta**: definir la herramienta `registrar_hallazgos` y forzarla con `tool_choice: { type: 'tool', name: 'registrar_hallazgos' }`. Esquema de cada hallazgo:

```json
{
  "codigo_de_regla": "META-PUB-01",
  "eje": "plataforma",
  "severidad": "alta",
  "evidencia": "fragmento literal o descripción precisa de lo visto en la imagen",
  "ubicacion": "copy | guion | imagen | texto_en_imagen",
  "confianza": 0.0,
  "sugerencia": "cómo corregirlo"
}
```

- **Validación del resultado**: descartar todo hallazgo cuyo `codigo_de_regla` no exista en la versión vigente (protege la trazabilidad, KPI K3) y registrar la cantidad descartada.
- Guardar `usage.input_tokens`, `usage.output_tokens` y los tokens de caché de la respuesta.

### 5.5 Revisión de casos dudosos

Si algún hallazgo del motor tiene `confianza < 0,6` (constante `UMBRAL_DE_REVISION` en `revision.ts`), repetir el análisis **solo con las reglas implicadas** usando `MODELO_DE_REVISION_DEL_VALIDADOR`. Los hallazgos confirmados quedan con `origen = 'revision'`; los no confirmados se descartan. Sumar los tokens y el costo de esta llamada al análisis.

### 5.6 Nivel de riesgo

| Condición | Nivel |
|---|---|
| Al menos un hallazgo de severidad alta | **ALTO** |
| Sin altas y al menos uno de severidad media | **MEDIO** |
| Solo hallazgos de severidad baja | **BAJO** |
| Ningún hallazgo | **SIN HALLAZGOS** |

### 5.7 Costos

`costos.ts` con los precios como constantes **documentadas con su fuente y fecha**:

```ts
// Fuente: Anthropic, Models overview (consultado el 4 de octubre de 2026).
// Precios en US$ por millón de tokens.
export const PRECIOS = {
  'claude-sonnet-5-5': { entrada: 2, salida: 10 },
  'claude-opus-5-5': { entrada: 4, salida: 20 },
};
export const TIPO_DE_CAMBIO_REFERENCIAL = 3.40; // S/ por US$, supuesto del presupuesto
```

Si los tokens de caché tienen tarifa distinta, verificarla en la documentación oficial de Anthropic antes de implementarla y citar la fuente en el comentario.

### Criterios de aceptación — Fase 2

- [ ] `POST /api/validador/analisis` con una imagen y un copy devuelve hallazgos estructurados y un nivel de riesgo.
- [ ] Todo hallazgo cita un código de regla existente en la versión usada.
- [ ] El análisis queda guardado con su `version_id`, tokens, costo y duración.
- [ ] Sin LanguageTool, el análisis termina igual y muestra la advertencia.
- [ ] Un copy con «gana dinero rápido sin esfuerzo» produce un hallazgo `META-PUB-01` de severidad alta.

---

## 6. Fase 3 — La interfaz

La referencia visual es la maqueta aprobada en el proyecto (**Figura 3** del informe): se adjunta como `docs/figura3-maqueta-validador.png` y `docs/figura3-maqueta-validador.html`. **Reconstruirla con los componentes y tokens de ARIA**, no copiar su HTML.

### 6.1 Pestaña «Nuevo análisis»

- **Panel de ingreso** en una fila: zona para arrastrar una imagen, campo de copy, campo de guion o transcripción (opcional), selector de formato destino (feed, historia, reel) y botón **«Analizar pieza»**.
- El campo de enlace de Google Drive aparece **deshabilitado** con la etiqueta «Próximamente» (sección 11).
- Estados: vacío, analizando (con indicador de progreso y los pasos «Verificaciones», «Análisis», «Consolidando»), resultado y error.
- **Resultado**: vista previa de la pieza con sus metadatos (nombre, dimensiones, formato), insignia de **nivel de riesgo**, conteo de hallazgos por eje, versión del corpus usada, tiempo y costo del análisis.
- **Tarjeta por hallazgo**: barra de color por severidad, etiqueta de eje (MARCA o PLATAFORMA), título de la regla, código, severidad, ubicación, evidencia entre comillas, sugerencia, y los botones **«Correcto»** e **«Incorrecto»** (Fase 4). Los determinísticos se rotulan «verificación determinística».

### 6.2 Panel lateral (visible en las tres pestañas)

- **Errores recurrentes** de los últimos 30 días (de `/api/validador/resumen`).
- **Primera revisión**: porcentaje de piezas sin hallazgos en el mes, con barra.
- **Restricciones de marca**: las reglas con `origen = 'restriccion_del_jefe'`, con el enlace «Agregar restricción», que lleva a la pestaña de reglas.

### 6.3 Estilos

- Todo en `app/validador.css`, importado desde `app/globals.css` con el mismo esquema de capas (`layer(components)`).
- **Solo tokens de ARIA** (variables CSS de `public/brand/tokens.css` y `app/temas.css`); ningún color escrito a mano.
- Si se usan utilidades de Tailwind, con el prefijo `tw:` como en ARIA.
- Debe verse bien desde 1280 px de ancho.

### Criterios de aceptación — Fase 3

- [ ] El flujo completo funciona desde la interfaz, sin herramientas externas.
- [ ] La pantalla se reconoce como la Figura 3 y como parte de ARIA.
- [ ] No hay colores escritos a mano en `app/validador.css`.

---

## 7. Fase 4 — Registro, retroalimentación y reglas

### 7.1 Retroalimentación

- «Correcto» o «Incorrecto» en cada hallazgo, con un comentario opcional al marcar «Incorrecto». Se puede cambiar el veredicto.
- Un hallazgo con retroalimentación muestra su estado.

### 7.2 Pestaña «Historial»

- Tabla de análisis: fecha, miniatura, formato, nivel de riesgo, hallazgos por eje, versión del corpus y estado de revisión (cuántos hallazgos tienen veredicto).
- Filtros: nivel de riesgo y rango de fechas. Al abrir uno se ve su detalle completo.

### 7.3 Pestaña «Reglas de marca»

- Lista de la versión vigente agrupada por eje, con código, descripción, severidad, tipo de verificación, fuente y vigencia.
- Formulario **«Agregar restricción»**: descripción, ejemplo de lo que no debe decirse y severidad. Al guardar se **crea una versión nueva** del corpus con `origen = 'restriccion_del_jefe'` y `fuente = 'Jefe del área de contenido y marketing'`.
- Selector de versión para consultar las anteriores (solo lectura).
- Las reglas con más hallazgos marcados «Incorrecto» se señalan como **candidatas a ajuste**: es el mecanismo de ajuste manual comprometido en el proyecto.

### Criterios de aceptación — Fase 4

- [ ] La retroalimentación persiste y se refleja en el historial.
- [ ] Agregar una restricción crea la versión N+1, y los análisis nuevos la usan.
- [ ] Los análisis antiguos siguen mostrando la versión con la que se hicieron.

---

## 8. Fase 5 — Evaluación y KPIs

Script `npm run validador:evaluar` que mide los indicadores del proyecto sobre un conjunto etiquetado.

### 8.1 Formato del conjunto

```
evaluacion/
  piezas/
    001.jpg
    001.json
    002.json        # pieza solo de texto, sin imagen
```

```json
{
  "id": "001",
  "formato_destino": "feed",
  "copy": "…",
  "guion": "…",
  "conforme": false,
  "reglas_esperadas": ["META-PUB-01", "MARCA-TONO-02"],
  "nota": "No conformidad introducida de forma controlada"
}
```

### 8.2 Cálculo y salida

Analizar cada pieza con el flujo real y escribir `evaluacion/resultados/AAAA-MM-DD.md` con:

| KPI | Fórmula | Meta |
|---|---|---|
| K1 Tasa de detección | No conformidades críticas detectadas / presentes | ≥ 75% |
| K2 Tasa de falsas alertas | Piezas conformes con al menos un hallazgo / piezas conformes | ≤ 25% |
| K3 Trazabilidad | Hallazgos con regla y evidencia válidas / hallazgos emitidos | 100% |
| K4 Tiempo por pieza | Promedio y máximo de `duracion_ms` | ≤ 60 s |
| K5 Costo por pieza | Promedio de `costo_usd` × tipo de cambio | ≤ S/ 0,25 |

Incluir el desglose de K1 por categoría de regla y la lista de piezas con errores, para revisar con el jefe del área. **Crítica** = severidad alta.

### Criterios de aceptación — Fase 5

- [ ] El script corre de punta a punta sobre al menos 10 piezas de ejemplo incluidas en el repositorio.
- [ ] El informe muestra K1 a K5 con sus metas y si se cumplen.

---

## 9. Fase 6 — Opcional para la demo: enlace de Google Drive

Solo si las fases anteriores están completas. Aceptar un enlace público de Google Drive de **una imagen**, extraer el identificador del archivo, descargarlo por la URL pública de descarga y continuar con el flujo normal. Si el archivo no es público o no es una imagen, mostrar un error claro.

---

## 10. Corpus semilla (versión 1)

Reglas iniciales para la demo, derivadas de las entrevistas al área (Anexo B del informe) y de las categorías de las políticas publicitarias de Meta. **Son una semilla, no el corpus final**: el proyecto contempla al menos 40 reglas validadas con el jefe del área. Las reglas de Meta y los límites numéricos deben **verificarse contra las fuentes oficiales** antes de la demo y su `fuente` debe actualizarse con la URL exacta.

| Código | Eje | Tipo | Severidad | Descripción |
|---|---|---|---|---|
| MARCA-TONO-01 | marca | modelo | media | El mensaje transmite **autoridad**: demuestra conocimiento de los problemas del cliente y posiciona a ARIA como referente que el cliente busca. |
| MARCA-TONO-02 | marca | modelo | media | No transmitir que la marca persigue o necesita clientes: urgencia artificial, súplica o escasez forzada (ej.: «¡Escríbenos ya!», «quedan pocos cupos»). |
| MARCA-TONO-03 | marca | modelo | media | No usar los miedos del cliente como gancho principal; es un enfoque descartado por la marca. |
| MARCA-POS-01 | marca | modelo | media | Coherencia con el posicionamiento de alto valor: no usar descuentos ni precio bajo como argumento. *Derivada de G7; validar con el jefe del área.* |
| MARCA-TEND-01 | marca | modelo | baja | No replicar tendencias, formatos ni estilos virales del momento. |
| MARCA-FORM-01 | marca | modelo | baja | Estilo formal y profesional en el texto y en la composición. |
| MARCA-COPY-01 | marca | modelo | media | El copy es coherente con el mensaje de la pieza (imagen o guion). |
| MARCA-ORT-01 | marca | deterministica | baja | Ortografía y gramática en copy y guion (LanguageTool). El texto dentro de la imagen lo revisa el modelo. |
| META-PUB-01 | plataforma | modelo | alta | Promesas de ingresos o resultados poco realistas (ej.: «gana dinero rápido sin esfuerzo», «duplica tu facturación en 30 días»). |
| META-PUB-02 | plataforma | modelo | alta | Afirmaciones que aluden a atributos personales del destinatario (ej.: «¿Tu agencia está quebrando?»). |
| META-PUB-03 | plataforma | modelo | media | Contenido sensacionalista o engañoso: afirmaciones exageradas o ganchos que no se corresponden con la oferta. |
| META-PUB-04 | plataforma | modelo | media | Garantías absolutas o comparaciones de «antes y después» no sustentadas. |
| META-PUB-05 | plataforma | modelo | alta | Lenguaje discriminatorio o que excluye a grupos de personas. |
| FMT-01 | plataforma | deterministica | media | Relación de aspecto según el formato destino: feed 1:1 o 4:5; historia y reel 9:16. |
| FMT-02 | plataforma | deterministica | baja | Resolución mínima: lado corto de al menos 1080 px. |
| FMT-03 | plataforma | deterministica | baja | Peso de imagen dentro del máximo admitido por Meta. *Verificar el valor oficial.* |
| FMT-04 | plataforma | deterministica | baja | Texto principal recomendado dentro del largo visible antes de «Ver más». *Verificar el valor oficial.* |

---

## 11. Fuera de alcance de esta maqueta, con la puerta preparada

| Funcionalidad | Por qué no ahora | Cómo queda preparado |
|---|---|---|
| Análisis de video (metadatos, fotogramas, transcripción con Whisper) | Requiere el servicio en contenedor con FFmpeg | `tipo_de_pieza` admite el valor `video` en el modelo de datos; el flujo tiene un punto de extensión documentado en `flujo.ts`; el campo de guion permite analizar el mensaje hablado de un reel pegando su transcripción. |
| Enlace de Google Drive para cualquier archivo | Opcional (Fase 6) | Campo visible y deshabilitado. |
| Login, roles y permisos | Son de ARIA | Sesión de maqueta con la misma forma de datos. |
| Llave de Claude por organización | Es de ARIA | Aislada en `lib/validador/llave.ts`. |
| Despliegue en Vercel | Solo local por ahora | Misma configuración de Next que ARIA. |

---

## 12. Entorno y scripts

`.env.example`:

```
DATABASE_URL=postgres://postgres:postgres_local@127.0.0.1:55433/validador
ANTHROPIC_API_KEY=
LANGUAGETOOL_URL=http://127.0.0.1:8010
```

Scripts de `package.json` (además de los de ARIA que se conserven):

```
"dev": "next dev -p 3200",
"db:migrar", "db:sembrar", "db:reset",
"validador:evaluar"
```

`README.md` del repositorio con: requisitos (Node 24.14.1, Docker), arranque en cinco comandos, cómo correr la evaluación, y un enlace a `CAMBIOS-RESPECTO-A-ARIA.md`.

---

## 13. Lista de verificación final para la demo

- [ ] Arranque limpio en una máquina nueva siguiendo solo el `README.md`.
- [ ] La carcasa se ve como ARIA y abre en el validador.
- [ ] Flujo completo con imagen y copy: hallazgos de marca y de plataforma, nivel de riesgo, evidencia y regla en cada hallazgo.
- [ ] Una pieza conforme termina en **SIN HALLAZGOS** o **BAJO**.
- [ ] Retroalimentación, historial y restricciones de marca funcionando.
- [ ] Agregar una restricción cambia el resultado de un análisis nuevo.
- [ ] Informe de evaluación generado con K1 a K5.
- [ ] `CAMBIOS-RESPECTO-A-ARIA.md` completo.
- [ ] `npx tsc --noEmit` sin errores.

---

## 14. Guía de integración futura a ARIA (resumen)

1. Copiar `components/views/ValidadorView.jsx`, `components/validador/`, `lib/validador/`, `app/api/validador/`, `app/validador.css` y la migración, renumerándola al siguiente número libre.
2. Registrar la sección en los cuatro lugares de la sección 3.5 y conceder la sección `validador` a los roles que correspondan.
3. Reemplazar `lib/validador/llave.ts` por la lectura de la llave de la organización y mover las constantes de modelo a `lib/agentes/modelos.ts`, agregándolas a la prueba de modelos válidos de ARIA.
4. Adaptar las consultas al aislamiento por organización de ARIA (`lib/datos/contexto.ts`, `app.org_id`).
5. Revertir cada punto de `CAMBIOS-RESPECTO-A-ARIA.md`.
