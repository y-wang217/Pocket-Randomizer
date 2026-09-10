/**
 * Release C on screen: the HP chunk, the turn order jiggle, and the flag words.
 *
 * @vitest-environment jsdom
 *
 * ## Why these are jsdom tests when the layout ones are not
 *
 * Same rule `test/threat-readout.test.ts` states: layout at a viewport size
 * belongs in `scripts/smoke.mjs`, because jsdom has no layout engine and a
 * `getBoundingClientRect` of zeros makes a passing assertion meaningless.
 *
 * Nothing here is about layout. Every assertion is about which elements exist,
 * in what order, carrying which text and which attributes — and the most
 * important ones are negatives, because Release C's rules are the kind a
 * plausible one-line change breaks: a shadow drawn on a heal, a flag word
 * ranked by severity, a chunk painted across a switch. A rule with no test is a
 * comment.
 *
 * The percentages below are read off inline styles rather than measured, which
 * is exactly the right instrument: `scene.ts` computes them from two fractions
 * and writes them as strings, so the string *is* the assertion. What the
 * browser then does with a percentage is the browser's business and the smoke
 * script's.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { createBattle, moveIdentity, movePriority, speciesTypes } from '../src/core/battle/driver';
import { createFlagReader, readFlags, type FlagDeps, type FlaggedTurn } from '../src/core/battle/flags';
import { buildBattleUiView, type ActiveUiView, type BattleUiView } from '../src/core/battle/view';
import { moveChoice, type TeamSpec } from '../src/core/types';
import { abilityEffects } from '../src/data/abilityEffects';
import { OPPONENT_TEAM, PLAYER_TEAM } from '../src/data/mons';
import { createFlagStrip, type FlagStrip } from '../src/ui/flag-strip';
import { createScene, type Scene } from '../src/ui/scene';
import { resetSettings } from '../src/ui/settings';

/** The same three adapter lookups `ui/screens/battle.ts` supplies in the app. */
const FLAGS: FlagDeps = { priorityOf: movePriority, moveIdentityOf: moveIdentity, typesOf: speciesTypes };

beforeEach(() => {
  resetSettings();
});

/** A real view off a real battle, which is what the scene is written against. */
function baseView(seed = 'FEEDBACK01'): BattleUiView {
  const session = createBattle({ teams: { p1: PLAYER_TEAM, p2: OPPONENT_TEAM }, seed });
  return buildBattleUiView(session.factsFor('p1'), { ability: true, item: true }, abilityEffects);
}

/** The same view with one side's HP moved, which is the only variable here. */
function withHp(view: BattleUiView, side: 'player' | 'opponent', fraction: number): BattleUiView {
  const active: ActiveUiView = view[side];
  const max = active.hp.max;
  return {
    ...view,
    [side]: { ...active, hp: { ...active.hp, fraction, current: Math.round(max * fraction) } },
  };
}

/** The same view wearing a different body on one side, for the switch case. */
function withSpecies(view: BattleUiView, side: 'player' | 'opponent', species: string): BattleUiView {
  return { ...view, [side]: { ...view[side], species, name: species } };
}

function shadowOf(scene: Scene, side: 'me' | 'foe'): HTMLElement {
  const shadow = scene.root.querySelector(`.panel--${side} .hp__shadow`);
  if (!(shadow instanceof HTMLElement)) throw new Error(`no ${side} shadow in the scene`);
  return shadow;
}

function fillOf(scene: Scene, side: 'me' | 'foe'): HTMLElement {
  const fill = scene.root.querySelector(`.panel--${side} .hp__fill`);
  if (!(fill instanceof HTMLElement)) throw new Error(`no ${side} fill in the scene`);
  return fill;
}

const NOOP = (): undefined => undefined;

/**
 * Play exactly one turn and hand the scene the reading of it.
 *
 * Deliberately the same two calls `ui/screens/battle.ts` makes in the app —
 * one `readFlags` over the batch, then `scene.update(view, onChoose, turns)` —
 * so what is asserted below is the wiring that actually ships and not a
 * rehearsal of it. `slot` picks which move both sides use.
 */
function playOneTurn(p1: TeamSpec, p2: TeamSpec, slot: number, seed: string): { scene: Scene; turns: FlaggedTurn[] } {
  const session = createBattle({ teams: { p1, p2 }, seed });
  const before = session.protocolFor('p1').length;
  for (const side of ['p1', 'p2'] as const) session.submit(side, moveChoice(slot));

  const batch = session.protocolFor('p1').slice(before).filter((line) => !line.startsWith('|t:|'));
  const turns = readFlags(batch, FLAGS);
  const scene = createScene();
  scene.update(
    buildBattleUiView(session.factsFor('p1'), { ability: true, item: true }, abilityEffects),
    NOOP,
    turns,
  );
  return { scene, turns };
}

describe('the HP chunk and its shadow', () => {
  it('paints the shadow across exactly the span the bar vacated', () => {
    const view = baseView();
    const scene = createScene();
    scene.update(withHp(view, 'opponent', 1), NOOP);
    scene.update(withHp(view, 'opponent', 0.6), NOOP);

    const shadow = shadowOf(scene, 'foe');
    // Starts where the bar now ends, runs to where the bar used to end.
    expect(shadow.style.left).toBe('60%');
    expect(shadow.style.width).toBe('40%');
    expect(shadow.dataset['fading']).toBe('true');
  });

  it('puts the bar at the new value on the same update, with no width transition', () => {
    const view = baseView();
    const scene = createScene();
    scene.update(withHp(view, 'opponent', 1), NOOP);
    scene.update(withHp(view, 'opponent', 0.25), NOOP);

    // The whole of item 1: the number is already right while the shadow is
    // still on screen. Nothing waits for the fade.
    expect(fillOf(scene, 'foe').style.width).toBe('25%');
  });

  it('draws no shadow on a heal', () => {
    const view = baseView();
    const scene = createScene();
    scene.update(withHp(view, 'player', 0.4), NOOP);
    scene.update(withHp(view, 'player', 0.9), NOOP);

    const shadow = shadowOf(scene, 'me');
    expect(shadow.style.width).toBe('0%');
    expect(shadow.dataset['fading']).toBeUndefined();
    // A heal is narrated by the round 2 patch's restore line in the log, which
    // Release C does not touch.
    expect(fillOf(scene, 'me').style.width).toBe('90%');
  });

  it('clears a standing shadow when the next update takes no damage', () => {
    const view = baseView();
    const scene = createScene();
    scene.update(withHp(view, 'opponent', 1), NOOP);
    scene.update(withHp(view, 'opponent', 0.5), NOOP);
    expect(shadowOf(scene, 'foe').dataset['fading']).toBe('true');

    // A shadow that outlives the hit it describes is a lie about this turn.
    scene.update(withHp(view, 'opponent', 0.5), NOOP);
    expect(shadowOf(scene, 'foe').dataset['fading']).toBeUndefined();
    expect(shadowOf(scene, 'foe').style.width).toBe('0%');
  });

  it('draws no shadow on the first draw of a battle', () => {
    const scene = createScene();
    scene.update(withHp(baseView(), 'opponent', 0.3), NOOP);
    // There is no previous value, so there is no chunk — an opening switch-in
    // at anything other than full HP is a carry-over, not a hit.
    expect(shadowOf(scene, 'foe').dataset['fading']).toBeUndefined();
  });

  it('draws no shadow when the body on that side changed', () => {
    const view = baseView();
    const scene = createScene();
    scene.update(withHp(view, 'player', 1), NOOP);
    scene.update(withSpecies(withHp(view, 'player', 0.1), 'player', 'Onix'), NOOP);

    /*
     * The two bars belong to two different Pokemon, so the difference between
     * them is not damage. Without this the panel paints nine tenths of the
     * track as a hit that never happened, on the one turn a player most needs
     * to read the board correctly.
     */
    expect(shadowOf(scene, 'me').dataset['fading']).toBeUndefined();
    expect(fillOf(scene, 'me').style.width).toBe('10%');
  });

  it('ignores a drop too small to draw honestly', () => {
    const view = baseView();
    const scene = createScene();
    scene.update(withHp(view, 'opponent', 1), NOOP);
    // Below the minimum chunk: thinner than the rounding on its own corners,
    // and the log already says so in words.
    scene.update(withHp(view, 'opponent', 0.998), NOOP);
    expect(shadowOf(scene, 'foe').dataset['fading']).toBeUndefined();
  });

  it('restarts the fade rather than extending it, on two hits running', () => {
    const view = baseView();
    const scene = createScene();
    scene.update(withHp(view, 'opponent', 1), NOOP);
    scene.update(withHp(view, 'opponent', 0.7), NOOP);
    scene.update(withHp(view, 'opponent', 0.4), NOOP);

    const shadow = shadowOf(scene, 'foe');
    // The second chunk, not the first and not both: 0.7 down to 0.4.
    expect(shadow.style.left).toBe('40%');
    expect(Number.parseFloat(shadow.style.width)).toBeCloseTo(30, 5);
    expect(shadow.dataset['fading']).toBe('true');
  });

  it('resolves the shadow on a tap, because no transition may outlast input', () => {
    const view = baseView();
    const scene = createScene();
    scene.update(withHp(view, 'opponent', 1), NOOP);
    scene.update(withHp(view, 'opponent', 0.5), NOOP);
    expect(shadowOf(scene, 'foe').dataset['fading']).toBe('true');

    scene.root.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true }));
    expect(shadowOf(scene, 'foe').dataset['fading']).toBeUndefined();
    expect(shadowOf(scene, 'foe').style.width).toBe('0%');
    // And the number it was describing is still correct.
    expect(fillOf(scene, 'foe').style.width).toBe('50%');
  });
});

describe('the turn order jiggle', () => {
  /**
   * The pair `test/turn-order.test.ts` and `test/flags.test.ts` both use: base
   * 30 Speed against base 130, so an order flip is a bracket and nothing else.
   */
  const SLOW: TeamSpec = [{ species: 'Snorlax', ability: 'Immunity', moves: ['Quick Attack', 'Tackle'], level: 50 }];
  const FAST: TeamSpec = [{ species: 'Jolteon', ability: 'Volt Absorb', moves: ['Tackle', 'Quick Attack'], level: 50 }];

  function nudges(scene: Scene): { me: string | undefined; foe: string | undefined } {
    const me = scene.root.querySelector('.panel--me');
    const foe = scene.root.querySelector('.panel--foe');
    if (!(me instanceof HTMLElement) || !(foe instanceof HTMLElement)) throw new Error('no panels');
    return { me: me.dataset['jiggle'], foe: foe.dataset['jiggle'] };
  }

  it('nudges the panels in the order the log numbers the actions', () => {
    // The player is slow and uses a priority move, so p1 resolves first
    // despite losing the Speed tie by a hundred points.
    const { scene, turns } = playOneTurn(SLOW, FAST, 1, 'JIGGLE01');

    // The log's own ordinals, off the same reading the jiggle was given.
    /*
     * The log's own ordinals, off the same reading the jiggle was given. Note
     * the group carries no turn number: an incremental batch opens mid-turn
     * and closes with the `|turn|` that starts the *next* one, which is why
     * the jiggle keys off "the last group with actions" and never off a
     * number.
     */
    const order = turns.flatMap((turn) => turn.actions.map((each) => each.action.side));
    expect(order[0]).toBe('p1');
    expect(order[1]).toBe('p2');

    // And the panels agree, because they were placed from that same list.
    expect(nudges(scene)).toEqual({ me: '1', foe: '2' });
  });

  it('nudges the other way round when the bracket is not in play', () => {
    // Slot 2 on both sides is an ordinary Tackle, so Speed decides and the
    // fast side goes first.
    const { scene, turns } = playOneTurn(SLOW, FAST, 2, 'JIGGLE01');
    const order = turns.flatMap((turn) => turn.actions.map((each) => each.action.side));
    expect(order[0]).toBe('p2');
    expect(nudges(scene)).toEqual({ me: '2', foe: '1' });
  });

  it('does not nudge on the opening draw, because an arrival is not a turn', () => {
    const scene = createScene();
    scene.update(baseView(), NOOP);
    expect(nudges(scene)).toEqual({ me: undefined, foe: undefined });
  });

  it('places a side by its first action, so the sequence never exceeds two', () => {
    const scene = createScene();
    // A replacement switch after a faint is a third action on a side that has
    // already moved. It must not re-place a panel that is already nudged.
    scene.update(baseView(), NOOP, [
      {
        turn: 3,
        actions: [
          { action: { kind: 'move', side: 'p2', actor: 'A', move: 'Tackle', order: 1, priority: false, bracket: 0 }, flags: [] },
          { action: { kind: 'move', side: 'p1', actor: 'B', move: 'Tackle', order: 2, priority: false, bracket: 0 }, flags: [] },
          { action: { kind: 'switch', side: 'p1', actor: 'C', from: null, order: 3 }, flags: [] },
        ],
        residual: [],
      },
    ]);
    expect(nudges(scene)).toEqual({ me: '2', foe: '1' });
  });

  it('clears the nudge on a tap, like every other transition', () => {
    const { scene } = playOneTurn(SLOW, FAST, 1, 'JIGGLE01');
    expect(nudges(scene).me).toBe('1');
    scene.root.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true }));
    expect(nudges(scene)).toEqual({ me: undefined, foe: undefined });
  });
});

describe('the flag strip', () => {
  function words(strip: FlagStrip): string[] {
    return [...strip.root.querySelectorAll('.chip')].map((chip) => chip.textContent ?? '');
  }

  /** Play one turn and hand the strip the same reading the app would. */
  function stripFor(p1: TeamSpec, p2: TeamSpec, slot: number, seed: string, turns = 1): FlagStrip {
    const session = createBattle({ teams: { p1, p2 }, seed });
    const strip = createFlagStrip();
    /*
     * One reader for the battle, and the opening protocol read first — exactly
     * what `ui/screens/battle.ts` does. Both matter: the opening batch is the
     * only place the protocol names each side's species, and an incremental
     * batch after it carries no `|switch|` at all.
     */
    const reader = createFlagReader(FLAGS);
    reader.read(session.protocolFor('p1').filter((line) => !line.startsWith('|t:|')));

    for (let i = 0; i < turns && !session.ended; i++) {
      const before = session.protocolFor('p1').length;
      for (const side of ['p1', 'p2'] as const) {
        if (session.viewFor(side).awaitingChoice) session.submit(side, moveChoice(slot));
      }
      const batch = session.protocolFor('p1').slice(before).filter((line) => !line.startsWith('|t:|'));
      strip.show(reader.read(batch));
    }
    return strip;
  }

  it('names what the turn did, in the protocol’s order', () => {
    const strip = stripFor(
      [{ species: 'Kingler', ability: 'Hyper Cutter', moves: ['Crabhammer'], level: 50 }],
      [{ species: 'Golem', ability: 'Sturdy', moves: ['Tackle'], level: 50 }],
      1,
      'STRIP01',
    );
    const shown = words(strip);
    expect(shown).toContain('STAB');
    expect(shown).toContain('Contact');
    expect(shown).toContain('Super effective');
  });

  it('names the berry that fired', () => {
    /*
     * The turn shape a real Oran Berry produces, taken off a played battle in
     * `test/flags.test.ts`: `-enditem` and a separate `-heal`, inside the move
     * that took the HP down. Driven directly here because the strip holds only
     * the latest turn and a 30-turn chip race would assert on whichever turn
     * happened to be last.
     */
    const protocol = [
      '|move|p2a: Rattata|Tackle|p1a: Snorlax',
      '|-damage|p1a: Snorlax|20/235',
      '|-enditem|p1a: Snorlax|Oran Berry|[eat]',
      '|-heal|p1a: Snorlax|30/235|[from] item: Oran Berry',
      '|upkeep',
    ];
    const strip = createFlagStrip();
    strip.show(readFlags(protocol, FLAGS));
    // The berry names itself: "Oran Berry" says more than "Berry" and is
    // shorter than both together.
    expect(words(strip)).toContain('Oran Berry');
  });

  it('draws every flag on one chip recipe, with no per-kind weight or hue', () => {
    const protocol = [
      '|switch|p1a: Snorlax|Snorlax, L50, M|235/235',
      '|switch|p2a: Golem|Golem, L50, F|155/155',
      '|turn|1',
      '|move|p1a: Snorlax|Body Slam|p2a: Golem',
      '|-resisted|p2a: Golem',
      '|-crit|p2a: Golem',
      '|-damage|p2a: Golem|100/155',
      '|-status|p2a: Golem|par',
      '|upkeep',
    ];
    const strip = createFlagStrip();
    strip.show(readFlags(protocol, FLAGS));

    const chips = [...strip.root.querySelectorAll('.chip')];
    expect(chips.length).toBeGreaterThan(2);
    /*
     * The visual-weight rule, as an assertion. Every chip carries the same two
     * classes and nothing else that could carry a style, so none of them can
     * be larger, heavier or a different colour than another. A `--chip` here
     * would be a hue per kind; a size modifier would be a rank.
     */
    for (const chip of chips) {
      expect([...chip.classList].sort()).toEqual(['badge', 'badge--flag', 'chip', 'chip--flag']);
      expect((chip as HTMLElement).style.cssText).toBe('');
    }
    // And the accent is nowhere near them.
    expect(strip.root.innerHTML).not.toContain('accent');
  });

  it('marks whose flag it is, by side and never by kind', () => {
    /*
     * Both sides use a same-type move on the same turn, which prints `STAB`
     * twice. Without the side marker the strip says two identical words about
     * two different Pokemon and answers nothing.
     */
    const protocol = [
      '|switch|p1a: Snorlax|Snorlax, L50, M|235/235',
      '|switch|p2a: Persian|Persian, L50, F|155/155',
      '|turn|1',
      '|move|p1a: Snorlax|Body Slam|p2a: Persian',
      '|-damage|p2a: Persian|100/155',
      '|move|p2a: Persian|Slash|p1a: Snorlax',
      '|-damage|p1a: Snorlax|200/235',
      '|upkeep',
    ];
    const strip = createFlagStrip();
    strip.show(readFlags(protocol, FLAGS));

    const chips = [...strip.root.querySelectorAll('.chip')] as HTMLElement[];
    const stab = chips.filter((chip) => chip.dataset['flag'] === 'stab');
    expect(stab).toHaveLength(2);
    // Two identical words, two different sides, and the strip says so.
    expect(stab.map((chip) => chip.textContent)).toEqual(['STAB', 'STAB']);
    expect(stab.map((chip) => chip.dataset['side'])).toEqual(['p1', 'p2']);
    // The screen reader gets the name rather than the side code.
    expect(stab[0]?.getAttribute('aria-label')).toBe('Snorlax: STAB');
    expect(stab[1]?.getAttribute('aria-label')).toBe('Persian: STAB');

    /*
     * The rule the marker must not break: within one side, every kind is
     * marked identically. A `data-side` that varied by kind would be the
     * weight axis arriving through the side door.
     */
    for (const side of ['p1', 'p2']) {
      const ofSide = chips.filter((chip) => chip.dataset['side'] === side);
      expect(ofSide.length).toBeGreaterThan(1);
      const recipes = new Set(ofSide.map((chip) => [...chip.classList].sort().join(' ')));
      expect(recipes.size, `one recipe for every kind on ${side}`).toBe(1);
    }
  });

  it('shows the turn that just resolved, not the one the batch opens', () => {
    // An incremental batch ends with the `|turn|` that starts the next turn,
    // so a strip that selected by turn number would show an empty group and
    // print nothing at all.
    const protocol = [
      '|move|p1a: Snorlax|Body Slam|p2a: Golem',
      '|-crit|p2a: Golem',
      '|-damage|p2a: Golem|100/155',
      '|upkeep',
      '|turn|2',
    ];
    const strip = createFlagStrip();
    strip.show(readFlags(protocol, FLAGS));
    expect(words(strip)).toContain('Critical hit');
  });

  it('holds its height and says so when a turn had nothing to report', () => {
    const strip = createFlagStrip();
    strip.show(readFlags(['|move|p1a: Snorlax|Splash|p1a: Snorlax', '|upkeep'], FLAGS));
    expect(strip.root.dataset['empty']).toBe('true');
    strip.clear();
    expect(strip.root.children.length).toBe(0);
  });

  it('opens a tooltip keyed by kind, not by the word it printed', () => {
    const protocol = ['|move|p1a: Gengar|Thunder Wave|p2a: Snorlax', '|-status|p2a: Snorlax|par', '|upkeep'];
    const strip = createFlagStrip();
    strip.show(readFlags(protocol, FLAGS));
    const chip = strip.root.querySelector('.chip');
    // The word folds in the detail; the tip asks what the category claims.
    expect(chip?.textContent).toBe('Paralysed');
    expect((chip as HTMLElement).dataset['tip']).toBe('flag:status');
  });
});
