/**
 * The score, and the one place it is allowed to appear.
 *
 * **Stage 4.8, item 4.** Two halves, and the second is the one that would rot
 * silently.
 *
 *   1. `scoreRun` is pure, its total *is* the weighted sum of the components it
 *      returns, and every component appears whatever its weight.
 *   2. **Score is unreachable from any surface that renders a decision the player
 *      has not made yet.** A node card reading "+30 score" turns the risk choice
 *      into a scoreboard hint and makes the tier badge an instruction; that is a
 *      verdict about a future decision, which Part 4 of Stage 4.5.1 forbids and
 *      which item 4 singles out. Asserted per surface, because the plausible wrong
 *      change is one import in one file.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createParty } from '../src/core/party';
import { createRun, type RunState } from '../src/core/run';
import { scoreCounts, scoreRun } from '../src/core/scoring';
import type { PokemonSpec, PokemonState } from '../src/core/types';
import { SCORE_COMPONENTS, SCORE_LABELS, SCORE_WEIGHTS } from '../src/data/scoring';

const ROOT = process.cwd();

const spec = (species: string): PokemonSpec => ({
  species,
  ability: 'Overgrow',
  moves: ['Tackle'],
  level: 30,
});

/** A finished-looking run with the history and party a score reads. */
function runWith(options: {
  gyms?: number;
  hard?: number;
  elite?: number;
  party?: PokemonState[];
  relics?: string[];
  turns?: number;
}): RunState {
  const base = createRun('SCORE-A1');
  const gymNode = base.segments[0]!.gym;
  const stepNode = base.segments[0]!.routes[0]!.steps[0]!.options[0]!;

  const visit = (node: typeof gymNode, tier: 'hard' | 'elite' | null, won: boolean, turns: number) => ({
    node: { ...node, tier },
    segment: 0,
    result: { winner: (won ? 'p1' : 'p2') as 'p1' | 'p2', turns, cause: 'faint' as const },
    hpAfter: 1,
    casualties: [],
  });

  const turns = options.turns ?? 0;
  const history = [
    ...Array.from({ length: options.gyms ?? 0 }, () => visit(gymNode, null, true, turns)),
    ...Array.from({ length: options.hard ?? 0 }, () => visit(stepNode, 'hard', true, turns)),
    ...Array.from({ length: options.elite ?? 0 }, () => visit(stepNode, 'elite', true, turns)),
  ];

  return {
    ...base,
    history,
    party: options.party ?? [],
    relics: options.relics ?? [],
  };
}

/** A party member that joined mid-run, which is what `captures` counts. */
function caught(species: string, segment = 3): PokemonState {
  return { ...createParty([spec(species)])[0]!, joinedSegment: segment };
}

// ---------------------------------------------------------------------------
// 1. The function
// ---------------------------------------------------------------------------

describe('scoreRun', () => {
  it('is pure: the same state scores the same forever', () => {
    const state = runWith({ gyms: 3, hard: 4, elite: 2, party: [caught('Pidgey')], relics: ['a'] });
    const first = scoreRun(state);
    for (let i = 0; i < 5; i++) expect(scoreRun(state)).toEqual(first);
  });

  it('mutates nothing it is handed', () => {
    const state = runWith({ gyms: 2, party: [caught('Zubat')] });
    const before = JSON.stringify(state);
    scoreRun(state);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('returns a breakdown rather than a bare number', () => {
    const score = scoreRun(runWith({ gyms: 1 }));
    expect(Array.isArray(score.components)).toBe(true);
    expect(typeof score.total).toBe('number');
  });

  it('totals exactly the weighted sum of the components it returned', () => {
    /*
     * The identity that makes the breakdown trustworthy: the number a player sees
     * is the list a player sees, added up. A separately computed total could agree
     * for a year and then not.
     */
    for (const state of [
      runWith({}),
      runWith({ gyms: 8, hard: 11, elite: 6, party: [caught('Pidgey'), caught('Zubat')], relics: ['x', 'y'], turns: 7 }),
      runWith({ gyms: 3, elite: 1, turns: 40 }),
    ]) {
      const score = scoreRun(state);
      const summed = score.components.reduce((total, component) => total + component.count * component.weight, 0);
      expect(score.total).toBe(summed);
    }
  });

  it('lists every component, in the declared order, whatever the weight', () => {
    const score = scoreRun(runWith({ gyms: 1 }));
    expect(score.components.map((component) => component.id)).toEqual([...SCORE_COMPONENTS]);
  });

  it('keeps a zero-weighted component in the breakdown, contributing nothing', () => {
    // `turns` is the live case: recorded so a later pass can read history out of
    // it, weighted zero so this patch takes no position on fight length.
    const state = runWith({ gyms: 1, turns: 25 });
    const score = scoreRun(state);
    const turnsRow = score.components.find((component) => component.id === 'turns');

    expect(turnsRow, 'turns vanished from the breakdown').toBeDefined();
    expect(turnsRow!.weight).toBe(0);
    expect(turnsRow!.count, 'turns was not even counted').toBeGreaterThan(0);
    expect(turnsRow!.points).toBe(0);

    // And removing it changes nothing about the total.
    const withoutTurns = score.components
      .filter((component) => component.id !== 'turns')
      .reduce((total, component) => total + component.points, 0);
    expect(score.total).toBe(withoutTurns);
  });

  it('scores an empty run at zero without throwing', () => {
    const score = scoreRun(createRun('SCORE-EMPTY'));
    expect(score.total).toBe(0);
    expect(score.components).toHaveLength(SCORE_COMPONENTS.length);
  });

  it('carries the label a screen renders, from data/', () => {
    for (const component of scoreRun(runWith({})).components) {
      expect(component.label).toBe(SCORE_LABELS[component.id]);
      expect(component.label.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. The counts
// ---------------------------------------------------------------------------

describe('what each component counts', () => {
  it('counts gyms the run actually won, not gym nodes entered', () => {
    expect(scoreCounts(runWith({ gyms: 4 })).gymsCleared).toBe(4);
  });

  it('counts a tier off the node taken, so a declined tier pays nothing', () => {
    const counts = scoreCounts(runWith({ hard: 5, elite: 2 }));
    expect(counts.hardNodes).toBe(5);
    expect(counts.eliteNodes).toBe(2);
  });

  it('pays elite more than hard, so the gradient survives a tuning pass', () => {
    expect(SCORE_WEIGHTS.eliteNodes).toBeGreaterThan(SCORE_WEIGHTS.hardNodes);
  });

  it('lets gyms dominate, which is the statement that clearing the run is the point', () => {
    const others = SCORE_COMPONENTS.filter((id) => id !== 'gymsCleared').map((id) => SCORE_WEIGHTS[id]);
    expect(SCORE_WEIGHTS.gymsCleared).toBeGreaterThan(Math.max(...others));
  });

  it('counts only members that joined mid-run as caught', () => {
    // `joinedSegment === 0` is the starter, the convention the codebase already
    // reads this field by.
    const starter = createParty([spec('Bulbasaur')])[0]!;
    const counts = scoreCounts(runWith({ party: [starter, caught('Pidgey'), caught('Zubat')] }));
    expect(counts.captures).toBe(2);
  });

  it('counts survivors rather than party size, so a wipe scores none', () => {
    const party = [caught('Pidgey'), { ...caught('Zubat'), fainted: true }, { ...caught('Rattata'), fainted: true }];
    expect(scoreCounts(runWith({ party })).survivors).toBe(1);

    const wiped = party.map((member) => ({ ...member, fainted: true }));
    expect(scoreCounts(runWith({ party: wiped })).survivors).toBe(0);
  });

  it('sums turns across every battle the run fought', () => {
    // Three visits at 6 turns each, from the fixture's one-gym-plus-two shape.
    expect(scoreCounts(runWith({ gyms: 1, hard: 1, elite: 1, turns: 6 })).turns).toBe(18);
  });

  it('counts relics held, which is the run\'s own list', () => {
    expect(scoreCounts(runWith({ relics: ['a', 'b', 'c'] })).relics).toBe(3);
  });

  it('never returns a negative or fractional count', () => {
    const counts = scoreCounts(
      runWith({ gyms: 8, hard: 9, elite: 5, party: [caught('Pidgey')], relics: ['x'], turns: 13 }),
    );
    for (const [id, count] of Object.entries(counts)) {
      expect(Number.isInteger(count), `${id} is ${count}`).toBe(true);
      expect(count, `${id} is negative`).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Where score may and may not appear — requirement 7, per surface
// ---------------------------------------------------------------------------

describe('score is unreachable from the surfaces that render a pending decision', () => {
  /** Every module a file imports, one hop, as written. */
  const importsOf = (file: string): string[] =>
    [...readFileSync(join(ROOT, file), 'utf8').matchAll(/from\s+'([^']+)'/g)].map((match) => match[1] ?? '');

  /*
   * The three surfaces item 4 names, plus the screens that host them. A node card
   * and a tier badge live inside the map; a reward card lives inside the reward
   * and result screens.
   */
  const FORBIDDEN = [
    'src/ui/screens/run-map.ts',
    'src/ui/screens/reward.ts',
    'src/ui/band.ts',
    'src/ui/member-card.ts',
    'src/ui/screens/locale-select.ts',
    'src/ui/screens/pre-gym.ts',
  ];

  for (const file of FORBIDDEN) {
    it(`${file} cannot reach core/scoring or data/scoring`, () => {
      const imports = importsOf(file);
      for (const specifier of imports) {
        expect(specifier, `${file} imports ${specifier}`).not.toMatch(/scoring$/);
      }
    });
  }

  it('mentions no score anywhere in the map, the reward card or the tier badge', () => {
    /*
     * The import check catches the mechanism; this catches the string. A surface
     * that computed "+30" inline, or labelled a badge "score", would pass the
     * import check and be exactly the violation.
     */
    const offenders: string[] = [];
    for (const file of FORBIDDEN) {
      readFileSync(join(ROOT, file), 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) return;
          for (const literal of line.match(/'[^']*'|"[^"]*"|`[^`]*`/g) ?? []) {
            if (/\bscore\b/i.test(literal)) offenders.push(`${file}:${index + 1} ${literal}`);
          }
        });
    }
    expect(offenders, 'a pending decision must not be priced in score').toEqual([]);
  });

  it('keeps core/scoring.ts free of the DOM and of randomness', () => {
    const source = readFileSync(join(ROOT, 'src/core/scoring.ts'), 'utf8');
    expect(source).not.toMatch(/\bdocument\b|\bwindow\b/);
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/from '\.\.\/ui/);
  });
});
