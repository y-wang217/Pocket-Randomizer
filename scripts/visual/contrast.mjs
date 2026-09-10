/**
 * Contrast of the text styles the plan guards, measured off rendered pixels.
 *
 *   node scripts/visual/contrast.mjs --out file.json [--seed SMOKE24] [--locale-force cave]
 *
 * For each named text style on the map and battle screens: the computed text
 * colour, the dominant rendered colour inside the element's box (which is the
 * background the text actually sits on, gradient, watermark, scene and all),
 * and the WCAG 2 contrast ratio between them. Rendered pixels rather than
 * computed background-color, because from V1 on the background behind a
 * heading is a gradient with a watermark through it and no computed property
 * says what colour that came out as.
 *
 * `--locale-force` re-tags <html data-locale> so a locale's palette can be
 * measured without playing a run into that locale.
 */
import { writeFileSync } from 'node:fs';

import { launch, openApp, playUntil, serve, visible } from './browser.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(name);
  return at === -1 ? null : args[at + 1];
};
const out = flag('--out');
const seed = flag('--seed') ?? 'SMOKE24';
const forced = flag('--locale-force');
const dist = flag('--dist') ?? 'dist';

/** The text styles guarded, per screen. Selector, and a label for the report. */
export const STYLES = {
  map: [
    ['.screen__title', 'map title'],
    ['.screen__blurb', 'map blurb'],
    ['.map__blurb', 'gym blurb'],
    ['.map__region-name', 'region name'],
    ['.party__wallet-label', 'wallet label'],
    ['.party__wallet-value', 'wallet value'],
    ['.panel__name', 'party member name'],
    ['.panel__hp-text', 'party hp text'],
    ['.party__move', 'party move row'],
    ['.step--current .node__label', 'node label'],
    ['.step--current .node__detail', 'node detail'],
    ['.step--current .tier', 'tier chip'],
    ['.step--upcoming .node__label', 'upcoming node label'],
    ['.map__region .type', 'type chip'],
    ['.rail__label', 'rail label'],
    ['.step__marker', 'step marker'],
    ['.threats__summary', 'threat summary'],
  ],
  battle: [
    ['.screen__title', 'battle title'],
    ['.screen__blurb', 'battle blurb'],
    ['.panel__name', 'panel name'],
    ['.panel__level', 'panel level'],
    ['.panel__hp-text', 'hp text'],
    ['.stat__label', 'stat label'],
    ['.stat__value', 'stat value'],
    ['.move__name', 'move name'],
    ['.move__power', 'move power'],
    ['.move__pp', 'move pp'],
    ['.badge--category', 'category chip'],
    ['.panel__types .type', 'panel type chip'],
    ['.log-entry', 'log entry'],
  ],
};

function luminance([r, g, b]) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

/** Decode a PNG in a scratch page and return the dominant colour and the mean. */
async function dominant(scratch, png) {
  return scratch.evaluate(async (base64) => {
    const img = new globalThis.Image();
    img.src = `data:image/png;base64,${base64}`;
    await img.decode();
    const canvas = globalThis.document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, img.width, img.height);
    const counts = new Map();
    let sum = [0, 0, 0];
    const n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      // Quantise to 4-value steps so anti-aliasing does not split the mode.
      const key = `${data[i] >> 2},${data[i + 1] >> 2},${data[i + 2] >> 2}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      sum = [sum[0] + data[i], sum[1] + data[i + 1], sum[2] + data[i + 2]];
    }
    let best = null;
    for (const [key, count] of counts) if (!best || count > best[1]) best = [key, count];
    const mode = best[0].split(',').map((v) => (Number(v) << 2) + 2);
    return { mode, share: best[1] / n, mean: sum.map((v) => Math.round(v / n)) };
  }, png.toString('base64'));
}

/** rgb(), and the color(srgb …) form a color-mix() computes to. */
function parseColor(text) {
  const rgb = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(text);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  const srgb = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(text);
  if (srgb) return [1, 2, 3].map((i) => Math.round(Number(srgb[i]) * 255));
  return null;
}

export async function measureContrast(url, browser, { seed: runSeed = 'SMOKE24', locale = null } = {}) {
  const { page, context } = await openApp(browser, url, runSeed);
  const scratch = await context.newPage();
  await scratch.setContent('<canvas></canvas>');
  const results = {};
  for (const screen of ['map', 'battle']) {
    await playUntil(page, (open) => open === screen);
    if (locale) await page.evaluate((id) => globalThis.document.documentElement.setAttribute('data-locale', id), locale);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(600);
    results[screen] = {};
    for (const [selector, label] of STYLES[screen]) {
      /*
       * The log moved into a sheet at V5.2, and a text style behind a tap
       * still has to meet the contrast rule — it is read for longer than
       * anything on the board. So the sheet is opened for this one selector
       * rather than `.log-entry` being dropped from the table: a selector
       * quietly skipped is a style quietly unchecked, and not doing that is
       * this instrument's whole job.
       *
       * **Opened last and for one reading**, not for the whole screen. The
       * sheet lays a scrim over the board, and every selector above it would
       * otherwise be photographed through a dim overlay — a contrast number
       * for a surface no player ever reads.
       */
      if (screen === 'battle' && selector === '.log-entry') {
        const history = page.locator(`${visible(screen)} .flags__history`);
        if (await history.count()) {
          await history.click();
          await page.waitForTimeout(250);
        }
      }
      const target = page.locator(`${visible(screen)} ${selector}`).first();
      if (!(await target.count())) continue;
      // Present but not rendered — behind a closed overlay, or on a turn that
      // did not produce one. `scrollIntoViewIfNeeded` waits for stability on
      // such an element and times the whole run out rather than skipping it.
      if (!(await target.isVisible())) continue;
      await target.scrollIntoViewIfNeeded();
      const text = parseColor(await target.evaluate((el) => globalThis.getComputedStyle(el).color));
      const box = await target.boundingBox();
      if (!text || !box || box.width < 1 || box.height < 1) continue;
      const png = await page.screenshot({ clip: box });
      const { mode, share } = await dominant(scratch, png);
      results[screen][label] = { selector, text, background: mode, backgroundShare: Math.round(share * 100) / 100, ratio: ratio(text, mode) };
    }
  }
  await context.close();
  return results;
}

if (process.argv[1] && /contrast\.mjs$/.test(process.argv[1])) {
  const server = await serve(dist);
  const browser = await launch();
  try {
    const measured = await measureContrast(server.url, browser, { seed, locale: forced });
    const text = `${JSON.stringify(measured, null, 2)}\n`;
    if (out) writeFileSync(out, text);
    for (const [screen, styles] of Object.entries(measured)) {
      console.log(`== ${screen}`);
      for (const [label, r] of Object.entries(styles)) console.log(`  ${label.padEnd(24)} ${String(r.ratio).padStart(6)}  text rgb(${r.text}) on rgb(${r.background}) (${Math.round(r.backgroundShare * 100)}% of box)`);
    }
  } finally {
    await browser.close();
    server.close();
  }
}
