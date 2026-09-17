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
import type { AbnormalityMark } from './abnormality';
import { hpStateBare } from '../core/hpCopy';
import { BOOSTABLE_STATS, STAT_LABELS } from '../core/battle/stats';
import {
  ACCURACY_STAGE_LABELS,
  ACCURACY_STAGE_NAMES,
  formatStage,
  formatStageMultiplier,
  stageMarkerLabel,
} from '../data/statStages';
import {
  formatEffectiveness,
  type ActiveUiView,
  type BattleUiView,
  type MoveUiView,
} from '../core/battle/view';
import type { LocaleId } from '../data/locales';
import { createBar, type Bar } from './bar';
import { outroHoldMs } from './theme/motion';
import {
  abilityChip,
  bandChip,
  categoryChip,
  effectChip,
  monTypeChip,
  neutralChip,
  stageChip,
  statusChip,
  typeChip,
} from './chip';
import { el } from './dom';
import { spriteFigure, spriteImg, spriteUrl } from './sprites';
import { pokeballSprite } from './slots';
import { SCENES } from './theme/scenes';
import { ARCHETYPE_DISPLAY } from '../data/archetypes';
import { TYPE_ICON_VIEWBOX, typeIconPath } from './theme/typeIcons';
import type { MoveTag } from '../data/moveTags';
import { MOVE_FACT_COLUMN, MOVE_FACT_COLUMNS, MOVE_FACT_INFO, moveFactAriaLabel } from '../data/moveFactInfo';
import type { MoveFact } from '../core/moveFacts';
import { statusReadoutLine, type MoveEffectFields } from '../data/moveCopy';
import { moveExplanation } from './move-explanation';
import {
  moveChoice,
  switchChoice,
  type Choice,
  type Gender,
  type MoveExplanation,
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

/**
 * A Pokemon standing on the stage. **V5.3.**
 *
 * The sprite and nothing else: no name, no numbers, no box. Everything a
 * player reads about this body is on the panel floating over the same band,
 * and the two are separate elements because they are separate facts — where
 * the Pokemon is, and what is true about it.
 */
interface Actor {
  root: HTMLElement;
  img: HTMLImageElement;
  /**
   * The body that just left, held only while it is sinking. **V5.5.**
   *
   * A swap is two things happening at once and one element cannot be both, so
   * the outgoing sprite is painted here and the incoming one on `img`. It is
   * empty at rest: the ghost's `src` is cleared when the beat ends, so nothing
   * on the stage is holding a Pokemon that is no longer in the fight.
   */
  ghost: HTMLImageElement;
  /**
   * The ball, for the capture outro. **The battle animation run.**
   *
   * Built with the actor and never drawn until `data-outro='caught'` is set,
   * for the reason the ghost is empty at rest: an element on the stage holding
   * something that is not in the fight is one repaint away from showing it.
   */
  ball: HTMLElement;
  /**
   * Where an abnormality is drawn. **Branch 3B.**
   *
   * Its own element, and that is forced rather than tidy:
   * `.sprite:not(.sprite--ghost)` already carries four animation rules — the
   * hit, the faint, the swap and the recall — and a fifth would cancel one of
   * them. The faint's comment in `styles.css` documents managing that exact
   * collision by rule order, and a fifth contender is not worth managing.
   *
   * So the mark animates alongside the sprite rather than on it, which also
   * buys the thing Branch 3B is for: an abnormality beat can run *concurrently*
   * with the hit it accompanies, so a turn carrying six of them costs exactly
   * what a turn carrying none costs.
   */
  mark: HTMLElement;
  /** `p1` faces away, `p2` faces the player. The protocol's own sides. */
  side: 'p1' | 'p2';
}

interface SidePanel {
  root: HTMLElement;
  name: HTMLElement;
  level: HTMLElement;
  /**
   * How much of this side is still standing, on the foe panel only.
   *
   * The player's own remaining team is already on screen, named and with its
   * HP, in the bench panel under the moves; a second readout of it would be
   * the same fact printed twice. The opposing side has no bench panel and
   * never will — it is the other player's hand — so this row is the only place
   * the count can live.
   */
  roster: HTMLElement;
  /** The Part 7 label, beside the level on both sides of the field. */
  archetype: HTMLElement;
  types: HTMLElement;
  /** The bar, with the chunk the last hit took. `ui/bar.ts` owns both. */
  hp: Bar;
  hpText: HTMLElement;
  status: HTMLElement;
  volatiles: HTMLElement;
  traits: HTMLElement;
  /**
   * The stat stages, as V2 chips. **V5.3.**
   *
   * Replaces the six-row block, which cost 89.75px a panel and printed a
   * number for every stat whether or not anything had happened to it. A stage
   * is the thing a turn *changes*, and a row that says `Atk 150` on turn one
   * and `Atk 150` on turn twenty was spending the budget to repeat itself.
   */
  stages: HTMLElement;
}

/**
 * How a fight ends on the stage. **The battle animation run, Branch 3.**
 *
 * Decided by `app.ts` from the `BattleReview` it already has — `won` and
 * whether the node carries a capture offer — so `core/` needs to know nothing
 * about it and no new projection field exists.
 *
 *   - `recall` — the fight was won. The opponent is called back by its trainer,
 *     and the player's own lead follows half a budget later.
 *   - `caught` — the fight was won against a wild body a ball is offered for.
 *     The opponent is taken by the ball instead of recalled; the player's lead
 *     is still recalled.
 *   - `defeat` — the fight was lost. No recall: the body that ended it has
 *     already sunk and `data-fainted` is holding it down. The hold still
 *     happens, which is the whole point — a loss is the case where the last
 *     turn's beats were most reliably swallowed, because a wipe ends the battle
 *     on the same frame the last body faints.
 */
export type OutroKind = 'recall' | 'caught' | 'defeat';

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
   * this view, the same object the log is rendering from. The stage's beats
   * are driven off it — Release C item 2's rule, moved onto the sprites by the
   * bar and beats patch — and the point of passing it rather than reading it
   * here is that there is then no second reading to disagree with the log.
   * Omitted on a redraw that is not the result of new protocol.
   */
  update(
    view: BattleUiView,
    onChoose: (choice: Choice) => void,
    turns?: readonly FlaggedTurn[],
    /**
     * The abnormality marks for this turn, already reduced. **Branch 3B.**
     *
     * Handed in rather than derived here, and that is a boundary rather than a
     * convenience: `test/boundaries.test.ts` forbids this file from reading a
     * flag, because a beat that could see severity is one step from a beat that
     * shows it. `ui/abnormality.ts` does the reduction; `screens/battle.ts`
     * calls it off the same single protocol reading it already makes, so there
     * is still one source of truth about a turn and now three consumers of it.
     */
    marks?: readonly AbnormalityMark[],
  ): void;
  /**
   * Play the end of the fight, and park until it has been seen.
   *
   * **This is the one thing on the battle screen that anything waits for**, and
   * it is why a fight ending in one hit showed no animation at all before it
   * existed: the last turn's beats began on the frame the KO arrived and
   * `app.ts` swapped to the result screen on the same microtask, so not a frame
   * of them was painted. `ui/theme/motion.ts` records the rule this supersedes
   * and the fact that it supersedes it exactly here.
   *
   * Resolves on whichever comes first:
   *
   *   1. the hold elapsing — its length read off `--motion-outro`, so reduced
   *      motion zeroes it through the stylesheet and no code branches on a
   *      media query;
   *   2. a tap, because a gate that cannot be skipped is a stall and every
   *      transition on this screen is skippable;
   *   3. `cancel()`, when the run is abandoned mid-hold.
   *
   * Never rejects. An abandoned run resolves rather than throwing: the caller
   * is `reviewBattle`, which is about to be torn down anyway, and a rejection
   * there would surface an abandoned run as a broken one — the exact confusion
   * `ui/pending.ts`'s `RunAbandoned` class exists to prevent.
   */
  outro(kind: OutroKind): Promise<void>;
  /** Abandon a parked outro, so a torn-down screen leaks no promise. */
  cancel(): void;
}

export function createScene(): Scene {
  const root = el('div', 'scene');
  /*
   * The stage. **V5.3, and the change the whole stage is named for.**
   *
   * Two sprites stand in the ambient scene the V3 world already draws behind
   * every screen, with no container of their own, and the two panels float
   * over the same band on a scrim rather than sitting above and below it as
   * cards. The plan's budget only closes this way — stacked, the opponent
   * panel, the sprite band and the player panel put the move grid past the 740
   * line the same table claims 156px of headroom against — and it is what the
   * plan's own sentence asks for: "stat panels float over the scene with no
   * chrome".
   *
   * Opponent upper right, player lower left. The two sprites and the two
   * panels are placed in opposite corners of the band so neither ever covers
   * the other, which is a layout decision and not an emphasis one: both
   * sprites are the same size, both panels wear the same scrim, and nothing
   * here draws one side heavier than the other.
   */
  const stage = el('div', 'stage');
  const foe = createSidePanel('foe');
  const me = createSidePanel('me');
  const foeActor = createActor('foe', 'p2');
  const meActor = createActor('me', 'p1');
  stage.append(foeActor.root, meActor.root, foe.root, me.root);

  const moves = el('div', 'moves');
  const bench = el('div', 'bench');

  root.append(stage, moves, bench);

  /*
   * Any transition must be skippable by tapping. Nothing here blocks input in
   * the first place — every beat is a CSS animation on a sprite or its actor,
   * and the move buttons are live throughout — but a player who taps *because*
   * something is moving should see it stop, so the first touch anywhere
   * settles both actors and resolves both bars.
   */
  /*
   * The parked outro, if one is running. **The battle animation run.**
   *
   * A bare resolver and a timer rather than `ui/pending.ts`'s `Pending<T>`,
   * and the difference is deliberate: a `Pending` rejects on `cancel`, which is
   * right for a decision nobody will answer and wrong here. This resolves on
   * every exit, because the caller is `reviewBattle` and an abandoned run that
   * threw out of it would read as a broken one.
   */
  let endOutro: (() => void) | null = null;

  /** Resolve a parked outro, if there is one. Idempotent. */
  const finishOutro = (): void => {
    const done = endOutro;
    endOutro = null;
    if (done) done();
  };

  root.addEventListener(
    'pointerdown',
    () => {
      // Every beat on the stage is the sprites' now: the swap since V5.5, the
      // lunge, the hit and the faint since the bar and beats patch.
      settleActor(foeActor);
      settleActor(meActor);
      /*
       * And the outro, which `settleActor` has just cleared the attribute for.
       * Resolving here is what makes the gate skippable: without it a tap would
       * stop the animation and leave the player waiting out the rest of a hold
       * with nothing moving, which is worse than the animation it cut short.
       */
      finishOutro();
      /*
       * The HP shadow resolves on the same tap. It is the one thing on this
       * screen that stays on the glass after the numbers are already right, so
       * a player who taps to get on with the turn should not still be looking
       * at the last one's damage.
       */
      for (const panel of [foe, me]) panel.hp.cancel();
    },
    true,
  );

  /**
   * How long to hold, in milliseconds. **Asked of the tuning, not of the CSS.**
   *
   * This used to read `--motion-outro` back off the computed style and parse
   * it, and that round trip was Bug A of the iOS animations patch. The number
   * it recovered had been written into that property by `theme/motion.ts`, in
   * this same process, out of `data/displayTuning.ts` — so at best the lookup
   * returned a number JavaScript already had, and at worst an engine
   * serialized the property in a spelling the parser did not take, the parse
   * failed, and the function returned **zero**. Zero is not a short hold. It is
   * no hold, which is the swallowed-last-turn defect this seam exists to fix,
   * restored silently and with nothing to show for it.
   *
   * `outroHoldMs` is still called at the moment of use rather than cached, so a
   * battle-speed change or an OS Reduce Motion change mid-run takes effect on
   * the next fight without anything re-registering — the property the old
   * comment claimed and the token read happened to deliver. What is gone is the
   * failure mode, and the floor is what removes it: there is no input, absent
   * or nonsense, from which this returns zero.
   */
  const outroMs = (): number => outroHoldMs();

  return {
    root,
    outro(kind) {
      // A second outro on one screen is not a thing that happens, but if it
      // did, the first must not be left parked forever.
      finishOutro();
      /*
       * A body that already fainted is not recalled. It has sunk, the static
       * `data-fainted` rule is holding it at the sink's end state, and raising
       * it to full opacity to shrink it again would be the double-animation the
       * ghost rule already avoids on a swap. So the winner's side gets the
       * beat and the loser's keeps its faint.
       */
      if (kind !== 'defeat') {
        foeActor.root.dataset['outro'] = kind === 'caught' ? 'caught' : 'recall';
        if (meActor.root.dataset['fainted'] !== 'true') meActor.root.dataset['outro'] = 'recall';
      }
      /*
       * **There is no zero branch, and its absence is the fix.**
       *
       * There used to be `if (ms <= 0) return Promise.resolve()`, which was the
       * line that turned a failed style lookup into the original defect: the
       * result screen rendered on the frame the KO landed and the last turn was
       * never painted. `outroHoldMs` cannot return zero — every path floors at
       * `reducedMotionOutroMs` — so the branch is unreachable, and an
       * unreachable branch that restores a bug is worse than no branch at all.
       * `test/battle-outro.test.ts` asserts the floor from this end and
       * `test/no-computed-timing.test.ts` from the other.
       */
      const ms = outroMs();
      return new Promise<void>((resolve) => {
        const timer = globalThis.setTimeout(() => {
          endOutro = null;
          resolve();
        }, ms);
        endOutro = () => {
          globalThis.clearTimeout(timer);
          resolve();
        };
      });
    },
    cancel() {
      settleActor(foeActor);
      settleActor(meActor);
      finishOutro();
    },
    update(view, onChoose, turns, marks) {
      updateActor(foeActor, view.opponent);
      updateActor(meActor, view.player);
      // Whether each bar drew a chunk. The hit beat reads this and nothing
      // else, so the recoil and the chunk agree by construction.
      /*
       * **The turn's order, read once and used three times.** See `actingOrder`.
       *
       * It has to be read *before* the panels redraw, because the chunk a bar
       * draws is now slotted to the move that caused it and `Bar.set` writes the
       * slot and the chunk in one go. `beats` is handed the same list rather
       * than re-deriving it, so the lunge, the recoil and the chunk cannot
       * disagree about who went first.
       */
      const order = actingOrder(turns);
      // No reading, no slot: the bar fades its chunk across the whole budget
      // from now, which is what it did before slots existed. See `hitSlot`.
      const chunkSlot = (side: 'p1' | 'p2'): number | null =>
        order.length === 0 ? null : hitSlot(side, order);
      const hit = {
        foe: updateSidePanel(foe, view.opponent, true, view.fasterSide === 'opponent', chunkSlot('p2')),
        me: updateSidePanel(me, view.player, false, view.fasterSide === 'player', chunkSlot('p1')),
      };
      // The opposing side's count, on the opposing panel and nowhere else.
      renderRoster(foe.roster, view.opponentLeft);
      root.dataset['faster'] = view.fasterSide;
      renderMoves(moves, view, onChoose);
      renderBench(bench, view, onChoose);
      beats({ me: meActor, foe: foeActor }, hit, order, marks ?? []);
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

/**
 * A sprite on the stage, built once and pointed at a species.
 *
 * `p1` is the near side and wears the back sprite, `p2` the far side and the
 * front — the protocol's own sides, so nothing here translates between two
 * vocabularies. The size is fixed in the stylesheet rather than left to the
 * image, because the stage's height is a budgeted number and a band that
 * resized when a sprite finished loading would move the move grid under a
 * thumb already descending.
 *
 * Decorative, and `aria-hidden` for that reason: the panel beside it names the
 * Pokemon, its level, its types and its HP, so a screen reader that also read
 * the sprite would be told the same body twice. `sprites.ts` hides a sprite
 * that fails to load rather than showing a broken-image glyph, which is what a
 * sandbox with no route to Showdown's CDN gets.
 */
function createActor(kind: 'me' | 'foe', side: 'p1' | 'p2'): Actor {
  const root = el('div', `stage__actor stage__actor--${kind}`);
  root.setAttribute('aria-hidden', 'true');
  const ghost = spriteImg('', side);
  ghost.classList.add('sprite--ghost');
  const img = spriteImg('', side);
  /*
   * The ball is painted over both, because a capture closes over the body
   * rather than beside it. Its cell is resolved once here rather than on every
   * outro: `ui/slots.ts` owns the one `Icons` instance and the sheet URL is
   * constant, so this costs one style write per battle screen.
   */
  const ball = el('span', 'stage__ball');
  ball.setAttribute('aria-hidden', 'true');
  const sprite = pokeballSprite();
  ball.style.backgroundImage = sprite.backgroundImage;
  ball.style.backgroundPosition = sprite.backgroundPosition;
  /*
   * The abnormality mark. Built once and never drawn at rest, like the ball —
   * an element on the stage holding a thing that is not happening is one
   * repaint away from showing it.
   */
  const mark = el('span', 'stage__mark');
  mark.setAttribute('aria-hidden', 'true');
  // Ghost first, so the arriving sprite paints over the one it replaced.
  root.append(ghost, img, ball, mark);
  return { root, img, ghost, ball, mark, side };
}

/**
 * Point an actor at whatever is standing there now.
 *
 * Guarded on the species the actor last drew, for the reason the panel's swap
 * beat is: re-setting `src` to the URL it already holds makes the browser
 * re-decode an image every turn, and on a phone that is a repaint per move.
 * `data-species` is the same marker `updateSidePanel` keeps, and V5.5 reads it
 * to decide whether a body changed.
 */
function updateActor(actor: Actor, active: ActiveUiView): void {
  const previous = actor.root.dataset['species'];
  /*
   * The faint. **The bar and beats patch.**
   *
   * Two attributes, because a faint is two things: an event, which gets a
   * beat, and a state, which the stage has to hold until the body is
   * replaced. `data-fainting` is set on the one update where the projection's
   * `fainted` flips on an unchanged species, and the stylesheet runs
   * `sprite-sink` off it — the same keyframes as the swap, because a body
   * leaving the fight is the same kind of event however it left. `data-fainted`
   * mirrors the projection every update, and a static rule holds the sink's
   * own end state on it, so a tap and reduced motion both land where the
   * animation would have: a KO'd sprite is down, and stays down, until the
   * replacement rises through the swap beat below.
   *
   * Cleared, not restarted, on every update. The event fires once per body by
   * construction — a fainted Pokemon does not faint again — so there is no
   * second beat to give its own restart to.
   */
  const wasFainted = actor.root.dataset['fainted'] === 'true';
  delete actor.root.dataset['fainting'];
  if (active.fainted) actor.root.dataset['fainted'] = 'true';
  else delete actor.root.dataset['fainted'];
  if (previous === active.species) {
    if (active.fainted && !wasFainted && previous !== undefined) actor.root.dataset['fainting'] = 'true';
    return;
  }
  actor.root.dataset['species'] = active.species;

  /*
   * The swap beat, scene-aware. **V5.5, and it is the one thing V5 adds to
   * Release C's motion.**
   *
   * The outgoing body sinks into the near layer of the world V3 draws behind
   * the stage and the incoming one rises out of it. Two sprites for two
   * halves: `ghost` keeps the Pokemon that left just long enough to leave, and
   * `img` arrives over it.
   *
   * **Never on the first draw.** `previous` is undefined until a species has
   * been drawn once, and an opening switch-in is not a swap — animating it
   * would sink a body that was never on the field at the start of every
   * battle. Same rule, same reason, as the panel beat this replaces.
   *
   * **It fires on a switch and on nothing else**, which is what makes the
   * plan's "adds nothing to the per-turn budget" true rather than aspirational:
   * a turn where both sides used a move never sets the attribute, so there is
   * no animation to run and nothing to wait for. Nothing waits for it even
   * when it does fire — the bar, the numbers and the move buttons are correct
   * and interactive on the first frame, and a tap anywhere cancels it.
   */
  if (previous !== undefined) {
    // A body that fainted has already sunk. Giving it to the ghost would raise
    // it to full opacity and sink it a second time under the replacement, so
    // the ghost stays empty and only the arrival is drawn.
    if (wasFainted) actor.ghost.removeAttribute('src');
    else actor.ghost.src = actor.img.src;
    // Restart rather than extend: re-setting an attribute an element already
    // carries does not replay a CSS animation, and two switches in consecutive
    // turns must each get their own beat.
    delete actor.root.dataset['swapped'];
    void actor.root.offsetWidth;
    actor.root.dataset['swapped'] = 'true';
  }

  actor.img.src = spriteUrl(active.species, actor.side);
  actor.img.alt = active.species;
  delete actor.img.dataset['missing'];
}

/**
 * End every beat on this actor and let go of the body that left.
 *
 * Called on a tap. Clearing the ghost's `src` matters beyond tidiness: a stage
 * still holding a Pokemon that is no longer in the fight is one repaint away
 * from showing it again.
 *
 * `data-fainted` is deliberately not on the list. It is state, not a beat: the
 * static rule on it is where the faint's animation ends anyway, so a tap that
 * cut the sink short lands the sprite exactly where the sink was going.
 */
function settleActor(actor: Actor): void {
  delete actor.root.dataset['swapped'];
  delete actor.root.dataset['acted'];
  delete actor.root.dataset['hit'];
  delete actor.root.dataset['fainting'];
  /*
   * The outro is a beat like the rest, so a tap ends it. **Unlike the rest it
   * is also a gate**, and clearing the attribute alone would leave the player
   * looking at a settled stage while `outro()` was still parked — so the
   * pointerdown handler resolves the promise in the same breath. `data-fainted`
   * still stays off this list: it is state, not a beat.
   */
  delete actor.root.dataset['outro'];
  // The abnormality beat is a beat like the rest, so a tap ends it. Branch 3B.
  delete actor.root.dataset['abnormal'];
  delete actor.root.dataset['abnormalSlot'];
  actor.ghost.removeAttribute('src');
}

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
  /*
   * The header is the name and the level, and nothing else. **V5.3/V5.4.**
   *
   * The archetype chip and the type badges used to sit up here beside them,
   * which was right on a panel that owned the full width of the screen. A
   * floating panel owns the width the sprite opposite it does not want — 254 at
   * 390 — and `Opposing Mudbray Lv22` plus a `PHYS. ATTACKER` chip is more than
   * that, so the header wrapped to a second line on every panel and the two
   * panels grew until they overlapped each other inside the band.
   *
   * They are chips, and the panel has a row for chips. Moving them there costs
   * a line rather than buying one, and it puts the three kinds of label a
   * Pokemon wears — what it is, what it is built for, what it is carrying — on
   * one row in that order.
   */
  header.append(name, level);

  // The one bar with a shadow: this is the only surface where a drop is a hit
  // the player is watching land. `ui/bar.ts` says why the shadow paints first.
  const hp = createBar({ shadow: true });

  const meta = el('div', 'panel__meta');
  const hpText = el('span', 'panel__hp-text');
  hpText.dataset['tutorial'] = 'hp';
  const status = statusChip('', '');
  meta.append(hpText, status);

  /*
   * The opposing side's remaining count. **A row, not a chip.**
   *
   * It is above the name rather than among the chips because it is a fact
   * about the *side* and everything in `panel__chips` is a fact about the one
   * Pokemon standing. A "3/4 left" sitting between `PHYS. ATTACKER` and
   * `BRN` would read as another thing true about that body.
   *
   * Empty on the player's panel and hidden by the stylesheet when it is, so
   * `panel--me` costs no line for it.
   */
  const roster = el('div', 'panel__roster');

  /*
   * One row for everything a turn can have done to this Pokemon: its stat
   * stages, its ability and item, and whatever it is currently suffering.
   *
   * Three containers rather than one, because they are three different kinds
   * of fact and each has its own emptiness rule — a Pokemon with no boosts,
   * no revealed traits and no volatiles renders three empty spans and no row
   * at all. They share a line because the panel is floating over a sprite now
   * and every line it takes is a line of the stage it covers.
   */
  const chips = el('div', 'panel__chips');
  chips.dataset['tutorial'] = 'status';
  const stages = el('div', 'panel__stages');
  // Ability and item. Both are revealable, and the reveal flag is honoured
  // here rather than upstream so one source decides it.
  const traits = el('div', 'panel__traits');
  const volatiles = el('div', 'panel__volatiles');
  /*
   * Reading order: what it is, what it is built for, what it is carrying, what
   * is happening to it, and what the board has done to it. Fixed properties
   * first and the turn's own facts last, so a row that grows during a fight
   * grows at the end rather than pushing the identity along.
   */
  chips.append(types, archetype, traits, volatiles, stages);

  root.append(roster, header, hp.root, meta, chips);
  return { root, name, level, roster, archetype, types, hp, hpText, status, volatiles, traits, stages };
}

/**
 * The opposing side's remaining count, as a row of marks and the number.
 *
 * ## Both, and not one or the other
 *
 * The marks are the thing a player reads without looking — four dots with one
 * dimmed is a fact taken in at a glance — and the number is the thing that
 * still works at ten, on a phone, for a player who cannot tell nine dots from
 * ten. Neither alone covers the range the readout has to cover, so the row
 * carries both and the marks are `aria-hidden`: a screen reader gets the
 * sentence once, off the row's own label, rather than ten list items and then
 * the sentence.
 *
 * ## The unknown total is drawn, not guessed
 *
 * `total: null` is a wild encounter, where the player has not been told how
 * many there are. The row then shows only the standing marks and reads
 * `1/? left`. It does **not** fall back to the standing count as a total,
 * which would be the UI inventing a fact — and would be wrong in the one
 * direction that matters, because it would say "this is the last one" every
 * single turn.
 *
 * ## Ten is the width it is built to, not the width it usually draws
 *
 * A side fields at most `MAX_TEAM_SIZE` today, and the row is laid out so that
 * ten marks still sit on one line at the narrowest phone this repo pins. That
 * is deliberate slack: a readout that breaks at a number the game could later
 * field is a readout that has to be rebuilt, and the cost of the slack is a
 * flex rule.
 *
 * ## It is an attribute
 *
 * It says what is on the other side of the field. It does not say whether that
 * is good news, it carries no colour that ranks it, and it never compares the
 * two sides — `CLAUDE.md`'s copy rule.
 */
function renderRoster(row: HTMLElement, left: { standing: number; total: number | null }): void {
  const { standing, total } = left;
  /*
   * Nothing at all before the first real reading.
   *
   * A zero-of-zero row would flash on the frame the screen attaches, and an
   * empty container renders as no line rather than as an empty one.
   */
  if (total === null && standing <= 0) {
    row.replaceChildren();
    delete row.dataset['known'];
    row.removeAttribute('aria-label');
    return;
  }

  row.dataset['known'] = total === null ? 'false' : 'true';
  const marks = el('span', 'panel__roster-marks');
  marks.setAttribute('aria-hidden', 'true');
  // A mark per member when the total is known, so the ones already down are
  // still on the row as spent slots. Only the standing ones when it is not,
  // because a spent slot the player was never told about is not a fact.
  const drawn = total === null ? standing : total;
  for (let i = 0; i < drawn; i++) {
    const mark = el('span', 'panel__roster-mark');
    if (i < standing) mark.dataset['on'] = 'true';
    marks.append(mark);
  }

  const label = el('span', 'panel__roster-label');
  label.textContent = `${standing}/${total ?? '?'} left`;
  row.setAttribute('aria-label', `Opponent: ${standing} of ${total ?? 'an unknown number'} left`);
  row.replaceChildren(marks, label);
}

/** Redraw a panel. Returns whether its bar drew a chunk, which is what the hit beat keys off. */
function updateSidePanel(
  panel: SidePanel,
  active: ActiveUiView,
  isFoe: boolean,
  isFaster: boolean,
  /**
   * Which slot of the turn a hit on this side belongs to, from `hitSlot`.
   *
   * Passed down rather than read here, so the chunk this bar draws and the
   * recoil `beats` writes on the same body are two uses of one reading.
   */
  slot: number | null = null,
): boolean {
  /*
   * Whether the body on this side changed. **The panel reads it; it no longer
   * animates it. V5.5.**
   *
   * Detected from the species the panel last drew rather than from a switch
   * event, because the panel is updated from a projection and has no event
   * stream — and because that makes it correct for every way a Pokemon can be
   * replaced: a voluntary switch, a forced one after a faint, and whatever
   * Stage 5 adds. `updateActor` reads it the same way and for the same reason.
   *
   * The beat itself moved to the sprite, which is the thing that changed: the
   * panel is a scrim over a body now, and two animations for one event is
   * noise. What the panel still uses the flag for is the HP chunk — a swap
   * draws none, because the difference between two different bodies' bars is
   * not damage.
   *
   * Never on the first draw: an opening switch-in is not a swap.
   */
  const previous = panel.root.dataset['species'];
  const swapped = previous !== undefined && previous !== active.species;
  panel.root.dataset['species'] = active.species;

  // Species, never the battle name. **4.8.0.1: species stays the label.** The
  // projection carries both; the nickname is state the panel does not show.
  panel.name.textContent = isFoe ? `Opposing ${active.species}` : active.species;
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
   *
   * The rule itself lives in `ui/bar.ts` now, with every bar in the game; this
   * panel only decides one input to it. **A swap draws no chunk, and this is
   * not a nicety.** The two bars belong to two different bodies, so the
   * difference between them is not damage — a healthy replacement coming in
   * for a Pokemon at 10% would paint nine tenths of the track as a hit that
   * never happened, on the one turn the player most needs to read the board
   * correctly.
   */
  const hit = panel.hp.set(active.hp.fraction, { chunk: !swapped, slot });
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
   * The stat stages, as chips, and **only the ones that are not zero.**
   * **V5.3.**
   *
   * The six-row block printed a number for every stat on every turn whether or
   * not anything had happened to it, and cost 89.75px a panel to do it. A
   * stage is the thing a turn *changes*: `Atk +2` after a Swords Dance, `Spe
   * -1` after a String Shot, nothing at all until something moves. So the row
   * is empty on turn one and stays empty until the battle has something to say,
   * which is the same rule the flag strip follows one band below.
   *
   * Through `stageChip`, the V2 component, whose own docstring has said "for
   * the battle panel to adopt in V5" since that stage landed. `badge--up` and
   * `badge--down` carry the direction, which is a fact about the sign and not
   * an emphasis: a `+2` and a `-2` are the same chip at the same weight, and
   * `--stage-up` / `--stage-down` are the same two readout colours the block
   * used before this stage.
   *
   * **Base stats leave the battle panel with the block.** They are not gone
   * from the run — the party drawer is reachable in a battle and carries the
   * player's six for every member — but the opponent's are now read off the
   * archetype label rather than as numbers. That is the plan's budget, and the
   * V5 report records it as the one thing this stage takes away.
   */
  const stages = BOOSTABLE_STATS.filter((stat) => active.stats[stat].stage !== 0).map((stat) =>
    stageChip(active.stats[stat].stage, STAT_LABELS[stat]),
  );

  /*
   * Accuracy and evasion, on the same row and in the same component. **4.8.0.3.**
   *
   * They arrive on their own projection field rather than in the stat block,
   * because they have no base stat behind them — see `AccuracyStagesView`. On
   * the row that distinction is invisible and should be: a raised evasion is
   * the reason a move missed, and a player looking for that reason is looking
   * at the same row they would look at for a dropped Attack.
   *
   * Second, after the five, because the five are what most turns move. The
   * chips carry the accuracy ladder, which is a different table: `+1` here is
   * x1.3 rather than x1.5.
   */
  for (const name of ACCURACY_STAGE_NAMES) {
    const stage = active.accuracyStages[name];
    if (stage !== 0) stages.push(stageChip(stage, ACCURACY_STAGE_LABELS[name], 'accuracy'));
  }

  /*
   * The Pocket marker: one chip that opens the set. **4.8.0.3.**
   *
   * The density ruling is that no mode removes a fact, and a multiplier plus a
   * ladder is wider than the stage integer it replaced. Detailed and Simple
   * show the chips inline; Pocket shows this instead and the stylesheet swaps
   * them, so both states exist in the DOM on every render and nothing has to
   * re-render when the density changes.
   *
   * Through the existing tooltip layer — `data-tip`, one delegated listener,
   * `ui/tooltips.ts`. Not a second mechanism, which the patch bars. The set
   * rides on `data-detail` rather than being looked up, for the same reason a
   * threat count does: it is a fact about *this* render, not a table entry.
   */
  if (stages.length > 0) stages.unshift(stageMarker(stages.length, active));

  /*
   * The speed marker survives the block that used to carry it.
   *
   * It was the one thing on the six rows that answered a question rather than
   * stating a number, it is a fact about the board as it stands right now —
   * the same kind of fact as the live effectiveness marker, and the one
   * exception the copy rule names — and Stage 4.5's prompt asks for it by
   * name. So it moves onto the chip row rather than leaving with the rows.
   */
  if (isFaster) {
    const marker = neutralChip('\u25b2 FIRST', 'first');
    marker.title = 'Moves first at this Speed';
    marker.setAttribute('aria-label', marker.title);
    stages.push(marker);
  }

  panel.stages.replaceChildren(...stages);
  panel.stages.hidden = stages.length === 0;
  return hit;
}

/**
 * The collapsed stage marker Pocket shows in place of the chips.
 *
 * `data-detail` carries the whole set as `label multiplier stage` triples,
 * newline separated, and `ui/tooltips.ts` splits it back apart. A serialized
 * string rather than a lookup key because there is nothing to look up: which
 * stages a Pokemon is on right now is not a table, it is this turn.
 *
 * The label is a count and nothing else. "STAGES 2" says how many facts are
 * folded; "boosted" or "weakened" would be a reading of whether the fold is
 * good news, which is the editorial rule's exact prohibition.
 */
function stageMarker(count: number, active: ActiveUiView): HTMLElement {
  const rows: string[] = [];
  for (const stat of BOOSTABLE_STATS) {
    const stage = active.stats[stat].stage;
    if (stage !== 0) rows.push(`${STAT_LABELS[stat]}\t${formatStageMultiplier(stage)}\t${formatStage(stage)}`);
  }
  for (const name of ACCURACY_STAGE_NAMES) {
    const stage = active.accuracyStages[name];
    if (stage !== 0) {
      rows.push(
        `${ACCURACY_STAGE_LABELS[name]}\t${formatStageMultiplier(stage, 'accuracy')}\t${formatStage(stage)}`,
      );
    }
  }
  const marker = neutralChip(stageMarkerLabel(count), 'stages', { tip: 'stages:active' });
  marker.dataset['detail'] = rows.join('\n');
  marker.tabIndex = 0;
  marker.setAttribute('role', 'button');
  return marker;
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
    /*
     * Through `abilityChip` when it is revealed — the same builder every other
     * surface uses since the chip-audit patch, which is what makes it focusable.
     *
     * The unrevealed case stays a plain `neutralChip`: there is nothing to open,
     * and a focusable chip that opens nothing is a keyboard trap for a reader
     * who cannot see that it is a placeholder. `revealOpponentAbility` decides
     * which branch this is and nothing here second-guesses it.
     */
    const chip = active.ability.revealed
      ? abilityChip(active.ability.name, active.ability.id)
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
 * A Pokemon's type, as a badge that **does** open the reference wheel again.
 *
 * **Chip-audit patch, 2026-09-17, question 1. Read the objection below before
 * changing this back, and read this paragraph before agreeing with it.**
 *
 * The author's decision was that a Pokemon's type chip is a clickable chip on
 * every surface that draws a Pokemon, this panel included. The argument this
 * comment carried against that is preserved verbatim underneath, because it is
 * the better-evidenced half of the disagreement — it came from a playtester and
 * it is specifically about *this* game rather than about tooltips in general.
 *
 * What the objection establishes, exactly: the wheel's **offensive** half is
 * misleading on a Pokemon badge, because moves are drawn off-species and a
 * Water type routinely knows no Water move. What it does not establish is that
 * the **defensive** half is, and the defensive half is the question a player
 * asks of the thing standing opposite them. The wheel renders both halves, so
 * restoring the trigger restores the misleading half with the useful one.
 *
 * That is a live tension, not a settled one. The narrowing that would close it
 * — a Pokemon badge opening the defending half only — was not what was asked
 * for and is not built here; it is recorded in the patch report as the one
 * follow-up this item leaves open.
 *
 * ---
 *
 * The original note, which argued the opposite and won for three patches:
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
 * It stays a function here rather than a direct call, so that the panel keeps
 * one place to change its mind: `scene.ts` is the module every screen imports
 * `el` from, so importing a screen's wrapper the other way would invert the
 * dependency and close a cycle. `monTypeChip` comes from `ui/chip.ts`, which
 * is below both.
 */
function panelTypeChip(type: string): HTMLElement {
  return monTypeChip(type);
}

/**
 * The turn, as beats on the stage: each actor lunges in the order its side
 * acted, and each sprite that lost HP recoils in the slot after the lunge that
 * took it. **Release C item 2, moved from the panel to the sprite by the bar
 * and beats patch.**
 *
 * ## What it is for
 *
 * The log has said who went first since the round 2 patch, in an ordinal at the
 * head of each entry. That is correct and it is *reading*, and the thing the
 * playtest actually reported — "priority doesn't exist" — was never fixed by a
 * number you have to go and look at. A body that lunges when it acts puts the
 * sequence where the player is already looking: on the board.
 *
 * It was the panel that moved until this patch. The panel has been a scrim
 * over a body since V5.3, and V5.5 moved the swap beat onto the body for the
 * reason that applies here too: two animations for one event is noise, and
 * the thing that acted is the sprite. The panel no longer moves at all.
 *
 * ## It never computes an order
 *
 * The order is `turns`, which the screen read once and gave to the log as well.
 * There is no sort here, no Speed comparison and no second call to `readTurns`
 * — the actors move in the order the actions are already in, so the lunge and
 * the log's ordinals cannot disagree. Priority marking is not this function's
 * business at all: it is the log's rule, applied by the reader, and the flag
 * strip surfaces it. A same-bracket turn is unmarked there and unremarkable
 * here — both sides lunge either way, because both sides acted either way.
 *
 * ## It never reads a flag
 *
 * The hit is the same size for every hit. Whether the move was super
 * effective, resisted or a crit is on the flag strip in words and in the size
 * of the chunk the bar just drew; a recoil that grew with the multiplier would
 * be a verdict drawn on the board, which is the one thing the copy rule bars.
 * So this function reads `action.side` off the turn and the chunk boolean off
 * the bar, and nothing else.
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
 * Reading a turn number here moves nothing, forever.
 *
 * The opening replay is skipped by its caller passing no reading at all, which
 * is the right place for it: an arrival is not a turn, and lunging both actors
 * at the start of every battle is noise. A chunk with no reading — which the
 * jsdom tests produce and the app does not — lands in the first slot.
 *
 * A side is placed by its *first* action in that turn, so a replacement switch
 * after a faint does not re-place an actor that has already moved. That caps
 * the sequence at two, which is what the two `data-acted` steps in the
 * stylesheet are: the delays are tokens, not numbers written from here.
 *
 * ## Which slot a hit lands in
 *
 * The slot of the *other* side's lunge: the recoil is the answer to the move
 * that caused it, so it follows that move's beat. When the other side did not
 * act at all — recoil damage, weather, a burn on a turn the opponent
 * switched — the hit takes the last slot there is, so it still reads as a
 * consequence of the turn rather than as something that happened before it.
 */
/**
 * The sides of a turn, in the order they first acted. **One reading, three
 * consumers.**
 *
 * Lifted out of `beats` by the victory-order patch, because the HP chunk is
 * slotted now and the bar is drawn before the beats are written. Three things
 * on the stage key off this list — the lunge, the recoil, and the chunk a bar
 * draws — and two independent readings of "who went first" sitting a hundred
 * pixels apart is exactly the disagreement `screens/battle.ts` reads the
 * protocol once to prevent, one level up.
 *
 * ## Which turn, and which sides
 *
 * The last group in the batch that has any actions, and **not** the last group
 * with a turn number — those are different, and the difference is a bug worth
 * not reintroducing. An incremental update arrives as `|move| … |move| …
 * |upkeep| |turn|N+1`: the actions that just resolved sit in the leading group,
 * which has no number yet because the line that would have numbered it came at
 * the *start* of the previous batch, and the trailing `|turn|` opens an empty
 * group for a turn nobody has played. Reading a turn number here moves nothing,
 * forever.
 *
 * A side is placed by its *first* action, so a replacement switch after a faint
 * does not re-place a side that has already moved. That caps the list at two,
 * which is what the stylesheet's four slots are built around.
 *
 * ## It never computes an order
 *
 * There is no sort here, no Speed comparison and no second call to `readTurns`.
 * The order is the one the engine already resolved and the log already
 * numbered, so the beats and the log's ordinals cannot disagree.
 */
function actingOrder(turns: readonly FlaggedTurn[] | undefined): ('p1' | 'p2')[] {
  const latest = turns ? [...turns].reverse().find((turn) => turn.actions.length > 0) : undefined;
  const seen: ('p1' | 'p2')[] = [];
  for (const { action } of latest?.actions ?? []) {
    if (!seen.includes(action.side)) seen.push(action.side);
  }
  return seen;
}

/**
 * Which slot a hit on `side` lands in, 1-based, or null when there is no turn.
 *
 * The slot of the *other* side's lunge: a hit is the answer to the move that
 * caused it, so it follows that move's beat. When the other side did not act at
 * all — recoil damage, weather, a burn on a turn the opponent switched — it
 * takes the last slot there is, so it still reads as a consequence of the turn
 * rather than as something that happened before it.
 *
 * With no turn reading at all — the opening draw, and the chunk-only fixtures
 * in `test/battle-feedback.test.ts` — the answer is slot 1, the first there is.
 * That is the pre-slot behaviour of the recoil and it is kept exactly: a hit
 * that cannot be placed still lands rather than going unmarked.
 *
 * The *bar* wants the other answer in that case — no slot, fade across the
 * whole budget from now, which is what every bar did before slots existed — so
 * `update` asks for null there rather than this function inventing a second
 * meaning for the same question.
 */
function hitSlot(side: 'p1' | 'p2', order: readonly ('p1' | 'p2')[]): number {
  const other = side === 'p1' ? 'p2' : 'p1';
  const slot = order.indexOf(other);
  return slot >= 0 ? slot + 1 : Math.max(order.length, 1);
}

function beats(
  actors: { me: Actor; foe: Actor },
  hit: { me: boolean; foe: boolean },
  seen: readonly ('p1' | 'p2')[],
  marks: readonly AbnormalityMark[],
): void {
  for (const actor of [actors.me, actors.foe]) {
    delete actor.root.dataset['acted'];
    delete actor.root.dataset['hit'];
  }

  // Restart rather than extend, the same as the swap beat and the HP chunk:
  // re-setting an attribute an element already carries does not replay a CSS
  // animation, and two turns running must each get their own beat.
  void actors.me.root.offsetWidth;
  // `p1` is the player throughout: the projection, the log formatter and the
  // protocol all take p1's view.
  const actorOf = (side: 'p1' | 'p2'): Actor => (side === 'p1' ? actors.me : actors.foe);
  for (const [index, side] of seen.entries()) {
    actorOf(side).root.dataset['acted'] = String(index + 1);
  }
  for (const [side, took] of [['p1', hit.me], ['p2', hit.foe]] as const) {
    if (!took) continue;
    actorOf(side).root.dataset['hit'] = String(hitSlot(side, seen));
  }

  /*
   * The abnormality marks, **handed in rather than read here.** Branch 3B.
   *
   * `ui/abnormality.ts` reduces the turn's flags to at most one class and slot
   * per side, and this only writes them. That split is a boundary rather than a
   * tidy-up: `test/boundaries.test.ts` forbids this file from touching `.flags`
   * at all, because "a beat that read `flags` would be one step from a recoil
   * that grew with the multiplier, which is a verdict drawn on the board". The
   * scene cannot weight a beat by severity because it never sees severity.
   *
   * The slot is the slot of the action that caused the flag, so a mark runs
   * concurrently with the lunge or hit it accompanies and the turn gains no
   * time at all.
   */
  for (const actor of [actors.me, actors.foe]) {
    delete actor.root.dataset['abnormal'];
    delete actor.root.dataset['abnormalSlot'];
  }
  for (const mark of marks) {
    const actor = actorOf(mark.side);
    actor.root.dataset['abnormal'] = mark.klass;
    actor.root.dataset['abnormalSlot'] = String(mark.slot);
  }
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
  name.textContent = member.species;
  const level = el('span', 'bench__level');
  level.textContent = `Lv${member.level}${genderMark(member.gender)}`;

  /*
   * **The bench keeps inert type chips, and it is the one place the chip-audit
   * patch's answer is narrowed. Read this before widening it back.**
   *
   * A bench row is not a panel, it is the switch control: the whole row is one
   * tap and that tap spends the turn. `ui/tooltips.ts` stops a click that lands
   * on a `[data-tip]` element — deliberately, so opening a tooltip cannot also
   * submit a move — so a tipped chip inside this button is a dead patch of the
   * only control that gets a fainted Pokemon off the field. The chips are most
   * of the row's width, so that patch is large.
   *
   * This is the third time this project has met the same hazard and the first
   * two are in `scripts/visual/browser.mjs`: a chip under a move button's
   * centre stalled the walk for 900 steps at 4.8.0.2, and the reward card's
   * expander did it again at 4.7.2 step 5. Both were fixed by aiming the tap at
   * something that is never a trigger. Here there is nothing to re-aim — a
   * player's thumb lands where it lands.
   *
   * **Nothing is lost by it.** The same Pokemon's types are on the battle panel
   * above with the wheel on them, and the bench row's copy is an identifier
   * rather than a readout.
   */
  const types = el('span', 'bench__types');
  types.replaceChildren(...member.types.map((type) => typeChip(type)));

  const bar = createBar({ variant: 'slim' });
  bar.set(member.hpFraction);

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

  // The body, at the row's right, phased by slot. Idle-sprites patch. Built
  // from the view's species, as every other fact on this row is.
  button.append(spriteFigure(member.species, { phase: member.slot }), name, level, types, bar.root, meta);
  button.addEventListener('click', () => onChoose(switchChoice(member.slot)));
  return button;
}

/**
 * The type watermark on a move button. **Chip-audit patch, item 3.**
 *
 * The brief: "since we have some dead space inside move cards (in battle), i'd
 * like a small QOL to show types in certain colors [...] as a visibility to
 * enforce what type each is. these icons should be 50% opacity max, and
 * shouldn't distract."
 *
 * ## It is redundant on purpose, and that is the whole design
 *
 * The type is already on the button in words, on the chip at the head of the
 * identity line. This adds nothing the card did not say — it says it again in
 * a channel that costs no reading. Four buttons scanned at a glance become four
 * silhouettes and four colours before a single word is parsed, which is what a
 * player does on the turns where they already know what the moves are and are
 * only picking between them.
 *
 * Because it is redundant, it must never be the *only* carrier of anything:
 * `aria-hidden`, no tooltip, no title, and `typeIconPath` returns `null` for a
 * type it does not know rather than drawing a mark the player would try to
 * learn.
 *
 * ## The colour comes from the chip table, not a second one
 *
 * The span wears `type--<name>`, which is where `--chip` is already defined for
 * every type in the game. It is not a chip and does not wear `.chip`, so it
 * picks up the custom property and none of the recipe. The alternative was
 * nineteen new `.move--<type>` rules restating the same nineteen colours, which
 * is a table free to drift from the one the chips use.
 *
 * ## Battle only
 *
 * `moveCard` draws the same component on the reward and replacement screens and
 * does not get one: the brief says "in battle", and those cards carry the
 * 4.7.2 expander in the corner this would occupy.
 */
function typeWatermark(type: string): HTMLElement | null {
  const path = typeIconPath(type);
  if (!path) return null;
  const mark = el('span', `move__watermark type--${type.toLowerCase()}`);
  // Decorative, and `aria-hidden` is what keeps it that way: a screen reader
  // that announced it would be reading the type chip's word a second time.
  mark.setAttribute('aria-hidden', 'true');
  mark.innerHTML = `<svg viewBox="${TYPE_ICON_VIEWBOX}" fill="currentColor" aria-hidden="true" focusable="false">${path}</svg>`;
  return mark;
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
  button.dataset['tutorial'] = 'move';
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
   * The band. **R12 put it beside the base power; the playtest patch moved it
   * to the head of the fact line, and the reason is line breaks.**
   *
   * R12's argument was that `20 BP` and `BAND 4` only make sense together, so
   * they should meet in one region of the card. That held — until the four
   * buttons were looked at side by side on a phone, where `.move__meta` wraps
   * against its own content: an eight-letter type name pushed the band onto
   * the second line while the button beside it kept it on the first. The two
   * facts still meet, one line apart and in the same place on every card,
   * which is the version a player can learn.
   *
   * `powerBand` off the projection, so the button resolves a band through the
   * same `bandOfMove` read as every card outside the fight.
   */
  const band = moveBandChip(move.powerBand);

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
  // Built here, rendered by the strip: it closes the fact line rather than
  // sitting on the wrapping meta row. See `moveFactStrip`'s `extras`.
  let effectBadge: HTMLElement | null = null;
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
    effectBadge = badge;
  }

  const pp = el('span', 'move__pp');
  pp.dataset['tutorial'] = 'pp';
  pp.textContent = `PP ${move.pp}/${move.maxPp}`;
  if (move.maxPp > 0 && move.pp / move.maxPp <= 0.25) pp.classList.add('move__pp--low');

  /*
   * The battle bar's own explain affordance. **Density modes patch, and open
   * item 9 (R8) closed by it.**
   *
   * A move card outside a fight carries 4.7.2's expander; the four buttons in
   * one could not, because a tap on a button spends a turn. Pocket puts the
   * category, the base power, the effect line and the tags one tap away, so
   * the button needs a tap that is not the move: a chip on the PP line, a
   * `data-tip` trigger like every badge on the board, which the tooltip layer
   * opens and stops — the same rule that keeps a tap on a type chip from
   * submitting the turn. On the PP line rather than the name, so it costs the
   * button no height and the name stays the whole width of the tap that
   * chooses. Present in every mode: the same panel `move:` opens on a card's
   * expander, and a move looks identical everywhere the player meets it.
   */
  const footer = el('span', 'move__footer');
  const ask = neutralChip('?', 'ask', { tip: `move:${move.id}` });
  ask.tabIndex = 0;
  ask.setAttribute('role', 'button');
  ask.setAttribute('aria-label', `${move.name}: explain`);
  footer.append(pp, ask);

  // Call site one of two: the battle button, off the projection's own
  // `facts`. `scene.ts` may not reach `describeMove`, so the list arrives
  // derived. Mirrors `moveBandChip`, and like it the two sites stay two.
  const strip = moveFactStrip(move.facts, { band, effect: effectBadge });
  // The watermark first, so every other child paints over it without anything
  // here needing a z-index. It is positioned out of flow, so its place in the
  // child order costs the layout nothing.
  const watermark = typeWatermark(move.type);
  button.append(...(watermark ? [watermark] : []), name, meta, ...(strip ? [strip] : []), footer);
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
 * The fact strip on a move card. **One component, both card shapes.** 4.8.0.3.
 *
 * It replaces the tag row that stood here, and replaces rather than joins it:
 * a strip *beside* a row would cost height instead of saving it, and the
 * battle screen's budget is the constraint the whole item exists under. The
 * nine fields are the ones that change this turn's arithmetic; every other tag
 * — STAB, high crit, bypasses Protect, sound — is still on the move and is
 * still one tap away in the explanation, which prints the full set and always
 * did.
 *
 * Part 6b's rule is unchanged and this inherits it: the strip wires into the
 * shared move card component rather than into each screen. `moveFacts` builds
 * it for every card outside a battle and `renderMove` builds it for the four
 * buttons inside one — the same two call sites `moveBandChip` has, kept as two
 * because the projection and the card data are different types arriving by
 * different routes.
 *
 * Renders nothing at all for a move with no facts, rather than an empty row.
 * An empty row on three of four buttons is the ragged grid this feature exists
 * to remove.
 */
export function moveFactStrip(
  facts: readonly MoveFact[],
  /**
   * The two chips that share the line with the facts, and the reason it is a
   * grid. **The playtest patch.**
   *
   * `band` is the base-power bracket and `effect` the live effectiveness
   * marker. Both used to sit on `.move__meta` above, which wraps — so `BAND 3`
   * landed on the first line of one button and the second line of the next,
   * depending on how wide that button's type name happened to be. They are
   * pinned here instead: the band opens the line on every card that has one,
   * the four fact columns follow at fixed offsets, and the effectiveness
   * marker closes it.
   *
   * Effectiveness last on purpose. It is the one field that changes with what
   * is standing opposite — the single exception `CLAUDE.md` carves out of the
   * no-verdicts rule — so it is the one field whose presence must not shift
   * anything else.
   */
  extras: { band?: HTMLElement | null; effect?: HTMLElement | null } = {},
): HTMLElement | null {
  const { band = null, effect = null } = extras;
  if (facts.length === 0 && !band && !effect) return null;
  const row = el('span', 'move__facts');

  if (band) {
    band.classList.add('move__facts-band');
    row.append(band);
  }

  /*
   * Every column, every time, empty or not. A column that collapsed when its
   * field was absent would put the next field where this one belongs, which is
   * the whole defect: `MOVE_FACT_COLUMN`'s comment has the co-occurrence
   * evidence that lets four columns hold nine fields with nothing dropped.
   */
  const cells = Array.from({ length: MOVE_FACT_COLUMNS }, (_, index) => {
    const cell = el('span', 'move__fact-cell');
    cell.dataset['column'] = String(index + 1);
    row.append(cell);
    return cell;
  });

  for (const fact of facts) {
    const info = MOVE_FACT_INFO[fact.id];
    // A tooltip trigger like every other badge on screen — `data-tip`, one
    // delegated layer, words from `data/`. That is what keeps an icon
    // decodable, and it is the reason the strip may be icons at all.
    const chip = neutralChip('', 'fact', { tip: `movefact:${fact.id}`, extra: `badge--fact-${fact.id.toLowerCase()}` });
    const icon = el('span', 'move__fact-icon');
    icon.textContent = info.icon;
    icon.setAttribute('aria-hidden', 'true');
    chip.append(icon);
    // A flag has no number and gets no element for one, rather than an empty
    // span the stylesheet has to hide.
    if (fact.value) {
      const value = el('span', 'move__fact-value');
      value.textContent = fact.value;
      chip.append(value);
    }
    chip.dataset['fact'] = fact.id;
    chip.tabIndex = 0;
    chip.setAttribute('role', 'button');
    chip.setAttribute('aria-label', moveFactAriaLabel(fact.id, fact.value));
    /*
     * Into its column, and into the row itself only if the column is somehow
     * taken. The fallback cannot fire on today's pools — the test re-derives
     * that from the live tables — and it exists so that a move added tomorrow
     * loses its *position* rather than its field.
     */
    const cell = cells[(MOVE_FACT_COLUMN[fact.id] ?? 1) - 1];
    if (cell && cell.childElementCount === 0) cell.append(chip);
    else row.append(chip);
  }

  if (effect) {
    effect.classList.add('move__facts-effect');
    row.append(effect);
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
   * The fact strip for this card's face. **Patch 4.8.0.3, item 2.**
   *
   * Successor to the `tags` this parameter used to take, and handed in for
   * exactly the same reason: deriving it needs `describeMove` and this file
   * may not reach for it — `test/boundaries.test.ts` restricts `scene.ts` to
   * the projection and four vocabulary modules. The caller has already asked.
   *
   * Uncapped, unlike the tags it replaces. `MOVE_FACT_IDS` bounds the strip at
   * nine and no move carries nine, so there is nothing to cut and no tuning
   * number for how much survives. The full tag set, including the ones the
   * strip does not carry, is unchanged and still reachable through the
   * explanation.
   *
   * Absent and empty render identically: no strip.
   */
  facts?: readonly MoveFact[];
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
}): { name: HTMLElement; meta: HTMLElement; pp: HTMLElement; strip: HTMLElement | null } {
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
  // The band, in the same place on the card as on the button: at the head of
  // the fact line. The two call sites stay two and the placement stays one.
  const band = moveBandChip(move.band);

  const pp = el('span', 'move__pp');
  pp.textContent = `PP ${move.maxPp}`;

  // Call site two of two: every card outside a battle, off `MoveCardData`.
  return { name, meta, pp, strip: moveFactStrip(move.facts ?? [], { band }) };
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
  /** The fact strip for the face. Passed straight through to `moveFacts`. 4.8.0.3. */
  facts?: readonly MoveFact[];
  effect?: MoveEffectFields | null;
  /** The base-power band. Passed straight through to `moveFacts`. R12. */
  band?: number | null;
  /**
   * The full explanation, and the full tag set. **Patch 4.7.2, step 5.**
   *
   * **This is the one insertion point.** Every off-battle surface fills its
   * card through `ui/move-detail.moveCardData`, which already carried both of
   * these and had no reader; passing the whole object to this function — which
   * all six callers already did — is what turns them on everywhere at once.
   * Nothing was added to any screen.
   *
   * Optional, so a caller with nothing to explain gets a card with no expander
   * rather than an empty one. `explanation` is null for a move outside the
   * dex, which is the only case that produces one.
   *
   * **The battle bar is deliberately out of reach.** `renderMove` builds its
   * buttons from `moveFacts` directly, not from here, so a move button cannot
   * grow an expander by accident — a tap on it spends a turn. That the two
   * paths differ is recorded as open item 9: R8 needs its own insertion point.
   */
  explanation?: MoveExplanation | null;
  allTags?: readonly MoveTag[];
}): HTMLElement {
  const card = el('div', `move move--card move--${move.type.toLowerCase()}`);
  card.dataset['category'] = move.category.toLowerCase();
  const facts = moveFacts(move);
  card.append(facts.name, facts.meta, ...(facts.strip ? [facts.strip] : []));

  if (move.explanation) {
    /*
     * **The trigger shares the PP row rather than taking one of its own, and
     * that is a measurement rather than a preference.**
     *
     * The first version gave it a full-width row. Three reward cards on the
     * result screen then ran 951.75px deep against an 844 fold, and the V2
     * confirm band lost its clearance over a pinned card — two guarded
     * properties, one cause. A move card is drawn three-up on the result
     * screen and four-up on a party card, so anything that costs a row here
     * costs three or four rows on a phone.
     *
     * PP is a short string on its own line with the rest of the line empty, so
     * the control fits beside it for nothing.
     */
    const footer = el('div', 'move__footer');
    // A stable id per card instance, so `aria-controls` points at this panel
    // and not at the first one on a screen showing four.
    explainSeq += 1;
    const { trigger, panel } = moveExplanation(move.explanation, move.allTags ?? [], `move-explain-${explainSeq}`);
    footer.append(facts.pp, trigger);
    card.append(footer, panel);
  } else {
    card.append(facts.pp);
  }
  return card;
}

/** Ids for the expander panels. Per document, never serialized, never logged. */
let explainSeq = 0;


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
 * Motion is V3.4's: the parallax listener and the drift loop, which since the
 * idle-sprites patch is one of eight loops chosen by the locale's
 * `motion.kind` (`theme/scenes/index.ts`). Under reduced motion the moving
 * element is not mounted at all and the layers do not move;
 * `prefersReducedMotion` is read once per `setLocale`, so a change of
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
        // The kind, for the stylesheet to pick the keyframes, and the place's
        // own position where the kind's default is not it. Idle-sprites patch.
        drift.dataset['motion'] = art.motion.kind;
        if (art.motion.at) {
          drift.style.setProperty('--drift-x', art.motion.at[0]);
          drift.style.setProperty('--drift-y', art.motion.at[1]);
        }
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
