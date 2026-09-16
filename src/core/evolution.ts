/**
 * Evolution: a species changes when its level does, and only then.
 *
 * Stage 4.9. The party's level is a function of segment index and moves once,
 * on a gym clear (`levelParty`); this module is the second half of that
 * moment. After the level moves, every member whose species has a target at
 * or below the new level becomes that target — the whole chain if two
 * thresholds were crossed at once — and where the dex offers more than one
 * target the player chooses.
 *
 * **Nothing here draws.** A level-up is a function of where the run is, an
 * evolution is a function of species and level, and a branch is a decision.
 * Player decisions consume no RNG (`CLAUDE.md`), so a party that evolved and
 * one that did not have identical draw counts on every stream, and no key was
 * added to `core/streamKeys.ts` for this. `test/evolution.test.ts` holds the
 * walk; the run-level measurement lands with the `evolve` decision.
 *
 * **One definition of "does the player get asked".** `pendingEvolutionQuestion`
 * is called by `playRun` to decide whether to ask, and the same walk inside
 * `evolveParty` is what `resolveNode` applies, both fed the same answers in
 * the same order. That is the `isTargeted` / `replacementNeeded` discipline: a
 * replay asks at exactly the points the live run did because the question is
 * derived from state the replay reconstructs, never from the screen.
 *
 * The walk is party order, then chain order within a member. A branch that
 * sits mid-chain (Wurmple at 7, then Silcoon to Beautifly at 10) is asked
 * before the next step is computed, because the next step depends on the
 * answer.
 *
 * Trigger is the level change and nothing else. A capture that joins above
 * its threshold stays as caught until the next gym clear; `acquisition.ts`
 * does not call this module, and neither does `createPartyMember`.
 */
import { entryOfSpecies, targetsOf } from '../data/evolution';
import type { SpeciesEntry } from '../data/speciesPools';
import { rebuildMember } from './party';
import type { PokemonSpec, PokemonState } from './types';

/** What one member's next step is at a level. */
export type EvolutionStep =
  | { kind: 'none' }
  | { kind: 'single'; target: SpeciesEntry }
  | { kind: 'branch'; options: readonly SpeciesEntry[] };

/**
 * The next step for `species` at `level`: nothing, one target, or a choice.
 *
 * Every target at or below the level is offered. The sibling rule in
 * `data/evolutionThresholds.ts` is what makes that equal to "every target":
 * a family's branches share one threshold, so a branch is never half-open.
 */
export function nextEvolutionStep(species: string, level: number): EvolutionStep {
  const entry = entryOfSpecies(species);
  if (!entry) return { kind: 'none' };
  const options = targetsOf(entry.id).filter((target) => (target.evoLevel ?? 0) <= level);
  if (options.length === 0) return { kind: 'none' };
  if (options.length === 1) return { kind: 'single', target: options[0]! };
  return { kind: 'branch', options };
}

/** A branch the player must answer: which slot, who, and the choices in dex order. */
export interface EvolutionQuestion {
  slot: number;
  member: PokemonState;
  options: readonly SpeciesEntry[];
}

/** One evolution that a gym clear applies, for the result screen. */
export interface EvolutionRecord {
  slot: number;
  from: string;
  to: string;
  nickname?: string;
}

/**
 * The walk itself, shared by the three readers below.
 *
 * Applies single steps and answered branches as it goes, building the party
 * it would leave behind, and stops at the first branch it has no answer for.
 * Returns the party so far, the records of what was applied, the pending
 * question if any, and whether every answer was consumed.
 */
function walk(
  party: readonly PokemonState[],
  level: number,
  answers: readonly number[],
): {
  party: PokemonState[];
  records: EvolutionRecord[];
  question: EvolutionQuestion | null;
  consumed: number;
} {
  const out: PokemonState[] = [];
  const records: EvolutionRecord[] = [];
  let consumed = 0;

  for (let slot = 0; slot < party.length; slot++) {
    let member = party[slot]!;
    for (;;) {
      const step = nextEvolutionStep(member.spec.species, level);
      if (step.kind === 'none') break;
      let target: SpeciesEntry;
      if (step.kind === 'single') {
        target = step.target;
      } else {
        const answer = answers[consumed];
        if (answer === undefined) {
          return {
            party: [...out, member, ...party.slice(slot + 1)],
            records,
            question: { slot, member, options: step.options },
            consumed,
          };
        }
        const chosen = step.options[answer];
        if (!Number.isInteger(answer) || !chosen) {
          throw new RangeError(
            `Evolution choice ${answer} out of range for ${member.spec.species} (${step.options.length} options)`,
          );
        }
        consumed++;
        target = chosen;
      }
      const from = member.spec.species;
      member = evolveMember(member, target);
      records.push({ slot, from, to: target.species, nickname: member.spec.nickname });
    }
    out.push(member);
  }
  return { party: out, records, question: null, consumed };
}

/**
 * The next branch the player has to answer given the answers so far, or null
 * once every member's chain is resolved.
 */
export function pendingEvolutionQuestion(
  party: readonly PokemonState[],
  level: number,
  answers: readonly number[],
): EvolutionQuestion | null {
  return walk(party, level, answers).question;
}

/**
 * The party after every evolution `level` unlocks, with `answers` resolving
 * the branches in walk order. Throws if an answer is missing, out of range,
 * or left over: a log that disagrees with the table is a log for a different
 * run, and the version guards exist so that it is refused loudly.
 */
export function evolveParty(
  party: readonly PokemonState[],
  level: number,
  answers: readonly number[],
): PokemonState[] {
  const result = walk(party, level, answers);
  if (result.question) {
    throw new RangeError(
      `Evolution of ${result.question.member.spec.species} needs a choice and none was recorded`,
    );
  }
  if (result.consumed !== answers.length) {
    throw new RangeError(`${answers.length - result.consumed} evolution answer(s) recorded that nothing asked for`);
  }
  return result.party;
}

/**
 * What a gym clear to `level` will do to the party, as far as the answers so
 * far allow. For the result screen: every record up to the first unanswered
 * branch, and that branch as the question.
 */
export function previewEvolutions(
  party: readonly PokemonState[],
  level: number,
  answers: readonly number[],
): { records: EvolutionRecord[]; question: EvolutionQuestion | null } {
  const result = walk(party, level, answers);
  return { records: result.records, question: result.question };
}

/**
 * One member, one stage up. Everything the run did to it carries: nickname,
 * ability, moves, item, gender, level, when it joined, what it contributed,
 * its status, whether it is fainted. Max HP is re-derived from the new species
 * and the HP share carries, the rule `levelParty` set and `rebuildMember`
 * holds for both.
 */
export function evolveMember(member: PokemonState, target: SpeciesEntry): PokemonState {
  const spec: PokemonSpec = { ...member.spec, species: target.species };
  return rebuildMember(member, spec);
}
