/**
 * `onProjection`, and the three moments inside a node when a readout goes stale.
 *
 * ## The defect these are here for
 *
 * `onState` fires once per node, at the bottom of the loop, because that is
 * where `resolveNode` produces a state to fire it with. But a node contains
 * three moments at which the run has been *told* something it has not yet
 * *applied* — the fight ended, a card was taken, a Pokemon was caught — and
 * every screen between each of those and the node boundary was drawing the
 * party as the node *started*.
 *
 * The reported case was the smallest of the three: the TM recipient screen
 * listed the Anorith the player had just taken and the drawer listed the
 * Mantyke it replaced. Measuring the other two found worse. Across 40 seeds on
 * the scripted baseline the party the result screen drew and the party the
 * drawer drew disagreed at **165 of 182** battle reviews; across twelve seeds,
 * **137 of 217** turns had the drawer reporting different HP from the fight it
 * was overlaying, the worst of them a Seel the field had at 1 HP and the drawer
 * at 25.
 *
 * ## What is asserted
 *
 * The hook is a projection and not a transition, so the first and most
 * important case here is that it changes nothing: a run played with it and a
 * run played without it produce byte-identical logs. Everything after that
 * checks that each of the three moments is reported at the moment it becomes
 * true, against the screen that is up at the time.
 *
 * The in-battle source is not this hook at all — mid-fight there is no run
 * state to project, the damage is in the sim — so its case drives a real
 * session and folds it the way `ui/app.ts` does.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import type { BattleSession } from '../src/core/battle/driver';
import { applyBattleState } from '../src/core/party';
import {
  playRun,
  scriptedRunPolicy,
  type RunPolicy,
  type RunProjection,
  type RunState,
} from '../src/core/run';
import type { PokemonState } from '../src/core/types';
import { DEFAULT_TUNING } from '../src/data/tuning';

const hpOf = (party: readonly { hp: number; maxHp: number }[]): string =>
  party.map((member) => `${member.hp}/${member.maxHp}`).join(' ');
const namesOf = (party: readonly { spec: { species: string } }[]): string =>
  party.map((member) => member.spec.species).join(',');

/** Six seeds, enough that a node doing two of the three things turns up. */
const SEEDS = ['PROJ-0', 'PROJ-1', 'PROJ-2', 'PROJ-3', 'PROJ-4', 'PROJ-5'];

describe('the projection hook changes nothing about the run', () => {
  it('produces a byte-identical log whether or not anybody is listening', async () => {
    /*
     * The property that makes this hook safe to add at all, and the one a
     * reviewer should check first: it is `onNodeResolved`'s kind of hook, not
     * `onState`'s. If a projection could move a run, every balance figure and
     * every recorded seed in the repo would be conditional on whether a UI
     * happened to be attached.
     */
    for (const seed of SEEDS) {
      const quiet = await playRun(seed, scriptedRunPolicy(greedyAiPolicy), DEFAULT_TUNING, {
        opponent: greedyAiPolicy,
      });
      let fired = 0;
      const watched = await playRun(seed, scriptedRunPolicy(greedyAiPolicy), DEFAULT_TUNING, {
        opponent: greedyAiPolicy,
        onProjection: () => { fired++; },
      });

      expect(JSON.stringify(watched.log), seed).toEqual(JSON.stringify(quiet.log));
      expect(watched.outcome, seed).toEqual(quiet.outcome);
      expect(hpOf(watched.state.party), seed).toEqual(hpOf(quiet.state.party));
      // A vacuous pass would be a hook that never fires.
      expect(fired, `${seed} never projected anything`).toBeGreaterThan(0);
    }
  }, 120_000);
});

describe('what the projection says, at each of the three moments', () => {
  it('reports the fight as the sim left it, on the screen that shows the fight', async () => {
    /*
     * `reviewBattle` is the result screen, and its `party` is documented as
     * "the party as the sim left it, before the node boundary heals anything".
     * The drawer over that screen has to agree with it, and before this hook it
     * disagreed in 91% of reviews.
     */
    let checked = 0;
    let diverged = 0;
    for (const seed of SEEDS) {
      let projected: readonly PokemonState[] | null = null;
      const base = scriptedRunPolicy(greedyAiPolicy);
      const policy: RunPolicy = {
        ...base,
        reviewBattle: async (review, state) => {
          checked++;
          if (hpOf(projected ?? []) !== hpOf(review.party)) diverged++;
          return base.reviewBattle ? base.reviewBattle(review, state) : null;
        },
      };
      await playRun(seed, policy, DEFAULT_TUNING, {
        opponent: greedyAiPolicy,
        onState: () => { projected = null; },
        onProjection: (projection: RunProjection) => { projected = projection.party; },
      });
    }

    expect(checked, 'no battle was reviewed, so this asserted nothing').toBeGreaterThan(0);
    expect(diverged, 'the drawer would contradict the result screen it sits over').toBe(0);
  }, 120_000);

  /*
   * Seeds chosen because they take a relic card *and* show another screen in
   * the same node, which is the only shape this case can be observed in. Found
   * by scanning `PROJ-0` to `PROJ-159`; the six above never take one, and the
   * vacuity guard below caught that rather than passing quietly.
   */
  const RELIC_SEEDS = ['PROJ-19', 'PROJ-21', 'PROJ-26', 'PROJ-27'];

  it('carries a relic the moment the card is taken, not when the node ends', async () => {
    /*
     * The card is chosen on the result screen; `resolveNode` grants it at the
     * end of the node. Every screen in between — the capture, both move
     * questions — listed the relics the player held *before* the choice they
     * had just made.
     */
    let checked = 0;
    let missing = 0;
    for (const seed of RELIC_SEEDS) {
      let projected: readonly string[] = [];
      let taken: string | null = null;
      const base = scriptedRunPolicy(greedyAiPolicy);
      const policy: RunPolicy = {
        ...base,
        reviewBattle: async (review, state) => {
          const index = base.reviewBattle ? await base.reviewBattle(review, state) : null;
          const card = review.offer?.options[index ?? 0];
          taken = card?.kind === 'relic' ? card.relic : null;
          return index;
        },
        // The first surface shown after the card, whichever it is.
        chooseAcquisition: async (offer, party, capacity) => {
          if (taken) {
            checked++;
            if (!projected.includes(taken)) missing++;
          }
          return base.chooseAcquisition(offer, party, capacity);
        },
        chooseMoveRecipient: async (offer, party, state, allowSkip) => {
          if (taken) {
            checked++;
            if (!projected.includes(taken)) missing++;
          }
          return base.chooseMoveRecipient(offer, party, state, allowSkip);
        },
      };
      await playRun(seed, policy, DEFAULT_TUNING, {
        opponent: greedyAiPolicy,
        onState: () => { projected = []; taken = null; },
        onProjection: (projection) => { projected = [...projection.relics]; },
      });
    }

    expect(checked, 'no relic card was taken, so this asserted nothing').toBeGreaterThan(0);
    expect(missing, 'a relic the player took is missing from the readout').toBe(0);
  }, 120_000);

  it('folds the capture, which is the case the report arrived about', async () => {
    /*
     * The reported screenshots: the recipient screen listing the Anorith, the
     * drawer listing the Mantyke it replaced. The move question's own `party`
     * argument is the run's reading of who is in the party, so the projection
     * has to name the same members in the same order.
     */
    let checked = 0;
    let diverged = 0;
    for (const seed of SEEDS) {
      let projected: readonly PokemonState[] | null = null;
      const base = scriptedRunPolicy(greedyAiPolicy);
      const policy: RunPolicy = {
        ...base,
        chooseMoveRecipient: async (offer, party, state, allowSkip) => {
          checked++;
          if (namesOf(projected ?? []) !== namesOf(party)) diverged++;
          return base.chooseMoveRecipient(offer, party, state, allowSkip);
        },
      };
      await playRun(seed, policy, DEFAULT_TUNING, {
        opponent: greedyAiPolicy,
        onState: () => { projected = null; },
        onProjection: (projection) => { projected = projection.party; },
      });
    }

    expect(checked, 'no move was taught, so this asserted nothing').toBeGreaterThan(0);
    expect(diverged, 'the drawer would list a member the recipient screen does not').toBe(0);
  }, 120_000);
});

describe('mid-fight there is no run state, so the drawer reads the sim', () => {
  it('reports the HP the field has, not the HP the node was entered with', async () => {
    /*
     * The sharp case, and the one the drawer's own copy promises: it says "Your
     * side, as the fight has left it" on every turn of every battle. It was
     * showing the party as the *node* was entered with — 137 of 217 turns
     * across twelve seeds disagreed with the field.
     *
     * This folds it exactly as `ui/app.ts` does: `applyBattleState` over the
     * party the fight was *sent* with, because that is the order
     * `sendOrder` computed the read-back against. An empty contribution list
     * keeps each member's own counters, which is right — a fight's contribution
     * is not final until it ends.
     */
    let checked = 0;
    let diverged = 0;
    let sawDamage = false;

    for (const seed of SEEDS) {
      let fight: { session: BattleSession; sent: readonly PokemonState[] } | null = null;
      const base = scriptedRunPolicy(greedyAiPolicy);
      const policy: RunPolicy = {
        ...base,
        battle: async (view) => {
          if (fight) {
            const drawn = applyBattleState(fight.sent, fight.session.partyState('p1'), []);
            const active = drawn.find((member) => member.spec.species === view.me.species);
            if (active) {
              checked++;
              if (active.hp !== view.me.hp) diverged++;
              if (view.me.hp < view.me.maxHp) sawDamage = true;
            }
          }
          return base.battle(view);
        },
      };
      await playRun(seed, policy, DEFAULT_TUNING, {
        opponent: greedyAiPolicy,
        onBattle: (session, _node, state: RunState) => { fight = { session, sent: state.party }; },
      });
    }

    expect(checked, 'no turn was taken, so this asserted nothing').toBeGreaterThan(0);
    // Without this the case would pass on a suite where nothing ever got hit,
    // which is the shape the old drawer read correctly.
    expect(sawDamage, 'no member was ever damaged, so agreement proves nothing').toBe(true);
    expect(diverged, 'the drawer would contradict the fight it is overlaying').toBe(0);
  }, 120_000);
});
