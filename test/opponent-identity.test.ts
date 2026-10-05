/**
 * Who the opponent is, where it shows. **Stage 6.0, D100.**
 *
 * @vitest-environment jsdom
 *
 * Three surfaces, one fact each. The battle header's detail line reads the
 * record's class and name with its trainer sprite at 16 before the words
 * (`Youngster Joey · Rookie`); a gym's detail line reads the class alone,
 * because the title already carries the name beside the badge (R3, one fact
 * one channel). The summary's visit row carries the place and the game under
 * the opponent, and nothing on a wild visit. The map node card is not here
 * because it shows nothing new, which is the ruling.
 *
 * The battle cases go through the screen's own `attach`, the call the app
 * makes; the summary cases through a played run, so the citation comes off a
 * node `core/` built and not a fixture.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { createBattle } from '../src/core/battle/driver';
import { createRun, playRun, scriptedRunPolicy } from '../src/core/run';
import type { EncounterRef, PokemonSpec, TeamSpec } from '../src/core/types';
import type { NodeSpec } from '../src/core/encounters';
import { GAME_LABEL } from '../src/data/encounters/types';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { createBattleScreen } from '../src/ui/screens/battle';
import { createSummary } from '../src/ui/screens/summary';
import { resetSettings } from '../src/ui/settings';
import { firstRunWhere, seedRange } from './seed-search';

const REVEAL = { ability: true, item: true, teamSize: true };

function mon(species: string, ability: string): PokemonSpec {
  return { species, ability, moves: ['Tackle'], level: 50 };
}

const JOEY: EncounterRef = {
  id: 'gs/joey-1',
  name: 'Joey',
  class: 'Youngster',
  sprite: 'youngster-gen2',
  game: 'gs',
  place: 'Route 30',
  role: 'route',
  cite: 'YoungsterJoey',
};

function nodeFor(kind: 'trainer' | 'gym', foe: TeamSpec, source: EncounterRef | null, opponent: string): NodeSpec {
  return {
    id: 's1-1-0',
    kind,
    tier: 'normal',
    label: kind === 'gym' ? `${source?.name ?? ''}'s Gym` : 'Trainer battle',
    encounter: { team: foe, opponent, source, simSeed: 'D100' as never },
    rewards: [],
  } as unknown as NodeSpec;
}

function mount(node: NodeSpec, p2: TeamSpec): { root: HTMLElement; detach: () => void } {
  const session = createBattle({ teams: { p1: [mon('Snorlax', 'Thick Fat')], p2 }, seed: 'D100' });
  const screen = createBattleScreen();
  document.body.replaceChildren(screen.root);
  const detach = screen.attach(session, node, REVEAL, () => undefined, 1);
  return { root: screen.root, detach };
}

beforeEach(() => {
  resetSettings();
});

describe('the battle header', () => {
  it('reads the class and the name with the trainer sprite at 16 before them', () => {
    const foe = [mon('Rattata', 'Run Away')];
    const { root, detach } = mount(nodeFor('trainer', foe, JOEY, 'Youngster Joey'), foe);
    const detail = root.querySelector<HTMLElement>('.battle__detail-text')!;
    expect(detail.textContent).toMatch(/^Youngster Joey · /);
    const img = detail.querySelector<HTMLImageElement>('img.sprite--opponent');
    expect(img).not.toBeNull();
    expect(img!.width).toBe(16);
    expect(img!.height).toBe(16);
    expect(img!.src).toMatch(/\/sprites\/trainers\/youngster-gen2\.png$/);
    expect(img!.getAttribute('aria-hidden')).toBe('true');
    // The sprite precedes the words.
    expect(detail.firstChild).toBe(img);
    detach();
  });

  it('wears no sprite where the record has none', () => {
    const foe = [mon('Rattata', 'Run Away')];
    const { root, detach } = mount(nodeFor('trainer', foe, { ...JOEY, sprite: null }, 'Youngster Joey'), foe);
    const detail = root.querySelector<HTMLElement>('.battle__detail-text')!;
    expect(detail.textContent).toMatch(/^Youngster Joey · /);
    expect(detail.querySelector('img')).toBeNull();
    detach();
  });

  it('reads the class alone under a gym title that carries the name', () => {
    const foe = [mon('Onix', 'Sturdy')];
    const brock: EncounterRef = { ...JOEY, id: 'rby/brock-1', name: 'Brock', class: 'Leader', sprite: 'brock-gen1rb', game: 'rby', place: 'Pewter City Gym', role: 'gym' };
    const { root, detach } = mount(nodeFor('gym', foe, brock, 'Leader Brock'), foe);
    expect(root.querySelector('.screen__title')?.textContent).toContain('Brock');
    const detail = root.querySelector<HTMLElement>('.battle__detail-text')!;
    expect(detail.textContent).toMatch(/^Leader · /);
    expect(detail.textContent).not.toContain('Brock');
    expect(detail.querySelector('img.sprite--opponent')).not.toBeNull();
    detach();
  });

  it('reads a rival challenger the same way: the class alone under the name in the title', () => {
    // Checkpoint 6: the boss may be a rival; the header's rule does not change.
    const foe = [mon('Pidgeotto', 'Keen Eye')];
    const blue: EncounterRef = { ...JOEY, id: 'rby/blue-3', name: 'Blue', class: 'Rival', sprite: 'blue-gen1', game: 'rby', place: 'Cerulean City', role: 'rival' };
    const { root, detach } = mount(nodeFor('gym', foe, blue, 'Rival Blue'), foe);
    expect(root.querySelector('.screen__title')?.textContent).toContain('Blue');
    const detail = root.querySelector<HTMLElement>('.battle__detail-text')!;
    expect(detail.textContent).toMatch(/^Rival · /);
    detach();
  });

  it('keeps the count-and-kind reading for a trainer with no record', () => {
    const foe = [mon('Golem', 'Sturdy')];
    const { root, detach } = mount(nodeFor('trainer', foe, null, "Trainer's Golem"), foe);
    const detail = root.querySelector<HTMLElement>('.battle__detail-text')!;
    expect(detail.textContent).toMatch(/^Trainer's Golem/);
    expect(detail.querySelector('img')).toBeNull();
    detach();
  });
});

describe('what core writes as the opponent', () => {
  it('is the class and the name for every trainer and gym node, read once where they are the same word', () => {
    const run = createRun('D100-OPPONENT', DEFAULT_TUNING);
    let trainers = 0;
    for (const segment of run.segments) {
      const gym = segment.gym.encounter!;
      expect(gym.opponent).toBe(`${gym.source!.class} ${gym.source!.name}`);
      for (const node of segment.routes.flatMap((r) => r.steps.flatMap((s) => s.options))) {
        if (!node.encounter) continue;
        const { source, opponent, team } = node.encounter;
        if (node.kind === 'wild') {
          expect(source).toBeNull();
          expect(opponent).toBe(`Wild ${team[0]!.species}`);
        } else {
          trainers += 1;
          expect(source).not.toBeNull();
          expect(opponent).toBe(source!.name === source!.class ? source!.class : `${source!.class} ${source!.name}`);
          expect(opponent).not.toMatch(/^(\S+) \1$/);
        }
      }
    }
    expect(trainers).toBeGreaterThan(0);
  });
});

describe('the summary', () => {
  it('cites the place and the game under every trainer and gym visit, and nothing under a wild one', async () => {
    const { run: result } = await firstRunWhere(
      seedRange('D100-SUMMARY-', 40),
      (seed) => playRun(seed, scriptedRunPolicy(greedyAiPolicy), undefined, { opponent: greedyAiPolicy }),
      (played) => played.state.history.some((visit) => visit.node.encounter?.source) && played.state.history.some((visit) => visit.node.kind === 'wild'),
      'reaching a trainer and a wild node',
    );
    const summary = createSummary();
    summary.render(result);
    const rows = [...summary.root.querySelectorAll<HTMLElement>('.summary__node')];
    expect(rows).toHaveLength(result.state.history.length);
    let cited = 0;
    rows.forEach((row, index) => {
      const visit = result.state.history[index]!;
      const cite = row.querySelector<HTMLElement>('.summary__node-cite');
      const source = visit.node.encounter?.source ?? null;
      if (source) {
        cited += 1;
        expect(cite?.textContent).toBe(`${source.place} · ${GAME_LABEL[source.game as keyof typeof GAME_LABEL]}`);
      } else {
        expect(cite).toBeNull();
      }
    });
    expect(cited).toBeGreaterThan(0);
  }, 60_000);
});
