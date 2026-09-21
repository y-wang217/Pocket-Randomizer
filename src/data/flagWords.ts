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
 * There is no size, no emphasis and no ranking field, because the visual pass's
 * rule is that a super effective flag word is not larger, heavier or more
 * emphatic than a not-very-effective one. A `weight` column would be the first
 * place that rule broke, and it would break silently. The chip component gives
 * every one of these the same recipe.
 *
 * **Colour is the one axis that moved, and it did not move here** (2026-09-21,
 * D27). Section 2 gives the effectiveness family one colour across the forecast
 * edge and the feedback flag, so `super`, `resisted` and `immune` wear the
 * forecast's own tokens on screen — both directions of the one fact, drawn at
 * the same weight, which is an encoding rather than a ranking. It lives in the
 * stylesheet keyed off the kind, and there is still no colour field in this
 * table: a word does not know what it is drawn in.
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

/**
 * How a `|cant|` reason reads. **Branch 2.**
 *
 * The turns where nothing happened, which is the whole reason this class was
 * built first — a flinched turn draws no damage, so no chunk and no beat, and
 * without a word it is indistinguishable from a turn that did not happen.
 *
 * Part 4 applies as everywhere else: these say what stopped the move, never
 * that the player was unlucky. "Flinched" is correct; "wasted turn" is not.
 */
const PREVENTED: Record<string, string> = {
  flinch: 'Flinched',
  par: 'Fully paralysed',
  slp: 'Asleep',
  frz: 'Frozen solid',
  recharge: 'Recharging',
};

/**
 * How a volatile reads once it has begun.
 *
 * **A different register from `core/battle/view.ts`'s `VOLATILE_LABELS`, and
 * deliberately so** — the same split this file already makes for status, where
 * the panel says `BRN` and the strip says `Burned`. The panel names a condition
 * that is true now; the strip names a thing that happened. Present tense and
 * past tense are not the same word and one table cannot hold both.
 *
 * Keyed by the ids in `DISPLAYED_VOLATILES`, which is what `flags.ts` filters
 * on, so the two cannot drift apart about which volatiles exist — only about
 * how each is said, which is this file's job.
 */
const VOLATILE_BEGAN: Record<string, string> = {
  confusion: 'Confused',
  substitute: 'Substitute up',
  leechseed: 'Seeded',
  flinch: 'Flinched',
  partiallytrapped: 'Bound',
  trapped: 'Trapped',
  taunt: 'Taunted',
  encore: 'Encored',
  disable: 'Disabled',
  attract: 'Infatuated',
  curse: 'Cursed',
  nightmare: 'Nightmare',
  yawn: 'Drowsy',
  perishsong: 'Perish Song',
  torment: 'Tormented',
  aquaring: 'Aqua Ring',
  ingrain: 'Ingrained',
  focusenergy: 'Focused',
};

/** The six stats, as a stat stage line names them. */
const STAT_WORDS: Record<string, string> = {
  atk: 'Attack',
  def: 'Defence',
  spa: 'Sp. Atk',
  spd: 'Sp. Def',
  spe: 'Speed',
  accuracy: 'Accuracy',
  evasion: 'Evasion',
};

/**
 * Weather and terrain, where the engine's id is not a word.
 *
 * Only the ids that need translating are here; anything else falls through to
 * its own name, which is already readable — `Sandstorm`, `Electric Terrain`.
 */
const FIELD_WORDS: Record<string, string> = {
  RainDance: 'Rain',
  SunnyDay: 'Harsh sunlight',
  Sandstorm: 'Sandstorm',
  Hail: 'Hail',
  Snow: 'Snow',
  DeltaStream: 'Strong winds',
  DesolateLand: 'Extreme sun',
  PrimordialSea: 'Heavy rain',
};

/** The word each kind wears, before any detail is folded in. */
const FLAG_WORDS: Record<FlagKind, string> = {
  super: 'Super effective',
  resisted: 'Not very effective',
  immune: 'No effect',
  crit: 'Critical hit',
  miss: 'Missed',
  priority: 'Priority',
  status: 'Status',
  berry: 'Berry',
  prevented: 'Could not move',
  failed: 'Failed',
  boost: 'Rose',
  unboost: 'Fell',
  ability: 'Ability',
  volatile: 'Condition',
  field: 'Field',
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
  /*
   * The abnormalities. **Branch 2.**
   *
   * An ability names itself for the same reason a berry does: "Intimidate" is
   * shorter than "Ability (Intimidate)" and says more. A `cant` reason of the
   * form `ability: Truant` is the same case one level in, so the prefix comes
   * off rather than being printed.
   */
  if (kind === 'ability' && detail) return detail;
  if (kind === 'prevented' && detail) {
    const named = /^ability: (.+)$/.exec(detail);
    if (named?.[1]) return named[1];
    /*
     * An unfamiliar reason is still shown, for the reason `status` gives above:
     * a word the player has not seen before is one they can look up, and a
     * silent gap is not. Sentence case rather than the raw id, because a
     * lowercase chip sitting in a row of Title Case ones reads as a defect
     * rather than as an unknown.
     */
    return PREVENTED[detail] ?? `${detail.charAt(0).toUpperCase()}${detail.slice(1)}`;
  }
  if (kind === 'volatile' && detail) return VOLATILE_BEGAN[detail] ?? detail;
  /*
   * A stat stage says which stat and which way, and **not how far**. The stage
   * chip on the panel beside it already carries the magnitude, and a word that
   * grew with the number would be the mistake `--hit-recoil`'s comment names:
   * a verdict on the board rather than a fact about the turn.
   */
  if (kind === 'boost' && detail) return `${STAT_WORDS[detail] ?? detail} rose`;
  if (kind === 'unboost' && detail) return `${STAT_WORDS[detail] ?? detail} fell`;
  if (kind === 'field' && detail) return FIELD_WORDS[detail] ?? detail;
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
  super: 'The defender’s types take more than normal damage from this move’s type.',
  resisted: 'The defender’s types take less than normal damage from this move’s type.',
  immune: 'The defender took no damage at all from this move’s type.',
  crit: 'A critical hit. Ignores the defender’s positive defence stages and multiplies damage.',
  miss: 'The accuracy check failed, so the move did nothing this turn.',
  priority: 'A priority bracket, not Speed, put this move first. A higher bracket moves before every lower one.',
  status: 'A status condition was inflicted and stays until it is cured or the battle ends.',
  berry: 'A held berry fired and was used up. It is gone from the Pokemon for the rest of the run.',
  prevented: 'A condition stopped the Pokemon moving, so its turn produced nothing at all.',
  failed: 'The move resolved but did nothing. Its conditions were not met, or there was nothing for it to do.',
  boost: 'A stat stage went up. The panel’s stage chip says by how much, and what the multiplier now is.',
  unboost: 'A stat stage went down. The panel’s stage chip says by how much, and what the multiplier now is.',
  ability: 'An ability announced itself and did something this turn. Abilities are always on; this is one firing.',
  volatile: 'A temporary condition began. It lasts until it ends or the Pokemon leaves the field, and it is not a status.',
  field: 'Weather or terrain began. It applies to both sides of the field, not to one Pokemon.',
};
