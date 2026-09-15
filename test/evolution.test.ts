/**
 * `core/evolution.ts`: the walk, the question, and what carries.
 */
import { describe, expect, it } from 'vitest';

import { entryOfId } from '../src/data/evolution';
import {
  evolveMember,
  evolveParty,
  nextEvolutionStep,
  pendingEvolutionQuestion,
  previewEvolutions,
} from '../src/core/evolution';
import { createPartyMember } from '../src/core/party';
import type { PokemonSpec, PokemonState } from '../src/core/types';

function member(species: string, level: number, extra: Partial<PokemonSpec> = {}): PokemonState {
  const spec: PokemonSpec = { species, level, ability: 'Levitate', moves: ['Tackle', 'Growl'], gender: 'M', ...extra };
  return createPartyMember(spec, 2);
}

describe('nextEvolutionStep', () => {
  it('is none for a final form, a base form below its threshold, and an unknown species', () => {
    expect(nextEvolutionStep('Garchomp', 100)).toEqual({ kind: 'none' });
    expect(nextEvolutionStep('Gible', 23)).toEqual({ kind: 'none' });
    expect(nextEvolutionStep('Missingno', 50)).toEqual({ kind: 'none' });
  });

  it('is single at exactly the threshold', () => {
    const step = nextEvolutionStep('Gible', 24);
    expect(step.kind).toBe('single');
    if (step.kind === 'single') expect(step.target.species).toBe('Gabite');
  });

  it('is a branch with every target in dex order', () => {
    const step = nextEvolutionStep('Eevee', 36);
    expect(step.kind).toBe('branch');
    if (step.kind === 'branch') {
      expect(step.options.map((option) => option.species)).toEqual([
        'Vaporeon', 'Jolteon', 'Flareon', 'Espeon', 'Umbreon', 'Leafeon', 'Glaceon', 'Sylveon',
      ]);
    }
    // Nincada would branch, but Shedinja is blacklisted.
    expect(nextEvolutionStep('Nincada', 20).kind).toBe('single');
  });
});

describe('the walk', () => {
  it('takes a whole chain in one clear', () => {
    const party = [member('Caterpie', 7)];
    const evolved = evolveParty(party, 14, []);
    expect(evolved[0]!.spec.species).toBe('Butterfree');
    expect(evolved[0]!.spec.level).toBe(7);
  });

  it('asks a branch once, then continues the chain from the answer', () => {
    const party = [member('Wurmple', 7)];
    const first = pendingEvolutionQuestion(party, 14, []);
    expect(first).not.toBeNull();
    expect(first!.slot).toBe(0);
    expect(first!.options.map((option) => option.species)).toEqual(['Silcoon', 'Cascoon']);
    expect(pendingEvolutionQuestion(party, 14, [1])).toBeNull();
    expect(evolveParty(party, 14, [1])[0]!.spec.species).toBe('Dustox');
    expect(evolveParty(party, 14, [0])[0]!.spec.species).toBe('Beautifly');
  });

  it('walks party order then chain order, and asks nothing for a party with no branch', () => {
    const party = [member('Eevee', 27), member('Ralts', 27), member('Snorlax', 27)];
    // 27 -> 33: Eevee waits (36); Ralts -> Kirlia (20) -> Gardevoir/Gallade (30) is a branch.
    const question = pendingEvolutionQuestion(party, 33, []);
    expect(question!.slot).toBe(1);
    expect(question!.member.spec.species).toBe('Kirlia');
    expect(question!.options.map((option) => option.species)).toEqual(['Gardevoir', 'Gallade']);
    const evolved = evolveParty(party, 33, [1]);
    expect(evolved.map((m) => m.spec.species)).toEqual(['Eevee', 'Gallade', 'Snorlax']);
    expect(pendingEvolutionQuestion([member('Charmander', 14)], 20, [])).toBeNull();
  });

  it('refuses a missing, extra or out-of-range answer', () => {
    const party = [member('Eevee', 27)];
    expect(() => evolveParty(party, 36, [])).toThrow(RangeError);
    expect(() => evolveParty(party, 36, [0, 0])).toThrow(RangeError);
    expect(() => evolveParty(party, 36, [8])).toThrow(RangeError);
    expect(() => evolveParty([member('Charmander', 14)], 20, [0])).toThrow(RangeError);
  });

  it('previews every record up to the first unanswered branch', () => {
    const party = [member('Charmander', 14), member('Eevee', 27)];
    const preview = previewEvolutions(party, 36, []);
    expect(preview.records).toEqual([
      { slot: 0, from: 'Charmander', to: 'Charmeleon', nickname: undefined },
      { slot: 0, from: 'Charmeleon', to: 'Charizard', nickname: undefined },
    ]);
    expect(preview.question!.slot).toBe(1);
    expect(previewEvolutions(party, 36, [3]).question).toBeNull();
    expect(previewEvolutions(party, 36, [3]).records.at(-1)).toEqual({
      slot: 1, from: 'Eevee', to: 'Espeon', nickname: undefined,
    });
  });
});

describe('evolveMember', () => {
  it('carries everything the run did and re-derives what the species decides', () => {
    const before = member('Charmander', 20, { nickname: 'Ember', item: 'leftovers', ability: 'Blaze' });
    const damaged: PokemonState = {
      ...before,
      hp: Math.round(before.maxHp * 0.4),
      moves: before.moves.map((move, i) => (i === 0 ? { ...move, pp: 3 } : move)),
      status: 'brn',
      item: 'leftovers',
      contribution: { ...before.contribution, kos: 4 },
    };
    const after = evolveMember(damaged, entryOfId('charmeleon')!);
    expect(after.spec.species).toBe('Charmeleon');
    expect(after.spec.nickname).toBe('Ember');
    expect(after.spec.ability).toBe('Blaze');
    expect(after.spec.moves).toEqual(damaged.spec.moves);
    expect(after.spec.level).toBe(20);
    expect(after.spec.gender).toBe('M');
    expect(after.item).toBe('leftovers');
    expect(after.status).toBe('brn');
    expect(after.joinedSegment).toBe(2);
    expect(after.contribution.kos).toBe(4);
    expect(after.maxHp).toBeGreaterThan(damaged.maxHp);
    // The HP share carries: 40% of a Charmander is 40% of a Charmeleon.
    expect(Math.abs(after.hp / after.maxHp - 0.4)).toBeLessThan(0.03);
    expect(after.moves[0]!.pp).toBe(3);
    expect(after.moves[1]!.pp).toBe(damaged.moves[1]!.pp);
  });
});
