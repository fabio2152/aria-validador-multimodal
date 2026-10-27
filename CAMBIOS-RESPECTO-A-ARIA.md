# Cambios respecto a ARIA

Todo lo que esta maqueta cambió de `aria-comando-central` y todo lo que hizo distinto de las instrucciones
(`docs/INSTRUCCIONES-aria-validador-multimodal.md`). Cada cambio en la carcasa lleva el comentario
`// MAQUETA: <motivo>` en el código.

**Base de la copia:** `Instalacionesaria/aria-comando-central`, rama `main`, commit `88fddf9` (2026-10-18),
clonado en `../aria-referencia` como referencia de sólo lectura.

> La copia local de ARIA en `C:\PROYECTOS\ARIA\Comando Central` tiene **64 commits sin subir** (llega a la
> migración 106). La maqueta se basa en lo publicado en GitHub, como piden las instrucciones. Al integrar,
> comparar contra la rama que esté vigente en ese momento.

## 1. Cambios en la carcasa copiada (`// MAQUETA:`)

| Archivo | Cambio | Motivo | Cómo revertirlo al integrar |
|---|---|---|---|
| `package.json` | `name` → `aria-validador-multimodal`; `dev`/`start` en el puerto 3200; sin `jspdf` ni `playwright`; sin los scripts `test`, `compuerta`, `paridad`, `db:arranque`, `db:verificar`; agrega `image-size` 2.0.4 y `validador:evaluar`. | Convivir con ARIA (3100) y no arrastrar dependencias de secciones que no viajan. | No se copia: en ARIA se agrega sólo `image-size` (versión exacta) y el script `validador:evaluar`. |
| `next.config.mjs` | Sin `outputFileTracingIncludes`. | Era de Fundaciones, que no está en la maqueta. | No se copia. |
| `docker-compose.yml` | Contenedor `aria_validador_base`, base `validador`, puerto `127.0.0.1:55433`; servicio nuevo `lenguaje` (LanguageTool) en `127.0.0.1:8010`. | Convivir con `aria_base` (55432) en la misma máquina. | Agregar sólo el servicio `lenguaje` al `docker-compose.yml` de ARIA. |
| `.env.example` | Tres variables: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `LANGUAGETOOL_URL`. | La maqueta tiene una sola cadena de conexión y una llave en el entorno. | En ARIA se agrega sólo `LANGUAGETOOL_URL`. La llave NO va al entorno (ver `lib/validador/llave.ts`). |
| `.gitignore` | Agrega `almacen/`. | Las piezas subidas no se versionan. | En ARIA, las piezas van al almacén de la organización. |
| `app/page.js` | `'use client'` y `ProveedorDeSesion` con `SESION_DE_MAQUETA` en lugar de `<Guardia>`. | No hay login. | Volver a `<Guardia><CommandCenter /></Guardia>`. |
| `app/globals.css` | Importa `./validador.css` en `layer(components)`, antes de `temas.css`. | La hoja de la sección nueva. | Se conserva igual. |
| `components/CommandCenter.jsx` | El mapa `VISTAS` apunta todo lo que no es `validador` a `vistaDeMaqueta(clave)`; sólo importa `ValidadorView`. Sin `<ConsultaAlCerebro />` (la caja «Pregúntale al cerebro»): la fila `consulta` de la rejilla mide 0. | Las demás pantallas no viajan, y el cerebro es de ARIA. | Restaurar los imports, el mapa de ARIA y `<ConsultaAlCerebro />`, y agregar `validador: ValidadorView`. |
| `components/Nav.jsx` | `ConversacionesDeLaBarra`, `ReunionDeLaBarra`, `pedirHiloDelInicio`, `leerTrabajosEnVuelo` y `pestanaQueLoRetoma` vienen de `lib/maqueta/stubs/`. | Son del cerebro, del traspaso de agentes y de Tools. | Restaurar los imports originales. |
| `components/CabeceraDeDepartamento.jsx` | `usarComentario` viene de `lib/maqueta/stubs/`. | El comentario lo sirve el cerebro. | Restaurar el import. |
| `components/ConsultaAlCerebro.jsx` | No se copia (ver `CommandCenter.jsx`). | Se pidió quitar la caja de la maqueta. | Viene con la carcasa de ARIA. |
| `app/sesion-de-maqueta.ts` *(nuevo)* | Arma `DatosDeSesion` con `menuVisible()`, `menuPorDepartamentos()` y `seccionesConAlcance()` reales sobre Gabriel Iglesias (todas las capacidades) en ARIA High Ticket; el arranque es `validador`. | Reemplaza `GET /api/auth/sesion`. | Borrar. |
| `components/views/VistaDeMaqueta.jsx` *(nuevo)* | La vista de relleno, con el `id="v-<clave>"` de cada sección. | Las otras áreas se ven en la barra pero no viajan. | Borrar. |
| `lib/maqueta/stubs/*` *(nuevo)* | Cinco stubs con la misma firma que el original (los que importan `Nav.jsx` y `CabeceraDeDepartamento.jsx`). | Ver arriba. | Borrar la carpeta. |
| `lib/validador/base.ts` | Una sola `DATABASE_URL` y `organizacionActual()` fija. | Sin roles ni aislamiento por organización. | Usar el cliente del inquilino (`lib/datos/capa.ts`) y `conOrganizacion()` (`lib/datos/contexto.ts`). |
| `lib/validador/migrador.ts`, `scripts/db.mjs` | Corredor reducido (`migrar`, `sembrar`, `reset`) con el mismo patrón (`Migrator` de Kysely, esquema `migraciones`). | Sin roles `migrador`/`inquilino`, sin `db/arranque/`. | No se copian: la migración entra al corredor de ARIA. |
| `lib/validador/rutas.ts` | Las rutas no llaman a `exigir()` del portero. | No hay sesión. | Cada ruta empieza con `exigir(peticion, …)` y corre en `conOrganizacion(contexto.orgEfectiva, …)`. |
| `lib/validador/llave.ts` | Lee `ANTHROPIC_API_KEY` del entorno. | La llave por organización vive cifrada en la base de ARIA. | Reemplazar por la lectura de `identidad.organizaciones_credenciales`. |

**Copiados sin cambios** (los importa la carcasa): `app/layout.js`, `app/tema.ts`, `app/temas.css`, `app/aios.css`,
`app/armazon.css`, `app/departamentos.css`, el resto de `app/*.css` que importa `globals.css` (se copiaron todas para que
la carcasa se vea idéntica), `app/brand/tokens-scope.css`, `app/brand/aria-mascot.d.ts`, `app/sesion-contexto.tsx`,
`public/brand/`, `components/{TopBar,IconSprite,MenuDeUsuario,SelectorDeEmpresa,Ventana}.jsx`,
`components/marca/Mascota.jsx`, `lib/aios/*`, `lib/vista.ts`, `lib/menu.ts`, `lib/reloj.ts`, `lib/cadencia.ts`,
`lib/http/cliente.ts`, `lib/autenticacion/politica.ts`, `lib/autorizacion/{capacidades,respuesta}.ts`.

## 2. Registro de la sección `validador` (viaja tal cual a ARIA)

| Archivo | Cambio |
|---|---|
| `lib/autorizacion/secciones.ts` | Sección `validador`, «Validador de contenido», grupo `Inteligencia`, ícono `#i-analizadores`, capacidad `tablero.ver` (la de Creative). |
| `lib/autorizacion/departamentos.ts` | Cuatro entradas en `marketing`, después de `creative`, en el grupo «Validador de contenido»: `dashboard`, `nuevo`, `historial`, `reglas`. |
| `components/CommandCenter.jsx` | `validador: ValidadorView`. |
| `components/views/ValidadorView.jsx` | `id="v-validador"`, forma de `CreativeView.jsx`. |

## 3. Diferencias con las instrucciones

| Instrucción | Lo que se hizo | Por qué |
|---|---|---|
| La sesión se arma con las funciones de `app/guardia.tsx`. | Se arma con `menuVisible()`, `seccionDeArranque()`/`menuPorDepartamentos()` y `seccionesConAlcance()` de `lib/autorizacion/`, igual que `app/api/auth/sesion/route.ts`. | En ARIA la guarda sólo pide la sesión al servidor; las funciones las llama la ruta. |
| Tres pestañas «en la entrada de `marketing`». | Cuatro `ENTRADAS` con `pestana` y el mismo `grupo`: la barra muestra una entrada, la cabecera las sub-pestañas. La cuarta, «Dashboard», va primera. | `departamentos.ts` no tiene pestañas por sección: es una tabla plana de entradas con `pestana` y `grupo` (como Radar, Funnel y Leads). |
| Patrón de pestañas de `CreativeView.jsx`. | Forma de `CreativeView` + mecanismo de `PanelDeAnalizadores.jsx` (`usarPedidoDeVista` y `anunciarPestana`). | Creative no tiene pestañas. |
| Migración `079_…`. | `079_el_validador_de_contenido.sql`. | Es el siguiente número libre en `origin/main` (llega a 078). La copia local sin subir llega a 106: al integrar, renumerar. |
| Tipos de Kysely del esquema `validador`. | Escritos a mano en `lib/validador/esquema.ts`, con claves calificadas (`validador.analisis`). | ARIA los escribe a mano (`lib/datos/esquema.ts`); sin ruta de búsqueda por rol hay que calificar. |
| Forzar la herramienta con `tool_choice: { type: 'tool' }`. | `tool_choice: { type: 'auto', disable_parallel_tool_use: true }`, `strict: true` en la herramienta, la instrucción explícita, y un reintento si el modelo no la llama. | Sonnet 5.5 y Opus 5.5 responden **400** a la herramienta forzada (documentación de Anthropic, consultada el 2026-10-27). |
| — | `fallbacks: "default"` con la cabecera `anthropic-beta: server-side-fallback-2026-07-01` (constante `CON_RESPALDO_ANTE_RECHAZO` en `lib/validador/proveedor.ts`). | Si el clasificador de seguridad del modelo declina una pieza (promesas de ingresos, temas sensibles), la API la vuelve a correr en otro modelo en vez de devolver `refusal`. Se apaga con `false`. |
| — | `output_config.effort = 'medium'` en el motor y en la revisión (`lib/validador/modelos.ts`). | El valor por omisión difiere entre los dos modelos; fijarlo hace comparables los tiempos (K4). |
| `severidad` en el esquema de cada hallazgo del modelo. | El modelo la propone, pero se guarda la **severidad de la regla**. | El riesgo tiene que ser comparable entre piezas y es lo que el jefe del área fijó en la regla. |
| Campos de `validador.analisis`. | Dos columnas más: `advertencias` (jsonb) y `hallazgos_descartados`. | La advertencia «Ortografía no verificada» tiene que verse también en el historial, y K3 necesita los descartados. |
| Panel lateral visible en las tres pestañas (6.2). | Es la pestaña «Dashboard», la primera del validador, con los mismos tres recuadros; las demás pestañas usan el ancho completo. | Pedido del jefe del área al revisar la maqueta (2026-10-27). |
| Rutas del API. | Una más: `GET /api/validador/analisis/[id]/archivo`. | La vista previa y la miniatura del historial. |
| Campo de Drive deshabilitado («Próximamente»). | Habilitado: la Fase 6 está implementada (`lib/validador/drive.ts`). | Las instrucciones lo permiten con las fases 0–5 completas. |
| Valores de Meta por verificar. | FMT-03: 30 MB; FMT-04: 150 caracteres (Meta recomienda 50–150); FMT-01: tolerancia de 3 %. FMT-02 (1080 px) queda como criterio del área: Meta admite desde 600 px. | Guía de anuncios de Meta, imagen en el feed, consultada el 2026-10-27. Las fuentes están en cada regla. |
| Precios de `costos.ts`. | Sonnet 5.5: 2 / 10, escritura de caché 2,50, lectura 0,10. Opus 5.5: 4 / 20, escritura 5, lectura 0,20 (US$ por millón). | Página de precios de Anthropic, consultada el 2026-10-27. La lectura de caché en estos modelos es 0,05 × la entrada, no 0,1 ×. |
| `components/views/*` de ARIA como referencia. | No se copió `lib/agentes/`: `proveedor.ts` replica las dos constantes y `motor.ts` replica el reintento de `llamada.ts`. | `llamada.ts` arrastra el registro de uso e incidentes de ARIA. |

## 4. Para integrar

Ver la sección 14 de las instrucciones. En resumen: copiar `components/views/ValidadorView.jsx`, `components/validador/`,
`lib/validador/` (menos `base.ts`, `migrador.ts`, `llave.ts`, `proveedor.ts` y `rutas.ts`, que se reemplazan por los de
ARIA), `app/api/validador/`, `app/validador.css` y la migración renumerada; registrar la sección en los cuatro lugares de la
sección 2; mover las constantes de `lib/validador/modelos.ts` a `lib/agentes/modelos.ts`; y revertir cada fila de la
sección 1.
