/**
 * The battlefield: HP bars, the stat panel, the speed readout, and the buttons.
 *
 * This is a thin DOM layer over `BattleUiView` and nothing else. It reads a
 * plain object and writes elements — no sim types, no run state, no game logic.
 * Swapping it for a canvas renderer or a framework should not require touching
 * anything under core/.
 *
 * Stage 4.5 is the first change here that is about *reading* rather than
 * deciding. Everything it draws — categories, stat stages, effectiveness, turn
 * order — has been resolving correctly in the engine since Stage 0, and none of
 * it was on screen, so the decisions those mechanics create were invisible.
 * `core/battle/view.ts` explains why the numbers arrive through one projection
 * instead of being fished out of `RunState`.
 *
 * Elements are created once and updated in place rather than re-rendered, so
 * the HP bar's CSS width transition actually animates instead of restarting
 * from scratch on every update. The stat rows follow the same rule for the same
 * reason: a row that is replaced cannot pulse when its stage changes.
 */
import { EFFECTIVENESS_LABELS } from '../core/battle/effectiveness';
import { hpStateBare } from '../core/hpCopy';
import { BOOSTABLE_STATS, STAT_LABELS } from '../core/battle/stats';
import {
  formatEffectiveness,
  formatStat,
  type ActiveUiView,
  type BattleUiView,
  type MoveUiView,
} from '../core/battle/view';
import { showsNumbers } from './settings';
import { ARCHETYPE_DISPLAY } from '../data/archetypes';
import { moveTagLabel, type MoveTag } from '../data/moveTags';
import { statusReadoutLine, type MoveEffectFields } from '../data/moveCopy';
import {
  moveChoice,
  switchChoice,
  type Choice,
  type Gender,
  type StatName,
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

/** A row in the six-stat panel. Held so it can be updated rather than rebuilt. */
interface StatRow {
  root: HTMLElement;
  label: HTMLElement;
  value: HTMLElement;
  /** The Simple-mode relative bar. Hidden in Detailed, and vice versa. */
  bar: HTMLElement;
  barFill: HTMLElement;
  marker: HTMLElement;
}

interface SidePanel {
  root: HTMLElement;
  name: HTMLElement;
  level: HTMLElement;
  /** The Part 7 label, beside the level on both sides of the field. */
  archetype: HTMLElement;
  types: HTMLElement;
  hpFill: HTMLElement;
  hpText: HTMLElement;
  status: HTMLElement;
  volatiles: HTMLElement;
  traits: HTMLElement;
  hpRow: StatRow;
  rows: Record<StatName, StatRow>;
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
  update(view: BattleUiView, onChoose: (choice: Choice) => void): void;
}

export function createScene(): Scene {
  const root = el('div', 'scene');
  const foe = createSidePanel('foe');
  const me = createSidePanel('me');
  const moves = el('div', 'moves');
  const bench = el('div', 'bench');

  root.append(foe.root, me.root, moves, bench);

  /*
   * Any transition must be skippable by tapping. Nothing here blocks input in
   * the first place — the beat is a CSS animation on a panel, and the move
   * buttons are live throughout — but a player who taps *because* something is
   * moving should see it stop, so the first touch anywhere clears both beats.
   */
  root.addEventListener(
    'pointerdown',
    () => {
      delete foe.root.dataset['swapped'];
      delete me.root.dataset['swapped'];
    },
    true,
  );

  return {
    root,
    update(view, onChoose) {
      updateSidePanel(foe, view.opponent, true, view.fasterSide === 'opponent');
      updateSidePanel(me, view.player, false, view.fasterSide === 'player');
      root.dataset['faster'] = view.fasterSide;
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

function createStatRow(stat: string): StatRow {
  const root = el('div', 'stat');
  root.dataset['stat'] = stat;
  const label = el('span', 'stat__label');
  /*
   * Every stat label is a tooltip trigger. **Persistent, not discoverable.**
   *
   * Part 5 asks that the abbreviations be explained wherever they appear, and
   * `Atk` versus `SpA` is the case it names: two labels one character apart
   * that decide which of the defender's two unrelated defences a move is
   * resolved against. A help affordance the player has to find first is one
   * they find after the run in which they needed it.
   *
   * The same tap-first layer Stage 4.5 built (`ui/tooltips.ts`), and
   * deliberately not a second mechanism — a `title` attribute here would be a
   * hover-only answer on a screen whose other answers work on a phone.
   */
  label.dataset['tip'] = `stat:${stat}`;
  const value = el('span', 'stat__value');
  // The speed marker lives on every row so the arrow can move without the
  // layout shifting under it. Only the Speed row ever fills it in.
  const marker = el('span', 'stat__marker');
  marker.hidden = true;
  // The Simple-mode bar. Always built, never rebuilt — the toggle flips which
  // of `value` and `bar` is hidden, so switching modes cannot reflow the panel.
  const bar = el('div', 'stat__bar');
  const barFill = el('div', 'stat__bar-fill');
  bar.append(barFill);
  root.append(label, value, bar, marker);
  return { root, label, value, bar, barFill, marker };
}

/**
 * The widest stat a bar is drawn against.
 *
 * A relative bar needs a denominator, and there is no honest one available on
 * screen: the panel shows two Pokemon, so scaling to the larger of the two
 * would make the same Pokemon's Attack bar change length depending on who it is
 * fighting. A fixed ceiling keeps a bar meaning the same thing all run.
 *
 * 200 is a little above the highest stat a levelled party member reaches at the
 * shipped curve, so bars stay readable rather than all pinning to full.
 */
const STAT_BAR_CEILING = 200;

function createSidePanel(kind: 'me' | 'foe'): SidePanel {
  const root = el('div', `panel panel--${kind}`);
  const header = el('div', 'panel__header');
  const name = el('span', 'panel__name');
  const level = el('span', 'panel__level');
  /*
   * The archetype chip, next to the level. **Stage 4.7, Part 7.**
   *
   * On *both* panels, which is half the point of the feature: a player who can
   * tell at a glance that the thing opposite is built around Special Attack is
   * making a read rather than a guess. It arrives on the projection — the scene
   * computes no labels — and it is not gated by the reveal policy, because it
   * restates base stats the stat block beside it has printed since Stage 4.5.
   */
  const archetype = el('span', 'badge badge--archetype');
  archetype.dataset['tip'] = 'archetype:all';
  archetype.tabIndex = 0;
  archetype.setAttribute('role', 'button');
  const types = el('span', 'panel__types');
  header.append(name, level, archetype, types);

  const hpTrack = el('div', 'hp');
  const hpFill = el('div', 'hp__fill');
  hpTrack.append(hpFill);

  const meta = el('div', 'panel__meta');
  const hpText = el('span', 'panel__hp-text');
  const status = el('span', 'badge badge--status');
  meta.append(hpText, status);

  // Ability and item, on their own line. Both are revealable, and the reveal
  // flag is honoured here rather than upstream so one source decides it.
  const traits = el('div', 'panel__traits');
  const volatiles = el('div', 'panel__volatiles');

  const statsRoot = el('div', 'stats');
  const hpRow = createStatRow('hp');
  const rows = {} as Record<StatName, StatRow>;
  statsRoot.append(hpRow.root);
  for (const stat of BOOSTABLE_STATS) {
    const row = createStatRow(stat);
    rows[stat] = row;
    statsRoot.append(row.root);
  }

  root.append(header, hpTrack, meta, traits, volatiles, statsRoot);
  return { root, name, level, archetype, types, hpFill, hpText, status, volatiles, traits, hpRow, rows };
}

function updateSidePanel(
  panel: SidePanel,
  active: ActiveUiView,
  isFoe: boolean,
  isFaster: boolean,
): void {
  /*
   * The sprite-swap beat, when the body on this side changed.
   *
   * Detected from the species the panel last drew rather than from a switch
   * event, because the panel is updated from a projection and has no event
   * stream — and because that makes it correct for every way a Pokemon can be
   * replaced: a voluntary switch, a forced one after a faint, and whatever
   * Stage 5 adds. The log line beside it is the *narration*; this is only the
   * beat that stops the panel changing wholesale looking like a glitch.
   *
   * Never on the first draw: an opening switch-in is not a swap, and animating
   * it would flash both panels at the start of every battle.
   */
  const previous = panel.root.dataset['species'];
  panel.root.dataset['species'] = active.species;
  if (previous !== undefined && previous !== active.species) {
    // Restart rather than extend: re-setting the attribute on an element that
    // already carries it does not replay a CSS animation.
    delete panel.root.dataset['swapped'];
    void panel.root.offsetWidth;
    panel.root.dataset['swapped'] = 'true';
  }

  panel.name.textContent = isFoe ? `Opposing ${active.name}` : active.name;
  // Gender sits with the level because it is the same kind of fact: a fixed
  // property of this Pokemon, not a thing the fight is doing to it. Genderless
  // renders nothing at all rather than a dash or an "N" — a placeholder for
  // "no gender" is a symbol the player has to learn in order to ignore.
  panel.level.textContent = `Lv${active.level}${genderMark(active.gender)}`;
  panel.archetype.textContent = ARCHETYPE_DISPLAY[active.archetype].short;

  panel.types.replaceChildren(...active.types.map((type) => typeChip(type)));

  panel.hpFill.style.width = `${active.hp.fraction * 100}%`;
  panel.hpFill.dataset['band'] = hpBand(active.hp.fraction);
  /*
   * Both sides now show exact HP.
   *
   * The foe used to be a percentage, on the argument that exact HP was
   * information the policy view deliberately withholds. That argument belonged
   * to the *policy*, not to the screen: a bot reading exact foe HP would make
   * the balance sweep measure a cheat, and a player reading it is doing the
   * arithmetic a percentage was forcing them to do in their head. The stat
   * panel next to it prints the opponent's Defence, so hiding the HP would have
   * been the one coy number on a panel that answers everything else.
   */
  panel.hpText.textContent = hpStateBare(active.hp.current, active.hp.max);

  if (active.status) {
    panel.status.textContent = active.status.label;
    panel.status.dataset['status'] = active.status.id;
    panel.status.dataset['tip'] = `status:${active.status.id}`;
    panel.status.hidden = false;
  } else {
    panel.status.hidden = true;
    delete panel.status.dataset['status'];
  }

  renderTraits(panel.traits, active);

  panel.volatiles.replaceChildren(
    ...active.volatiles.map((volatile) => {
      const chip = el('span', 'badge badge--volatile');
      chip.textContent = volatile.label;
      chip.dataset['tip'] = `volatile:${volatile.id}`;
      return chip;
    }),
  );
  panel.volatiles.hidden = active.volatiles.length === 0;

  /*
   * The HP row shows **max** HP, not current.
   *
   * It is on the panel in Showdown order because a six-stat panel missing HP
   * reads as an error, but the thing it is showing is HP-*the-stat* — the same
   * kind of number as the Attack beside it, and the one that says whether this
   * Pokemon is bulky. Current HP is a resource rather than a stat, and it is
   * already on the bar and the line above. The first cut printed `103 / 115` in
   * both places, which made the panel look like it was repeating itself and
   * left the actual stat unstated.
   *
   * HP is not boostable, so the row never carries a stage.
   */
  panel.hpRow.label.textContent = STAT_LABELS.hp;
  panel.hpRow.value.textContent = `${active.hp.max}`;
  panel.hpRow.root.dataset['stage'] = 'flat';
  applyVerbosity(panel.hpRow, active.hp.max);

  for (const stat of BOOSTABLE_STATS) {
    const row = panel.rows[stat];
    const view = active.stats[stat];
    row.label.textContent = STAT_LABELS[stat];
    // `formatStat` prints the bare number at stage 0 and grows the stage and
    // effective value only once something has changed them, so the panel stays
    // quiet until it has something to say.
    row.value.textContent = formatStat('', view).trim();
    row.root.dataset['stage'] = view.stage === 0 ? 'flat' : view.stage > 0 ? 'up' : 'down';
    // The bar tracks the *effective* stat, so a Swords Dance is visible in
    // Simple mode too. Hiding the number must not hide the change.
    applyVerbosity(row, view.effective);

    /*
     * The speed marker survives Simple mode, deliberately.
     *
     * It is the one thing on the panel that answers a question rather than
     * stating a number, and it is exactly the question a player who turned the
     * numbers off still needs answered. The stage prompt names it for the same
     * reason.
     */
    const marksSpeed = stat === 'spe' && isFaster;
    row.marker.hidden = !marksSpeed;
    if (marksSpeed) {
      row.marker.textContent = '▲ first';
      row.marker.title = 'Moves first at this Speed';
    }
  }
}

/**
 * Show the number or the bar, according to the verbosity flag.
 *
 * **The only place the flag changes what a stat row looks like**, and it is a
 * pure swap of which child is hidden — no branch computes a different value, so
 * the two modes cannot disagree about what the stat is. `showsNumbers()` is
 * read here rather than passed in because it is a display preference and does
 * not belong in the same argument list as the battle state.
 */
function applyVerbosity(row: StatRow, effective: number): void {
  const numbers = showsNumbers();
  row.value.hidden = !numbers;
  row.bar.hidden = numbers;
  if (!numbers) {
    const share = Math.max(0, Math.min(1, effective / STAT_BAR_CEILING));
    row.barFill.style.width = `${share * 100}%`;
  }
}

/**
 * Ability and item chips.
 *
 * A hidden trait renders as a placeholder rather than vanishing: an empty slot
 * says "this Pokemon has no item", and a `?` says "it has one and you have not
 * been told". Those are different facts and the difference is worth a decision.
 * At the default tuning neither is hidden — see `tuning.revealOpponentAbility`.
 */
function renderTraits(container: HTMLElement, active: ActiveUiView): void {
  const chips: HTMLElement[] = [];

  if (active.ability) {
    const chip = el('span', 'badge badge--ability');
    if (active.ability.revealed) {
      chip.textContent = active.ability.name;
      chip.dataset['tip'] = `ability:${active.ability.id}`;
    } else {
      chip.textContent = 'Ability ?';
      chip.dataset['hidden'] = 'true';
    }
    chips.push(chip);
  }

  if (active.item) {
    const chip = el('span', 'badge badge--item');
    if (active.item.revealed) {
      chip.textContent = active.item.name;
      chip.dataset['tip'] = `item:${active.item.id}`;
    } else {
      chip.textContent = 'Item ?';
      chip.dataset['hidden'] = 'true';
    }
    chips.push(chip);
  }

  container.replaceChildren(...chips);
  container.hidden = chips.length === 0;
}

/**
 * A Pokemon's type, as a badge and **not** as a door into the reference wheel.
 *
 * Stage 4.5 made every type badge open the wheel. On a *move* badge that was
 * right and still is: "what does my Rock move hit" is a real question, and it
 * is the one question the per-move effectiveness markers do not answer — they
 * speak only about the Pokemon currently standing opposite. The move badges
 * below keep their `type:` tip for exactly that reason.
 *
 * On a Pokemon panel it was wrong, and a playtester found it. The wheel there
 * answers "what does Water do offensively", next to a Pokemon whose four moves
 * are drawn off-species and predict nothing of the kind — a Water type in
 * GYMRUN routinely knows no Water moves at all. So the badge invited a reading
 * that was true about the type and false about the Pokemon wearing it, which
 * is worse than no tooltip.
 *
 * The defensive half of that question now has a home built for it: the party
 * threat readout (`core/typeMatchup.ts`) answers "what beats my team and I
 * cannot answer" from the whole party, on the screens where a team-level fact
 * can be acted on.
 *
 * This is byte-identical to `screens/starter-select.typeChip` now, and stays
 * here rather than importing it: `scene.ts` is the module every screen imports
 * `el` from, so reaching the other way would invert the dependency and close a
 * cycle. The rule the two share is that a type badge is a *label*.
 */
function typeChip(type: string): HTMLElement {
  const chip = el('span', `type type--${type.toLowerCase()}`);
  chip.textContent = type;
  return chip;
}

function hpBand(fraction: number): 'high' | 'mid' | 'low' {
  if (fraction > 0.5) return 'high';
  return fraction > 0.2 ? 'mid' : 'low';
}

function renderMoves(
  container: HTMLElement,
  view: BattleUiView,
  onChoose: (choice: Choice) => void,
): void {
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
  // The defender's ability is passed down so an effectiveness the type chart
  // does not explain can point at the thing that explains it.
  const cause = view.opponent.ability?.revealed ? view.opponent.ability : null;
  container.replaceChildren(
    ...view.moves.map((move) => renderMove(move, view.awaitingChoice, cause, onChoose)),
  );
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
function renderBench(
  container: HTMLElement,
  view: BattleUiView,
  onChoose: (choice: Choice) => void,
): void {
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
  view: BattleUiView,
  onChoose: (choice: Choice) => void,
): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'bench__member';
  button.disabled = !view.awaitingChoice || !member.usable;

  const name = el('span', 'bench__name');
  name.textContent = member.name;
  const level = el('span', 'bench__level');
  level.textContent = `Lv${member.level}${genderMark(member.gender)}`;

  const types = el('span', 'bench__types');
  types.replaceChildren(...member.types.map((type) => typeChip(type)));

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
    status.dataset['tip'] = `status:${member.status}`;
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

function renderMove(
  move: MoveUiView,
  enabled: boolean,
  cause: { id: string; name: string } | null,
  onChoose: (choice: Choice) => void,
): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `move move--${move.type.toLowerCase()}`;
  button.disabled = !enabled || !move.usable;
  button.dataset['category'] = move.category.toLowerCase();

  const name = el('span', 'move__name');
  name.textContent = move.name;

  const meta = el('span', 'move__meta');
  const type = el('span', `type type--${move.type.toLowerCase()}`);
  type.textContent = move.type;
  type.dataset['tip'] = `type:${move.type}`;

  /*
   * The category badge, and the whole reason this stage exists.
   *
   * The physical/special split has been resolving correctly since Stage 0 —
   * Choice Band has been finding Attack and Choice Specs Special Attack for two
   * stages — and until now the only way to find out which side of it a move sat
   * on was to use it. A Pokemon with 150 Attack and 45 Special Attack has one
   * good move on that bar and three bad ones, and that was invisible.
   */
  // `badge--cat-status`, not `badge--status`: the latter is already the burn /
  // paralysis chip, and a move category sharing a class with a condition would
  // have been a colour bug waiting for the first status move on the bar.
  const category = el('span', `badge badge--category badge--cat-${move.category.toLowerCase()}`);
  category.textContent = CATEGORY_LABELS[move.category];
  // A tooltip trigger rather than a `title`: three letters are enough to
  // compare four buttons and not enough to learn from, and `title` is invisible
  // on the phone Stage 5 is about. Text lives in data/categoryInfo.ts.
  category.dataset['tip'] = `category:${move.category.toLowerCase()}`;
  category.tabIndex = 0;
  category.setAttribute('role', 'button');

  const power = el('span', 'move__power');
  /*
   * The em dash is gone for a status move that has something to say.
   *
   * It was a placeholder for "this move has no base power", which is true and
   * is not what the player needed there. `move.effect` is non-null exactly when
   * the projection found a readout to put in its place.
   */
  power.textContent = move.category === 'Status' ? '' : `${move.basePower} BP`;
  meta.append(type, category);
  if (move.effect) meta.append(moveEffectLine(move.effect));
  else meta.append(power);

  // Effectiveness, computed live against whatever is actually standing there.
  // Neutral prints nothing: a row where every button carries a badge is a row
  // where the badges stop being read, and the 0x goes unread with them.
  /*
   * Neutral and status both print nothing, and they are now distinguishable.
   *
   * `band` is null only for a status move; a neutral damaging move says
   * `'neutral'`. The renderer suppresses both, which is a display decision and
   * stays here — but the *reason* they are suppressed is different, and the
   * projection no longer conflates them. See core/battle/effectiveness.ts.
   */
  const label = move.band === null || move.band === 'neutral' ? null : formatEffectiveness(move.effectiveness);
  if (label && move.band) {
    const badge = el('span', 'badge badge--effect');
    badge.textContent = label;
    badge.dataset['band'] = move.band;
    badge.setAttribute('aria-label', `${move.name}: ${EFFECTIVENESS_LABELS[move.band]}`);
    if (move.abilityAffected && cause) {
      /*
       * A 0x with no reason attached reads as a bug.
       *
       * So the badge points its tooltip at the ability that caused it: tap the
       * outlined `0x` on an Earthquake and the answer is Levitate, in the
       * defender's own words. That turns "this does nothing" into "this does
       * nothing *because*", which is the difference between a UI the player
       * trusts and one they work around.
       */
      badge.dataset['ability'] = 'true';
      badge.dataset['tip'] = `ability:${cause.id}`;
      badge.tabIndex = 0;
      badge.setAttribute('role', 'button');
      badge.setAttribute(
        'aria-label',
        `${move.name}: ${EFFECTIVENESS_LABELS[move.band]} — from ${cause.name}`,
      );
    }
    meta.append(badge);
  }

  const pp = el('span', 'move__pp');
  pp.textContent = `PP ${move.pp}/${move.maxPp}`;
  if (move.maxPp > 0 && move.pp / move.maxPp <= 0.25) pp.classList.add('move__pp--low');

  const tags = moveTagRow(move.tags);
  button.append(name, meta, ...(tags ? [tags] : []), pp);
  button.addEventListener('click', () => onChoose(moveChoice(move.slot)));
  return button;
}

/**
 * The tag row on a move card. **One insertion point, both card shapes.**
 *
 * Part 6b's rule is that tags wire into the shared move card component rather
 * than into each screen. This is that component; `moveFacts` builds it for
 * every card outside a battle and `renderMove` builds it for the four buttons
 * inside one, so a move carries the same tags wherever the player meets it.
 *
 * The cap is applied upstream — the projection caps the battle buttons and the
 * calling screen caps its cards — because "how many fit" is a `Tuning` number
 * and this function's job is to draw what it is handed.
 *
 * Renders nothing at all for a move with no tags, rather than an empty row. An
 * empty row on three of four buttons is the ragged grid this feature exists to
 * remove.
 */
export function moveTagRow(tags: readonly MoveTag[]): HTMLElement | null {
  if (tags.length === 0) return null;
  const row = el('span', 'move__tags');
  for (const tag of tags) {
    const chip = el('span', `badge badge--tag badge--tag-${tag.id.toLowerCase()}`);
    chip.textContent = moveTagLabel(tag.id, tag.value);
    // A tooltip trigger like every other badge on screen. The words are in
    // `data/moveTags.ts`; the layer that shows them is `ui/tooltips.ts`, and
    // there is exactly one of those.
    chip.dataset['tip'] = `movetag:${tag.id}`;
    chip.tabIndex = 0;
    chip.setAttribute('role', 'button');
    row.append(chip);
  }
  return row;
}

/**
 * The one line that fills a status move's empty regions. **Part 6a.**
 *
 * On a damaging move the card carries base power, a band badge and an
 * effectiveness marker. On a status move all three are blank, and three blanks
 * in a row reads as a card that failed to load rather than as a move with no
 * base power. This goes in the same region.
 *
 * The sentence is composed by `data/moveCopy.ts` from structured fields the
 * projection supplied. Nothing here writes prose.
 */
export function moveEffectLine(effect: MoveEffectFields): HTMLElement {
  const line = el('span', 'move__effect');
  line.textContent = statusReadoutLine(effect);
  return line;
}

/** Short enough for a button, unambiguous enough to learn from. */
export const CATEGORY_LABELS: Record<MoveUiView['category'], string> = {
  Physical: 'PHYS',
  Special: 'SPEC',
  Status: 'STAT',
};

/**
 * The four facts about a move, rendered the same way everywhere.
 *
 * **Part 5's rule is that a move looks identical everywhere the player sees
 * it**, and this is the one function that makes that true. The battle button
 * (`renderMove`) builds it and then adds the two things that only exist during
 * a fight — remaining PP against max, and live effectiveness against whatever
 * is standing opposite. The reward card and the replacement screen build it and
 * add nothing.
 *
 * That split is also where Part 4 lands. Everything in here is an attribute of
 * the move itself; the one piece of *situational* information the UI is allowed
 * to show — effectiveness against the Pokemon currently on the field — is added
 * by the battle button and is unavailable to any screen that is not in a
 * battle. A reward card physically cannot render it, rather than being trusted
 * not to.
 *
 * `maxPp` is shown alone off the battle screen because a move nobody knows yet
 * has no remaining PP: printing "PP 0/24" for an offer would be stating a
 * resource the player has not spent.
 */
export function moveFacts(move: {
  name: string;
  type: string;
  category: MoveUiView['category'];
  basePower: number;
  maxPp: number;
  /**
   * Tags for this card's face, already capped. **Stage 4.7, Part 6b.**
   *
   * Handed in rather than derived, because deriving them needs `describeMove`
   * and this file may not reach for it — `test/boundaries.test.ts` restricts
   * `scene.ts` to the projection and four vocabulary modules. The caller has
   * the move and the holder and is where the cap lives, so the caller decides.
   *
   * **Absent, not empty, on an unassigned card.** STAB is a property of the
   * move and its holder together, so a reward card with no recipient chosen
   * passes nothing and gets no STAB tag rather than a wrong one.
   */
  tags?: readonly MoveTag[];
  /** The status readout that fills the empty base-power region. Part 6a. */
  effect?: MoveEffectFields | null;
}): { name: HTMLElement; meta: HTMLElement; pp: HTMLElement; tags: HTMLElement | null } {
  const name = el('span', 'move__name');
  name.textContent = move.name;

  const meta = el('span', 'move__meta');
  const type = el('span', `type type--${move.type.toLowerCase()}`);
  type.textContent = move.type;
  type.dataset['tip'] = `type:${move.type}`;

  const category = el('span', `badge badge--category badge--cat-${move.category.toLowerCase()}`);
  category.textContent = CATEGORY_LABELS[move.category];
  category.dataset['tip'] = `category:${move.category.toLowerCase()}`;
  category.tabIndex = 0;
  category.setAttribute('role', 'button');

  const power = el('span', 'move__power');
  power.textContent = move.category === 'Status' ? '' : `${move.basePower} BP`;
  meta.append(type, category);
  // The status readout takes the region base power would have occupied. A card
  // with neither — a status move nothing could be said about — falls back to
  // the em dash, which is at least an explicit "nothing here".
  if (move.effect) meta.append(moveEffectLine(move.effect));
  else if (move.category === 'Status') {
    power.textContent = '—';
    meta.append(power);
  } else meta.append(power);

  const pp = el('span', 'move__pp');
  pp.textContent = `PP ${move.maxPp}`;

  return { name, meta, pp, tags: moveTagRow(move.tags ?? []) };
}

/**
 * A move as a standalone card, for screens outside a battle.
 *
 * Same element classes as the battle button so the two are styled by one rule
 * set: a card that merely *resembled* the button would drift the first time
 * either was restyled.
 */
export function moveCard(move: {
  name: string;
  type: string;
  category: MoveUiView['category'];
  basePower: number;
  maxPp: number;
  tags?: readonly MoveTag[];
  effect?: MoveEffectFields | null;
}): HTMLElement {
  const card = el('div', `move move--card move--${move.type.toLowerCase()}`);
  card.dataset['category'] = move.category.toLowerCase();
  const facts = moveFacts(move);
  card.append(facts.name, facts.meta, ...(facts.tags ? [facts.tags] : []), facts.pp);
  return card;
}


/**
 * The mark shown after a level: male, female, or nothing at all.
 *
 * **Genderless renders the empty string, not a placeholder.** A dash or an "N"
 * would be a symbol the player has to learn in order to ignore, and the whole
 * point of showing gender is that it is a fact needing no explanation. The
 * absence of a mark is the readout.
 *
 * The symbols rather than the letters because they read at a glance next to a
 * number: "Lv50 M" parses as a stat and "Lv50 \u2642" does not.
 */
export function genderMark(gender: Gender): string {
  if (gender === 'M') return ' \u2642';
  if (gender === 'F') return ' \u2640';
  return '';
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}
