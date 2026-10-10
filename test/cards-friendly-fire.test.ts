/**
 * A player Blast hurts allies on its tiles
 * (`docs/spec/gymrun-patch-card-battle-grace-friendly-fire.md` A2): through
 * shield, base shield and HP, as for an enemy; never the unit that plays it
 * by default; never from a Strike, Pierce or Slash. Legality is unchanged.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { RULES } from '../src/cardData/rules';
import type { BattleEvent } from '../src/core/cards/events';
import { choicesFor } from '../src/core/cards/legal';
import { friendlyFireFor, previewPlay } from '../src/core/cards/preview';
import type { Action, BattleState, Choice, UnitId } from '../src/core/cards/state';
import { step } from '../src/core/cards/step';
import { viewOf } from '../src/core/cards/view';
import { at, board, iidOf } from './fixtures/card-battle';

const rules = RULES as { blastFriendlyFire: (typeof RULES)['blastFriendlyFire'] };
afterEach(() => {
  rules.blastFriendlyFire = 'alliesExceptCaster';
});

function ok(state: BattleState, action: Action): { state: BattleState; events: BattleEvent[] } {
  const result = step(state, action);
  if (!result.ok) throw new Error(`refused ${JSON.stringify(action)}: ${result.reason}`);
  return result;
}
const play = (state: BattleState, def: string, unit: UnitId, choice?: Choice): BattleState =>
  ok(state, choice ? { type: 'select', card: iidOf(state, def), unit, choice } : { type: 'select', card: iidOf(state, def), unit }).state;
const unit = (state: BattleState, id: UnitId) => state.units.find((u) => u.id === id)!;
const damaged = (events: BattleEvent[]) => events.filter((e) => e.t === 'damaged').map((e) => (e as { target: string }).target);

/** B in the danger zone at L2C4 aiming Fire! at L2C5: its tiles are L2C5, L1C5, L3C5, L2C4 (B's own) and L2C6 (the Lancer). */
function fireAtC(): BattleState {
  return board({ hand: ['fire'], mp: { B: 1 }, units: { B: at(2, 4), C: at(1, 5) } });
}

describe('Blast friendly fire', () => {
  it('hits an ally on its tiles through base shield, after the enemies, and spares the unit that plays it', () => {
    const state = play(fireAtC(), 'fire', 'B', { tile: at(2, 5) });
    const { state: after, events } = ok(state, { type: 'commit' });
    const played = events.findIndex((e) => e.t === 'played');
    const mine = events.slice(played, events.findIndex((e, i) => i > played && e.t !== 'damaged' && e.t !== 'friendlyFire'));
    expect(damaged(mine)).toEqual(['e1', 'C']);
    expect(events).toContainEqual({ t: 'friendlyFire', card: iidOf(state, 'fire'), unit: 'C' });
    expect(events).toContainEqual({ t: 'damaged', target: 'C', amount: 1, shield: 0, baseShield: 1, hp: 0 });
    expect(unit(after, 'C').baseShield).toBe(1);
    expect(damaged(events)).not.toContain('B');
  });

  it("hits the unit that plays it too under 'allies', and no ally under 'none'", () => {
    rules.blastFriendlyFire = 'allies';
    let state = play(fireAtC(), 'fire', 'B', { tile: at(2, 5) });
    expect(damaged(ok(state, { type: 'commit' }).events).filter((id) => id.length === 1)).toEqual(['B', 'C']);
    rules.blastFriendlyFire = 'none';
    state = play(fireAtC(), 'fire', 'B', { tile: at(2, 5) });
    expect(damaged(ok(state, { type: 'commit' }).events).filter((id) => id.length === 1)).toEqual([]);
  });

  it('centres a targeted Blast on the enemy and hits an ally beside it', () => {
    let state = board({ hand: ['artillery'], mp: { B: 4 }, units: { B: at(1, 3), C: at(2, 5) }, enemies: [at(1, 6), at(2, 6), at(3, 6)] });
    state = play(state, 'artillery', 'B', { unit: 'e1' });
    const { events } = ok(state, { type: 'commit' });
    expect(events).toContainEqual({ t: 'friendlyFire', card: iidOf(state, 'artillery'), unit: 'C' });
    expect(events).toContainEqual({ t: 'damaged', target: 'C', amount: 2, shield: 0, baseShield: 2, hp: 0 });
  });

  it('never hits an ally with a Strike, a Pierce or a Slash', () => {
    // C slashes from the danger zone with A beside the Drone on the next column; B shoots down a lane past C.
    let state = board({ hand: ['slash', 'shoot'], mp: { B: 1, C: 1 }, units: { A: at(2, 5), B: at(1, 2), C: at(1, 4) }, enemies: [at(1, 5), at(2, 6), at(3, 6)] });
    state = play(state, 'slash', 'C');
    state = play(state, 'shoot', 'B');
    const { events } = ok(state, { type: 'commit' });
    expect(events.some((e) => e.t === 'friendlyFire')).toBe(false);
    expect(damaged(events).filter((id) => id.length === 1)).toEqual([]);
  });

  it('faints an ally normally, cards and all, and the fainted unit plays nothing more that round', () => {
    // A (HP 1, base shield 0 here) stands on the Blast's tiles with Focus in hand and a Neutral planned after the Blast.
    let state = board({ hand: ['fire', 'focus', 'dig-in'], mp: { A: 1, B: 1 }, units: { A: at(1, 5), B: at(2, 4) } });
    unit(state, 'A').baseShield = 0;
    state = play(state, 'fire', 'B', { tile: at(2, 5) });
    state = play(state, 'dig-in', 'A');
    const { state: after, events } = ok(state, { type: 'commit' });
    const fainted = events.find((e) => e.t === 'fainted');
    expect(fainted).toMatchObject({ unit: 'A' });
    expect(after.piles.removed).toContain(iidOf(state, 'focus'));
    expect(events).toContainEqual({ t: 'planPruned', card: iidOf(state, 'dig-in'), unit: 'A', reason: 'fainted' });
    expect(events.filter((e) => e.t === 'played').map((e) => (e as { card: string }).card)).toEqual([iidOf(state, 'fire')]);
    // The Neutral it held stays a deck card: discarded with the hand.
    expect(after.piles.discard).toContain(iidOf(state, 'dig-in'));
    expect(after.phase).toBe('plan');
  });

  it('keeps legality as it was: a Blast still needs an enemy on its tiles, an ally alone does not make it playable', () => {
    // B at L2C3: its centres are columns 4 and 5, so every footprint holds C and none an enemy.
    const state = board({ hand: ['fire'], mp: { B: 1 }, units: { B: at(2, 3), C: at(1, 4) }, enemies: [at(1, 7), at(2, 7), at(3, 7)] });
    expect(choicesFor(state, iidOf(state, 'fire'), 'B').tiles).toEqual([]);
    expect(viewOf(state).hand.flatMap((g) => g.cards).find((c) => c.def === 'fire')!.reason).toBe('noTarget');
  });

  it('previews the allies a planned Blast hits, and while aiming, each choice that would hit one', () => {
    const state = fireAtC();
    const card = iidOf(state, 'fire');
    expect(previewPlay(state, { card, unit: 'B', choice: { tile: at(2, 5) } }).allies).toEqual([{ unit: 'C', n: 1 }]);
    expect(previewPlay(state, { card, unit: 'B', choice: { tile: at(3, 6) } }).allies).toEqual([]);
    const choices = choicesFor(state, card, 'B');
    const ff = friendlyFireFor(state, card, 'B', choices);
    expect(ff.map((f) => `${f.tile!.lane},${f.tile!.col}`).sort()).toEqual(['1,5', '1,6', '2,5'].filter((t) => choices.tiles.some((c) => `${c.lane},${c.col}` === t)).sort());
    for (const f of ff) expect(f.allies).toEqual([{ unit: 'C', n: 1 }]);
    const planned = play(state, 'fire', 'B', { tile: at(2, 5) });
    expect(viewOf(planned).previews[0]!.allies).toEqual([{ unit: 'C', n: 1 }]);
  });
});
