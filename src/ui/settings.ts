/**
 * Cross-run settings. Currently one: how much space and prose a fact costs.
 *
 * ## The density setting, and the rule it lives under
 *
 * **It is presentation only. One value, read by components, and it never reaches
 * `core/`.** That is not a style preference, it is the property the whole
 * feature depends on: a run must play the same way whichever mode it is in, or
 * a shared seed stops being a shared run and the balance report stops
 * describing the game people play.
 *
 * The constraint is enforced two ways. Structurally, this file lives in `ui/`
 * and `core/` may not import from `ui/` — the dependency runs one way and
 * always has. And explicitly, `test/density.test.ts` walks every file under
 * `src/core/` and fails if any of them mentions this module or its accessors. A
 * comment saying "do not read this from core" is a comment; the test is the
 * rule.
 *
 * ## The three modes
 *
 * **Density modes patch, replacing 4.7.2's two-valued verbosity flag.** The
 * old axis — "Simple hides raw stat numbers in favour of relative bars" — had
 * nowhere to bite on the ten screens that carry no stat numbers. The new axis
 * is how much space and prose a fact costs, which every screen has:
 *
 *   - **Detailed.** Every fact on screen, zero taps, full labels and
 *     descriptions.
 *   - **Simple.** Every fact on screen, zero taps, reduced prose and chrome.
 *     Labels abbreviate, descriptions shorten, padding tightens.
 *   - **Pocket.** Zero scroll on a 390x844 phone. Secondary facts may cost one
 *     tap; primary facts stay on screen.
 *
 * No mode removes a fact. What each mode does, per screen family, is the
 * stylesheet's business (`styles.css`, "the density modes") and the shared
 * primitives' in the component layer; this file only holds the value.
 *
 * ## Detailed is the first-launch default
 *
 * The usual instinct is to start simple and let people opt into detail, and it
 * is wrong here. A new player does not know the help exists, so the mode that
 * hides it is the mode they never leave. Starting Detailed means the first run
 * shows the labels *and* the tooltips that explain them, and the other two are
 * something you turn on once you no longer need either.
 *
 * ## Migration from `verbosity`
 *
 * The 4.7.2 store held `verbosity: 'simple' | 'detailed'`. A stored `simple`
 * lands on `simple`, a stored `detailed` on `detailed`, and a stored `density`
 * wins over a stored `verbosity` when both are present. The old field is read
 * on the way in and never written again: one name, one read path.
 */

import { TUTORIAL_SCREENS, type TutorialScreen } from '../data/tutorial';
import { INTRO_VERSION } from '../data/intro';

export type Density = 'detailed' | 'simple' | 'pocket';

/** Every mode, in the order the picker lists them. Detailed first: the default. */
export const DENSITIES: readonly Density[] = ['detailed', 'simple', 'pocket'];

/**
 * How the four move buttons are arranged. **The four-column patch.**
 *
 * A second presentation axis, and deliberately a second axis rather than a
 * fourth density mode. Density is *how much space and prose a fact costs* and
 * applies to every screen in the game; this is *the shape of one bar on one
 * screen*, and folding it in would mean a player who wanted four columns had
 * to accept a padding scale with it.
 *
 *   - **`grid`.** The 2x2 the game has always had. 176px buttons at 390, which
 *     is enough for the identity line, the fact line and the footer to each
 *     read on one line.
 *   - **`columns`.** Four columns, one per move, so the same field on all four
 *     moves is on one line and reads across. 85px buttons at 390, which is not
 *     enough for any of those three lines, so the face stacks and its secondary
 *     half moves behind the tap that was already there.
 *
 * The two are measured against each other rather than ranked here;
 * `docs/generation.md` section 16 has both height tables.
 */
export type MoveBar = 'grid' | 'columns';

/** Both layouts, in the order the picker lists them. */
export const MOVE_BARS: readonly MoveBar[] = ['grid', 'columns'];

/**
 * How long a battle turn's feedback takes to play. **The battle animation run.**
 *
 * A third presentation axis, and a third axis for the same reason the move bar
 * was a second one: density is *how much space and prose a fact costs*, the
 * move bar is *the shape of one bar*, and this is *how long a beat lasts*. A
 * player who wanted a slower turn should not have to accept a padding scale
 * with it.
 *
 * **Why it exists at all.** Release C's 500ms was the prompt's default and its
 * own doc comment said it was waiting on a playtest rather than a sweep. The
 * playtest arrived and said the beats were too fast to see — a beat is a
 * quarter of the budget, so 500 made it 125ms, and an 8px lunge over 125ms is
 * about one frame at peak displacement. `data/displayTuning.ts` now ships 900.
 * But "too fast" is a judgement, not a measurement, and the honest answer to a
 * judgement is a control rather than a second guess at one number.
 *
 * The three are multipliers on that shipped number rather than millisecond
 * values of their own, so there is still exactly one place the feel of a turn
 * is set and this scales it. A fourth constant is what the token exists to
 * prevent.
 *
 *   - **`swift`.** Two thirds. For a player who has learned to read the board
 *     and wants the turn out of the way.
 *   - **`even`.** The shipped number, and the default.
 *   - **`patient`.** Half again, for reading every beat.
 *
 * Reduced motion is **not** a fourth value here and must never become one. The
 * OS setting is answered in the stylesheet by `prefers-reduced-motion`, which
 * re-answers itself when the setting changes mid-session; a value written into
 * this store at startup would not. See `ui/theme/motion.ts`.
 */
export type BattleSpeed = 'swift' | 'even' | 'patient';

/** Every speed, in the order the picker lists them: slowest last, default middle. */
export const BATTLE_SPEEDS: readonly BattleSpeed[] = ['swift', 'even', 'patient'];

/**
 * What each speed does to the shipped feedback duration.
 *
 * Multipliers, not durations, so `data/displayTuning.ts` stays the one place
 * the number lives. `even` is exactly 1 rather than approximately 1: the
 * default must reproduce the shipped value bit for bit, or the visual tests
 * that assert `--motion-duration` equals `battleFeedbackMs` would be asserting
 * a rounding.
 */
export const BATTLE_SPEED_SCALE: Readonly<Record<BattleSpeed, number>> = {
  swift: 2 / 3,
  even: 1,
  patient: 1.5,
};

const KEY = 'gymrun.settings';

/**
 * The tutorial's persisted flags. Overnight Branch 3.
 *
 * In this store rather than its own because the trigger is "first launch",
 * which is exactly what the density default already keys off: a fresh
 * store. Never keyed to a seed. `seen` is per screen, so a player who skips
 * the map's marks still gets the battle's; `skipped` is the one control that
 * dismisses every screen at once.
 */
export interface TutorialFlags {
  skipped: boolean;
  seen: TutorialScreen[];
}

/**
 * Whether the intro panel has been dismissed, and at which content version.
 *
 * A version rather than a boolean, for the reason `data/intro.ts` gives: a
 * rewrite that changes what the intro says should show itself once to a player
 * who dismissed the old wording, and a boolean cannot express that. `0` is
 * "never seen", which is what a fresh store and an unreadable one both read
 * as.
 */
export interface IntroFlags {
  seenVersion: number;
}

export interface Settings {
  density: Density;
  moveBar: MoveBar;
  battleSpeed: BattleSpeed;
  tutorial: TutorialFlags;
  intro: IntroFlags;
}

/**
 * The first-launch settings.
 *
 * Detailed, per the note above. Exported so a test asserts the default rather
 * than restating it.
 */
/**
 * The first-launch settings.
 *
 * `grid` for the move bar, and the argument is the opposite of the density
 * default's. Detailed is the default because the mode that hides the help is
 * the mode a new player never leaves; the move bar has no such asymmetry —
 * both layouts show the same moves and neither hides a control — so the
 * default goes to the one every measurement in `docs/visual/baseline/` was
 * taken against. The four-column layout is one tap away in the drawer, which
 * is reachable from every screen of a run.
 */
export const DEFAULT_SETTINGS: Settings = {
  density: 'detailed',
  moveBar: 'grid',
  battleSpeed: 'even',
  tutorial: { skipped: false, seen: [] },
  intro: { seenVersion: 0 },
};

function isDensity(value: unknown): value is Density {
  return (DENSITIES as readonly unknown[]).includes(value);
}

function isMoveBar(value: unknown): value is MoveBar {
  return (MOVE_BARS as readonly unknown[]).includes(value);
}

function isBattleSpeed(value: unknown): value is BattleSpeed {
  return (BATTLE_SPEEDS as readonly unknown[]).includes(value);
}

/**
 * Read the stored settings, falling back to the defaults on anything unexpected.
 *
 * Guarded like `storage.ts` is, and for the same reason: `localStorage` throws
 * outright in private-mode Safari and in some embedded webviews, and a game
 * that refused to start because it could not read a display preference would be
 * a worse failure than starting in the wrong mode.
 */
export function loadSettings(): Settings {
  try {
    const raw = globalThis.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed: unknown = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...readSettings(parsed) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    globalThis.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Non-fatal: the setting reverts to the default next launch.
  }
}

/**
 * Parse defensively. Stored settings are untrusted input like a stored log.
 *
 * Exported so the migration is asserted on the parser rather than through
 * `localStorage`, which jsdom and a browser answer differently.
 */
export function readSettings(value: unknown): Partial<Settings> {
  if (typeof value !== 'object' || value === null) return {};
  const candidate = value as {
    density?: unknown;
    moveBar?: unknown;
    battleSpeed?: unknown;
    verbosity?: unknown;
    tutorial?: unknown;
    intro?: unknown;
  };
  const read: Partial<Settings> = {};
  if (isDensity(candidate.density)) read.density = candidate.density;
  // The 4.7.2 field. Both of its values are members of the new union with the
  // same meaning, so the migration is the identity on them; anything else the
  // old field could hold falls through to the default.
  else if (candidate.verbosity === 'simple' || candidate.verbosity === 'detailed') read.density = candidate.verbosity;

  /*
   * The move bar layout. **Read after the density chain, not inside it**, and
   * the first draft of this put it between the two branches — which quietly
   * severed the `else` and let a stored `verbosity` overwrite a stored
   * `density`. `test/density.test.ts` caught it on the one case written for
   * exactly that: "lets a stored density win over a stored verbosity".
   *
   * No migration of its own: the field is new, so a store written before it
   * falls through to the default, which is the layout that store was already
   * being shown.
   */
  if (isMoveBar(candidate.moveBar)) read.moveBar = candidate.moveBar;
  /*
   * The speed, read like the move bar and outside the density chain for the
   * same reason: a branch placed inside that `else` severs it, which is the
   * defect `test/density.test.ts` already has a case for. No migration — the
   * field is new, so a store written before it falls through to `even`, which
   * is the speed that store was already being shown.
   */
  if (isBattleSpeed(candidate.battleSpeed)) read.battleSpeed = candidate.battleSpeed;
  const tutorial = candidate.tutorial as { skipped?: unknown; seen?: unknown } | undefined;
  if (typeof tutorial === 'object' && tutorial !== null) {
    read.tutorial = {
      skipped: tutorial.skipped === true,
      seen: Array.isArray(tutorial.seen)
        ? tutorial.seen.filter((entry): entry is TutorialScreen => TUTORIAL_SCREENS.includes(entry as TutorialScreen))
        : [],
    };
  }
  /*
   * A store written before the intro existed has no `intro` key, which reads
   * as `seenVersion: 0` and shows the panel once. That is the intended
   * migration rather than an accident of the default: the intro is new to
   * a returning player too, and a player who has already played is exactly
   * who the one-line version is shortest for.
   */
  const intro = candidate.intro as { seenVersion?: unknown } | undefined;
  if (typeof intro === 'object' && intro !== null && typeof intro.seenVersion === 'number') {
    read.intro = { seenVersion: intro.seenVersion };
  }
  return read;
}

/**
 * The live setting, held in one place so components read rather than thread it.
 *
 * A module-level holder rather than a parameter on every render call, because
 * threading a display preference through three layers of component signatures
 * would put it in the same argument lists as the game state it must never be
 * confused with.
 *
 * It is *only* legitimate because of the constraint at the top of this file: a
 * module-level mutable that game logic read would be an untracked input to a
 * replay. Nothing under `core/` can see this one.
 */
let current: Settings = { ...DEFAULT_SETTINGS };
const listeners = new Set<(settings: Settings) => void>();

/** Load from storage into the live holder. Called once at startup. */
export function initSettings(): Settings {
  current = loadSettings();
  return current;
}

export function getDensity(): Density {
  return current.density;
}

export function setDensity(density: Density): void {
  if (current.density === density) return;
  current = { ...current, density };
  saveSettings(current);
  for (const listener of listeners) listener(current);
}

export function getMoveBar(): MoveBar {
  return current.moveBar;
}

export function setMoveBar(moveBar: MoveBar): void {
  if (current.moveBar === moveBar) return;
  current = { ...current, moveBar };
  saveSettings(current);
  for (const listener of listeners) listener(current);
}

export function getBattleSpeed(): BattleSpeed {
  return current.battleSpeed;
}

export function setBattleSpeed(battleSpeed: BattleSpeed): void {
  if (current.battleSpeed === battleSpeed) return;
  current = { ...current, battleSpeed };
  saveSettings(current);
  for (const listener of listeners) listener(current);
}

// ---------------------------------------------------------------------------
// The tutorial flags
// ---------------------------------------------------------------------------

/** Whether a screen's marks are due: the tutorial is not skipped and the screen not yet seen. */
export function tutorialDue(screen: TutorialScreen): boolean {
  return !current.tutorial.skipped && !current.tutorial.seen.includes(screen);
}

/** A screen's marks were shown (or dismissed) once; they do not show again. */
export function markTutorialSeen(screen: TutorialScreen): void {
  if (current.tutorial.seen.includes(screen)) return;
  current = { ...current, tutorial: { ...current.tutorial, seen: [...current.tutorial.seen, screen] } };
  saveSettings(current);
  for (const listener of listeners) listener(current);
}

/** "Skip tutorial": every screen, now and later, until it is shown again. */
export function skipTutorial(): void {
  if (current.tutorial.skipped) return;
  current = { ...current, tutorial: { ...current.tutorial, skipped: true } };
  saveSettings(current);
  for (const listener of listeners) listener(current);
}

/** "Show tutorial again": back to a first launch, for the tutorial alone. */
export function resetTutorial(): void {
  current = { ...current, tutorial: { skipped: false, seen: [] } };
  saveSettings(current);
  for (const listener of listeners) listener(current);
}

export function tutorialFlags(): TutorialFlags {
  return { skipped: current.tutorial.skipped, seen: [...current.tutorial.seen] };
}

// ---------------------------------------------------------------------------
// The intro flag
// ---------------------------------------------------------------------------

/**
 * Whether the intro is due: never dismissed, or dismissed at an older version.
 *
 * Deliberately **not** gated on `tutorial.skipped`. The two are separate
 * surfaces answering separate questions, and a player who skipped the coach
 * marks on a previous build has said nothing about a panel that did not exist
 * then. Skipping the marks from inside the tutorial still skips only the
 * marks.
 */
export function introDue(): boolean {
  return current.intro.seenVersion < INTRO_VERSION;
}

/** The intro was shown and closed. It does not show again until its version moves. */
export function markIntroSeen(): void {
  if (current.intro.seenVersion >= INTRO_VERSION) return;
  current = { ...current, intro: { seenVersion: INTRO_VERSION } };
  saveSettings(current);
  for (const listener of listeners) listener(current);
}

/** "Show the intro and the tutorial again": the intro half of it. */
export function resetIntro(): void {
  current = { ...current, intro: { seenVersion: 0 } };
  saveSettings(current);
  for (const listener of listeners) listener(current);
}

export function introFlags(): IntroFlags {
  return { seenVersion: current.intro.seenVersion };
}

/**
 * Subscribe to changes, so the shell writes the mode onto the root when it
 * moves. Returns an unsubscribe function.
 */
export function onSettingsChange(listener: (settings: Settings) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Reset to first-launch state. For tests, which must not leak into each other. */
export function resetSettings(): void {
  current = { ...DEFAULT_SETTINGS, tutorial: { skipped: false, seen: [] } };
  listeners.clear();
}
