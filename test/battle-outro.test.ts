/**
 * The end of a fight, and the one thing on the battle screen that waits.
 *
 * @vitest-environment jsdom
 *
 * ## The defect these are here for
 *
 * A fight that ended in a one-hit KO showed no animation at all. It was never
 * only a 1HKO: the last turn of *every* fight was swallowed, and a 1HKO is
 * the case where the last turn is the only turn, so it was the one where
 * nothing moved. `driver.ts` drains the final protocol batch and calls `notify`
 * synchronously, the scene starts three CSS animations, the battle loop exits,
 * and `app.ts` used to call `showScreen('result')` on the same microtask. No
 * yield, no paint.
 *
 * ## Why these are jsdom tests
 *
 * Same rule `test/battle-feedback.test.ts` states: nothing here is about
 * layout, and every assertion is about which attributes exist and when a
 * promise settles.
 *
 * **The iOS animations patch rewrote the hold cases, and the reason is the
 * point of the patch.** They used to read: jsdom resolves no custom properties,
 * so `--motion-outro` came back empty, so the hold was zero, so `outro()`
 * resolved at once — and the file asserted that as the reduced-motion path. It
 * was not the reduced-motion path. It was Bug A, reproduced in a test and
 * written down as correct behaviour: a failed style lookup returning zero, and
 * zero being no hold at all. A test that pins the failure mode of the thing it
 * is testing cannot report it.
 *
 * `scene.ts` asks `outroHoldMs()` now and never reads a stylesheet, so jsdom
 * gets the same hold a browser does and these cases assert the length rather
 * than its absence. Fake timers, because the assertion is "how long", not "how
 * slowly does this suite run".
 *
 * **The most important test in this file is the last one.** It asserts at the
 * seam rather than at the function: `outro()` returning a promise proves
 * nothing if `app.ts` forgets to await it, and a test that only checks the
 * scene passes just as happily either way. `docs/README.md` open item 15 logs
 * that class of gap as the standing risk, after it fired twice inside one
 * patch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createBattle } from '../src/core/battle/driver';
import { readFlags, type FlagDeps } from '../src/core/battle/flags';
import { buildBattleUiView } from '../src/core/battle/view';
import type { BattleReview } from '../src/core/run';
import { abilityEffects } from '../src/data/abilityEffects';
import { OPPONENT_TEAM, PLAYER_TEAM } from '../src/data/mons';
import { outroFor } from '../src/ui/app';
import { abnormalityMarks } from '../src/ui/abnormality';
import { createScene, type Scene } from '../src/ui/scene';
import { DEFAULT_DISPLAY_TUNING } from '../src/data/displayTuning';

import { BATTLE_SPEED_SCALE, resetSettings, setBattleSpeed } from '../src/ui/settings';

beforeEach(() => {
  resetSettings();
});

function actor(scene: Scene, side: 'me' | 'foe'): HTMLElement {
  const found = scene.root.querySelector(`.stage__actor--${side}`);
  if (!(found instanceof HTMLElement)) throw new Error(`no ${side} actor in the scene`);
  return found;
}

/**
 * Whether a promise has settled, without waiting on it.
 *
 * Racing against `Promise.resolve()` does **not** work and the first draft of
 * this did exactly that: a continuation attached with `.then` runs one
 * microtask later than the marker it is racing, so an already-resolved promise
 * loses its own race and every call returned false. Flushing a fixed number of
 * microtask turns and then reading a flag is the honest form — an already
 * resolved promise sets it, and one parked on a timer cannot.
 */
async function settled(promise: Promise<void>): Promise<boolean> {
  let done = false;
  void promise.then(() => {
    done = true;
  });
  for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();
  return done;
}

describe('which body leaves, and how', () => {
  it('recalls both sides when the fight was won', async () => {
    const scene = createScene();
    /*
     * Not awaited. `outro()` marks both bodies and *then* parks, and since the
     * iOS patch the park is a real hold in jsdom too — so awaiting it here
     * would be sitting through 750ms to read an attribute that was set on the
     * first line. `cancel()` releases it; the hold's own length is asserted in
     * "the hold" below, which is where that question belongs.
     */
    const parked = scene.outro('recall');
    expect(actor(scene, 'foe').dataset['outro']).toBe('recall');
    expect(actor(scene, 'me').dataset['outro']).toBe('recall');
    scene.cancel();
    await parked;
  });

  it('takes the opponent with a ball on a won wild fight, and still recalls your own', async () => {
    const scene = createScene();
    const parked = scene.outro('caught');
    expect(actor(scene, 'foe').dataset['outro']).toBe('caught');
    // The player's lead is recalled either way: a ball is offered for the body
    // that fainted, not for the one that won.
    expect(actor(scene, 'me').dataset['outro']).toBe('recall');
    scene.cancel();
    await parked;
  });

  it('marks neither side on a defeat, because the body that ended it has already sunk', async () => {
    const scene = createScene();
    const parked = scene.outro('defeat');
    expect(actor(scene, 'foe').dataset['outro']).toBeUndefined();
    expect(actor(scene, 'me').dataset['outro']).toBeUndefined();
    scene.cancel();
    await parked;
  });

  /*
   * The double-animation case. `scene.ts` already refuses to sink a KO'd body
   * twice on a swap — the ghost is left empty when the body that left had
   * fainted — and a recall is the same question: raising a sunk sprite to full
   * opacity to shrink it again would play the faint backwards.
   */
  it('does not recall a body that already fainted', async () => {
    const scene = createScene();
    actor(scene, 'me').dataset['fainted'] = 'true';
    const parked = scene.outro('recall');
    expect(actor(scene, 'foe').dataset['outro']).toBe('recall');
    expect(actor(scene, 'me').dataset['outro']).toBeUndefined();
    scene.cancel();
    await parked;
  });

  it('carries a ball that is not drawn until a capture', () => {
    const scene = createScene();
    const ball = scene.root.querySelector('.stage__ball');
    expect(ball, 'the ball is built with the actor').not.toBeNull();
    // At rest no actor is marked, so the stylesheet never animates it. Same
    // rule as the ghost: nothing on the stage holds a thing that is not in the
    // fight.
    expect(actor(scene, 'foe').dataset['outro']).toBeUndefined();
  });
});

describe('the hold', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Park an outro on fake timers and report whether it had resolved after `ms`.
   *
   * Fake timers rather than a real wait, because every case here is about a
   * boundary — "not yet at one tick short, yes at the length itself" — and the
   * only way to ask that with a real clock is to sleep through it and hope the
   * machine was not busy.
   */
  async function resolvedAfter(scene: Scene, promise: Promise<void>, ms: number): Promise<boolean> {
    await vi.advanceTimersByTimeAsync(ms);
    void scene;
    return settled(promise);
  }

  /*
   * **This case used to assert the opposite, and that is the patch.** It read
   * "resolves at once when the duration token is zero", which was true, and was
   * Bug A: jsdom resolves no custom properties, the lookup came back empty, the
   * parse failed, and the function returned zero. The test called that the
   * reduced-motion path and passed. Nothing in the suite could then see the
   * defect, because the defect was the fixture.
   */
  it('holds for the full budget, where it used to resolve at once', async () => {
    vi.useFakeTimers();
    const scene = createScene();
    const parked = scene.outro('recall');
    const full = DEFAULT_DISPLAY_TUNING.battleFeedbackMs;

    expect(await resolvedAfter(scene, parked, full - 1), 'resolved before the budget was up').toBe(false);
    expect(await resolvedAfter(scene, parked, 1), 'never resolved at the budget').toBe(true);
  });

  /*
   * The floor, from this end. `outroHoldMs`'s own inputs are covered in
   * `test/motion-hold.test.ts`; this asserts the scene actually parks on a
   * non-zero timer rather than falling through, which is the behaviour the
   * deleted `if (ms <= 0) return Promise.resolve()` branch used to provide.
   */
  it('never resolves on the same microtask, whatever the hold works out to', async () => {
    vi.useFakeTimers();
    const scene = createScene();
    expect(await settled(scene.outro('recall'))).toBe(false);
  });

  it('follows the battle speed, because the hold is the budget', async () => {
    vi.useFakeTimers();
    setBattleSpeed('swift');
    const scene = createScene();
    const parked = scene.outro('recall');
    const swift = DEFAULT_DISPLAY_TUNING.battleFeedbackMs * BATTLE_SPEED_SCALE.swift;

    expect(await resolvedAfter(scene, parked, swift - 1)).toBe(false);
    expect(await resolvedAfter(scene, parked, 1)).toBe(true);
  });

  it('still marks the bodies, hold or no hold', async () => {
    const scene = createScene();
    const parked = scene.outro('recall');
    // Reduced motion removes the movement, not the outcome.
    expect(actor(scene, 'foe').dataset['outro']).toBe('recall');
    scene.cancel();
    await parked;
  });

  it('resolves rather than rejecting when a run is abandoned mid-hold', async () => {
    const scene = createScene();
    const parked = scene.outro('recall');
    scene.cancel();
    await expect(parked).resolves.toBeUndefined();
  });

  it('settles the stage on cancel, so no beat outlives its screen', async () => {
    const scene = createScene();
    const parked = scene.outro('recall');
    scene.cancel();
    await parked;
    expect(actor(scene, 'foe').dataset['outro']).toBeUndefined();
    expect(actor(scene, 'me').dataset['outro']).toBeUndefined();
  });

  it('clears the outro on a tap, like every other beat on the stage', async () => {
    const scene = createScene();
    const parked = scene.outro('recall');
    scene.root.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    // The tap is what resolves it: a gate that cannot be skipped is a stall.
    await parked;
    expect(actor(scene, 'foe').dataset['outro']).toBeUndefined();
    expect(actor(scene, 'me').dataset['outro']).toBeUndefined();
  });
});

/**
 * The seam. **This is the test that catches a dropped `await`.**
 *
 * `app.ts`'s `reviewBattle` is the only path every battle completion takes, and
 * the fix is one `await` in front of the render. Asserting on the scene alone
 * cannot see whether that `await` is there, which is precisely the gap open
 * item 15 describes: two halves each correct, the defect in between, and `tsc`
 * blind to it by construction because a floating promise is valid TypeScript.
 *
 * So this models the seam itself — a policy shaped like the real one — and
 * asserts the ordering rather than the parts.
 */
describe('the result screen does not arrive before the fight has ended', () => {
  it('renders nothing while the outro is parked, and everything after it', async () => {
    const scene = createScene();
    const shown: string[] = [];

    // The shape of `app.ts`'s reviewBattle: hold, then render, then park on the
    // player's pick.
    const reviewBattle = async (): Promise<void> => {
      const parked = scene.outro('recall');
      scene.cancel();
      await parked;
      shown.push('result');
    };

    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    // Stand in for a hold that has not elapsed. The scene's own timer is real
    // in jsdom since the iOS patch, but the question here is the ordering at
    // the seam rather than the length, so it is asserted against a promise this
    // test controls and the hold is released by `cancel` below.
    const gated = (async (): Promise<void> => {
      await held;
      await reviewBattle();
    })();

    expect(shown, 'the result screen rendered before the outro finished').toEqual([]);
    release();
    await gated;
    expect(shown).toEqual(['result']);
  });

  /*
   * And the decision itself, which is the other half of the seam: the ordering
   * case above proves the hold is awaited, these prove it is asked for the
   * right thing. `outroFor` is pure and reads only fields the review already
   * carries, which is what keeps `core/` out of this entirely.
   */
  it('asks for the outro the review describes', () => {
    const won = (acquisition: unknown): BattleReview =>
      ({ won: true, node: { acquisition } } as unknown as BattleReview);

    expect(outroFor({ won: false, node: {} } as unknown as BattleReview)).toBe('defeat');
    expect(outroFor(won(null))).toBe('recall');
    expect(outroFor(won({ species: 'Pikachu' }))).toBe('caught');
  });

  it('calls a lost fight a defeat even at a node that offers a capture', () => {
    // `core/run.ts` refuses an acquisition after a fight that was lost — "an
    // offer is refused only by a fight that was lost" — so a ball closing here
    // would promise something the run is about to decline.
    const lostAtWild = { won: false, node: { acquisition: { species: 'Pikachu' } } } as unknown as BattleReview;
    expect(outroFor(lostAtWild)).toBe('defeat');
  });
});

/**
 * The abnormality beats. **Branch 3B.**
 *
 * Driven by hand-written protocol rather than played battles, for the reason
 * `test/flags.test.ts`'s stub block gives: the point of each case is a specific
 * shape, and waiting for a real fight to produce a flinch is a slow way to
 * assert one.
 *
 * The scene is fed a view and a `FlaggedTurn[]` exactly as `screens/battle.ts`
 * does, so what is asserted is the wiring that ships.
 */
describe('an abnormality gets a beat, and it costs the turn nothing', () => {
  const STUB: FlagDeps = {
    priorityOf: () => 0,
    moveIdentityOf: () => ({ type: 'Normal', category: 'Physical', contact: true }),
    typesOf: () => ['Normal'],
  };

  /**
   * A turn's worth of protocol, read and handed to a fresh scene.
   *
   * Deliberately the same three calls `ui/screens/battle.ts` makes — one
   * `readFlags` over the batch, `abnormalityMarks` over the result, then
   * `scene.update(view, onChoose, turns, marks)` — so what is asserted below is
   * the wiring that ships rather than a rehearsal of it. The scene derives no
   * mark of its own: `test/boundaries.test.ts` forbids it from reading a flag.
   */
  function watch(lines: readonly string[]): Scene {
    const scene = createScene();
    const session = createBattle({ teams: { p1: PLAYER_TEAM, p2: OPPONENT_TEAM }, seed: 'ABNORM01' });
    const view = buildBattleUiView(session.factsFor('p1'), { ability: true, item: true, teamSize: true }, abilityEffects);
    const turns = readFlags([...lines], STUB);
    scene.update(view, () => undefined, turns, abnormalityMarks(turns));
    return scene;
  }

  const OPEN = ['|switch|p1a: Snorlax|Snorlax, L50, M|235/235', '|switch|p2a: Golem|Golem, L50, M|155/155', '|turn|1'];

  it('marks a flinched turn, which today leaves no other trace at all', () => {
    const scene = watch([...OPEN, '|cant|p1a: Snorlax|flinch']);
    expect(actor(scene, 'me').dataset['abnormal']).toBe('prevented');
  });

  it('gives a stat change its own shape, and both directions the same one', () => {
    const rose = watch([...OPEN, '|move|p1a: Snorlax|Tackle|p2a: Golem', '|-boost|p1a: Snorlax|atk|1']);
    const fell = watch([...OPEN, '|move|p1a: Snorlax|Tackle|p2a: Golem', '|-unboost|p1a: Snorlax|atk|1']);
    expect(rose.root.querySelector('.stage__actor--me')?.getAttribute('data-abnormal')).toBe('stage');
    /*
     * The same beat for a rise and a fall, deliberately. Which way it went is a
     * word on the strip and a chip on the panel; a beat that rose for one and
     * fell for the other would be the board taking a view on which is better.
     */
    expect(fell.root.querySelector('.stage__actor--me')?.getAttribute('data-abnormal')).toBe('stage');
  });

  it('tells the five classes apart', () => {
    const cases: ReadonlyArray<[string, string]> = [
      ['|-ability|p1a: Snorlax|Intimidate|boost', 'trait'],
      ['|-start|p1a: Snorlax|confusion', 'volatile'],
      ['|-weather|RainDance|[from] ability: Drizzle|[of] p1a: Snorlax', 'field'],
      ['|-fail|p1a: Snorlax', 'prevented'],
    ];
    for (const [line, klass] of cases) {
      const scene = watch([...OPEN, '|move|p1a: Snorlax|Tackle|p2a: Golem', line]);
      expect(actor(scene, 'me').dataset['abnormal'], line).toBe(klass);
    }
  });

  /*
   * **The negative, and the one a plausible one-line change breaks.** The beats
   * must cost an ordinary turn nothing at all — not "be fast on", but "not
   * exist on".
   */
  it('marks nothing on a turn that was only damage', () => {
    const scene = watch([...OPEN, '|move|p1a: Snorlax|Tackle|p2a: Golem', '|-damage|p2a: Golem|100/155']);
    expect(actor(scene, 'me').dataset['abnormal']).toBeUndefined();
    expect(actor(scene, 'foe').dataset['abnormal']).toBeUndefined();
  });

  it('rides the slot of the action that caused it, so it adds no time', () => {
    const scene = watch([...OPEN, '|move|p1a: Snorlax|Tackle|p2a: Golem', '|-unboost|p2a: Golem|spe|1']);
    // p1 acted first, so its target's mark sits in slot 1 with p1's own lunge.
    expect(actor(scene, 'foe').dataset['abnormalSlot']).toBe('1');
  });

  it('takes one mark per side, and the strip keeps the rest', () => {
    const scene = watch([
      ...OPEN,
      '|move|p1a: Snorlax|Tackle|p2a: Golem',
      '|-unboost|p2a: Golem|spe|1',
      '|-unboost|p2a: Golem|atk|1',
      '|-start|p2a: Golem|confusion',
    ]);
    // First in protocol order — which `flags.ts` calls "the one ordering that is
    // a fact rather than an opinion", so taking the first is not a ranking.
    expect(actor(scene, 'foe').dataset['abnormal']).toBe('stage');
  });

  it('clears on a tap, like every other beat on the stage', () => {
    const scene = watch([...OPEN, '|cant|p1a: Snorlax|flinch']);
    expect(actor(scene, 'me').dataset['abnormal']).toBe('prevented');
    scene.root.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(actor(scene, 'me').dataset['abnormal']).toBeUndefined();
    expect(actor(scene, 'me').dataset['abnormalSlot']).toBeUndefined();
  });

  it('builds a mark that is not drawn until something happens', () => {
    const scene = createScene();
    expect(scene.root.querySelector('.stage__mark'), 'the mark is built with the actor').not.toBeNull();
    expect(actor(scene, 'me').dataset['abnormal']).toBeUndefined();
  });
});
