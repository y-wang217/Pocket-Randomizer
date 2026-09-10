/**
 * `BAND n` on every move, everywhere a move renders. **R12.**
 *
 * @vitest-environment jsdom
 *
 * Stage 4.6b put the band badge on the reward card and nowhere else, and the
 * card it was missing from was the one that mattered: a player offered a band 3
 * read `BAND 3` on the offer, then compared it against four *unlabelled* moves
 * on the replacement screen and four unlabelled buttons in the next fight. The
 * badge exists to make that comparison possible and it was absent from both
 * halves of it.
 *
 * **Asserted per surface, not once.** That is the prompt's instruction and it is
 * not pedantry: a badge that renders through one shared component still reaches
 * a screen only if that screen passes the band in, and eight surfaces reach the
 * component by five different routes. A single assertion on the reward card is
 * exactly what passed for two stages while seven surfaces printed nothing.
 *
 * ## The instrument
 *
 * Every check reads the move's *name* out of the rendered card, asks
 * `bandOfMove` what that name's band is, and asserts the badge against the
 * answer — including the negative, where the table says null and the card must
 * print nothing. So the test cannot pass by rendering a plausible number: it
 * fails if the badge disagrees with the table, and it fails if a status move
 * grows a bracket that does not apply to it.
 *
 * Nothing here is about layout. Whether the badge *fits* on a 390-wide move
 * button is a question with no meaning in jsdom, which has no layout engine, so
 * it lives in `scripts/smoke.mjs` and in `docs/visual/baseline/heights.json`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { createBattle, describeMove } from '../src/core/battle/driver';
import { buildBattleUiView } from '../src/core/battle/view';
import { createParty } from '../src/core/party';
import { createRun, playRun, scriptedRunPolicy, type RunResult } from '../src/core/run';
import type { PokemonState } from '../src/core/types';
import { abilityEffects } from '../src/data/abilityEffects';
import { gymForSegment } from '../src/data/gyms';
import { OPPONENT_TEAM, PLAYER_TEAM } from '../src/data/mons';
import { bandOfMove } from '../src/data/moveOverrides';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { createDrawer } from '../src/ui/drawer';
import { createScene } from '../src/ui/scene';
import { createMoveReplaceScreen } from '../src/ui/screens/move-replace';
import { createPartyScreen } from '../src/ui/screens/party';
import { createPreGymScreen } from '../src/ui/screens/pre-gym';
import { renderRewardCard } from '../src/ui/screens/reward';
import { createSummary } from '../src/ui/screens/summary';
import { resetSettings } from '../src/ui/settings';

const ROOT = process.cwd();

const ROSTER = [
  // Four damaging moves each, spread across bands, so every card on every
  // surface has a badge to print and the parties are not all band 1.
  { species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam', 'Earthquake', 'Crunch', 'Rest'], level: 40 },
  { species: 'Lapras', ability: 'Water Absorb', moves: ['Surf', 'Ice Beam', 'Thunderbolt', 'Sing'], level: 40 },
  { species: 'Gengar', ability: 'Levitate', moves: ['Shadow Ball', 'Sludge Bomb', 'Thunderbolt', 'Toxic'], level: 40 },
];

function party(): PokemonState[] {
  return createParty(ROSTER);
}

/**
 * Every move card under `root`, checked against the table rather than a literal.
 *
 * Returns how many badges it found, so a caller can insist a surface actually
 * labelled something — a surface whose every move happened to be a status move
 * would otherwise pass this vacuously.
 */
function bandsOn(root: ParentNode, surface: string): number {
  const cards = [...root.querySelectorAll('.move')];
  expect(cards.length, `${surface}: rendered no move at all`).toBeGreaterThan(0);

  let labelled = 0;
  for (const card of cards) {
    const name = card.querySelector('.move__name')?.textContent ?? '';
    expect(name, `${surface}: a move card with no name`).not.toBe('');
    const expected = bandOfMove(name);
    const badge = card.querySelector('.band');

    if (expected === null) {
      // The negative half, and the half a plausible change breaks: a status
      // move has no bracket, so it prints no badge rather than an empty one.
      expect(badge, `${surface}: ${name} has no band and must print none`).toBeNull();
      continue;
    }

    expect(badge, `${surface}: ${name} should carry BAND ${expected}`).not.toBeNull();
    expect(badge?.textContent, `${surface}: ${name}`).toBe(`BAND ${expected}`);
    // Through the one chip component, wearing the one tooltip hook. Not a
    // second mechanism and not a second text.
    expect(badge?.classList.contains('chip'), `${surface}: ${name}`).toBe(true);
    expect((badge as HTMLElement).dataset['tip'], `${surface}: ${name}`).toBe(`band:${expected}`);
    labelled++;
  }

  expect(labelled, `${surface}: labelled no move, so it asserts nothing`).toBeGreaterThan(0);
  return labelled;
}

beforeEach(() => {
  resetSettings();
  document.body.replaceChildren();
});

// ---------------------------------------------------------------------------
// Test 1: every surface in the R12 report list, asserted per surface
// ---------------------------------------------------------------------------

describe('the band badge renders on every surface that renders a move', () => {
  it('1. the reward card — screens/reward.ts', () => {
    const state = createRun('R12BAND', DEFAULT_TUNING);
    const card = renderRewardCard({ kind: 'tm', move: 'Ice Beam' }, state, () => undefined);
    bandsOn(card, 'reward card');

    /*
     * And it is no longer beside the reward's name.
     *
     * That was its home from 4.6b to R12, and the move is the whole point: a
     * badge on the *card* is a badge on the four moves the player is comparing
     * this one against, because the card is the shared component and the name
     * is this screen's own markup.
     */
    expect(card.querySelector('.reward__name .band')).toBeNull();
    expect(card.querySelector('.move .band')).not.toBeNull();
  });

  it('2. the battle move button — scene.ts, from the projection', () => {
    const session = createBattle({ teams: { p1: PLAYER_TEAM, p2: OPPONENT_TEAM }, seed: 'R12BAND' });
    const view = buildBattleUiView(session.factsFor('p1'), { ability: true, item: true }, abilityEffects);

    // The projection's own field first: the button can only be right if what it
    // is handed is right, and `powerBand` must be `bandOfMove` and not a second
    // reading of base power.
    for (const move of view.moves) {
      expect(move.powerBand, `${move.name} on the projection`).toBe(bandOfMove(move.name));
    }

    const scene = createScene();
    scene.update(view, () => undefined);
    bandsOn(scene.root.querySelector('.moves') ?? scene.root, 'battle move button');
  });

  it('3. the party drawer — drawer.ts, through member-card.ts', () => {
    const drawer = createDrawer();
    const members = party();
    drawer.open({ party: members, holding: members.map(() => null), relics: [], tuning: DEFAULT_TUNING });
    // Four moves per member, and the drawer shows every member.
    expect(bandsOn(drawer.root, 'party drawer')).toBeGreaterThan(ROSTER.length);
  });

  it('4. the party management screen — screens/party.ts, through member-card.ts', () => {
    const screen = createPartyScreen();
    screen.render(
      { party: party(), backpack: [], relics: [], tuning: DEFAULT_TUNING, plan: null },
      { onReorder: () => undefined, onRelease: () => undefined, onPlan: () => undefined, onDone: () => undefined },
    );
    bandsOn(screen.root, 'party screen');
  });

  it('5. the pre-gym screen — screens/pre-gym.ts, through member-card.ts', () => {
    const screen = createPreGymScreen();
    const members = party();
    screen.render(
      { gym: gymForSegment(0), segment: 0, party: members, holding: members.map(() => null), tuning: DEFAULT_TUNING },
      { onLead: () => undefined, onManageParty: () => undefined },
    );
    bandsOn(screen.root, 'pre-gym screen');
  });

  it('6 and 7. the replacement screen — the incoming move and the four it could displace', () => {
    const screen = createMoveReplaceScreen();
    const member = party()[0];
    if (!member) throw new Error('no member to teach');
    const incoming = describeMove('Ice Beam');
    if (!incoming) throw new Error('Ice Beam is not in the dex');

    screen.render(member, incoming, () => undefined, DEFAULT_TUNING);

    /*
     * The definition of done, as one assertion.
     *
     * "A player comparing an incoming band 3 against four current moves sees
     * five labelled cards, and the label looks the same on all five." Both
     * halves are checked separately because they are built by different
     * functions — `moveCard` for the incoming one, `moveFacts` for the four —
     * and it was possible for either to grow the badge without the other.
     */
    bandsOn(screen.root.querySelector('.replace__incoming') ?? screen.root, 'replacement, incoming');
    bandsOn(screen.root.querySelector('.replace__moves') ?? screen.root, 'replacement, given up');

    // Ice Beam is a band 3 move, so this really is the case the brief names.
    expect(bandOfMove('Ice Beam')).toBe(3);
    const shown = [...screen.root.querySelectorAll('.move')].filter((card) => card.querySelector('.band'));
    expect(shown.length, 'five cards, minus any status move among the four').toBeGreaterThan(3);
  });

  it('8. the run summary — screens/summary.ts', async () => {
    const result: RunResult = await playRun('SMOKE24', scriptedRunPolicy(greedyAiPolicy), undefined, {
      opponent: greedyAiPolicy,
    });
    const summary = createSummary();
    summary.render(result);
    bandsOn(summary.root, 'run summary');
  }, 90_000);
});

// ---------------------------------------------------------------------------
// Test 1, the other half: one resolution path, and one insertion point
// ---------------------------------------------------------------------------

describe('one band, resolved one way', () => {
  function uiFiles(): string[] {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        return statSync(full).isDirectory() ? walk(full) : full.endsWith('.ts') ? [full] : [];
      });
    return walk(join(ROOT, 'src/ui'));
  }

  function code(file: string): string {
    return readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  }

  /**
   * **No screen resolves a band.** This is the rule R12 exists to restore.
   *
   * `screens/reward.ts` called `bandOfMove` itself, which made it the second
   * place in the codebase that decided what a move's band was — the first being
   * the adapter, which had already put the answer on `MoveExplanation.band`.
   * Two callers of one table is how the reward card and the battle button end
   * up disagreeing about Population Bomb.
   */
  it('resolves bandOfMove nowhere under src/ui/', () => {
    const offenders = uiFiles()
      .filter((file) => /\bbandOfMove\s*\(/.test(code(file)))
      .map((file) => relative(ROOT, file));
    expect(offenders, 'a band arrives on the projection or on MoveCardData, already resolved').toEqual([]);
  });

  /**
   * And one insertion point, so the badge cannot appear in two shapes.
   *
   * `chip.ts` builds it and `scene.ts` decides where it goes. A third file
   * calling `bandChip` would be a screen placing the badge in its own markup,
   * which is precisely the state 4.6b left behind.
   */
  it('builds the chip in chip.ts and inserts it only from scene.ts', () => {
    const offenders = uiFiles()
      .filter((file) => !/src\/ui\/(chip|scene)\.ts$/.test(file))
      .filter((file) => /\bbandChip\s*\(/.test(code(file)))
      .map((file) => relative(ROOT, file));
    expect(offenders, 'go through moveBandChip in ui/scene.ts').toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 2: the weight rule, across bands and across surfaces
// ---------------------------------------------------------------------------

/**
 * Extends the Release C weight test in `test/battle-feedback.test.ts`.
 *
 * That one pins the flag chips: every flag on one recipe, no per-kind weight
 * or hue, because the moment one flag is bigger than another the strip has
 * stopped reporting and started recommending. The band badge is the same
 * argument one step further out — it now appears on eight surfaces, and a band
 * that got louder as it got higher would be the stylesheet ranking the four
 * brackets, which is the verdict Part 4 forbids.
 */
describe('every band chip carries the same weight', () => {
  it('is the same size and weight for band 1 as for band 4', () => {
    const state = createRun('R12BAND', DEFAULT_TUNING);
    // Two real moves, three bands apart, through the real reward card.
    const low = renderRewardCard({ kind: 'tm', move: 'Body Slam' }, state, () => undefined);
    const high = renderRewardCard({ kind: 'tm', move: 'Hydro Pump' }, state, () => undefined);
    const lowBadge = low.querySelector('.move .band');
    const highBadge = high.querySelector('.move .band');
    expect(lowBadge).not.toBeNull();
    expect(highBadge).not.toBeNull();
    expect(bandOfMove('Body Slam')).not.toBe(bandOfMove('Hydro Pump'));

    /*
     * The classes are the assertion, because the classes are what can carry a
     * style. `band--n` exists so the stylesheet *could* distinguish them and
     * V0 decided it must not; what is checked here is that the only difference
     * between the two nodes is that number, and that neither wears an inline
     * style, a `--chip` hue or a size modifier.
     */
    const shape = (node: Element): string[] =>
      [...node.classList].filter((name) => !/^band--\d$/.test(name)).sort();
    expect(shape(lowBadge!)).toEqual(shape(highBadge!));
    expect(shape(lowBadge!)).toEqual(['band', 'chip', 'chip--band']);
    for (const badge of [lowBadge, highBadge]) {
      expect((badge as HTMLElement).style.cssText).toBe('');
    }
  });

  it('is the same chip on the battle button as on every card', () => {
    const shape = (node: Element): string[] =>
      [...node.classList].filter((name) => !/^band--\d$/.test(name)).sort();

    const surfaces: [string, Element][] = [];

    const state = createRun('R12BAND', DEFAULT_TUNING);
    const reward = renderRewardCard({ kind: 'tm', move: 'Ice Beam' }, state, () => undefined);
    surfaces.push(['reward card', reward.querySelector('.move .band')!]);

    const session = createBattle({ teams: { p1: PLAYER_TEAM, p2: OPPONENT_TEAM }, seed: 'R12BAND' });
    const scene = createScene();
    scene.update(
      buildBattleUiView(session.factsFor('p1'), { ability: true, item: true }, abilityEffects),
      () => undefined,
    );
    surfaces.push(['battle button', scene.root.querySelector('.moves .move .band')!]);

    const drawer = createDrawer();
    const members = party();
    drawer.open({ party: members, holding: members.map(() => null), relics: [], tuning: DEFAULT_TUNING });
    surfaces.push(['party drawer', drawer.root.querySelector('.move .band')!]);

    const replace = createMoveReplaceScreen();
    const incoming = describeMove('Ice Beam')!;
    replace.render(members[0]!, incoming, () => undefined, DEFAULT_TUNING);
    surfaces.push(['replacement, incoming', replace.root.querySelector('.replace__incoming .band')!]);
    surfaces.push(['replacement, given up', replace.root.querySelector('.replace__moves .band')!]);

    for (const [surface, badge] of surfaces) {
      expect(badge, surface).toBeTruthy();
      expect(shape(badge), surface).toEqual(['band', 'chip', 'chip--band']);
      expect((badge as HTMLElement).style.cssText, surface).toBe('');
      // The one accent belongs to `.primary-action`, and it is nowhere near a
      // badge that labels an option the player has not chosen yet.
      expect([...badge.classList].join(' '), surface).not.toContain('accent');
    }
  });

  /**
   * The stylesheet has one `.band` recipe and no per-surface override.
   *
   * The classes above prove the *markup* is identical; this proves the CSS
   * cannot make the identical markup look different depending on what it sits
   * inside. A `.moves .band` or `.reward .band` selector is exactly how a badge
   * on the button quietly becomes a different badge from the one on the card.
   */
  it('draws the band from one rule, with no surface reaching in to change it', () => {
    const css = readFileSync(join(ROOT, 'src/ui/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
    const selectors = [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)]
      .flatMap((match) => (match[1] ?? '').split(','))
      .map((selector) => selector.trim())
      .filter((selector) => /(^|[\s>+~])\.band\b/.test(selector));

    expect(selectors.length, 'the .band recipe exists').toBeGreaterThan(0);
    // `.band` alone, and the four `.band--n` rows V0 flattened. Nothing scoped.
    const allowed = new Set(['.band', '.band--1', '.band--2', '.band--3', '.band--4']);
    expect(selectors.filter((selector) => !allowed.has(selector))).toEqual([]);
  });
});
