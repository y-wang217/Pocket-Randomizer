/**
 * V3.1 and V3.6: the map, scrolled, under a throttled CPU, as a trace.
 *
 *   node scripts/visual/perf.mjs [--locale marsh] [--out file.json] [--dist dist]
 *
 * The plan's gate is a Chrome performance trace on a mid-range Android at 390
 * wide while the map scrolls: no frame over 16ms, paint under 4ms a frame.
 * There is no phone here, so this is the proxy the overnight prompt names:
 * headless Chromium at 390x844 with the CPU throttled 4x, a `devtools.timeline`
 * trace over two seconds of wheel scrolling, and from it the frame times
 * (consecutive DrawFrame events) and the paint time per frame (Paint events
 * between them). Reported as p95 and mean, and flagged in every report as a
 * proxy: verify on a real phone.
 */
import { writeFileSync } from 'node:fs';

import { launch, openApp, playUntil, serve } from './browser.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(name);
  return at === -1 ? null : args[at + 1];
};
const out = flag('--out');
const dist = flag('--dist') ?? 'dist';
const locale = flag('--locale');
const NAMES = { cave: 'Cave', shore: 'Shore', summit: 'Summit', city: 'City', forest: 'Forest', ruins: 'Ruins', marsh: 'Marsh', badlands: 'Badlands' };

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
}

export async function traceMapScroll(url, browser, { locale: forced = null, throttle = 4, seed = 'SMOKE24' } = {}) {
  const { page, context } = await openApp(browser, url, seed);
  await playUntil(page, (screen) => screen === 'map');
  if (forced) {
    await page.evaluate(
      ([id, name]) => {
        globalThis.document.documentElement.setAttribute('data-locale', id);
        const map = globalThis.document.querySelector('.screen[data-screen="map"]');
        if (map) map.setAttribute('data-watermark', name);
      },
      [forced, NAMES[forced] ?? forced],
    );
  }
  await page.mouse.move(195, 500);
  await page.waitForTimeout(500);

  const client = await context.newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await page.waitForTimeout(200);

  await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline.frame'] });
  // Two seconds of wheel scrolling down and back, the way a thumb would.
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(0, 60);
    await page.waitForTimeout(50);
  }
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(0, -60);
    await page.waitForTimeout(50);
  }
  const trace = JSON.parse((await browser.stopTracing()).toString('utf8'));
  await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await context.close();

  const events = trace.traceEvents ?? trace;
  /*
   * Frames are the main thread's: one BeginMainThreadFrame per frame it
   * produced. Headless Chromium draws only when something changes, so the
   * *interval* between frames is the wheel cadence and says nothing about
   * cost; what has to fit in 16ms is the work the main thread did to make the
   * frame, which is the sum of its style, layout, paint, layerize, script and
   * input phases between one frame start and the next. That is the gate
   * metric. The interval is kept for reference.
   */
  const starts = events.filter((e) => e.name === 'BeginMainThreadFrame' && typeof e.ts === 'number').map((e) => e.ts).sort((a, b) => a - b);
  const WORK = new Set(['UpdateLayoutTree', 'Layout', 'PrePaint', 'Paint', 'Layerize', 'FunctionCall', 'EventDispatch', 'HitTest', 'ScrollLayer', 'UpdateLayerTree', 'CompositeLayers']);
  const work = events.filter((e) => WORK.has(e.name) && typeof e.dur === 'number');
  const paints = work.filter((e) => e.name === 'Paint');
  const draws = events.filter((e) => e.name === 'DrawFrame' && typeof e.ts === 'number').map((e) => e.ts).sort((a, b) => a - b);
  const sumIn = (list, from, to) => list.filter((e) => e.ts >= from && e.ts < to).reduce((sum, e) => sum + e.dur, 0) / 1000;
  const workMs = [];
  const paintMs = [];
  for (let i = 0; i < starts.length; i++) {
    const from = starts[i];
    const to = starts[i + 1] ?? from + 1_000_000;
    workMs.push(sumIn(work, from, to));
    paintMs.push(sumIn(paints, from, to));
  }
  const intervalMs = draws.slice(1).map((ts, i) => (ts - draws[i]) / 1000);
  const round = (n) => (n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 100) / 100);
  const stats = (list) => ({
    mean: round(list.reduce((a, b) => a + b, 0) / (list.length || 1)),
    p95: round(percentile(list, 0.95)),
    max: round(list.length ? Math.max(...list) : 0),
  });
  return {
    locale: forced,
    throttle,
    frames: starts.length,
    /** Main-thread work per frame, ms. The gate: p95 under 16. */
    frameWorkMs: stats(workMs),
    /** Paint per frame, ms. The gate: mean under 4. */
    paintMs: stats(paintMs),
    /** Interval between drawn frames, ms. Reference only; it is the wheel cadence. */
    frameIntervalMs: stats(intervalMs),
    paintEvents: paints.length,
  };
}

if (process.argv[1] && /perf\.mjs$/.test(process.argv[1])) {
  const server = await serve(dist);
  const browser = await launch();
  try {
    const result = await traceMapScroll(server.url, browser, { locale });
    const text = `${JSON.stringify(result, null, 2)}\n`;
    console.log(text);
    if (out) writeFileSync(out, text);
  } finally {
    await browser.close();
    server.close();
  }
}
