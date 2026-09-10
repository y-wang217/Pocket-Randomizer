/**
 * Every sentence a status move's effect readout is made of.
 *
 * ## The problem this fixes
 *
 * A status move renders three empty regions where base power, band and the
 * effectiveness marker sit on a damaging move. Three blanks in a row reads as
 * broken, and the player's reasonable conclusion is that the card failed to
 * load rather than that the move has no base power. The exact region carries a
 * one-line effect readout instead.
 *
 * ## Why the sentences are here
 *
 * `core/` returns structured fields — `boosts`, `heal`, `volatile`, `status`,
 * `fieldEffect`, `priority` — and never a prose blob. `ui/` renders. The words
 * are here, in the middle, so a copy change is a one-file change and no
 * sentence describing a mechanic lives in the file that paints it.
 *
 * ## Part 4 applies to every line below
 *
 * `Raises Attack by 2 stages` is correct. `Great before a sweep` is not.
 * `Restores half of max HP` is correct. `Best used at low HP` is not. Every
 * sentence here restates a field and stops.
 *
 * Same as `data/moveTags.ts` and `data/archetypes.ts`: this file consumes no
 * RNG, feeds no generation, and must never enter `contentHash`.
 */

/** Stat abbreviations as a sentence spells them, not as the sim keys them. */
const STAT_WORDS: Record<string, string> = {
  atk: 'Attack',
  def: 'Defence',
  spa: 'Sp. Attack',
  spd: 'Sp. Defence',
  spe: 'Speed',
  accuracy: 'accuracy',
  evasion: 'evasion',
};

/** Status ids as a sentence spells them. Matches `data/statusInfo.ts`'s chips. */
const STATUS_WORDS: Record<string, string> = {
  brn: 'burns',
  par: 'paralyses',
  psn: 'poisons',
  tox: 'badly poisons',
  slp: 'puts to sleep',
  frz: 'freezes',
};

/**
 * Volatiles and field effects worth naming, and what to call them.
 *
 * An allowlist, like `view.ts`'s volatile chips and for the same reason: the
 * engine tracks a great many internal conditions whose ids would be noise on a
 * card. An id with no entry falls back to its own spelling rather than being
 * dropped, so a move is never described as doing nothing.
 */
const EFFECT_WORDS: Record<string, string> = {
  protect: 'protects the user this turn',
  substitute: 'puts up a substitute at 1/4 max HP',
  confusion: 'confuses the target',
  leechseed: 'seeds the target',
  taunt: 'taunts the target',
  encore: 'locks the target into its last move',
  trickroom: 'reverses turn order for 5 turns',
  reflect: 'halves physical damage on the user’s side for 5 turns',
  lightscreen: 'halves special damage on the user’s side for 5 turns',
  safeguard: 'blocks status on the user’s side for 5 turns',
  tailwind: 'doubles the user’s side’s Speed for 4 turns',
  stealthrock: 'sets Stealth Rock on the opposing side',
  spikes: 'sets Spikes on the opposing side',
  toxicspikes: 'sets Toxic Spikes on the opposing side',
  wish: 'heals the slot at the end of next turn',
  raindance: 'sets rain for 5 turns',
  sunnyday: 'sets harsh sunlight for 5 turns',
  sandstorm: 'sets a sandstorm for 5 turns',
  snowscape: 'sets snow for 5 turns',
  electricterrain: 'sets Electric Terrain for 5 turns',
  grassyterrain: 'sets Grassy Terrain for 5 turns',
  psychicterrain: 'sets Psychic Terrain for 5 turns',
  mistyterrain: 'sets Misty Terrain for 5 turns',
};

/** One stat change, as a phrase. `Raises Attack by 2` / `Lowers the target's Speed by 1`. */
export function boostPhrase(stat: string, stages: number, target: 'self' | 'foe'): string {
  const word = STAT_WORDS[stat] ?? stat;
  const verb = stages > 0 ? 'Raises' : 'Lowers';
  const whose = target === 'self' ? '' : 'the target’s ';
  const magnitude = Math.abs(stages);
  return `${verb} ${whose}${word} by ${magnitude} ${magnitude === 1 ? 'stage' : 'stages'}`;
}

/** `Restores half of max HP`, from a fraction. */
export function healPhrase(fraction: number): string {
  return `Restores ${fractionWords(fraction)} of max HP`;
}

/** `Badly poisons the target`, from a status id. */
export function statusPhrase(status: string): string {
  const verb = STATUS_WORDS[status];
  return verb ? `${capitalize(verb)} the target` : `Inflicts ${status}`;
}

/** `Protects the user this turn`, from a volatile or field-effect id. */
export function effectPhrase(effect: string): string {
  const words = EFFECT_WORDS[effect];
  return words ? capitalize(words) : `Applies ${effect}`;
}

/**
 * `Moves in the +4 bracket`, from a priority number.
 *
 * Stated as a bracket rather than as "moves first", because a +1 move does not
 * move first against a +2 move and a readout that said it did would be wrong in
 * exactly the situation the player is trying to reason about.
 */
export function priorityPhrase(priority: number): string {
  const sign = priority > 0 ? `+${priority}` : `${priority}`;
  return `Moves in the ${sign} priority bracket`;
}

/** `Costs a charge turn` / `Costs a recharge turn`. */
export function chargePhrase(kind: 'charge' | 'recharge'): string {
  return kind === 'charge'
    ? 'Spends a turn charging before it lands'
    : 'The user cannot act on the turn after this one';
}

/** `The user takes 1/3 of the damage dealt`. */
export function recoilPhrase(fraction: number): string {
  return `The user takes ${fractionWords(fraction)} of the damage dealt`;
}

/** `The user recovers half of the damage dealt`. */
export function drainPhrase(fraction: number): string {
  return `The user recovers ${fractionWords(fraction)} of the damage dealt`;
}

/** `30% chance to burn the target`. */
export function secondaryPhrase(chance: number, effect: string): string {
  return `${chance}% chance to ${effect}`;
}

/**
 * `Accuracy 85%` and `Never misses`, which is the most important line here.
 *
 * The single field most likely to make a player think the game cheated. Stated
 * as a number, never as a judgement: "Accuracy 85%" is correct and "risky" is
 * not.
 */
export function accuracyPhrase(accuracy: number | true): string {
  return accuracy === true ? 'Never misses' : `Accuracy ${accuracy}%`;
}

/**
 * A fraction as a player reads it: `half`, `a third`, `1/8`.
 *
 * Named forms for the three that appear constantly and a fraction for the rest.
 * The sim stores recoil as `[1, 3]`, which is 0.333…, so the comparison has a
 * tolerance rather than being exact — a bare `=== 1/3` would silently fall
 * through to `0.33` on a value that came back as `0.33`.
 */
function fractionWords(fraction: number): string {
  if (close(fraction, 1 / 2)) return 'half';
  if (close(fraction, 1 / 3)) return 'a third';
  if (close(fraction, 1 / 4)) return 'a quarter';
  const denominator = Math.round(1 / fraction);
  return close(fraction, 1 / denominator) ? `1/${denominator}` : `${Math.round(fraction * 100)}%`;
}

function close(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.02;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The structured fields a status readout is composed from.
 *
 * Declared here rather than in `core/` for the boundary reason
 * `data/moveTags.ts` gives about `MoveTag`: `src/ui/scene.ts` renders this and
 * may not import `core/moveTags`. The *derivation* is still `core/`'s —
 * `core/moveTags.statusEffectFields` decides which fields are present — and
 * this is the shape they travel in.
 */
export interface MoveEffectFields {
  boosts?: readonly { stat: string; stages: number; target: 'self' | 'foe' }[];
  heal?: number;
  status?: string;
  volatile?: string;
  fieldEffect?: string;
  priority: number;
}

/**
 * A status move's effect, as the lines a card renders.
 *
 * **This is what fills the three empty regions.** On a damaging move the card
 * carries base power, a band badge and an effectiveness marker; on a status
 * move all three are blank, and three blanks in a row reads as a card that
 * failed to load. The same region carries these lines instead.
 *
 * One line per present field, in a fixed order, and **absent fields produce no
 * line** rather than an empty one. Priority is last because it qualifies
 * everything above it: what the move does first, then when it happens.
 */
export function statusReadout(effect: MoveEffectFields): string[] {
  const lines: string[] = [];
  for (const boost of effect.boosts ?? []) {
    lines.push(boostPhrase(boost.stat, boost.stages, boost.target));
  }
  if (effect.heal) lines.push(healPhrase(effect.heal));
  if (effect.status) lines.push(statusPhrase(effect.status));
  if (effect.volatile) lines.push(effectPhrase(effect.volatile));
  if (effect.fieldEffect) lines.push(effectPhrase(effect.fieldEffect));
  if (effect.priority !== 0) lines.push(priorityPhrase(effect.priority));
  return lines;
}

/**
 * The same readout as one line, for a button face with room for one.
 *
 * Joined with a middot rather than truncated to the first line: a Protect that
 * said only "Protects the user this turn" and dropped its +4 bracket would be
 * hiding the half of it that decides turns.
 */
export function statusReadoutLine(effect: MoveEffectFields): string {
  return statusReadout(effect).join(' · ');
}
