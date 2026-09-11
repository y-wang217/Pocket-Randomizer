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

export type Density = 'detailed' | 'simple' | 'pocket';

/** Every mode, in the order the picker lists them. Detailed first: the default. */
export const DENSITIES: readonly Density[] = ['detailed', 'simple', 'pocket'];

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

export interface Settings {
  density: Density;
  tutorial: TutorialFlags;
}

/**
 * The first-launch settings.
 *
 * Detailed, per the note above. Exported so a test asserts the default rather
 * than restating it.
 */
export const DEFAULT_SETTINGS: Settings = { density: 'detailed', tutorial: { skipped: false, seen: [] } };

function isDensity(value: unknown): value is Density {
  return (DENSITIES as readonly unknown[]).includes(value);
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
  const candidate = value as { density?: unknown; verbosity?: unknown; tutorial?: unknown };
  const read: Partial<Settings> = {};
  if (isDensity(candidate.density)) read.density = candidate.density;
  // The 4.7.2 field. Both of its values are members of the new union with the
  // same meaning, so the migration is the identity on them; anything else the
  // old field could hold falls through to the default.
  else if (candidate.verbosity === 'simple' || candidate.verbosity === 'detailed') read.density = candidate.verbosity;
  const tutorial = candidate.tutorial as { skipped?: unknown; seen?: unknown } | undefined;
  if (typeof tutorial === 'object' && tutorial !== null) {
    read.tutorial = {
      skipped: tutorial.skipped === true,
      seen: Array.isArray(tutorial.seen)
        ? tutorial.seen.filter((entry): entry is TutorialScreen => TUTORIAL_SCREENS.includes(entry as TutorialScreen))
        : [],
    };
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
