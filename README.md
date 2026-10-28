# aria-validador-multimodal

Maqueta funcional local del **Sistema de validación multimodal de contenido** de ARIA, construida sobre la
carcasa de `aria-comando-central` (AIOS — Command Center). Agrega la sección **Marketing › Validador de
contenido**, que revisa cada pieza —un post (una imagen o un carrusel de hasta 20) o una secuencia de historias, y su copy— en dos ejes —el criterio de marca y las políticas
de Meta— con una capa determinística y un motor de análisis con Claude.

Las instrucciones de construcción están en [`docs/INSTRUCCIONES-aria-validador-multimodal.md`](docs/INSTRUCCIONES-aria-validador-multimodal.md)
y todo lo que difiere de ARIA o de esas instrucciones, en [`CAMBIOS-RESPECTO-A-ARIA.md`](CAMBIOS-RESPECTO-A-ARIA.md).

## Requisitos

- **Node 24.14.1** (`.nvmrc`)
- **Docker** (PostgreSQL 17 y LanguageTool)
- Una llave de la API de Claude (`ANTHROPIC_API_KEY`)

## Arranque en cinco comandos

```bash
npm install
cp .env.example .env.local        # y pega tu ANTHROPIC_API_KEY
docker compose up -d              # PostgreSQL en 127.0.0.1:55433 y LanguageTool en 127.0.0.1:8010
npm run db:reset                  # migra y siembra la marca ARIA con el corpus v1
npm run dev                       # http://localhost:3200
```

La aplicación abre directo en **Marketing › Validador de contenido**, con la sesión de maqueta de Gabriel Iglesias
(jefe del área de marketing, ARIA High Ticket). Las demás secciones de la barra se ven pero muestran una vista de relleno.

LanguageTool tarda unos segundos en arrancar la primera vez; si no responde, el análisis sigue y muestra
«Ortografía no verificada».

## Los flujos

| Pestaña | Qué se hace |
|---|---|
| **Dashboard** | Los errores recurrentes de los últimos 30 días, el porcentaje de piezas sin hallazgos del mes y las restricciones de marca activas, con «Agregar restricción». |
| **Nuevo análisis** | Arrastra una o varias imágenes —hasta 20, el máximo de un carrusel de Instagram— en el orden en que se publican (se reordenan con las flechas), o pega enlaces públicos de Google Drive, uno por línea. Pega el copy, elige **Post** (una imagen o carrusel) o **Historias consecutivas** y «Analizar». Todo se analiza en una sola pasada. El resultado trae el nivel de riesgo, los hallazgos por eje, la versión del corpus, el tiempo y el costo; cada hallazgo cita su regla, su evidencia, su ubicación y la imagen donde está, y se marca «Correcto» o «Incorrecto». |
| **Historial** | Todos los análisis, filtrables por nivel de riesgo y fechas. Al abrir uno se ve su detalle y se dan o cambian los veredictos. |
| **Reglas de marca** | El corpus vigente por eje, las versiones anteriores (sólo lectura), las reglas candidatas a ajuste y «Agregar restricción», que crea la versión N+1. |

## Evaluación (KPIs)

```bash
npm run validador:evaluar
```

Corre el flujo real sobre las 15 piezas etiquetadas (incluye un carrusel, historias consecutivas y un carrusel con proporciones mezcladas) de `evaluacion/piezas/` y escribe
`evaluacion/resultados/AAAA-MM-DD.md` con K1 (detección), K2 (falsas alertas), K3 (trazabilidad), K4 (tiempo) y
K5 (costo), sus metas, el desglose de K1 por categoría y las piezas a revisar con el jefe del área. Los análisis de la
evaluación quedan en el historial.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Next en el puerto 3200. |
| `npm run db:migrar` | Aplica las migraciones pendientes de `db/migraciones/`. |
| `npm run db:sembrar` | Siembra la organización, la marca ARIA y el corpus v1 (idempotente). |
| `npm run db:reset` | Recrea el contenedor de la base vacío, migra y siembra. Borra todos los análisis. |
| `npm run validador:evaluar` | La evaluación de arriba. |
| `npx tsc --noEmit` | Verificación de tipos. |

## Dónde está cada cosa

| Ruta | Qué es |
|---|---|
| `components/views/ValidadorView.jsx`, `components/validador/` | La interfaz. |
| `lib/validador/` | El motor: corpus, capa determinística, LanguageTool, Claude, revisión, riesgo, costos, flujo y registro. |
| `app/api/validador/` | Las rutas del API. |
| `app/validador.css` | Los estilos, sólo con tokens de ARIA. |
| `db/migraciones/079_el_validador_de_contenido.sql`, `080_las_imagenes_del_carrusel.sql` | El esquema `validador` y las imágenes de cada pieza. |
| `db/sembrado/` | La marca y el corpus semilla. |
| `lib/maqueta/stubs/`, `app/sesion-de-maqueta.ts` | Lo que reemplaza la infraestructura de ARIA en la maqueta. |
