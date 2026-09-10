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
import type { FlaggedTurn } from '../core/battle/flags';
import { hpStateBare } from '../core/hpCopy';
import { BOOSTABLE_STATS, STAT_LABELS } from '../core/battle/stats';
import {
  formatEffectiveness,
  formatStat,
  type ActiveUiView,
  type BattleUiView,
  type MoveUiView,
} from '../core/battle/view';
import type { LocaleId } from '../data/locales';
import { bandChip, categoryChip, effectChip, neutralChip, statusChip, typeChip } from './chip';
import { el } from './dom';
import { showsNumbers } from './settings';
import { SCENES } from './theme/scenes';
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
  /** The glyph half of the speed marker; the only half a collapsed row shows. */
  markerGlyph: HTMLElement;
  markerWord: HTMLElement;
}

interface SidePanel {
  root: HTMLElement;
  name: HTMLElement;
  level: HTMLElement;
  /** The Part 7 label, beside the level on both sides of the field. */
  archetype: HTMLElement;
  types: HTMLElement;
  hpFill: HTMLElement;
  /** The chunk the last hit took, marking where the bar used to end. */
  hpShadow: HTMLElement;
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
   *
   * `turns` is the screen's one reading of the protocol batch that produced
   * this view, the same object the log is rendering from. Release C item 2
   * drives the jiggle off it, and the point of passing it rather than reading
   * it here is that there is then no second reading to disagree with the log.
   * Omitted on a redraw that is not the result of new protocol.
   */
  update(view: BattleUiView, onChoose: (choice: Choice) => void, turns?: readonly FlaggedTurn[]): void;
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
      /*
       * The HP shadow resolves on the same tap. It is the one thing on this
       * screen that stays on the glass after the numbers are already right, so
       * a player who taps to get on with the turn should not still be looking
       * at the last one's damage.
       */
      for (const panel of [foe, me]) {
        delete panel.hpShadow.dataset['fading'];
        panel.hpShadow.style.width = '0%';
        // The nudge stops mid-swing and the panel sits back where it belongs.
        delete panel.root.dataset['jiggle'];
      }
    },
    true,
  );

  return {
    root,
    update(view, onChoose, turns) {
      updateSidePanel(foe, view.opponent, true, view.fasterSide === 'opponent');
      updateSidePanel(me, view.player, false, view.fasterSide === 'player');
      root.dataset['faster'] = view.fasterSide;
      renderMoves(moves, view, onChoose);
      renderBench(bench, view, onChoose);
      jiggle({ me, foe }, turns);
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
  // Two halves, because the collapsed stat row has room for the arrow and not
  // for the word. Split in the DOM rather than swapped at update time: a
  // renderer that wrote different text at different viewport widths would be a
  // second source of truth about how wide the panel is.
  const markerGlyph = el('span', 'stat__marker-glyph');
  const markerWord = el('span', 'stat__marker-word');
  marker.append(markerGlyph, markerWord);
  marker.hidden = true;
  // The Simple-mode bar. Always built, never rebuilt — the toggle flips which
  // of `value` and `bar` is hidden, so switching modes cannot reflow the panel.
  const bar = el('div', 'stat__bar');
  const barFill = el('div', 'stat__bar-fill');
  bar.append(barFill);
  root.append(label, value, bar, marker);
  return { root, label, value, bar, barFill, marker, markerGlyph, markerWord };
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
  // The archetype label, through the one chip component (V2), neutral like
  // every label that is not a type.
  const archetype = neutralChip('', 'archetype', { tip: 'archetype:all' });
  archetype.tabIndex = 0;
  archetype.setAttribute('role', 'button');
  const types = el('span', 'panel__types');
  header.append(name, level, types);

  const hpTrack = el('div', 'hp');
  /*
   * The shadow goes in **before** the fill, so the fill paints over it.
   *
   * The two overlap by a hairline at the boundary — a fraction is a float and
   * the track is a few hundred device pixels — and a shadow drawn on top would
   * put a seam on the leading edge of the bar on exactly the frames the player
   * is watching it.
   */
  const hpShadow = el('div', 'hp__shadow');
  const hpFill = el('div', 'hp__fill');
  hpTrack.append(hpShadow, hpFill);

  /*
   * The archetype chip rides the meta row, not the header. **Fold cut 2.**
   *
   * It was next to the level, which is where it belongs by meaning — a fixed
   * property of this Pokemon, like the level and the types beside it. At 390px
   * it did not fit there. The foe's name carries an "Opposing" prefix, and name,
   * level, chip and type badges want 358px of a 329px header: the chip wrapped
   * to a second line and the foe panel measured 25px taller than the player's
   * for the same content, on a screen already over the fold.
   *
   * Both ways out cost something. Keeping it in the header and refusing to wrap
   * clips the name — measured, "Opposing Mudbray" renders as "Opposing Mu…" —
   * and the species the player is fighting is the one thing on the panel that
   * must not be abbreviated. Moving it down costs the adjacency, and the meta
   * row has 109px of slack after the HP text and a status chip, so it does not
   * cost a line.
   *
   * So the chip moves and the header does not wrap. It is still on **both**
   * panels, still ungated by the reveal policy, and still one tap from the
   * `archetype:all` tip; only the row it sits on changed.
   */
  const meta = el('div', 'panel__meta');
  const hpText = el('span', 'panel__hp-text');
  const status = statusChip('', '');
  meta.append(hpText, status, archetype);

  // Ability and item, on their own line. Both are revealable, and the reveal
  // flag is honoured here rather than upstream so one source decides it.
  const traits = el('div', 'panel__traits');
  const volatiles = el('div', 'panel__volatiles');

  /*
   * The six-stat block, collapsed by default on a phone. **Fold cut 3, and it
   * is the V5 budget brought forward — V5 should not spend it again.**
   *
   * Expanded, the block is four rows on a 390px screen and the two panels
   * together were 143px of the 206.5px the battle screen was over the fold by.
   * Collapsed it is one row of six values, which keeps every number on screen
   * — nothing here is hidden, only tightened — and the stage colouring rides on
   * `.stat__value`, so a boosted stat still reads as boosted at one row.
   *
   * The toggle lives *inside* the grid rather than under it, as a seventh
   * column, so opening the block costs a row and closing it gives that row
   * back. A control mounted below would have cost its own row permanently,
   * which is the height this cut exists to reclaim.
   *
   * Wide viewports never collapse: the media query in `styles.css` carries the
   * one-row form, so on a desktop the block is the four-row layout it has been
   * since Stage 4.5 and the toggle is not rendered at all.
   */
  const statsRoot = el('div', 'stats');
  statsRoot.dataset['expanded'] = 'false';
  const hpRow = createStatRow('hp');
  const rows = {} as Record<StatName, StatRow>;
  statsRoot.append(hpRow.root);
  for (const stat of BOOSTABLE_STATS) {
    const row = createStatRow(stat);
    rows[stat] = row;
    statsRoot.append(row.root);
  }

  const statsToggle = document.createElement('button');
  statsToggle.type = 'button';
  statsToggle.className = 'stats__toggle';
  statsToggle.setAttribute('aria-expanded', 'false');
  statsToggle.setAttribute('aria-label', 'Expand the stat block');
  statsToggle.textContent = '⌄';
  statsToggle.addEventListener('click', () => {
    const expanded = statsRoot.dataset['expanded'] !== 'true';
    statsRoot.dataset['expanded'] = String(expanded);
    statsToggle.setAttribute('aria-expanded', String(expanded));
    statsToggle.setAttribute('aria-label', expanded ? 'Collapse the stat block' : 'Expand the stat block');
    statsToggle.textContent = expanded ? '⌃' : '⌄';
  });
  statsRoot.append(statsToggle);

  root.append(header, hpTrack, meta, traits, volatiles, statsRoot);
  return { root, name, level, archetype, types, hpFill, hpShadow, hpText, status, volatiles, traits, hpRow, rows };
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
  const swapped = previous !== undefined && previous !== active.species;
  panel.root.dataset['species'] = active.species;
  if (swapped) {
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

  panel.types.replaceChildren(...active.types.map((type) => panelTypeChip(type)));

  /*
   * The chunk, and the shadow behind it. **Item 1.**
   *
   * The bar goes to the new value on the frame the update arrives, with no
   * width transition at all, and a shadow segment is left standing across the
   * span it vacated. That is the swap the playtest wanted: a sliding bar tells
   * you the number is changing and hides how much it changed, because by the
   * time you look at it the evidence has already been animated away. A chunk
   * that drops and leaves its outline says *how big the hit was* — one read, no
   * arithmetic, no log.
   *
   * The shadow fades over `--motion-hp-shadow`, and it is the only thing here
   * that takes time. Nothing waits for it: the bar, the numbers and the buttons
   * are all correct and interactive on the first frame.
   *
   * **Damage only.** A heal gets no shadow, because a shadow behind a bar that
   * grew would mark ground the Pokemon just gained as ground it lost. The
   * restore line from the round 2 patch already narrates a heal and is
   * untouched — see `hpLine` in `battle-log.ts`.
   */
  const before = Number(panel.hpFill.dataset['fraction'] ?? active.hp.fraction);
  panel.hpFill.style.width = `${active.hp.fraction * 100}%`;
  panel.hpFill.dataset['fraction'] = String(active.hp.fraction);
  panel.hpFill.dataset['band'] = hpBand(active.hp.fraction);
  /*
   * A swap draws no chunk, and this is not a nicety.
   *
   * The two bars belong to two different bodies, so the difference between them
   * is not damage — a healthy replacement coming in for a Pokemon at 10% would
   * paint nine tenths of the track as a hit that never happened, on the one
   * turn the player most needs to read the board correctly.
   */
  markHpChunk(panel.hpShadow, swapped ? active.hp.fraction : before, active.hp.fraction);
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
    ...active.volatiles.map((volatile) => neutralChip(volatile.label, 'volatile', { tip: `volatile:${volatile.id}` })),
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
      row.markerGlyph.textContent = '▲';
      row.markerWord.textContent = 'first';
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
    const chip = active.ability.revealed
      ? neutralChip(active.ability.name, 'ability', { tip: `ability:${active.ability.id}` })
      : neutralChip('Ability ?', 'ability');
    if (!active.ability.revealed) chip.dataset['hidden'] = 'true';
    chips.push(chip);
  }

  if (active.item) {
    const chip = active.item.revealed
      ? neutralChip(active.item.name, 'item', { tip: `item:${active.item.id}` })
      : neutralChip('Item ?', 'item');
    if (!active.item.revealed) chip.dataset['hidden'] = 'true';
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
function panelTypeChip(type: string): HTMLElement {
  return typeChip(type);
}

/**
 * Nudge each panel in the order its side acted. **Item 2.**
 *
 * ## What it is for
 *
 * The log has said who went first since the round 2 patch, in an ordinal at the
 * head of each entry. That is correct and it is *reading*, and the thing the
 * playtest actually reported — "priority doesn't exist" — was never fixed by a
 * number you have to go and look at. A panel that twitches when its Pokemon
 * acts puts the sequence where the player is already looking: on the board.
 *
 * ## It never computes an order
 *
 * The order is `turns`, which the screen read once and gave to the log as well.
 * There is no sort here, no Speed comparison and no second call to `readTurns`
 * — the panels move in the order the actions are already in, so the jiggle and
 * the log's ordinals cannot disagree. Priority marking is not this function's
 * business at all: it is the log's rule, applied by the reader, and the flag
 * strip surfaces it. A same-bracket turn is unmarked there and unremarkable
 * here — both sides jiggle either way, because both sides acted either way.
 *
 * ## Which turn, and which sides
 *
 * The last group in the batch that has any actions, and **not** the last group
 * with a turn number — those are different, and the difference is the whole
 * bug this comment exists to stop somebody reintroducing. An incremental
 * update arrives as `|move| … |move| … |upkeep| |turn|N+1`: the actions that
 * just resolved sit in the leading group, which has no number yet because the
 * line that would have numbered it came at the *start* of the previous batch,
 * and the trailing `|turn|` opens an empty group for a turn nobody has played.
 * Reading a turn number here nudges nothing, forever.
 *
 * The opening replay is skipped by its caller passing no reading at all, which
 * is the right place for it: an arrival is not a turn, and nudging both panels
 * at the start of every battle is noise.
 *
 * A side is placed by its *first* action in that turn, so a replacement switch
 * after a faint does not re-nudge a panel that has already moved. That caps the
 * sequence at two, which is what the two `data-jiggle` steps in the stylesheet
 * are: the delay is a token, not a number written from here.
 */
function jiggle(panels: { me: SidePanel; foe: SidePanel }, turns: readonly FlaggedTurn[] | undefined): void {
  for (const panel of [panels.me, panels.foe]) delete panel.root.dataset['jiggle'];
  if (!turns) return;

  const latest = [...turns].reverse().find((turn) => turn.actions.length > 0);
  if (!latest) return;

  const seen: ('p1' | 'p2')[] = [];
  for (const { action } of latest.actions) {
    if (!seen.includes(action.side)) seen.push(action.side);
  }

  // Restart rather than extend, the same as the swap beat and the HP chunk:
  // re-setting an attribute an element already carries does not replay a CSS
  // animation, and two turns running must each get their own nudge.
  void panels.me.root.offsetWidth;
  for (const [index, side] of seen.entries()) {
    // `p1` is the player throughout: the projection, the log formatter and the
    // protocol all take p1's view.
    const panel = side === 'p1' ? panels.me : panels.foe;
    panel.root.dataset['jiggle'] = String(index + 1);
  }
}

/**
 * The smallest drop worth drawing, as a fraction of the track.
 *
 * Below this the shadow is thinner than the rounding on its own corners and
 * reads as a rendering artefact rather than as a hit. Sand damage on a 300 HP
 * Pokemon is a real event and the log says so in words; a two-pixel smear on
 * the bar is not the place to say it a second time.
 */
const MIN_CHUNK = 0.005;

/**
 * Mark the span the bar just vacated, and fade it.
 *
 * Absolute inside the track and measured from the left in the same units the
 * fill uses, so the two agree by construction rather than by a shared
 * calculation: the shadow starts where the fill now ends and runs to where the
 * fill used to end.
 *
 * The animation is restarted rather than extended — re-setting an attribute an
 * element already carries does not replay a CSS animation, which is the same
 * thing the swap beat does above and for the same reason. Two hits in
 * consecutive turns each get their own fade.
 */
function markHpChunk(shadow: HTMLElement, before: number, after: number): void {
  const lost = before - after;
  if (lost < MIN_CHUNK) {
    // A heal, or nothing that happened. Clearing rather than leaving the last
    // chunk standing: a shadow that outlives the hit it describes is a lie
    // about the current turn.
    delete shadow.dataset['fading'];
    shadow.style.width = '0%';
    return;
  }
  shadow.style.left = `${after * 100}%`;
  shadow.style.width = `${lost * 100}%`;
  delete shadow.dataset['fading'];
  void shadow.offsetWidth;
  shadow.dataset['fading'] = 'true';
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
  types.replaceChildren(...member.types.map((type) => panelTypeChip(type)));

  const track = el('div', 'hp hp--slim');
  const fill = el('div', 'hp__fill');
  fill.style.width = `${member.hpFraction * 100}%`;
  fill.dataset['band'] = hpBand(member.hpFraction);
  track.append(fill);

  const meta = el('span', 'bench__meta');
  meta.textContent = `${member.hp} / ${member.maxHp}`;
  if (member.status) {
    meta.append(' ', statusChip(member.status, STATUS_LABELS[member.status] ?? member.status.toUpperCase(), { tip: `status:${member.status}` }));
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
  const type = typeChip(move.type, { tip: `type:${move.type}` });

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
  // A tooltip trigger rather than a `title`: three letters are enough to
  // compare four buttons and not enough to learn from, and `title` is invisible
  // on the phone Stage 5 is about. Text lives in data/categoryInfo.ts.
  const category = categoryChip(move.category, CATEGORY_LABELS[move.category], { tip: `category:${move.category.toLowerCase()}` });

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

  /*
   * The band, next to the base power it can disagree with. **R12.**
   *
   * Beside `BP` rather than up by the name, because the two numbers only make
   * sense together: Population Bomb reads `20 BP` and `BAND 4`, and a player
   * who meets those two facts in different regions of the card learns to
   * distrust both. Before the effectiveness marker, because that one is about
   * the Pokemon standing opposite and belongs at the situational end of the
   * row.
   *
   * `powerBand` off the projection, so the button resolves a band through the
   * same `bandOfMove` read as every card outside the fight.
   */
  const band = moveBandChip(move.powerBand);
  if (band) meta.append(band);

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
    const badge = effectChip(label, move.band);
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
 * The band badge on a move card. **One insertion point, both card shapes.** R12.
 *
 * The same rule `moveTagRow` below states, and for the same reason. Until R12
 * `bandChip` had exactly one caller — `screens/reward.ts`, which appended it to
 * the reward's *name* and computed it with a `bandOfMove` call of its own. So a
 * band was a property of one screen rather than of a move: the player met
 * `BAND 3` on the offer, then compared it against four unlabelled cards on the
 * replacement screen and four unlabelled buttons in the fight.
 *
 * Now it renders wherever a move renders, because `moveFacts` and `renderMove`
 * both come through here. **Neither resolves a band itself.** The number
 * arrives already resolved by `bandOfMove`, once, in the adapter — off the
 * battle screen through `MoveCardData.band`, on it through
 * `MoveUiView.powerBand` — and this function only decides whether there is a
 * badge to draw.
 *
 * Null renders nothing rather than an empty chip. A status move has no band,
 * and a placeholder for a bracket that does not apply is a symbol the player
 * has to learn in order to ignore.
 *
 * The tooltip comes with the chip and is not attached here: `bandChip` sets
 * `data-tip`, the one delegated layer in `ui/tooltips.ts` resolves it, and the
 * words are in `data/bandInfo.ts`. One mechanism, one text, both unchanged by
 * this stage — the badge simply now carries them onto seven more surfaces.
 */
export function moveBandChip(band: number | null | undefined): HTMLElement | null {
  return band === null || band === undefined ? null : bandChip(band);
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
    // A tooltip trigger like every other badge on screen. The words are in
    // `data/moveTags.ts`; the layer that shows them is `ui/tooltips.ts`, and
    // there is exactly one of those. Built through the one chip component.
    const chip = neutralChip(moveTagLabel(tag.id, tag.value), 'tag', { tip: `movetag:${tag.id}`, extra: `badge--tag-${tag.id.toLowerCase()}` });
    chip.tabIndex = 0;
    chip.setAttribute('role', 'button');
    row.append(chip);
  }

  /*
   * The overflow chip. **Fold cut 4, and it is built here rather than in CSS.**
   *
   * At 390px the face shows one tag and this chip stands for the rest, which is
   * what keeps a move card's height a fixed number instead of a function of how
   * many tags the move happens to carry: measured, three tags on every face put
   * the fourth move button back at 751.5, over the fold line, where one tag
   * holds it at 722.5.
   *
   * **Nothing is lost, which is why this is a chip and not a CSS `display:
   * none`.** The chip names how many were folded and carries all of them in one
   * `movetags:` tip, so a player on a phone reaches the same words a player on a
   * desktop reads off the face. Its `data-tip` is the layer every other badge on
   * this card already uses, and the words are still `data/moveTags.ts`'s.
   *
   * It is a tooltip trigger and not a disclosure toggle on purpose. In a battle
   * the card *is* the submit button, and `ui/drawer.ts` has the argument: a
   * control inside the move grid is one mistap away from spending a turn. A tip
   * opens a panel over the screen and submits nothing.
   *
   * Always rendered, never conditional on width. The stylesheet shows it only
   * where the face is narrow enough to have folded anything, so the DOM is the
   * same at every viewport and no resize can leave a stale row behind.
   */
  const folded = tags.slice(1);
  if (folded.length > 0) {
    // `tag-more`, not `tag`: it is a way to the tags, not one of them, and
    // `scripts/smoke.mjs` counts `.badge--tag` against `maxMoveTagsOnFace`. A
    // chip that stood for two tags and counted as a third would make the cap
    // read one higher than the face actually carries.
    const more = neutralChip(`+${folded.length}`, 'tag-more', {
      tip: `movetags:${folded.map((tag) => tag.id).join(',')}`,
    });
    more.tabIndex = 0;
    more.setAttribute('role', 'button');
    row.append(more);
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
  /**
   * The base-power band, already resolved by `bandOfMove`. **R12.**
   *
   * Handed in rather than derived, for the reason `tags` is: this file may not
   * reach for `describeMove` — `test/boundaries.test.ts` holds it to the
   * projection and four vocabulary modules — and the caller has already asked.
   * Every off-battle surface asks through `ui/move-detail.ts`.
   *
   * Optional, so a caller that has no band to give omits it and gets no badge.
   * Absent and null render identically and both mean "no bracket applies".
   */
  band?: number | null;
}): { name: HTMLElement; meta: HTMLElement; pp: HTMLElement; tags: HTMLElement | null } {
  const name = el('span', 'move__name');
  name.textContent = move.name;

  const meta = el('span', 'move__meta');
  const type = typeChip(move.type, { tip: `type:${move.type}` });
  const category = categoryChip(move.category, CATEGORY_LABELS[move.category], { tip: `category:${move.category.toLowerCase()}` });

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
  // The band, in the same place on the card as on the button: after the base
  // power, before the region only a battle can fill.
  const band = moveBandChip(move.band);
  if (band) meta.append(band);

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
  /** The base-power band. Passed straight through to `moveFacts`. R12. */
  band?: number | null;
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

export { el } from './dom';

// ---------------------------------------------------------------------------
// The world. Stage V3.
// ---------------------------------------------------------------------------

/**
 * The place behind every screen: a fixed, full-viewport container under the
 * shell, three layers of inline SVG silhouettes in the locale's tokens, and
 * one drifting element. Decorative. `pointer-events: none`, so nothing under
 * it is harder to tap; no information, so a player who cannot see it loses
 * nothing. It does not appear on the summary, which stays locale neutral.
 *
 * Mounted once by `app.ts` beside the shell, so it survives every screen
 * switch (the router toggles screens inside the shell). It follows
 * `<html data-locale>`, the one projection `theme/locale.ts` writes, through
 * a MutationObserver, so the app has a single writer for the region and any
 * instrument that re-tags the attribute re-tags the world too. `setLocale`
 * swaps the art; `null` empties it.
 *
 * Named `world`, not `scene`, because `.scene` is the battlefield above and
 * the two must not share a rule. The plan's word is scene; this file is
 * where the plan said it should live.
 *
 * Motion is V3.4's: the parallax listener and the drift loop. Under reduced
 * motion the drifting element is not mounted at all and the layers do not
 * move; `prefersReducedMotion` is read once per `setLocale`, so a change of
 * preference takes effect at the next region.
 */
export interface WorldScene {
  root: HTMLElement;
  setLocale(locale: LocaleId | null): void;
  /** The locale the art currently shows, or null. */
  current(): LocaleId | null;
  destroy(): void;
}

export const PARALLAX = { far: 0.2, mid: 0.5, near: 1 } as const;

function prefersReducedMotion(): boolean {
  return typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function createWorldScene(follow: HTMLElement | null = document.documentElement): WorldScene {
  const root = el('div', 'world');
  root.setAttribute('aria-hidden', 'true');
  // Empty until a region arrives.
  root.hidden = true;
  const far = el('div', 'world__layer world__layer--far');
  const mid = el('div', 'world__layer world__layer--mid');
  const near = el('div', 'world__layer world__layer--near');
  const scrim = el('div', 'world__scrim');
  root.append(far, mid, near, scrim);

  let locale: LocaleId | null = null;
  let reduced = prefersReducedMotion();

  /*
   * Parallax, from a passive scroll listener. One transform per layer per
   * scroll event, on the compositor (`translate3d`), never a layout. Under
   * reduced motion the listener does nothing and the layers stay put.
   */
  const onScroll = (): void => {
    if (reduced || !locale) return;
    const y = globalThis.scrollY || 0;
    far.style.transform = `translate3d(0, ${-y * PARALLAX.far}px, 0)`;
    mid.style.transform = `translate3d(0, ${-y * PARALLAX.mid}px, 0)`;
    near.style.transform = `translate3d(0, ${-y * PARALLAX.near}px, 0)`;
  };
  globalThis.addEventListener('scroll', onScroll, { passive: true });

  const readAttribute = (): LocaleId | null => (follow?.getAttribute('data-locale') as LocaleId | null) || null;
  const observer =
    follow && typeof MutationObserver === 'function'
      ? new MutationObserver(() => scene.setLocale(readAttribute()))
      : null;
  observer?.observe(follow as HTMLElement, { attributes: true, attributeFilter: ['data-locale'] });

  const scene: WorldScene = {
    root,
    current: () => locale,
    setLocale(next) {
      if (next === locale) return;
      locale = next;
      reduced = prefersReducedMotion();
      root.dataset['locale'] = next ?? '';
      root.hidden = !next;
      if (!next) {
        far.replaceChildren();
        mid.replaceChildren();
        near.replaceChildren();
        return;
      }
      const art = SCENES[next];
      far.innerHTML = art.far;
      mid.innerHTML = art.mid;
      near.innerHTML = art.near;
      // The drifting element rides the mid layer, and is not mounted at all
      // under reduced motion: not paused, not hidden, absent.
      if (!reduced) {
        const drift = el('div', 'world__drift');
        drift.innerHTML = art.drift;
        mid.append(drift);
      }
      far.style.transform = '';
      mid.style.transform = '';
      near.style.transform = '';
      onScroll();
    },
    destroy() {
      observer?.disconnect();
      globalThis.removeEventListener('scroll', onScroll);
      root.remove();
    },
  };
  scene.setLocale(readAttribute());
  return scene;
}
