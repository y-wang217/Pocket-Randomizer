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
import {
  BOOST_NAMES,
  moveChoice,
  switchChoice,
  type ActiveView,
  type BattleView,
  type Choice,
  type MoveView,
  type SwitchView,
} from '../core/types';

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
  /**
   * Redraw from a view. `onChoose` fires with the choice the player made.
   *
   * A `Choice`, not a move slot. Stage 4 is where the two kinds of answer stop
   * being distinguishable by shape — a switch and a move are both "a slot" —
   * and passing the union through means the app never has to guess which panel
   * a number came from.
   */
  update(view: BattleView, onChoose: (choice: Choice) => void): void;
}

export function createScene(): Scene {
  const root = el('div', 'scene');
  const foe = createSidePanel('foe');
  const me = createSidePanel('me');
  const moves = el('div', 'moves');
  const bench = el('div', 'bench');

  root.append(foe.root, me.root, moves, bench);

  return {
    root,
    update(view, onChoose) {
      updateSidePanel(foe, view.foe, true);
      updateSidePanel(me, view.me, false);
      renderMoves(moves, view, onChoose);
      renderBench(bench, view, onChoose);
    },
  };
}

/**
 * Why a bench member cannot be sent out, in the player's words.
 *
 * **Every blocked switch is shown disabled with its reason, never hidden.** A
 * row that vanishes teaches the player that the bench is unreliable; a row that
 * says "Trapped" teaches them what Arena Trap does. The two trapping cases read
 * differently on purpose — the sim tells us when the cause is public and when it
 * is not, and passing that distinction through is the difference between "you
 * are held by that Dugtrio" and "something is holding you".
 */
const BLOCK_LABELS: Record<NonNullable<SwitchView['block']>, string> = {
  fainted: 'Fainted',
  active: 'Out now',
  trapped: 'Trapped',
  'maybe-trapped': 'Something is holding you',
};

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

function renderMoves(container: HTMLElement, view: BattleView, onChoose: (choice: Choice) => void): void {
  if (view.moves.length === 0) {
    /*
     * No moves are offered between turns, on a forced switch, or after the
     * battle ends. Clearing them would collapse the column out from under the
     * player mid-battle and leave a hole behind the end screen, so the last set
     * stays on screen, disabled, until a real one replaces it.
     *
     * On a forced switch that is exactly the behaviour the spec asks for: the
     * moves are visibly there and visibly unavailable, so the player can see
     * that the game is asking a different question rather than wondering where
     * the buttons went.
     */
    for (const button of container.querySelectorAll('button')) button.disabled = true;
    return;
  }
  container.replaceChildren(...view.moves.map((move) => renderMove(move, view.awaitingChoice, onChoose)));
}

/**
 * The bench, as a row of buttons beside the moves.
 *
 * Hidden only when there is no bench at all — a party of one has nothing to say
 * here, and an empty panel would be a permanent reminder of a mechanic the run
 * has not reached yet. From two members on it is always visible, including on
 * turns where every row is disabled, because "you cannot switch right now" is
 * information and an absent panel is not.
 */
function renderBench(container: HTMLElement, view: BattleView, onChoose: (choice: Choice) => void): void {
  const bench = view.switches.filter((member) => member.block !== 'active');
  if (bench.length === 0) {
    if (view.switches.length === 0) return;
    // Between turns the view carries no switches at all; leave the last render
    // in place, disabled, rather than collapsing the panel.
    for (const button of container.querySelectorAll('button')) button.disabled = true;
    return;
  }

  const heading = el('div', 'bench__heading');
  heading.textContent = view.forceSwitch
    ? 'Choose who comes in'
    : view.trapped
      ? 'Switch — blocked this turn'
      : 'Switch';
  container.replaceChildren(heading, ...bench.map((member) => renderBenchMember(member, view, onChoose)));
  container.dataset['forced'] = view.forceSwitch ? 'true' : 'false';
}

function renderBenchMember(
  member: SwitchView,
  view: BattleView,
  onChoose: (choice: Choice) => void,
): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'bench__member';
  button.disabled = !view.awaitingChoice || !member.usable;

  const name = el('span', 'bench__name');
  name.textContent = member.name;
  const level = el('span', 'bench__level');
  level.textContent = `Lv${member.level}`;

  const types = el('span', 'bench__types');
  types.replaceChildren(
    ...member.types.map((type) => {
      const chip = el('span', `type type--${type.toLowerCase()}`);
      chip.textContent = type;
      return chip;
    }),
  );

  const track = el('div', 'hp hp--slim');
  const fill = el('div', 'hp__fill');
  fill.style.width = `${member.hpFraction * 100}%`;
  fill.dataset['band'] = hpBand(member.hpFraction);
  track.append(fill);

  const meta = el('span', 'bench__meta');
  meta.textContent = `${member.hp} / ${member.maxHp}`;
  if (member.status) {
    const status = el('span', 'badge badge--status');
    status.dataset['status'] = member.status;
    status.textContent = STATUS_LABELS[member.status] ?? member.status.toUpperCase();
    meta.append(' ', status);
  }
  // The reason a row is disabled, spelled out on the row itself.
  if (member.block) {
    const reason = el('span', 'bench__block');
    reason.textContent = BLOCK_LABELS[member.block];
    meta.append(' ', reason);
  }

  button.append(name, level, types, track, meta);
  button.addEventListener('click', () => onChoose(switchChoice(member.slot)));
  return button;
}

function renderMove(move: MoveView, enabled: boolean, onChoose: (choice: Choice) => void): HTMLElement {
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
  button.addEventListener('click', () => onChoose(moveChoice(move.slot)));
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
