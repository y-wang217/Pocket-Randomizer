/**
 * What every condition on the battle screen actually does, and what to do
 * about it.
 *
 * ## Why this is hand written when everything else in this stage is generated
 *
 * The type chart is generated from the dex and the ability text is wrapped from
 * it, because both are already written in a form a player can use. Condition
 * text is not. `Dex.conditions.get('tox')` carries handler functions and
 * nothing else — there is no description field to wrap — and the closest thing,
 * the *move* that applies it, describes the move rather than the state you are
 * now in. "Badly poisons the target" is not what a player staring at a TOX chip
 * needs to know.
 *
 * ## Every number here was read out of the engine
 *
 * Not out of a wiki, not out of the stage brief, and not out of memory. The
 * format config decides these — Custom Game carries no Sleep Clause, and a
 * generation change would move several of them — so each line below was taken
 * from the gen 9 condition handler that implements it:
 *
 *   - `brn` 1/16 residual, and the halving is applied to **physical damage** in
 *     `BattleActions#getDamage`, not to the Attack stat. That distinction is
 *     why the stat panel does not show a burned Pokemon a reduced Attack: the
 *     engine never computes one.
 *   - `psn` 1/8. `tox` 1/16 x a counter that climbs by one each turn and resets
 *     on switch-out — so turn one is 1/16 and turn four is 4/16.
 *   - `par` Speed x0.5, applied *after* every other Speed modifier, and a flat
 *     1-in-4 chance of losing the turn.
 *   - `slp` `random(2, 5)` turns of sleep counter, decremented before the move
 *     check, which is 1 to 3 turns actually lost.
 *   - `frz` a 1-in-5 thaw check each turn, plus a guaranteed thaw from any Fire
 *     damaging move.
 *   - `confusion` `random(2, 6)` on the same decrement-first pattern, so 1 to 4
 *     turns, with a 33/100 chance each turn of a 40-BP typeless physical hit on
 *     yourself.
 *   - `leechseed` 1/8 drained and healed to the seeder. `substitute` costs 1/4
 *     max HP and is bypassed by sound moves.
 *
 * ## The two-line shape
 *
 * One line of mechanics with the real numbers, one line of what to do about it.
 * The second line is the one that earns the tooltip: a player who has never
 * played Pokemon can read "1/16 per turn" and still not know that the answer to
 * a burn is usually to keep attacking specially rather than to switch.
 *
 * The advice is GYMRUN's, not the games'. `tuning.clearStatusBetweenNodes` is
 * on, so a status lasts one encounter and never follows you up the map — which
 * changes the right answer to almost every one of these, and is the sort of
 * thing a player would otherwise have to lose a run to learn.
 */

export interface StatusEntry {
  /** What the chip says. */
  label: string;
  /** The mechanic, with the numbers the engine actually uses. */
  mechanics: string;
  /** What the player should do about it. */
  advice: string;
}

/**
 * The six major statuses — the ones the sim tracks on `pokemon.status`, only
 * one of which can be on a Pokemon at a time.
 */
export const STATUS_INFO: Readonly<Record<string, StatusEntry>> = {
  brn: {
    label: 'Burn',
    mechanics:
      'Loses 1/16 of max HP at the end of every turn, and its physical moves deal half damage. Special moves are unaffected.',
    advice:
      'Attack specially if you can — a burn barely touches a special attacker. Burning an opposing physical attacker is often worth more than the chip damage.',
  },
  par: {
    label: 'Paralysis',
    mechanics:
      'Speed is halved, applied after every other Speed change, and there is a 1-in-4 chance each turn of being unable to move at all.',
    advice:
      'Check the Speed row: halving often flips who moves first, which is the real cost. Do not count on a turn going through.',
  },
  psn: {
    label: 'Poison',
    mechanics: 'Loses 1/8 of max HP at the end of every turn. The rate never changes.',
    advice:
      'A clock, not a crisis. Eight turns from full is fatal, so count how many turns you actually need and stop worrying about the rest.',
  },
  tox: {
    label: 'Bad poison',
    mechanics:
      'Loses 1/16 of max HP the first turn, 2/16 the next, 3/16 the next, climbing every turn. The counter resets if it switches out.',
    advice:
      'The opposite of ordinary poison: harmless now and lethal in five turns. Win quickly or switch, and switching is what resets the counter.',
  },
  slp: {
    label: 'Sleep',
    mechanics:
      'Cannot move for 1 to 3 turns, decided when it falls asleep. There is no way to see how many are left.',
    advice:
      'A free turn or three, and you do not know which. Set up if you are ahead; do not spend your last PP on a guess.',
  },
  frz: {
    label: 'Freeze',
    mechanics:
      'Cannot move. A 1-in-5 chance of thawing each turn, and any Fire-type damaging move thaws it immediately.',
    advice:
      'The harshest status in the game and pure luck. If you are the one frozen, expect to lose two turns; never use a Fire move on something you have just frozen.',
  },
};

/**
 * Volatile conditions — the ones that live on `pokemon.volatiles` and vanish
 * when it leaves the field.
 *
 * The allowlist is `VOLATILE_LABELS` in `core/battle/view.ts`, and the two are
 * kept in step by `test/tooltips.test.ts` rather than by discipline: the engine
 * tracks dozens more, most of them bookkeeping a player has no decision to make
 * about, and a panel showing all of them would bury the four that matter.
 */
export const VOLATILE_INFO: Readonly<Record<string, StatusEntry>> = {
  confusion: {
    label: 'Confusion',
    mechanics:
      'Lasts 1 to 4 turns. Each turn there is a 33% chance of hitting itself instead — a 40-power physical hit that ignores type entirely.',
    advice:
      'Two thirds of your turns still land. Switching clears it outright, which is usually better than rolling the dice three times.',
  },
  substitute: {
    label: 'Substitute',
    mechanics:
      'A decoy with 1/4 of the user’s max HP, taken out of its own HP. It absorbs damage and status until it breaks. Sound moves go straight through it.',
    advice:
      'Break it or ignore it — chipping at it wastes turns. A sound move such as Boomburst or Hyper Voice bypasses it completely.',
  },
  leechseed: {
    label: 'Leech Seed',
    mechanics:
      'Loses 1/8 of max HP at the end of every turn, and the Pokemon that seeded it heals by the same amount.',
    advice:
      'Costs you twice over, so it is worse than poison at the same rate. Switching removes it; Grass types cannot be seeded at all.',
  },
  flinch: {
    label: 'Flinch',
    mechanics:
      'Loses this turn entirely. It only happens when the flincher moves first, and it never lasts more than one turn.',
    advice:
      'Nothing to do about it once it lands. It is the hidden cost of being slower — check the Speed row.',
  },
  trapped: {
    label: 'Trapped',
    mechanics: 'Cannot switch out. Moves are still available.',
    advice:
      'You are committed to this matchup, so play it out. The bench panel names what is holding you when the game knows.',
  },
  partiallytrapped: {
    label: 'Bound',
    mechanics:
      'Cannot switch out, and loses 1/8 of max HP at the end of every turn, for up to 5 turns.',
    advice:
      'A trap with a clock on it. Count the turns — the damage stops on its own, and until then you are fighting whatever is in front of you.',
  },
  taunt: {
    label: 'Taunt',
    mechanics: 'Cannot select status moves for 3 turns. Damaging moves are unaffected.',
    advice:
      'Your setup and healing are gone for three turns. Attack, or switch out — leaving the field clears it.',
  },
  encore: {
    label: 'Encore',
    mechanics: 'Forced to repeat its last move for 3 turns, or until that move runs out of PP.',
    advice:
      'Brutal if it catches a status move. Switching clears it, and is usually the answer if the locked move does nothing useful.',
  },
  disable: {
    label: 'Disable',
    mechanics: 'One move — the last one used — cannot be selected for 4 turns.',
    advice:
      'Usually your best move, by design. Switching clears it; otherwise work with the other three.',
  },
  attract: {
    label: 'Infatuation',
    mechanics:
      'A 50% chance of being unable to move each turn. Only works between opposite genders.',
    advice:
      'Half your turns, gone. Switching clears it, and it is worth the switch almost every time.',
  },
  curse: {
    label: 'Cursed',
    mechanics:
      'Loses 1/4 of max HP at the end of every turn. Only a Ghost type can apply it, and it costs the user half its own HP.',
    advice:
      'The fastest clock in the game — four turns from full. Switch out; it does not follow you.',
  },
  nightmare: {
    label: 'Nightmare',
    mechanics: 'Loses 1/4 of max HP at the end of every turn, but only while asleep.',
    advice: 'It ends the moment you wake up. Until then it is the heaviest chip damage there is.',
  },
  yawn: {
    label: 'Drowsy',
    mechanics: 'Falls asleep at the end of the following turn unless it switches out first.',
    advice: 'You have exactly one turn to switch. Take it, or accept the sleep.',
  },
  perishsong: {
    label: 'Perish Song',
    mechanics: 'Faints in 3 turns. Every Pokemon on the field that heard it is on the same clock.',
    advice:
      'Switching is the only escape, and it resets the count. If you have no bench, you have three turns to win.',
  },
  torment: {
    label: 'Torment',
    mechanics: 'Cannot select the same move twice in a row.',
    advice:
      'You need a second move worth using. Switching clears it and resets what counts as your last move.',
  },
  aquaring: {
    label: 'Aqua Ring',
    mechanics: 'Recovers 1/16 of max HP at the end of every turn. Lasts until it leaves the field.',
    advice: 'Free healing, and it stacks with anything else. Nothing to do but let it run.',
  },
  ingrain: {
    label: 'Ingrain',
    mechanics:
      'Recovers 1/16 of max HP at the end of every turn — but cannot switch out, and becomes hittable by Ground moves.',
    advice:
      'A trade: healing for mobility. Fine against something you can outlast, dangerous against anything that can switch in on you.',
  },
  focusenergy: {
    label: 'Focused',
    mechanics: 'Critical-hit ratio raised by two stages, which is roughly a 50% crit rate.',
    advice: 'Attack. Crits ignore the target’s defensive boosts, so it is strongest into a wall.',
  },
};

/** Look up either kind. Statuses and volatiles never share an id. */
export function statusInfo(id: string): StatusEntry | null {
  return STATUS_INFO[id] ?? VOLATILE_INFO[id] ?? null;
}

/**
 * A run-wide fact that changes the answer to every entry above.
 *
 * Shown under any status tooltip while `tuning.clearStatusBetweenNodes` is on,
 * which it is by default. Stage 1 turned it on for the same reason this stage
 * reveals the opponent's ability: a run lost to a status the player was never
 * told the rules of is not a difficult run.
 */
export const STATUS_PERSISTENCE_NOTE =
  'In GYMRUN a status lasts one encounter — it is cleared before the next node.';
