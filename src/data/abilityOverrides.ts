/**
 * Replacement tooltip text for abilities whose dex description is unreadable
 * to a new player.
 *
 * **Empty on arrival, and that is the design.** The dex's `shortDesc` is the
 * default for all 310 abilities in the pool, and it is usually good — it is
 * written by people who play the game, it is kept current with the generation,
 * and wrapping it means the tooltip cannot drift from the mechanic the way a
 * hand-written copy would.
 *
 * Where it fails, it fails for one reason: it is written for someone who
 * already knows the vocabulary. "This Pokemon is immune to Ground; Gravity /
 * Ingrain / Smack Down / Iron Ball nullify it" is exact and is four proper
 * nouns a new player has never met. GYMRUN makes that worse than a normal
 * Pokemon game does, because abilities are drawn off-species from the whole
 * pool — a player will meet obscure abilities constantly and has no chance to
 * build up familiarity the way a normal playthrough allows.
 *
 * ## Why it is not pre-filled
 *
 * Guessing which descriptions are unreadable is how you end up rewriting forty
 * of them, getting six wrong, and leaving the ones that actually confused
 * someone untouched. **This file grows from playtest.** When a player asks what
 * an ability does *after* reading the tooltip, that ability gets an entry, and
 * the entry says what they needed to hear.
 *
 * The keys are dex ids — `wellbakedbody`, not `Well-Baked Body`. Any entry that
 * does not name a drawable ability fails `test/tooltips.test.ts`, so a typo
 * here is caught rather than silently never displayed.
 */

/**
 * Keyed by dex ability id. The value replaces `shortDesc` entirely.
 *
 * Keep it to one or two sentences and say the effect, not the flavour — it sits
 * in the same tooltip slot the dex text would have.
 */
export const ABILITY_OVERRIDES: Readonly<Record<string, string>> = {};

/** The tooltip text for an ability: an override if one exists, else the dex's. */
export function abilityText(id: string, shortDesc: string): string {
  return ABILITY_OVERRIDES[id] ?? shortDesc;
}
