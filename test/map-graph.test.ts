/**
 * The segment as a graph. **Stage 5.0/4**, under the rulings on D63, D64 and
 * D75 (`docs/spec/gymrun-stage5.0-rulings-d61-d75-and-stage4.md`).
 *
 * Structural claims, in jsdom: which nodes are buttons, which carry the whole
 * card, where each node is placed and why, which edges exist and which kind,
 * where the player stands. The pixel claims (fit at 390x844, the pitch floor,
 * no overlap) are the browser suites' (`visual-v0`, `map-fold`).
 *
 * The plan's test 7 as D63 reads it: *"only next-step nodes commit; every
 * node inspects."*
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { resolveCapability } from '../src/core/capabilities';
import { nodePayout } from '../src/core/economy';
import { localeOf, stepsOf, type RunState } from '../src/core/run';
import { AI_TIER_LABEL, aiTierFor } from '../src/data/ai';
import { deepMapState, openingState } from '../src/ui/gallery-fixtures';
import { DEFAULT_GRID, slotX } from '../src/ui/map-layout';
import { createMapGraph, planGraph } from '../src/ui/screens/run-map';

const SEED = 'MAPGRAPH';

function drawn(state: RunState, onChoose?: (index: number) => void): HTMLElement {
  const graph = createMapGraph();
  document.body.replaceChildren(graph.root);
  const segment = state.segments[state.currentSegment]!;
  graph.render(state, segment, onChoose);
  return graph.root;
}

beforeEach(() => {
  document.body.replaceChildren();
});

describe('the plan: phases, the path and the next choices', () => {
  it('stands at the entrance with dashed edges to every first-step option before anything is walked', () => {
    const state = openingState(SEED);
    const plan = planGraph(state);
    const first = stepsOf(state)[0]!;
    expect(plan.here).toBe('entrance');
    expect(plan.phases[0]).toBe('current');
    expect(plan.phases.slice(1).every((phase) => phase === 'upcoming')).toBe(true);
    expect(plan.edges).toEqual(first.options.map((_, option) => ({ from: 'entrance', to: `0:${option}`, kind: 'next' })));
  });

  it('draws the walked path solid and the next step dashed, and nothing to later steps', () => {
    const state = deepMapState(SEED);
    const plan = planGraph(state);
    const walked = state.position;
    expect(walked).toBeGreaterThan(0);
    const travelled = plan.edges.filter((edge) => edge.kind === 'travelled');
    const next = plan.edges.filter((edge) => edge.kind === 'next');
    expect(travelled).toHaveLength(walked);
    expect(travelled[0]!.from).toBe('entrance');
    expect(plan.here).toBe(`${walked - 1}:${plan.taken[walked - 1]}`);
    expect(next.map((edge) => edge.to)).toEqual(stepsOf(state)[walked]!.options.map((_, option) => `${walked}:${option}`));
    for (const edge of plan.edges) {
      const step = edge.to === 'gym' ? Infinity : Number(edge.to.split(':')[0]);
      expect(step, `an edge reaches past the next step: ${edge.to}`).toBeLessThanOrEqual(walked);
    }
  });

  it('lays out the gym on top, the steps bottom up, and the entrance at the foot', () => {
    const plan = planGraph(deepMapState(SEED));
    expect(plan.rows[0]).toEqual({ kind: 'gym', track: 'gym' });
    expect(plan.rows[plan.rows.length - 1]).toEqual({ kind: 'entrance', track: 'entrance' });
    const steps = plan.rows.filter((row) => row.kind === 'step').map((row) => (row.kind === 'step' ? row.step : -1));
    expect(steps).toEqual([...steps].sort((a, b) => b - a));
    expect(plan.rows.filter((row) => row.kind === 'step' && row.track === 'current')).toHaveLength(1);
  });

  it('reads the gym as current once every step is walked, with the one dashed edge to it', () => {
    const state = deepMapState(SEED);
    const steps = stepsOf(state);
    const segment = state.currentSegment;
    const rest = steps.slice(state.position).map((step) => ({ ...state.history.find((visit) => visit.segment === segment)!, node: step.options[0]! }));
    const atGym: RunState = { ...state, position: steps.length, history: [...state.history, ...rest] };
    const plan = planGraph(atGym);
    expect(plan.gymPhase).toBe('current');
    expect(plan.phases.every((phase) => phase === 'done')).toBe(true);
    expect(plan.edges.filter((edge) => edge.kind === 'next')).toEqual([{ from: plan.here, to: 'gym', kind: 'next' }]);
  });
});

describe('the nodes', () => {
  it('makes only the step being chosen from into buttons, and only with a callback', () => {
    const state = deepMapState(SEED);
    const options = stepsOf(state)[state.position]!.options.length;
    const root = drawn(state, () => {});
    const buttons = [...root.querySelectorAll('button.node')];
    expect(buttons).toHaveLength(options);
    expect(buttons.every((button) => button.closest('.step--current'))).toBe(true);
    expect(drawn(state).querySelectorAll('button')).toHaveLength(0);
  });

  it('commits the option the player taps, by its index', () => {
    const state = deepMapState(SEED);
    const picked: number[] = [];
    const root = drawn(state, (index) => picked.push(index));
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('button.node')];
    buttons.at(-1)!.click();
    expect(picked).toEqual([buttons.length - 1]);
  });

  it('gives the step being chosen from the whole card, and every other row the mark, tier and capability', () => {
    const state = deepMapState(SEED);
    const root = drawn(state, () => {});
    for (const node of root.querySelectorAll<HTMLElement>('.node')) {
      const current = node.classList.contains('node--current');
      expect(node.querySelector('.node__kind'), 'every node wears its kind').not.toBeNull();
      expect(node.classList.contains(current ? 'node--full' : 'node--compact')).toBe(true);
      expect(Boolean(node.querySelector('.node__detail')), 'the detail line is on the current row only').toBe(current);
      if ([...node.classList].some((name) => name.startsWith('node--tier-'))) {
        expect(node.querySelector('.tier-pips'), 'a tiered node on any row shows its pips').not.toBeNull();
      }
    }
  });

  it('puts the payout as the currency mark and the AI tier on the face of a current fight', () => {
    const state = deepMapState(SEED);
    const root = drawn(state, () => {});
    const step = stepsOf(state)[state.position]!;
    step.options.forEach((node, option) => {
      const element = root.querySelectorAll<HTMLElement>('.step--current .node')[option]!;
      const payout = nodePayout(node, state.currentSegment);
      const coins = element.querySelector<HTMLElement>('.chip--currency');
      if (payout > 0) {
        expect(coins?.dataset['value']).toBe(String(payout));
        expect(coins?.dataset['tip']).toBe('currency:payout');
        expect(element.querySelector('.node__detail')?.textContent).not.toMatch(/coins/);
      } else {
        expect(coins).toBeNull();
      }
      if (node.encounter) {
        expect(element.querySelector('.node__detail')?.textContent).toContain(AI_TIER_LABEL[aiTierFor(node.kind, node.tier, state.currentSegment)]);
      }
    });
  });

  it('puts the rest of the card on the mark of every node that does not show it', () => {
    const state = deepMapState(SEED);
    const root = drawn(state, () => {});
    const steps = stepsOf(state);
    for (let index = state.position + 1; index < steps.length; index++) {
      steps[index]!.options.forEach((node, option) => {
        const mark = root.querySelector<HTMLElement>(`[data-anchor="${index}:${option}"] .node__kind`)!;
        const payout = nodePayout(node, state.currentSegment);
        if (payout > 0) expect(mark.dataset['detail']).toContain(`${payout} coins`);
        if (node.encounter) expect(mark.dataset['detail']).toContain(AI_TIER_LABEL[aiTierFor(node.kind, node.tier, state.currentSegment)]);
        expect(mark.dataset['tip']).toBe(`node:${node.kind}`);
      });
    }
  });

  it('keeps the capability chevron at the band resolveCapability returns, on every row (D64)', () => {
    const state = deepMapState(SEED);
    const root = drawn(state, () => {});
    stepsOf(state).forEach((step) =>
      step.options.forEach((node, option) => {
        if (!node.event) return;
        const gate = root.querySelector(`[data-anchor="${step.index}:${option}"]`)!.closest('.node')!.querySelector('.node__gate');
        expect(gate?.classList.contains(`node__gate--${resolveCapability(state, node.event.requires)}`)).toBe(true);
      }),
    );
  });

  it('places every node by its option index and nothing else (D75)', () => {
    const state = deepMapState(SEED);
    const root = drawn(state);
    const locale = localeOf(state);
    for (const step of stepsOf(state)) {
      step.options.forEach((_, option) => {
        const node = root.querySelector(`[data-anchor="${step.index}:${option}"]`)!.closest<HTMLElement>('.node')!;
        expect(node.style.getPropertyValue('--x')).toBe(`${slotX(locale, step.index, step.options.length, option)}%`);
      });
    }
  });

  it('stands the player on the node last walked to, once', () => {
    const state = deepMapState(SEED);
    const root = drawn(state);
    const players = root.querySelectorAll('.map-graph__player');
    expect(players).toHaveLength(1);
    expect(players[0]!.closest('.step')?.getAttribute('data-step')).toBe(String(state.position - 1));
    expect(players[0]!.querySelector('img.sprite--trainer')).not.toBeNull();
    expect(drawn(openingState(SEED)).querySelector('.step--entrance .map-graph__player')).not.toBeNull();
  });

  it('draws one line per edge, named by its ends, and asks the manifest for the locale backdrop', () => {
    const state = deepMapState(SEED);
    const root = drawn(state);
    const plan = planGraph(state);
    const lines = [...root.querySelectorAll<SVGLineElement>('.map-graph__edges line')];
    expect(lines.map((line) => [line.dataset['from'], line.dataset['to'], line.classList.contains('map-graph__edge--next') ? 'next' : 'travelled'])).toEqual(
      plan.edges.map((edge) => [edge.from, edge.to, edge.kind]),
    );
    expect(root.dataset['backdrop']).toBe(`map-backdrop:${localeOf(state)}`);
  });
});

describe('the slot grid (D75)', () => {
  it('is a pure function of locale, step, count and option, inside the frame', () => {
    for (let step = 0; step < 8; step++) {
      for (let count = 1; count <= 3; count++) {
        for (let option = 0; option < count; option++) {
          const x = slotX('cave', step, count, option);
          expect(x).toBe(slotX('cave', step, count, option));
          expect(x).toBeGreaterThanOrEqual(10);
          expect(x).toBeLessThanOrEqual(90);
          const base = (count === 3 ? DEFAULT_GRID[3] : count === 2 ? DEFAULT_GRID[2] : DEFAULT_GRID[1])[option]!;
          expect(Math.abs(x - base)).toBe(DEFAULT_GRID.lean);
        }
      }
    }
  });

  it('keeps the options of a step in their order, left to right', () => {
    for (let count = 2; count <= 3; count++) {
      const xs = Array.from({ length: count }, (_, option) => slotX(null, 1, count, option));
      expect(xs).toEqual([...xs].sort((a, b) => a - b));
    }
  });
});
