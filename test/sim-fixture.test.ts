/**
 * The simulator's answer for a fixed seed, frozen to a file.
 *
 * ## Why a byte comparison and not a property
 *
 * Every other determinism test in this repo asserts that the *same build*
 * agrees with itself: play a seed twice, compare. That catches an unseeded
 * draw and nothing else. It cannot catch the failure this file exists for —
 * a change that is deterministic, reproducible, and **different from
 * yesterday**, which is what quietly happens when a function meant to be a
 * readout is reached by something that decides a turn.
 *
 * So the fixture is a recording rather than a rule. It was minted before the
 * party-threat readout was written and it is compared byte for byte
 * afterwards. A patch that claims to change no generation and no battle
 * behaviour either passes this or the claim was wrong.
 *
 * ## Minting it
 *
 *   GYMRUN_WRITE_FIXTURE=1 npx vitest run test/sim-fixture.test.ts
 *
 * That rewrites `test/fixtures/sim-report.json` and asserts nothing.
 * Do it **only** when a change to generation, the randomizer or the AI is
 * intended — in which case `RANDOMIZER_VERSION` or `AI_VERSION` is moving in
 * the same commit and the diff on this file is the evidence for it. Rewriting
 * the fixture to make a red test go green is the one use it does not have.
 *
 * ## Why these three seeds
 *
 * Three whole runs rather than one, because a single seed exercises one path
 * through the map and a change to, say, event resolution could miss it
 * entirely. Three is what fits in a few seconds; the thousand-seed question is
 * `npm run sim`'s, and that report is not committed (see `.gitignore`) because
 * it is a measurement rather than a contract.
 *
 * The policy is `scriptedRunPolicy`, the same baseline the balance sweep
 * measures against: it takes the first option at every question, so the
 * recording is a function of generation and battle resolution alone rather
 * than of a heuristic somebody may tune later.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { AI_VERSION, greedyAiPolicy } from '../src/core/battle/ai';
import { CONTENT_HASH } from '../src/core/contentHash';
import { RANDOMIZER_VERSION } from '../src/core/randomizer';
import { gymsCleared, playRun, RUN_LOG_VERSION, scriptedRunPolicy } from '../src/core/run';

const FIXTURE = join(process.cwd(), 'test', 'fixtures', 'sim-report.json');
const SEEDS = ['FIXTURE-ALPHA', 'FIXTURE-BRAVO', 'FIXTURE-CHARLIE'] as const;

/**
 * One run, flattened to the facts a balance report is made of.
 *
 * Deliberately not the whole `RunState`: it carries the generated map for all
 * eight segments, which is tens of thousands of lines of JSON and would make
 * the diff on a real regression unreadable. What is here is the run as
 * *played* — the decisions, the nodes actually entered, who died to what, and
 * the team that came out the other side.
 */
async function report(seed: string): Promise<unknown> {
  const run = await playRun(seed, scriptedRunPolicy(greedyAiPolicy));
  return {
    seed,
    outcome: run.outcome,
    gymsCleared: gymsCleared(run.state),
    currency: run.state.currency,
    backpack: run.state.backpack,
    party: run.state.party.map((member) => ({
      species: member.spec.species,
      level: member.spec.level,
      ability: member.spec.ability,
      gender: member.spec.gender ?? null,
      moves: member.spec.moves,
      item: member.item ?? null,
      hp: member.hp,
      maxHp: member.maxHp,
      fainted: member.fainted,
      /*
       * Stage 4.7. Counters are derived from the battle protocol, so freezing
       * them here makes this fixture a check on the *reducer* as well as on
       * generation: a change that alters attribution without altering a single
       * battle shows up as a diff on this file and nowhere else.
       */
      joinedSegment: member.joinedSegment,
      contribution: member.contribution,
      status: member.status,
      pp: member.moves.map((move) => move.pp),
    })),
    nodes: run.state.history.map((visit) => ({
      id: visit.node.id,
      segment: visit.segment,
      kind: visit.node.kind,
      tier: visit.node.tier,
      winner: visit.result?.winner ?? null,
      turns: visit.result?.turns ?? null,
      hpAfter: visit.hpAfter,
      casualties: visit.casualties.map((death) => ({
        side: death.side,
        name: death.name,
        bySpecies: death.bySpecies,
        byMove: death.byMove,
      })),
    })),
    decisions: run.log.decisions,
  };
}

async function buildReport(): Promise<string> {
  const runs = [];
  for (const seed of SEEDS) runs.push(await report(seed));
  return `${JSON.stringify(
    { version: RUN_LOG_VERSION, randomizerVersion: RANDOMIZER_VERSION, contentHash: CONTENT_HASH, aiVersion: AI_VERSION, runs },
    null,
    2,
  )}\n`;
}

describe('the simulator report for a fixed seed', () => {
  it('is byte identical to the recorded fixture', async () => {
    const built = await buildReport();

    if (process.env['GYMRUN_WRITE_FIXTURE']) {
      writeFileSync(FIXTURE, built, 'utf8');
      console.log(`minted ${FIXTURE} (sha256 ${createHash('sha256').update(built).digest('hex')})`);
      return;
    }

    const recorded = readFileSync(FIXTURE, 'utf8');
    /*
     * Hashes first, so a mismatch says so in one line rather than printing two
     * copies of a large document — then the full comparison, because a hash
     * that differs tells you nothing about *what* moved and the diff is the
     * whole reason to keep the report in a file.
     */
    const digest = (text: string): string => createHash('sha256').update(text).digest('hex');
    if (digest(built) !== digest(recorded)) expect(JSON.parse(built)).toEqual(JSON.parse(recorded));
    expect(built).toBe(recorded);
  }, 120_000);
});
