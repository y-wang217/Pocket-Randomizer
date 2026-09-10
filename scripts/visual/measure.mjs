/**
 * The two guarded screens, measured at 390x844.
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

import { launch, openApp, playUntil, serve, visible } from './browser.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(name);
  return at === -1 ? null : args[at + 1];
};
const out = flag('--out');
const compare = flag('--compare');
const seed = flag('--seed') ?? 'SMOKE24';

const round = (n) => Math.round(n * 100) / 100;

async function measureScreen(page, name, decisionSelector) {
  return page.evaluate(
    ([screenSelector, decision]) => {
      const screen = globalThis.document.querySelector(screenSelector);
      const nodes = [...globalThis.document.querySelectorAll(decision)];
      const rects = nodes.map((node) => node.getBoundingClientRect());
      const r = (n) => Math.round(n * 100) / 100;
      return {
        screenHeight: r(screen.getBoundingClientRect().height),
        scrollHeight: globalThis.document.documentElement.scrollHeight,
        decisionCount: nodes.length,
        decisionTop: rects.length ? r(Math.min(...rects.map((x) => x.top + globalThis.window.scrollY))) : null,
        decisionBottom: rects.length ? r(Math.max(...rects.map((x) => x.bottom + globalThis.window.scrollY))) : null,
      };
    },
    [visible(name), decisionSelector],
  );
}

export async function measureGuardedScreens(url, browser) {
  const { page, context, problems } = await openApp(browser, url, seed);
  const result = { seed, viewport: { width: 390, height: 844 } };

  await playUntil(page, (screen) => screen === 'map');
  await page.waitForTimeout(100);
  result.map = await measureScreen(page, 'map', `${visible('map')} .step--current .node`);

  await playUntil(page, (screen) => screen === 'battle');
  // The HP bar transition and the swap beat settle well inside this.
  await page.waitForTimeout(600);
  result.battle = await measureScreen(page, 'battle', `${visible('battle')} .moves .move`);

  await context.close();
  if (problems.length) result.problems = problems;
  return result;
}

const server = await serve();
const browser = await launch();
try {
  const measured = await measureGuardedScreens(server.url, browser);
  const text = `${JSON.stringify(measured, null, 2)}\n`;
  console.log(text);
  if (out) writeFileSync(out, text);
  if (compare) {
    const expected = JSON.parse(readFileSync(compare, 'utf8'));
    const differences = [];
    for (const screen of ['map', 'battle']) {
      for (const key of Object.keys(expected[screen])) {
        if (round(expected[screen][key]) !== round(measured[screen][key])) {
          differences.push(`${screen}.${key}: expected ${expected[screen][key]}, measured ${measured[screen][key]}`);
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
