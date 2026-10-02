/* global URL, process, console, document, window, getComputedStyle */
// Stage 5.0/0 spike. Throwaway. Serves spike/ and screenshots each page at the
// phone and desktop sizes, and measures fit. Run: node spike/shoot.mjs <outdir>
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = new URL('.', import.meta.url).pathname;
const out = process.argv[2] ?? join(root, 'shots');
mkdirSync(out, { recursive: true });
const cache = join(root, '.cache');
mkdirSync(cache, { recursive: true });
const types = { '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.js': 'text/javascript' };
const server = createServer(async (req, res) => {
  try {
    const path = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const PHONE = { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const DESKTOP = { width: 1366, height: 768, deviceScaleFactor: 1 };
const shots = [
  ['battle', '/battle.html', PHONE, 'phone'],
  ['battle', '/battle.html', DESKTOP, 'desktop'],
  ['battle-missing', '/battle.html?missing=1', PHONE, 'phone'],
  ...[0, 1, 2, 3, 4, 'worst'].map((c) => [`map-${c}`, `/map.html?case=${c}`, PHONE, 'phone']),
  ['map-3', '/map.html?case=3', DESKTOP, 'desktop'],
  ['map-worst', '/map.html?case=worst', { width: 1366, height: 768, deviceScaleFactor: 1 }, 'desktop'],
];
const browser = await chromium.launch(existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
const report = [];
for (const [name, path, viewport, label] of shots) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.deviceScaleFactor, isMobile: viewport.isMobile ?? false, hasTouch: viewport.hasTouch ?? false });
  // Headless Chromium does not use the sandbox's proxy; fetch CDN sprites with
  // curl (which does, with TLS verification on) into a cache and serve them.
  await context.route('https://play.pokemonshowdown.com/**', async (route) => {
    const url = route.request().url();
    const cached = join(cache, createHash('sha1').update(url).digest('hex'));
    if (!existsSync(cached)) {
      try { execFileSync('curl', ['-sSf', '-o', cached, url]); } catch { return route.fulfill({ status: 404, body: '' }); }
    }
    return route.fulfill({ status: 200, contentType: 'image/png', body: await readFile(cached) });
  });
  const page = await context.newPage();
  await page.goto(base + path, { waitUntil: 'networkidle' });
  const fit = await page.evaluate(() => {
    const doc = document.scrollingElement;
    const frame = document.getElementById('frame');
    const inner = [...frame.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 1 && getComputedStyle(e).overflowY !== 'visible');
    const targets = [...document.querySelectorAll('button, [data-tap]')].filter((e) => e.offsetParent !== null).map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0);
    const small = targets.filter((r) => r.width < 44 || r.height < 44).length;
    const overflowBottom = Math.max(0, ...[...frame.querySelectorAll('*')].map((e) => e.getBoundingClientRect().bottom)) - frame.getBoundingClientRect().bottom;
    return { pageScroll: doc.scrollHeight > doc.clientHeight || doc.scrollWidth > doc.clientWidth, innerScrollers: inner.length, targets: targets.length, under44: small, overflowBottom: Math.round(overflowBottom), extra: window.__fit ?? null };
  });
  const file = `${name}-${label}-${viewport.width}x${viewport.height}.png`;
  await page.screenshot({ path: join(out, file) });
  report.push({ file, ...fit });
  await context.close();
}
await browser.close();
server.close();
writeFileSync(join(out, 'fit.json'), JSON.stringify(report, null, 1));
console.table(report.map(({ extra, ...r }) => ({ ...r, extra: extra ? JSON.stringify(extra) : '' })));
