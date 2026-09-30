/**
 * The run map: where you are in the run, where you are in the segment, and what
 * the run has cost so far.
 *
 * Three decisions worth naming.
 *
 * **The whole eight-gym rail is on screen, always.** Stage 1 had one segment and
 * a step chain was the entire map. Eight segments without a rail is a game where
 * the player cannot tell whether they are doing well — "Volta's Gym" means
 * nothing on its own, and "gym 3 of 8, five to go" means everything. The rail
 * also names each leader's type from the start, because a run is planned around
 * type matchups and hiding them would make planning guesswork rather than
 * knowledge.
 *
 * **Upcoming steps are shown.** The map reveals node *kinds* for every step, not
 * just the current one. It never reveals contents — what a wild node contains is
 * unknown until you enter it — so this is not a spoiler, it is the difference
 * between a choice and a coin flip: taking a fight now is a different decision
 * when you can see a rest two steps ahead.
 *
 * **The party panel was always on screen, from Stage 4 to 5.0/4.** HP and PP
 * are the resources a run spends, and the argument was that a rest node is only
 * a real option if the cost of skipping it is visible when you skip it. The
 * author took the team off the map in 5.0/4
 * (`docs/spec/gymrun-stage5.0-rulings-map-without-team.md`) to give the whole
 * segment the room: the team is one tap away on the Team tab, which from the
 * map opens the writable party screen the Manage button opened, and beside the
 * frame on a desktop. **The wallet stays**, in the heading, because a shop's
 * price on the next step is only a decision with the coins in view.
 *
 * **Stage 3: every offered fight shows its tier and what it pays, before you
 * commit.** This is the most important pixel in the game. A tier that the
 * player discovers only after walking into it is not a risk they took, it is a
 * thing that happened to them — and the whole stage is the claim that the step
 * between two nodes is a decision. So a current node carries three things: the
 * tier, the exact coin payout (which is a pure function of kind, tier and
 * segment, so it can be shown without spoiling anything), and a one-line read
 * on what the reward pool behind it is like.
 *
 * What it deliberately does *not* show is the three cards themselves. They were
 * drawn when the map was built and could be displayed — but a step where you
 * can read both futures in full is an optimisation problem, not a decision.
 * Tier and payout is the amount of information that leaves a judgement to make.
 */
import type { NodeSpec, Segment } from '../../core/encounters';
import type { LocaleId } from '../../data/locales';
import type { NodeVisit, RunState } from '../../core/run';
import { gymsCleared, localeOf, stepsOf } from '../../core/run';
import { localeById } from '../../data/locales';
import { resolveCapability, type CapabilityContext } from '../../core/capabilities';
// The two label tables the event screen prints too, from one file (4.8.0.2).
import { BAND_LABELS, CAPABILITY_LABELS, RARITY_LABELS } from '../../data/eventCopy';
import { nodePayout } from '../../core/economy';
import { GYMS, gymForSegment } from '../../data/gyms';
import { GLYPH_LABELS } from '../../data/glyphLabels';
import { AI_TIER_LABEL, aiTierFor } from '../../data/ai';
import { prose, type Prose } from '../dom';
import { KIND_HINTS } from '../copy/screens';
import { applyBackdrop } from '../assets/manifest';
import { capabilityBandChevron, capabilityGlyph, currencyAmount, nodeKindGlyph, tierPips } from '../chip';
import { slotX } from '../map-layout';
import { trainerImg } from '../sprites';
import { el } from '../scene';
import { typeChip } from './starter-select';

/**
 * The kind's word, for the mark's accessible name and nothing on the face.
 * **Patch 4.10.1, D46.** `KIND_LABELS` lived here from Stage 3 to 4.10.1 and
 * was the label line; the mark is the label line now, and the word is what a
 * screen reader and R7's exposure label say for it. Read from the glyph
 * label table so the two cannot drift.
 */
const kindWord = (kind: NodeSpec['kind']): string => GLYPH_LABELS[`node-${kind}`] ?? kind;

/**
 * The leader's name, for a gym node's face. The node's own `label` is
 * `"<Leader>'s Gym"`, which the run log and the share text read and which
 * `core/` keeps; on the face the mark says gym, so the suffix would be R3's
 * double render. The name comes from the gym table, not from trimming the
 * string.
 */
const gymLeaderName = (segment: number): string => gymForSegment(segment).leader;

export interface RunMap {
  root: HTMLElement;
  /**
   * Draw the map. `onChoose` picks a node, with the index of a current option.
   * The party screen is the Team tab's since 5.0/4, so the map no longer takes
   * a second callback for it.
   */
  render(state: RunState, onChoose: (index: number) => void): void;
}

/**
 * Bring the step the player is standing on into view.
 *
 * **The map's decision point is the only thing on this screen that is
 * urgent**, and on a phone it sits below the gym rail, the segment heading and
 * the whole party panel — measured at y=688 of an 844px viewport with a party
 * of one, and further down with three. Reclaiming the setup chrome (see the
 * phone rules in `styles.css`) buys most of that back; this covers the rest,
 * and covers a long segment on any viewport.
 *
 * `block: 'center'` rather than `'start'`: the steps on either side are what
 * make the current one read as a position in a sequence rather than as a list
 * that happens to begin here.
 *
 * Guarded on the method existing because jsdom does not implement it, and a
 * screen that threw in a test environment would be a screen nobody could test.
 * `prefers-reduced-motion` is honoured through `scroll-behavior` in the
 * stylesheet, which already covers `.chain`.
 */
function scrollToCurrentStep(chain: HTMLElement): void {
  const current = chain.querySelector('.step--current');
  if (current instanceof HTMLElement && typeof current.scrollIntoView === 'function') {
    current.scrollIntoView({ block: 'center', inline: 'nearest' });
  }
}

export function createRunMap(): RunMap {
  const root = el('section', 'screen screen--map');

  const rail = el('ol', 'rail');

  const heading = el('div', 'map__heading');

  // The segment, as a graph on the locale's map backdrop. Stage 5.0/4.
  const graph = createMapGraph();
  // The wallet, on the heading's first line: the one resource the map still shows.
  const wallet = el('div', 'map__wallet');

  root.append(rail, heading, graph.root);

  return {
    root,
    render(state, onChoose) {
      const segment = state.segments[state.currentSegment];
      if (!segment) return;

      rail.replaceChildren(...renderRail(state));
      // The heading is shared with the map overlay and Run Info; the wallet is
      // this screen's own, appended after it.
      heading.replaceChildren(...renderHeading(state, segment), wallet);

      /*
       * **No watermark since Stage 5.0/4.** The locale's name, ghosted behind
       * the chain, was this screen's background treatment from Stage V1; the
       * graph stands on the locale's own map backdrop now (D60's *Scene
       * backdrop*), and the name is in the heading, where it always was.
       */
      graph.render(state, segment, onChoose);
      scrollToCurrentStep(graph.root);
      // Coins, as the currency mark and a number (D54). A shop node saying
      // "from 55" is only a decision if this is on screen.
      wallet.replaceChildren(currencyAmount(state.currency, 'wallet'));
    },
  };
}

/**
 * The eight-gym rail.
 *
 * Cleared gyms are marked from `gymsCleared` rather than from the segment index,
 * because those are different numbers the moment a run ends at a gym: you are
 * *at* segment 3 having cleared 2.
 */
/**
 * The segment heading: which gym, who leads it, what type, how big, how far.
 *
 * **Extracted when the map overlay arrived, and exported rather than copied.**
 * `ui/map-drawer.ts` shows the same readout from every decision surface, and
 * the one thing that must never differ between the two is *what they reveal*.
 * `CLAUDE.md` bars verdicts, rankings and effectiveness against content the
 * player has not reached; a second implementation would be a second place for
 * those rules to drift, and the drift would be invisible until someone
 * compared the two screens side by side.
 *
 * Sharing the function makes the overlay unable to reveal a fact this screen
 * does not — by construction, not by care.
 *
 * The watermark is deliberately **not** here. It is the screen's own background
 * treatment, it writes to the screen's root, and the overlay wants none of it.
 */
export function renderHeading(state: RunState, segment: Segment): HTMLElement[] {
  const gym = segment.gymDefinition;
  const team = segment.gym.encounter?.team.length ?? 1;

  const title = el('h2', 'screen__title');
  title.textContent = `Gym ${state.currentSegment + 1} of ${state.segments.length} — ${gym.leader}`;
  // The leader's blurb, on tap. Pocket hides the flavour line under the
  // heading and the title says it instead (`ui/tooltips.ts`, `gym:`).
  title.dataset['tip'] = `gym:${state.currentSegment}`;
  title.tabIndex = 0;
  title.setAttribute('role', 'button');

  const subtitle = el('p', 'screen__blurb');
  subtitle.replaceChildren(
    typeChip(gym.type),
    // The gym's team size is public and the level band is not. Size changes
    // how the fight is *approached* — a solo Pokemon against three has to
    // budget PP — so hiding it would hide the decision rather than create one.
    document.createTextNode(` · ${team} Pokemon · ${stepsOf(state).length} steps before the gym`),
  );

  const blurb = el('p', 'map__blurb');
  blurb.textContent = gym.blurb;

  /*
   * The region the segment is being walked through, above the step chain.
   *
   * A heading rather than a badge on every node, because the locale is a
   * property of the *whole* route: repeating it on each card would be printing
   * one fact five times, and the phone pass spent a stage reclaiming vertical
   * space. Its four types are here for the same reason they are on the select
   * screen — they are what the region actually means for what you will meet.
   */
  const region = el('p', 'map__region');
  const locale = localeOf(state);
  region.hidden = !locale;
  if (locale) {
    const definition = localeById(locale);
    const label = el('span', 'map__region-name');
    label.textContent = definition.name;
    region.replaceChildren(label, ...definition.types.map(typeChip));
  }

  return [title, subtitle, blurb, region];
}

/**
 * The eight-gym rail. Exported for the map overlay, for `renderHeading`'s
 * reason: one implementation, so one set of facts.
 */
export function renderRail(state: RunState): HTMLElement[] {
  const cleared = gymsCleared(state);

  return GYMS.map((gym, index) => {
    const phase = index < cleared ? 'done' : index === state.currentSegment ? 'current' : 'upcoming';
    const item = el('li', `rail__gym rail__gym--${phase}`);

    const number = el('span', 'rail__number');
    number.textContent = phase === 'done' ? '✓' : String(index + 1);

    const label = el('span', 'rail__label');
    label.textContent = gym.leader;

    item.append(number, label, typeChip(gym.type));
    item.title = `${gym.leader} — ${gym.type}. ${gym.blurb}`;
    return item;
  });
}

/**
 * The segment as a graph. **Stage 5.0/4**, under the rulings on D63, D64 and
 * D75 (`docs/spec/gymrun-stage5.0-rulings-d61-d75-and-stage4.md`).
 *
 * One row per step inside the locale's map backdrop, drawn bottom up: the
 * entrance at the foot, the steps above it in order, the gym at the head. The
 * whole segment is on screen at once, taken steps included, which is what
 * retires 4.8's one-line summary of the past: that summary existed because a
 * card per taken step pushed the decision down the page, and a row of marks
 * does not.
 *
 * **Only the step being chosen from is a decision, and only it carries the
 * whole card** (D63). Its nodes show the detail line: the payout as the
 * currency mark and a number, the AI tier, a shop's shelf. Every other row
 * carries the node mark, the tier pips and the capability glyph with its
 * chevron, and the rest of the card is on the mark's long press, composed by
 * `nodeDetailText` from the same functions the face uses. Where a row is too
 * short for even that, the stylesheet keeps the mark alone (the pitch floor);
 * the press still has everything.
 *
 * **A node's place is its option index** within its step, against the slot
 * grid in `ui/map-layout.ts` (D75). Nothing is hashed and nothing is drawn:
 * the same state lays out the same way on every device, and nothing under
 * `core/` knows a position exists.
 *
 * **`onChoose` is optional so the map overlay can mount the same graph as a
 * readout.** Only a node on the step being chosen from is ever a button, and
 * only when a callback was passed; everything else is a `div`, so a graph
 * drawn without one has no control to press. The map screen stays the single
 * path by which a node is chosen, which is `CLAUDE.md`'s Rewards rule.
 */
export interface MapGraph {
  root: HTMLElement;
  render(state: RunState, segment: Segment, onChoose?: (index: number) => void): void;
}

type Phase = 'done' | 'current' | 'upcoming';

/** One end of an edge: the entrance, a node by step and option, or the gym. */
type Anchor = 'entrance' | 'gym' | `${number}:${number}`;

interface Edge {
  from: Anchor;
  to: Anchor;
  kind: 'travelled' | 'next';
}

export function createMapGraph(): MapGraph {
  const root = el('div', 'map-graph');
  root.dataset['tutorial'] = 'chain';
  const edges = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  edges.setAttribute('class', 'map-graph__edges');
  edges.setAttribute('aria-hidden', 'true');
  const rows = el('ol', 'chain map-graph__rows');
  root.append(edges, rows);

  /*
   * The edges are the one thing here that needs a measurement: a line runs
   * between two marks wherever the grid put them. Measured on every resize
   * rather than on render alone, because the screen renders while hidden
   * (every screen stays mounted) and a hidden graph measures zero. jsdom has
   * no observer and no layout; there the lines exist with their ends named
   * and no coordinates, which is all a structural test reads.
   */
  const layout = (): void => layoutEdges(root, edges);
  if (typeof ResizeObserver === 'function') new ResizeObserver(layout).observe(root);

  return {
    root,
    render(state, segment, onChoose) {
      const plan = planGraph(state);
      const locale = localeOf(state);
      applyBackdrop(root, locale ? `map-backdrop:${locale}` : null);
      root.dataset['steps'] = String(plan.steps.length);
      // The step rows that take the smaller floor: all but the one being chosen from.
      root.style.setProperty('--map-steps', String(plan.rows.filter((row) => row.kind === 'step' && row.track === 'step').length));

      rows.style.gridTemplateRows = plan.rows.map((row) => `var(--map-row-${row.track})`).join(' ');
      rows.replaceChildren(
        ...plan.rows.map((row) => {
          if (row.kind === 'entrance') return renderEntrance(plan.here === 'entrance');
          if (row.kind === 'gym') return renderGymRow(state, segment, plan);
          return renderStepRow(row.step, state, segment, plan, locale, onChoose);
        }),
      );

      edges.replaceChildren(
        ...plan.edges.map((edge) => {
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('class', `map-graph__edge map-graph__edge--${edge.kind}`);
          line.dataset['from'] = edge.from;
          line.dataset['to'] = edge.to;
          return line;
        }),
      );
      layout();
    },
  };
}

interface Plan {
  steps: ReturnType<typeof stepsOf>;
  /** Which option of each step was taken, or `undefined` for a step not yet walked. */
  taken: (number | undefined)[];
  phases: Phase[];
  gymPhase: Phase;
  gymVisit: NodeVisit | undefined;
  visits: NodeVisit[];
  /** Where the player is standing. */
  here: Anchor;
  /** Top to bottom, the order the grid lays them out in. */
  rows: ({ kind: 'gym'; track: 'gym' } | { kind: 'step'; step: number; track: 'current' | 'step' } | { kind: 'entrance'; track: 'entrance' })[];
  edges: Edge[];
}

/**
 * What the graph shows, as data, before anything is drawn. Exported for the
 * tests: the phases, the edges and the player's position are the claims the
 * plan makes, and they are claims about state, not about pixels.
 */
export function planGraph(state: RunState): Plan {
  const steps = stepsOf(state);
  // Only this segment's visits. History is the whole run.
  const visits = state.history.filter(
    (visit) => visit.segment === state.currentSegment && visit.node.kind !== 'gym',
  );
  const taken = steps.map((step) => {
    const visit = visits[step.index];
    if (!visit) return undefined;
    const option = step.options.findIndex((node) => node.id === visit.node.id);
    return option >= 0 ? option : undefined;
  });
  const phases: Phase[] = steps.map((step) =>
    visits[step.index] !== undefined ? 'done' : step.index === state.position && !state.outcome ? 'current' : 'upcoming',
  );
  const gymVisit = state.history.find(
    (visit) => visit.segment === state.currentSegment && visit.node.kind === 'gym',
  );
  const gymPhase: Phase = gymVisit ? 'done' : state.position >= steps.length ? 'current' : 'upcoming';

  // The travelled path: entrance, then every taken node in order.
  const path: Anchor[] = ['entrance'];
  steps.forEach((step, index) => {
    const option = taken[index];
    if (option !== undefined) path.push(`${step.index}:${option}`);
  });
  const here = path[path.length - 1] ?? 'entrance';
  const edges: Edge[] = [];
  for (let index = 1; index < path.length; index++) {
    edges.push({ from: path[index - 1]!, to: path[index]!, kind: 'travelled' });
  }
  if (gymVisit) {
    edges.push({ from: here, to: 'gym', kind: 'travelled' });
  } else {
    // Edges to the next choices, dashed. Later steps get none: the plan's
    // "future nodes without edges", because any node leads to any node in
    // the step after it and drawing that would be a mesh, not a map.
    const current = steps.findIndex((_, index) => phases[index] === 'current');
    if (current >= 0) {
      steps[current]!.options.forEach((_, option) => edges.push({ from: here, to: `${steps[current]!.index}:${option}`, kind: 'next' }));
    } else if (gymPhase === 'current') {
      edges.push({ from: here, to: 'gym', kind: 'next' });
    }
  }

  const rows: Plan['rows'] = [{ kind: 'gym', track: 'gym' }];
  for (let index = steps.length - 1; index >= 0; index--) {
    rows.push({ kind: 'step', step: index, track: phases[index] === 'current' ? 'current' : 'step' });
  }
  rows.push({ kind: 'entrance', track: 'entrance' });

  return { steps, taken, phases, gymPhase, gymVisit, visits, here, rows, edges };
}

/** The foot of the segment, where the player stands before the first step. */
function renderEntrance(here: boolean): HTMLElement {
  const row = el('li', 'step step--entrance');
  const spot = el('span', 'map-graph__entrance');
  spot.dataset['anchor'] = 'entrance';
  spot.setAttribute('aria-hidden', 'true');
  row.append(spot);
  if (here) row.append(renderPlayer(50));
  return row;
}

/** The player's trainer, standing beside the node they last walked to. */
function renderPlayer(x: number): HTMLElement {
  const player = el('span', 'map-graph__player');
  player.style.setProperty('--x', `${x}%`);
  player.append(trainerImg());
  return player;
}

function renderStepRow(
  index: number,
  state: RunState,
  segment: Segment,
  plan: Plan,
  locale: LocaleId | null,
  onChoose?: (index: number) => void,
): HTMLElement {
  const step = plan.steps[index]!;
  const phase = plan.phases[index]!;
  const row = el('li', `step step--${phase}`);
  row.dataset['step'] = String(step.index);

  const marker = el('span', 'step__marker');
  marker.textContent = String(step.index + 1);
  marker.setAttribute('aria-label', `Step ${step.index + 1}`);

  const nodes = el('div', 'step__nodes');
  // The tutorial's anchors sit on the current step only: the decision, not the context.
  if (phase === 'current') nodes.dataset['tutorial'] = 'options';
  const choose = phase === 'current' ? onChoose : undefined;
  nodes.append(
    ...step.options.map((node, option) => {
      const walked = plan.taken[index];
      const element = renderNode(node, phase, segment.index, state, {
        full: phase === 'current',
        visit: walked === option ? plan.visits[step.index] : undefined,
        passed: phase === 'done' && walked !== option,
        onChoose: choose ? () => choose(option) : undefined,
      });
      element.style.setProperty('--x', `${slotX(locale, step.index, step.options.length, option)}%`);
      element.querySelector('.node__mark')?.setAttribute('data-anchor', `${step.index}:${option}`);
      return element;
    }),
  );
  if (plan.here === `${step.index}:${plan.taken[index]}`) {
    nodes.append(renderPlayer(slotX(locale, step.index, step.options.length, plan.taken[index]!)));
  }

  row.append(marker, nodes);
  return row;
}

function renderGymRow(state: RunState, segment: Segment, plan: Plan): HTMLElement {
  const row = el('li', `step step--${plan.gymPhase} step--gym`);
  const nodes = el('div', 'step__nodes');
  // The gym is never a button here: it is entered from the pre-gym screen,
  // which is where its lead is chosen.
  const element = renderNode(segment.gym, plan.gymPhase, segment.index, state, {
    full: false,
    visit: plan.gymVisit,
    passed: false,
  });
  element.style.setProperty('--x', '50%');
  element.querySelector('.node__mark')?.setAttribute('data-anchor', 'gym');
  nodes.append(element);
  row.append(nodes);
  return row;
}

/**
 * The detail line's facts, for a node that has not been walked. One function
 * for the face (the step being chosen from) and the press (every other row),
 * so the two cannot disagree about what a node pays or who is across it.
 *
 * The coin payout is exact rather than a range, because it *is* exact: a pure
 * function of kind, tier and segment, computed by the same `nodePayout` that
 * pays it out. The AI tier names the opponent the way the kind names the
 * node, and says nothing about whether the fight is a good idea: an
 * attribute, not a verdict. An untiered node keeps its kind's short hint,
 * having no pips to read the fact off (M5.2). A shop names its shelf.
 */
function nodeFacts(node: NodeSpec, segment: number): { payout: number; words: (string | Prose)[] } {
  const payout = nodePayout(node, segment);
  const words: (string | Prose)[] = [];
  if (node.encounter) words.push(AI_TIER_LABEL[aiTierFor(node.kind, node.tier, segment)]);
  if (!node.tier) words.push(KIND_HINTS[node.kind]);
  if (node.kind === 'shop' && node.shop) {
    const cheapest = Math.min(...node.shop.items.map((item) => item.price));
    words.push(`${node.shop.items.length} on the shelf, from ${cheapest}`);
  }
  return { payout, words };
}

/** The same facts as one line of text, for the press on a row that does not show them. */
function nodeDetailText(node: NodeSpec, segment: number, visit?: NodeVisit): string {
  if (visit) return visitText(node, visit);
  const { payout, words } = nodeFacts(node, segment);
  return [
    ...(payout > 0 ? [`${payout} coins`] : []),
    ...words.filter((word) => typeof word === 'string' || word !== KIND_HINTS[node.kind]).map((word) => (typeof word === 'string' ? word : word.long)),
  ].join(' · ');
}

/**
 * What a walked node was. Information the player already has, which turns the
 * graph into a record of the run rather than a progress bar; on the press,
 * since D63, rather than on the face.
 */
function visitText(node: NodeSpec, visit: NodeVisit): string {
  if (!visit.result) return 'restored';
  const turns = `${visit.result.turns} turn${visit.result.turns === 1 ? '' : 's'}`;
  return node.encounter ? `${node.encounter.opponent} · ${turns}` : turns;
}

interface NodeOptions {
  /** The whole card, detail line included: the step being chosen from. */
  full: boolean;
  visit: NodeVisit | undefined;
  /** A node on a walked step that was not the one taken. */
  passed: boolean;
  onChoose?: () => void;
}

function renderNode(node: NodeSpec, phase: Phase, segment: number, run: CapabilityContext, options: NodeOptions): HTMLElement {
  const interactive = Boolean(options.onChoose);
  const element = interactive ? document.createElement('button') : el('div', '');
  if (element instanceof HTMLButtonElement) element.type = 'button';
  element.className = [
    'node',
    `node--${node.kind}`,
    `node--${phase}`,
    node.tier ? `node--tier-${node.tier}` : '',
    options.full ? 'node--full' : 'node--compact',
    options.visit ? 'node--visited' : '',
    options.passed ? 'node--passed' : '',
  ].filter(Boolean).join(' ');

  /*
   * **The kind is a mark** (patch 4.10.1, D46), inside the node's disc. A gym
   * is named beside its mark by its leader, with its team size; the rest are
   * a kind and nothing more, because naming them would reveal what a node
   * contains before it is chosen.
   */
  const mark = el('span', 'node__mark');
  const label = el('span', 'node__label');
  if (phase === 'current') label.dataset['tutorial'] = 'kinds';
  const kind = nodeKindGlyph(node.kind, kindWord(node.kind), 24);
  if (!options.full) {
    const detail = nodeDetailText(node, segment, options.visit);
    if (detail) kind.dataset['detail'] = detail;
  }
  label.append(kind);
  mark.append(label);
  element.append(mark);

  if (node.kind === 'gym') {
    const size = node.encounter?.team.length ?? 0;
    const name = el('span', 'node__name');
    name.textContent = `${gymLeaderName(segment)}${size > 1 ? ` · ${size} Pokemon` : ''}`;
    element.append(name);
  }

  /*
   * The facts beneath the mark: the tier pips and, on an event, the
   * requirement and the run's band against it. On every row, not only the
   * current one: routing toward an elite fight or an event two steps ahead is
   * only a plan if you can see it (M5.2, D37, and D63 keeps both).
   */
  const facts = el('span', 'node__facts');
  if (node.tier) {
    // Pips, not the word (M5.2). The `tier:` tip carries the definition,
    // including what the tier pays, which is why there is no second strip.
    const pips = tierPips(node.tier);
    if (phase === 'current') pips.dataset['tutorial'] = 'tier';
    const tier = el('span', 'node__tier');
    tier.append(pips);
    facts.append(tier);
  }
  if (node.event) {
    /*
     * The requirement and the band the run reads at for it: a glyph and a
     * part-filled chevron (M5.2, D37), three states since D64 kept them
     * three. Rarity rides the capability panel, because it scales which
     * tier an outcome lands on and has no row in section 3.
     */
    const band = resolveCapability(run, node.event.requires);
    const gate = el('span', `node__gate node__gate--${band}`);
    if (phase === 'current') gate.dataset['tutorial'] = 'gate';
    const requirement = capabilityGlyph(node.event.requires, CAPABILITY_LABELS[node.event.requires]);
    requirement.dataset['detail'] = RARITY_LABELS[node.event.rarity];
    gate.append(requirement, capabilityBandChevron(band, BAND_LABELS[band]));
    facts.append(gate);
  }
  if (facts.childElementCount > 0) element.append(facts);

  if (options.full) {
    const detail = el('span', 'node__detail');
    const { payout, words } = nodeFacts(node, segment);
    const parts: Node[] = [];
    if (payout > 0) parts.push(currencyAmount(payout, 'payout'));
    for (const word of words) parts.push(typeof word === 'string' ? document.createTextNode(word) : prose(word));
    detail.replaceChildren(...parts.flatMap((part, index) => (index > 0 ? [document.createTextNode(' · '), part] : [part])));
    element.append(detail);
  }

  if (options.onChoose) element.addEventListener('click', options.onChoose);
  return element;
}

/**
 * Lay the edges over the grid, mark centre to mark centre, in the graph's
 * own pixels. A line whose end has no box (a hidden screen) is left where it
 * was; the observer runs again when the graph gets a size.
 */
function layoutEdges(root: HTMLElement, edges: SVGSVGElement): void {
  const box = root.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) return;
  edges.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
  const centre = (anchor: string): { x: number; y: number } | null => {
    const target = root.querySelector(`[data-anchor="${anchor}"]`);
    if (!target) return null;
    const rect = target.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;
    return { x: rect.left + rect.width / 2 - box.left, y: rect.top + rect.height / 2 - box.top };
  };
  for (const line of edges.querySelectorAll<SVGLineElement>('line')) {
    const from = centre(line.dataset['from'] ?? '');
    const to = centre(line.dataset['to'] ?? '');
    if (!from || !to) continue;
    line.setAttribute('x1', from.x.toFixed(1));
    line.setAttribute('y1', from.y.toFixed(1));
    line.setAttribute('x2', to.x.toFixed(1));
    line.setAttribute('y2', to.y.toFixed(1));
  }
}
