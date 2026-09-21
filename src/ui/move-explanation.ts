/**
 * A move, explained. **Patch 4.7.2, step 5, and Release B item 3 pulled to it.**
 *
 * `core/battle/driver.describeMove` already returns the whole `MoveExplanation`
 * — accuracy, priority, target, band, secondaries, boosts, behavioural flags and
 * the dex's own short description — pure, headless and with no prose in it. This
 * is the other half: the rows a player reads, composed from those fields.
 *
 * ## Nothing here writes a sentence
 *
 * Every phrase comes from `data/moveCopy.ts` or `data/moveTags.ts`. That is the
 * same rule the tooltip layer follows and it is not tidiness: a sentence
 * describing a mechanic, written in the component that draws it, drifts from the
 * mechanic. It also keeps a copy change a one-file change, which is what the
 * editorial rule below actually needs to stay enforceable.
 *
 * ## Part 4 governs every row
 *
 * **Attributes, never verdicts.** `Accuracy 85%` is correct and `risky` is not;
 * `Hits 2 to 5 times, 25 base power each` is correct and `unreliable` is not.
 * Nothing here ranks a move, compares it to another, or says whether it is worth
 * taking. The one number that comes close is the band, and it is read straight
 * off `explanation.band` — from `bandOfMove`, never a second computation.
 *
 * ## Absent, not empty
 *
 * A move with no recoil gets no recoil row, rather than a row reading `—`. The
 * `MoveExplanation` type is built the same way for the same reason: a
 * present-but-empty field is how a card grows a blank row.
 */
import type { MoveExplanation } from '../core/types';
import { categoryInfo } from '../data/categoryInfo';
import {
  accuracyPhrase,
  boostPhrase,
  chargePhrase,
  drainPhrase,
  effectPhrase,
  healPhrase,
  priorityPhrase,
  recoilPhrase,
  secondaryPhrase,
  statusPhrase,
  statusVerbPhrase,
} from '../data/moveCopy';
import { MOVE_TAG_BY_ID, multiHitLine, type MoveTag } from '../data/moveTags';
import { targetWords } from '../data/moveTargets';

/** One labelled row. The label is a category, the value is the fact. */
interface Row {
  label: string;
  value: string;
}

/**
 * The rows for one move, in reading order.
 *
 * **Exported so a test can assert the content without a DOM**, which is what
 * keeps "the explanation says the accuracy" a cheap assertion rather than a
 * query against rendered markup.
 *
 * Order is deliberate and is the brief's: what the move *is* (type, category,
 * power, band, PP), then how often it lands (accuracy, priority, target), then
 * what it does beyond damage (secondary, stat changes, status, field effect),
 * then how it behaves (the tag vocabulary), and the dex's own line last. The dex
 * line is last because it is a summary of everything above it — putting it first
 * would make the rows read as a restatement.
 */
export function moveExplanationRows(move: MoveExplanation, tags: readonly MoveTag[] = []): Row[] {
  const rows: Row[] = [];
  const add = (label: string, value: string | null): void => {
    if (value) rows.push({ label, value });
  };

  add('Type', move.type);
  add('Category', categoryInfo(move.category)?.label ?? move.category);

  /*
   * Base power and band together, or neither.
   *
   * **They can disagree without either being wrong** — banding happens on a
   * multi-hit move's *total* power, so Population Bomb is band 4 at 20 base
   * power — and `MoveExplanation.band`'s own note says anything rendering one
   * must render the other or the badge reads as a bug. The multi-hit row below
   * is the sentence that reconciles them.
   */
  if (move.category !== 'Status') add('Base power', String(move.basePower));
  if (move.band !== null) add('Band', `${move.band}`);
  if (move.multiHit) add('Multi-hit', multiHitLine(move.multiHit, move.basePower));

  add('PP', String(move.maxPp));
  add('Accuracy', accuracyPhrase(move.accuracy));
  if (move.priority !== 0) add('Priority', priorityPhrase(move.priority));
  add('Target', targetWords(move.target));

  for (const boost of move.boosts ?? []) {
    add('Stat change', boostPhrase(boost.stat, boost.stages, boost.target));
  }
  if (move.status) add('Status', statusPhrase(move.status));
  if (move.volatile) add('Effect', effectPhrase(move.volatile));
  if (move.fieldEffect) add('Field', effectPhrase(move.fieldEffect));
  if (move.heal !== undefined) add('Healing', healPhrase(move.heal));
  if (move.drain !== undefined) add('Drain', drainPhrase(move.drain));
  if (move.recoil !== undefined) add('Recoil', recoilPhrase(move.recoil));
  if (move.chargeTurns) add('Charge', chargePhrase('charge'));
  if (move.rechargeTurns) add('Recharge', chargePhrase('recharge'));

  /*
   * The secondary, as a chance and an effect rather than as a word.
   *
   * `secondaryPhrase` builds `30% chance to burn the target`. The chance is the
   * whole of what a player is asking when they tap a move that sometimes does
   * something extra, and a card that said "may burn" would be withholding the
   * only part of it that is a fact.
   */
  const secondary = move.secondary;
  if (secondary) {
    const effect =
      secondary.status
        ? statusVerbPhrase(secondary.status)
        : secondary.volatile
          ? effectPhrase(secondary.volatile).toLowerCase()
          : secondary.boosts?.length
            ? secondary.boosts
                .map((boost) => boostPhrase(boost.stat, boost.stages, 'foe').toLowerCase())
                .join(', ')
            : null;
    if (effect) add('Secondary', secondaryPhrase(secondary.chance, effect));
  }

  /*
   * The behavioural flags, through the tag vocabulary's `long` form.
   *
   * `MoveTagDefinition.long` is documented as "how it reads in the explanation,
   * where there is room for a sentence" — the vocabulary was built for this and
   * this is the reader it was waiting for. The tags arrive already derived and
   * already ordered by `core/moveTags.ts`, so nothing here decides which apply.
   *
   * The ones that only restate a row above are dropped rather than printed
   * twice: accuracy, priority, multi-hit, recoil, drain, charge and recharge all
   * have their own row, and STAB is a fact about the holder rather than the
   * move.
   */
  const RESTATED = new Set(['accuracy', 'neverMisses', 'priority', 'multiHit', 'recoil', 'drain', 'charge', 'recharge', 'stab']);
  const behaviours = tags
    .filter((tag) => !RESTATED.has(tag.id))
    .map((tag) => MOVE_TAG_BY_ID[tag.id]?.long)
    .filter((long): long is string => Boolean(long));
  for (const behaviour of behaviours) add('Behaviour', behaviour);

  add('Dex', move.shortDesc);
  return rows;
}
