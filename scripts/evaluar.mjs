// La evaluación del validador: corre el flujo REAL sobre el conjunto etiquetado de `evaluacion/piezas/` y
// escribe `evaluacion/resultados/AAAA-MM-DD.md` con los KPIs del proyecto (sección 8).
//
//   npm run validador:evaluar
//
// Cada pieza es un `NNN.json` y sus imágenes: `NNN.jpg` si es una, o `NNN-1.jpg`, `NNN-2.jpg`, … si es un
// carrusel o una secuencia de historias (`formato_destino`: `feed` o `historia`):
//   { id, formato_destino, copy, conforme, reglas_esperadas: [códigos], nota }
//
// Los análisis quedan en el historial como cualquier otro: es el mismo flujo, no una simulación.
// Necesita ANTHROPIC_API_KEY en .env.local, la base levantada y migrada, y LanguageTool.
//
//   K1 Tasa de detección       no conformidades CRÍTICAS detectadas / presentes        ≥ 75 %
//   K2 Tasa de falsas alertas  piezas conformes con algún hallazgo / piezas conformes  ≤ 25 %
//   K3 Trazabilidad            hallazgos con regla y evidencia válidas / emitidos      100 %
//   K4 Tiempo por pieza        promedio y máximo de duracion_ms                        ≤ 60 s
//   K5 Costo por pieza         promedio de costo_usd × tipo de cambio                  ≤ S/ 0,25
//
// Crítica = una regla esperada de severidad ALTA en la versión del corpus con que se analizó.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const PIEZAS = join(RAIZ, 'evaluacion', 'piezas');
const RESULTADOS = join(RAIZ, 'evaluacion', 'resultados');
const TIPOS = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

const META = { K1: 75, K2: 25, K3: 100, K4: 60, K5: 0.25 };

const { analizarPieza } = await import('../lib/validador/flujo.ts');
const { detalleDelAnalisis } = await import('../lib/validador/registro.ts');
const { base, cerrarBase, ORGANIZACION_DE_MAQUETA } = await import('../lib/validador/base.ts');
const { reglasDeLaVersion } = await import('../lib/validador/corpus.ts');
const { TIPO_DE_CAMBIO_REFERENCIAL } = await import('../lib/validador/costos.ts');
const { llaveDeClaude } = await import('../lib/validador/llave.ts');

if (!llaveDeClaude(ORGANIZACION_DE_MAQUETA)) {
  console.error('✗ Falta ANTHROPIC_API_KEY en .env.local: la evaluación corre el flujo real con Claude.');
  process.exit(1);
}

function leerPiezas() {
  return readdirSync(PIEZAS)
    .filter((n) => n.endsWith('.json'))
    .sort()
    .map((n) => {
      const pieza = JSON.parse(readFileSync(join(PIEZAS, n), 'utf8'));
      // Una imagen: `NNN.jpg`. Un carrusel o una secuencia de historias: `NNN-1.jpg`, `NNN-2.jpg`, … en orden.
      const imagenes = readdirSync(PIEZAS)
        .map((archivo) => ({ archivo, m: archivo.match(new RegExp(`^${pieza.id}(?:-(\\d+))?(\\.\\w+)$`)) }))
        .filter(({ m }) => m && TIPOS[m[2].toLowerCase()])
        .sort((a, b) => Number(a.m[1] ?? 0) - Number(b.m[1] ?? 0))
        .map(({ archivo, m }) => ({ ruta: join(PIEZAS, archivo), tipo: TIPOS[m[2].toLowerCase()], nombre: archivo }));
      return { ...pieza, imagenes };
    });
}

const pct = (a, b) => (b === 0 ? null : (a / b) * 100);
const fmtPct = (x) => (x === null ? '—' : `${x.toFixed(1).replace('.', ',')} %`);
const fmtS = (ms) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
const cumple = (ok) => (ok === null ? '—' : ok ? '✅ cumple' : '❌ no cumple');

const piezas = leerPiezas();
if (piezas.length === 0) {
  console.error(`✗ No hay piezas en ${PIEZAS}.`);
  process.exit(1);
}

const db = base();
const filas = [];
for (const p of piezas) {
  process.stdout.write(`· ${p.id} … `);
  const r = await analizarPieza({
    organizacionId: ORGANIZACION_DE_MAQUETA,
    archivos: p.imagenes.map((i) => ({ nombre: i.nombre, tipo: i.tipo, bytes: new Uint8Array(readFileSync(i.ruta)) })),
    copy: p.copy ?? null,
    formato: p.formato_destino,
  });
  if (r.tipo === 'rechazo') {
    console.log(`falló (${r.codigo}: ${r.detalle})`);
    filas.push({ pieza: p, error: `${r.codigo}: ${r.detalle}` });
    continue;
  }
  const d = await detalleDelAnalisis(db, ORGANIZACION_DE_MAQUETA, r.id);
  const reglas = await reglasDeLaVersion(db, d.version.id);
  console.log(`${d.nivel_de_riesgo} · ${d.hallazgos.length} hallazgos · ${fmtS(d.duracion_ms)}`);
  filas.push({ pieza: p, analisis: d, reglas: new Map(reglas.map((x) => [x.codigo, x])) });
}
await cerrarBase();

// ── Los KPIs ───────────────────────────────────────────────────────────────
const analizadas = filas.filter((f) => f.analisis);
let criticasPresentes = 0;
let criticasDetectadas = 0;
const porCategoria = new Map();
let conformes = 0;
let conformesConHallazgos = 0;
let emitidos = 0;
let validos = 0;
const errores = [];

for (const f of analizadas) {
  const { pieza, analisis, reglas } = f;
  const encontrados = new Set(analisis.hallazgos.map((h) => h.codigo_de_regla));
  const faltantes = [];
  for (const codigo of pieza.reglas_esperadas) {
    const regla = reglas.get(codigo);
    const detectada = encontrados.has(codigo);
    const categoria = regla?.categoria ?? 'Regla desconocida';
    const c = porCategoria.get(categoria) ?? { presentes: 0, detectadas: 0, criticas: 0, criticasDetectadas: 0 };
    c.presentes += 1;
    if (detectada) c.detectadas += 1;
    if (regla?.severidad === 'alta') {
      c.criticas += 1;
      criticasPresentes += 1;
      if (detectada) {
        c.criticasDetectadas += 1;
        criticasDetectadas += 1;
      }
    }
    porCategoria.set(categoria, c);
    if (!detectada) faltantes.push(codigo);
  }
  const sobrantes = [...encontrados].filter((c) => !pieza.reglas_esperadas.includes(c));
  if (pieza.conforme) {
    conformes += 1;
    if (analisis.hallazgos.length > 0) conformesConHallazgos += 1;
  }
  // K3: lo guardado ya pasó la validación; lo descartado por el motor cuenta como emitido y no válido.
  const conEvidencia = analisis.hallazgos.filter((h) => h.evidencia.trim() !== '' && reglas.has(h.codigo_de_regla)).length;
  validos += conEvidencia;
  emitidos += analisis.hallazgos.length + analisis.hallazgos_descartados;
  if (faltantes.length > 0 || sobrantes.length > 0) errores.push({ pieza, faltantes, sobrantes, analisis });
}

const k1 = pct(criticasDetectadas, criticasPresentes);
const k2 = pct(conformesConHallazgos, conformes);
const k3 = emitidos === 0 ? 100 : pct(validos, emitidos);
const duraciones = analizadas.map((f) => f.analisis.duracion_ms);
const k4Prom = duraciones.length ? duraciones.reduce((a, b) => a + b, 0) / duraciones.length : null;
const k4Max = duraciones.length ? Math.max(...duraciones) : null;
const costos = analizadas.map((f) => f.analisis.costo_usd);
const k5Usd = costos.length ? costos.reduce((a, b) => a + b, 0) / costos.length : null;
const k5 = k5Usd === null ? null : k5Usd * TIPO_DE_CAMBIO_REFERENCIAL;

// ── El informe ─────────────────────────────────────────────────────────────
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
const versiones = [...new Set(analizadas.map((f) => `v${f.analisis.version.numero}`))].join(', ');
const lineas = [
  `# Evaluación del validador · ${hoy}`,
  '',
  `${piezas.length} piezas de \`evaluacion/piezas/\` (${piezas.filter((p) => p.conforme).length} conformes, ${piezas.filter((p) => !p.conforme).length} con no conformidades controladas), analizadas con el flujo real. Corpus ${versiones || '—'}. Tipo de cambio referencial: S/ ${TIPO_DE_CAMBIO_REFERENCIAL} por US$.`,
  '',
  filas.length !== analizadas.length ? `> ⚠ ${filas.length - analizadas.length} pieza(s) no se pudieron analizar; ver al final.\n` : '',
  '## KPIs',
  '',
  '| KPI | Fórmula | Resultado | Meta | Estado |',
  '|---|---|---|---|---|',
  `| K1 Tasa de detección | Críticas detectadas / presentes (${criticasDetectadas}/${criticasPresentes}) | ${fmtPct(k1)} | ≥ ${META.K1} % | ${cumple(k1 === null ? null : k1 >= META.K1)} |`,
  `| K2 Tasa de falsas alertas | Conformes con hallazgos / conformes (${conformesConHallazgos}/${conformes}) | ${fmtPct(k2)} | ≤ ${META.K2} % | ${cumple(k2 === null ? null : k2 <= META.K2)} |`,
  `| K3 Trazabilidad | Hallazgos con regla y evidencia válidas / emitidos (${validos}/${emitidos}) | ${fmtPct(k3)} | ${META.K3} % | ${cumple(k3 >= META.K3)} |`,
  `| K4 Tiempo por pieza | Promedio y máximo de \`duracion_ms\` | ${k4Prom === null ? '—' : `${fmtS(k4Prom)} (máx. ${fmtS(k4Max)})`} | ≤ ${META.K4} s | ${cumple(k4Prom === null ? null : k4Max <= META.K4 * 1000)} |`,
  `| K5 Costo por pieza | Promedio de \`costo_usd\` × tipo de cambio | ${k5 === null ? '—' : `S/ ${k5.toFixed(4).replace('.', ',')} (US$ ${k5Usd.toFixed(4).replace('.', ',')})`} | ≤ S/ ${String(META.K5).replace('.', ',')} | ${cumple(k5 === null ? null : k5 <= META.K5)} |`,
  '',
  'K4 se da por cumplido si el MÁXIMO está dentro de la meta, no sólo el promedio.',
  '',
  '## K1 por categoría de regla',
  '',
  '| Categoría | Esperadas | Detectadas | Detección | Críticas detectadas |',
  '|---|---|---|---|---|',
  ...[...porCategoria.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cat, c]) => `| ${cat} | ${c.presentes} | ${c.detectadas} | ${fmtPct(pct(c.detectadas, c.presentes))} | ${c.criticas === 0 ? '—' : `${c.criticasDetectadas}/${c.criticas}`} |`),
  '',
  '## Piezas para revisar con el jefe del área',
  '',
  errores.length === 0 ? 'Ninguna: cada pieza tuvo exactamente los hallazgos esperados.' : 'Piezas con una regla esperada que no se detectó, o con hallazgos que no estaban en la etiqueta.',
  '',
  ...(errores.length === 0
    ? []
    : [
        '| Pieza | Nota | Esperadas | No detectadas | No esperadas | Riesgo |',
        '|---|---|---|---|---|---|',
        ...errores.map(
          (e) =>
            `| ${e.pieza.id} | ${e.pieza.nota ?? ''} | ${e.pieza.reglas_esperadas.join(', ') || '—'} | ${e.faltantes.join(', ') || '—'} | ${e.sobrantes.join(', ') || '—'} | ${e.analisis.nivel_de_riesgo} |`,
        ),
      ]),
  '',
  '## Detalle por pieza',
  '',
  '| Pieza | Formato | Conforme | Riesgo | Hallazgos | Tiempo | Costo (S/) |',
  '|---|---|---|---|---|---|---|',
  ...filas.map((f) =>
    f.analisis
      ? `| ${f.pieza.id} | ${f.pieza.formato_destino} | ${f.pieza.conforme ? 'sí' : 'no'} | ${f.analisis.nivel_de_riesgo} | ${f.analisis.hallazgos.map((h) => h.codigo_de_regla).join(', ') || '—'} | ${fmtS(f.analisis.duracion_ms)} | ${(f.analisis.costo_usd * TIPO_DE_CAMBIO_REFERENCIAL).toFixed(4).replace('.', ',')} |`
      : `| ${f.pieza.id} | ${f.pieza.formato_destino} | ${f.pieza.conforme ? 'sí' : 'no'} | error | ${f.error} | — | — |`,
  ),
  '',
];

mkdirSync(RESULTADOS, { recursive: true });
const salida = join(RESULTADOS, `${hoy}.md`);
writeFileSync(salida, lineas.join('\n'));
console.log(`\n✓ Informe: ${salida}`);
console.log(`  K1 ${fmtPct(k1)} · K2 ${fmtPct(k2)} · K3 ${fmtPct(k3)} · K4 ${k4Prom === null ? '—' : fmtS(k4Prom)} · K5 ${k5 === null ? '—' : `S/ ${k5.toFixed(4)}`}`);
