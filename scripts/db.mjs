// La base local del validador, con el patrón de `scripts/db.mjs` de ARIA: un guion, una fase por
// argumento, y la cadena de conexión desde `.env.local` (`--env-file-if-exists`).
//
//   node scripts/db.mjs migrar    aplica las migraciones pendientes de `db/migraciones/`
//   node scripts/db.mjs sembrar   organización, marca y corpus semilla (idempotente)
//   node scripts/db.mjs reset     tira el contenedor, lo levanta vacío, migra y siembra
//
// MAQUETA: sin las fases de ARIA que dependen de roles y cuentas (`arranque`, `catalogo`, `cuentas`,
// `verificar`): la maqueta corre con una sola cadena.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const CONTENEDOR = 'aria_validador_base';
const SERVICIO = 'base';

function compose(...args) {
  const r = spawnSync('docker', ['compose', ...args], { cwd: RAIZ, stdio: 'inherit' });
  if (r.error) throw new Error(`no se pudo ejecutar docker: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`docker compose ${args.join(' ')} salió ${r.status}`);
}

function estadoDeSalud() {
  const r = spawnSync('docker', ['inspect', '--format', '{{.State.Health.Status}}', CONTENEDOR], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : 'ausente';
}

async function esperarSalud() {
  for (let i = 0; i < 60; i += 1) {
    if (estadoDeSalud() === 'healthy') return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`el contenedor ${CONTENEDOR} no quedó sano en 60 s`);
}

/** Sólo contra la base local: `reset` borra todo. */
function exigirLocal() {
  const url = process.env.DATABASE_URL ?? '';
  if (!/@(127\.0\.0\.1|localhost)(:\d+)?\//.test(url)) {
    throw new Error('`reset` sólo corre contra una base en 127.0.0.1 o localhost (ver DATABASE_URL).');
  }
}

async function conBase(fn) {
  const { base, cerrarBase } = await import('../lib/validador/base.ts');
  try {
    return await fn(base());
  } finally {
    await cerrarBase();
  }
}

async function migrar() {
  const { migrar: aplicar } = await import('../lib/validador/migrador.ts');
  const aplicadas = await conBase(aplicar);
  console.log(aplicadas.length ? `migraciones aplicadas: ${aplicadas.join(', ')}` : 'no había migraciones pendientes');
}

async function sembrar() {
  const { sembrar: plantar } = await import('../db/sembrado/validador.ts');
  console.log(`sembrado: ${await conBase(plantar)}`);
}

const FASES = {
  migrar,
  sembrar,
  async reset() {
    exigirLocal();
    compose('rm', '--stop', '--force', '--volumes', SERVICIO);
    compose('up', '-d', SERVICIO);
    await esperarSalud();
    await migrar();
    await sembrar();
  },
};

const fase = process.argv[2];
if (!FASES[fase]) {
  console.error(`uso: node scripts/db.mjs <${Object.keys(FASES).join('|')}>`);
  process.exit(2);
}
try {
  await FASES[fase]();
} catch (err) {
  console.error(`✗ ${fase}: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
