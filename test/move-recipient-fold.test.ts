/**
 * Who gets the move, and the "fix" that would change the answer.
 *
 * ## The near miss this file exists for
 *
 * While tracing why the party drawer was a node behind, the same lag turned up
 * on the recipient screen: its cards show the HP the node was *entered* with,
 * because `partyAfterAcquisition` folds the capture and not the battle. Beside
 * the result screen the player has just left, that reads as plainly wrong, and
 * the obvious repair is to run `applyBattleState` there too.
 *
 * **It is a bug, and a worse one than the cosmetic complaint it answers.**
 * `rewards.recipientFor` returns the lead when the named slot is fainted. The
 * question's reading and the apply site's reading agree today only because
 * neither has a fainted member in it — the question is posed pre-battle, and
 * `resolveNode` applies the reward after `betweenNodes`, which revives. Folding
 * the battle into the question's party breaks that symmetry from one side only:
 * the replace question would be asked about the *lead's* four moves while the
 * move still landed on the slot's member.
 *
 * ## What is asserted
 *
 * Two things, in the order they matter.
 *
 * 1. Today's behaviour is correct — the move lands on the Pokemon the question
 *    named. That has never been asserted anywhere, which is how the repair
 *    could have shipped looking like an improvement.
 * 2. The battle-folded reading is *not* equivalent, so a future session that
 *    tries it gets a failure naming the reason rather than a green suite.
 *
 * Both run on the scripted baseline, which never declines and always answers
 * slot 0 — so what varies across seeds is the party, the fight and who fainted
 * in it, which is exactly the variable under test.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { applyBattleState, betweenNodes } from '../src/core/party';
import { playRun, scriptedRunPolicy, type RunPolicy } from '../src/core/run';
import { recipientFor } from '../src/core/rewards';
import type { BattleMemberState, Contribution, PokemonState } from '../src/core/types';
import { DEFAULT_TUNING } from '../src/data/tuning';

/** Move ids, for spotting the one a node added. */
const movesOf = (member: PokemonState): string[] => member.moves.map((move) => move.id);

const SEEDS = Array.from({ length: 40 }, (_, index) => `TRUTH-${index}`);

describe('a taught move lands on the Pokemon the question named', () => {
  it('does so on every node that teaches one', async () => {
    let resolved = 0;
    let elsewhere = 0;
    const strays: string[] = [];

    for (const seed of SEEDS) {
      const base = scriptedRunPolicy(greedyAiPolicy);
      let asked: { species: string; before: Map<string, string[]> } | null = null;
      const policy: RunPolicy = {
        ...base,
        chooseMoveRecipient: async (offer, party, state, allowSkip) => {
          const slot = await base.chooseMoveRecipient(offer, party, state, allowSkip);
          // The same resolution `askMoveQuestions` performs before it asks the
          // second question. Reading it any other way would be testing a copy.
          const who = slot >= 0 ? recipientFor(party, slot) : null;
          if (who) {
            asked = {
              species: who.spec.species,
              before: new Map(party.map((member) => [member.spec.species, movesOf(member)])),
            };
          }
          return slot;
        },
      };

      await playRun(seed, policy, DEFAULT_TUNING, {
        opponent: greedyAiPolicy,
        // The landing is read off run state either side of the node rather than
        // re-derived, so nothing here can agree with the code by construction.
        onNodeResolved: (_before, after) => {
          if (!asked) return;
          const gained = after.party.filter((member) => {
            const was = asked?.before.get(member.spec.species);
            return was ? movesOf(member).some((id) => !was.includes(id)) : false;
          });
          if (gained.length === 1) {
            resolved++;
            if (gained[0]?.spec.species !== asked.species) {
              elsewhere++;
              if (strays.length < 5) {
                strays.push(`${seed}: asked ${asked.species}, landed ${gained[0]?.spec.species}`);
              }
            }
          }
          asked = null;
        },
      });
    }

    expect(resolved, 'no move was taught, so this asserted nothing').toBeGreaterThan(20);
    expect(elsewhere, `the move landed on the wrong Pokemon: ${strays.join('; ')}`).toBe(0);
  }, 300_000);
});

describe('folding the battle into the question would change who gets it', () => {
  it('disagrees with the apply site often enough to be a bug, not a rounding error', async () => {
    /*
     * The guard rail. If a later change makes the folded reading equivalent —
     * `recipientFor` stops consulting `fainted`, or the boundary stops reviving
     * — this case fails, and the failure is the signal that the cosmetic fix in
     * `docs/README.md` section 5 has become safe to make.
     *
     * Both readings are built here rather than imported, because the point is
     * to compare a hypothetical against the real one.
     */
    let asked = 0;
    let todayAgrees = 0;
    let foldedDisagrees = 0;

    for (const seed of SEEDS) {
      const base = scriptedRunPolicy(greedyAiPolicy);
      let fight: { party: BattleMemberState[]; contribution: Contribution[] } | null = null;
      const policy: RunPolicy = {
        ...base,
        reviewBattle: async (review, state) => {
          fight = { party: review.party, contribution: review.contribution };
          return base.reviewBattle ? base.reviewBattle(review, state) : null;
        },
        chooseMoveRecipient: async (offer, party, state, allowSkip) => {
          const slot = await base.chooseMoveRecipient(offer, party, state, allowSkip);
          if (slot >= 0 && fight) {
            asked++;
            const folded = applyBattleState(party, fight.party, fight.contribution);
            // What `resolveNode` resolves against: the battle folded, then the
            // node boundary, which revives.
            const atApply = recipientFor(betweenNodes(folded, DEFAULT_TUNING), slot);
            const atQuestion = recipientFor(party, slot);
            const ifFolded = recipientFor(folded, slot);
            if (atQuestion?.spec.species === atApply?.spec.species) todayAgrees++;
            if (ifFolded?.spec.species !== atApply?.spec.species) foldedDisagrees++;
          }
          return slot;
        },
      };
      await playRun(seed, policy, DEFAULT_TUNING, { opponent: greedyAiPolicy });
    }

    expect(asked, 'no move question followed a fight, so this asserted nothing').toBeGreaterThan(20);
    expect(todayAgrees, 'the reading in the tree disagrees with its own apply site').toBe(asked);
    expect(
      foldedDisagrees,
      'a battle-folded question party now agrees with the apply site — the section 5 fix may be safe',
    ).toBeGreaterThan(0);
  }, 300_000);
});
