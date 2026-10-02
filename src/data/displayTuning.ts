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
   * How long the end-of-fight hold lasts under `prefers-reduced-motion`, in
   * milliseconds. **The iOS animations patch.**
   *
   * ## Why it is not zero
   *
   * Until this patch it was. The stylesheet set `--motion-outro: 0ms` under
   * the reduced-motion query and `scene.ts` read that token to decide how long
   * to park, so a player with Reduce Motion on got **no hold at all** — which
   * is the pre-fix behaviour exactly, and the pre-fix behaviour is a bug: the
   * result screen swaps in on the frame the KO lands and the last turn of
   * every fight is never painted.
   *
   * The standing rule is "remove the movement, not the outcome", and it was
   * being read one word too literally. Here the pacing **is** the outcome.
   * A player who asked for less motion asked not to be moved at; they did not
   * ask to be told less about what happened in the fight they just played.
   * Every other reduced-motion rule in `styles.css` obeys this already — each
   * animation is cancelled at its own *end* state, so the chunk is still gone,
   * the fainted body is still down, the arriving Pokemon is still on the
   * stage. The hold was the one place that dropped the outcome with the
   * movement.
   *
   * ## On the value
   *
   * It has one job: guarantee the final turn is **painted** before the screen
   * changes. That is a frame count, not a feel — one frame at 60Hz is 16.7ms
   * and a phone under load can miss several in a row, so this is set an order
   * of magnitude above the single frame it must not miss and still well under
   * the threshold where a player waiting on an accessibility setting would
   * call it a pause.
   *
   * It is deliberately **not** derived from `battleFeedbackMs`. Every other
   * length on the battle screen is, because they are all the same
   * question — how long should a turn's feedback take to read — and this is a
   * different one: how long does a repaint need. Scaling it with a budget the
   * player set for animation they have switched off would be deriving an
   * answer from an unrelated question.
   *
   * Swept by watching, like the budget above, and free to move for the same
   * reason: this file is off the `contentHash` glob.
   */
  reducedMotionOutroMs: number;

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

  /**
   * How long a press has to be held before inspect opens. **Milestone M1.2.**
   *
   * Design bible R5 makes one long press the only way to open an explanation,
   * and the number that separates a press from a tap is the whole of whether
   * that rule is usable. Too short and a player selecting a move gets a panel
   * they did not ask for; too long and the gesture feels broken and is never
   * found.
   *
   * **450ms**, which is the platform convention rather than a finding: iOS and
   * Android both fire their own long-press at roughly half a second, and a
   * gesture that disagreed with the one a player already has in their hands
   * would be the wrong kind of novel. It is parked here, off the
   * `contentHash` glob, so the first playtest that says "I keep opening it by
   * accident" can move it without refusing a single shared seed.
   *
   * R5's disconfirmer is the one to watch: *any* accidental submission during
   * inspect in playtest sends the gesture to two-finger tap, and no amount of
   * raising this number is the fix for that.
   */
  inspectHoldMs: number;

  /**
   * How far the log handle has to be pulled before the sheet opens.
   * **Milestone M4.3, row D26.**
   *
   * M4.3 asks for the sheet to be *"reachable by pull"*, and the number that
   * separates a pull from a tap is the whole of whether both gestures can live
   * on one control. Too small and a player who meant to tap gets a drag that
   * fires twice; too large and the pull is a gesture nobody completes.
   *
   * **24px**, which is the platform convention rather than a finding: a sheet
   * that follows the finger commits at roughly a finger's width on both
   * phones, and it sits well above the ~10px slop a browser already allows a
   * tap before it stops being a click. Parked here, off the `contentHash`
   * glob, so the first playtest that says "it opens when I try to read the
   * strip" can move it without refusing a shared seed.
   */
  logPullPx: number;
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
   * **750, and the distance moved with it.** The battle animation run.
   *
   * Release C shipped 500 as the prompt's default, never measured, with its own
   * comment admitting it was "waiting on a playtest rather than on a sweep".
   * The playtest arrived and said the beats were too fast to see. This is the
   * answer to it.
   *
   * **The number nobody had costed is the lunge's outward phase.**
   * `actor-lunge` peaks at 40% of a beat, and a beat is a quarter of this — so
   * at 500 the sprite travelled its whole 8px in 50ms, three frames at 60Hz,
   * about 3px per frame. That is not a fast lunge, it is a jump cut, which is
   * why it read as broken rather than as quick.
   *
   * | budget / lunge | out-phase | frames | px per frame |
   * |---|---|---|---|
   * | 500 / 8px (was) | 50ms | 3.0 | 2.98 |
   * | 750 / 8px | 75ms | 4.5 | 1.99 |
   * | **750 / 6px (shipped)** | 75ms | 4.5 | **1.49** |
   *
   * **Duration alone would not have fixed it**: 8px at 750 is still ~2px a
   * frame, a slow stutter rather than a fast one. The distance had to come
   * down with the budget going up, and `--lunge-distance` did — to 6px, with
   * `--hit-recoil` derived from it rather than re-typed. 1.49px per frame sits
   * under a line this codebase has already drawn: `--idle-rise`'s comment says
   * two pixels on a small body "read as jitter".
   *
   * **Why 750 and not 900.** 900 was built, measured and reverted — it is the
   * number the px-per-frame ratio alone points at, and it was rejected as too
   * much to take on a frame count with nobody having watched a fight. 750 also
   * divides better: every derived length lands on an exact binary fraction —
   * beat `0.1875s`, delays `0.375s` and `0.5625s` — so the browser's
   * serialization and the tests' `ms / 4000` arithmetic cannot disagree. At 900
   * that was a flagged risk.
   *
   * `Swift` in the drawer is 2/3 of this, which is 500 — today's motion, still
   * one tap away for anyone who wants it back.
   *
   * Still not a balance finding, and still not something `npm run sim` can
   * measure. It is swept by watching. What changed is that it is now free to
   * move: this file is off the `contentHash` glob, so the next revision costs
   * nobody a shared seed.
   */
  battleFeedbackMs: 750,

  /*
   * **120ms: about seven frames at 60Hz.** The iOS animations patch.
   *
   * Not a feel number and not derived from the budget above — see the field's
   * own comment. It buys one guaranteed paint of the final turn with enough
   * margin that a phone dropping frames still gets one, and it is short enough
   * that a fight does not acquire a pause for the player who asked for less
   * motion. The number to move if a Reduce Motion playtest says the end of a
   * fight either flickers past or drags.
   */
  reducedMotionOutroMs: 120,

  minChipFontSizePx: 11,
  minChipContrastRatio: 4.5,
  inspectHoldMs: 450,

  /*
   * **24px.** M4.3, and the same reasoning as `inspectHoldMs` above: a gesture
   * number that disagrees with the one a player already has in their hands is
   * the wrong kind of novel. The tap is unaffected — a pointer that never
   * travels this far is a click, and the click handler is the route that was
   * always there.
   */
  logPullPx: 24,
};
