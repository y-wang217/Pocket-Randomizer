/**
 * The card battle sandbox: one fight, full frame, over whatever the app is
 * showing. **Card battle engine, checkpoint 5.** Loaded only lazily, by
 * `ui/cardbattle-entry.ts`, so nothing here, its stylesheet or
 * its asset manifest reaches the main bundle.
 *
 * The screen holds no rules. Every tap becomes an engine action; the engine
 * answers with a new state, which is drawn at once, and an event list, which
 * plays back as skippable one-line beats that never block input. Under
 * reduced motion the beats collapse to the last line.
 *
 * Outside the design bible by the author's ruling
 * (`docs/spec/gymrun-card-battle-engine-rulings.md`). It writes nothing into
 * the run save.
 */
import './sandbox.css';

import { CARDS } from '../../cardData/cards';
import { CARD_COPY } from '../../cardData/copy';
import { ENEMIES } from '../../cardData/enemies';
import { UNITS } from '../../cardData/units';
import { createBattle } from '../../core/cards/create';
import type { Effect, Pos } from '../../core/cards/defs';
import type { BattleEvent } from '../../core/cards/events';
import { choicesFor } from '../../core/cards/legal';
import { newLog, type BattleLog } from '../../core/cards/log';
import type { Action, BattleState, CardIid, TargetId, UnitId } from '../../core/cards/state';
import { step } from '../../core/cards/step';
import { viewOf, type BattleView, type HandCardView, type TileView } from '../../core/cards/view';
import { samePos } from '../../core/cards/zones';
import { newSeed } from '../seed';
import { cardAsset, type CardAssetId } from './assets';

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
}

const ENCOUNTER = 'test';
const LONG_PRESS_MS = 450;
const BEAT_MS = 380;

const UNIT_MARKER: Record<UnitId, CardAssetId> = { A: 'marker-unit-commander', B: 'marker-unit-gunner', C: 'marker-unit-dasher' };
const ENEMY_MARKER: Record<string, CardAssetId> = { drone: 'marker-enemy-drone', lancer: 'marker-enemy-lancer' };
const INTENT_ICON: Record<string, CardAssetId> = {
  strike: 'icon-strike',
  pierce: 'icon-pierce',
  slash: 'icon-slash',
  shield: 'icon-shield',
  none: 'icon-wait',
};
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
  const node = el('button', className, label);
  node.type = 'button';
  node.addEventListener('click', onTap);
  return node;
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
  let hits = new Set<string>();

  const root = el('div', 'cb');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', CARD_COPY.title);
  const frame = el('div', 'cb-frame');
  root.append(frame);

  const top = el('header', 'cb-top');
  const mid = el('div', 'cb-mid');
  const left = el('aside', 'cb-left');
  const board = el('div', 'cb-board');
  const right = el('aside', 'cb-right');
  // The beats never take a tap: any tap anywhere skips them and still lands.
  const banner = el('div', 'cb-banner');
  banner.setAttribute('aria-live', 'polite');
  mid.append(left, board, right, banner);
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

  function start(nextSeed: string): void {
    seed = nextSeed;
    const created = createBattle(ENCOUNTER, seed);
    if (!created.ok) return;
    state = created.state;
    log = newLog(seed, ENCOUNTER, state.deckId);
    pending = null;
    inspectMode = false;
    message = '';
    hits = new Set();
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
    state = result.state;
    log.actions.push(action);
    pending = null;
    message = '';
    if (action.type === 'commit') {
      hits = new Set(result.events.flatMap((e) => (e.t === 'damaged' ? [e.target] : [])));
      playBeats(result.events);
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
    if (card.players.length > 1) {
      pending = { card: card.iid, stage: 'assign', units: card.players, tiles: [] };
      message = CARD_COPY.pickUnit;
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
        pending = { card, unit, stage: 'tile', units: [], tiles: choices.tiles };
        message = CARD_COPY.pickTile;
        break;
      case 'unitThenTile':
        pending = { card, unit, stage: 'unit', units: choices.units, tiles: [] };
        message = CARD_COPY.pickAlly;
        break;
    }
    render();
  }

  function tapTarget(id: TargetId): boolean {
    if (!pending || !pending.units.includes(id)) return false;
    if (pending.stage === 'assign') {
      begin(pending.card, id as UnitId);
      return true;
    }
    if (pending.stage === 'unit') {
      const view = findCard(pending.card);
      if (view?.needs === 'unitThenTile') {
        pending = { ...pending, stage: 'tile', ally: id, units: [], tiles: choicesFor(state, pending.card, pending.unit!, id).tiles };
        message = CARD_COPY.pickTile;
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

  function findCard(iid: CardIid): HandCardView | undefined {
    return viewOf(state).hand.flatMap((g) => g.cards).find((c) => c.iid === iid);
  }

  // --------------------------------------------------------------- beats

  function beatText(event: BattleEvent): string | null {
    const who = (id: string): string => {
      const unit = state.units.find((u) => u.id === id);
      if (unit) return `${unit.id}`;
      const enemy = state.enemies.find((e) => e.id === id);
      return enemy ? `${ENEMIES[enemy.def].name} ${enemy.spawnIndex + 1}` : id;
    };
    const b = CARD_COPY.beats;
    switch (event.t) {
      case 'moved':
        return b.moved(who(event.unit));
      case 'damaged':
        return b.damaged(who(event.target), event.amount);
      case 'defeated':
        return b.defeated(who(event.enemy));
      case 'fainted':
        return b.fainted(who(event.unit));
      case 'enemyMissed':
        return b.missed(who(event.enemy));
      case 'shielded':
        return b.shielded(who(event.unit), event.amount);
      case 'fizzled':
        return b.fizzled(CARDS[state.cards[event.card]!.def]!.name);
      case 'reshuffled':
        return b.reshuffled;
      case 'roundStarted':
        return b.roundStarted(event.round);
      case 'won':
        return CARD_COPY.won;
      case 'lost':
        return CARD_COPY.lost;
      default:
        return null;
    }
  }

  function playBeats(events: BattleEvent[]): void {
    skipBeats();
    const lines = events.map(beatText).filter((line): line is string => line !== null);
    if (lines.length === 0) return;
    if (reducedMotion()) {
      showBeat(lines[lines.length - 1]!);
      return;
    }
    let index = 0;
    const next = (): void => {
      showBeat(lines[index]!);
      index++;
      beatTimer = index < lines.length ? setTimeout(next, BEAT_MS) : null;
    };
    next();
  }

  function showBeat(text: string): void {
    banner.textContent = text;
    banner.dataset['on'] = 'true';
  }

  function skipBeats(): void {
    if (beatTimer !== null) clearTimeout(beatTimer);
    beatTimer = null;
    delete banner.dataset['on'];
    banner.textContent = '';
  }

  // -------------------------------------------------------------- render

  function render(): void {
    const view = viewOf(state);
    renderTop(view);
    renderBoard(view);
    renderPanels(view);
    renderHand(view);
    renderActions(view);
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
        if (tile.telegraphedBy.length > 0) node.append(layer('tile-overlay-telegraph', 'cb-ov cb-ov--telegraph'));
        if (selectable) node.append(layer('tile-overlay-selectable', 'cb-ov cb-ov--selectable'));
        else if (choosing) node.append(layer('tile-overlay-unavailable', 'cb-ov cb-ov--unavailable'));
        if (tile.planGhost) {
          node.append(layer('tile-overlay-selected', 'cb-ov cb-ov--selected'));
          const ghost = el('span', 'cb-ghost', tile.planGhost);
          ghost.prepend(cardAsset('marker-ring-destination', { width: 48, height: 48 }));
          node.append(ghost);
        }
        if (tile.occupant) node.append(token(view, tile));
        node.addEventListener('click', () => tapTile(tile));
        nodes.push(node);
      }
    }
    board.replaceChildren(...nodes);
  }

  function layer(id: CardAssetId, className: string): HTMLElement {
    const wrap = el('span', className);
    wrap.append(cardAsset(id));
    return wrap;
  }

  function token(view: BattleView, tile: TileView): HTMLElement {
    const occupant = tile.occupant!;
    const isUnit = occupant.kind === 'unit';
    const node = el('span', `cb-token cb-token--${occupant.kind}`);
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
    if (pending?.unit === occupant.id || pending?.ally === occupant.id) node.append(ring('marker-ring-selected'));
    if (pending && pending.stage !== 'tile' && pending.units.includes(occupant.id)) node.append(ring('marker-reticle'));
    if (hits.has(occupant.id)) node.dataset['hit'] = 'true';
    return node;
  }

  function ring(id: CardAssetId): HTMLElement {
    const wrap = el('span', 'cb-ring');
    wrap.append(cardAsset(id));
    return wrap;
  }

  function renderPanels(view: BattleView): void {
    left.replaceChildren(
      ...view.enemies.map((enemy, index) => {
        const target = !!pending && pending.stage !== 'tile' && pending.units.includes(enemy.id);
        const panel = el('div', 'cb-panel cb-panel--enemy');
        panel.append(cardAsset('panel-frame', 'fill'));
        if (enemy.dead) panel.dataset['dead'] = 'true';
        if (target) panel.dataset['target'] = 'true';
        panel.append(el('div', 'cb-panel-name', `${enemy.name} ${index + 1}`));
        panel.append(statLine(CARD_COPY.hp, `${enemy.hp}/${enemy.maxHp}`));
        panel.append(statLine(CARD_COPY.shield, `${enemy.shield} · ${CARD_COPY.baseShield} ${enemy.baseShield}`));
        if (enemy.intent) {
          const pill = el('div', 'cb-pill');
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
    right.replaceChildren(
      ...view.units.map((unit) => {
        const target = !!pending && pending.stage !== 'tile' && pending.units.includes(unit.id);
        const panel = el('div', 'cb-panel cb-panel--unit');
        panel.append(cardAsset('panel-frame', 'fill'));
        if (unit.fainted) panel.dataset['dead'] = 'true';
        if (target) panel.dataset['target'] = 'true';
        if (pending?.unit === unit.id) panel.dataset['assigning'] = 'true';
        panel.append(el('div', 'cb-panel-name', `${unit.id} ${unit.name}`));
        panel.append(statLine(CARD_COPY.hp, `${unit.hp}/${unit.maxHp} · ${CARD_COPY.shieldShort} ${unit.shield}+${unit.baseShield}`));
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
            const slot = button('cb-slot cb-slot--filled', '', () => act({ type: 'unselect', planIndex: play.planIndex }));
            slot.append(cardAsset('slot-filled', 'fill'), el('span', 'cb-slot-name', play.name));
            slot.addEventListener('click', (event) => event.stopPropagation());
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
        node.append(cardAsset('card-frame-compact', 'fill'));
        const badge = el('span', 'cb-card-owner', card.owner === 'neutral' ? 'N' : card.owner);
        badge.prepend(cardAsset('card-badge-corner', 'fill'));
        node.append(el('span', 'cb-card-cost', String(card.cost)), badge, el('span', 'cb-card-name', card.name));
        const body = el('span', 'cb-card-body');
        for (const line of effectLines(card.effects)) body.append(el('span', 'cb-card-line', line));
        if (card.once) body.append(el('span', 'cb-card-line cb-card-once', CARD_COPY.once));
        node.append(body);
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
    const face = el('div', 'cb-full');
    face.append(cardAsset('card-frame-full', 'fill'));
    face.append(
      el('div', 'cb-full-cost', `${card.cost} ${CARD_COPY.cost}`),
      el('div', 'cb-full-name', card.name),
      el('div', 'cb-full-owner', card.owner === 'neutral' ? CARD_COPY.neutral : `${card.owner} ${UNITS[card.owner].name}`),
    );
    const body = el('div', 'cb-full-body');
    for (const line of effectLines(card.effects)) body.append(el('div', 'cb-full-line', line));
    if (card.once) body.append(el('div', 'cb-full-line', CARD_COPY.once));
    if (card.reason) body.append(el('div', 'cb-full-reason', CARD_COPY.reasons[card.reason]));
    face.append(body);
    inspect.replaceChildren(face);
    inspect.hidden = false;
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
    inspectButton.prepend(cardAsset('icon-inspect', { width: 16, height: 16 }));
    if (inspectMode) inspectButton.dataset['on'] = 'true';
    const end = button('cb-btn cb-btn--primary', CARD_COPY.endTurn, () => act({ type: 'commit' }));
    end.prepend(cardAsset('icon-end-turn', { width: 16, height: 16 }));
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
      button('cb-btn', CARD_COPY.close, () => (sheet.hidden = true)),
      button('cb-btn', CARD_COPY.exit, () => close()),
      status,
      copyArea,
    );
    sheet.replaceChildren(panel);
    sheet.hidden = false;
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
