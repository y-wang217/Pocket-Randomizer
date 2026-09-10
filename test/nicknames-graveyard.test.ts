/**
 * Nicknames, and the graveyard they make readable. **Stage 4.8, item 5.**
 *
 * The two are one feature and this is one file, because the reason nicknames exist
 * is the death record: the protocol names its victim by `spec.nickname ??
 * spec.species`, so before every Pokemon had a name, **two Weepinbells in one
 * party were the same string in every line of the log** and a graveyard could not
 * tell them apart. Testing the names without the records, or the records without
 * the names, would miss the thing that connects them.
 *
 * Requirements 8 and 9 of the prompt:
 *
 *   8. A death record reconstructs identically from a replayed log, including the
 *      killing move and the segment it happened in.
 *   9. Nicknames are deterministic for a fixed seed and identical across a save, a
 *      reload and a replay.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { createRun, playRun, replayRun, resumeRun, scriptedRunPolicy, type RunPolicy } from '../src/core/run';
import { deathsFrom } from '../src/core/graveyard';
import { drawNickname } from '../src/core/nicknames';
import { createRng } from '../src/core/rng';
import { hasRoom } from '../src/core/acquisition';
import type { RunLog } from '../src/core/types';
import { NICKNAMES } from '../src/data/nicknames';
import { DEFAULT_TUNING } from '../src/data/tuning';

const SEEDS = ['NAME-A', 'NAME-B', 'NAME-C'];

/** Catches whatever it is offered, so names and deaths both accumulate. */
function catcher(): RunPolicy {
  return {
    ...scriptedRunPolicy(greedyAiPolicy),
    chooseAcquisition: async (_offer, party, capacity) =>
      hasRoom(party, capacity) ? { kind: 'accept' } : { kind: 'decline' },
  };
}

// ---------------------------------------------------------------------------
// The name table
// ---------------------------------------------------------------------------

describe('the nickname pool', () => {
  it('has enough names that a full run rarely repeats one', () => {
    expect(NICKNAMES.length).toBeGreaterThan(16);
  });

  it('holds no duplicates, which would waste a slot and read as a bug on screen', () => {
    expect(new Set(NICKNAMES).size).toBe(NICKNAMES.length);
  });

  it('is all short, plain words, so a name parses beside a species and a level', () => {
    for (const name of NICKNAMES) {
      expect(name, `${name} is not a plain short word`).toMatch(/^[A-Z][a-z]{2,9}$/);
    }
  });

  it('draws exactly one value per name, so appending to the table shifts nothing', () => {
    /*
     * The property that let item 5 name every Pokemon in the game without moving a
     * recorded map: the draw is a single `nextInt`, so the pool's size is not in
     * the stream's arithmetic and a longer table costs no extra draw.
     *
     * Measured by comparing a stream that drew a name against one that drew a bare
     * value: if they agree from there on, the name cost exactly that one draw.
     */
    const named = createRng('DRAW').randomizer.at('nickname/probe');
    drawNickname(named);

    const control = createRng('DRAW').randomizer.at('nickname/probe');
    control.nextUint32();

    for (let i = 0; i < 8; i++) expect(named.nextUint32()).toBe(control.nextUint32());
  });

  it('picks from the table and nothing else', () => {
    const stream = createRng('POOL').randomizer.at('nickname/probe');
    for (let i = 0; i < 200; i++) expect(NICKNAMES).toContain(drawNickname(stream));
  });
});

// ---------------------------------------------------------------------------
// Requirement 9: deterministic, and stable across save, reload and replay
// ---------------------------------------------------------------------------

describe('every Pokemon a run offers has a name', () => {
  it('names all three starter options, not just the one taken', () => {
    // Keyed by option index rather than by the pick, so the key cannot depend on
    // player behaviour and the two unchosen roads stay reconstructible.
    for (const seed of SEEDS) {
      const options = createRun(seed).starterOptions;
      expect(options.length).toBeGreaterThan(1);
      for (const spec of options) {
        expect(spec.nickname, `${seed} ${spec.species} has no name`).toBeTruthy();
        expect(NICKNAMES).toContain(spec.nickname);
      }
    }
  });

  it('names every capture a map offers, by either route', () => {
    let offers = 0;
    for (const seed of SEEDS) {
      for (const segment of createRun(seed).segments) {
        for (const route of segment.routes) {
          for (const step of route.steps) {
            for (const node of step.options) {
              if (node.acquisition) {
                offers++;
                expect(node.acquisition.spec.nickname, `${node.id}`).toBeTruthy();
                expect(NICKNAMES).toContain(node.acquisition.spec.nickname);
              }
            }
          }
        }
      }
    }
    expect(offers, 'no capture was offered, so nothing was checked').toBeGreaterThan(0);
  });

  it('gives the same seed the same names twice', () => {
    for (const seed of SEEDS) {
      const a = createRun(seed).starterOptions.map((spec) => spec.nickname);
      const b = createRun(seed).starterOptions.map((spec) => spec.nickname);
      expect(b).toEqual(a);
    }
  });

  it('gives different seeds different names, so the draw is real', () => {
    const names = SEEDS.map((seed) => createRun(seed).starterOptions.map((s) => s.nickname).join('/'));
    expect(new Set(names).size).toBeGreaterThan(1);
  });

  it('does not name the opponent it copied a wild spec from', () => {
    /*
     * A wild capture's spec is a *copy* of the encounter's lead. Naming in place
     * would put a nickname on the Pokemon the player is about to fight, and the
     * battle panel would read "Bramble" for the enemy.
     */
    for (const seed of SEEDS) {
      for (const segment of createRun(seed).segments) {
        for (const route of segment.routes) {
          for (const step of route.steps) {
            for (const node of step.options) {
              if (!node.acquisition || !node.encounter) continue;
              for (const spec of node.encounter.team) {
                expect(spec.nickname, `${node.id} named its opponent`).toBeUndefined();
              }
            }
          }
        }
      }
    }
  });

  it('keeps a party member\'s name across a save, a reload and a replay', async () => {
    for (const seed of SEEDS) {
      const saves: RunLog[] = [];
      const live = await playRun(seed, catcher(), DEFAULT_TUNING, {
        onDecision: (log) => saves.push(JSON.parse(JSON.stringify(log)) as RunLog),
      });

      const liveNames = live.state.party.map((member) => member.spec.nickname);
      expect(liveNames.every((name) => typeof name === 'string' && name.length > 0)).toBe(true);

      // Replay: the names are not in the log, so they must come back from the seed.
      const replayed = await replayRun(live.log, DEFAULT_TUNING);
      expect(replayed.state.party.map((member) => member.spec.nickname)).toEqual(liveNames);

      // Reload: JSON round trip, then resume from the last save.
      const last = saves.at(-1);
      if (!last) continue;
      const reloaded = JSON.parse(JSON.stringify(last)) as RunLog;
      const resumed = await resumeRun(reloaded, catcher());
      expect(resumed.state.party.map((member) => member.spec.nickname)).toEqual(liveNames);
    }
  }, 240_000);
});

// ---------------------------------------------------------------------------
// Requirement 8: the graveyard reconstructs from a replay
// ---------------------------------------------------------------------------

describe('the graveyard', () => {
  it('records every faint in run order, with what killed it', async () => {
    let totalDeaths = 0;

    for (const seed of SEEDS) {
      const run = await playRun(seed, catcher(), DEFAULT_TUNING);
      const deaths = deathsFrom(run.state);
      totalDeaths += deaths.length;

      // Run order, which is history order: segments never go backwards.
      const segments = deaths.map((death) => death.segment);
      expect([...segments].sort((a, b) => a - b)).toEqual(segments);

      for (const death of deaths) {
        expect(death.nickname, 'a death with no name').toBeTruthy();
        expect(death.species, 'a death with no species').toBeTruthy();
        expect(death.segment).toBeGreaterThanOrEqual(0);
        expect(death.nodeId, 'a death with no node').toBeTruthy();
        /*
         * Every cause field is either a string or null, never undefined. That is
         * the shape a screen renders against, and the distinction matters: a
         * `readCasualties` that could not identify a killer reports null on
         * purpose, and a row reading "undefined" is the screen discovering it.
         */
        for (const [field, value] of Object.entries({
          bySpecies: death.bySpecies,
          byMove: death.byMove,
          indirect: death.indirect,
        })) {
          expect(value === null || typeof value === 'string', `${field} is ${value}`).toBe(true);
        }
      }
    }

    expect(totalDeaths, 'no seed lost a Pokemon, so nothing was tested').toBeGreaterThan(0);
  }, 240_000);

  it('reconstructs identically from a replayed log, move and segment included', async () => {
    /*
     * **Requirement 8.** Death records are derived from replay rather than logged,
     * so this is the whole of their determinism claim: the same log must rebuild the
     * same graveyard, field for field, including the killing move — which is read
     * off the battle protocol, and therefore only identical if the battle replayed
     * identically too.
     */
    for (const seed of SEEDS) {
      const live = await playRun(seed, catcher(), DEFAULT_TUNING);
      const replayed = await replayRun(live.log, DEFAULT_TUNING);
      expect(deathsFrom(replayed.state)).toEqual(deathsFrom(live.state));
    }
  }, 240_000);

  it('survives a JSON round trip of the log, which is what storage is', async () => {
    for (const seed of SEEDS.slice(0, 2)) {
      const live = await playRun(seed, catcher(), DEFAULT_TUNING);
      const throughStorage = JSON.parse(JSON.stringify(live.log)) as RunLog;
      const replayed = await replayRun(throughStorage, DEFAULT_TUNING);
      expect(deathsFrom(replayed.state)).toEqual(deathsFrom(live.state));
    }
  }, 240_000);

  it('is empty for a run that lost nobody', () => {
    expect(deathsFrom(createRun('GRAVE-EMPTY'))).toEqual([]);
  });

  it('is pure, and mutates nothing', async () => {
    const run = await playRun('NAME-A', catcher(), DEFAULT_TUNING);
    const before = JSON.stringify(run.state.history);
    const first = deathsFrom(run.state);
    expect(deathsFrom(run.state)).toEqual(first);
    expect(JSON.stringify(run.state.history)).toBe(before);
  }, 240_000);
});
