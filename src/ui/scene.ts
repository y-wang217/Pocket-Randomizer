/**
 * The battlefield: HP bars, status, stat stages, and the move buttons.
 *
 * This is a thin DOM layer over `BattleView` and nothing else. It reads a
 * plain object and writes elements — no sim types, no game logic, no decisions.
 * Swapping it for a canvas renderer or a framework should not require touching
 * anything under core/.
 *
 * Elements are created once and updated in place rather than re-rendered, so
 * the HP bar's CSS width transition actually animates instead of restarting
 * from scratch on every update.
 */
import { BOOST_NAMES, type ActiveView, type BattleView, type MoveView } from '../core/types';

const STATUS_LABELS: Record<string, string> = {
  brn: 'BRN',
  par: 'PAR',
  slp: 'SLP',
  frz: 'FRZ',
  psn: 'PSN',
  tox: 'TOX',
};

interface SidePanel {
  root: HTMLElement;
  name: HTMLElement;
  level: HTMLElement;
  types: HTMLElement;
  hpFill: HTMLElement;
  hpText: HTMLElement;
  status: HTMLElement;
  stages: HTMLElement;
}

export interface Scene {
  root: HTMLElement;
  /** Redraw from a view. `onChoose` fires with a 1-based move slot. */
  update(view: BattleView, onChoose: (slot: number) => void): void;
}

export function createScene(): Scene {
  const root = el('div', 'scene');
  const foe = createSidePanel('foe');
  const me = createSidePanel('me');
  const moves = el('div', 'moves');

  root.append(foe.root, me.root, moves);

  return {
    root,
    update(view, onChoose) {
      updateSidePanel(foe, view.foe, true);
      updateSidePanel(me, view.me, false);
      renderMoves(moves, view, onChoose);
    },
  };
}

function createSidePanel(kind: 'me' | 'foe'): SidePanel {
  const root = el('div', `panel panel--${kind}`);
  const header = el('div', 'panel__header');
  const name = el('span', 'panel__name');
  const level = el('span', 'panel__level');
  const types = el('span', 'panel__types');
  header.append(name, level, types);

  const hpTrack = el('div', 'hp');
  const hpFill = el('div', 'hp__fill');
  hpTrack.append(hpFill);

  const meta = el('div', 'panel__meta');
  const hpText = el('span', 'panel__hp-text');
  const status = el('span', 'badge badge--status');
  meta.append(hpText, status);

  const stages = el('div', 'stages');

  root.append(header, hpTrack, meta, stages);
  return { root, name, level, types, hpFill, hpText, status, stages };
}

function updateSidePanel(panel: SidePanel, active: ActiveView, isFoe: boolean): void {
  panel.name.textContent = isFoe ? `Opposing ${active.name}` : active.name;
  panel.level.textContent = `Lv${active.level}`;

  panel.types.replaceChildren(
    ...active.types.map((type) => {
      const chip = el('span', `type type--${type.toLowerCase()}`);
      chip.textContent = type;
      return chip;
    }),
  );

  const percent = Math.round(active.hpFraction * 100);
  panel.hpFill.style.width = `${active.hpFraction * 100}%`;
  panel.hpFill.dataset['band'] = hpBand(active.hpFraction);
  // Foe HP is shown as a percentage: it is what a player can actually read off
  // the bar, and showing exact HP would be information the view deliberately
  // does not hand to a policy either.
  panel.hpText.textContent = isFoe ? `${percent}%` : `${active.hp} / ${active.maxHp}`;

  if (active.status) {
    panel.status.textContent = STATUS_LABELS[active.status] ?? active.status.toUpperCase();
    panel.status.dataset['status'] = active.status;
    panel.status.hidden = false;
  } else {
    panel.status.hidden = true;
    delete panel.status.dataset['status'];
  }

  const boosted = BOOST_NAMES.filter((name) => active.statStages[name] !== 0);
  panel.stages.replaceChildren(
    ...boosted.map((name) => {
      const stage = active.statStages[name];
      const chip = el('span', `badge badge--stage badge--${stage > 0 ? 'up' : 'down'}`);
      chip.textContent = `${name.slice(0, 3).toUpperCase()} ${stage > 0 ? '+' : ''}${stage}`;
      return chip;
    }),
  );
  panel.stages.hidden = boosted.length === 0;
}

function hpBand(fraction: number): 'high' | 'mid' | 'low' {
  if (fraction > 0.5) return 'high';
  return fraction > 0.2 ? 'mid' : 'low';
}

function renderMoves(container: HTMLElement, view: BattleView, onChoose: (slot: number) => void): void {
  if (view.moves.length === 0) {
    // No moves are offered between turns and after the battle ends. Clearing
    // them would collapse the column out from under the player mid-battle and
    // leave a hole behind the end screen, so the last set stays on screen,
    // disabled, until a real one replaces it.
    for (const button of container.querySelectorAll('button')) button.disabled = true;
    return;
  }
  container.replaceChildren(...view.moves.map((move) => renderMove(move, view.awaitingChoice, onChoose)));
}

function renderMove(move: MoveView, enabled: boolean, onChoose: (slot: number) => void): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `move move--${move.type.toLowerCase()}`;
  button.disabled = !enabled || !move.usable;

  const name = el('span', 'move__name');
  name.textContent = move.name;

  const meta = el('span', 'move__meta');
  const type = el('span', `type type--${move.type.toLowerCase()}`);
  type.textContent = move.type;
  const category = el('span', 'move__category');
  category.textContent = move.category;
  const power = el('span', 'move__power');
  power.textContent = move.category === 'Status' ? '—' : `${move.basePower} BP`;
  meta.append(type, category, power);

  const pp = el('span', 'move__pp');
  pp.textContent = `PP ${move.pp}/${move.maxPp}`;
  if (move.maxPp > 0 && move.pp / move.maxPp <= 0.25) pp.classList.add('move__pp--low');

  button.append(name, meta, pp);
  button.addEventListener('click', () => onChoose(move.slot));
  return button;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}
