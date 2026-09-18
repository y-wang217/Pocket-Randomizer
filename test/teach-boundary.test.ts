/**
 * Where a TM may be spent, and the control that offered it where it could not.
 *
 * ## The reported failure
 *
 * "teaching tms doesnt work. When i click out of the teach screen, the tms
 * return to inventory." Reported against a rest, and it reproduces.
 *
 * ## What was actually wrong
 *
 * Not the mechanism. `applyItemPlan` teaches, `reconcileItemPlan` keeps the
 * teach, and the three screens all fire their callbacks — checked end to end
 * through `playRun` on 300 seeds, where every one of 56 composed teaches landed
 * on the member the plan named.
 *
 * The bug was **where the control was offered.** `run.canTeachNow` reads the
 * node the run has just walked, and it stays true for the whole time the player
 * then stands on the map — so the map's Manage button showed a Teach control
 * after every rest and every shop. The plan that control composes is not spent
 * there: it is held until the boundary of the node walked *next*, where
 * `canTeachNow` reads that node instead. Walk into a fight and
 * `reconcileItemPlan` drops the teach, correctly by its own rule and silently,
 * and the TM is back in the bag.
 *
 * Measured on the scripted baseline over 400 runs: of **111** teaches composed
 * from the map, **9** survived to be spent and **57** were dropped; the rest
 * never reached another boundary before the run ended.
 *
 * `ui/app.ts`'s `chooseItemPlan` already described the fix — "the screen opens
 * here, where composing and spending are the same moment" — and opened the
 * screen at the boundary. What it did not do was stop the *other* route
 * offering the same control, which is what this pins.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createRun, partyCapacity } from '../src/core/run';
import { backpackCapacity, reconcileItemPlan } from '../src/core/items';
import { createParty, replacementNeeded } from '../src/core/party';
import { applyRelicPassives } from '../src/core/relics';
import { DEFAULT_TUNING } from '../src/data/tuning';
import type { ItemPlan } from '../src/core/types';

const ROOT = new URL('..', import.meta.url).pathname;
const APP = readFileSync(join(ROOT, 'src/ui/app.ts'), 'utf8');

describe('the Teach control is offered only where the teach is spent', () => {
  it('gates the party screen on the boundary, not only on the node just walked', () => {
    /*
     * `teachableNow(state)` alone is the bug: it is still non-empty while the
     * player stands on the map after a rest, and a plan composed there is spent
     * a node later. The gate has to be "this screen is the boundary's own
     * screen".
     *
     * **Unchanged in substance by the teach-now patch, and that is the point of
     * still asserting it.** What moved is which moves the set holds at a given
     * node; `atTeachBoundary` still decides whether the control is offered at
     * all, so the post-rest map defect this test was written for cannot come
     * back through the wider gate. `docs/generation.md` section 40.2.
     */
    expect(APP, 'the Teach control is back on every post-rest map screen').toContain(
      'teachable: atTeachBoundary ? teachableNow(state) : new Set<string>(),',
    );
  });

  it('arms the boundary only around the question, and disarms it after', () => {
    const branch = /atTeachBoundary = true;[\s\S]{0,400}?atTeachBoundary = false;/.exec(APP)?.[0] ?? '';
    expect(branch, 'the boundary flag is never armed and disarmed around one question').not.toEqual('');
    // It must be the item-plan question it wraps, not something else.
    expect(branch).toContain('itemPlanPick.wait()');
  });

  it('disarms it on every route that is a player looking rather than a boundary', () => {
    /*
     * The map's Manage button and the pre-gym screen's. Not the re-entries —
     * `back()` after a teach, a reorder, a release — which re-render the same
     * screen without leaving the boundary and must leave the flag alone.
     */
    const manage = /onManageParty: \(\) => \{[\s\S]*?\n {10}\},/.exec(APP)?.[0] ?? '';
    expect(manage, 'the pre-gym Manage button no longer disarms the boundary').toContain(
      'atTeachBoundary = false',
    );

    const mapRoutes = APP.match(/\(\) => \{ atTeachBoundary = false; showParty\('map'\); \}/g) ?? [];
    expect(mapRoutes.length, "the map's Manage button does not disarm the boundary").toBeGreaterThan(0);
  });
});

describe('why that gate has to exist: core drops the teach rather than holding it', () => {
  it('drops a composed teach at a boundary where teaching is illegal', () => {
    /*
     * This is `reconcileItemPlan` behaving exactly as documented — "the TM
     * stays in the bag, which is the outcome the player can still act on at the
     * next rest" — and it is why offering the control away from the boundary
     * loses the teach instead of deferring it. Asserted here so that a future
     * change making teaches *carry* across boundaries fails this case and gets
     * to reconsider the gate above.
     */
    const base = createRun('TEACH-GATE', DEFAULT_TUNING);
    const party = createParty([
      { species: 'Squirtle', ability: 'Torrent', moves: ['Tackle', 'Growl', 'Bubble', 'Withdraw'], level: 20 },
    ]);
    const move = 'Ice Beam';
    const state = { ...base, party, tms: [move], backpack: [] };

    expect(replacementNeeded(party[0]!, move), 'the fixture no longer needs a replacement').toBe('choose');
    const plan: ItemPlan = {
      assignments: [{ slot: 0, item: null }],
      discards: [],
      teaches: [{ move, slot: 0, replaceSlot: 1 }],
      discardTms: [],
    };
    const capacity = backpackCapacity(partyCapacity(state), state.tuning, applyRelicPassives(state.relics));

    const atRest = reconcileItemPlan(state, plan, capacity, new Set(state.tms));
    expect(atRest.teaches, 'a legal teach was dropped at a teachable boundary').toHaveLength(1);

    const midRoute = reconcileItemPlan(state, plan, capacity, new Set());
    expect(midRoute.teaches, 'the teach survived a boundary that cannot spend it').toHaveLength(0);
  });
});
