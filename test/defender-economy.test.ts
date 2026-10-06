/**
 * Defender Mode v0, step 5: consumables, trades, the recruit draft and the
 * off-type relic. `docs/spec/gymrun-defender-mode-v0-fun-test.md` tests 2, 7,
 * 8 and 9.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import type { Policy } from '../src/core/battle/policy';
import { consumableRefusal } from '../src/core/defender/consumables';
import { chooseDraftPick, chooseGymType } from '../src/core/defender/opening';
import { badgesActive } from '../src/core/defender/badge';
import { bossUnlocksSlot, chooseRecruit, recruitOptions } from '../src/core/defender/recruit';
import { acquisitionOrder, resolveTrade } from '../src/core/defender/trade';
import { carriesGymType } from '../src/core/defender/typeLock';
import type { Reward } from '../src/core/rewards';
import {
  createRun,
  gymsCleared,
  partyCapacity,
  playRun,
  replayRun,
  scriptedRunPolicy,
  type NodeResult,
  type RunPolicy,
  type RunState,
} from '../src/core/run';
import type { PartyEdit, RunLog } from '../src/core/types';
import { consumableById } from '../src/data/consumables';
import { DEFENDER_GYM_TYPES, DEFENDER_OFF_TYPE_RELIC, DEFENDER_RANKS, DEFENDER_RECRUIT } from '../src/data/defender';
import { DEFAULT_TUNING } from '../src/data/tuning';

const SEEDS = Array.from({ length: 30 }, (_, i) => `ECON-${i}`);
type Trade = Extract<Reward, { kind: 'trade' }>;

/** A defender run past its opening. */
function opened(seed: string, type = 0): RunState {
  let state = chooseGymType(createRun(seed, DEFAULT_TUNING, 'defender'), type);
  for (let pick = 0; pick < 3; pick++) state = chooseDraftPick(state, pick);
  return state;
}

function tradesOn(state: RunState): Trade[] {
  return state.segments.flatMap((rank) =>
    rank.routes[0]!.steps.flatMap((step) =>
      step.options.flatMap((node) => (node.reward?.options ?? []).filter((card): card is Trade => card.kind === 'trade')),
    ),
  );
}

/** A passive opponent: its weakest usable move, so runs reach the later ranks. */
const passive: Policy = async (view) => {
  const usable = view.moves.filter((entry) => entry.usable);
  if (usable.length === 0) return greedyAiPolicy(view);
  return { kind: 'move', slot: [...usable].sort((a, b) => a.basePower - b.basePower)[0]!.slot };
};

describe('every drafted, recruited and trade-offered mon carries the gym type (prompt test 2)', () => {
  it('holds over many seeds and every type', () => {
    for (const seed of SEEDS) {
      const run = createRun(seed, DEFAULT_TUNING, 'defender');
      const defender = run.defender!;
      for (const type of DEFENDER_GYM_TYPES) {
        for (const spec of defender.draft[type].flat()) expect(carriesGymType(spec, type), `${seed} draft ${spec.species}`).toBe(true);
        defender.recruits.forEach((recruits, rank) => {
          expect(recruits === null, `rank ${rank}`).toBe(!bossUnlocksSlot(rank));
          if (!recruits) return;
          for (const spec of recruits[type].typed) expect(carriesGymType(spec, type), `${seed} recruit ${spec.species}`).toBe(true);
          expect(carriesGymType(recruits[type].offType, type), `${seed} off-type ${recruits[type].offType.species}`).toBe(false);
        });
        for (const card of tradesOn(run)) expect(carriesGymType(card.offers[type]!, type)).toBe(true);
      }
    }
  });

  it('opens recruit drafts after bosses 2, 4 and 6: the schedule read one row ahead', () => {
    expect(Array.from({ length: DEFENDER_RANKS }, (_, rank) => bossUnlocksSlot(rank))).toEqual([
      false, true, false, true, false, true, false, false,
    ]);
  });

  /*
   * **Reversed 2026-10-06.** This case used to assert the exempt slot: one
   * off-type mon with the Stranger's Pass, none without, a second refused.
   * Now every draft offers one off-type option last, any number may join, and
   * what an off-type member costs is the badge (`badgesActive`), which the
   * Pass lights again. `docs/generation.md` section 115.
   */
  it('offers an off-type recruit in every draft, and the badge goes dark while one stands in the party', () => {
    const bare = opened('ECON-EXEMPT');
    const gymType = bare.defender!.gymType!;
    expect(badgesActive(bare)).toBe(true);

    const first = recruitOptions(bare, 2);
    expect(first).toHaveLength(DEFENDER_RECRUIT.typed + DEFENDER_RECRUIT.offType);
    expect(first.slice(0, -1).every((spec) => carriesGymType(spec, gymType))).toBe(true);
    expect(carriesGymType(first.at(-1)!, gymType)).toBe(false);

    // No cap: the off-type pick joins, and so does a second one.
    let state = chooseRecruit(bare, first, first.length - 1);
    expect(badgesActive(state)).toBe(false);
    const second = recruitOptions(state, 4);
    expect(carriesGymType(second.at(-1)!, gymType)).toBe(false);
    state = chooseRecruit(state, second, second.length - 1);
    expect(state.party.filter((member) => !carriesGymType(member.spec, gymType))).toHaveLength(2);
    expect(badgesActive(state)).toBe(false);

    // The Stranger's Pass lights the badge again, off-type members and all.
    expect(badgesActive({ ...state, relics: [DEFENDER_OFF_TYPE_RELIC] })).toBe(true);
    // And a typed pick never put it out.
    expect(badgesActive(chooseRecruit(bare, first, 0))).toBe(true);
  });

  it('installs no badge in a battle once an off-type member stands in the party', async () => {
    // Fire: the highlighted move carries a crit chance while the badge is on,
    // and nothing does once it is off. The recruit after boss 2 takes the
    // off-type option, so the run has battles on both sides of it.
    let seen = { lit: 0, dark: 0 };
    for (const seed of ['ECON-DARK-0', 'ECON-DARK-1', 'ECON-DARK-2', 'ECON-DARK-3']) {
      seen = { lit: 0, dark: 0 };
      const policy: RunPolicy = {
        ...scriptedRunPolicy(greedyAiPolicy),
        chooseRecruit: async (options) => options.length - 1,
      };
      await playRun(seed, policy, DEFAULT_TUNING, {
        mode: 'defender',
        opponent: passive,
        onBattle: (session, _node, state) => {
          const crit = session.viewFor('p1').moves.some((entry) => entry.critChance !== undefined);
          expect(crit).toBe(badgesActive(state));
          if (crit) seen.lit++;
          else seen.dark++;
        },
      });
      if (seen.dark > 0) break;
    }
    expect(seen.lit).toBeGreaterThan(0);
    expect(seen.dark).toBeGreaterThan(0);
  }, 240_000);
});

describe('trades (prompt test 7)', () => {
  it('draws the same whatever the party: generation never reads it', () => {
    const run = createRun('ECON-TRADE', DEFAULT_TUNING, 'defender');
    const a = opened('ECON-TRADE', 0);
    const b = opened('ECON-TRADE', 0);
    const reordered = { ...b, party: [...b.party].reverse() };
    expect(a.segments).toEqual(run.segments);
    // The same card resolves against the party in acquisition order, so a
    // reorder (a player decision) cannot change who is asked for.
    for (const card of tradesOn(run)) {
      expect(resolveTrade(card, a).requested).toBe(resolveTrade(card, reordered).requested);
      expect(resolveTrade(card, a).offered).toBe(card.offers['Fire']);
    }
  });

  it('resolves a selector to a member in acquisition order, every member reachable', () => {
    const state = opened('ECON-ORDER');
    const order = acquisitionOrder(state.party).map((member) => member.acquired);
    expect(order).toEqual([0, 1, 2]);
    const card: Trade = { kind: 'trade', offers: { Fire: state.party[0]!.spec }, selector: 0 };
    expect([0, 1, 2, 3, 4, 5].map((selector) => resolveTrade({ ...card, selector }, state).requested)).toEqual([0, 1, 2, 0, 1, 2]);
  });

  it('swaps mon for mon in the same slot, keeps the party size, sends the held item to the bag, and replays', async () => {
    let checked = 0;
    const policy: RunPolicy = {
      ...scriptedRunPolicy(greedyAiPolicy),
      chooseReward: async (offer) => Math.max(0, offer.options.findIndex((card) => card.kind === 'trade')),
    };
    for (const seed of ['ECON-SWAP-0', 'ECON-SWAP-1', 'ECON-SWAP-2', 'ECON-SWAP-3']) {
      const onNodeResolved = (before: RunState, after: RunState, result: NodeResult): void => {
        const card = result.reward;
        if (card?.kind !== 'trade' || card.requested === undefined) return;
        checked++;
        const slot = before.party.findIndex((member) => member.acquired === card.requested);
        const leaving = before.party[slot]!;
        expect(after.party).toHaveLength(before.party.length);
        expect(after.party.some((member) => member.acquired === card.requested)).toBe(false);
        expect(after.party[slot]?.spec.species).toBe(card.offered?.species);
        expect(after.party[slot]?.acquired).toBe(before.defender!.acquisitions);
        if (leaving.item) expect(after.backpack).toContain(leaving.item);
      };
      const run = await playRun(seed, policy, DEFAULT_TUNING, { mode: 'defender', opponent: passive, onNodeResolved });
      const replayed = await replayRun(run.log, DEFAULT_TUNING, { mode: 'defender', opponent: passive });
      expect(replayed.state).toEqual(run.state);
      // Every taken trade left a `trade` entry behind its card, and the member it sent away is kept.
      const taken = run.log.decisions.filter((d) => d.kind === 'trade');
      expect(taken.every((d) => d.kind === 'trade' && d.accept)).toBe(true);
      expect(run.state.defender!.tradedAway).toHaveLength(taken.length);
    }
    expect(checked).toBeGreaterThan(0);
  }, 240_000);

  /*
   * **The second step, 2026-10-06.** Picking the card forfeits the other two;
   * the trade itself is then taken or declined, and a decline pays nothing.
   */
  it('declines: the party is untouched, the other two cards are gone, nothing is sent away, and it replays', async () => {
    let declined = 0;
    const policy: RunPolicy = {
      ...scriptedRunPolicy(greedyAiPolicy),
      chooseReward: async (offer) => Math.max(0, offer.options.findIndex((card) => card.kind === 'trade')),
      chooseTrade: async () => false,
    };
    for (const seed of ['ECON-SWAP-0', 'ECON-SWAP-1', 'ECON-SWAP-2', 'ECON-SWAP-3']) {
      const onNodeResolved = (before: RunState, after: RunState, result: NodeResult): void => {
        const picked = result.node.reward?.options.some((card) => card.kind === 'trade');
        if (!picked || result.reward !== undefined) return;
        declined++;
        expect(after.party.map((member) => member.spec)).toEqual(before.party.map((member) => member.spec));
        expect(after.backpack).toEqual(before.backpack);
        expect(after.defender!.tradedAway).toEqual(before.defender!.tradedAway);
      };
      const run = await playRun(seed, policy, DEFAULT_TUNING, { mode: 'defender', opponent: passive, onNodeResolved });
      const trades = run.log.decisions.filter((d) => d.kind === 'trade');
      expect(trades.every((d) => d.kind === 'trade' && !d.accept)).toBe(true);
      expect(run.state.defender!.tradedAway).toEqual([]);
      const replayed = await replayRun(run.log, DEFAULT_TUNING, { mode: 'defender', opponent: passive });
      expect(replayed.state).toEqual(run.state);
      expect(JSON.stringify(replayed.log)).toBe(JSON.stringify(run.log));
    }
    expect(declined).toBeGreaterThan(0);
  }, 240_000);
});

describe('consumables (prompt test 8)', () => {
  /** Takes every consumable card, and uses one at the next door on the most hurt member. */
  function potionPolicy(uses: { before: number; after: number; id: string }[]): RunPolicy {
    let edit: ((change: PartyEdit) => void) | null = null;
    return {
      ...scriptedRunPolicy(greedyAiPolicy),
      bindPartyEditor: (bound) => {
        edit = bound;
      },
      chooseReward: async (offer) => Math.max(0, offer.options.findIndex((card) => card.kind === 'consumable')),
      chooseDoor: async (_options, state) => {
        const id = state.consumables?.[0];
        const slot = state.party.findIndex((member) => !member.fainted && member.hp > 0 && member.hp < member.maxHp);
        if (id && slot >= 0 && edit) {
          const before = state.party[slot]!.hp;
          edit({ kind: 'consume', id, slot });
          uses.push({ before, after: state.party[slot]!.hp, id });
        }
        return 0;
      },
    };
  }

  it('heals by the table, is destroyed on use, and replays identically', async () => {
    const uses: { before: number; after: number; id: string }[] = [];
    let spent = 0;
    const run = await playRun('ECON-POTION', potionPolicy(uses), DEFAULT_TUNING, {
      mode: 'defender',
      opponent: passive,
      onDecision: (log) => {
        spent = log.decisions.filter((d) => d.kind === 'party' && d.edit.kind === 'consume').length;
      },
    });
    expect(uses.length).toBeGreaterThan(0);
    expect(spent).toBe(uses.length);
    for (const use of uses) expect(use.after).toBeGreaterThan(use.before);
    expect(uses[0]!.after - uses[0]!.before).toBeLessThanOrEqual(consumableById(uses[0]!.id)!.heal);

    const replayed = await replayRun(run.log, DEFAULT_TUNING, { mode: 'defender', opponent: passive });
    expect(replayed.state).toEqual(run.state);
  }, 120_000);

  it('cannot be used in battle: the run throws rather than logging it', async () => {
    let edit: ((change: PartyEdit) => void) | null = null;
    let tried = false;
    const policy: RunPolicy = {
      ...scriptedRunPolicy(greedyAiPolicy),
      bindPartyEditor: (bound) => {
        edit = bound;
      },
      chooseReward: async (offer) => Math.max(0, offer.options.findIndex((card) => card.kind === 'consumable')),
      battle: async (view) => {
        if (edit && !tried && view.turn > 1) {
          // Whatever the bag holds, a use offered mid-battle never reaches it.
          tried = true;
          edit({ kind: 'consume', id: 'potion', slot: 0 });
        }
        return greedyAiPolicy(view);
      },
    };
    await expect(playRun('ECON-INBATTLE', policy, DEFAULT_TUNING, { mode: 'defender' })).rejects.toThrow(/cannot be used in battle/);
  });

  it('refuses a use on a fainted or full-HP member, or one the bag does not hold', () => {
    const state = opened('ECON-REFUSE');
    const holding = { ...state, consumables: ['potion'] };
    expect(holding.party[0]!.hp).toBe(holding.party[0]!.maxHp);
    expect(consumableRefusal(holding, 'potion', 0)).toMatch(/already at full HP/);
    const fainted = { ...holding, party: holding.party.map((member) => ({ ...member, hp: 0, fainted: true })) };
    expect(consumableRefusal(fainted, 'potion', 0)).toMatch(/cannot revive/);
    const hurt = { ...state, party: state.party.map((member) => ({ ...member, hp: 1 })) };
    expect(consumableRefusal(hurt, 'potion', 0)).toMatch(/bag holds no Potion/);
  });
});

describe('the party never outgrows its schedule (prompt test 9)', () => {
  it('holds over whole runs, recruits included, and trades never change the size', async () => {
    const sizes: { size: number; capacity: number }[] = [];
    const policy: RunPolicy = {
      ...scriptedRunPolicy(greedyAiPolicy),
      chooseReward: async (offer) => Math.max(0, offer.options.findIndex((card) => card.kind === 'trade')),
    };
    let recruited = 0;
    for (const seed of ['ECON-SIZE-0', 'ECON-SIZE-1', 'ECON-SIZE-2']) {
      const run: { log: RunLog } = await playRun(seed, policy, DEFAULT_TUNING, {
        mode: 'defender',
        opponent: passive,
        onState: (state) => {
          if (state.defender?.gymType) sizes.push({ size: state.party.length, capacity: partyCapacity(state) });
        },
        onNodeResolved: (before, after, result) => {
          if (result.reward?.kind === 'trade') expect(after.party.length).toBe(before.party.length);
        },
      });
      recruited += run.log.decisions.filter((d) => d.kind === 'recruit').length;
    }
    expect(sizes.length).toBeGreaterThan(0);
    for (const { size, capacity } of sizes) expect(size).toBeLessThanOrEqual(capacity);
    expect(recruited).toBeGreaterThan(0);
  }, 240_000);
});

describe('the Stranger\'s Pass appears at most once per run', () => {
  it('is in the boss pool only, and no run is shown it twice', async () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const run = createRun(seed, DEFAULT_TUNING, 'defender');
      for (const rank of run.segments) {
        for (const node of rank.routes[0]!.steps.flatMap((step) => step.options)) {
          const relics = (node.reward?.options ?? []).flatMap((card) => (card.kind === 'relic' ? [card.relic, ...card.alternates] : []));
          expect(relics).not.toContain(DEFENDER_OFF_TYPE_RELIC);
        }
      }
    }
    let shownRuns = 0;
    for (const seed of ['ECON-PASS-0', 'ECON-PASS-1', 'ECON-PASS-2', 'ECON-PASS-3', 'ECON-PASS-4', 'ECON-PASS-5']) {
      let shown = 0;
      const policy: RunPolicy = {
        ...scriptedRunPolicy(greedyAiPolicy),
        // Never take it, so it would come round again if the rule failed.
        chooseReward: async (offer) => {
          if (offer.options.some((card) => card.kind === 'relic' && card.relic === DEFENDER_OFF_TYPE_RELIC)) shown++;
          return Math.max(0, offer.options.findIndex((card) => !(card.kind === 'relic' && card.relic === DEFENDER_OFF_TYPE_RELIC)));
        },
      };
      const run = await playRun(seed, policy, DEFAULT_TUNING, { mode: 'defender', opponent: passive });
      expect(shown, `${seed} after ${gymsCleared(run.state)} bosses`).toBeLessThanOrEqual(1);
      if (shown === 1) shownRuns++;
    }
    expect(shownRuns).toBeGreaterThan(0);
  }, 240_000);
});
