/**
 * The two guarded screens, measured at 390x844, in all three density modes.
 *
 * The plan's vertical budget names two screens: the battle screen with four
 * move buttons above the fold, and the map screen with the current step's
 * offered nodes above the fold. Every visual stage must leave their layout
 * height unchanged to the pixel, and this is the instrument. Same seed, same
 * clicks, same viewport every time, so the only variable is the stylesheet.
 *
 *   npm run build && node scripts/visual/measure.mjs --out docs/visual/baseline/heights.json
 *   node scripts/visual/measure.mjs --compare docs/visual/baseline/heights.json
 *
 * What is measured, per screen: the layout height of the `.screen` element,
 * the document's scroll height, and the bottom edge of the decision point (the
 * last offered node card on the map, the fourth move button in a battle).
 * Compared as a whole object; any field moving is a fail.
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { launch, measureGuardedScreens, serve } from './browser.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(name);
  return at === -1 ? null : args[at + 1];
};
const out = flag('--out');
const compare = flag('--compare');
const seed = flag('--seed') ?? 'SMOKE24';

const round = (n) => Math.round(n * 100) / 100;

const server = await serve();
const browser = await launch();
try {
  const measured = await measureGuardedScreens(server.url, browser, seed);
  const text = `${JSON.stringify(measured, null, 2)}\n`;
  console.log(text);
  if (out) writeFileSync(out, text);
  if (compare) {
    const expected = JSON.parse(readFileSync(compare, 'utf8'));
    const differences = [];
    // Detailed at the top level, the other two modes under `modes`. Density patch.
    const readings = [
      ['', expected, measured],
      ...Object.keys(expected.modes ?? {}).map((mode) => [`modes.${mode}.`, expected.modes[mode], measured.modes?.[mode] ?? {}]),
    ];
    for (const [prefix, want, got] of readings) {
      for (const screen of ['map', 'battle']) {
        for (const key of Object.keys(want[screen] ?? {})) {
          if (round(want[screen][key]) !== round(got[screen]?.[key])) {
            differences.push(`${prefix}${screen}.${key}: expected ${want[screen][key]}, measured ${got[screen]?.[key]}`);
          }
        }
      }
    }
    if (differences.length) {
      console.error(`guarded screen heights differ from ${compare}:`);
      for (const line of differences) console.error(`  - ${line}`);
      process.exitCode = 1;
    } else {
      console.log(`guarded screen heights equal ${compare} to the pixel`);
    }
  }
  if (measured.problems?.length) {
    console.error('page problems:', measured.problems);
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  server.close();
}
