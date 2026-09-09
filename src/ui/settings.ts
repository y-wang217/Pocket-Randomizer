/**
 * Cross-run settings. Currently one: how much the screens spell out.
 *
 * ## The verbosity flag, and the rule it lives under
 *
 * **It is presentation only. One flag, read by components, and it never reaches
 * `core/`.** That is not a style preference, it is the property the whole
 * feature depends on: a run must play the same way whichever mode it is in, or
 * a shared seed stops being a shared run and the balance report stops
 * describing the game people play.
 *
 * The constraint is enforced two ways. Structurally, this file lives in `ui/`
 * and `core/` may not import from `ui/` — the dependency runs one way and
 * always has. And explicitly, `test/verbosity.test.ts` walks every file under
 * `src/core/` and fails if any of them mentions this module or its flag. A
 * comment saying "do not read this from core" is a comment; the test is the
 * rule.
 *
 * ## What the two modes actually do
 *
 * **Detailed** shows raw stat numbers. **Simple** replaces them with relative
 * bars and keeps the faster-side marker from Stage 4.5.
 *
 * Flagged in the stage prompt as an unspecified default, and this is that
 * default made concrete. The reasoning: the numbers are the thing a
 * non-player cannot use — 134 Attack means nothing without a distribution to
 * put it in — while the *comparison* between two panels is legible to anyone.
 * A bar is that comparison with the arithmetic already done. Nothing else
 * changes between the modes; tooltips, the speed arrow, HP text and every
 * effectiveness badge are present in both, because those are how a player
 * learns rather than what they already know.
 *
 * ## Detailed is the first-launch default
 *
 * The usual instinct is to start simple and let people opt into detail, and it
 * is wrong here. A new player does not know the help exists, so the mode that
 * hides it is the mode they never leave. Starting Detailed means the first run
 * shows the numbers *and* the tooltips that explain them, and Simple is
 * something you turn on once you no longer need either.
 */

export type Verbosity = 'simple' | 'detailed';

const KEY = 'gymrun.settings';

export interface Settings {
  verbosity: Verbosity;
}

/**
 * The first-launch settings.
 *
 * Detailed, per the note above. Exported so a test asserts the default rather
 * than restating it.
 */
export const DEFAULT_SETTINGS: Settings = { verbosity: 'detailed' };

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

/** Parse defensively. Stored settings are untrusted input like a stored log. */
function readSettings(value: unknown): Partial<Settings> {
  if (typeof value !== 'object' || value === null) return {};
  const candidate = value as { verbosity?: unknown };
  return candidate.verbosity === 'simple' || candidate.verbosity === 'detailed'
    ? { verbosity: candidate.verbosity }
    : {};
}

/**
 * The live setting, held in one place so components read rather than thread it.
 *
 * A module-level holder rather than a parameter on every render call, because
 * the flag is read by the stat rows, the party screen and the reward cards, and
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

export function getVerbosity(): Verbosity {
  return current.verbosity;
}

/** True when raw numbers should be shown. The one question components ask. */
export function showsNumbers(): boolean {
  return current.verbosity === 'detailed';
}

export function setVerbosity(verbosity: Verbosity): void {
  if (current.verbosity === verbosity) return;
  current = { ...current, verbosity };
  saveSettings(current);
  for (const listener of listeners) listener(current);
}

/**
 * Subscribe to changes, so an open screen redraws when the toggle flips.
 *
 * Returns an unsubscribe function. Without this the toggle would only take
 * effect on the next natural re-render, which on the party screen is never.
 */
export function onSettingsChange(listener: (settings: Settings) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Reset to first-launch state. For tests, which must not leak into each other. */
export function resetSettings(): void {
  current = { ...DEFAULT_SETTINGS };
  listeners.clear();
}
