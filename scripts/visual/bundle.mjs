/**
 * What `dist/` weighs, so a stage can state its bundle delta as a measurement.
 *
 *   npm run build && node scripts/visual/bundle.mjs [--out file]
 *
 * Every file under dist/ except source maps, raw and gzipped, plus the totals.
 * The done marker of each stage carries the delta against the previous one.
 */
import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = join(process.cwd(), 'dist');
const out = process.argv.indexOf('--out') === -1 ? null : process.argv[process.argv.indexOf('--out') + 1];

function walk(dir) {
  return readdirSync(dir)
    .sort()
    .flatMap((entry) => {
      const full = join(dir, entry);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
}

const files = [];
let raw = 0;
let gz = 0;
for (const file of walk(DIST)) {
  if (file.endsWith('.map')) continue;
  const body = readFileSync(file);
  const zipped = gzipSync(body, { level: 9 }).length;
  // Hashed asset names change on every build; strip the hash so two builds
  // of the same file line up in a diff.
  const name = relative(DIST, file).replace(/-[A-Za-z0-9_-]{8}(\.[a-z0-9]+)$/, '$1');
  files.push({ file: name, raw: body.length, gz: zipped });
  raw += body.length;
  gz += zipped;
}
const report = { files, total: { raw, gz } };
const text = `${JSON.stringify(report, null, 2)}\n`;
console.log(text);
if (out) writeFileSync(out, text);
