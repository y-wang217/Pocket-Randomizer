/**
 * No ability or move in the pools only works for one species.
 *
 * Abilities and moves are drawn off-species, so one whose engine handler
 * returns early unless its holder is a Darmanitan, or that turns its holder
 * into a Palafin, is a blank or worse on everything that rolls it.
 * `scripts/gen-pools.ts` excludes them by id, and that list was read off the
 * handlers, not the dex text.
 *
 * The second half is what keeps the list honest when the dex moves: any pooled
 * entry whose handler names a species, a forme or a held type must appear in a
 * reviewed list here that says why it works on any holder. A new signature
 * ability arriving with a `@pkmn/sim` upgrade fails this test instead of
 * reaching a run.
 */
import { Dex } from '@pkmn/sim';
import { describe, expect, it } from 'vitest';
import { ABILITY_POOL } from '../src/data/abilities';
import { DAMAGING_MOVES, STATUS_MOVES } from '../src/data/movePools';
import { toId } from '../src/data/blacklists';

const dex = Dex.forGen(9);

const EXCLUDED_ABILITIES = [
  'battlebond', 'commander', 'disguise', 'embodyaspectcornerstone', 'embodyaspecthearthflame',
  'embodyaspectteal', 'embodyaspectwellspring', 'flowergift', 'flowerveil', 'forecast', 'gulpmissile',
  'hungerswitch', 'iceface', 'multitype', 'poisonpuppeteer', 'powerconstruct', 'rkssystem',
  'schooling', 'shieldsdown', 'stancechange', 'teraformzero', 'terashift', 'zenmode', 'zerotohero',
];
const EXCLUDED_MOVES = ['aurawheel', 'hyperspacefury', 'doubleshock'];

/** Pooled entries whose handler names a species or type, and why each still works on anyone. */
const REVIEWED_ABILITIES: Record<string, string> = {
  adaptability: 'reads the user\'s own types for STAB, which every holder has',
  colorchange: 'changes to the type of the move that hit it, on any holder',
  drizzle: 'the species check only adds Primal Kyogre; rain is set for any holder',
  drought: 'the species check only adds Primal Groudon; sun is set for any holder',
  illusion: 'the species check is on the disguise target, not the holder',
  magnetpull: 'reads the foe\'s type',
  mimicry: 'reads terrain, not species',
  naturalcure: 'the species read is a client-side reveal hint',
  neutralizinggas: 'reads transformation, not species',
};
const REVIEWED_MOVES: Record<string, string> = {
  firepledge: 'the type check is the pledge combo; the hit lands for anyone',
  ivycudgel: 'only Ogerpon formes change its type; Grass for anyone else',
  judgment: 'only a Plate changes its type; Normal for anyone else',
  orderup: 'the boost needs Commander; the hit lands for anyone',
  ragingbull: 'only Tauros formes change its type; Normal for anyone else',
  relicsong: 'the forme change is Meloetta-only; the hit lands for anyone',
  saltcure: 'reads the target\'s type for residual damage',
  smackdown: 'reads the target\'s type',
  watershuriken: 'the power boost is Greninja-Ash-only; the hits land for anyone',
  curse: 'Ghost and non-Ghost are both full effects',
  leechseed: 'reads the target\'s type',
  roost: 'reads the user\'s type to drop Flying; heals anyone',
};

function handlerSource(effect: object | undefined): string {
  if (!effect) return '';
  return Object.values(effect).filter((value) => typeof value === 'function').map(String).join('\n');
}

const NAMES_A_HOLDER = /species|forme|hasType|Plate|Memory/;

describe('species-locked abilities and moves', () => {
  it('are absent from the pools', () => {
    const abilities = new Set(ABILITY_POOL.map(toId));
    const moves = new Set([...DAMAGING_MOVES, ...STATUS_MOVES].map((move) => move.id));
    expect(EXCLUDED_ABILITIES.filter((id) => abilities.has(id))).toEqual([]);
    expect(EXCLUDED_MOVES.filter((id) => moves.has(id))).toEqual([]);
  });

  it('every pooled ability that names a species has been reviewed', () => {
    const unreviewed = ABILITY_POOL.map((name) => dex.abilities.get(name))
      .filter((ability) => NAMES_A_HOLDER.test(handlerSource(ability)) || ability.flags.cantsuppress)
      .map((ability) => ability.id)
      // As One and Comatose are cantsuppress for engine reasons, not species ones.
      .filter((id) => !(id in REVIEWED_ABILITIES) && !['asoneglastrier', 'asonespectrier', 'comatose'].includes(id));
    expect(unreviewed).toEqual([]);
  });

  it('every pooled move that names a species or type has been reviewed', () => {
    const unreviewed = [...DAMAGING_MOVES, ...STATUS_MOVES]
      .map((entry) => dex.moves.get(entry.id))
      .filter((move) => NAMES_A_HOLDER.test(
        [move, move.condition, move.self, move.secondary].map((part) => handlerSource(part as object | undefined)).join('\n'),
      ))
      .map((move) => move.id)
      .filter((id) => !(id in REVIEWED_MOVES));
    expect(unreviewed).toEqual([]);
  });
});
