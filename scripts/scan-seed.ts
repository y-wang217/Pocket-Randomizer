/**
 * Rescan the seeds the test suite pins.
 *
 * Three tests need a seed that does something a *typical* seed does not: one
 * that a scripted policy wins on, one that reaches every decision kind, and one
 * that pays a card before it dies. Each is chosen rather than assumed, and each
 * stops being the right seed the moment a stage changes what a seed rolls —
 * which is exactly what a `RANDOMIZER_VERSION` bump announces.
 *
 * This is how the replacement is found. It is not a test and it asserts
 * nothing; it prints a seed to paste into the test that names it.
 *
 *   npx vite-node scripts/scan-seed.ts win        # test/party.test.ts
 *   npx vite-node scripts/scan-seed.ts census     # test/move-replacement.test.ts
 *   npx vite-node scripts/scan-seed.ts spender    # test/economy.test.ts
 *
 * Each policy below is a copy of the one in the test it serves. That is
 * duplication, and it is the right kind: importing from a test file would make
 * the tests depend on a script, and a *scanner* that drifted from the test it
 * feeds would hand over a seed that does not satisfy it — which the test then
 * reports, loudly, as the assertion it already carries.
 */
import { greedyAiPolicy } from '../src/core/battle/ai';
import { hasRoom } from '../src/core/acquisition';
import { PARTY_SIZE } from '../src/data/partyTuning';
import {
  defaultItemPlan,
  defaultMoveReplacement,
  playRun,
  scriptedRunPolicy,
  type RunPolicy,
} from '../src/core/run';

/** test/party.test.ts: walks into wild nodes, rests when hurt, churns the party. */
function everything(): RunPolicy {
  return {
    ...scriptedRunPolicy(greedyAiPolicy),
    chooseNode: async (options, state) => {
      const hp = state.party.reduce((total, member) => total + member.hp, 0);
      const max = state.party.reduce((total, member) => total + member.maxHp, 0);
      if (max > 0 && hp / max < 0.7) {
        const rest = options.findIndex((option) => option.kind === 'rest');
        if (rest !== -1) return rest;
      }
      const wild = options.findIndex((option) => option.kind === 'wild');
      return wild === -1 ? 0 : wild;
    },
    chooseMoveRecipient: async (_offer, party) => party.length - 1,
    chooseMoveToReplace: async (member, incoming) => defaultMoveReplacement(member, incoming),
    chooseAcquisition: async (_offer, party) =>
      hasRoom(party) ? { kind: 'accept' } : { kind: 'release', slot: party.length - 1 },
  };
}

/** test/move-replacement.test.ts: the census of every Stage 4.5.1 decision. */
function census(seen: Set<string>): RunPolicy {
  return {
    ...scriptedRunPolicy(greedyAiPolicy),
    chooseReward: async (offer) => {
      const move = offer.options.findIndex((option) => option.kind === 'tm' || option.kind === 'tutor');
      if (move !== -1) return move;
      const species = offer.options.findIndex((option) => option.kind === 'species');
      return species === -1 ? 0 : species;
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
    chooseAcquisition: async (_offer, party) => {
      seen.add('acquisition');
      if (party.length < PARTY_SIZE) return { kind: 'accept' };
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
    chooseEventOption: async () => 0,
  };
}

const mode = process.argv[2] ?? 'win';
const attempts = Number(process.argv[3] ?? 200);

if (mode === 'win') {
  for (let i = 0; i < attempts; i++) {
    const seed = `WIN-${i}`;
    const run = await playRun(seed, everything());
    const switches = run.log.decisions.filter(
      (decision) => decision.kind === 'battle' && decision.choice.kind === 'switch',
    ).length;
    if (run.outcome === 'victory' && switches > 0) {
      console.log(`win: ${seed} (${switches} switches)`);
      break;
    }
  }
} else if (mode === 'census') {
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
} else {
  console.log('modes: win | census | spender');
}
