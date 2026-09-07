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
import { describeSpec } from './battle/driver';
import type { MoveState, PokemonSpec, PokemonState, TeamSpec } from './types';
import { PARTY_SIZE } from '../data/scaling';
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
  const available = party.filter((member) => !member.fainted);
  if (available.length === 0) throw new Error('Cannot start a battle with a wiped party');
  return available.slice(0, PARTY_SIZE);
}

/** The specs to hand the sim, in the order `battleMembersFor` chose. */
export function battleTeamFor(party: readonly PokemonState[]): TeamSpec {
  return battleMembersFor(party).map((member) => member.spec);
}

/** The carry-over state for the members `battleTeamFor` selected, in the same order. */
export function carryOverFor(party: readonly PokemonState[]): PokemonState[] {
  return battleMembersFor(party);
}

/**
 * Fold a finished battle's read-back state into the party.
 *
 * `battleTeamFor` sends a subset, so the sim hands back a subset. Matching them
 * up by spec identity rather than by index keeps this correct when Stage 4
 * sends a lead that is not slot 0.
 */
export function applyBattleState(
  party: readonly PokemonState[],
  after: readonly PokemonState[],
): PokemonState[] {
  return party.map((member) => after.find((updated) => updated.spec === member.spec) ?? member);
}

/**
 * What happens to the party at a node boundary.
 *
 * Status clears (by default) and fainted members revive. HP and PP do not
 * change: they are the resources a run spends, and a segment where they reset
 * for free is a segment where the rest node is decoration.
 */
export function betweenNodes(party: readonly PokemonState[], tuning: Tuning): PokemonState[] {
  return party.map((member) => ({
    ...member,
    moves: member.moves.map((move) => ({ ...move })),
    status: tuning.clearStatusBetweenNodes ? null : member.status,
    ...(tuning.reviveFaintedBetweenNodes && member.fainted
      ? { fainted: false, hp: Math.max(1, Math.round(member.maxHp * REVIVE_HP_FRACTION)) }
      : {}),
  }));
}

/**
 * Revival HP.
 *
 * Not a tuning knob yet on purpose. Nothing in Stage 1 can reach this branch —
 * a fainted member means a wiped party and a finished run — so exposing a
 * number no run can observe would be exposing an untested one. Stage 4, which
 * is the first stage where a member can faint without the run ending, is where
 * it becomes a real balance question and moves into `Tuning`.
 */
const REVIVE_HP_FRACTION = 0.5;

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
