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
 * Outside the design bible by the author's ruling
 * (`docs/spec/gymrun-card-battle-engine-rulings.md`). It writes nothing into
 * the run save.
 */
import './sandbox.css';

import { CARD_COPY } from '../../cardData/copy';
import { UNITS } from '../../cardData/units';
import { createBattle } from '../../core/cards/create';
import type { Effect, Pos } from '../../core/cards/defs';
import { choicesFor } from '../../core/cards/legal';
import { newLog, type BattleLog } from '../../core/cards/log';
import { interceptsFor, previewPlay, type AttackPreview, type Intercept } from '../../core/cards/preview';
import type { Action, BattleState, CardIid, TargetId, UnitId } from '../../core/cards/state';
import { step } from '../../core/cards/step';
import { viewOf, type BattleView, type HandCardView, type TileThreat, type TileView } from '../../core/cards/view';
import { samePos } from '../../core/cards/zones';
import { newSeed } from '../seed';
import { cardAsset, type CardAssetId } from './assets';
import { roundSteps, type RoundRecord, type Step } from './playback';

export interface Sandbox {
  root: HTMLElement;
  close(): void;
}

export interface SandboxOptions {
  seed?: string;
  onExit?: () => void;
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
}

const ENCOUNTER = 'test';
const LONG_PRESS_MS = 450;
/** How long each kind of playback step holds. */
const STEP_MS: Record<Step['kind'], number> = { card: 900, enemy: 900, move: 600, next: 900, round: 700, end: 900 };

const UNIT_MARKER: Record<UnitId, CardAssetId> = { A: 'marker-unit-commander', B: 'marker-unit-gunner', C: 'marker-unit-dasher' };
const ENEMY_MARKER: Record<string, CardAssetId> = { drone: 'marker-enemy-drone', lancer: 'marker-enemy-lancer' };
const INTENT_ICON: Record<string, CardAssetId> = {
  strike: 'icon-strike',
  pierce: 'icon-pierce',
  slash: 'icon-slash',
  blast: 'icon-blast',
  shield: 'icon-shield',
  none: 'icon-wait',
};
const THREAT_ORDER: readonly TileThreat['act'][] = ['pierce', 'slash', 'strike'];
const THREAT_ORDER_ALL: readonly AttackPreview['act'][] = ['pierce', 'slash', 'blast', 'strike'];

interface OwnAttack {
  pos: Pos;
  act: AttackPreview['act'];
  n: number;
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
  // The pack's three button states; the stylesheet shows the one that applies.
  for (const state of ['button-default', 'button-pressed', 'button-unavailable'] as const) {
    const layer = cardAsset(state, 'fill');
    layer.dataset['state'] = state;
    node.append(layer);
  }
  node.append(el('span', 'cb-btn-label', label));
  node.addEventListener('click', onTap);
  return node;
}

/** The icon and number a card's face shows: its first effect that has one. */
export function faceOf(effects: readonly Effect[]): { icon: CardAssetId; n: number | null; targeted: boolean } {
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
      default:
        break;
    }
  }
  return { icon: 'icon-wait', n: null, targeted };
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
      default:
        break;
    }
  }
  return lines;
}

export function openSandbox(host: HTMLElement, options: SandboxOptions = {}): Sandbox {
  let seed = options.seed ?? newSeed();
  let state!: BattleState;
  let log!: BattleLog;
  let pending: Pending | null = null;
  let inspectMode = false;
  let message = '';
  let beatTimer: ReturnType<typeof setTimeout> | null = null;
  /** Every committed round, as the log lists it. */
  let rounds: RoundRecord[] = [];
  /** The round being played back: its loud steps, the one showing, and each planned card's place in the order. */
  let playback: { steps: Step[]; index: number; order: Map<CardIid, number> } | null = null;

  const root = el('div', 'cb');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', CARD_COPY.title);
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
  mid.append(unitSide, board, enemySide, banner);
  const hand = el('div', 'cb-hand');
  const actions = el('footer', 'cb-actions');
  const sheet = el('div', 'cb-sheet');
  sheet.hidden = true;
  const inspect = el('div', 'cb-inspect');
  inspect.hidden = true;
  inspect.addEventListener('click', () => (inspect.hidden = true));
  frame.append(top, mid, hand, actions);
  root.append(sheet, inspect);

  const previousOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  host.append(root);

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
    const created = createBattle(ENCOUNTER, seed);
    if (!created.ok) return;
    state = created.state;
    log = newLog(seed, ENCOUNTER, state.deckId);
    pending = null;
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
    pending = null;
    message = '';
    if (action.type === 'commit') {
      const record = { round: before.round, before, steps: roundSteps(before, result.events, state) };
      rounds.push(record);
      if (playRound(record)) return true;
    }
    render();
    if (state.phase !== 'plan') openSheet();
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
        pending = { card, unit, stage: 'unit', units: choices.units, tiles: [] };
        message = CARD_COPY.pickTarget;
        break;
      case 'tile':
        pending = { card, unit, stage: 'tile', units: [], tiles: choices.tiles, intercepts: intercepts(view, unit, choices.tiles) };
        message = pending.intercepts!.length > 0 ? CARD_COPY.pickTileBlock : CARD_COPY.pickTile;
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
    if (state.phase !== 'plan') openSheet();
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
    if (shown) decorate(shown);
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
      el('span', 'cb-round', `${CARD_COPY.round} ${view.round}`),
      el('span', 'cb-piles', `${CARD_COPY.draw} ${view.piles.draw} · ${CARD_COPY.discard} ${view.piles.discard}`),
    );
    const note = el('div', 'cb-note', message || (inspectMode ? CARD_COPY.inspectHint : ''));
    top.replaceChildren(status, note, button('cb-btn cb-exit', CARD_COPY.exit, () => close()));
  }

  function renderBoard(view: BattleView): void {
    const choosing = pending?.stage === 'tile';
    const own = ownAttacks(view);
    // Every planned card's target holds a reticle, as a target being picked does.
    const held = new Set(view.previews.flatMap((p) => p.targets));
    const nodes: HTMLElement[] = [];
    // Enemy backline at the top: column 6 first. Lanes left to right.
    for (let col = 6; col >= 1; col--) {
      for (let lane = 1; lane <= 3; lane++) {
        const tile = view.tiles.find((t) => t.pos.lane === lane && t.pos.col === col)!;
        const node = el('button', `cb-tile cb-tile--${tile.zone}`);
        node.type = 'button';
        node.dataset['lane'] = String(lane);
        node.dataset['col'] = String(col);
        node.append(cardAsset(ZONE_TILE[tile.zone]));
        const selectable = choosing && pending!.tiles.some((t) => samePos(t, tile.pos));
        const acts = threatActs(tile);
        for (const act of acts) node.append(threatLayer(tile, act));
        const mine = own.filter((a) => samePos(a.pos, tile.pos));
        for (const act of THREAT_ORDER_ALL) {
          const hits = mine.filter((a) => a.act === act);
          if (hits.length === 0) continue;
          const wash = el('span', 'cb-ov cb-attack');
          wash.dataset['act'] = act;
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
        if (tile.occupant) node.append(token(view, tile, held));
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
    const push = (attack: AttackPreview | null, pendingOne: boolean): void => {
      for (const tile of attack?.tiles ?? []) out.push({ pos: tile.pos, act: attack!.act, n: attack!.n, stop: tile.stop, pending: pendingOne });
    };
    for (const preview of view.previews) push(preview.attack, false);
    if (pending) {
      const players = pending.stage === 'assign' ? (pending.units as UnitId[]) : pending.unit ? [pending.unit] : [];
      for (const unit of players) push(previewPlay(state, { card: pending.card, unit }).attack, true);
    }
    return out;
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
      chip.append(cardAsset(INTENT_ICON[attack.act]!, { width: 11, height: 11 }), el('span', '', String(attack.n)));
      chips.append(chip);
    }
    return chips;
  }

  /** Each attack on a tile as its keyword's icon and number, in the tile's corner. */
  function threatChips(tile: TileView): HTMLElement {
    const chips = el('span', 'cb-threat-chips');
    for (const threat of tile.threats) {
      const chip = el('span', 'cb-threat-chip');
      chip.dataset['act'] = threat.act;
      chip.append(cardAsset(INTENT_ICON[threat.act]!, { width: 11, height: 11 }), el('span', '', String(threat.n)));
      chips.append(chip);
    }
    return chips;
  }

  function layer(id: CardAssetId, className: string): HTMLElement {
    const wrap = el('span', className);
    wrap.append(cardAsset(id));
    return wrap;
  }

  function token(view: BattleView, tile: TileView, held: ReadonlySet<TargetId>): HTMLElement {
    const occupant = tile.occupant!;
    const isUnit = occupant.kind === 'unit';
    const node = el('span', `cb-token cb-token--${occupant.kind}`);
    node.dataset['id'] = occupant.id;
    const marker = isUnit ? UNIT_MARKER[occupant.id] : (ENEMY_MARKER[occupant.def] ?? 'marker-enemy-base');
    node.append(cardAsset(marker));
    let label = occupant.id;
    if (!isUnit) {
      const enemy = view.enemies.find((e) => e.id === occupant.id)!;
      label = `${enemy.name[0]}${state.enemies.find((e) => e.id === occupant.id)!.spawnIndex + 1}`;
      node.append(el('span', 'cb-token-hp', String(enemy.hp)));
    } else {
      const unit = view.units.find((u) => u.id === occupant.id)!;
      node.append(el('span', 'cb-token-hp', String(unit.hp)));
    }
    node.append(el('span', 'cb-token-label', label));
    node.setAttribute('aria-label', label);
    if (pending?.unit === occupant.id || pending?.ally === occupant.id) node.append(ring('marker-ring-selected'));
    const picking = !!pending && pending.stage !== 'tile' && pending.units.includes(occupant.id);
    if (picking || held.has(occupant.id)) node.append(ring('marker-reticle'));
    return node;
  }

  function ring(id: CardAssetId): HTMLElement {
    const wrap = el('span', 'cb-ring');
    wrap.append(cardAsset(id));
    return wrap;
  }

  function renderPanels(view: BattleView): void {
    enemySide.replaceChildren(
      ...view.enemies.map((enemy, index) => {
        const target = !!pending && pending.stage !== 'tile' && pending.units.includes(enemy.id);
        // Dark, drawn by the stylesheet: the pack's frame is the light player panel.
        const panel = el('div', 'cb-panel cb-panel--enemy');
        panel.dataset['id'] = enemy.id;
        if (enemy.dead) panel.dataset['dead'] = 'true';
        if (target) panel.dataset['target'] = 'true';
        panel.append(el('div', 'cb-panel-name', `${enemy.name} ${index + 1}`));
        panel.append(statLine(CARD_COPY.hp, `${enemy.hp}/${enemy.maxHp}`), bar(enemy.hp, enemy.maxHp));
        panel.append(statLine(CARD_COPY.shield, `${enemy.shield} · ${CARD_COPY.baseShield} ${enemy.baseShield}`));
        if (enemy.intent) {
          const pill = el('div', 'cb-pill');
          pill.dataset['act'] = enemy.intent.icon;
          pill.append(cardAsset('pill-badge', 'fill'));
          pill.append(cardAsset(INTENT_ICON[enemy.intent.icon] ?? 'icon-wait', { width: 16, height: 16 }));
          const word = enemy.intent.icon === 'none' ? CARD_COPY.intentNone : `${CARD_COPY.keyword[enemy.intent.icon as 'strike']} ${enemy.intent.n}`;
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
        panel.append(cardAsset('panel-frame', 'fill'));
        if (unit.fainted) panel.dataset['dead'] = 'true';
        if (target) panel.dataset['target'] = 'true';
        if (pending?.unit === unit.id) panel.dataset['assigning'] = 'true';
        if (pending?.blocked?.some((b) => b.unit === unit.id)) panel.dataset['blocked'] = 'true';
        panel.append(el('div', 'cb-panel-name', `${unit.id} ${unit.name}`));
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
            slot.append(cardAsset('slot-filled', 'fill'), el('span', 'cb-slot-name', play.name));
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

  function renderHand(view: BattleView): void {
    const cards = view.hand.flatMap((group) => group.cards);
    hand.dataset['count'] = String(cards.length);
    hand.replaceChildren(
      ...cards.map((card) => {
        const node = el('button', 'cb-card');
        node.type = 'button';
        node.dataset['owner'] = card.owner;
        node.dataset['card'] = card.def;
        node.setAttribute('aria-label', [card.name, `${card.cost} ${CARD_COPY.cost}`, ...effectLines(card.effects)].join(', '));
        const face = faceOf(card.effects);
        node.append(cardAsset('card-frame-compact', 'fill'));
        node.append(el('span', 'cb-card-cost', String(card.cost)));
        node.append(el('span', 'cb-card-n', face.n === null ? '' : String(face.n)));
        const field = el('span', 'cb-card-field');
        field.append(cardAsset(face.icon, 'fill'));
        if (face.targeted) field.append(cornerIcon('icon-target', 'cb-card-mark cb-card-mark--target'));
        if (card.once) field.append(cornerIcon('icon-once', 'cb-card-mark cb-card-mark--once'));
        node.append(field);
        node.append(el('span', 'cb-card-name', card.name));
        const badge = el('span', 'cb-card-badge');
        badge.append(cardAsset('card-badge-corner', 'fill'), el('span', 'cb-card-owner', card.owner === 'neutral' ? 'N' : card.owner));
        node.append(badge);
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
    const face = faceOf(card.effects);
    const full = el('div', 'cb-full');
    full.append(cardAsset('card-frame-full', 'fill'));
    full.append(el('div', 'cb-full-cost', String(card.cost)), el('div', 'cb-full-n', face.n === null ? '' : String(face.n)));
    full.append(el('div', 'cb-full-name', card.name));
    const art = el('div', 'cb-full-art');
    art.append(cardAsset(face.icon, 'fill'));
    full.append(art);
    const body = el('div', 'cb-full-body');
    body.append(el('div', 'cb-full-owner', card.owner === 'neutral' ? CARD_COPY.neutral : `${card.owner} ${UNITS[card.owner].name}`));
    for (const line of effectLines(card.effects)) body.append(el('div', 'cb-full-line', line));
    if (card.once) body.append(el('div', 'cb-full-line', CARD_COPY.once));
    if (card.reason) body.append(el('div', 'cb-full-reason', CARD_COPY.reasons[card.reason]));
    full.append(body);
    const badge = el('span', 'cb-full-badge');
    badge.append(cardAsset('card-badge-corner', 'fill'), el('span', 'cb-card-owner', card.owner === 'neutral' ? 'N' : card.owner));
    full.append(badge);
    inspect.replaceChildren(full);
    inspect.hidden = false;
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
    const end = button('cb-btn cb-btn--primary', CARD_COPY.endTurn, () => act({ type: 'commit' }));
    end.querySelector('.cb-btn-label')!.prepend(cardAsset('icon-end-turn', { width: 16, height: 16 }));
    end.disabled = !view.canCommit;
    actions.replaceChildren(undo, inspectButton, end, button('cb-btn', CARD_COPY.menu, () => openSheet()));
  }

  function openSheet(): void {
    const panel = el('div', 'cb-sheet-panel');
    const heading =
      state.phase === 'plan' ? CARD_COPY.title : `${state.phase === 'won' ? CARD_COPY.won : CARD_COPY.lost} · ${CARD_COPY.round} ${state.round}`;
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
    panel.append(
      button('cb-btn', CARD_COPY.restart, () => start(seed)),
      button('cb-btn', CARD_COPY.newSeed, () => start(newSeed())),
      button('cb-btn', CARD_COPY.copyLog, () => {
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
      }),
      button('cb-btn', CARD_COPY.roundLog, () => openRoundLog()),
      replay,
      button('cb-btn', CARD_COPY.close, () => (sheet.hidden = true)),
      button('cb-btn', CARD_COPY.exit, () => close()),
      status,
      copyArea,
    );
    sheet.replaceChildren(panel);
    sheet.hidden = false;
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
    root.remove();
    document.documentElement.style.overflow = previousOverflow;
    options.onExit?.();
  }

  start(seed);
  root.tabIndex = -1;
  root.focus();
  return { root, close };
}
