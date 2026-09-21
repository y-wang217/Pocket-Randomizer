/**
 * The text census: words at rest, per surface and per component.
 *
 * **Milestone M0.1.** The measuring tape the presentation milestones are
 * checked with, and the "before" column M7.2 reruns for its delta.
 *
 *   npx vite-node scripts/visual/census.ts --write   # write the table
 *   npx vite-node scripts/visual/census.ts --check   # print the delta
 *
 * `--check` never fails. Measurement cannot fail the bible, which is M0.1's
 * own "kills it" line, and `scripts/check.mjs` mounts it as a non-blocking
 * leg for the same reason.
 *
 * ## What is counted
 *
 * Design bible section 4: **words at rest, excluding proper nouns and bare
 * numbers.** Section 11 defines "at rest" as what a surface shows with nothing
 * pressed, hovered or expanded, so the page is never touched: no hover, no
 * focus, no long press, and every tooltip stays closed. A word behind a tap is
 * not on this table, by construction.
 *
 * ## Per surface *and* per component, which is discrepancy D2
 *
 * Section 4 budgets seventeen rows and six of them are components rather than
 * screens — the move card appears on six surfaces, the type chip on nine. A
 * per-screen count cannot check a per-component budget: a move card three
 * words over disappears inside a screen total that is under. So every text
 * node is attributed twice, once to the surface it is on and once to the
 * nearest component that owns it, and `COMPONENTS` below is that list. Text
 * inside no component is attributed to the screen alone and appears in the
 * `screen chrome` row, which is where a screen drawing an attribute itself
 * shows up — the defect section 5 exists to prevent.
 *
 * ## Proper nouns
 *
 * A token is a proper noun when it is capitalised **and** its lowercase form
 * is in the lexicon built by `properNouns()` from `src/data/`: species, moves,
 * abilities, items, relics, locales, gym leaders and nicknames.
 *
 * Both halves are load-bearing. Four locale names — Cave, Shore, Summit,
 * City — are ordinary words pressed into service as names, and the lexicon
 * alone would delete them from an event prompt that happens to mention a cave.
 * Requiring the capital keeps the name and counts the noun.
 *
 * It is deliberately **not** a slot rule. "Opposing Golem" renders in
 * `.panel__name`, a slot that holds a name, and "Opposing" is a word the panel
 * spends against a budget of zero. Zeroing the slot would hide it. Counting
 * the tokens finds it.
 *
 * Known limitation, and it errs the safe way: a proper noun this repo does not
 * name — a species the pools do not carry, a move outside both pools — counts
 * as a word. The census over-counts rather than under-counts, which against a
 * ceiling is the error that cannot let a breach through.
 *
 * ## Glyphs are not words
 *
 * `GLYPH_SLOTS` names the elements whose text *is* the glyph: the three-letter
 * status chip and the stat-stage multiplier, which section 2 canonises, and
 * since D17B the move fact strip's icons, which it does not.
 *
 * **The strip's icons are the one entry section 2 does not name, and the
 * narrow list is the point.** They are `✥`, `↩`, `◎` — drawings that happen to
 * be characters, `aria-hidden`, with the decodable label on the chip that
 * holds each one. The first cut of D17B exempted *all* `aria-hidden` text on
 * the reasoning that a mark hidden from a screen reader carries no text load.
 * Measuring it showed that is too broad: the corner stamp is `aria-hidden` and
 * decorative, and it carries a seed string and a version a sighted player can
 * read. An exemption that quietly stopped counting those would be the census
 * lying about a surface to flatter a milestone. One selector, one reason.
 *
 * **Type and category chips are not on that list and their text is counted.**
 * Section 2 wants an 18-glyph type set and a fist/ring/wave category glyph;
 * what the tree renders today is the type name and `PHYS`/`SPEC`/`STAT`, and
 * R2 names both as load in as many words. Counting them is the point of the
 * census, not a defect in it. They fall off this table when M1.1 and M2.1 ship
 * the glyphs, and that fall is the delta M7.2 reads.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Browser, Page } from 'playwright';
import { build } from 'vite';

import { PHONE, launch, serve } from './browser.mjs';
import { GALLERY_SURFACES, type GallerySurface } from '../../src/ui/gallery-surfaces';
import { ABILITY_POOL } from '../../src/data/abilities';
import { GYMS } from '../../src/data/gyms';
import { BERRIES, CHOICE_ITEMS, MODEST_ITEMS, STAPLE_ITEMS, TYPE_ITEMS } from '../../src/data/items';
import { LOCALES } from '../../src/data/locales';
import { DAMAGING_MOVES, STATUS_MOVES } from '../../src/data/movePools';
import { NICKNAMES } from '../../src/data/nicknames';
import { RELICS } from '../../src/data/relics';
import { SPECIES_POOL } from '../../src/data/speciesPools';

export const CENSUS_PATH = join(process.cwd(), 'docs/design/text-census.md');

/** The three modes, as the settings store spells them. */
export const DENSITIES = ['detailed', 'simple', 'pocket'] as const;
export type Density = (typeof DENSITIES)[number];

/** The seed every fixture is rendered from, so two runs of this agree. */
export const CENSUS_SEED = 'SMOKE24';

/**
 * The components section 4 budgets separately from the screens they sit on.
 *
 * Attribution is to the **nearest** ancestor that matches, not to the first
 * entry in this list: the stat block sits inside the party row, and a list
 * order that decided it would charge the row for the block's words or the
 * other way round depending on how the array happened to be sorted. Walking
 * up from the text node and stopping at the first hit makes the answer a
 * property of the DOM instead.
 *
 * A component with no call site in the tree yet reports `absent` rather than
 * zero, because zero words and no component are different facts and only one
 * of them is done.
 */
export const COMPONENTS: readonly { id: string; selector: string; why: string }[] = [
  {
    id: 'battle move button',
    selector: 'button.move',
    why: 'Section 4 budgets it at 0. A button, where the card below is not.',
  },
  {
    id: 'move card',
    selector: '.move:not(button)',
    why: 'Section 4 budgets it at 0 across six card surfaces. Same classes as the button by design, so the tag is what separates them.',
  },
  {
    id: 'move chip',
    selector: '.move-chip',
    why: 'Section 4 budgets it at 0. M2.3 builds it; absent until then.',
  },
  {
    id: 'party row',
    selector: '.party__member',
    why: 'Section 4 budgets the party row and drawer at 0.',
  },
  {
    id: 'pokemon battle panel',
    selector: '.panel',
    why: 'Section 4 budgets it at 0.',
  },
  {
    id: 'flag strip',
    selector: '.flags',
    why: 'Section 4, Rev 2: one word per hit, added by discrepancy D7.',
  },
  {
    id: 'confirm overlay',
    selector: '.confirm-band',
    why: 'Section 4 budgets replace at 6 and decline at 4. One component, two copies.',
  },
  {
    id: 'stat block',
    selector: '.stats',
    why: 'Section 5 canonises it. Nested inside the party row, which is why attribution is nearest-ancestor.',
  },
  {
    id: 'app shell',
    selector: '.header, .shell__drawer-bar, .seedbar, .stamps',
    why: 'The header, drawer bar, seed bar and stamps are mounted once and render on every surface. Section 4 budgets surfaces, not the chrome around them, so this is broken out to be subtracted rather than silently charged to all sixteen.',
  },
];

/**
 * Elements whose text **is** a glyph, per section 2, and is not word load.
 *
 * Short list on purpose. An entry here is a claim that section 2 specifies
 * this element's text as the glyph's own form, not that the text is small.
 */
export const GLYPH_SLOTS: readonly { selector: string; why: string }[] = [
  {
    selector: '.chip--status',
    why: 'Section 2: the status family *is* a three-letter chip. BRN is the glyph.',
  },
  {
    selector: '.chip--stage',
    why: 'Section 2: stage as multiplier plus ladder. The multiplier is the glyph.',
  },
  {
    selector: '.move__fact-icon',
    why: "D17B: the fact strip's icons are drawings that happen to be characters. The chip around each one carries the decodable label.",
  },
];

/** Every capitalised name this repo knows, lowercased. */
export function properNouns(): Set<string> {
  const names = [
    ...SPECIES_POOL.map((entry) => entry.species),
    ...DAMAGING_MOVES.map((entry) => entry.name),
    ...STATUS_MOVES.map((entry) => entry.name),
    ...ABILITY_POOL,
    ...[...STAPLE_ITEMS, ...CHOICE_ITEMS, ...MODEST_ITEMS, ...TYPE_ITEMS, ...BERRIES].map((entry) => entry.name),
    ...RELICS.map((entry) => entry.name),
    ...LOCALES.map((entry) => entry.name),
    ...GYMS.map((entry) => entry.leader),
    ...NICKNAMES,
  ];
  const out = new Set<string>();
  // A multi-word name contributes each of its words: "Fire Punch" has to strip
  // "Fire" and "Punch" separately, because the card renders the name as text
  // and the tokeniser sees two tokens.
  for (const name of names) for (const word of tokenise(name)) out.add(word.toLowerCase());
  return out;
}

/** Split rendered text into candidate words, stripping edge punctuation. */
export function tokenise(text: string): string[] {
  return text
    .split(/[\s\u00a0]+/)
    .map((token) => token.replace(/^[^\p{L}\p{N}+]+|[^\p{L}\p{N}%]+$/gu, ''))
    .filter((token) => token.length > 0);
}

/**
 * A token that carries no word load: a bare number in any form the UI prints.
 *
 * `283`, `1/1`, `94%`, `2.0x`, `+2`, `-1`, `¼`, `½`, `·`. Not `Lv100`, which
 * is a field label welded to a number and is exactly the load R2 forbids.
 *
 * **The leading separator is D17B, ruled 2026-09-20.** A number split across
 * two elements arrives here as two tokens, and the second one starts with the
 * separator: section 3 requires PP's max be *dimmed*, dimming needs its own
 * span, and `24/24` therefore reaches this function as `24` and `/24`. The
 * first was a bare number and the second was a word, for a number the player
 * reads as one. Section 4 excludes bare numbers and this is one; the markup it
 * arrives in is not the counting rule's business.
 */
export function isBareNumber(token: string): boolean {
  return /^[+\-−]?[.,:/]?[\d]+(?:[.,:/][\d]+)*(?:%|x|×)?$/i.test(token) || /^[¼½¾·—–-]+$/.test(token);
}

export interface Record_ {
  surface: GallerySurface;
  density: Density;
  component: string | null;
  words: string[];
}

/** Pull every visible text node on the page, attributed to its component. */
async function readSurface(page: Page, components: readonly { id: string; selector: string }[], glyphs: readonly string[]): Promise<{ component: string | null; text: string }[]> {
  return page.evaluate(
    ({ components, glyphs }) => {
      const out: { component: string | null; text: string }[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = (node.textContent ?? '').trim();
        if (!text) continue;
        const host = node.parentElement;
        if (!host) continue;
        // At rest means visible without a gesture. An element with no client
        // rect is laid out to nothing; a closed tooltip is one of those.
        const style = getComputedStyle(host);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
        if (!host.getClientRects().length) continue;
        if (glyphs.some((selector) => host.closest(selector))) continue;
        // Nearest ancestor, not first list entry: walk up and stop at the
        // first element any component claims.
        let owner: string | null = null;
        for (let node: Element | null = host; node && !owner; node = node.parentElement) {
          const hit = components.find(({ selector }) => node?.matches(selector));
          if (hit) owner = hit.id;
        }
        out.push({ component: owner, text });
      }
      return out;
    },
    { components: components.map(({ id, selector }) => ({ id, selector })), glyphs },
  );
}

async function censusAll(url: string, browser: Browser): Promise<Record_[]> {
  const lexicon = properNouns();
  const records: Record_[] = [];
  const context = await browser.newContext({ viewport: PHONE });
  // The sprite host is unreachable in this sandbox and may hang rather than
  // refuse. Sprites are fixed-size boxes and carry no text, so aborting the
  // request changes nothing this script counts.
  await context.route(/play\.pokemonshowdown\.com/, (route) => route.abort());
  const page = await context.newPage();

  for (const density of DENSITIES) {
    for (const surface of GALLERY_SURFACES) {
      // A hash-only change does not reload, and the gallery reads its state
      // once at startup: without the reload every surface returns the first
      // one measured. Found the direct way.
      await page.goto(`${url}/gallery.html#seed=${CENSUS_SEED}&screen=${surface}&density=${density}&fixture=loaded`, { waitUntil: 'load' });
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('html[data-gallery-ready="true"]', { timeout: 60_000 });
      await page.evaluate(() => document.fonts.ready);
      // Nothing is touched after this point. The pointer is parked off the
      // document so no hover state can be inherited from the previous surface.
      await page.mouse.move(0, 0);
      await page.waitForTimeout(150);

      const nodes = await readSurface(page, COMPONENTS, GLYPH_SLOTS.map(({ selector }) => selector));
      for (const { component, text } of nodes) {
        const words = tokenise(text).filter((token) => {
          if (isBareNumber(token)) return false;
          const isCapitalised = /^\p{Lu}/u.test(token);
          return !(isCapitalised && lexicon.has(token.toLowerCase()));
        });
        if (words.length) records.push({ surface, density, component, words });
      }
    }
  }

  await context.close();
  return records;
}

function total(records: readonly Record_[]): number {
  return records.reduce((sum, record) => sum + record.words.length, 0);
}

export function renderTable(records: readonly Record_[]): string {
  const lines: string[] = [];
  lines.push('# Text census');
  lines.push('');
  lines.push('**Generated. Do not edit.** Rebuild with `npx vite-node scripts/visual/census.ts --write`.');
  lines.push('');
  lines.push('Milestone M0.1. Words at rest per design bible section 4, excluding proper');
  lines.push('nouns and bare numbers, counted per surface and per component (discrepancy');
  lines.push(`D2). Seed \`${CENSUS_SEED}\`, viewport ${PHONE.width}x${PHONE.height}, every fixture loaded.`);
  lines.push('');
  lines.push('The rules, the component list and the glyph list are in the script, each with');
  lines.push('its reason. Read them before reading a number.');
  lines.push('');

  lines.push('## Per surface');
  lines.push('');
  lines.push('The last column is the one section 4 budgets: the app shell renders on every');
  lines.push('surface and is not the surface, so its words are shown separately below and');
  lines.push('subtracted here.');
  lines.push('');
  lines.push('| Surface | detailed | simple | pocket | pocket, less shell |');
  lines.push('|---|---:|---:|---:|---:|');
  for (const surface of GALLERY_SURFACES) {
    const cells = DENSITIES.map((density) => total(records.filter((r) => r.surface === surface && r.density === density)));
    const bare = total(records.filter((r) => r.surface === surface && r.density === 'pocket' && r.component !== 'app shell'));
    lines.push(`| ${surface} | ${cells.join(' | ')} | ${bare} |`);
  }
  lines.push('');

  lines.push('## Per component');
  lines.push('');
  lines.push('Every instance on every surface, summed. A component absent from the tree says');
  lines.push('so rather than reading zero.');
  lines.push('');
  lines.push('| Component | detailed | simple | pocket |');
  lines.push('|---|---:|---:|---:|');
  for (const { id } of COMPONENTS) {
    const seen = records.some((r) => r.component === id);
    const cells = DENSITIES.map((density) => total(records.filter((r) => r.component === id && r.density === density)));
    lines.push(`| ${id} | ${seen ? cells.join(' | ') : 'absent | absent | absent'} |`);
  }
  const chrome = DENSITIES.map((density) => total(records.filter((r) => r.component === null && r.density === density)));
  lines.push(`| screen chrome (no component) | ${chrome.join(' | ')} |`);
  lines.push('');

  lines.push('## Every word counted, in Pocket');
  lines.push('');
  lines.push('The mode the bible specifies as the face. One row per surface, so a number');
  lines.push('above can be argued with rather than taken on faith.');
  lines.push('');
  for (const surface of GALLERY_SURFACES) {
    const words = records.filter((r) => r.surface === surface && r.density === 'pocket').flatMap((r) => r.words);
    lines.push(`- **${surface}** (${words.length}): ${words.length ? words.map((w) => `\`${w}\``).join(' ') : '_nothing_'}`);
  }
  lines.push('');
  return lines.join('\n');
}

async function main(): Promise<void> {
  const write = process.argv.includes('--write');
  const out = mkdtempSync(join(tmpdir(), 'gymrun-census-'));
  await build({
    configFile: join(process.cwd(), 'vite.gallery.config.ts'),
    logLevel: 'silent',
    build: { outDir: out, emptyOutDir: true, sourcemap: false, reportCompressedSize: false },
  });
  const server = await serve(out);
  const browser = await launch();
  try {
    const records = await censusAll(server.url, browser);
    const table = renderTable(records);
    if (write) {
      writeFileSync(CENSUS_PATH, table);
      console.log(`census: wrote ${CENSUS_PATH}`);
      return;
    }
    if (!existsSync(CENSUS_PATH)) {
      console.log('census: no table committed yet; run with --write');
      return;
    }
    const committed = readFileSync(CENSUS_PATH, 'utf8');
    if (committed === table) {
      console.log('census: unchanged');
      return;
    }
    // Non-blocking by M0.1's own "kills it": measurement cannot fail the bible.
    console.log('census: CHANGED. Per-surface deltas, Pocket less shell:');
    const before = new Map<string, number>();
    for (const line of committed.split('\n')) {
      const match = /^\| ([a-z-]+) \| \d+ \| \d+ \| \d+ \| (\d+) \|$/.exec(line);
      if (match) before.set(match[1] as string, Number(match[2]));
    }
    for (const surface of GALLERY_SURFACES) {
      const now = total(records.filter((r) => r.surface === surface && r.density === 'pocket' && r.component !== 'app shell'));
      const was = before.get(surface);
      if (was === undefined || was === now) continue;
      console.log(`  ${surface}: ${was} -> ${now} (${now > was ? '+' : ''}${now - was})`);
    }
    console.log('  rerun with --write to record it');
  } finally {
    await browser.close();
    server.close();
    rmSync(out, { recursive: true, force: true });
  }
}

await main();
