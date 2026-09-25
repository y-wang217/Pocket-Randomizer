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
import { BAND_PIPS } from '../src/data/bandInfo';
import { createRun, playRun, scriptedRunPolicy, type RunResult } from '../src/core/run';
import type { PokemonState } from '../src/core/types';
import { abilityEffects } from '../src/data/abilityEffects';
import { gymForSegment } from '../src/data/gyms';
import { openBandOf } from '../src/ui/band';
import { OPPONENT_TEAM, PLAYER_TEAM } from '../src/data/mons';
import { bandOfMove } from '../src/data/moveOverrides';
import { partyCapacityAfter } from '../src/data/partyTuning';
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

    /*
     * **Patch 4.8.0.3 turned the word into a meter, and the assertion follows
     * it rather than being dropped.**
     *
     * `BAND 3` is now four pips with three filled. What R12 was protecting is
     * untouched and is still what is checked here: the badge reaches this
     * surface at all, and the band it shows is the one `bandOfMove` resolved.
     * The count of lit pips is that number, read back off the DOM, so the test
     * still cannot pass by drawing a plausible badge.
     */
    expect(badge, `${surface}: ${name} should carry band ${expected}`).not.toBeNull();
    expect(badge?.querySelectorAll('.band__pip').length, `${surface}: ${name}`).toBe(BAND_PIPS);
    expect(
      badge?.querySelectorAll('.band__pip[data-on="true"]').length,
      `${surface}: ${name}`,
    ).toBe(expected);
    // The number itself did not disappear, it moved behind the tap the badge
    // already had. `data/bandInfo.ts` holds the words.
    expect((badge as HTMLElement).dataset['tip'], `${surface}: ${name}`).toBe(`band:${expected}`);
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
    const view = buildBattleUiView(session.factsFor('p1'), { ability: true, item: true, teamSize: true }, abilityEffects);

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
      {
        party: party(),
        backpack: [],
        tms: [],
        teachable: new Set([]),
        relics: [],
        tuning: DEFAULT_TUNING,
        slots: partyCapacityAfter(0),
        plan: null,
      },
      { onReorder: () => undefined, onRelease: () => undefined, onPlan: () => undefined, onTeach: () => undefined, onDone: () => undefined },
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
     * **The definition of done moved at M2.3, and the comparison it protects
     * did not.**
     *
     * It read: "a player comparing an incoming band 3 against four current
     * moves sees five labelled cards, and the label looks the same on all
     * five." Five full cards do not fit 390x844 — the player scrolled between
     * the options they were choosing between — so M2.3 shrank the four to
     * chips, and section 5's chip carries name, type, category and base power
     * and not the band.
     *
     * **So the comparison happens one tap later, against two full faces.** The
     * chip opens the shared confirm with the incoming move and the one it
     * would displace, both with their bands, which is the pairing R12 exists
     * to make possible — and a *closer* pairing than five cards in a grid,
     * because the two being traded are side by side.
     *
     * The incoming card still carries its band on the screen itself, so the
     * player sees what they are being offered before choosing what it costs.
     */
    bandsOn(screen.root.querySelector('.replace__incoming') ?? screen.root, 'replacement, incoming');

    // Ice Beam is a band 3 move, so this really is the case the brief names.
    expect(bandOfMove('Ice Beam')).toBe(3);

    const chips = [...screen.root.querySelectorAll<HTMLElement>('.replace__moves .move--chip')];
    expect(chips, 'the four it could displace').toHaveLength(4);
    for (const chip of chips) {
      expect(chip.querySelector('.band'), 'the chip defers the band to the confirm').toBeNull();
    }

    chips[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const band = openBandOf();
    expect(band, 'the chip opens the confirm').not.toBeNull();
    bandsOn(band!.root, 'replacement, the two being traded');
    expect(band!.root.querySelectorAll('.move--card .band'), 'both faces carry one').toHaveLength(2);
    band!.close();
  });

  /**
   * Patch 4.8.0.2. The heading over the four current moves read `Give up`, and
   * a playtester tapped it expecting the decline this screen does not have.
   * A heading here describes the row; the row's buttons are the control.
   */
  it('labels the four current moves with a heading that is not an instruction, and makes each a control', () => {
    const screen = createMoveReplaceScreen();
    const member = party()[0];
    if (!member) throw new Error('no member to teach');
    const incoming = describeMove('Ice Beam');
    if (!incoming) throw new Error('Ice Beam is not in the dex');
    const picked: number[] = [];
    screen.render(member, incoming, (slot) => picked.push(slot), DEFAULT_TUNING);

    const headings = [...screen.root.querySelectorAll('.replace__heading')].map((h) => h.textContent?.trim().toLowerCase());
    expect(headings).not.toContain('give up');
    expect(headings.some((text) => text?.includes('replace')), 'the heading says what tapping a card does').toBe(true);

    const victims = [...screen.root.querySelectorAll('.replace__moves .move--victim')];
    expect(victims.length).toBe(4);
    for (const [slot, victim] of victims.entries()) {
      expect(victim.tagName, 'a current move is a button').toBe('BUTTON');
      (victim as HTMLButtonElement).click();
      /*
       * **A tap opens the question; the band's primary answers it. M2.3.**
       *
       * This used to commit on the tap, and the case asserted exactly that.
       * The chip gave up PP and the band, so committing straight off it would
       * be asking the player to decide on less than the screen used to show —
       * the confirm is where the two full faces come back, and it is the
       * control that spends the slot.
       */
      expect(picked.at(-1), 'the tap alone spends nothing').not.toBe(slot);
      const band = openBandOf();
      expect(band, `slot ${slot} opened no confirm`).not.toBeNull();
      band!.root.querySelector<HTMLButtonElement>('.primary-action')!.click();
      expect(picked.at(-1)).toBe(slot);
    }
    expect(picked).toEqual([0, 1, 2, 3]);
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
/**
 * The classes a band badge wears, everywhere it is drawn.
 *
 * `move__facts-band` joined the list in the playtest patch and is **a position
 * class, not a weight class**: it pins the badge to the head of the fact line
 * so the band stops wrapping onto a different row on each of the four battle
 * buttons. It is identical on band 1 and band 4, which is exactly the property
 * these two tests are about — the rule forbids the stylesheet distinguishing
 * one bracket from another, not the badge having a place to stand.
 */
const BAND_SHAPE = ['band', 'chip', 'chip--band', 'move__facts-band'].sort();

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
    expect(shape(lowBadge!)).toEqual(BAND_SHAPE);
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
      buildBattleUiView(session.factsFor('p1'), { ability: true, item: true, teamSize: true }, abilityEffects),
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
    // The four it could displace are chips since M2.3 and carry no band of
    // their own; the one they open the confirm on does, and it is the same
    // chip built by the same function.
    replace.root.querySelector<HTMLElement>('.replace__moves .move--chip')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    surfaces.push(['replacement, the confirm', openBandOf()!.root.querySelector('.move--card .band')!]);

    for (const [surface, badge] of surfaces) {
      expect(badge, surface).toBeTruthy();
      expect(shape(badge), surface).toEqual(BAND_SHAPE);
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
    const allowed = new Set(['.band', '.band--1', '.band--2', '.band--3', '.band--4', '.band--5']);
    expect(selectors.filter((selector) => !allowed.has(selector))).toEqual([]);
  });
});
