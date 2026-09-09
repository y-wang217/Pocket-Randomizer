/**
 * The party: what persists between nodes, and the rules for changing it.
 *
 * Two things live here and nothing else does. First, the *shape* — a party is a
 * list, never a starter, even in Stage 1 where the list had one entry. Second,
 * the rules that mutate it between encounters: wipe detection, revival, status
 * clearing, rest, and from Stage 4 reordering and release.
 *
 * Stage 4 was meant to change nothing here but the length of the list, and
 * nearly kept to it. `battleMembersFor`, `applyBattleState` and `isWiped` were
 * all written against a list from the start and needed no edit at all. What did
 * change is that two branches which were unreachable at one slot are now taken
 * after most fights — revival, which is a real price now (see
 * `data/partyTuning.ts`), and the send-order mapping, which only matters once a
 * battle can end with the party in a different order than it started.
 *
 * Every function returns a new party rather than mutating one. Run state is
 * replayed from a decision log, and a shared mutable party is the fastest way
 * to make a replay disagree with the run it replays.
 */
import { describeSpec, describeSpecCard } from './battle/driver';
import { battleSpecFor } from './items';
import type { MoveState, PokemonSpec, PokemonState, TeamSpec } from './types';
import { MOVESET } from '../data/scaling';
import { PARTY_SIZE } from '../data/partyTuning';
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
 * price of a faint — see `tuning.reviveHpPercent` for why free revival would
 * make the bench three health bars rather than three Pokemon.
 *
 * Stage 4.5.1 changed where that fraction is *read from*, not what it does. It
 * used to come from module scope, which meant the most-blamed balance number in
 * the run state machine was the one the sweep could not vary. It now arrives on
 * the `Tuning` this function already took.
 */
export function betweenNodes(party: readonly PokemonState[], tuning: Tuning): PokemonState[] {
  return party.map((member) => ({
    ...member,
    moves: member.moves.map((move) => ({ ...move })),
    status: tuning.clearStatusBetweenNodes ? null : member.status,
    ...(tuning.reviveFaintedBetweenNodes && member.fainted
      ? { fainted: false, hp: reviveHpFor(member.maxHp, tuning.reviveHpPercent) }
      : {}),
  }));
}

/**
 * Revival HP for a member, in whole points, floored at 1.
 *
 * A named function rather than the arithmetic inline, because "what a faint
 * costs" is a rule, and the floor is the part of it that is easy to lose: a
 * member revived to `round(maxHp * 0)` is a member revived un-fainted at zero
 * HP, which is a state nothing downstream is written to survive.
 *
 * Exported so `test/party.test.ts` asserts against the rule rather than
 * restating it — a test that recomputes the formula agrees with any bug in it.
 */
export function reviveHpFor(maxHp: number, percent: number): number {
  return Math.max(1, Math.min(maxHp, Math.round(maxHp * percent)));
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

/*
 * `replaceSpecies` lived here through Stage 3 and is gone.
 *
 * It was the species reward's application: swap the run's only Pokemon for a
 * new one, keeping its HP fraction. Stage 4 makes that card an *addition*
 * instead — a species offer routes through `core/acquisition.ts`, where taking
 * it costs a slot or costs a member you choose, and declining is legal. There
 * is no longer any path in the game that overwrites a Pokemon in place, so a
 * function that could do it is a loaded gun with no user: the next caller would
 * be reintroducing a mechanic the party was built to replace.
 */

/** 0..1, for a HP bar that never divides by a zero max. */
export function hpFraction(member: PokemonState): number {
  if (member.maxHp <= 0) return 0;
  return Math.max(0, Math.min(1, member.hp / member.maxHp));
}

// ---------------------------------------------------------------------------
// Party management, between nodes
// ---------------------------------------------------------------------------

/**
 * Move a member to a new position. **This is how the battle lead is set.**
 *
 * `battleMembersFor` sends the party in order, so slot 0 is the lead and
 * reordering is the only way to change it. That makes this a real decision
 * rather than cosmetics — leading with the member that answers the fight you
 * can see on the map is most of what a party is for — and it is why the party
 * screen has drag order at all.
 *
 * Out-of-range indexes return the party unchanged rather than throwing. A
 * reorder is a UI gesture, and the failure mode of a fumbled drag should be
 * nothing happening.
 */
export function reorderParty(
  party: readonly PokemonState[],
  from: number,
  to: number,
): PokemonState[] {
  if (from === to) return [...party];
  const moved = party[from];
  if (!moved || to < 0 || to >= party.length) return [...party];

  const rest = party.filter((_, index) => index !== from);
  return [...rest.slice(0, to), moved, ...rest.slice(to)];
}

/**
 * Drop a member. **Permanent for the run: there is no box.**
 *
 * Refuses to empty the party, which is the one guard that matters. A party of
 * zero is not a wipe — `isWiped` reads `fainted` and an empty list is neither
 * wiped nor alive — so it would be a run in a state no other code has an
 * opinion about, reached by a button rather than by losing.
 */
export function releaseMember(party: readonly PokemonState[], slot: number): PokemonState[] {
  if (party.length <= 1 || !party[slot]) return [...party];
  return party.filter((_, index) => index !== slot);
}

/** Total remaining PP across a member's moves, and its ceiling. */
export function ppTotals(member: PokemonState): { pp: number; maxPp: number } {
  return member.moves.reduce(
    (totals, move) => ({ pp: totals.pp + move.pp, maxPp: totals.maxPp + move.maxPp }),
    { pp: 0, maxPp: 0 },
  );
}
