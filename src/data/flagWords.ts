/**
 * The flag word vocabulary: what each truth `core/battle/flags.ts` reads is
 * called on screen.
 *
 * ## Why the words are here and the reading is in `core/`
 *
 * The reader answers "what happened". This answers "what we call it", and those
 * are different jobs with different reasons to change: a tuning pass rewords a
 * chip, it does not re-read a protocol. Rule — every balance or copy number a
 * tuning pass would touch lives under `data/` — puts the split exactly here.
 *
 * ## The line between these and `data/moveTags.ts`
 *
 * `moveTags.ts` already states it from its side, and it is the whole reason
 * both files exist: **a tag is a forecast about a move on a button, a flag word
 * is a truth about a turn that already resolved.** Neither derives from the
 * other and neither's absence implies the other's. The vocabulary is
 * deliberately shared where the concept is — `STAB`, `Priority`, `Contact` —
 * so the player learns one word set rather than two that nearly agree.
 *
 * The pre-selection effectiveness marker on the move button is the same story
 * and the same rule: it is a forecast against the body currently standing
 * there, `SUPER EFFECTIVE` here is a fact about a hit that landed, and
 * `scene.ts`'s neutral suppression is that marker's business, not this table's.
 *
 * ## Part 4 applies to every word here
 *
 * Each is a restatement of a protocol line. `Critical hit` is correct; `great
 * roll` is not. `No effect` is correct; `wasted turn` is not. There is no word
 * in this table that says whether what happened was good.
 *
 * ## Weight is not carried here, and must not be added
 *
 * There is no size, no colour and no emphasis field, because the visual pass's
 * rule is that a super effective flag word is not larger, brighter or
 * accent-coloured relative to a not-very-effective one. A `weight` column would
 * be the first place that rule broke, and it would break silently. The chip
 * component gives every one of these the same recipe.
 *
 * ## This table must never enter `contentHash`
 *
 * Same argument as `data/moveTags.ts` and `data/archetypes.ts`: no RNG, no
 * generation, and two players on one seed holding different copies of this file
 * play the **identical run** with different words on it. When `contentHash` is
 * built its input must be an explicit file list, not a directory glob.
 */
import type { FlagKind } from '../core/battle/flags';

/** How a status id reads once it has been inflicted. */
const STATUS_INFLICTED: Record<string, string> = {
  brn: 'Burned',
  par: 'Paralysed',
  slp: 'Asleep',
  frz: 'Frozen',
  psn: 'Poisoned',
  tox: 'Badly poisoned',
};

/** The word each kind wears, before any detail is folded in. */
const FLAG_WORDS: Record<FlagKind, string> = {
  stab: 'STAB',
  super: 'Super effective',
  resisted: 'Not very effective',
  immune: 'No effect',
  crit: 'Critical hit',
  miss: 'Missed',
  contact: 'Contact',
  priority: 'Priority',
  status: 'Status',
  berry: 'Berry',
};

/**
 * The word for one flag, with its detail folded in where there is one.
 *
 * `detail` is the protocol's own value — a status id, an item name, a signed
 * bracket — so this is where it becomes a sentence fragment rather than a
 * field. An unknown status id falls back to the id in capitals rather than to
 * nothing: a word the player has not seen before is still a word they can look
 * up, and a silent gap is not.
 */
export function flagWord(kind: FlagKind, detail: string | null): string {
  if (kind === 'status' && detail) return STATUS_INFLICTED[detail] ?? detail.toUpperCase();
  // The berry names itself. "Oran Berry" is shorter than "Berry (Oran Berry)"
  // and says more.
  if (kind === 'berry' && detail) return detail;
  if (kind === 'priority' && detail) return `Priority ${detail}`;
  return FLAG_WORDS[kind];
}

/**
 * What the word is claiming, for the tooltip. One fact per kind.
 *
 * Present tense for the properties, past for the events, which is the same
 * distinction the words themselves carry: `Contact` is a thing the move is,
 * `Missed` is a thing that happened.
 */
export const FLAG_BLURBS: Record<FlagKind, string> = {
  stab: 'The user shares this move’s type, which multiplied its damage by 1.5.',
  super: 'The defender’s types take more than normal damage from this move’s type.',
  resisted: 'The defender’s types take less than normal damage from this move’s type.',
  immune: 'The defender took no damage at all from this move’s type.',
  crit: 'A critical hit. Ignores the defender’s positive defence stages and multiplies damage.',
  miss: 'The accuracy check failed, so the move did nothing this turn.',
  contact: 'This move makes physical contact, which is what abilities like Rough Skin and Static respond to.',
  priority: 'A priority bracket, not Speed, put this move first. A higher bracket moves before every lower one.',
  status: 'A status condition was inflicted and stays until it is cured or the battle ends.',
  berry: 'A held berry fired and was used up. It is gone from the Pokemon for the rest of the run.',
};
