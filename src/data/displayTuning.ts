/**
 * The display numbers, split out of `Tuning` so moving one does not refuse a
 * shared seed. **The battle animation overnight run, Branch 1.**
 *
 * ## Why this file exists
 *
 * `contentHash` is a glob over `src/data/**` minus one exclusion list, and
 * `tuning.ts` is hashed whole. Three of its fields decide nothing about a run:
 * how long a shadow lingers, how small a chip's text may get, and how much
 * contrast that text needs. Editing one of them changed the hash, and a player
 * who had shared a seed across that edit had it refused. `build-config/content-hash.ts`
 * names the cost and calls it the safe error:
 *
 * > a display number that shares a file with a balance number (`tuning.ts`'s
 * > `battleFeedbackMs`) is hashed with its neighbours: that costs a false
 * > rejection when the display number moves, which is the safe error, and the
 * > alternative is a per-field list that reintroduces the discipline this file
 * > exists to retire.
 *
 * That reasoning is right about the alternative it rejects. A per-field list is
 * worse than a whole-file rule. But there is a third option it did not take,
 * which is a per-*file* split — and that is this file. The rule stays "hash the
 * file, or exclude the file"; what changes is which file these three live in.
 * Release C recommended it, `docs/handoff/overnight-1-contenthash.md` carried it
 * as morning decision 3, and `docs/generation.md` marked it **open, small**.
 *
 * It became urgent rather than tidy when a playtest reported the battle beats
 * were too fast to see. `battleFeedbackMs` is the number that fixes that, and
 * it is the one number in `tuning.ts` whose own doc comment said it was
 * "waiting on a playtest rather than on a sweep". A number parked for a
 * playtest must be movable when the playtest arrives.
 *
 * ## Why `maxMoveTagsOnFace` is not here
 *
 * The filed recommendation named it alongside `battleFeedbackMs`, and it cannot
 * come. A file may be excluded from the hash only if nothing under `core/`
 * imports it at any depth — `test/content-hash.test.ts` walks the import graph
 * and holds that — and `core/battle/view.ts` reads `maxMoveTagsOnFace` for its
 * `DEFAULT_MAX_MOVE_TAGS`. Moving it here would make this file a `core/`
 * dependency and disqualify the whole exclusion, taking the other three down
 * with it.
 *
 * So it stays on `Tuning`, still hashed, and its own comment's argument for
 * being there still holds: the simulator can sweep a `Tuning` field. Recorded
 * as a deviation from the filed recommendation in `docs/generation.md`.
 *
 * ## What is given up, deliberately
 *
 * These three leave `Tuning`, so `npm run sim --set battleFeedbackMs=…` no
 * longer resolves and the sim report's `tuning` block no longer carries them.
 * That is the correct outcome rather than a cost: the simulator has no opinion
 * about how long a shadow should linger, and a report that records a number
 * which changed nothing it measured was recording noise. `maxMoveTagsOnFace`
 * keeps its sweepability precisely because "how much fits on a phone" is worth
 * varying, and these three are not.
 */

/** A number that changes what the game looks like and nothing about what it rolls. */
export interface DisplayTuning {
  /**
   * How long the battle screen's feedback takes to settle, in milliseconds.
   *
   * **One number for all of it, and that is the constraint rather than a
   * convenience.** `ui/theme/motion.ts` writes it onto `--motion-duration` at
   * startup and every battle-feedback length in `styles.css` derives from that
   * token, so there is exactly one place the feel of a turn is set and no
   * second constant to find.
   *
   * **It is not a delay, with one exception.** Nothing mid-fight waits for it:
   * the bar, the HP text, the flag words and the move buttons are all correct
   * and interactive on the frame the update arrives, and a tap resolves every
   * animation early. The exception is the end of a battle, where the result
   * screen is held until the last turn's beats have played — see
   * `ui/theme/motion.ts` and `docs/generation.md`.
   *
   * **On the value.** 500 was the Release C prompt's default and was never
   * measured against anything; the four beats of a turn are `D/4` each, so 500
   * made a beat 125ms. A playtest reported that as too fast to see, which is
   * exactly the sweep this number was parked for. The current value is that
   * playtest's answer.
   *
   * Still not a balance finding, and still not something `npm run sim` can
   * measure. It is swept by watching.
   */
  battleFeedbackMs: number;

  /**
   * The smallest a chip's text may render, in CSS pixels. **Patch 4.7.2.**
   *
   * A chip is the densest text in the game: three to twelve upper-case
   * letterspaced characters in a pixel face, read at a glance and often the
   * only thing distinguishing two options from each other. Below about 11px
   * that face stops resolving on a phone and the failure is specific rather
   * than general — letters become confusable with each other, which turns a
   * misread chip into a misread *option*.
   *
   * 11 is the brief's floor, not a measurement, and it is the number to move if
   * a playtest says the chips are still tight. `test/visual-chips.test.ts`
   * asserts it against the computed style of every chip on every surface, so
   * raising it here is what makes the assertion bite rather than a comment.
   */
  minChipFontSizePx: number;

  /**
   * The smallest contrast ratio, WCAG 2, between a chip's text and the colour
   * actually rendered behind it. **Patch 4.7.2.**
   *
   * 4.5 is the AA threshold for normal-size text, which is what a chip is —
   * the large-text relaxation to 3:1 starts at 18px and no chip is close.
   *
   * Measured off rendered pixels rather than computed properties, because a
   * chip's fill is `color-mix(… transparent)` over whatever the surface behind
   * it happens to be — a panel, the map's gradient, a locale's glow — and no
   * computed value says what that came out as. `scripts/visual/contrast.mjs`
   * already samples that way for the V1 text rule and this reuses it.
   */
  minChipContrastRatio: number;
}

/**
 * The display numbers the game ships with.
 *
 * Editing any of these must leave `npm run content-hash` unchanged. If it does
 * not, this file has fallen off the exclusion list or something under `core/`
 * has started importing it, and `test/content-hash.test.ts` says which.
 */
export const DEFAULT_DISPLAY_TUNING: DisplayTuning = {
  /*
   * 900, up from Release C's unmeasured 500, which put a beat at 125ms — an
   * 8px out-and-back in about seven frames, so the sprite sat at peak
   * displacement for roughly one of them. The swap beat has always read where
   * the lunge did not, and the reason is visible in the numbers: it spends
   * 14px over the whole budget where the lunge spends 8px over a quarter of it.
   * 900 makes a beat 225ms and the whole turn still resolves inside a second.
   * Measured in `docs/visual/reports/patch-battle-animation.md`.
   */
  battleFeedbackMs: 900,

  minChipFontSizePx: 11,
  minChipContrastRatio: 4.5,
};
