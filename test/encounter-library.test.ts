/**
 * The encounter library as the randomizer draws from it. **Stage 6.0.**
 *
 * Four things the keyed design rests on, each asserted rather than promised:
 * a node's candidates are a function of its structural inputs alone; a gym's
 * candidates all carry its type; the fit keeps the ace on the cap and every
 * member in range; and a node spends one draw on the pick and the same count
 * on its members whichever record it drew, so a library edit moves the record
 * and nothing beside it.
 */
import { describe, expect, it } from 'vitest';

import { ENCOUNTERS, encounterById } from '../src/data/encounters';
import { CANDIDATE_WINDOW, encounterCandidates, fitParty, playable } from '../src/data/encounters/library';
import { entryOfSpecies } from '../src/data/evolution';
import { GYMS } from '../src/data/gyms';
import { opponentLevel, opponentTeamSize } from '../src/data/scaling';
import { generateGymEncounter, generateTrainerEncounter, gymMovePool } from '../src/core/randomizer';
import { STATUS_MOVES } from '../src/data/movePools';
import { createRng } from '../src/core/rng';
import { createRun } from '../src/core/run';
import { DEFAULT_TUNING } from '../src/data/tuning';

describe('candidates', () => {
  it('are a pure function of kind, segment and type', () => {
    for (const gym of GYMS) {
      const first = encounterCandidates('gym', gym.segment, gym.type).map((r) => r.id);
      const again = encounterCandidates('gym', gym.segment, gym.type).map((r) => r.id);
      expect(again).toEqual(first);
      expect(first.length).toBeGreaterThan(0);
      expect(first.length).toBeLessThanOrEqual(CANDIDATE_WINDOW.gym);
    }
    for (let segment = 0; segment < 8; segment++) {
      const list = encounterCandidates('trainer', segment);
      expect(list.length).toBe(CANDIDATE_WINDOW.trainer);
      expect(new Set(list.map((r) => r.id)).size).toBe(list.length);
    }
  });

  it('give every gym at least three leaders of its own type at every segment', () => {
    // Three is the floor below which a type reads as one leader with costumes.
    for (const gym of GYMS) {
      for (let segment = 0; segment < 8; segment++) {
        const list = encounterCandidates('gym', segment, gym.type);
        expect(list.length, `${gym.type} at segment ${segment}`).toBeGreaterThanOrEqual(3);
        for (const record of list) {
          const members = playable(record)!;
          expect(members, record.id).not.toBeNull();
          // A leader by its stated type, or an Elite Four roster that is wholly the type.
          if (record.role === 'gym') expect(record.gymType, record.id).toBe(gym.type);
          else expect(members.every((m) => m.entry.types.includes(gym.type)), record.id).toBe(true);
        }
      }
    }
  });

  it('rank by distance from the segment cap, nearest first', () => {
    for (let segment = 0; segment < 8; segment++) {
      const target = opponentLevel('gym', segment, 'normal').max;
      const list = encounterCandidates('gym', segment, 'Rock');
      const distances = list.map((r) => Math.abs(r.party[r.party.length - 1]!.level - target));
      for (let i = 1; i < distances.length; i++) expect(distances[i]!).toBeGreaterThanOrEqual(distances[i - 1]!);
    }
    // Brock's Pewter roster is a first-gym pick and not a last-gym one.
    expect(encounterCandidates('gym', 0, 'Rock').map((r) => r.id)).toContain('rby/brock-1');
    expect(encounterCandidates('gym', 7, 'Rock').map((r) => r.id)).not.toContain('rby/brock-1');
  });

  it('exclude every record whose ace the pool cannot play', () => {
    const unplayable = ENCOUNTERS.filter((r) => playable(r) === null);
    expect(unplayable.length).toBeGreaterThan(0);
    for (const record of unplayable) {
      for (let segment = 0; segment < 8; segment++) {
        expect(encounterCandidates('trainer', segment).map((r) => r.id)).not.toContain(record.id);
      }
    }
  });
});

describe('the fit', () => {
  const brock = encounterById('rby/brock-1')!;

  it('puts the ace on the cap and every member inside the range', () => {
    for (const record of ENCOUNTERS.filter((r) => playable(r) !== null).slice(0, 400)) {
      for (const segment of [0, 3, 7]) {
        const level = opponentLevel('gym', segment, 'normal');
        const size = opponentTeamSize('gym', segment, 'normal');
        const fitted = fitParty(record, level, size);
        expect(fitted.length, record.id).toBeGreaterThan(0);
        expect(fitted.length, record.id).toBeLessThanOrEqual(size);
        for (const member of fitted) {
          expect(member.level, `${record.id} ${member.entry.id}`).toBeGreaterThanOrEqual(level.min);
          expect(member.level, `${record.id} ${member.entry.id}`).toBeLessThanOrEqual(level.max);
          // Never a form its level cannot carry: the rule `levelFor` throws on.
          expect(member.entry.evoLevel === null || member.entry.evoLevel <= member.level, `${record.id} ${member.entry.id}`).toBe(true);
        }
        const ace = fitted[fitted.length - 1]!;
        expect(ace.level).toBe(level.max);
      }
    }
  });

  it('keeps the canonical spread where it fits', () => {
    // Geodude 12, Onix 14 at a cap of 14: shift 0, spread kept.
    const fitted = fitParty(brock, { min: 11, max: 14 }, 2);
    expect(fitted.map((m) => `${m.entry.id}:${m.level}`)).toEqual(['geodude:12', 'onix:14']);
  });

  it('trims from the front and keeps the ace', () => {
    const lance = encounterById('rby/lance-1')!;
    const fitted = fitParty(lance, { min: 48, max: 58 }, 2);
    expect(fitted[fitted.length - 1]!.entry.id).toBe('dragonite');
    expect(fitted.length).toBeLessThanOrEqual(2);
  });

  it('devolves a member its fitted level cannot carry', () => {
    const morty = encounterById('crystal/morty-1')!;
    const fitted = fitParty(morty, { min: 11, max: 14 }, 4);
    for (const member of fitted) expect(member.entry.evoLevel === null || member.entry.evoLevel <= member.level, member.entry.id).toBe(true);
    expect(fitted.some((m) => m.entry.id === 'gastly')).toBe(true);
  });

  it('fields each species once', () => {
    const clair = encounterById('crystal/clair-1')!;
    const fitted = fitParty(clair, { min: 48, max: 58 }, 6);
    expect(new Set(fitted.map((m) => m.entry.id)).size).toBe(fitted.length);
  });
});

describe('the draw', () => {
  it('spends one draw on the pick and the same count on the members whichever record it drew', () => {
    for (const kind of ['gym', 'trainer'] as const) {
      const counts = new Set<number>();
      for (let seed = 0; seed < 60; seed++) {
        const rng = createRng(`LIB-${kind}-${seed}`);
        const segment = seed % 8;
        const stream = rng.randomizer.at('members');
        const pick = rng.randomizer.at('pick');
        if (kind === 'gym') generateGymEncounter(GYMS[segment]!, segment, stream, pick);
        else generateTrainerEncounter(segment, 'normal', stream, pick);
        expect(pick.draws).toBe(1);
        const size = opponentTeamSize(kind, segment, 'normal');
        counts.add(stream.draws / size);
      }
      // One number per member across sixty seeds and every segment.
      expect([...counts]).toHaveLength(1);
    }
  });

  it('overlays the record: the canonical species at the fitted levels, then rolled fill', () => {
    for (let seed = 0; seed < 40; seed++) {
      const rng = createRng(`OVERLAY-${seed}`);
      const gym = GYMS[seed % 8]!;
      const { team, source } = generateGymEncounter(gym, gym.segment, rng.randomizer.at('members'), rng.randomizer.at('pick'));
      const record = encounterById(source.id)!;
      const level = opponentLevel('gym', gym.segment, 'normal');
      const fitted = fitParty(record, level, team.length, gym.type);
      // A set move is kept only where the node could have drawn it: inside the
      // gym's band window, or a status move the pool carries.
      const admitted = new Set([...gymMovePool(gym.segment).all.map((m) => m.name), ...STATUS_MOVES.map((m) => m.name)]);
      fitted.forEach((member, slot) => {
        expect(team[slot]!.species).toBe(member.entry.species);
        expect(team[slot]!.level).toBe(member.level);
        for (const move of member.moves) if (admitted.has(move)) expect(team[slot]!.moves, `${source.id} ${move}`).toContain(move);
      });
      for (const member of team) {
        expect(entryOfSpecies(member.species)?.types, `${source.id} ${member.species}`).toContain(gym.type);
        expect(member.moves.length).toBeGreaterThan(0);
        expect(member.moves.length).toBeLessThanOrEqual(4);
      }
      expect(new Set(team.map((m) => m.species)).size).toBe(team.length);
    }
  });

  it('names a leader of the gym type for every segment, twice over for the same seed', () => {
    const leaders = (seed: string) => createRun(seed, DEFAULT_TUNING).segments.map((s) => `${s.leader}:${s.gymEncounter.id}`);
    for (const seed of ['LIBRARY-A', 'LIBRARY-B', 'LIBRARY-C']) {
      const first = leaders(seed);
      expect(leaders(seed)).toEqual(first);
      expect(first).toHaveLength(8);
      const run = createRun(seed, DEFAULT_TUNING);
      run.segments.forEach((segment, index) => {
        const record = encounterById(segment.gymEncounter.id)!;
        expect(segment.gym.label).toBe(`${record.trainer.name}'s Gym`);
        expect(segment.gym.encounter?.source?.id).toBe(record.id);
        expect(segment.gymDefinition.type).toBe(GYMS[index]!.type);
        for (const node of segment.routes.flatMap((r) => r.steps.flatMap((s) => s.options))) {
          if (node.kind === 'trainer') expect(node.encounter?.source?.id, node.id).toBeTruthy();
          if (node.kind === 'wild') expect(node.encounter?.source, node.id).toBeNull();
        }
      });
    }
  });
});
