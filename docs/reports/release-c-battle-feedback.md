# Release C: battle feedback visuals

What was built, what it found, and the three things the prompt's definition of
done asks this report to name.

Built 2026-09-10 on `claude/release-c-battle-feedback-ji40l7`, from
`origin/main` at `67601e3`. Prompt:
[`../spec/gymrun-release-c-battle-feedback-amended.md`](../spec/gymrun-release-c-battle-feedback-amended.md).
Audit it answers: [`v5-unblock-audit.md`](v5-unblock-audit.md).

---

## 0. The three answers the definition of done asks for

**1. Which file owns the HP bar.** `src/ui/scene.ts`. `createSidePanel`
(`scene.ts:197`) builds `.hp` and `.hp__fill`; `updateSidePanel` sets the width.
It is the V0 bar in the sense that V0 rewrote its *values* — `git log -L` on
`styles.css:183-200` shows `f27bff8` ("V0.3: every screen on the tokens")
substituting tokens into a block that has otherwise stood since `e7ce909`,
Stage 0. **No stage between Stage 0 and V4 changed the bar's structure.** So the
markup Release C restyles is Stage 0's and the values are V0's, which is a
narrower answer than the prompt's framing and is the one the tree supports.

**2. Whether the SMOKE24 overflow belongs to 4.7 or to V0–V4.** **4.7.**
Measured, not argued, and the measurement is worth recording because `git blame`
alone cannot answer it — the overflow is emergent from many contributions and
`blame` on `.step__nodes` and `.node` points at `f27bff8` (V0.3), which is a
token substitution that changed no value.

The instrument was to run the failing check on a tree with 4.7 in and no visual
pass on top. On `7bb6242` (the PR #12 merge) the phone pass reports:

```
FAIL the offered nodes are fully visible without scrolling (cards end at y=869 of 844)
```

Byte for byte what it reports on `67601e3`. **V0 through V4 moved that number by
zero.** `docs/visual/baseline/heights.json` agrees from the other side: the map's
decision point went 654.03 → 728.22 at the 4.7 merge (`fb38b06`) and has not
moved since, across every V stage. The one thing V0–V4 did move on the battle
screen went the *right* way — the move grid, 535 → 531.

So no stop condition fired. The check now carries an explicit expected-failure
marker (`phoneCheckExpectedFail`, `scripts/smoke.mjs`), the same instrument
`test/visual-v0.test.ts:47` uses on its twin, and **`npm run smoke` exits 0**
with the case printed as `xfail` and its reason. A marked check that starts
*passing* is pushed as a problem, so the marker cannot outlive the overflow.

**3. The `contentHash` note for the tuning number.** Section 4 below, and it
turned out to be more than a note — Release C produced two live instances of the
exact failure `docs/generation.md` §9's 4.7 constraint predicts.

---

## 1. What shipped

| Item | Where | Lines |
|---|---|---|
| Protocol-to-flags reader | `src/core/battle/flags.ts` | 372 |
| Flag word vocabulary | `src/data/flagWords.ts` | 109 |
| The strip that renders them | `src/ui/flag-strip.ts` | 97 |
| The one timing number onto the root | `src/ui/theme/motion.ts` | 46 |
| HP chunk, shadow, jiggle | `src/ui/scene.ts`, `src/ui/styles.css` | in place |
| `battleFeedbackMs` | `src/data/tuning.ts` | one field |

Ten flag kinds, a closed set: `stab`, `super`, `resisted`, `immune`, `crit`,
`miss`, `contact`, `priority`, `status`, `berry`.

**One reading of the protocol per batch.** `ui/screens/battle.ts` makes one
`createFlagReader` per battle and gives every consumer the same object: the log
takes it for its ordinals, the scene for its nudge order, the strip for its
words. `test/boundaries.test.ts` asserts that neither `scene.ts` nor
`battle-log.ts` calls a reader, and that `screens/battle.ts` makes exactly one.

**Priority is never recomputed.** The flag comes off the `TurnAction`
`readTurns` already marked, so the bracket rule here *is* the log's rule.

**One addition the prompt did not ask for, made because the definition of done
required it.** The strip marks whose Pokemon each flag is about. A turn where
both sides use a same-type move prints `STAB` twice, and with nothing
distinguishing them the strip says two identical words about two different
Pokemon and answers nothing — which fails "the player can tell why the hit
landed the way it did". The marker is the log's existing vocabulary, not a new
one: `.log-entry__order` already marks the player's side with `--emphasis` and
leaves the opponent's neutral, and `.flags .chip[data-side='p1']` is the same
mark on the same fact. **It is not the weight axis.** Within a side every kind
is identical to every other kind, which is the rule Release C is holding; a
side is a fact about whose Pokemon, not a claim about whether what happened was
good. Asserted both ways in `test/battle-feedback.test.ts`.

---

## 2. Four bugs the tests found, each of which would have shipped

Recorded because each was invisible to the obvious test and each is the kind
that reaches a player.

**STAB would never have fired on an ordinary turn.** The protocol names a
species exactly once, on the `|switch|` that brought it in, and an incremental
update carries no `|switch|` on a turn where nobody switched. The first cut read
each batch from a clean slate, so it knew the species only on switch turns and
would have printed STAB on those and nowhere else — and an intermittent flag is
worse than a missing one, because it teaches the player that STAB is
intermittent. Fixed by `createFlagReader` holding the standing bodies across
calls, which is the same lifetime and the same argument as `battle-log.ts`'s
`HpTracker`. Regression test feeds real batches one at a time and asserts the
batch carries no `|switch|` before asserting the flag.

**Reduced motion did not turn the HP chunk off.** `.hp__shadow[data-fading]` is
more specific than `.hp__shadow`, and a media query adds no specificity, so the
override in the `prefers-reduced-motion` block lost the cascade and the chunk
went on fading for exactly the people who had asked it not to. Caught only
because `test/visual-release-c.test.ts` reads the *computed* `animationName` in
Chromium rather than trusting the rule to have applied. Both overrides now match
the selectors they override.

**The jiggle keyed off a turn number and therefore never fired.** An
incremental update arrives as `|move| … |move| … |upkeep| |turn|N+1`: the
actions that just resolved sit in a group with no number, because the line that
would have numbered it opened the *previous* batch, and the trailing `|turn|`
opens an empty group for a turn nobody has played. Selecting "the last group
with a turn number" selects the empty one, forever. Both the jiggle and the
strip now select the last group with *actions*, and both carry the comment
saying why.

A fourth, in the test rather than the source, is worth a line because it made
two browser assertions pass on stale DOM: screens are hidden with `[hidden]`
rather than unmounted, so a battle that ended one turn in leaves its markup and
its last shadow in the document. `playATurn` now waits on the **log** growing —
an independent witness that knows nothing about Release C — rather than on the
screen merely being `battle`.

Two more were caught by the **full** suite after the targeted runs were all
green, which is the argument for running it rather than trusting a subset. Both
were mine and both are fixed: a nineteenth hardcoded duration, `animation-delay:
0s` written beside an `animation: none` that already resets the delay — caught
by the very duration pin added in the same step; and a path named in this
release's own `generation.md` note, `data/display.ts`, which does not exist,
because the note speculated about where display fields might move. The
absent-path registry in `test/boundaries.test.ts` is size-asserted and may
shrink but never grow, so the fix was to stop naming an invented file rather
than to register one — which is the better note anyway, since where those
fields land is the `contentHash` release's decision.

---

## 3. Report, not a fix: the AI is priority-blind and speed-blind

`core/battle/ai.ts` untouched, as instructed.

**What is there.** `matchupQuality` (`ai.ts:323`) is `turnsToDie - turnsToKill`,
both of them HP divided by damage per turn. There is no term anywhere in
`AI_WEIGHTS` or `scoreChoices` for who acts first *within* a turn, and
`movePriority` is not imported into the file. `spe` appears only as a stat stage
handed to @smogon/calc for a damage number.

**The misplay that follows.** A race the AI scores as won by half a turn is a
race it actually loses whenever the player is faster, and it cannot see the
difference. It will stay in and die before acting, having counted that turn as
one it survived.

**Does the jiggle make that read as a bug? No, and for priority it improves
matters.**

1. The jiggle never shows anything false. The order is the engine's own,
   carried through a reader that annotates and never resolves.
2. It makes the speed-blind misplay legible, which is the point. An opponent
   that visibly acts second and dies reads as a *weak opponent*, not a broken
   game — the board and the log agree, so the player sees a bad choice rather
   than a cheat.
3. For priority it removes a bug-reading rather than adding one. "A slow
   Pokemon moved first" was the original complaint; the strip now names the
   bracket beside the nudge.

**The one thing to watch**, because it is genuinely new: a same-bracket turn is
deliberately unmarked, so when order is decided by something the marking rule
declines to claim — a Speed stage, paralysis — the sequence shows with no
explanation beside it. The log's ordinal has had that property since the round 2
patch; what is new is that it now happens in peripheral vision, where an
unexplained order is likelier to read as a glitch. If a later playtest reports
"the panels move in a weird order", that is the case, and the fix is a flag word
for a Speed-decided turn — not a change to the AI.

---

## 4. `contentHash`, and the finding the prompt asked for

The prompt says: confirm adding a number to `data/tuning.ts` does not move
`contentHash`, note that this is a no-op today, and write the finding down
because the `contentHash` release will have to decide whether presentation
timing belongs in the hashed set.

**Today it is a no-op**, exactly as the audit says: `contentHash` does not
exist. No code computes one, in `src/`, `scripts/` or `test/`. Nothing moved,
because there is nothing to move.

**But Release C produced two live instances of the failure anyway**, through the
one instrument that *does* hash `src/data/` today —
`docs/visual/baseline/data-digest.txt`, a sha256 over every file under
`src/data/`:

| Change | Kind of thing | Digest |
|---|---|---|
| pre-Release C | — | `e175d72e…` |
| `src/data/flagWords.ts` added | a vocabulary of nine words | moved |
| `battleFeedbackMs: 500` added | how long a shadow lingers | moved |
| after both | — | `1bfa3d97e62733a3e9798ef2181690e7ad7b9059c13716c2dd645171d3a82356` |

Each time, **the digest was the only thing in the whole baseline that moved.**
Every recorded run and the recorded battle protocol are byte identical both
times. Two players on one seed holding different copies of either file play the
identical run.

That is not a hypothetical for the `contentHash` release, it is a worked
example, and it lands squarely on the contradiction the audit flagged as its
highest-value finding. `docs/generation.md` §9 says both of these:

> **It is computed over `src/data/**` by glob, not over a list.** Decided
> 2026-09-10, Release 0.5.

> **The hash's input must be an explicit file list, not a directory glob.**
> (from Stage 4.7)

**Under the glob reading, `battleFeedbackMs` moves `contentHash`, and a player
who prefers a 300ms shadow can no longer share a seed.** That is absurd on its
face and it is what the glob decision, read literally, produces. Release C
therefore adds two files to the list of evidence for the file-list reading,
alongside the three 4.7 named (`archetypes.ts`, `moveTags.ts`, `moveCopy.ts`).

**This report does not resolve the contradiction** — resolving it is the
`contentHash` release's, and `CLAUDE.md` requires the superseded half to be
deleted from the lineage with a dated note rather than quietly out-argued. What
it does is state the recommendation with the evidence behind it: **the explicit
file list wins, and `data/tuning.ts` is the awkward case that proves the list
cannot simply be "every file under `src/data/`"** — the same file carries
`stepsPerSegment`, which absolutely must be hashed, and `battleFeedbackMs` and
`maxMoveTagsOnFace`, which absolutely must not. A per-file list is not enough
for `tuning.ts`; it needs a per-field split, or the display numbers need to move
out of it. That is a design question, and it is now a concrete one.

---

## 5. Gates

| Gate | Result |
|---|---|
| Full suite | **69 files, 913 tests** (866 before Release C, plus 47) |
| `tsc --noEmit` | clean |
| `eslint .` | clean |
| `npm run build` | clean |
| Strict trim | clean |
| SMOKE24 browser smoke | **exit 0**, one `xfail` (the map, §0) |
| `core/` no timers, `playRun` headless | green — `test/boundaries.test.ts`, `test/headless.test.ts` |
| `core/` never imports `ui/` | green |
| Seeded output, `test/fixtures/sim-report.json` | **byte identical**, sha256 `49e552ec…` unchanged |
| Seeded output, `docs/visual/baseline/` runs and battle | **byte identical** |
| Guarded heights | re-recorded in the commit that moved them, §6 |

`test/boundaries.test.ts`'s no-timers rule predicted this release by name — its
doc comment already read "the visual identity stages add motion in `ui/` whose
one duration number lives in `data/tuning.ts`; the way that rule dies is a timer
in `core/` waiting on a duration it should not know." That is exactly the shape
Release C took, and the rule is green: `coreFiles` walks all of `src/core/`, so
`flags.ts` is covered by it without an edit.

### The four version axes, none moved

| Axis | Value |
|---|---|
| Run log | `gymrun-run-11/gymrun-0.3.0` |
| Randomizer | `gymrun-randomizer-12` |
| AI | `gymrun-ai-2-switching` |
| `contentHash` | still does not exist |

---

## 6. The baseline, and which commit moved what

The prompt's rule is that `docs/visual/baseline/` is re-recorded in the same
commit as the change that moved it, never separately, so a bisect always lands
on a self-consistent pair. Three commits moved something:

| Commit | What moved | Why |
|---|---|---|
| step 1 | `data-digest.txt` | `src/data/flagWords.ts` is a new file under `src/data/` |
| step 4 | `heights.json` battle entries | the flag strip is 36px of new band |
| step 5 | `data-digest.txt` | `battleFeedbackMs` is a new field under `src/data/` |

`battle.screenHeight` 1145.5 → 1181.5 and `scrollHeight` 1339 → 1375. The whole
36px is the strip's own band (`--space-6`, held whether or not the turn had
anything to say) plus one `.board` gap.

**The decision point did not move.** `decisionTop` 681.5 and `decisionBottom`
946.5 are unchanged, because the strip is placed under `.scene` in the board
grid and the move buttons are inside `.scene`. **V5's fold budget starts from
exactly the numbers it started from before Release C**, and V5's §4 before-table
in the audit is still current for the rows it measures — only the totals move.

Step 1's digest re-record was made by amending that commit rather than
appending a fix to a later one, so the bisect property holds across the whole
branch. That is a history rewrite on an unshared working branch, and it is
recorded here rather than left to be noticed.

---

## 7. Deviations and things left undone

**A protocol step was taken late.** `CLAUDE.md` requires every prompt to be in
`docs/spec/` verbatim *before* work begins on it. Steps 0 through 3 were built
from the paste; the prompt was committed and registered at step 4. Late is the
deviation. Editing the prompt, or the record, to hide it would be a worse one.

**The tuning number is unmeasured, and unlike every other number in
`data/tuning.ts` it cannot be measured by the simulator.** 500ms is the prompt's
default. `npm run sim` has no opinion about how long a shadow should linger, so
this is the one field in that file waiting on a playtest rather than on a sweep.
Its doc comment says so.

**Item 3's list is fully rendered; one flag has no way to fire yet.**
`priority` only ever appears on a bracket-driven turn, which is the log's rule
applied exactly — a same-bracket turn is unmarked by design. On the shipped move
pools this is rare, and §3 above is where that shows up as a risk.

**Not done, and not Release C's:** the map's 25px overflow (§0), R12's `BAND n`
on the shared move card, and the nine findings in the audit's §6. R12 is the
prompt's own named follow-on and is unblocked by this branch.
