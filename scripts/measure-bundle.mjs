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

/*
 * Probe entry files are numbered, not randomised.
 *
 * The name used to come from the platform's unseeded generator — banned
 * repo-wide, and unflagged here since Stage 2 because both mechanisms that
 * enforce the ban excluded this file. Release 0.5 closed that; the rule now
 * reaches `scripts/` and `.mjs`.
 *
 * The ban is not the only reason to change it. The entry filename is an input
 * to the build being measured, so a name that differs between two runs is a
 * variable sitting inside a measurement whose whole purpose is to be diffed
 * against last week's. A counter makes the nth probe of every run the same
 * build, so a byte that moves is a byte the *bundle* moved.
 *
 * Uniqueness within a run is all this ever needed: the file is written and
 * deleted inside `sizeOf`, and `npm run measure` is one process.
 *
 * (This comment names the call obliquely on purpose. The ban is asserted over
 * the raw file with comments left in — `test/boundaries.test.ts` says why —
 * so a file cannot spell it even to explain itself.)
 */
let probeCount = 0;

async function sizeOf(source) {
  const out = mkdtempSync(join(tmpdir(), 'gymrun-probe-'));
  const entry = join(ROOT, `.probe-${probeCount++}.ts`);
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
