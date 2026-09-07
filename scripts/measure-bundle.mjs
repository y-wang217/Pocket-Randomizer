/**
 * Bundle size is a named project risk, so it gets measured rather than guessed.
 *
 * Two things are measured. First, each dependency's *marginal* gzipped cost:
 * stub entrypoints add one dependency at a time and the sizes are diffed, so a
 * module shared by two packages is not counted against both. Second, what
 * build-config/trim-sim-data.ts actually saves, by running every probe with the
 * trim on and off.
 *
 * Run with `npm run measure`.
 */
import { build } from 'vite';
import { gzipSync } from 'node:zlib';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = process.cwd();

const PROBES = [
  ['app shell only', "import './src/ui/styles.css';\nconsole.log(1);"],
  [
    '@pkmn/sim',
    "import {Battle, Dex} from '@pkmn/sim';\nconsole.log(Battle, Dex.formats.get('gen9customgame').id);",
  ],
  [
    '@smogon/calc',
    "import {Battle, Dex} from '@pkmn/sim';\nimport {Generations, calculate} from '@smogon/calc';\nconsole.log(Battle, Dex, Generations, calculate);",
  ],
  [
    '@pkmn/view + @pkmn/protocol',
    "import {Battle, Dex} from '@pkmn/sim';\nimport {Generations, calculate} from '@smogon/calc';\nimport {LogFormatter} from '@pkmn/view';\nimport {Protocol} from '@pkmn/protocol';\nconsole.log(Battle, Dex, Generations, calculate, LogFormatter, Protocol);",
  ],
];

function measureDir(dir) {
  let raw = 0;
  let gz = 0;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.js')) continue;
    const buf = readFileSync(join(dir, file));
    raw += buf.length;
    gz += gzipSync(buf, { level: 9 }).length;
  }
  return { raw, gz };
}

async function sizeOf(source) {
  const out = mkdtempSync(join(tmpdir(), 'gymrun-probe-'));
  const entry = join(ROOT, `.probe-${Math.random().toString(36).slice(2)}.ts`);
  writeFileSync(entry, source);
  try {
    await build({
      root: ROOT,
      logLevel: 'silent',
      build: { outDir: out, emptyOutDir: true, sourcemap: false, rollupOptions: { input: entry } },
    });
    return measureDir(join(out, 'assets'));
  } finally {
    rmSync(entry, { force: true });
    rmSync(out, { recursive: true, force: true });
  }
}

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

async function series() {
  const rows = [];
  for (const [label, source] of PROBES) rows.push({ label, ...(await sizeOf(source)) });
  return rows;
}

const trimmed = await series();
process.env.GYMRUN_FULL_DEX = '1';
const full = await series();
delete process.env.GYMRUN_FULL_DEX;

const head = 'dependency'.padEnd(30) + 'trimmed gz'.padStart(12) + 'full gz'.padStart(12) + 'saved'.padStart(12);
console.log(`\ncumulative bundle\n${head}\n${'-'.repeat(head.length)}`);
for (let i = 0; i < trimmed.length; i++) {
  console.log(
    trimmed[i].label.padEnd(30) +
      kb(trimmed[i].gz).padStart(12) +
      kb(full[i].gz).padStart(12) +
      kb(full[i].gz - trimmed[i].gz).padStart(12),
  );
}

console.log(`\nmarginal gzipped cost (trimmed build)\n${'-'.repeat(head.length)}`);
for (let i = 1; i < trimmed.length; i++) {
  console.log(trimmed[i].label.padEnd(30) + kb(trimmed[i].gz - trimmed[i - 1].gz).padStart(12));
}

const app = measureDir(join(ROOT, 'dist/assets'));
console.log(`\nshipped app JS: ${kb(app.raw)} minified, ${kb(app.gz)} gzipped`);
