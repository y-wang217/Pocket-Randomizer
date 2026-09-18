/**
 * Rescan the seeds the test suite pins.
 *
 * Three tests need a seed that does something a *typical* seed does not: one
 * that reaches every decision kind, one that pays a card before it dies, and
 * one that reaches a branching evolution. Each is chosen rather than assumed,
 * and each stops being the right seed the moment a stage changes what a seed
 * rolls.
 *
 * **Any version axis moving is the signal to rescan, not only
 * `RANDOMIZER_VERSION`.** This said otherwise until the bench-carryover and
 * gym-levels patch, which moved the gym level column — `src/data/**`, so
 * `contentHash` — and correctly left `RANDOMIZER_VERSION` alone, since the
 * draw order and count did not change. Every seed pinned here still had to be
 * rechecked, because what a gym fields decides how far a run gets.
 *
 * There was a third — a seed the scripted policy *wins* on — and it is gone.
 * A run only wins while the difficulty curve lets it, so pinning one coupled a
 * mechanism test to a balance number; it needed rescanning three times in two
 * stages and then became unfindable in Stage 4.6b's mid-stage trough.
 * `test/party.test.ts` makes its own winnable run now.
 *
 * This is how the replacement is found. It is not a test and it asserts
 * nothing; it prints a seed to paste into the test that names it.
 *
 *   npx vite-node scripts/scan-seed.ts census     # test/move-replacement.test.ts
 *   npx vite-node scripts/scan-seed.ts spender    # test/economy.test.ts
 *   npx vite-node scripts/scan-seed.ts fork 6000  # test/evolution-run.test.ts
 *
 * Each policy below is a copy of the one in the test it serves. That is
 * duplication, and it is the right kind: importing from a test file would make
 * the tests depend on a script, and a *scanner* that drifted from the test it
 * feeds would hand over a seed that does not satisfy it — which the test then
 * reports, loudly, as the assertion it already carries.
 */
import { greedyAiPolicy } from '../src/core/battle/ai';
import { isTargeted } from '../src/core/rewards';

import { defaultItemPlan, playRun, scriptedRunPolicy, type RunPolicy } from '../src/core/run';
/** test/move-replacement.test.ts: the census of every Stage 4.5.1 decision. */
function census(seen: Set<string>): RunPolicy {
  return {
    ...scriptedRunPolicy(greedyAiPolicy),
    chooseReward: async (offer) => {
      const move = offer.options.findIndex((option) => isTargeted(option));
      return move === -1 ? 0 : move;
    },
    chooseShopPurchases: async (stock, state) => {
      const order = stock.items
        .map((item, index) => ({ index, price: item.price }))
        .sort((a, b) => a.price - b.price);
      const basket: number[] = [];
      let left = state.currency;
      for (const entry of order) {
        if (entry.price > left) continue;
        basket.push(entry.index);
        left -= entry.price;
      }
      if (basket.length > 0) seen.add('shop');
      return basket;
    },
    chooseMoveRecipient: async (_offer, party) => {
      seen.add('move-recipient');
      return party.length - 1;
    },
    chooseMoveToReplace: async (member) => {
      seen.add('move-replace');
      return member.spec.moves.length - 1;
    },
    chooseAcquisition: async (_offer, party, capacity) => {
      seen.add('acquisition');
      if (party.length < capacity) return { kind: 'accept' };
      seen.add('release');
      return { kind: 'release', slot: 0 };
    },
    chooseItemPlan: async (state) => {
      const plan = defaultItemPlan(state);
      if (plan.assignments.length > 0) seen.add('item-assign');
      if (plan.discards.length > 0) seen.add('item-discard');
      return plan;
    },
  };
}

/** test/evolution-run.test.ts: captures what it can and takes one fork. */
function fork(branch: number): RunPolicy {
  return {
    ...scriptedRunPolicy(greedyAiPolicy),
    chooseAcquisition: async (_offer, party, capacity) =>
      party.length < capacity ? { kind: 'accept' } : { kind: 'decline' },
    chooseEvolution: async () => branch,
  };
}

/** test/economy.test.ts: walks into shops and events and buys what it can. */
function spender(): RunPolicy {
  return {
    ...scriptedRunPolicy(greedyAiPolicy),
    chooseNode: async (options) => {
      const index = options.findIndex((option) => option.kind === 'shop' || option.kind === 'event');
      return index === -1 ? 0 : index;
    },
    chooseShopPurchases: async (stock, state) => {
      const basket: number[] = [];
      let left = state.currency;
      for (const [index, item] of stock.items.entries()) {
        if (item.price <= left) {
          basket.push(index);
          left -= item.price;
        }
      }
      return basket;
    },
    chooseEventOption: async () => 'safe' as const,
  };
}

const mode = process.argv[2] ?? 'census';
const attempts = Number(process.argv[3] ?? 200);

if (mode === 'census') {
  const wanted = ['move-recipient', 'move-replace', 'acquisition', 'release', 'shop', 'item-assign'];
  for (let i = 0; i < attempts; i++) {
    const seed = i === 0 ? 'ALL-DECISIONS' : `ALL-DECISIONS-${i}`;
    const seen = new Set<string>();
    await playRun(seed, census(seen));
    if (wanted.every((kind) => seen.has(kind))) {
      console.log(`census: ${seed}`);
      break;
    }
  }
} else if (mode === 'spender') {
  // Bounded length as well as a paid card: the test resumes from *every* save,
  // which is quadratic in the run, so a 300-decision seed is a slow test.
  for (let i = 0; i < attempts; i++) {
    const seed = i === 0 ? 'ECON-RESUME' : `ECON-RESUME-${i}`;
    const run = await playRun(seed, spender());
    const decisions = run.log.decisions.length;
    if (run.log.decisions.some((decision) => decision.kind === 'reward') && decisions > 40 && decisions < 110) {
      console.log(`spender: ${seed} (${decisions} decisions)`);
      break;
    }
  }
} else if (mode === 'fork') {
  /*
   * **The rarest of the three, by a wide margin.** A run has to survive to a
   * gym clear *and* be carrying a member whose evolution branches at exactly
   * the level that clear grants. Measured at the parity curve: about one seed
   * in three hundred, so the default attempt count here is the one mode that
   * needs raising rather than lowering.
   *
   * Both branches are played, because the test's claim is that the fork is a
   * *decision*: the two runs must differ by exactly one species and agree on
   * the map, since a player decision consumes no RNG. A seed where the two
   * branches produce the same party is a seed that proves nothing.
   */
  for (let i = 0; i < attempts; i++) {
    const seed = `S49B-${i}`;
    const first = await playRun(seed, fork(0));
    if (first.log.decisions.filter((decision) => decision.kind === 'evolve').length !== 1) continue;
    const at = first.log.decisions.findIndex((decision) => decision.kind === 'evolve');
    const after = first.log.decisions[at + 1]?.kind;
    // The test asserts where the entry lands: after that gym's last battle
    // decision and before its cards.
    if (first.log.decisions[at - 1]?.kind !== 'battle') continue;
    if (after !== 'reward' && after !== 'target') continue;

    const second = await playRun(seed, fork(1));
    const zero = first.state.party.map((member) => member.spec.species);
    const one = second.state.party.map((member) => member.spec.species);
    const onlyZero = zero.filter((species) => !one.includes(species));
    const onlyOne = one.filter((species) => !zero.includes(species));
    if (onlyZero.length !== 1 || onlyOne.length !== 1) continue;
    if (JSON.stringify(first.state.segments) !== JSON.stringify(second.state.segments)) continue;

    console.log(`fork: ${seed}  branch 0 -> ${onlyZero[0]}  branch 1 -> ${onlyOne[0]}  (followed by ${after})`);
    break;
  }
} else {
  console.log('modes: census | spender | fork');
}
