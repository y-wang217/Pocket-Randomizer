/**
 * The party: what persists between nodes, and the rules for changing it.
 *
 * Two things live here and nothing else does. First, the *shape* — a party is a
 * list, never a starter, even in Stage 1 where the list has one entry. Second,
 * the four rules that mutate it between encounters: wipe detection, revival,
 * status clearing and rest. Keeping those out of the battle screen is the whole
 * point; Stage 4 adds slots and switching by changing nothing in this file
 * except the length of the list it is handed.
 *
 * Every function returns a new party rather than mutating one. Run state is
 * replayed from a decision log, and a shared mutable party is the fastest way
 * to make a replay disagree with the run it replays.
 */
import { describeSpec, describeSpecCard } from './battle/driver';
import { battleSpecFor } from './items';
import type { MoveState, PokemonSpec, PokemonState, TeamSpec } from './types';
import { MOVESET } from '../data/scaling';
import { PARTY_SIZE, reviveHpFor } from '../data/partyTuning';
import type { Tuning } from '../data/tuning';

/** A fresh party member at full HP and PP. */
export function createPartyMember(spec: PokemonSpec): PokemonState {
  const vitals = describeSpec(spec);
  return {
    spec,
    maxHp: vitals.maxHp,
    hp: vitals.maxHp,
    moves: vitals.moves.map((move) => ({ ...move })),
    status: null,
    fainted: false,
  };
}

export function createParty(specs: readonly PokemonSpec[]): PokemonState[] {
  return specs.map(createPartyMember);
}

/**
 * The one death rule in the game.
 *
 * Not "the starter fainted" — *every member fainted*. In Stage 1 those are the
 * same sentence, which is exactly why it has to be written this way now: the
 * version that reads the starter's HP would keep passing its tests right up
 * until Stage 4 adds a second slot and silently ends runs early.
 */
export function isWiped(party: readonly PokemonState[]): boolean {
  return party.length > 0 && party.every((member) => member.fainted);
}

/** The member that leads a battle: the first that can still fight. */
export function leadOf(party: readonly PokemonState[]): PokemonState | null {
  return party.find((member) => !member.fainted) ?? null;
}

/**
 * The members that go into the next battle, lead first.
 *
 * Stage 1 sent the lead and only the lead, because the driver had no switch
 * choice and a second Pokemon would have produced a forced-switch request no
 * policy could answer. Stage 2 gave the driver that choice — gym leaders need
 * it — so this now sends the party, capped at `PARTY_SIZE`.
 *
 * At `PARTY_SIZE = 1` that is the same one Pokemon it always was. The point is
 * that it is the same *code path*: Stage 4 raising the constant changes what
 * this returns without changing anything that calls it.
 */
export function battleMembersFor(party: readonly PokemonState[]): PokemonState[] {
  const sent = sendOrder(party);
  if (sent.length === 0) throw new Error('Cannot start a battle with a wiped party');
  return sent;
}

/**
 * The members a battle is sent, in send order, without the wiped-party guard.
 *
 * The one definition of "which members go, and in what order", shared by
 * `battleMembersFor` (which sends them) and `applyBattleState` (which maps the
 * result back). Two copies of this rule would be two orders to keep in
 * agreement, and the failure would be damage written onto the wrong Pokemon.
 *
 * `battleMembersFor` keeps the throw because starting a battle with nothing to
 * send is a bug; reading a result back is a query and answers with an empty
 * list.
 */
function sendOrder(party: readonly PokemonState[]): PokemonState[] {
  return party.filter((member) => !member.fainted).slice(0, PARTY_SIZE);
}

/**
 * The specs to hand the sim, in the order `battleMembersFor` chose.
 *
 * Held items are merged in here and only here (see `core/items.ts`). The merged
 * specs are battle-time objects that exist for the length of one fight; the
 * party's own specs are untouched, and `applyBattleState` is what maps the
 * result back.
 */
export function battleTeamFor(party: readonly PokemonState[]): TeamSpec {
  return battleMembersFor(party).map(battleSpecFor);
}

/** The carry-over state for the members `battleTeamFor` selected, in the same order. */
export function carryOverFor(party: readonly PokemonState[]): PokemonState[] {
  return battleMembersFor(party);
}

/**
 * Fold a finished battle's read-back state into the party.
 *
 * `battleTeamFor` sends a subset, so the sim hands back a subset, and this maps
 * the subset back onto the whole party.
 *
 * **It matches by send order, not by spec identity, and that changed in Stage
 * 3.** Stage 2 matched on `updated.spec === member.spec`, which worked because
 * the specs handed to the sim were the party's own objects. Held items broke
 * that: `battleTeamFor` now merges the item in and produces a *new* spec per
 * member, so identity matching would have found nothing, silently returned the
 * party unchanged, and thrown away every point of damage from every battle. It
 * would have done so without failing a type check or a single Stage 2 test,
 * which is the kind of bug worth writing a paragraph about.
 *
 * Send order is stable for the same reason identity was meant to be: it is
 * computed by `battleMembersFor` from the pre-battle party, exactly as
 * `battleTeamFor` computed it, so slot i of the read-back is the member at slot
 * i of the send. Stage 4 sending a lead that is not party slot 0 is still fine
 * — `battleMembersFor` decides the order in both directions.
 *
 * The member's own `spec` and `item` are kept rather than taken from the
 * read-back, because the read-back carries the merged battle spec and the party
 * carries the identity. Merging one back over the other is how the two would
 * quietly converge.
 */
export function applyBattleState(
  party: readonly PokemonState[],
  after: readonly PokemonState[],
): PokemonState[] {
  const sent = sendOrder(party);
  const updates = new Map<PokemonState, PokemonState>();
  for (const [index, member] of sent.entries()) {
    const updated = after[index];
    if (updated) updates.set(member, updated);
  }

  return party.map((member) => {
    const updated = updates.get(member);
    return updated ? { ...updated, spec: member.spec, item: member.item } : member;
  });
}

/**
 * What happens to the party at a node boundary.
 *
 * Status clears (by default) and fainted members revive. HP and PP do not
 * change: they are the resources a run spends, and a segment where they reset
 * for free is a segment where the rest node is decoration.
 *
 * **Revival is partial from Stage 4, and that is a balance change rather than a
 * refactor.** Stage 1 revived to a hardcoded half of max HP and nothing could
 * observe it: a fainted member meant a wiped party and a finished run. With a
 * party the branch is reachable after every fight, and the fraction is now the
 * price of a faint — see `partyTuning.reviveHpFraction` for why free revival
 * would make the bench three health bars rather than three Pokemon.
 */
export function betweenNodes(party: readonly PokemonState[], tuning: Tuning): PokemonState[] {
  return party.map((member) => ({
    ...member,
    moves: member.moves.map((move) => ({ ...move })),
    status: tuning.clearStatusBetweenNodes ? null : member.status,
    ...(tuning.reviveFaintedBetweenNodes && member.fainted
      ? { fainted: false, hp: Math.min(member.maxHp, reviveHpFor(member.maxHp)) }
      : {}),
  }));
}

/** A rest node: restore HP and PP, and clear status if the tuning says so. */
export function restParty(party: readonly PokemonState[], tuning: Tuning): PokemonState[] {
  return recoverParty(party, tuning.restHpFraction, tuning.restPpFraction, tuning.restClearsStatus);
}

/**
 * Restore a fraction of HP and PP. The one healing rule, used by both callers.
 *
 * A rest node and a cleared gym are the same operation with different numbers,
 * and writing the arithmetic twice is how two healing rules quietly diverge.
 */
export function recoverParty(
  party: readonly PokemonState[],
  hpFraction: number,
  ppFraction = hpFraction,
  clearStatus = true,
): PokemonState[] {
  return party.map((member) => ({
    ...member,
    hp: Math.min(member.maxHp, member.hp + Math.round(member.maxHp * hpFraction)),
    moves: member.moves.map((move) => restoreMove(move, ppFraction)),
    status: clearStatus ? null : member.status,
    // Healing also revives. Unreachable at party size one — `betweenNodes` has
    // already revived, or the party was wiped and the run is over — but
    // "restores HP without un-fainting" would be an incoherent state to leave
    // reachable for Stage 4.
    fainted: hpFraction > 0 ? false : member.fainted,
  }));
}

function restoreMove(move: MoveState, fraction: number): MoveState {
  return { ...move, pp: Math.min(move.maxPp, move.pp + Math.round(move.maxPp * fraction)) };
}

/**
 * Move the party to a new level.
 *
 * There is no XP system: the player's level is a function of segment index read
 * from data/scaling.ts (design rule 2 — encounters chosen within a segment
 * affect *what you get*, not *how strong you are*). So progression is this
 * function, called once when a gym falls.
 *
 * HP and PP carry as **fractions**, not as absolutes. Max HP grows with level,
 * and a party that levelled up while keeping its absolute HP would arrive at
 * segment 8 on a smaller share of a bigger bar than it left segment 7 with —
 * the run would get quietly harder for a reason no player could see. Carrying
 * the fraction means a gym cleared at 40% is the next segment started at 40%.
 *
 * The spec object is rebuilt rather than mutated, because run state is replayed
 * from a decision log and a shared mutable spec is the fastest way to make a
 * replay disagree with the run it replays.
 */
export function levelParty(party: readonly PokemonState[], level: number): PokemonState[] {
  return party.map((member) => {
    if (member.spec.level === level) return member;

    const spec: PokemonSpec = { ...member.spec, level };
    const vitals = describeSpec(spec);
    const hpShare = member.maxHp > 0 ? member.hp / member.maxHp : 1;

    return {
      ...member,
      spec,
      maxHp: vitals.maxHp,
      hp: Math.max(1, Math.min(vitals.maxHp, Math.round(vitals.maxHp * hpShare))),
      // Max PP is a function of the move, not the level, so the share is the
      // same arithmetic applied to a constant denominator — which is to say the
      // PP simply carries.
      moves: vitals.moves.map((fresh, index) => {
        const carried = member.moves[index];
        return carried ? { ...fresh, pp: Math.min(fresh.maxPp, carried.pp) } : { ...fresh };
      }),
    };
  });
}

/**
 * Teach a move, replacing the weakest attack if there is no room.
 *
 * The rule is deliberately simple and deliberately not a choice, because there
 * is nowhere to put the choice. A `RunPolicy` answers a reward offer with one
 * index; there is no second question for "and which move does it replace", and
 * inventing one would mean a decision in the log that the reward screen has to
 * be able to ask twice on a replay. So the replacement is a rule the player can
 * learn instead:
 *
 *   1. **Already known** — refill that move's PP instead. A reward that did
 *      nothing at all would be a card the player can be punished for taking
 *      through no fault of their own.
 *   2. **A free slot** — take it.
 *   3. **Stronger than the weakest attack** — replace that attack, ties to the
 *      later slot.
 *   4. **Weaker than everything** — replace a *status* move if there is one, so
 *      the card still buys coverage; otherwise change nothing and refill PP.
 *
 * **Four is the rule that makes a move reward safe to be forced into, and it
 * was added because the reward screen showed the alternative out loud.** The
 * first version always replaced the weakest attack, and a segment-0 normal node
 * duly offered Arm Thrust (15 BP) in place of Aqua Step (80 BP) — a card that
 * makes the player strictly worse, in an offer of three with no skip. That is a
 * punishment wearing a reward's clothes.
 *
 * The invariant it buys: **a move reward can never leave the party weaker.**
 * Three never touches a status move either, so a reward can also never cost the
 * player their Recover or their Swords Dance; and because every taught move is
 * damaging, "at least one damaging move" survives by construction.
 *
 * The spec is rebuilt rather than mutated, and PP carries per move id rather
 * than per slot — a replaced slot shifts nothing else, but matching by id is
 * what makes that true instead of nearly true.
 */
export function teachMove(member: PokemonState, moveName: string): PokemonState {
  const known = member.moves.findIndex((move) => move.name === moveName);
  if (known >= 0) {
    return {
      ...member,
      moves: member.moves.map((move, index) =>
        index === known ? { ...move, pp: move.maxPp } : { ...move },
      ),
    };
  }

  const moves = [...member.spec.moves];
  if (moves.length < MOVESET.slots) {
    moves.push(moveName);
  } else {
    const slot = replaceableSlot(member, moveName);
    // Null means the incoming move is weaker than every attack the party has
    // and there is no status move to spend. The card is a no-op rather than a
    // downgrade; the reward screen says so before it is taken.
    if (slot === null) {
      return {
        ...member,
        moves: member.moves.map((move) => ({ ...move, pp: move.maxPp })),
      };
    }
    moves[slot] = moveName;
  }

  const spec: PokemonSpec = { ...member.spec, moves };
  const vitals = describeSpec(spec);
  const carried = new Map(member.moves.map((move) => [move.id, move.pp]));

  return {
    ...member,
    spec,
    maxHp: vitals.maxHp,
    moves: vitals.moves.map((fresh) => ({
      ...fresh,
      pp: Math.min(fresh.maxPp, carried.get(fresh.id) ?? fresh.maxPp),
    })),
  };
}

/**
 * Which slot `moveName` should take, or null if it should take none.
 *
 * The weakest attack when the incoming move beats it; otherwise the last status
 * slot, because a weaker attack that adds a type you could not hit is still
 * worth something; otherwise nothing at all.
 */
function replaceableSlot(member: PokemonState, moveName: string): number | null {
  const card = describeSpecCard(member.spec);
  const incoming = movePower(moveName);

  let weakestSlot: number | null = null;
  let weakest = Number.POSITIVE_INFINITY;
  let statusSlot: number | null = null;

  for (const [index, move] of card.moves.entries()) {
    if (move.category === 'Status') {
      statusSlot = index;
      continue;
    }
    if (move.basePower <= weakest) {
      weakest = move.basePower;
      weakestSlot = index;
    }
  }

  if (weakestSlot !== null && incoming > weakest) return weakestSlot;
  return statusSlot;
}

/**
 * Base power of a move by name, asked of the engine rather than of a table.
 *
 * `describeSpecCard` is the adapter's answer for a spec that has never fought,
 * so probing a one-move spec is the cheapest exact reading available here — and
 * it is cached, so the second ask is free.
 */
function movePower(moveName: string): number {
  const probe = describeSpecCard({
    species: 'Ditto',
    ability: 'Limber',
    moves: [moveName],
    level: 50,
  });
  return probe.moves[0]?.basePower ?? 0;
}

/**
 * Replace a party member's species outright, keeping its HP *fraction*.
 *
 * The species reward, and the reason it is gated off by default: at
 * `PARTY_SIZE` 1 this is not an addition, it is a forced swap of the run's only
 * Pokemon. `tuning.allowSpeciesRewards` decides whether the pools ever offer
 * it; this function is what happens if they do.
 *
 * The new Pokemon arrives at the same *share* of HP rather than at full, for
 * the same reason `levelParty` carries a fraction: a free full heal attached to
 * a species swap would make the card a heal with a species stapled on, and the
 * simulator could not tell which half a player was taking it for. The item and
 * the level carry; the moveset does not, because it belongs to the old species.
 */
export function replaceSpecies(member: PokemonState, spec: PokemonSpec): PokemonState {
  const vitals = describeSpec(spec);
  const share = member.maxHp > 0 ? member.hp / member.maxHp : 1;
  return {
    ...member,
    spec,
    maxHp: vitals.maxHp,
    hp: Math.max(1, Math.min(vitals.maxHp, Math.round(vitals.maxHp * share))),
    moves: vitals.moves.map((move) => ({ ...move })),
    status: null,
    fainted: false,
  };
}

/** 0..1, for a HP bar that never divides by a zero max. */
export function hpFraction(member: PokemonState): number {
  if (member.maxHp <= 0) return 0;
  return Math.max(0, Math.min(1, member.hp / member.maxHp));
}

/** Total remaining PP across a member's moves, and its ceiling. */
export function ppTotals(member: PokemonState): { pp: number; maxPp: number } {
  return member.moves.reduce(
    (totals, move) => ({ pp: totals.pp + move.pp, maxPp: totals.maxPp + move.maxPp }),
    { pp: 0, maxPp: 0 },
  );
}
