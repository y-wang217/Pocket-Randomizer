/**
 * Every player-facing sentence in GYMRUN, in one chart.
 *
 * ## Why this is generated and not written
 *
 * A copy audit typed out by hand is a snapshot of the day it was typed. It
 * goes stale on the first reword, and a stale audit is worse than none: it
 * reads as authority and states something the game no longer says. So the
 * chart is built from the tables themselves, and `docs/copy.md` is output
 * rather than source. **Rewrites land in the table, never in the chart.**
 *
 * ## What it covers, and the two things it cannot
 *
 * Every copy table under `data/` and `ui/copy/`, plus the strings `core/`
 * owns that reach a screen (`core/hpCopy.ts`, `core/typeMatchup.ts`). That is
 * the copy the project has already decided belongs in a table.
 *
 * What it cannot reach is a string still written inline in a component. Those
 * are listed by file and line in the last section, from a grep rather than
 * from an import, and that section shrinking to nothing is the point of it
 * existing. It is the working list for the next pass that moves a literal
 * into a table.
 *
 * The second thing it cannot reach is anything composed at runtime from a
 * template — `boostPhrase`, `flagWord`, `threatDetail`. The chart carries the
 * template and an example rather than the cross product, because the cross
 * product is thousands of rows and none of them is a sentence anyone writes.
 *
 * ## One row is one field, and the chart adds no punctuation of its own
 *
 * An earlier cut joined a name to its blurb with an em dash — `Leftovers —
 * Restores 1/16 max HP` — and that dash was the **chart's**, not the game's.
 * It cost nothing until the standing brief said no em dashes, at which point
 * half the rows appeared to break a rule none of them broke: a count over the
 * rendered chart said 249 of 496 strings carried one, and most of those were
 * this file's own joiner.
 *
 * So a row is exactly one field now. Two fields means two rows and two rewrite
 * boxes, keyed `<id> · name` and `<id> · blurb`, because the person filling in
 * a box is writing one string into one place in one file and the chart must
 * not put words between them.
 *
 * Run: `npm run copy-audit`.
 */
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { TIER_INFO, TIER_INFO_SHORT } from '../src/data/tierInfo';
import { BAND_INFO, BAND_MULTIHIT_NOTE } from '../src/data/bandInfo';
import { CATEGORY_INFO } from '../src/data/categoryInfo';
import { STAT_INFO, STAT_ORDER } from '../src/data/statInfo';
import { STATUS_INFO, VOLATILE_INFO, STATUS_PERSISTENCE_NOTE } from '../src/data/statusInfo';
import { FLAG_BLURBS } from '../src/data/flagWords';
import { MOVE_TAGS } from '../src/data/moveTags';
import { MOVE_FACT_INFO } from '../src/data/moveFactInfo';
import { ARCHETYPE_DISPLAY, ARCHETYPE_CAVEAT, ARCHETYPE_INTRO } from '../src/data/archetypes';
import { RELICS } from '../src/data/relics';
import { ITEMS } from '../src/data/items';
import { LOCALES } from '../src/data/locales';
import { GYMS } from '../src/data/gyms';
import { EVENTS } from '../src/data/events';
import { EVENT_ARCHETYPES } from '../src/data/eventPools';
import {
  CAPABILITY_LABELS,
  BAND_LABELS,
  RARITY_LABELS,
  TOLL_PAID_PREFIX,
} from '../src/data/eventCopy';
import { SEED_COPY } from '../src/data/seedCopy';
import { SCORE_LABELS } from '../src/data/scoring';
import { INTRO_COPY } from '../src/data/intro';
import {
  TUTORIAL,
  TUTORIAL_SCREENS,
  TUTORIAL_COPY,
  TUTORIAL_FORBIDDEN_WORDS,
} from '../src/data/tutorial';
import {
  STARTER_COPY,
  LOCALE_COPY,
  SHOP_COPY,
  PARTY_COPY,
  REPLACE_COPY,
  TARGET_COPY,
  TARGET_EFFECT,
  DENSITY_HEADING,
  DENSITY_COPY,
  BATTLE_SPEED_HEADING,
  BATTLE_SPEED_COPY,
  DRAWER_COPY,
  REWARD_COPY,
  CAPTURE_SOURCE,
  KIND_HINTS,
  CAPTURE_FULL,
  RELEASE_LABEL,
  RETURNS_TO_BAG,
  EVOLUTION_HEADING,
  EVOLUTION_LINE,
  EVOLUTION_CHOICE,
  carryingLine,
} from '../src/ui/copy/screens';
import { OUTCOME_WORDS, TIER_ROWS } from '../src/ui/copy/summary';
import * as hpCopy from '../src/core/hpCopy';
import { THREAT_TITLE, THREAT_EXPLAINER, NO_THREATS } from '../src/core/typeMatchup';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// Table building
// ---------------------------------------------------------------------------

interface Row {
  /** The key in its table, or the exported name. What a rewrite edits. */
  key: string;
  /** Detailed mode, or the only form. */
  text: string;
  /** Simple and Pocket, where the table carries a second form. */
  short?: string;
}

interface Section {
  title: string;
  /** Where these strings are on screen. One line, for the person rewriting. */
  where: string;
  /** The file a rewrite edits. */
  source: string;
  rows: Row[];
  /** Anything about the section that is not a row. */
  note?: string;
}

/** `1 string`, `8 strings`. A count nobody has to read past. */
function count(total: number): string {
  return total === 1 ? '1 string' : `${total} strings`;
}

/** A table cell. Pipes and newlines would break the row they sit in. */
function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();
}

const sections: Section[] = [];

function section(entry: Section): void {
  sections.push(entry);
}

/** A `Prose` table: every value is `{ long, short }`. */
function proseRows(table: Record<string, { long: string; short: string }>, prefix = ''): Row[] {
  return Object.entries(table).map(([key, value]) => ({
    key: `${prefix}${key}`,
    text: value.long,
    short: value.short,
  }));
}

// ---------------------------------------------------------------------------
// The sections, in the order a player meets them
// ---------------------------------------------------------------------------

section({
  title: 'Intro',
  where: 'The first-run modal, before the starter screen. Reopened from the header.',
  source: 'src/data/intro.ts',
  rows: [
    { key: 'title', text: INTRO_COPY.title },
    { key: 'body', text: INTRO_COPY.body },
    { key: 'dismiss', text: INTRO_COPY.dismiss },
    { key: 'tutorial', text: INTRO_COPY.tutorial },
    { key: 'replay', text: INTRO_COPY.replay },
  ],
});

section({
  title: 'Starter select',
  where: 'The first screen of a run: three cards, and the blurb above them.',
  source: 'src/ui/copy/screens.ts',
  rows: proseRows(STARTER_COPY),
});

section({
  title: 'Locale select',
  where: 'Before each segment: which region this one is walked through.',
  source: 'src/ui/copy/screens.ts',
  rows: proseRows(LOCALE_COPY),
});

section({
  title: 'Regions',
  where: 'The name and one line under each region on the locale screen.',
  source: 'src/data/locales.ts',
  rows: LOCALES.flatMap((locale) => [
    { key: `${locale.id} · name`, text: locale.name },
    { key: `${locale.id} · blurb`, text: locale.blurb },
  ]),
});

section({
  title: 'Gym leaders',
  where: 'The gym rail in the header, the pre-gym screen, and the locale screen.',
  source: 'src/data/gyms.ts',
  note: 'The type and the gym number are facts the screen computes, not copy. The leader\u2019s name and the one line under it are.',
  rows: GYMS.flatMap((gym) => [
    { key: `${gym.id} · leader`, text: gym.leader },
    { key: `${gym.id} · blurb`, text: gym.blurb },
  ]),
});

section({
  title: 'Node kinds',
  where: 'Under each option on the map’s current step.',
  source: 'src/ui/copy/screens.ts',
  rows: proseRows(KIND_HINTS),
});

section({
  title: 'Node tiers',
  where: 'On a wild or trainer card on the map. The line the whole risk gradient is read off.',
  source: 'src/data/tierInfo.ts',
  rows: (Object.keys(TIER_INFO) as (keyof typeof TIER_INFO)[]).map((tier) => ({
    key: tier,
    text: TIER_INFO[tier],
    short: TIER_INFO_SHORT[tier],
  })),
});

section({
  title: 'Events — the situation and the four buttons',
  where: 'The event screen: one hook, four labels, four hints. Three events per region.',
  source: 'src/data/events.ts',
  note:
    'Every event supplies the same nine strings. `safe`, `gamble`, `toll` and `attune` are the four '
    + 'archetypes; `attune` appears only when the run holds the relic the event requires.',
  rows: EVENTS.flatMap((event) => [
    { key: `${event.id} · hook`, text: event.hook },
    ...EVENT_ARCHETYPES.flatMap((archetype) => [
      { key: `${event.id} · ${archetype} · label`, text: event.labels[archetype] },
      { key: `${event.id} · ${archetype} · hint`, text: event.hints[archetype] },
    ]),
  ]),
});

section({
  title: 'Events — labels around the choice',
  where: 'The requirement chip, the standing chip, the rarity chip, and the price reveal.',
  source: 'src/data/eventCopy.ts',
  rows: [
    ...Object.entries(CAPABILITY_LABELS).map(([key, value]) => ({ key: `capability.${key}`, text: value })),
    ...Object.entries(BAND_LABELS).map(([key, value]) => ({ key: `band.${key}`, text: value })),
    ...Object.entries(RARITY_LABELS).map(([key, value]) => ({ key: `rarity.${key}`, text: value })),
    { key: 'TOLL_PAID_PREFIX', text: `${TOLL_PAID_PREFIX}: <price>` },
  ],
});

section({
  title: 'Battle — stats',
  where: 'Tapping any of the six stat labels on a panel.',
  source: 'src/data/statInfo.ts',
  rows: STAT_ORDER.flatMap((stat) => {
    const entry = STAT_INFO[stat];
    if (!entry) return [];
    return [
      { key: `${stat} · abbreviation`, text: entry.abbreviation },
      { key: `${stat} · label`, text: entry.label },
      { key: `${stat} · mechanics`, text: entry.mechanics },
    ];
  }),
});

section({
  title: 'Battle — move categories',
  where: 'Tapping the PHYS / SPEC / STAT badge on a move.',
  source: 'src/data/categoryInfo.ts',
  note:
    '`advice` is the one field in the copy tables that is written as guidance rather than as an '
    + 'attribute. Flagged, not changed — see the findings at the top of this file.',
  rows: Object.entries(CATEGORY_INFO).flatMap(([key, entry]) => [
    { key: `${key} · mechanics`, text: entry.mechanics },
    { key: `${key} · advice`, text: entry.advice },
  ]),
});

section({
  title: 'Battle — statuses',
  where: 'Tapping a status chip on a battle panel.',
  source: 'src/data/statusInfo.ts',
  note: `Shown under every entry: "${STATUS_PERSISTENCE_NOTE}"`,
  rows: Object.entries(STATUS_INFO).flatMap(([key, entry]) => [
    { key: `${key} · mechanics`, text: `${entry.label}. ${entry.mechanics}` },
    { key: `${key} · advice`, text: entry.advice },
  ]),
});

section({
  title: 'Battle — volatile conditions',
  where: 'Tapping a condition chip on a battle panel.',
  source: 'src/data/statusInfo.ts',
  rows: Object.entries(VOLATILE_INFO).flatMap(([key, entry]) => [
    { key: `${key} · mechanics`, text: `${entry.label}. ${entry.mechanics}` },
    { key: `${key} · advice`, text: entry.advice },
  ]),
});

section({
  title: 'Battle — what just happened',
  where: 'Tapping a flag word on the strip under the board.',
  source: 'src/data/flagWords.ts',
  note:
    'The words themselves (`Critical hit`, `Missed`, `Super effective`) are composed by `flagWord()` '
    + 'from the protocol’s own values. These are the sentences behind them.',
  rows: Object.entries(FLAG_BLURBS).map(([key, value]) => ({ key, text: value })),
});

section({
  title: 'Battle — move tags',
  where: 'On a move button and its detail panel.',
  source: 'src/data/moveTags.ts',
  rows: MOVE_TAGS.flatMap((tag) => [
    { key: `${tag.id} · name`, text: tag.long, short: tag.short },
    { key: `${tag.id} · blurb`, text: tag.blurb },
  ]),
});

section({
  title: 'Battle — the move fact strip',
  where: 'The icon row on a move button, and the panel each icon raises.',
  source: 'src/data/moveFactInfo.ts',
  rows: Object.entries(MOVE_FACT_INFO).flatMap(([key, entry]) => [
    { key: `${key} (${entry.icon}) · label`, text: entry.label },
    { key: `${key} (${entry.icon}) · blurb`, text: entry.blurb },
  ]),
});

section({
  title: 'Battle — move base-power bands',
  where: 'Tapping the BAND badge on a reward card or a move.',
  source: 'src/data/bandInfo.ts',
  note: `Shown under a multi-hit move: "${BAND_MULTIHIT_NOTE}"`,
  rows: Object.entries(BAND_INFO).flatMap(([key, entry]) => [
    { key: `band ${key} · label`, text: entry.label },
    { key: `band ${key} · range`, text: entry.range },
    { key: `band ${key} · text`, text: entry.text },
  ]),
});

section({
  title: 'Battle — stat shapes',
  where: 'The archetype chip on a stat block, and its panel.',
  source: 'src/data/archetypes.ts',
  note: `Intro: "${ARCHETYPE_INTRO}" — Caveat: "${ARCHETYPE_CAVEAT}"`,
  rows: Object.entries(ARCHETYPE_DISPLAY).flatMap(([key, entry]) => [
    { key: `${key} · name`, text: entry.long, short: entry.short },
    { key: `${key} · blurb`, text: entry.blurb },
  ]),
});

section({
  title: 'Battle — HP, PP and the result lines',
  where: 'Under a health bar, and on the result screen.',
  source: 'src/core/hpCopy.ts',
  rows: [
    { key: 'hpState', text: hpCopy.hpState(34, 63) },
    { key: 'hpStateBare', text: hpCopy.hpStateBare(34, 63) },
    { key: 'hpAfterDamage', text: hpCopy.hpAfterDamage('Vulpix', 34, 63) },
    { key: 'hpAfterHeal', text: hpCopy.hpAfterHeal('Vulpix', 20, 54, 63) },
    { key: 'ppState', text: hpCopy.ppState(7, 15) },
    { key: 'FAINTED', text: hpCopy.FAINTED },
    { key: 'FAINTED_REVIVES', text: hpCopy.FAINTED_REVIVES },
    { key: 'hpEventDelta', text: hpCopy.hpEventDelta(-0.2) },
    { key: 'outcomeTitle (won)', text: hpCopy.outcomeTitle(true) },
    { key: 'outcomeTitle (lost)', text: hpCopy.outcomeTitle(false) },
    { key: 'currencyLine', text: hpCopy.currencyLine(17, 63) },
    { key: 'currencyLine (none)', text: hpCopy.currencyLine(0, 63) },
    { key: 'faintedLine (none)', text: hpCopy.faintedLine(0) },
    { key: 'faintedLine (one)', text: hpCopy.faintedLine(1) },
    { key: 'RUN_ENDS', text: hpCopy.RUN_ENDS },
    { key: 'PARTY_AFTER', text: hpCopy.PARTY_AFTER },
    { key: 'TAKE_ONE', text: hpCopy.TAKE_ONE },
    { key: 'CARDS_ONLY_TITLE', text: hpCopy.CARDS_ONLY_TITLE },
    { key: 'CARDS_ONLY_BLURB', text: hpCopy.CARDS_ONLY_BLURB },
  ],
});

section({
  title: 'Battle — the threat readout',
  where: 'The coverage block on the result and party screens.',
  source: 'src/core/typeMatchup.ts',
  rows: [
    { key: 'THREAT_TITLE', text: THREAT_TITLE },
    { key: 'THREAT_EXPLAINER', text: THREAT_EXPLAINER },
    { key: 'NO_THREATS', text: NO_THREATS },
    { key: 'threatDetail', text: 'hits 2 of 3, unanswered' },
  ],
});

section({
  title: 'Rewards',
  where: 'The three cards on the result screen, and the lines under them.',
  source: 'src/ui/copy/screens.ts',
  rows: [
    ...proseRows(REWARD_COPY),
    { key: 'carryingLine', text: carryingLine(63).long, short: carryingLine(63).short },
  ],
});

section({
  title: 'Captures',
  where: 'The capture block after a wild win, and the release control on it.',
  source: 'src/ui/copy/screens.ts',
  rows: [
    ...proseRows(CAPTURE_SOURCE),
    { key: 'CAPTURE_FULL', text: CAPTURE_FULL.long, short: CAPTURE_FULL.short },
    { key: 'RELEASE_LABEL', text: RELEASE_LABEL('Swablu').long, short: RELEASE_LABEL('Swablu').short },
    { key: 'RETURNS_TO_BAG', text: RETURNS_TO_BAG.long, short: RETURNS_TO_BAG.short },
  ],
});

section({
  title: 'Learning a move',
  where: 'The target picker and the replace screen.',
  source: 'src/ui/copy/screens.ts',
  rows: [
    ...proseRows(TARGET_COPY, 'target.'),
    ...proseRows(REPLACE_COPY, 'replace.'),
    { key: 'effect.known', text: TARGET_EFFECT.known('Flamethrower').long, short: TARGET_EFFECT.known('Flamethrower').short },
    { key: 'effect.free', text: TARGET_EFFECT.free('Flamethrower').long, short: TARGET_EFFECT.free('Flamethrower').short },
    { key: 'effect.choose', text: TARGET_EFFECT.choose('Flamethrower').long, short: TARGET_EFFECT.choose('Flamethrower').short },
  ],
});

section({
  title: 'Evolution',
  where: 'The evolution block on a gym clear.',
  source: 'src/ui/copy/screens.ts',
  rows: [
    { key: 'EVOLUTION_HEADING', text: EVOLUTION_HEADING },
    {
      key: 'EVOLUTION_LINE',
      text: EVOLUTION_LINE('Swablu', 'Swablu', 'Altaria').long,
      short: EVOLUTION_LINE('Swablu', 'Swablu', 'Altaria').short,
    },
    {
      key: 'EVOLUTION_CHOICE',
      text: EVOLUTION_CHOICE('Eevee').long,
      short: EVOLUTION_CHOICE('Eevee').short,
    },
  ],
});

section({
  title: 'Shop',
  where: 'The shop screen and its shelf.',
  source: 'src/ui/copy/screens.ts',
  rows: proseRows(SHOP_COPY),
});

section({
  title: 'Party screen and drawer',
  where: 'The party screen, and the drawer that opens from any screen.',
  source: 'src/ui/copy/screens.ts',
  rows: [...proseRows(PARTY_COPY, 'party.'), ...proseRows(DRAWER_COPY, 'drawer.')],
});

section({
  title: 'Held items and berries',
  where: 'The reward card, the shop shelf, and the item slot on the party screen.',
  source: 'src/data/items.ts',
  note: 'An item\u2019s name is the dex\u2019s and the engine keys on it, so only the blurb is rewritable. Both are listed; the name is here to read the blurb against.',
  rows: ITEMS.flatMap((item) => [
    { key: `${item.id} · name (fixed)`, text: item.name },
    { key: `${item.id} · blurb`, text: item.blurb },
  ]),
});

section({
  title: 'Relics',
  where: 'The relic card, the party screen’s relic list, and the drawer.',
  source: 'src/data/relics.ts',
  rows: RELICS.flatMap((relic) => [
    { key: `${relic.id} · name`, text: relic.name },
    { key: `${relic.id} · description`, text: relic.playerDescription },
  ]),
});

section({
  title: 'Settings',
  where: 'The three pickers in the drawer.',
  source: 'src/ui/copy/screens.ts',
  rows: [
    { key: `heading · ${DENSITY_HEADING}`, text: DENSITY_HEADING },
    ...Object.entries(DENSITY_COPY).flatMap(([key, value]) => [
      { key: `density.${key} · name`, text: value.name },
      { key: `density.${key} · description`, text: value.description },
    ]),
    { key: `heading · ${BATTLE_SPEED_HEADING}`, text: BATTLE_SPEED_HEADING },
    ...Object.entries(BATTLE_SPEED_COPY).flatMap(([key, value]) => [
      { key: `battleSpeed.${key} · name`, text: value.name },
      { key: `battleSpeed.${key} · description`, text: value.description },
    ]),
  ],
});

section({
  title: 'The seed bar',
  where: 'The seed controls in the header, and what they say when a paste is refused.',
  source: 'src/data/seedCopy.ts',
  rows: Object.entries(SEED_COPY).map(([key, value]) => ({ key, text: value })),
});

section({
  title: 'Run summary',
  where: 'The screen a run ends on.',
  source: 'src/ui/copy/summary.ts, src/data/scoring.ts',
  rows: [
    ...Object.entries(OUTCOME_WORDS).map(([key, value]) => ({ key: `outcome.${key}`, text: value })),
    ...TIER_ROWS.map((row) => ({ key: `tier ${row.range}`, text: row.copy, short: row.short })),
    ...Object.entries(SCORE_LABELS).map(([key, value]) => ({ key: `score.${key}`, text: value })),
  ],
});

section({
  title: 'Tutorial — the coach marks',
  where: 'First run, one screen at a time. Replayed from the header.',
  source: 'src/data/tutorial.ts',
  note:
    'Linted against a forbidden-word list in `test/tutorial.test.ts`: '
    + TUTORIAL_FORBIDDEN_WORDS.map((word) => `\`${word}\``).join(', ')
    + '.',
  rows: TUTORIAL_SCREENS.flatMap((screen) =>
    TUTORIAL[screen].map((mark) => ({
      key: `${screen}.${mark.id}`,
      text: `**${mark.title}** — ${mark.text}`,
    })),
  ),
});

section({
  title: 'Tutorial — the controls',
  where: 'The buttons on a coach mark.',
  source: 'src/data/tutorial.ts',
  rows: [
    { key: 'next', text: TUTORIAL_COPY.next },
    { key: 'done', text: TUTORIAL_COPY.done },
    { key: 'skip', text: TUTORIAL_COPY.skip },
    { key: 'replay', text: TUTORIAL_COPY.replay },
    { key: 'replayShort', text: TUTORIAL_COPY.replayShort },
    { key: 'progress', text: TUTORIAL_COPY.progress(2, 5) },
  ],
});

// ---------------------------------------------------------------------------
// The strings that are still literals in a component
// ---------------------------------------------------------------------------

/**
 * Inline copy, found by grep rather than by import.
 *
 * `textContent = '...'` and `.title = '...'` are where a player-facing string
 * hides when it never made it into a table. Listed with file and line so the
 * pass that moves them has a worklist; this section shrinking is the goal.
 */
function inlineLiterals(): { file: string; line: string; text: string }[] {
  const out: { file: string; line: string; text: string }[] = [];
  let raw = '';
  try {
    raw = execFileSync(
      'grep',
      [
        '-rnoE',
        String.raw`(textContent|\.title|\.label|placeholder|ariaLabel) = '[^']{2,}'`,
        'src/ui',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );
  } catch {
    // grep exits 1 on no matches, which is a result rather than a failure.
    return out;
  }
  for (const entry of raw.split('\n')) {
    const match = /^([^:]+):(\d+):(?:textContent|\.title|\.label|placeholder|ariaLabel) = '(.*)'$/.exec(entry);
    if (!match?.[1] || !match[2] || !match[3]) continue;
    // A one-word class-ish or id-ish value is not copy.
    if (/^[a-z0-9-]+$/.test(match[3]) && !match[3].includes(' ')) continue;
    // Nor is a separator glyph: an em dash between two fields is punctuation
    // the layout draws, and nobody rewrites it.
    if (!/[A-Za-z]/.test(match[3])) continue;
    out.push({ file: match[1], line: match[2], text: match[3] });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderSection(entry: Section, index: number): string {
  const lines: string[] = [];
  lines.push(`### ${index}. ${entry.title}`);
  lines.push('');
  lines.push(`${entry.where}`);
  lines.push('');
  lines.push(`Source: \`${entry.source}\` · ${count(entry.rows.length)}`);
  lines.push('');
  if (entry.note) {
    lines.push(`> ${entry.note}`);
    lines.push('');
  }
  const hasShort = entry.rows.some((row) => row.short !== undefined);
  lines.push(hasShort ? '| Key | Detailed | Simple / Pocket | Rewrite |' : '| Key | Text | Rewrite |');
  lines.push(hasShort ? '|---|---|---|---|' : '|---|---|---|');
  for (const row of entry.rows) {
    lines.push(
      hasShort
        ? `| \`${cell(row.key)}\` | ${cell(row.text)} | ${cell(row.short ?? '—')} |  |`
        : `| \`${cell(row.key)}\` | ${cell(row.text)} |  |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

function render(): string {
  const total = sections.reduce((sum, entry) => sum + entry.rows.length, 0);
  const inline = inlineLiterals();
  const lines: string[] = [];

  lines.push('# Every player-facing string in GYMRUN');
  lines.push('');
  lines.push(
    '**Generated. Do not edit this file.** `npm run copy-audit` rebuilds it from the tables. '
    + 'A rewrite goes in the table named under each heading, and this file catches up on the next run.',
  );
  lines.push('');
  lines.push(
    `${count(total)} across ${sections.length} surfaces, plus ${inline.length} still written inline in a component.`,
  );
  lines.push('');
  lines.push('## How to use the chart');
  lines.push('');
  lines.push(
    'The **Rewrite** column is empty on purpose: fill it in, then move the new wording into the source '
    + 'file. The **Key** column is the key in that file’s table, so a rewrite is a find on the key '
    + 'rather than a hunt for the sentence.',
  );
  lines.push('');
  lines.push(
    'Where a table carries two forms, **Detailed** is the full wording and **Simple / Pocket** is the '
    + 'short one. The short form must say the same fact in fewer words, and must never drop the part '
    + 'that is the rule — "permanent", "no undo", "nothing is bought until you leave". A warning that '
    + 'survives only in Detailed is a warning the density mode removed.',
  );
  lines.push('');
  lines.push('## The voice');
  lines.push('');
  lines.push(
    '> Concise, aloof, assumes the player is already not really paying attention, so gets straight to '
    + 'the point. No fluff. No em dashes.',
  );
  lines.push('');
  lines.push(
    'The author\u2019s standing brief, recorded here because this is the document a rewrite is done '
    + 'from. It is not yet what the game sounds like: the live copy is discursive, fond of a '
    + 'subordinate clause, and leans on the em dash as its main joint. Every row below is a string '
    + 'written before the brief existed.',
  );
  lines.push('');
  lines.push(
    'Note the one place the brief and the mechanics pull against each other. Several strings are '
    + 'long because they carry a rule the player cannot be allowed to miss \u2014 "permanent", "no '
    + 'undo", "nothing is bought until you leave". Cutting those to length drops the warning, which '
    + 'is the one edit the density-mode rule already forbids. Short and complete, not short.',
  );
  lines.push('');
  lines.push('## The rule every one of these is written under');
  lines.push('');
  lines.push(
    '`CLAUDE.md`, Player-facing copy: **the UI presents attributes, never verdicts.** No '
    + 'recommendations, no "best" markers, no scores or ratings, no highlighting that distinguishes a '
    + 'superior option, no ordering that implies ranking, no effectiveness against content the player '
    + 'has not reached. The one exception is live type effectiveness against the Pokemon currently on '
    + 'the field.',
  );
  lines.push('');
  lines.push('## Where the rule is currently broken');
  lines.push('');
  lines.push(
    'Two tables carry an `advice` field, and an `advice` field is a verdict by construction. They are '
    + 'listed here rather than quietly rewritten, because which way they go is a design call:',
  );
  lines.push('');
  lines.push(
    '- `src/data/statusInfo.ts` — 22 `advice` lines. "usually better than rolling the dice", "worth '
    + 'the switch almost every time", "the harshest status in the game". `statInfo.ts`’s own header '
    + 'says this line "is deliberately not walked here", which reads as the file next door knowing.',
  );
  lines.push(
    '- `src/data/categoryInfo.ts` — 3 `advice` lines. "wants these moves and almost nothing else", '
    + '"often the reason to reach for one", "Worth it when you can survive the reply".',
  );
  lines.push('');
  lines.push(
    'The case for keeping them is that they teach the interface rather than the game, which is the '
    + 'distinction `statInfo.ts` draws. The case against is that a player reading "switching is usually '
    + 'better" has been handed the decision. Either answer is defensible; the tables currently hold '
    + 'both.',
  );
  lines.push('');
  lines.push('## The chart');
  lines.push('');
  for (const [index, entry] of sections.entries()) {
    lines.push(renderSection(entry, index + 1));
  }

  lines.push(`### ${sections.length + 1}. Still inline in a component`);
  lines.push('');
  lines.push(
    'Found by grep, not by import: a string assigned straight to `textContent`, `title`, `label`, '
    + '`placeholder` or `ariaLabel` under `src/ui`. These are headings and button faces that never made it '
    + 'into a copy table, so they have no short form and no density mode. **This section shrinking to '
    + 'nothing is the point of it.**',
  );
  lines.push('');
  lines.push(`${count(inline.length)}.`);
  lines.push('');
  /*
   * The path inside the backticks and the line number outside them.
   *
   * `test/boundaries.test.ts` resolves every backticked path in every live
   * document against the tree, and `file.ts:117` is not a path — it caught
   * this chart naming 46 of them. Split, each one resolves, which means the
   * generated chart is now **checked**: a row naming a file that has since
   * moved fails the suite rather than sending a reader nowhere, and
   * `npm run copy-audit` is the fix.
   */
  lines.push('| Where | Text | Rewrite |');
  lines.push('|---|---|---|');
  for (const row of inline) {
    lines.push(`| \`${row.file}\` line ${row.line} | ${cell(row.text)} |  |`);
  }
  lines.push('');

  return `${lines.join('\n')}\n`;
}

const target = resolve(ROOT, 'docs/copy.md');
writeFileSync(target, render(), 'utf8');
process.stdout.write(`Wrote ${target}\n`);

/*
 * The same chart as data, on request only.
 *
 * `COPY_AUDIT_JSON=<path> npm run copy-audit` writes the sections as JSON
 * beside the Markdown, for anything that wants to render the chart rather
 * than read it. Off by default and never written into the repo: the chart's
 * one checked-in form is `docs/copy.md`, and a second generated file that
 * nothing in the build reads is a file that goes stale unnoticed.
 */
const jsonTarget = process.env['COPY_AUDIT_JSON'];
if (jsonTarget) {
  const payload = {
    generated: new Date().toISOString().slice(0, 10),
    total: sections.reduce((sum, entry) => sum + entry.rows.length, 0),
    sections: sections.map((entry) => ({
      title: entry.title,
      where: entry.where,
      source: entry.source,
      note: entry.note ?? null,
      rows: entry.rows,
    })),
    inline: inlineLiterals(),
  };
  writeFileSync(jsonTarget, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  process.stdout.write(`Wrote ${jsonTarget}\n`);
}
