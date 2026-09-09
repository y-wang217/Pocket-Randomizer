/**
 * Every player-facing HP string, in one file.
 *
 * ## The playtest note, and what it was actually about
 *
 * The feedback was that *"You are 11% down" is not clear after you heal* — the
 * phrasing describes a **delta** but reads as a **state**, and after a heal it
 * contradicts what the player just watched happen.
 *
 * That exact sentence is not in the codebase, and looking for it is how the
 * real problem was found. What the player was reading is the battle log's
 * `(Pikachu lost 11% of its health!)`, produced by @pkmn/view's formatter from
 * a tracker this repo supplies. Every HP message in the game was a change:
 *
 *   - the log said what a hit *took*, never what was *left*;
 *   - a heal said "restored HP using its Potion" and named no amount at all,
 *     so the one message that should have been a number was the one that had
 *     none;
 *   - `core/events.ts` labelled outcomes `-11% HP` and `+15% HP`.
 *
 * A delta is the wrong unit for a resource the player is *managing*. "You lost
 * 11%" answers a question nobody asked; "you have 24 of 48 left" is the number
 * the next decision is made on. So the rule this file encodes is: **state
 * first, change second, and healing always names the amount restored.**
 *
 * ## Why the strings live in core/
 *
 * Item G asks for one place so wording is a one-file change, and this is the
 * only place both callers can reach: the battle log is `ui/`, the event
 * outcomes are `core/events.ts`, and `core/` may not import from `ui/`. Putting
 * it here also means the phrasing is unit-testable without a DOM, which is what
 * makes "no HP message contradicts what just happened" an assertion rather than
 * an intention.
 *
 * Nothing here formats a *verdict*. "Badly hurt", "critical", "you should heal"
 * are all judgements the player makes from the number, and a UI that made them
 * would be the same category error the reward cards spent Stage 4.5.1 removing.
 */

/** A clamped percentage, rounded the way every line here rounds. */
function percent(current: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round(Math.max(0, Math.min(1, current / max)) * 100);
}

/**
 * The canonical HP readout: what you have, out of what you can have, and the
 * share that represents.
 *
 * `24 / 48 HP (50%)`. All three, because each answers a different question —
 * the pair sizes the bar, the percentage compares across Pokemon of different
 * bulk — and because the percentage alone was what the old copy leaned on.
 */
export function hpState(current: number, max: number): string {
  return `${current} / ${max} HP (${percent(current, max)}%)`;
}

/** The same without the unit, for a panel that already says HP in its heading. */
export function hpStateBare(current: number, max: number): string {
  return `${current} / ${max} · ${percent(current, max)}%`;
}

/**
 * What a hit left behind, named for whoever took it.
 *
 * **State, not delta.** The old line was `(Pikachu lost 11% of its health!)`
 * and this is `Pikachu: 24 / 48 HP (50%)`. The amount taken is deliberately
 * absent: it is derivable, it is one line above in the log, and printing both
 * is how a player ends up reading the smaller number as the important one.
 */
export function hpAfterDamage(name: string, current: number, max: number): string {
  return `${name}: ${hpState(current, max)}`;
}

/**
 * A heal, which is the line the playtest was actually missing.
 *
 * `Pikachu restored 12 HP — now 36 / 48 HP (75%)`. The amount *is* named here,
 * unlike damage, and the asymmetry is deliberate: a heal is something the
 * player spent a resource on, so "did that do anything" is the question, and a
 * state-only line leaves them subtracting to find out. Damage is something that
 * happened to them, where the only question is what is left.
 */
export function hpAfterHeal(name: string, restored: number, current: number, max: number): string {
  return `${name} restored ${restored} HP — now ${hpState(current, max)}`;
}

/** A member with nothing left. Never a percentage: zero is not a share. */
export const FAINTED = 'Fainted';

/** Fainted, plus the one fact that stops it reading as permanent. */
export const FAINTED_REVIVES = 'Fainted — revives at the next node';

/**
 * An event's HP outcome, which is the one place a **delta is correct**.
 *
 * An event has no "after" to report at the moment the label is written — the
 * outcome is drawn when the map is built and the label is a description of the
 * effect rather than of a result. So `-15% HP` stays a change, and it is here
 * rather than in `core/events.ts` so that a wording pass finds it with the
 * rest. The distinction is the point: this file is not "never say delta", it is
 * "say state wherever a state exists".
 */
export function hpEventDelta(fraction: number): string {
  const sign = fraction >= 0 ? '+' : '-';
  return `${sign}${Math.round(Math.abs(fraction) * 100)}% HP`;
}

/** `PP 87/88`, so the one other spendable resource is worded once too. */
export function ppState(current: number, max: number): string {
  return `PP ${current}/${max}`;
}
