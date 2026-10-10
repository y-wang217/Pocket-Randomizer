/**
 * The card battle sandbox: one fight, full frame, over whatever the app is
 * showing. **Card battle engine, checkpoint 5.** Loaded only lazily, by
 * `ui/cardbattle-entry.ts`, so nothing here, its stylesheet or
 * its asset manifest reaches the main bundle.
 *
 * The screen holds no rules. Every tap becomes an engine action; the engine
 * answers with a new state and an event list. A committed round plays back
 * one step at a time, in the order it resolved (`playback.ts`): the acting
 * piece pulses, its attack's tiles flash, a hit piece shakes under the HP it
 * lost, a moved piece slides. Any tap skips to the end and never blocks
 * input. Under reduced motion the round lands at once. Every round stays in
 * the round log, under Menu.
 *
 * A battle opens in deployment: the player taps a unit, then a home tile, to
 * place it (a unit already there swaps), and Start begins round 1. The menu
 * lists every scenario, and Bot turn, which has the guard bot place the units
 * or play the round from wherever the plan stands (`core/cards/guard.ts`).
 *
 * Outside the design bible by the author's ruling
 * (`docs/spec/gymrun-card-battle-engine-rulings.md`). It writes nothing into
 * the run save.
 */
import './sandbox.css';

import { CARDS } from '../../cardData/cards';
import { CARD_COPY, CARD_LANGUAGES, LANGUAGE_NAMES, cardLanguage, nameOf, setCardLanguage } from '../../cardData/copy';
import { RUN_COPY } from '../../cardData/cardrunCopy';
import { ENCOUNTERS, SCENARIOS } from '../../cardData/encounters';
import { ENEMIES } from '../../cardData/enemies';
import { RULES } from '../../cardData/rules';
import { UNITS } from '../../cardData/units';
import { createBattle, gradeTotal } from '../../core/cards/create';
import type { Effect, EnemyDefId, Pos } from '../../core/cards/defs';
import { planDeploy, planRound } from '../../core/cards/guard';
import { choicesFor } from '../../core/cards/legal';
import { newLog, type BattleLog } from '../../core/cards/log';
import { friendlyFireFor, interceptsFor, previewPlay, type AttackPreview, type FriendlyFire, type Intercept } from '../../core/cards/preview';
import type { Action, BattleState, CardIid, TargetId, UnitId } from '../../core/cards/state';
import type { BattleEvent } from '../../core/cards/events';
import { step } from '../../core/cards/step';
import { enemyNumber, viewOf, type BattleView, type HandCardView, type TileThreat, type TileView } from '../../core/cards/view';
import { samePos } from '../../core/cards/zones';
import { newSeed } from '../seed';
import { CARD_ASSET_GROUPS, cardAsset, cardAssetUrl, type CardAssetId } from './assets';
import { roundSteps, type RoundRecord, type Step } from './playback';
import { CARD_PALETTES, loadCardPrefs, saveCardPrefs, type CardPalette, type CardPrefs } from './prefs';

export interface Sandbox {
  root: HTMLElement;
  close(): void;
}

export interface SandboxOptions {
  seed?: string;
  /** The scenario to open on; the default scenario when absent or unknown. */
  encounter?: string;
  onExit?: () => void;
  /**
   * A card run's battle (`ui/cardrun/`): opened where it stands, its deck and
   * boosts already in its state, each accepted action reported so the run
   * steps with it. In a run there is no restart, no new seed and no scenario
   * list; the top bar's button and the end of the battle hand back to the run.
   */
  run?: {
    state: BattleState;
    log: BattleLog;
    onAction: (action: Action) => void;
  };
}

interface Pending {
  card: CardIid;
  unit?: UnitId;
  stage: 'assign' | 'unit' | 'tile';
  /** Command's chosen ally, once picked. */
  ally?: TargetId;
  units: TargetId[];
  tiles: Pos[];
  /** For a Move: the destinations that step in front of a Strike aimed at an ally. */
  intercepts?: Intercept[];
  /** While assigning a Neutral: the units that may play it but cannot now, and why. */
  blocked?: HandCardView['blocked'];
  /** For a Blast: the tiles or enemies it could take that would also hit an ally (R14). */
  friendly?: FriendlyFire[];
}

/** The scenario the sandbox opens on: enemies drawn anywhere on their backline. */
const DEFAULT_ENCOUNTER = 'skirmish';
const LONG_PRESS_MS = 450;
/** The board's row height in sandbox.css, the rows it has, and how much each may give a short screen. */
const ROW = 52;
const BOARD_ROWS = 7;
const ROW_GIVE = 6;
/** How long each kind of playback step holds. */
const STEP_MS: Record<Step['kind'], number> = { card: 900, enemy: 900, move: 600, next: 900, round: 700, end: 900 };

const UNIT_MARKER: Record<UnitId, CardAssetId> = { A: 'marker-unit-commander', B: 'marker-unit-gunner', C: 'marker-unit-dasher' };
const UNIT_PORTRAIT: Record<UnitId, CardAssetId> = { A: 'portrait-commander', B: 'portrait-gunner', C: 'portrait-dasher' };
const ENEMY_MARKER: Record<EnemyDefId, CardAssetId> = {
  drone: 'marker-enemy-drone',
  lancer: 'marker-enemy-lancer',
  hound: 'marker-enemy-hound',
  turret: 'marker-enemy-turret',
  bulwark: 'marker-enemy-bulwark',
  sniper: 'marker-enemy-sniper',
  pikeman: 'marker-enemy-pikeman',
  colossus: 'marker-enemy-colossus',
};
const INTENT_ICON: Record<string, CardAssetId> = {
  strike: 'icon-strike',
  pierce: 'icon-pierce',
  slash: 'icon-slash',
  blast: 'icon-blast',
  shield: 'icon-shield',
  scream: 'icon-scream',
  none: 'icon-wait',
};
const THREAT_ORDER: readonly TileThreat['act'][] = ['pierce', 'slash', 'scream', 'strike'];
const THREAT_ORDER_ALL: readonly AttackPreview['act'][] = ['pierce', 'slash', 'blast', 'strike'];

interface OwnAttack {
  pos: Pos;
  act: AttackPreview['act'];
  n: number;
  /** The unit that plays it: its owner colour. */
  unit: UnitId;
  stop: boolean;
  /** From the card being chosen, not yet in the plan. */
  pending: boolean;
}
const ZONE_TILE: Record<TileView['zone'], CardAssetId> = {
  playerBackline: 'tile-player-backline',
  danger: 'tile-danger-zone',
  enemyBackline: 'tile-enemy-backline',
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className: string, label: string, onTap: () => void): HTMLButtonElement {
  const node = el('button', className);
  node.type = 'button';
  // The pack's three button states; the stylesheet shows the one that applies. The primary button is green.
  const primary = className.includes('cb-btn--primary');
  for (const state of ['button-default', 'button-pressed', 'button-unavailable'] as const) {
    const layer = cardAsset(primary ? (state.replace('button-', 'button-primary-') as CardAssetId) : state, 'fill');
    layer.dataset['state'] = state;
    node.append(layer);
  }
  node.append(el('span', 'cb-btn-label', label));
  node.addEventListener('click', onTap);
  return node;
}

/** The icon and number a card's face shows: its first effect that has one, its picture for flavour when it names one. */
export function faceOf(effects: readonly Effect[], face?: 'shovel' | 'harpoon'): { icon: CardAssetId; n: number | null; targeted: boolean } {
  const shown = effectFace(effects);
  return face ? { ...shown, icon: `icon-${face}` } : shown;
}

function effectFace(effects: readonly Effect[]): { icon: CardAssetId; n: number | null; targeted: boolean } {
  const targeted = effects.some((e) => e.k === 'target');
  for (const effect of effects) {
    switch (effect.k) {
      case 'strike':
      case 'pierce':
      case 'slash':
      case 'blast':
        return { icon: `icon-${effect.k}`, n: effect.n, targeted };
      case 'move':
      case 'grantMove':
        return { icon: 'icon-move', n: effect.n, targeted };
      case 'shield':
        return { icon: 'icon-shield', n: effect.n, targeted };
      case 'gainMp':
      case 'mpNextTurns':
        return { icon: 'icon-mp', n: effect.n, targeted };
      case 'drawNext':
        return { icon: 'icon-draw', n: effect.n, targeted };
      case 'harpoon':
        return { icon: 'icon-harpoon', n: null, targeted };
      default:
        break;
    }
  }
  return { icon: 'icon-wait', n: null, targeted };
}

/** The labels that sit in a fixed box: a card's name, a slot's, a panel's, a stat line, an intent. */
const FIT = '.cb-card-name, .cb-full-name, .cb-slot-name, .cb-panel-name, .cb-stat, .cb-pill-text';
/** How far a label may shrink to fit before it is cut with an ellipsis. */
const FIT_FLOOR = 0.6;
const FIT_STEP = 0.05;
/** The horizontal padding `sandbox.css` gives a label, in px, where it has any. */
const FIT_PADDING: Record<string, number> = { 'cb-slot-name': 4 };

/**
 * Shrink each fixed-box label until it fits, down to `FIT_FLOOR` of its size.
 * English fits as written; a longer language would otherwise lose the end of
 * a card's name. The stylesheet multiplies each label's size by `--cb-fit`,
 * so nothing here reads a computed style (`test/no-computed-timing.test.ts`).
 * Measures the laid-out page, so it does nothing where nothing is laid out.
 */
export function fitLabels(scope: ParentNode): void {
  for (const node of scope.querySelectorAll<HTMLElement>(FIT)) {
    node.style.removeProperty('--cb-fit');
    let scale = 1;
    while (overflows(node) && scale > FIT_FLOOR) {
      scale = Math.max(FIT_FLOOR, scale - FIT_STEP);
      node.style.setProperty('--cb-fit', scale.toFixed(2));
    }
  }
}

/**
 * Whether a label's text is wider than its box, to the sub-pixel: an ellipsis
 * shows at any overflow, and `scrollWidth` rounds a fraction of a pixel away.
 */
export function overflows(node: HTMLElement): boolean {
  const box = node.getBoundingClientRect().width;
  if (box === 0) return false;
  const range = node.ownerDocument.createRange();
  range.selectNodeContents(node);
  const padding = [...node.classList].reduce((sum, name) => sum + (FIT_PADDING[name] ?? 0), 0);
  return range.getBoundingClientRect().width > box - padding + 0.01;
}

function reducedMotion(): boolean {
  return typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** A card's effects as short lines of text. */
export function effectLines(effects: readonly Effect[]): string[] {
  const k = CARD_COPY.keyword;
  const target = effects.find((e) => e.k === 'target');
  const lines: string[] = [];
  for (const effect of effects) {
    switch (effect.k) {
      case 'strike':
      case 'pierce':
      case 'slash':
      case 'blast':
        lines.push(target ? `${k[effect.k]} ${effect.n} · ${k.target} ${target.n}` : `${k[effect.k]} ${effect.n}`);
        break;
      case 'move':
        lines.push(`${k.move} ${effect.n}`);
        break;
      case 'shield':
        lines.push(effect.to === 'self' ? CARD_COPY.effect.shieldSelf(effect.n) : CARD_COPY.effect.shieldFriendly(effect.n));
        break;
      case 'gainMp':
        lines.push(CARD_COPY.effect.gainMp(effect.n));
        break;
      case 'mpNextTurns':
        lines.push(CARD_COPY.effect.mpNextTurns(effect.n, effect.turns));
        break;
      case 'grantMove':
        lines.push(CARD_COPY.effect.grantMove(effect.n));
        break;
      case 'drawNext':
        lines.push(CARD_COPY.effect.drawNext(effect.n));
        break;
      case 'harpoon':
        lines.push(CARD_COPY.effect.harpoon(effect.range, effect.pin));
        break;
      default:
        break;
    }
  }
  return lines;
}

export function openSandbox(host: HTMLElement, options: SandboxOptions = {}): Sandbox {
  let seed = options.seed ?? newSeed();
  let encounterId = options.encounter && Object.hasOwn(ENCOUNTERS, options.encounter) ? options.encounter : DEFAULT_ENCOUNTER;
  /** Deployment: the unit picked to place, before its tile is. */
  let placing: UnitId | null = null;
  /**
   * The unit filter (A6, provisional): the hand shows only what this unit can
   * play now, the rest folded into one chip. Presentation only: it never
   * reaches the engine or the log.
   */
  let filter: UnitId | null = null;
  let state!: BattleState;
  let log!: BattleLog;
  let pending: Pending | null = null;
  let inspectMode = false;
  let message = '';
  let beatTimer: ReturnType<typeof setTimeout> | null = null;
  /** Every committed round, as the log lists it, with what it needs to be told again in another language. */
  let rounds: (RoundRecord & { events: readonly BattleEvent[]; after: BattleState })[] = [];
  let prefs: CardPrefs = loadCardPrefs();
  /** The round being played back: its loud steps, the one showing, and each planned card's place in the order. */
  let playback: { steps: Step[]; index: number; order: Map<CardIid, number> } | null = null;

  const root = el('div', 'cb');
  root.setAttribute('role', 'dialog');
  const frame = el('div', 'cb-frame');
  root.append(frame);

  const top = el('header', 'cb-top');
  const mid = el('div', 'cb-mid');
  // The player's side on the left, the enemy's on the right.
  const unitSide = el('aside', 'cb-units');
  const board = el('div', 'cb-board');
  const enemySide = el('aside', 'cb-enemies');
  // The beats never take a tap: any tap anywhere skips them and still lands.
  const banner = el('div', 'cb-banner');
  banner.setAttribute('aria-live', 'polite');
  // Part E: the enemy roster on top, the board across the screen, the units below it.
  mid.append(board, banner);
  const hand = el('div', 'cb-hand');
  const actions = el('footer', 'cb-actions');
  const sheet = el('div', 'cb-sheet');
  sheet.hidden = true;
  const inspect = el('div', 'cb-inspect');
  inspect.hidden = true;
  inspect.addEventListener('click', () => (inspect.hidden = true));
  frame.append(top, enemySide, mid, unitSide, hand, actions);
  // The meadow behind everything (the reskin's background), when its file is in.
  const meadow = cardAssetUrl('background-meadow');
  if (meadow) root.style.setProperty('--cb-meadow', `url("${meadow}")`);
  root.append(sheet, inspect);

  const previousOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  host.append(root);
  // A phone's browser bars change the height under the frame, so it refits.
  globalThis.addEventListener('resize', fitFrame);
  globalThis.visualViewport?.addEventListener('resize', fitFrame);

  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    if (!inspect.hidden) inspect.hidden = true;
    else if (!sheet.hidden) sheet.hidden = true;
    else {
      pending = null;
      inspectMode = false;
      render();
    }
  };
  root.addEventListener('keydown', onKey);
  root.addEventListener('pointerdown', () => skipBeats(), true);
  // A click with no pointer before it, from a keyboard or a script, skips the
  // playback too, and lands on nothing: the board under it was a step's picture.
  root.addEventListener(
    'click',
    (event) => {
      if (!playback) return;
      event.stopPropagation();
      event.preventDefault();
      skipBeats();
    },
    true,
  );

  function start(nextSeed: string): void {
    seed = nextSeed;
    if (options.run) {
      state = options.run.state;
      log = JSON.parse(JSON.stringify(options.run.log)) as BattleLog;
      seed = state.seed;
      encounterId = state.encounterId;
    } else {
      const created = createBattle(encounterId, seed);
      if (!created.ok) return;
      state = created.state;
      log = newLog(seed, encounterId, state.deckId);
    }
    pending = null;
    placing = null;
    filter = null;
    inspectMode = false;
    message = '';
    rounds = [];
    sheet.hidden = true;
    skipBeats();
    render();
  }

  function act(action: Action): boolean {
    const result = step(state, action);
    if (!result.ok) {
      message = CARD_COPY.reasons[result.reason as keyof typeof CARD_COPY.reasons] ?? result.reason;
      render();
      return false;
    }
    const before = state;
    state = result.state;
    log.actions.push(action);
    options.run?.onAction(action);
    pending = null;
    placing = null;
    message = '';
    // End Turn clears the filter, and so does the filtered unit fainting.
    if (action.type === 'commit' || (filter && state.units.find((u) => u.id === filter)?.fainted)) filter = null;
    if (action.type === 'commit') {
      const record = { round: before.round, before, steps: roundSteps(before, result.events, state), events: result.events, after: state };
      rounds.push(record);
      if (playRound(record)) return true;
    }
    render();
    if (state.phase !== 'plan' && state.phase !== 'deploy') openSheet();
    return true;
  }

  // ---------------------------------------------------------------- taps

  function tapCard(card: HandCardView): void {
    if (inspectMode) {
      inspectMode = false;
      showInspect(card);
      render();
      return;
    }
    if (state.phase === 'deploy') {
      message = CARD_COPY.deployHint;
      render();
      return;
    }
    if (state.phase !== 'plan') return;
    if (card.planned) {
      const index = state.plan.findIndex((p) => p.card === card.iid);
      if (index >= 0) act({ type: 'unselect', planIndex: index });
      return;
    }
    if (pending?.card === card.iid) {
      pending = null;
      render();
      return;
    }
    if (!card.playable) {
      message = card.reason ? CARD_COPY.reasons[card.reason] : '';
      pending = null;
      render();
      return;
    }
    // The filter already names who plays it.
    if (filter && card.players.includes(filter)) {
      begin(card.iid, filter);
      return;
    }
    // A Neutral always asks who plays it, even when only one unit can: placing
    // it unasked reads as the card belonging to that unit.
    if (card.owner === 'neutral' || card.players.length > 1) {
      pending = { card: card.iid, stage: 'assign', units: card.players, tiles: [], blocked: card.blocked };
      message = [CARD_COPY.pickUnit, ...blockedLines(card.blocked)].join(' · ');
      render();
      return;
    }
    begin(card.iid, card.players[0]!);
  }

  function begin(card: CardIid, unit: UnitId): void {
    const view = findCard(card);
    if (!view) return;
    const choices = choicesFor(state, card, unit);
    switch (view.needs) {
      case 'none':
        act({ type: 'select', card, unit });
        return;
      case 'unit':
        pending = { card, unit, stage: 'unit', units: choices.units, tiles: [], friendly: friendlyFireFor(state, card, unit, choices) };
        message = pending.friendly!.length > 0 ? CARD_COPY.pickTargetAllies : CARD_COPY.pickTarget;
        break;
      case 'tile':
        pending = {
          card,
          unit,
          stage: 'tile',
          units: [],
          tiles: choices.tiles,
          intercepts: intercepts(view, unit, choices.tiles),
          friendly: friendlyFireFor(state, card, unit, choices),
        };
        message =
          pending.intercepts!.length > 0 ? CARD_COPY.pickTileBlock : pending.friendly!.length > 0 ? CARD_COPY.pickTileAllies : CARD_COPY.pickTile;
        break;
      case 'unitThenTile':
        pending = { card, unit, stage: 'unit', units: choices.units, tiles: [] };
        message = CARD_COPY.pickAlly;
        break;
    }
    render();
  }

  /** `B, C: Not enough MP`, one line per reason. */
  function blockedLines(blocked: HandCardView['blocked']): string[] {
    const byReason = new Map<string, UnitId[]>();
    for (const { unit, block } of blocked) byReason.set(CARD_COPY.reasons[block], [...(byReason.get(CARD_COPY.reasons[block]) ?? []), unit]);
    return [...byReason].map(([reason, units]) => CARD_COPY.cannotPlay(units.join(', '), reason));
  }

  function tapTarget(id: TargetId): boolean {
    // Inspect mode: an enemy shows its entry.
    if (inspectMode) {
      const enemy = viewOf(state).enemies.find((e) => e.id === id);
      if (!enemy) return false;
      inspectMode = false;
      showEnemyInspect(enemy);
      render();
      return true;
    }
    if (state.phase === 'deploy') {
      if (!state.units.some((u) => u.id === id)) return false;
      placing = placing === id ? null : (id as UnitId);
      message = placing ? CARD_COPY.placeUnit(placing) : '';
      render();
      return true;
    }
    // With nothing being chosen, a unit's panel or token filters the hand to it; again, it clears.
    if (!pending && state.phase === 'plan' && !inspectMode) {
      const unit = state.units.find((u) => u.id === id && !u.fainted);
      if (!unit) return false;
      filter = filter === unit.id ? null : unit.id;
      message = '';
      render();
      return true;
    }
    const blocked = pending?.stage === 'assign' ? pending.blocked?.find((b) => b.unit === id) : undefined;
    if (blocked) {
      message = blockedLines([blocked])[0]!;
      render();
      return true;
    }
    if (!pending || !pending.units.includes(id)) return false;
    if (pending.stage === 'assign') {
      begin(pending.card, id as UnitId);
      return true;
    }
    if (pending.stage === 'unit') {
      const view = findCard(pending.card);
      if (view?.needs === 'unitThenTile') {
        const tiles = choicesFor(state, pending.card, pending.unit!, id).tiles;
        pending = { ...pending, stage: 'tile', ally: id, units: [], tiles, intercepts: intercepts(view, pending.unit!, tiles, id) };
        message = pending.intercepts!.length > 0 ? CARD_COPY.pickTileBlock : CARD_COPY.pickTile;
        render();
      } else act({ type: 'select', card: pending.card, unit: pending.unit!, choice: { unit: id } });
      return true;
    }
    return false;
  }

  function tapTile(tile: TileView): void {
    if (state.phase === 'deploy') {
      const home = viewOf(state).deployTiles.some((t) => samePos(t, tile.pos));
      const own = placing !== null && samePos(state.units.find((u) => u.id === placing)?.pos, tile.pos);
      // A picked unit goes to any other home tile, swapping with a unit there.
      if (placing !== null && home && !own) act({ type: 'place', unit: placing, tile: tile.pos });
      else if (tile.occupant?.kind === 'unit') tapTarget(tile.occupant.id);
      else {
        placing = null;
        message = '';
        render();
      }
      return;
    }
    if (pending?.stage === 'tile' && pending.tiles.some((t) => samePos(t, tile.pos))) {
      const choice = pending.ally !== undefined ? { unit: pending.ally, tile: tile.pos } : { tile: tile.pos };
      act({ type: 'select', card: pending.card, unit: pending.unit!, choice });
      return;
    }
    if (tile.occupant && tapTarget(tile.occupant.id)) return;
    if (pending) {
      pending = null;
      message = '';
      render();
    }
  }

  /** Only a Move can step in front of a Strike; any other tile choice has none. */
  function intercepts(card: HandCardView, unit: UnitId, tiles: Pos[], ally?: TargetId): Intercept[] {
    const moves = card.effects.some((e) => e.k === 'move' || e.k === 'grantMove');
    return moves ? interceptsFor(state, card.iid, unit, tiles, ally) : [];
  }

  function findCard(iid: CardIid): HandCardView | undefined {
    return viewOf(state).hand.flatMap((g) => g.cards).find((c) => c.iid === iid);
  }

  // --------------------------------------------------------------- beats

  /**
   * Play a round back, step by step. `false` when there is nothing to play or
   * motion is reduced, and the caller draws the final state itself.
   */
  function playRound(record: RoundRecord): boolean {
    skipBeats();
    const steps = record.steps.filter((step) => !step.quiet);
    if (steps.length === 0 || reducedMotion()) return false;
    const order = new Map(record.before.plan.map((play, index) => [play.card, index + 1]));
    playback = { steps, index: 0, order };
    const next = (): void => {
      render();
      const shown = playback!.steps[playback!.index]!;
      beatTimer = setTimeout(() => {
        playback!.index++;
        if (playback!.index < playback!.steps.length) next();
        else skipBeats();
      }, STEP_MS[shown.kind]);
    };
    next();
    return true;
  }

  /** End any playback: the board shows the state the round left. */
  function skipBeats(): void {
    if (beatTimer !== null) clearTimeout(beatTimer);
    beatTimer = null;
    delete banner.dataset['on'];
    banner.replaceChildren();
    if (!playback) return;
    playback = null;
    render();
    if (state.phase !== 'plan' && state.phase !== 'deploy') openSheet();
  }

  /** The step's banner, and its motion on the board and the panels just drawn. */
  function decorate(step: Step): void {
    const at = playback!.steps.indexOf(step) + 1;
    banner.replaceChildren(
      el('span', 'cb-banner-count', CARD_COPY.log.step(at, playback!.steps.length)),
      el('span', 'cb-banner-title', step.title),
      ...step.lines.map((line) => el('span', 'cb-banner-line', line)),
    );
    banner.dataset['on'] = 'true';
    banner.dataset['kind'] = step.kind;

    const tileAt = (pos: Pos): HTMLElement | null => board.querySelector(`.cb-tile[data-lane="${pos.lane}"][data-col="${pos.col}"]`);
    const tokenOf = (id: string): HTMLElement | null => board.querySelector(`.cb-token[data-id="${id}"]`);
    const panelOf = (id: string): HTMLElement | null => root.querySelector(`.cb-panel[data-id="${id}"]`);
    if (step.actor !== undefined) {
      tokenOf(step.actor)?.setAttribute('data-anim', 'act');
      panelOf(step.actor)?.setAttribute('data-anim', 'act');
    }
    if (step.act && step.act !== 'none' && step.act !== 'shield') {
      for (const pos of step.tiles) tileAt(pos)?.setAttribute('data-flash', step.act);
    }
    for (const hit of step.hits) {
      tokenOf(hit.id)?.setAttribute('data-anim', 'hit');
      panelOf(hit.id)?.setAttribute('data-anim', 'hit');
      const tile = hit.pos ? tileAt(hit.pos) : null;
      const float = el('span', 'cb-float', hit.hp > 0 ? `-${hit.hp}` : `${CARD_COPY.shieldShort} -${hit.blocked}`);
      float.dataset['hp'] = String(hit.hp > 0);
      tile?.append(float);
    }
    for (const move of step.moves) {
      const token = tokenOf(move.id);
      const from = tileAt(move.from);
      const to = tileAt(move.to);
      if (!token || !from || !to || typeof token.animate !== 'function') continue;
      const a = from.getBoundingClientRect();
      const b = to.getBoundingClientRect();
      token.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: 'none' }], {
        duration: 320,
        easing: 'ease-out',
      });
    }
  }

  // -------------------------------------------------------------- render

  function render(): void {
    const shown = playback?.steps[playback.index];
    const view = viewOf(shown?.state ?? state);
    renderTop(view);
    renderBoard(view);
    renderPanels(view);
    renderHand(view);
    renderActions(view);
    fitLabels(frame);
    if (shown) decorate(shown);
    fitFrame();
  }

  /**
   * Fit the frame to the screen's height, so nothing is cut off above or
   * below it. The 390-wide layout is about 820px tall, more than an iPhone's
   * Safari shows between its bars. The board's seven rows give the height
   * back first, from 52px down to 46px, which keeps every tile a 46px target
   * and costs no fact. Only a screen shorter than that scales the whole frame
   * down, the same everywhere, rather than clip a row of it.
   */
  function fitFrame(): void {
    frame.style.removeProperty('--cb-row');
    frame.style.removeProperty('transform');
    // Unrounded heights: a frame a fraction of a pixel over is still cut.
    const room = root.getBoundingClientRect().height;
    const over = frame.getBoundingClientRect().height - room;
    if (room <= 0 || over <= 0) return;
    const give = Math.min(ROW_GIVE, Math.ceil(over / BOARD_ROWS));
    frame.style.setProperty('--cb-row', `${ROW - give}px`);
    const height = frame.getBoundingClientRect().height;
    if (height > room) frame.style.transform = `scale(${room / height})`;
  }

  /** A planned card's place in the order the plan resolves, from 1. */
  function orderOf(card: CardIid): number | undefined {
    if (playback) return playback.order.get(card);
    const index = state.plan.findIndex((play) => play.card === card);
    return index >= 0 ? index + 1 : undefined;
  }

  function renderTop(view: BattleView): void {
    const status = el('div', 'cb-status');
    status.append(
      el('span', 'cb-round', view.waves > 1 ? `${CARD_COPY.wave(view.wave + 1, view.waves)} · ${CARD_COPY.round} ${view.round}` : `${CARD_COPY.round} ${view.round}`),
      el('span', 'cb-piles', `${CARD_COPY.draw} ${view.piles.draw} · ${CARD_COPY.discard} ${view.piles.discard}`),
    );
    const idle = state.phase === 'deploy' ? CARD_COPY.deployHint : graceShowing(view) ? CARD_COPY.graceBoard : '';
    const note = el('div', 'cb-note', message || (inspectMode ? CARD_COPY.inspectHint : idle));
    top.replaceChildren(status, note, button('cb-btn cb-exit', options.run ? RUN_COPY.inBattle.toRun : CARD_COPY.exit, () => close()));
  }

  /** Round 1 under opening grace, with an enemy it held back: the note says so (A7). */
  function graceShowing(view: BattleView): boolean {
    return RULES.openingGrace && view.phase === 'plan' && view.round === 1 && view.enemies.some((e) => !e.fast && !e.dead);
  }

  function renderBoard(view: BattleView): void {
    const placingFrom = placing ? state.units.find((u) => u.id === placing)?.pos : null;
    const placeTiles = placingFrom ? view.deployTiles.filter((t) => !samePos(t, placingFrom)) : [];
    const choosing = pending?.stage === 'tile' || placeTiles.length > 0;
    const own = ownAttacks(view);
    // Every planned card's target holds a reticle, as a target being picked does.
    const held = new Set(view.previews.flatMap((p) => p.targets));
    const warned = allyWarnings(view);
    const nodes: HTMLElement[] = [];
    // Enemy backline at the top: the last column first. Lanes left to right.
    for (let col = RULES.board.cols; col >= 1; col--) {
      for (let lane = 1; lane <= RULES.board.lanes; lane++) {
        const tile = view.tiles.find((t) => t.pos.lane === lane && t.pos.col === col)!;
        const node = el('button', `cb-tile cb-tile--${tile.zone}`);
        node.type = 'button';
        node.dataset['lane'] = String(lane);
        node.dataset['col'] = String(col);
        node.append(cardAsset(ZONE_TILE[tile.zone], 'fill'));
        const selectable = choosing && (pending?.tiles ?? placeTiles).some((t) => samePos(t, tile.pos));
        const acts = threatActs(tile);
        for (const act of acts) node.append(threatLayer(tile, act));
        const mine = own.filter((a) => samePos(a.pos, tile.pos));
        for (const act of THREAT_ORDER_ALL) {
          const hits = mine.filter((a) => a.act === act);
          if (hits.length === 0) continue;
          const wash = el('span', 'cb-ov cb-attack');
          wash.dataset['act'] = act;
          wash.dataset['owner'] = hits[0]!.unit;
          if (hits.some((a) => a.stop)) wash.dataset['stop'] = 'true';
          if (hits.every((a) => a.pending)) wash.dataset['pending'] = 'true';
          node.append(wash);
        }
        if (selectable) node.append(layer('tile-overlay-selectable', 'cb-ov cb-ov--selectable'));
        else if (choosing) node.append(layer('tile-overlay-unavailable', 'cb-ov cb-ov--unavailable'));
        if (tile.planGhost) {
          node.append(layer('tile-overlay-selected', 'cb-ov cb-ov--selected'));
          const ghost = el('span', 'cb-ghost', tile.planGhost);
          ghost.prepend(cardAsset('marker-ring-destination', { width: 48, height: 48 }));
          node.append(ghost);
        }
        const block = pending?.intercepts?.find((i) => samePos(i.pos, tile.pos));
        if (selectable && block) node.append(interceptMark());
        const risky = selectable ? pending?.friendly?.find((f) => samePos(f.tile, tile.pos)) : undefined;
        if (risky) node.append(friendlyMark(risky));
        // A big enemy's token is drawn once, from its anchor tile, over its whole footprint.
        if (tile.occupant && (tile.occupant.kind === 'unit' || tile.occupant.anchor)) node.append(token(view, tile, held, warned));
        // Each tile is its own stacking context, so the tile a big token is drawn from sits over its neighbours.
        if (tile.occupant?.kind === 'enemy' && tile.occupant.anchor && ENEMIES[tile.occupant.def].size) node.dataset['big'] = 'true';
        if (acts.length > 0) node.append(threatChips(tile));
        if (mine.length > 0) node.append(attackChips(mine));
        node.addEventListener('click', () => tapTile(tile));
        nodes.push(node);
      }
    }
    board.replaceChildren(...nodes);
  }

  /** The kinds of attack lighting a tile, each once, in a fixed order. */
  function threatActs(tile: TileView): TileThreat['act'][] {
    return THREAT_ORDER.filter((act) => tile.threats.some((t) => t.act === act));
  }

  /**
   * One kind's highlight. Pierce keeps the pack's hatched telegraph and runs a
   * line through the tile; Strike is a solid wash that ends in a bar on the
   * tile where it stops; Slash is a dashed purple wash.
   */
  function threatLayer(tile: TileView, act: TileThreat['act']): HTMLElement {
    const node = act === 'pierce' ? layer('tile-overlay-telegraph', 'cb-ov cb-threat') : el('span', 'cb-ov cb-threat');
    // Scream: hatched in the deeper red with a dotted edge, on every tile touching the pinned boss.
    node.dataset['act'] = act;
    if (act === 'strike' && tile.threats.some((t) => t.act === 'strike' && t.stop)) node.dataset['stop'] = 'true';
    return node;
  }

  /**
   * The player's own telegraph: every planned attack, and the card being
   * chosen. While the player picks who plays an attack, each candidate's
   * footprint shows at once.
   */
  function ownAttacks(view: BattleView): OwnAttack[] {
    const out: OwnAttack[] = [];
    const push = (attack: AttackPreview | null, unit: UnitId, pendingOne: boolean): void => {
      for (const tile of attack?.tiles ?? []) out.push({ pos: tile.pos, act: attack!.act, n: attack!.n, unit, stop: tile.stop, pending: pendingOne });
    };
    for (const preview of view.previews) push(preview.attack, preview.unit, false);
    if (pending) {
      const players = pending.stage === 'assign' ? (pending.units as UnitId[]) : pending.unit ? [pending.unit] : [];
      for (const unit of players) push(previewPlay(state, { card: pending.card, unit }).attack, unit, true);
    }
    return out;
  }

  /**
   * The allies a Blast would hit (R14), with the most it would take: every
   * planned Blast's, and while one is being aimed, every choice it could take.
   */
  function allyWarnings(view: BattleView): Map<UnitId, number> {
    const out = new Map<UnitId, number>();
    const add = (unit: UnitId, n: number): void => {
      out.set(unit, Math.max(out.get(unit) ?? 0, n));
    };
    for (const preview of view.previews) for (const hit of preview.allies) add(hit.unit, hit.n);
    for (const choice of pending?.friendly ?? []) for (const hit of choice.allies) add(hit.unit, hit.n);
    return out;
  }

  /** A Blast centre that would hit an ally: the allies' letters, in the warning colour. */
  function friendlyMark(choice: FriendlyFire): HTMLElement {
    return el('span', 'cb-friendly', choice.allies.map((a) => a.unit).join(''));
  }

  /** A Move destination that steps in front of a Strike: a shield, in the player's colour. */
  function interceptMark(): HTMLElement {
    const mark = el('span', 'cb-intercept');
    mark.append(cardAsset('icon-shield', { width: 26, height: 26 }));
    return mark;
  }

  /** The player's attacks on a tile, as chips in the tile's lower corner. */
  function attackChips(attacks: OwnAttack[]): HTMLElement {
    const chips = el('span', 'cb-attack-chips');
    for (const attack of attacks) {
      const chip = el('span', 'cb-attack-chip');
      chip.dataset['act'] = attack.act;
      chip.dataset['owner'] = attack.unit;
      chip.append(cardAsset(INTENT_ICON[attack.act]!, { width: 11, height: 11 }), el('span', '', String(attack.n)));
      chips.append(chip);
    }
    return chips;
  }

  /** Each attack on a tile as its keyword's icon and number and the enemy it is from, in the tile's corner. */
  function threatChips(tile: TileView): HTMLElement {
    const chips = el('span', 'cb-threat-chips');
    for (const threat of tile.threats) {
      const chip = el('span', 'cb-threat-chip');
      chip.dataset['act'] = threat.act;
      chip.append(
        cardAsset(INTENT_ICON[threat.act]!, { width: 11, height: 11 }),
        el('span', '', String(threat.n)),
        el('span', 'cb-threat-from', enemyLabel(threat.enemy)),
      );
      chips.append(chip);
    }
    return chips;
  }

  /** An enemy as its token names it: its name's initial and spawn number. */
  function enemyLabel(id: string): string {
    const enemy = state.enemies.find((e) => e.id === id);
    return enemy ? `${[...nameOf(ENEMIES[enemy.def].name)][0]}${enemyNumber(state, id)}` : id;
  }

  function layer(id: CardAssetId, className: string): HTMLElement {
    const wrap = el('span', className);
    wrap.append(cardAsset(id));
    return wrap;
  }

  function token(view: BattleView, tile: TileView, held: ReadonlySet<TargetId>, warned: ReadonlyMap<UnitId, number>): HTMLElement {
    const occupant = tile.occupant!;
    const isUnit = occupant.kind === 'unit';
    const node = el('span', `cb-token cb-token--${occupant.kind}`);
    node.dataset['id'] = occupant.id;
    if (isUnit) node.dataset['owner'] = occupant.id;
    const pinnedBoss = !isUnit && (view.enemies.find((e) => e.id === occupant.id)?.pinned ?? 0) > 0 && occupant.def === 'colossus';
    const marker = isUnit ? UNIT_MARKER[occupant.id] : pinnedBoss ? 'marker-enemy-colossus-pinned' : (ENEMY_MARKER[occupant.def] ?? 'marker-enemy-base');
    // A big enemy's marker stretches over its footprint.
    const big = occupant.kind === 'enemy' && !!ENEMIES[occupant.def].size;
    node.append(cardAsset(marker, big ? 'fill' : undefined));
    let label = occupant.id;
    if (!isUnit) {
      const enemy = view.enemies.find((e) => e.id === occupant.id)!;
      label = enemyLabel(occupant.id);
      if (enemy.size.lanes > 1 || enemy.size.cols > 1) node.dataset['size'] = `${enemy.size.lanes}x${enemy.size.cols}`;
      node.append(el('span', 'cb-token-hp', String(enemy.hp)));
      if (enemy.fast) node.append(el('span', 'cb-fast cb-token-fast', CARD_COPY.fast));
    } else {
      const unit = view.units.find((u) => u.id === occupant.id)!;
      node.append(el('span', 'cb-token-hp', String(unit.hp)));
      const warn = warned.get(unit.id);
      if (warn !== undefined) {
        node.dataset['warn'] = 'true';
        node.append(el('span', 'cb-token-warn', `-${warn}`));
      }
    }
    node.append(el('span', 'cb-token-label', label));
    node.setAttribute('aria-label', label);
    if (pending?.unit === occupant.id || pending?.ally === occupant.id || placing === occupant.id) node.append(ring('marker-ring-selected'));
    const picking = !!pending && pending.stage !== 'tile' && pending.units.includes(occupant.id);
    if (picking || held.has(occupant.id)) node.append(ring('marker-reticle'));
    // An enemy whose Target Blast would also hit an ally.
    const risky = picking ? pending?.friendly?.find((f) => f.unit === occupant.id) : undefined;
    if (risky) node.append(friendlyMark(risky));
    return node;
  }

  function ring(id: CardAssetId): HTMLElement {
    const wrap = el('span', 'cb-ring');
    wrap.append(cardAsset(id));
    return wrap;
  }

  function renderPanels(view: BattleView): void {
    const warned = allyWarnings(view);
    enemySide.replaceChildren(
      ...view.enemies.map((enemy, index) => {
        const target = !!pending && pending.stage !== 'tile' && pending.units.includes(enemy.id);
        // Dark, drawn by the stylesheet: the pack's frame is the light player panel.
        const panel = el('div', 'cb-panel cb-panel--enemy');
        panel.dataset['id'] = enemy.id;
        if (enemy.dead) panel.dataset['dead'] = 'true';
        if (target) panel.dataset['target'] = 'true';
        const name = el('div', 'cb-panel-name', `${nameOf(enemy.name)} ${index + 1}`);
        if (enemy.fast) name.append(el('span', 'cb-fast', CARD_COPY.fast));
        panel.append(name);
        // One line, as a unit's: HP, then card shield plus base shield.
        panel.append(statLine(CARD_COPY.hp, `${enemy.hp}/${enemy.maxHp} · ${CARD_COPY.shieldShort} ${enemy.shield}+${enemy.baseShield}`), bar(enemy.hp, enemy.maxHp));
        // Part D: the pin's turns left, and the HP its one stalk comes at.
        if (enemy.pinned > 0) panel.append(el('div', 'cb-boss-line cb-boss-line--pinned', CARD_COPY.pinned(enemy.pinned)));
        else if (enemy.stalkAt !== null) panel.append(el('div', 'cb-boss-line', CARD_COPY.stalkAt(enemy.stalkAt)));
        if (enemy.intent) {
          const pill = el('div', 'cb-pill');
          pill.dataset['act'] = enemy.intent.icon;
          pill.append(cardAsset('pill-badge', 'fill'));
          pill.append(cardAsset(INTENT_ICON[enemy.intent.icon] ?? 'icon-wait', { width: 16, height: 16 }));
          const word =
            enemy.intent.icon === 'none'
              ? CARD_COPY.intentNone
              : `${enemy.intent.label ?? CARD_COPY.keyword[enemy.intent.icon as 'strike']} ${enemy.intent.n}`;
          pill.append(el('span', 'cb-pill-text', word));
          panel.append(pill);
        }
        panel.addEventListener('click', () => tapTarget(enemy.id));
        return panel;
      }),
    );
    unitSide.replaceChildren(
      ...view.units.map((unit) => {
        const target = !!pending && pending.stage !== 'tile' && pending.units.includes(unit.id);
        const panel = el('div', 'cb-panel cb-panel--unit');
        panel.dataset['id'] = unit.id;
        panel.dataset['owner'] = unit.id;
        panel.append(cardAsset('panel-frame', 'fill'));
        if (unit.fainted) panel.dataset['dead'] = 'true';
        if (target) panel.dataset['target'] = 'true';
        if (pending?.unit === unit.id || placing === unit.id) panel.dataset['assigning'] = 'true';
        if (pending?.blocked?.some((b) => b.unit === unit.id)) panel.dataset['blocked'] = 'true';
        if (warned.has(unit.id)) panel.dataset['warn'] = 'true';
        if (filter === unit.id) panel.dataset['filter'] = 'true';
        const portrait = el('span', 'cb-panel-portrait');
        portrait.append(cardAsset(UNIT_PORTRAIT[unit.id], 'fill'));
        panel.append(portrait, el('div', 'cb-panel-name', `${unit.id} ${nameOf(unit.name)}`));
        panel.append(statLine(CARD_COPY.hp, `${unit.hp}/${unit.maxHp} · ${CARD_COPY.shieldShort} ${unit.shield}+${unit.baseShield}`), bar(unit.hp, unit.maxHp));
        const mp = el('div', 'cb-mp');
        mp.append(el('span', 'cb-mp-text', `${CARD_COPY.cost} ${unit.mp - unit.reserved}/${unit.mp}`));
        for (let i = 0; i < unit.mpCap; i++) {
          const pip = cardAsset(i < unit.mp - unit.reserved ? 'pip-filled' : 'pip-empty', { width: 6, height: 6 });
          pip.dataset['on'] = String(i < unit.mp - unit.reserved);
          if (i >= unit.mp) pip.dataset['off'] = 'true';
          mp.append(pip);
        }
        panel.append(mp);
        const slots = el('div', 'cb-slots');
        for (let i = 0; i < unit.slots; i++) {
          const play = unit.planned[i];
          if (play) {
            const slot = el('button', 'cb-slot cb-slot--filled');
            slot.type = 'button';
            slot.append(cardAsset('slot-filled', 'fill'), el('span', 'cb-slot-name', nameOf(play.name)));
            const order = orderOf(play.card);
            if (order !== undefined) slot.append(el('span', 'cb-order cb-slot-order', String(order)));
            slot.addEventListener('click', (event) => {
              event.stopPropagation();
              act({ type: 'unselect', planIndex: play.planIndex });
            });
            slots.append(slot);
          } else {
            const slot = el('span', 'cb-slot cb-slot--empty');
            slot.append(cardAsset('slot-empty', 'fill'));
            slots.append(slot);
          }
        }
        panel.append(slots);
        panel.addEventListener('click', () => tapTarget(unit.id));
        return panel;
      }),
    );
  }

  function bar(value: number, max: number): HTMLElement {
    const track = el('div', 'cb-bar');
    track.append(cardAsset('bar-track', 'fill'));
    const fill = el('span', 'cb-bar-fill');
    fill.style.width = `${max > 0 ? Math.round((Math.max(0, value) / max) * 100) : 0}%`;
    fill.append(cardAsset('bar-fill', 'fill'));
    track.append(fill);
    return track;
  }

  function statLine(label: string, value: string): HTMLElement {
    const line = el('div', 'cb-stat');
    line.append(el('span', 'cb-stat-label', label), el('span', 'cb-stat-value', value));
    return line;
  }

  /** What the unit filter keeps: the cards it has planned, and its own and Neutral cards it can play now. */
  function inFilter(card: HandCardView, unit: UnitId): boolean {
    if (card.planned) return state.plan.find((p) => p.card === card.iid)?.unit === unit;
    return (card.owner === unit || card.owner === 'neutral') && card.players.includes(unit);
  }

  /** The filter's two chips: what it shows, which clears it, and the fold of the rest. */
  function filterChips(unit: UnitId, others: number): HTMLElement {
    const column = el('div', 'cb-filter');
    column.dataset['owner'] = unit;
    const clear = (): void => {
      filter = null;
      render();
    };
    const showing = el('button', 'cb-filter-chip cb-filter-showing');
    showing.type = 'button';
    showing.append(el('span', '', CARD_COPY.filterShowing(unit)), el('span', '', ` · ${CARD_COPY.filterShowAll}`));
    showing.addEventListener('click', clear);
    column.append(showing);
    if (others > 0) {
      const rest = el('button', 'cb-filter-chip cb-filter-other', CARD_COPY.filterOther(others));
      rest.type = 'button';
      rest.addEventListener('click', clear);
      column.append(rest);
    }
    return column;
  }

  function renderHand(view: BattleView): void {
    const all = view.hand.flatMap((group) => group.cards);
    const active = filter !== null && view.phase === 'plan' && !playback ? filter : null;
    const cards = active ? all.filter((card) => inFilter(card, active)) : all;
    // The chip column takes a card's place in the count, so the cards shrink to fit beside it.
    hand.dataset['count'] = String(cards.length + (active ? 1 : 0));
    if (active) hand.dataset['filter'] = active;
    else delete hand.dataset['filter'];
    hand.replaceChildren(
      ...(active ? [filterChips(active, all.length - cards.length)] : []),
      ...cards.map((card) => {
        const node = el('button', 'cb-card');
        node.type = 'button';
        // Player cards in their unit's colour, Neutrals grey, an enemy's grant black.
        node.dataset['owner'] = card.granted ? 'enemy' : card.owner;
        node.dataset['card'] = card.def;
        node.setAttribute('aria-label', [nameOf(card.name), `${card.cost} ${CARD_COPY.cost}`, ...effectLines(card.effects)].join(', '));
        const face = faceOf(card.effects, CARDS[card.def]?.face);
        // The card's illustration sits behind the frame's open art window.
        node.append(cardArt(card.def));
        node.append(cardAsset('card-frame-compact', 'fill'));
        // The owner's colour as the frame's band, and its letter in the badge: colour is never the only signal.
        node.append(ownerBand('card-band-compact'));
        node.append(el('span', 'cb-card-cost', String(card.cost)));
        node.append(el('span', 'cb-card-n', face.n === null ? '' : String(face.n)));
        const field = el('span', 'cb-card-field');
        field.append(cardAsset(face.icon, 'fill'));
        if (face.targeted) field.append(cornerIcon('icon-target', 'cb-card-mark cb-card-mark--target'));
        if (card.uses) {
          // Uses: the keyword's mark and the uses left.
          const mark = cornerIcon('icon-once', 'cb-card-mark cb-card-mark--once');
          mark.append(el('span', 'cb-card-uses', String(card.uses.left)));
          field.append(mark);
        }
        node.append(field);
        node.append(el('span', 'cb-card-name', nameOf(card.name)));
        // A Neutral has a grey frame and no letter.
        if (card.owner !== 'neutral' && !card.granted) {
          const badge = el('span', 'cb-card-badge');
          badge.append(cardAsset('card-badge-corner', 'fill'), el('span', 'cb-card-owner', card.owner));
          node.append(badge);
        }
        const order = card.planned ? orderOf(card.iid) : undefined;
        if (order !== undefined) node.append(el('span', 'cb-order cb-card-order', String(order)));
        if (card.planned || pending?.card === card.iid) {
          node.dataset['selected'] = 'true';
          node.append(layer('card-overlay-selected', 'cb-ov'));
        } else if (!card.playable) {
          node.dataset['unavailable'] = 'true';
          node.append(layer('card-overlay-unavailable', 'cb-ov'));
        }
        wireCard(node, card);
        return node;
      }),
    );
  }

  function wireCard(node: HTMLElement, card: HandCardView): void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pressed = false;
    const cancel = (): void => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
    node.addEventListener('pointerdown', () => {
      pressed = false;
      cancel();
      timer = setTimeout(() => {
        pressed = true;
        showInspect(card);
      }, LONG_PRESS_MS);
    });
    for (const type of ['pointerup', 'pointerleave', 'pointercancel']) node.addEventListener(type, cancel);
    node.addEventListener('contextmenu', (event) => event.preventDefault());
    node.addEventListener('click', () => {
      // The click that ends a long press opened inspect; it never plays the card.
      if (pressed) {
        pressed = false;
        return;
      }
      tapCard(card);
    });
  }

  function showInspect(card: HandCardView): void {
    const face = faceOf(card.effects, CARDS[card.def]?.face);
    const full = el('div', 'cb-full');
    full.dataset['owner'] = card.granted ? 'enemy' : card.owner;
    full.append(cardArt(card.def, 'cb-full-picture'), cardAsset('card-frame-full', 'fill'), ownerBand('card-band-full'));
    full.append(el('div', 'cb-full-cost', String(card.cost)), el('div', 'cb-full-n', face.n === null ? '' : String(face.n)));
    full.append(el('div', 'cb-full-name', nameOf(card.name)));
    const art = el('div', 'cb-full-art');
    art.append(cardAsset(face.icon, 'fill'));
    full.append(art);
    const body = el('div', 'cb-full-body');
    body.append(el('div', 'cb-full-owner', card.owner === 'neutral' ? CARD_COPY.neutral : `${card.owner} ${nameOf(UNITS[card.owner].name)}`));
    for (const line of effectLines(card.effects)) body.append(el('div', 'cb-full-line', line));
    if (card.uses) body.append(el('div', 'cb-full-line', CARD_COPY.uses(card.uses.left, card.uses.of)));
    if (card.retain) body.append(el('div', 'cb-full-line', CARD_COPY.retain));
    if (CARDS[card.def]?.equipment) body.append(el('div', 'cb-full-rule', RUN_COPY.inBattle.equipment));
    const allies = blastAlliesLine(card.effects);
    if (allies) body.append(el('div', 'cb-full-rule', allies));
    if (card.reason) body.append(el('div', 'cb-full-reason', CARD_COPY.reasons[card.reason]));
    if (card.owner !== 'neutral' && !card.granted) {
      const badge = el('span', 'cb-full-badge');
      badge.append(cardAsset('card-badge-corner', 'fill'), el('span', 'cb-card-owner', card.owner));
      full.append(badge);
    }
    // The frame has no room for text beyond its name: the card's words sit under it.
    const sheetOf = el('div', 'cb-full-wrap');
    sheetOf.append(full, body);
    inspect.replaceChildren(sheetOf);
    inspect.hidden = false;
  }

  /** A card's illustration, or nothing for a card the pack has none for. */
  function cardArt(def: string, className = 'cb-card-picture'): HTMLElement {
    const wrap = el('span', className);
    const id = `art-${CARDS[def]?.art ?? def}` as CardAssetId;
    if ((CARD_ASSET_GROUPS.art.ids as readonly string[]).includes(id)) wrap.append(cardAsset(id, 'fill'));
    return wrap;
  }

  /** The owner band: the pack's white mask, tinted in the owner's colour by the stylesheet. */
  function ownerBand(id: 'card-band-compact' | 'card-band-full'): HTMLElement {
    const band = el('span', 'cb-card-edge');
    const url = cardAssetUrl(id);
    if (url) {
      band.dataset['mask'] = 'true';
      band.style.setProperty('--cb-band', `url("${url}")`);
    }
    return band;
  }

  /** A Blast's friendly fire, as the rule table has it (R14). */
  function blastAlliesLine(effects: readonly Effect[]): string | null {
    if (!effects.some((e) => e.k === 'blast')) return null;
    switch (RULES.blastFriendlyFire) {
      case 'alliesExceptCaster':
        return CARD_COPY.rule.blastAllies;
      case 'allies':
        return CARD_COPY.rule.blastAlliesCaster;
      case 'none':
        return null;
    }
  }

  /** An enemy's Inspect entry: its numbers, its grade, and how it opens. */
  function showEnemyInspect(enemy: BattleView['enemies'][number]): void {
    const card = el('div', 'cb-enemy-card');
    card.append(el('div', 'cb-enemy-card-name', `${nameOf(enemy.name)} ${enemyNumber(state, enemy.id)}`));
    const def = ENEMIES[enemy.def];
    card.append(el('div', 'cb-enemy-card-line', `${CARD_COPY.enemyStats(def.hp, def.baseShield)} · ${CARD_COPY.grade(def.grade)}`));
    if (enemy.fast) card.append(el('div', 'cb-enemy-card-rule', CARD_COPY.rule.fast));
    else if (RULES.openingGrace) card.append(el('div', 'cb-enemy-card-rule', CARD_COPY.rule.grace));
    if (def.stalks) card.append(el('div', 'cb-enemy-card-rule', CARD_COPY.bossRules.stalk));
    if (def.boss) card.append(el('div', 'cb-enemy-card-rule', CARD_COPY.bossRules.pin));
    inspect.replaceChildren(card);
    inspect.hidden = false;
    fitLabels(inspect);
  }

  function cornerIcon(id: CardAssetId, className: string): HTMLElement {
    const wrap = el('span', className);
    wrap.append(cardAsset(id, 'fill'));
    return wrap;
  }

  function renderActions(view: BattleView): void {
    const undo = pending
      ? button('cb-btn', CARD_COPY.cancel, () => {
          pending = null;
          message = '';
          render();
        })
      : button('cb-btn', CARD_COPY.undo, () => act({ type: 'unselect', planIndex: state.plan.length - 1 }));
    if (!pending && state.plan.length === 0) undo.disabled = true;
    const inspectButton = button('cb-btn', CARD_COPY.inspect, () => {
      inspectMode = !inspectMode;
      pending = null;
      render();
    });
    inspectButton.querySelector('.cb-btn-label')!.prepend(cardAsset('icon-inspect', { width: 16, height: 16 }));
    if (inspectMode) inspectButton.dataset['on'] = 'true';
    const deploying = view.phase === 'deploy';
    const end = deploying
      ? button('cb-btn cb-btn--primary', CARD_COPY.start, () => act({ type: 'start' }))
      : button('cb-btn cb-btn--primary', CARD_COPY.endTurn, () => act({ type: 'commit' }));
    end.querySelector('.cb-btn-label')!.prepend(cardAsset('icon-end-turn', { width: 16, height: 16 }));
    end.disabled = !deploying && !view.canCommit;
    actions.replaceChildren(undo, inspectButton, end, button('cb-btn', CARD_COPY.menu, () => openSheet()));
  }

  function openSheet(): void {
    const panel = el('div', 'cb-sheet-panel');
    const heading =
      state.phase === 'plan' || state.phase === 'deploy' ? CARD_COPY.title : `${state.phase === 'won' ? CARD_COPY.won : CARD_COPY.lost} · ${CARD_COPY.round} ${state.round}`;
    panel.append(el('div', 'cb-sheet-title', heading), el('div', 'cb-seed', `${CARD_COPY.seed} ${seed}`));
    const copyArea = el('textarea', 'cb-log');
    copyArea.readOnly = true;
    copyArea.hidden = true;
    const status = el('div', 'cb-sheet-status');
    // Plays the last round again over the board it began from; the state itself never rewinds.
    const last = rounds.at(-1);
    const replay = button('cb-btn', CARD_COPY.replayRound, () => {
      if (!last) return;
      sheet.hidden = true;
      playRound(last);
    });
    replay.disabled = !last;
    if (options.run) {
      // A run's battle: no restart, no new seed, no other scenario. Its end hands back to the run.
      const ended = state.phase === 'won' || state.phase === 'lost';
      panel.append(
        ...(ended ? [button('cb-btn cb-btn--primary', state.phase === 'won' ? RUN_COPY.inBattle.continue : RUN_COPY.inBattle.runOver, () => close())] : []),
        button('cb-btn', CARD_COPY.copyLog, () => copyLog(status, copyArea)),
        button('cb-btn', CARD_COPY.roundLog, () => openRoundLog()),
        botTurn(),
        settings(),
        replay,
        ...(ended ? [] : [button('cb-btn', CARD_COPY.close, () => (sheet.hidden = true))]),
        status,
        copyArea,
      );
      sheet.replaceChildren(panel);
      sheet.hidden = false;
      fitLabels(sheet);
      return;
    }
    panel.append(
      button('cb-btn', CARD_COPY.restart, () => start(seed)),
      button('cb-btn', CARD_COPY.newSeed, () => start(newSeed())),
      button('cb-btn', CARD_COPY.copyLog, () => copyLog(status, copyArea)),
      button('cb-btn', CARD_COPY.roundLog, () => openRoundLog()),
      botTurn(),
      scenarios(),
      settings(),
      replay,
      button('cb-btn', CARD_COPY.close, () => (sheet.hidden = true)),
      button('cb-btn', CARD_COPY.exit, () => close()),
      status,
      copyArea,
    );
    sheet.replaceChildren(panel);
    sheet.hidden = false;
    fitLabels(sheet);
  }

  /** The battle log onto the clipboard, or into the text box when the clipboard is out of reach. */
  function copyLog(status: HTMLElement, copyArea: HTMLTextAreaElement): void {
    const text = JSON.stringify(log);
    const fallback = (): void => {
      copyArea.value = text;
      copyArea.hidden = false;
      copyArea.select();
      status.textContent = CARD_COPY.copyFailed;
    };
    const clipboard = globalThis.navigator?.clipboard;
    if (!clipboard) return fallback();
    clipboard.writeText(text).then(() => (status.textContent = CARD_COPY.copied), fallback);
  }

  /** The guard bot places the units, or plays this round on top of the plan so far. */
  function botTurn(): HTMLButtonElement {
    const live = state.phase === 'deploy' || state.phase === 'plan';
    const node = button('cb-btn', CARD_COPY.botTurn, () => {
      if (!live) return;
      sheet.hidden = true;
      pending = null;
      placing = null;
      const actions = state.phase === 'deploy' ? planDeploy(state).actions : planRound(state).actions;
      for (const action of actions) if (!act(action)) break;
    });
    node.disabled = !live;
    return node;
  }

  /** One button per scenario; a tap starts it on the current seed. */
  function scenarios(): HTMLElement {
    const list = el('div', 'cb-scenarios');
    list.append(el('div', 'cb-scenarios-title', CARD_COPY.scenario));
    for (const encounter of Object.values(SCENARIOS)) {
      const grade = CARD_COPY.grade(gradeTotal(encounter));
      const pick = button('cb-btn cb-scenario', nameOf(encounter.name), () => {
        encounterId = encounter.id;
        start(seed);
      });
      pick.querySelector('.cb-btn-label')!.append(el('span', 'cb-scenario-grade', grade));
      pick.setAttribute('aria-label', `${nameOf(encounter.name)}, ${grade}`);
      pick.title = nameOf(encounter.blurb);
      if (encounter.id === encounterId) pick.dataset['on'] = 'true';
      list.append(pick);
    }
    return list;
  }

  /**
   * The two settings: the language, each named in itself so it can always be
   * found again, and the palette. A tap applies at once and redraws the menu
   * in the new words.
   */
  function settings(): HTMLElement {
    const box = el('div', 'cb-settings');
    box.append(el('div', 'cb-scenarios-title', CARD_COPY.settings.language));
    const languages = el('div', 'cb-settings-languages');
    for (const language of CARD_LANGUAGES) {
      const pick = button('cb-btn cb-setting', LANGUAGE_NAMES[language], () => choose({ ...prefs, language }));
      pick.lang = language;
      if (language === prefs.language) pick.dataset['on'] = 'true';
      languages.append(pick);
    }
    box.append(languages, el('div', 'cb-scenarios-title', CARD_COPY.settings.colours));
    const palettes = el('div', 'cb-settings-palettes');
    const word: Record<CardPalette, string> = { standard: CARD_COPY.settings.paletteStandard, tritan: CARD_COPY.settings.paletteTritan };
    for (const palette of CARD_PALETTES) {
      const pick = button('cb-btn cb-setting', word[palette], () => choose({ ...prefs, palette }));
      if (palette === prefs.palette) pick.dataset['on'] = 'true';
      palettes.append(pick);
    }
    box.append(palettes);
    return box;
  }

  function choose(next: CardPrefs): void {
    const relabel = next.language !== cardLanguage();
    prefs = next;
    saveCardPrefs(prefs);
    applyPrefs();
    if (relabel) {
      // The rounds already played are told again in the new language.
      rounds = rounds.map((r) => ({ ...r, steps: roundSteps(r.before, r.events, r.after) }));
      message = '';
    }
    render();
    openSheet();
  }

  /** Every render after this one draws in the chosen words and colours. */
  function applyPrefs(): void {
    setCardLanguage(prefs.language);
    root.lang = prefs.language;
    root.dataset['palette'] = prefs.palette;
    root.setAttribute('aria-label', CARD_COPY.title);
  }

  /** Every committed round, step by step in the order it resolved, numbered as the playback numbers it. */
  function openRoundLog(): void {
    const panel = el('div', 'cb-sheet-panel cb-sheet-panel--log');
    panel.append(el('div', 'cb-sheet-title', CARD_COPY.roundLog));
    const list = el('div', 'cb-roundlog');
    if (rounds.length === 0) list.append(el('div', 'cb-roundlog-empty', CARD_COPY.logEmpty));
    for (const record of rounds) {
      list.append(el('div', 'cb-roundlog-round', CARD_COPY.log.round(record.round)));
      const steps = el('ol', 'cb-roundlog-steps');
      for (const step of record.steps) {
        const item = el('li', 'cb-roundlog-step');
        item.dataset['kind'] = step.kind;
        if (step.quiet) item.dataset['quiet'] = 'true';
        item.append(el('span', 'cb-roundlog-title', step.title));
        for (const line of step.lines) item.append(el('span', 'cb-roundlog-line', line));
        steps.append(item);
      }
      list.append(steps);
    }
    panel.append(list, button('cb-btn', CARD_COPY.back, () => openSheet()));
    sheet.replaceChildren(panel);
    sheet.hidden = false;
    list.scrollTop = list.scrollHeight;
  }

  function close(): void {
    skipBeats();
    root.removeEventListener('keydown', onKey);
    globalThis.removeEventListener('resize', fitFrame);
    globalThis.visualViewport?.removeEventListener('resize', fitFrame);
    root.remove();
    document.documentElement.style.overflow = previousOverflow;
    options.onExit?.();
  }

  applyPrefs();
  start(seed);
  root.tabIndex = -1;
  root.focus();
  return { root, close };
}
