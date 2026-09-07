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
 * The team handed to the sim for the next battle.
 *
 * Stage 1 sends out the lead and only the lead. That is not laziness about the
 * party being length one: the driver has no `{ kind: 'switch' }` choice yet, so
 * a second Pokemon on the sim's side would produce a forced-switch request on
 * the first faint that no policy could answer. Stage 4 adds the choice kind and
 * this returns the whole party.
 */
export function battleTeamFor(party: readonly PokemonState[]): TeamSpec {
  const lead = leadOf(party);
  if (!lead) throw new Error('Cannot start a battle with a wiped party');
  return [lead.spec];
}

/** The carry-over state for the members `battleTeamFor` selected, in the same order. */
export function carryOverFor(party: readonly PokemonState[]): PokemonState[] {
  const lead = leadOf(party);
  if (!lead) throw new Error('Cannot start a battle with a wiped party');
  return [lead];
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
  return party.map((member) => ({
    ...member,
    hp: Math.min(member.maxHp, member.hp + Math.round(member.maxHp * tuning.restHpFraction)),
    moves: member.moves.map((move) => restoreMove(move, tuning.restPpFraction)),
    status: tuning.restClearsStatus ? null : member.status,
    // A rest that heals also revives. Unreachable in Stage 1 — `betweenNodes`
    // has already revived, or the party was wiped and the run is over — but
    // "restores HP without un-fainting" would be an incoherent state to leave
    // reachable for Stage 4.
    fainted: tuning.restHpFraction > 0 ? false : member.fainted,
  }));
}

function restoreMove(move: MoveState, fraction: number): MoveState {
  return { ...move, pp: Math.min(move.maxPp, move.pp + Math.round(move.maxPp * fraction)) };
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
