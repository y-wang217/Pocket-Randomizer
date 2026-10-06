/**
 * Trade cards. **Defender Mode v0, step 5.**
 *
 * A trade is mon for mon: the requester's offered mon for one named party
 * member, and the player does not choose which. Taking the card is accepting;
 * declining is taking a different card.
 *
 * Neither side can be fixed at generation. The offered mon obeys the type
 * lock, and the gym type is a decision, so one is drawn per type. The
 * requested member is a member of a party the player built, so a single
 * `selector` is drawn instead and resolved against the party in acquisition
 * order when the offer is shown. RNG consumption is the same whatever the
 * party looks like, and the same party resolves the same selector to the same
 * member every time (report ruling R8).
 */
import { DEFENDER_GYM_TYPES, DEFENDER_TRADE } from '../../data/defender';
import { joiningSpec } from '../acquisition';
import { stow } from '../items';
import { createPartyMember } from '../party';
import { generateTypedMons, bandedMovePool } from '../randomizer';
import type { Reward } from '../rewards';
import type { Rng } from '../rng';
import type { RunState } from '../run';
import { defenderNodeRewardKey } from '../streamKeys';
import type { PokemonState } from '../types';
import { playerLevel } from '../../data/scaling';
import { finishDefenderMon } from './draft';
import { exemptSlots } from './exempt';
import { typeLockRefusal } from './typeLock';

type TradeCard = Extract<Reward, { kind: 'trade' }>;

/**
 * Whether a door's offer carries a trade, and the card if it does. Every draw
 * happens either way: the roll, one mon per gym type, the selector.
 */
export function drawTrade(nodeId: string, rank: number, rng: Rng): TradeCard | null {
  const stream = rng.rewards.at(defenderNodeRewardKey(nodeId, 'trade'));
  const carried = stream.nextFloat() < DEFENDER_TRADE.rate;
  const level = playerLevel(rank);
  const damaging = bandedMovePool(rank, DEFENDER_TRADE.tier);
  const offers: Record<string, ReturnType<typeof finishDefenderMon>> = {};
  for (const type of DEFENDER_GYM_TYPES) {
    const [spec] = generateTypedMons(type, rank, level, damaging, 1, stream, new Set(), DEFENDER_TRADE.tier);
    if (!spec) throw new Error(`No ${type} trade could be drawn at rank ${rank}`);
    offers[type] = finishDefenderMon(spec, `trade/${nodeId}/${type}`, rng);
  }
  const selector = stream.nextUint32();
  return carried ? { kind: 'trade', offers, selector } : null;
}

/** The party in acquisition order: the order a trade's selector reads. */
export function acquisitionOrder(party: readonly PokemonState[]): PokemonState[] {
  return [...party].sort((a, b) => (a.acquired ?? 0) - (b.acquired ?? 0));
}

/**
 * Resolve a trade card against the run as it stands: the gym type's mon, and
 * the member the selector lands on. Pure, and idempotent on a resolved card.
 */
export function resolveTrade(card: TradeCard, state: Pick<RunState, 'party' | 'defender'>): TradeCard {
  const gymType = state.defender?.gymType;
  if (!gymType) return card;
  const order = acquisitionOrder(state.party);
  const requested = order[card.selector % Math.max(1, order.length)];
  const offered = card.offers[gymType];
  if (!requested || !offered || requested.acquired === undefined) return card;
  return { ...card, offered, requested: requested.acquired };
}

/**
 * Take a resolved trade: the requested member leaves, its held item goes to
 * the backpack, and the offered mon joins **in the same slot**, at the party's
 * level and with the next acquisition index. Party size never changes.
 */
export function applyTrade(state: RunState, card: TradeCard): RunState {
  const defender = state.defender;
  if (!defender?.gymType) throw new Error('A trade needs a defender run with a gym type');
  if (!card.offered || card.requested === undefined) throw new Error('A trade must be resolved before it is taken');
  const slot = state.party.findIndex((member) => member.acquired === card.requested);
  if (slot < 0) throw new RangeError(`The member a trade requested (acquisition ${card.requested}) is not in the party`);
  const refusal = typeLockRefusal(
    state.party.map((member) => member.spec),
    card.offered,
    defender.gymType,
    exemptSlots(state),
    slot,
  );
  if (refusal) throw new RangeError(`Trade refused: ${refusal}`);

  const leaving = state.party[slot]!;
  const joined: PokemonState = {
    ...createPartyMember({ ...joiningSpec(card.offered, state.currentSegment), item: undefined }, state.currentSegment),
    acquired: defender.acquisitions,
  };
  const party = state.party.map((member, index) => (index === slot ? joined : member));
  return {
    ...state,
    party,
    backpack: leaving.item ? stow(state.backpack, leaving.item) : state.backpack,
    defender: { ...defender, acquisitions: defender.acquisitions + 1 },
  };
}

