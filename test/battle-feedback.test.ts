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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createBattle, movePriority } from '../src/core/battle/driver';
import { readFlags, type FlagDeps, type FlaggedTurn } from '../src/core/battle/flags';
import { buildBattleUiView, type ActiveUiView, type BattleUiView } from '../src/core/battle/view';
import { moveChoice, type TeamSpec } from '../src/core/types';
import { abilityEffects } from '../src/data/abilityEffects';
import { OPPONENT_TEAM, PLAYER_TEAM } from '../src/data/mons';
import { createFlagStrip, type FlagStrip } from '../src/ui/flag-strip';
import { readReplay, type BodyState, type TurnReplay } from '../src/ui/replay';
import { createScene, type Scene } from '../src/ui/scene';
import { beatMs } from '../src/ui/theme/motion';
import { resetSettings } from '../src/ui/settings';

/** The same adapter lookup `ui/screens/battle.ts` supplies in the app. */
const FLAGS: FlagDeps = { priorityOf: movePriority };

beforeEach(() => {
  resetSettings();
  // The steps of a turn are paced on timers (`ui/replay.ts`); the clock is driven by hand here.
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Let `beats` beats of the turn pass. */
function advance(beats: number): void {
  vi.advanceTimersByTime(beats * beatMs());
}

/** A real view off a real battle, which is what the scene is written against. */
function baseView(seed = 'FEEDBACK01'): BattleUiView {
  const session = createBattle({ teams: { p1: PLAYER_TEAM, p2: OPPONENT_TEAM }, seed });
  return buildBattleUiView(session.factsFor('p1'), { ability: true, item: true, teamSize: true }, abilityEffects);
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
 * Deliberately the same calls `ui/screens/battle.ts` makes in the app — the
 * opening draw, then one `readFlags` over the batch, `readReplay` over it, and
 * `scene.update(view, onChoose, replay)` — so what is asserted below is the
 * wiring that actually ships and not a rehearsal of it. `slot` picks which
 * move both sides use. The first step is drawn on return; the rest are on the
 * clock (`advance`).
 */
function playOneTurn(p1: TeamSpec, p2: TeamSpec, slot: number, seed: string): { scene: Scene; turns: FlaggedTurn[]; replay: TurnReplay } {
  const session = createBattle({ teams: { p1, p2 }, seed });
  const view = (): BattleUiView => buildBattleUiView(session.factsFor('p1'), { ability: true, item: true, teamSize: true }, abilityEffects);
  const scene = createScene();
  scene.update(view(), NOOP);
  const before = session.protocolFor('p1').length;
  for (const side of ['p1', 'p2'] as const) session.submit(side, moveChoice(slot));

  const batch = session.protocolFor('p1').slice(before).filter((line) => !line.startsWith('|t:|'));
  const turns = readFlags(batch, FLAGS);
  const replay = readReplay(batch, turns);
  scene.update(view(), NOOP, replay);
  return { scene, turns, replay };
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

/**
 * The pair `test/turn-order.test.ts` and `test/flags.test.ts` both use: base
 * 30 Speed against base 130, so an order flip is a bracket and nothing else.
 */
const SLOW: TeamSpec = [{ species: 'Snorlax', ability: 'Immunity', moves: ['Quick Attack', 'Tackle'], level: 50 }];
const FAST: TeamSpec = [{ species: 'Jolteon', ability: 'Volt Absorb', moves: ['Tackle', 'Quick Attack'], level: 50 }];

function actorOf(scene: Scene, side: 'me' | 'foe'): HTMLElement {
  const actor = scene.root.querySelector(`.stage__actor--${side}`);
  if (!(actor instanceof HTMLElement)) throw new Error(`no ${side} actor on the stage`);
  return actor;
}

/** The beat markers on both actors, which is everything the stylesheet animates from. */
function beatsOf(scene: Scene, key: 'acted' | 'hit' | 'fainting' | 'fainted'): { me: string | undefined; foe: string | undefined } {
  return { me: actorOf(scene, 'me').dataset[key], foe: actorOf(scene, 'foe').dataset[key] };
}

/**
 * The turn order beat. **Release C item 2, on the sprite since the bar and
 * beats patch.** The five cases below are Release C's own, re-read off the
 * actor rather than the panel: the rule did not change, only the element that
 * carries it, and `test/battle-stage.test.ts` holds that the panel no longer
 * carries anything.
 */
describe('the turn order lunge', () => {
  function nudges(scene: Scene): { me: string | undefined; foe: string | undefined } {
    return beatsOf(scene, 'acted');
  }

  it('moves the actors in the order the log numbers the actions, one step at a time', () => {
    // The player is slow and uses a priority move, so p1 resolves first
    // despite losing the Speed tie by a hundred points.
    const { scene, turns } = playOneTurn(SLOW, FAST, 1, 'JIGGLE01');

    /*
     * The log's own ordinals, off the same reading the steps were built from.
     * Note the group carries no turn number: an incremental batch opens
     * mid-turn and closes with the `|turn|` that starts the *next* one, which
     * is why the replay keys off "the last group with actions" and never off
     * a number.
     */
    const order = turns.flatMap((turn) => turn.actions.map((each) => each.action.side));
    expect(order[0]).toBe('p1');
    expect(order[1]).toBe('p2');

    // The first actor lunges on the frame the view arrives, alone.
    expect(nudges(scene)).toEqual({ me: '1', foe: undefined });
    // Two beats on, the second, alone: the first's beat is cleared with its step.
    advance(2);
    expect(nudges(scene)).toEqual({ me: undefined, foe: '1' });
    // And the view itself last, with no lunge at all.
    advance(2);
    expect(nudges(scene)).toEqual({ me: undefined, foe: undefined });
  });

  it('moves the other way round when the bracket is not in play', () => {
    // Slot 2 on both sides is an ordinary Tackle, so Speed decides and the
    // fast side goes first.
    const { scene, turns } = playOneTurn(SLOW, FAST, 2, 'JIGGLE01');
    const order = turns.flatMap((turn) => turn.actions.map((each) => each.action.side));
    expect(order[0]).toBe('p2');
    expect(nudges(scene)).toEqual({ me: undefined, foe: '1' });
    advance(2);
    expect(nudges(scene)).toEqual({ me: '1', foe: undefined });
  });

  it('does not move on the opening draw, because an arrival is not a turn', () => {
    const scene = createScene();
    scene.update(baseView(), NOOP);
    expect(nudges(scene)).toEqual({ me: undefined, foe: undefined });
  });

  it('gives a replacement switch after a faint a step of its own, after both moves', () => {
    const scene = createScene();
    scene.update(baseView(), NOOP);
    // A replacement switch after a faint is a third action on a side that has
    // already moved. It is its own step, two beats after the second move.
    const replay = readReplay(
      [],
      [
        {
          turn: 3,
          actions: [
            { action: { kind: 'move', side: 'p2', actor: 'A', move: 'Tackle', order: 1, priority: false, bracket: 0 }, flags: [] },
            { action: { kind: 'move', side: 'p1', actor: 'B', move: 'Tackle', order: 2, priority: false, bracket: 0 }, flags: [] },
            { action: { kind: 'switch', side: 'p1', actor: 'C', from: null, order: 3 }, flags: [] },
          ],
          residual: [],
        },
      ],
    );
    expect(replay.steps.map((step) => `${step.side}:${step.kind}`)).toEqual(['p2:move', 'p1:move', 'p1:switch']);
    scene.update(baseView(), NOOP, replay);
    expect(nudges(scene)).toEqual({ me: undefined, foe: '1' });
    advance(2);
    expect(nudges(scene)).toEqual({ me: '1', foe: undefined });
    // A switch is a swap beat, not a lunge.
    advance(2);
    expect(nudges(scene)).toEqual({ me: undefined, foe: undefined });
  });

  it('clears the lunge on a tap, lands on the final view, and draws no later step', () => {
    const { scene } = playOneTurn(SLOW, FAST, 1, 'JIGGLE01');
    expect(nudges(scene).me).toBe('1');
    scene.root.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true }));
    expect(nudges(scene)).toEqual({ me: undefined, foe: undefined });
    // The steps that were still to come are gone with the tap.
    advance(4);
    expect(nudges(scene)).toEqual({ me: undefined, foe: undefined });
  });
});

/** The same view with one side knocked out, for the faint. */
function withFainted(view: BattleUiView, side: 'player' | 'opponent'): BattleUiView {
  const active: ActiveUiView = view[side];
  return { ...view, [side]: { ...active, fainted: true, hp: { ...active.hp, fraction: 0, current: 0 } } };
}

/** One synthetic turn where the given sides acted, in that order, with the given flags on each. */
function turnOf(sides: ('p1' | 'p2')[], flags: FlaggedTurn['actions'][number]['flags'] = []): FlaggedTurn[] {
  return [
    {
      turn: null,
      actions: sides.map((side, index) => ({
        action: { kind: 'move', side, actor: side, move: 'Tackle', order: index + 1, priority: false, bracket: 0 },
        flags,
      })),
      residual: [],
    },
  ];
}

/** The same synthetic turn, read into steps with no lines behind it. */
function replayOf(sides: ('p1' | 'p2')[], flags: FlaggedTurn['actions'][number]['flags'] = []): TurnReplay {
  return readReplay([], turnOf(sides, flags));
}

/**
 * The hit and the faint. **The bar and beats patch.**
 *
 * The hit's one rule is that it happens exactly when the bar drew a chunk —
 * not when HP changed, not when a move was used, not when a flag says a hit
 * landed. It reads `set`'s boolean and nothing else, so every negative Release
 * C wrote for the chunk is a negative for the hit too, for free. The cases
 * here are those negatives, the slot rule, and the one thing the copy rule
 * cares most about: a super effective hit and a resisted one draw the same
 * beat.
 */
describe('the hit and the faint', () => {
  it('knocks a sprite back exactly when its bar drew a chunk', () => {
    const view = baseView();
    const scene = createScene();
    scene.update(withHp(view, 'opponent', 1), NOOP);
    scene.update(withHp(view, 'opponent', 0.6), NOOP);
    // A chunk with no reading lands in the first slot.
    expect(beatsOf(scene, 'hit')).toEqual({ me: undefined, foe: '1' });
    expect(shadowOf(scene, 'foe').dataset['fading']).toBe('true');
  });

  it('draws no hit on a heal, on the first draw, on a swap, or on a drop too small', () => {
    const view = baseView();
    const first = createScene();
    first.update(withHp(view, 'opponent', 0.3), NOOP);
    expect(beatsOf(first, 'hit')).toEqual({ me: undefined, foe: undefined });

    const heal = createScene();
    heal.update(withHp(view, 'player', 0.4), NOOP);
    heal.update(withHp(view, 'player', 0.9), NOOP);
    expect(beatsOf(heal, 'hit')).toEqual({ me: undefined, foe: undefined });

    const swap = createScene();
    swap.update(withHp(view, 'player', 1), NOOP);
    swap.update(withSpecies(withHp(view, 'player', 0.1), 'player', 'Onix'), NOOP);
    expect(beatsOf(swap, 'hit')).toEqual({ me: undefined, foe: undefined });

    const tiny = createScene();
    tiny.update(withHp(view, 'opponent', 1), NOOP);
    tiny.update(withHp(view, 'opponent', 0.998), NOOP);
    expect(beatsOf(tiny, 'hit')).toEqual({ me: undefined, foe: undefined });
  });

  /**
   * `playOneTurn` above builds its scene *after* the turn, which is right for
   * the lunge and wrong for the hit: a first draw has no previous value, so
   * it draws no chunk and therefore no hit. This one draws the opening board
   * first, which is what the app does — the opening replay, then the turn.
   */
  function watchOneTurn(slot: number, seed: string): Scene {
    const session = createBattle({ teams: { p1: SLOW, p2: FAST }, seed });
    const view = (): BattleUiView => buildBattleUiView(session.factsFor('p1'), { ability: true, item: true, teamSize: true }, abilityEffects);
    const scene = createScene();
    scene.update(view(), NOOP);
    const before = session.protocolFor('p1').length;
    for (const side of ['p1', 'p2'] as const) session.submit(side, moveChoice(slot));
    const batch = session.protocolFor('p1').slice(before).filter((line) => !line.startsWith('|t:|'));
    scene.update(view(), NOOP, readReplay(batch, readFlags(batch, FLAGS)));
    return scene;
  }

  it('puts each hit in the step of the move that took it, and nowhere else', () => {
    // p1 goes first on a bracket: its target is hit in p1's step, and the hit
    // p1 takes from the reply lands in p2's step, two beats on.
    const first = watchOneTurn(1, 'JIGGLE01');
    expect(beatsOf(first, 'acted')).toEqual({ me: '1', foe: undefined });
    expect(beatsOf(first, 'hit')).toEqual({ me: undefined, foe: '1' });
    advance(2);
    expect(beatsOf(first, 'acted')).toEqual({ me: undefined, foe: '1' });
    expect(beatsOf(first, 'hit')).toEqual({ me: '1', foe: undefined });

    // Speed decides slot 2, so the steps swap with the order.
    const second = watchOneTurn(2, 'JIGGLE01');
    expect(beatsOf(second, 'acted')).toEqual({ me: undefined, foe: '1' });
    expect(beatsOf(second, 'hit')).toEqual({ me: '1', foe: undefined });
    advance(2);
    expect(beatsOf(second, 'acted')).toEqual({ me: '1', foe: undefined });
    expect(beatsOf(second, 'hit')).toEqual({ me: undefined, foe: '1' });
  });

  it('lands a drop no step explained on the final view, as a hit with no lunge', () => {
    // Only p2 moved, and the lines did not say where p2's HP went (a synthetic
    // turn): the view itself carries the drop, and it lands last, as a hit.
    const view = baseView();
    const scene = createScene();
    scene.update(withHp(view, 'opponent', 1), NOOP);
    scene.update(withHp(view, 'opponent', 0.8), NOOP, replayOf(['p2']));
    expect(beatsOf(scene, 'acted')).toEqual({ me: undefined, foe: '1' });
    expect(beatsOf(scene, 'hit')).toEqual({ me: undefined, foe: undefined });
    advance(2);
    expect(beatsOf(scene, 'acted')).toEqual({ me: undefined, foe: undefined });
    expect(beatsOf(scene, 'hit')).toEqual({ me: undefined, foe: '1' });
  });

  it('draws the same beat for a super effective hit and a resisted one', () => {
    const view = baseView();
    const marks = (flags: FlaggedTurn['actions'][number]['flags']): Record<string, string | undefined> => {
      const scene = createScene();
      scene.update(withHp(view, 'opponent', 1), NOOP);
      scene.update(withHp(view, 'opponent', 0.5), NOOP, replayOf(['p1', 'p2'], flags));
      // The drop is the view's, so it lands on the final draw.
      advance(4);
      const out: Record<string, string | undefined> = {};
      for (const side of ['me', 'foe'] as const) {
        for (const [key, value] of Object.entries(actorOf(scene, side).dataset)) out[`${side}.${key}`] = value;
      }
      return out;
    };
    const superEffective = marks([{ kind: 'super', side: 'p2', subject: 'x', detail: null }]);
    const resisted = marks([{ kind: 'resisted', side: 'p2', subject: 'x', detail: null }]);
    // Not merely both present: byte for byte the same attributes.
    expect(superEffective).toEqual(resisted);
    expect(superEffective['foe.hit']).toBe('1');
  });

  it('sinks a body on the update its faint arrives, and holds it down after', () => {
    const view = baseView();
    const scene = createScene();
    scene.update(withHp(view, 'opponent', 0.2), NOOP);
    expect(beatsOf(scene, 'fainted')).toEqual({ me: undefined, foe: undefined });

    scene.update(withFainted(view, 'opponent'), NOOP);
    // The event and the state, together, plus the hit the KO also was.
    expect(beatsOf(scene, 'fainting')).toEqual({ me: undefined, foe: 'true' });
    expect(beatsOf(scene, 'fainted')).toEqual({ me: undefined, foe: 'true' });
    expect(beatsOf(scene, 'hit')).toEqual({ me: undefined, foe: '1' });

    // The next update keeps the state and drops the event: a fainted Pokemon
    // does not faint again.
    scene.update(withFainted(view, 'opponent'), NOOP);
    expect(beatsOf(scene, 'fainting')).toEqual({ me: undefined, foe: undefined });
    expect(beatsOf(scene, 'fainted')).toEqual({ me: undefined, foe: 'true' });

    // The replacement rises through the swap beat, with an empty ghost: a body
    // that has already sunk is not sunk a second time.
    scene.update(withSpecies(view, 'opponent', 'Onix'), NOOP);
    expect(beatsOf(scene, 'fainted')).toEqual({ me: undefined, foe: undefined });
    expect(actorOf(scene, 'foe').dataset['swapped']).toBe('true');
    expect(actorOf(scene, 'foe').querySelector('.sprite--ghost')?.hasAttribute('src')).toBe(false);
  });

  it('does not sink a body on the opening draw, however it arrived', () => {
    const scene = createScene();
    scene.update(withFainted(baseView(), 'opponent'), NOOP);
    expect(beatsOf(scene, 'fainting')).toEqual({ me: undefined, foe: undefined });
    // But it is down: the state is drawn even when there is no event to draw.
    expect(beatsOf(scene, 'fainted')).toEqual({ me: undefined, foe: 'true' });
  });

  it('clears every beat on a tap, and never the faint state', () => {
    const view = baseView();
    const scene = createScene();
    scene.update(withHp(view, 'opponent', 1), NOOP);
    scene.update(withFainted(view, 'opponent'), NOOP, replayOf(['p1', 'p2']));
    expect(beatsOf(scene, 'acted')).toEqual({ me: '1', foe: undefined });

    scene.root.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true }));
    for (const key of ['acted', 'hit', 'fainting'] as const) {
      expect(beatsOf(scene, key), key).toEqual({ me: undefined, foe: undefined });
    }
    // The tap cut the sink short and the body is exactly where the sink was going.
    expect(beatsOf(scene, 'fainted')).toEqual({ me: undefined, foe: 'true' });
  });
});

/**
 * The chunk each bar draws, in the step of the move that caused it.
 * **The victory-order patch, item 2; one step per action since the per-move
 * replay patch.**
 *
 * ## What was reported, and what it turned out to be
 *
 * "Animations are not tied to speed right now, are they? I just saw a Snubbull
 * go before my Sizzlipede and the animation for my attack went first."
 *
 * The lunges were not the problem. What had no order in it at all was the
 * **bar**: both sides' chunks were drawn on the frame the update arrived, so on
 * a turn where both sides took damage the outline of the hit the player
 * *dealt* appeared simultaneously with the one they took. The victory-order
 * patch slotted the chunk's fade; the per-move replay moves the *fill* too,
 * because a bar that is already at the turn's end state tells the player the
 * second move landed before the first one was drawn. Each step's bars stand
 * where the lines say the bodies stood after that action, and the view itself
 * lands last.
 */
describe('the chunk lands in its step', () => {
  function slotOf(scene: Scene, side: 'me' | 'foe'): string | undefined {
    return shadowOf(scene, side).dataset['slot'];
  }

  const body = (over: Partial<BodyState> = {}): BodyState => ({ switched: false, species: null, hp: null, fainted: false, ...over });
  const hpOf = (fraction: number): BodyState['hp'] => ({ current: Math.round(fraction * 100), max: 100, fraction });

  /** Both sides at full, then both halved on one turn, the steps saying whose move did which. */
  function twoHits(order: ('p1' | 'p2')[]): Scene {
    const scene = createScene();
    const full = baseView();
    scene.update(full, NOOP);
    const hurt = withHp(withHp(full, 'opponent', 0.5), 'player', 0.5);
    const steps = order.map((side) => ({
      side,
      kind: 'move' as const,
      // The side that acted took nothing yet; its target is at half.
      bodies: side === 'p1' ? { p1: body(), p2: body({ hp: hpOf(0.5) }) } : { p1: body({ hp: hpOf(0.5) }), p2: body() },
      marks: [],
      fired: [],
    }));
    // The second step's bodies carry the first's drop too, as the lines would.
    steps[1]!.bodies = { p1: body({ hp: hpOf(0.5) }), p2: body({ hp: hpOf(0.5) }) };
    scene.update(hurt, NOOP, { steps, marks: [], fired: [], bracket: null });
    return scene;
  }

  it('draws the target\'s chunk in the actor\'s step, and the reply\'s two beats on', () => {
    // p1 first: the foe's chunk answers p1's move now; the player's answers p2's
    // in the next step. Both ride slot 1, the beat after their step's lunge.
    const first = twoHits(['p1', 'p2']);
    expect(slotOf(first, 'foe')).toBe('1');
    expect(fillOf(first, 'foe').style.width).toBe('50%');
    expect(slotOf(first, 'me')).toBeUndefined();
    expect(fillOf(first, 'me').style.width).toBe('100%');
    // And the recoil agrees, because both read the one chunk.
    expect(beatsOf(first, 'hit')).toEqual({ me: undefined, foe: '1' });

    advance(2);
    expect(slotOf(first, 'me')).toBe('1');
    expect(fillOf(first, 'me').style.width).toBe('50%');
    // The foe lost nothing more this step, so its chunk stands where the last
    // step drew it, still fading (`keep`), and it takes no second hit.
    expect(slotOf(first, 'foe')).toBe('1');
    expect(beatsOf(first, 'hit')).toEqual({ me: '1', foe: undefined });

    // The view itself: both at half, nothing new lost, no chunk.
    advance(2);
    expect(fillOf(first, 'me').style.width).toBe('50%');
    expect(fillOf(first, 'foe').style.width).toBe('50%');
    expect(beatsOf(first, 'hit')).toEqual({ me: undefined, foe: undefined });
  });

  it('mirrors when the other side goes first, which is the reported turn', () => {
    const second = twoHits(['p2', 'p1']);
    expect(slotOf(second, 'me')).toBe('1');
    expect(slotOf(second, 'foe')).toBeUndefined();
    expect(beatsOf(second, 'hit')).toEqual({ me: '1', foe: undefined });
    advance(2);
    expect(slotOf(second, 'foe')).toBe('1');
    expect(beatsOf(second, 'hit')).toEqual({ me: undefined, foe: '1' });
  });

  it('carries no slot at all when there is no turn to place it in', () => {
    /*
     * The opening draw and every non-battle bar. Without a step there is no
     * order, so the chunk fades across the whole budget from now — exactly what
     * every bar did before slots existed. Asserted because the plausible wrong
     * change is to default to slot 1, which would hold the chunk at full
     * strength for a beat on a screen with no turn behind it.
     */
    const scene = createScene();
    const full = baseView();
    scene.update(full, NOOP);
    scene.update(withHp(full, 'opponent', 0.5), NOOP);
    expect(slotOf(scene, 'foe')).toBeUndefined();
    expect(shadowOf(scene, 'foe').dataset['fading']).toBe('true');
  });

  it('drops the slot when the chunk is cleared, so nothing is left held', () => {
    /*
     * A slotted chunk holds at full strength through its delay. A cleared one
     * that kept its slot would be a visible chunk with no animation left to
     * fade it — the shadow's `opacity: 0` base rule is what resolves it, and
     * `animation-fill-mode: both` overrides exactly that.
     */
    const scene = twoHits(['p2', 'p1']);
    expect(slotOf(scene, 'me')).toBe('1');
    scene.root.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true }));
    expect(slotOf(scene, 'me')).toBeUndefined();
    expect(shadowOf(scene, 'me').dataset['fading']).toBeUndefined();
    // The tap landed the bars on the view itself.
    expect(fillOf(scene, 'foe').style.width).toBe('50%');
  });

  it('places the chunk from the same reading the log numbers the turn with', () => {
    /*
     * Not a synthetic turn: a real fight, through the real adapter, on the turn
     * the report describes — the fast side moves first because Speed decided
     * it, and the slow side's chunk is the one drawn first because the fast
     * side's move is what took it. The HP is the lines' own.
     */
    const { scene, turns, replay } = playOneTurn(SLOW, FAST, 2, 'JIGGLE01');
    const order = turns.flatMap((turn) => turn.actions.map((each) => each.action.side));
    expect(order[0], 'the fixture no longer has the fast side moving first').toBe('p2');
    expect(replay.steps.map((step) => step.side)).toEqual(order);
    // p2 acted first, so the player's chunk answers it and is drawn first.
    expect(slotOf(scene, 'me')).toBe('1');
    expect(slotOf(scene, 'foe')).toBeUndefined();
    advance(2);
    expect(slotOf(scene, 'foe')).toBe('1');
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
     * One read per batch, exactly what `ui/screens/battle.ts` does. The
     * opening protocol was read first here because the reader used to carry
     * the species across batches for STAB; M4.1 deleted that, and what is left
     * is the shape the app has — each update read on its own.
     */

    for (let i = 0; i < turns && !session.ended; i++) {
      const before = session.protocolFor('p1').length;
      for (const side of ['p1', 'p2'] as const) {
        if (session.viewFor(side).awaitingChoice) session.submit(side, moveChoice(slot));
      }
      const batch = session.protocolFor('p1').slice(before).filter((line) => !line.startsWith('|t:|'));
      strip.show(readFlags(batch, FLAGS));
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
    /*
     * The premise changed under M4.1 and the assertion moved with it.
     *
     * This turn used to put `STAB`, `Contact` and `Super effective` on the
     * strip at once, and asserted all three. R9 deleted the first two as causes
     * rather than outcomes, and D23 cut what is left to one flag per side, so
     * the outcome is what survives — which is what the strip was for.
     * `test/flag-precedence.test.ts` owns which flag wins when several are
     * true; this owns that the turn is reported at all.
     */
    expect(words(strip)).toContain('Super effective');
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
    /*
     * Two sides, so the strip has more than one chip to compare after M4.1's
     * cut: one hit flag per side, plus the priority bracket in the second
     * channel. It was a single action carrying four flags until D23 ruled that
     * only one of them fits.
     */
    const protocol = [
      '|switch|p1a: Snorlax|Snorlax, L50, M|235/235',
      '|switch|p2a: Golem|Golem, L50, F|155/155',
      '|turn|1',
      '|move|p1a: Snorlax|Body Slam|p2a: Golem',
      '|-resisted|p2a: Golem',
      '|-crit|p2a: Golem',
      '|-damage|p2a: Golem|100/155',
      '|-status|p2a: Golem|par',
      '|move|p2a: Golem|Rock Slide|p1a: Snorlax',
      '|-supereffective|p1a: Snorlax',
      '|-damage|p1a: Snorlax|180/235',
      '|upkeep',
    ];
    const strip = createFlagStrip();
    strip.show(readFlags(protocol, FLAGS));

    const chips = [...strip.root.querySelectorAll('.chip')];
    expect(chips.length).toBeGreaterThan(1);
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
     * Both sides land a critical hit on the same turn, which prints `Critical
     * hit` twice. Without the side marker the strip says two identical words
     * about two different Pokemon and answers nothing.
     *
     * It was two same-type moves printing `STAB` twice until M4.1 deleted that
     * kind. The confusion on each side is the second channel, so every side
     * still carries more than one chip and the recipe check below has
     * something to compare.
     */
    const protocol = [
      '|switch|p1a: Snorlax|Snorlax, L50, M|235/235',
      '|switch|p2a: Persian|Persian, L50, F|155/155',
      '|turn|1',
      '|move|p1a: Snorlax|Body Slam|p2a: Persian',
      '|-crit|p2a: Persian',
      '|-damage|p2a: Persian|100/155',
      '|-start|p2a: Persian|confusion',
      '|move|p2a: Persian|Slash|p1a: Snorlax',
      '|-crit|p1a: Snorlax',
      '|-damage|p1a: Snorlax|200/235',
      '|-start|p1a: Snorlax|confusion',
      '|upkeep',
    ];
    const strip = createFlagStrip();
    strip.show(readFlags(protocol, FLAGS));

    const chips = [...strip.root.querySelectorAll('.chip')] as HTMLElement[];
    const crits = chips.filter((chip) => chip.dataset['flag'] === 'crit');
    expect(crits).toHaveLength(2);
    // Two identical words, two different sides, and the strip says so.
    expect(crits.map((chip) => chip.textContent)).toEqual(['Critical hit', 'Critical hit']);
    expect(crits.map((chip) => chip.dataset['side'])).toEqual(['p2', 'p1']);
    // The screen reader gets the name rather than the side code.
    expect(crits[0]?.getAttribute('aria-label')).toBe('Persian: Critical hit');
    expect(crits[1]?.getAttribute('aria-label')).toBe('Snorlax: Critical hit');

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
    /*
     * **Amended at V5.2, and the assertion it replaces was about the same
     * thing.** Release C wrote `strip.root.children.length === 0`, because at
     * the time the strip's only children were its chips and "cleared" and
     * "empty of elements" were the same sentence. V5 gave the container two
     * pieces of permanent furniture — the event line and the control that
     * opens the history — and a control that came and went with the turn
     * would be unreachable on the screen where the opening switch-ins are the
     * only thing that has happened.
     *
     * So the question is asked directly: after a clear there is no word and no
     * sentence to read. `data-empty` above still carries the height rule, and
     * `test/event-strip.test.ts` asserts the furniture survives.
     */
    expect(strip.root.querySelectorAll('.chip')).toHaveLength(0);
    expect(strip.root.querySelector('.flags__event')?.textContent).toBe('');
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
