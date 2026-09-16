# The battle animation run — Branch 1: make the beats visible

Prompt: [`../../spec/gymrun-overnight-battle-animation.md`](../../spec/gymrun-overnight-battle-animation.md),
Branch 1. Branch `claude/busy-noether-jfszvi`, 2026-09-16.
Deviations: [`../../generation.md`](../../generation.md) section 21.

## 1. What the report said, and what was actually wrong

> also acknowledge that animations currently have been noted to not work
> because the animations occur too quickly. look into that.

Three things were wrong and only the first is what the sentence describes.

**The beat was 125ms, and nobody ever chose that number.** `--motion-beat` is
`calc(var(--motion-duration) / 4)`. Four beats had to fit inside one budget, so
at `battleFeedbackMs: 500` a beat is 125ms by arithmetic. No document in the
repo asks whether a quarter of the budget is long enough to read. The one
qualitative check on record is spatial and not temporal: `tokens.css` justifies
`--lunge-distance: 8px` as "far enough to read as an attack on a 96px body",
which says nothing about 8px *in 125ms*.

**The tree already contained the comparison that proves it.** The swap beat
spends `--sprite-swap-travel: 14px` over the whole budget; the lunge spends 8px
over a quarter of it. 1.75x the distance at 4x the time. That is why swaps have
always read and beats have not, and it is measurable rather than a matter of
taste.

| beat | distance | duration | px per 100ms |
|---|---|---|---|
| swap (`sprite-sink`/`sprite-rise`) | 14px | 500ms | 2.8 |
| lunge (`actor-lunge`) | 8px out and back | 125ms | 12.8 |
| hit (`sprite-hit`) | 4px out and back | 125ms | 6.4 |

An 8px out-and-back in 125ms is about 7.5 frames at 60Hz, so the sprite is at
peak displacement for roughly one of them.

**And the project had already predicted this report.**
`docs/reports/release-c-battle-feedback.md`:

> The tuning number is unmeasured, and unlike every other number in
> `data/tuning.ts` it cannot be measured by the simulator. 500ms is the
> prompt's default. `npm run sim` has no opinion about how long a shadow should
> linger, so this is the one field in that file **waiting on a playtest rather
> than on a sweep.**

This is that playtest. The number was parked for exactly this and the only
problem was that it could not be moved without refusing every shared seed.

## 2. Freeing the number

`src/data/displayTuning.ts` is new and on the `contentHash` exclusion list. It
takes the three fields no `core/` file reads:

| field | from | why it could move |
|---|---|---|
| `battleFeedbackMs` | `tuning.ts` | read by `ui/theme/motion.ts` and the visual tests only |
| `minChipFontSizePx` | `tuning.ts` | read by `test/visual-chips.test.ts` only |
| `minChipContrastRatio` | `tuning.ts` | read by `test/visual-chips.test.ts` only |
| `maxMoveTagsOnFace` | **stays** | `core/battle/view.ts` reads it — see generation.md §21 deviation 2 |

**The hash moved once, from `53145f` to `b381d0`, and the prompt said it would
not.** Section 21 deviation 1 is the account. In short: removing fields from a
hashed file necessarily changes it, the prompt's check could not have passed for
any version of this work, and the two things that actually matter were verified
instead.

### Proof that generation did not move

`test/fixtures/sim-report.json` regenerated with `GYMRUN_WRITE_FIXTURE=1` and
diffed against its previous contents:

```
4c4
<   "contentHash": "53145fb1ee4bee9bf294aa380a32afe736c4d9ed8a382ed9e15453b8704ccd1e",
---
>   "contentHash": "b381d0b728f8a28d4ef2941d1c9f2754634e3bc45ee2d8625f9dfe1465ab55b6",
```

One line, and it is the hash's own field. Every run record, every logged
decision, every casualty across every fixture seed is byte identical. That is
the claim worth making and it is proved rather than argued.

Fixture sha256: `72bd4b9d3571b66f0d7d206dc1229e108ba864f6ec7110d51d2aac4933d6487d`.

### Proof that the number is free from here

`npm run content-hash` with `battleFeedbackMs` at three values:

| value | hash |
|---|---|
| 900 (first build) | `b381d0` |
| 1234 | `b381d0` |
| 500 (reverted to) | `b381d0` |
| **750 (shipped)** | `b381d0` |

The exclusion works, and this run exercised it for real rather than as a
demonstration: the number was moved to 900, back to 500 on a ruling, and then to
750, and the hash did not flinch. **That is the last time a display edit refuses
a seed.**

## 3. The retune

`battleFeedbackMs: 500` -> **750**. Derived, so one number still sets the whole
feel of a turn:

| token | before | after |
|---|---|---|
| `--motion-duration` | 500ms | **750ms** |
| `--motion-beat` (`D/4`) | 125ms | **187.5ms** |
| `--motion-hp-shadow` (`D`) | 500ms | **750ms** |
| `--motion-swap` (`D`) | 500ms | **750ms** |
| `--lunge-distance` | 8px | **6px** |
| `--hit-recoil` | 4px | **`calc(--lunge-distance / 2)`** = 3px |

Slots, unchanged in shape: 0 / 187.5 / 375 / 562.5ms, the last ending at 750
where the shadow's fade ends. The four-slot partition is **kept**.

### The number shipped is 750, and the lunge came down with it

**Recorded after the fact, because 900 was built first and reverted.** The
ruling was: take the split now, but do not take an unwatched number with it —
and then, having seen the frame table, shrink the lunge rather than only
lengthen the beat.

That instinct is right, and the reason is a quantity nobody had costed.
`actor-lunge` peaks at **40% of a beat**, and a beat is a quarter of the budget,
so the whole lunge distance is spent in 10% of the budget:

| budget / lunge | peak px | out-phase | frames @60Hz | px per frame |
|---|---|---|---|---|
| 500 / 8px (was) | 8.94 | 50ms | **3.0** | **2.98** |
| 750 / 8px | 8.94 | 75ms | 4.5 | 1.99 |
| **750 / 6px (shipped)** | 6.71 | 75ms | 4.5 | **1.49** |
| 900 / 8px (built, reverted) | 8.94 | 90ms | 5.4 | 1.66 |

**A three-frame lunge is a jump cut, not a fast lunge**, which is why it read as
broken rather than as quick — and why raising the budget alone would not have
fixed it: 8px at 750 is still ~2px a frame, a slow stutter instead of a fast
one. The two had to move together.

6px is not a free choice either. `--idle-rise`'s comment already puts the jitter
threshold at two pixels on a small body, so 1.49px a frame sits under a line
this codebase had already drawn for itself.

`--hit-recoil` became `calc(var(--lunge-distance) / 2)` rather than `3px`. Its
comment has always claimed "half the lunge, so the answer reads as smaller than
the question"; until now that was a coincidence of two literals that the next
person to tune the lunge would have silently broken. Verified in a browser: the
token resolves to exactly `3px`.

**750 also divides better than 900.** Every derived length lands on an exact
binary fraction — beat `0.1875s`, delays `0.375s` and `0.5625s` — so the
browser's serialization and the tests' `ms / 4000` arithmetic cannot disagree.
Section 3 flagged that as a risk to spot-check at 900 (`0.225s`); at 750 it
cannot arise. `Swift` is 2/3 of 750, which is exactly 500 — today's motion, one
tap away.

The duration tests needed **no edit at all** to follow 500 → 900 → 750. That is
the evidence the derivation is real rather than a comment.

### The two decisions the prompt asked for, and their answers

**1. Does a beat stay `D/4`? Yes.** The partition is the reason a turn finishes
exactly as the shadow does, and decoupling `--motion-beat` from
`--motion-duration` would have superseded a recorded rationale in `tokens.css`
and in the bar-and-beats prompt. 225ms is a readable beat without needing the
decoupling, so the cheaper answer was available and was taken. Recorded here so
the next session does not re-open it: **the budget is still one number.**

**2. Do `--lunge-distance` and `--hit-recoil` grow? No.** Duration was the
primary lever and it was sufficient. The tokens' own comments constrain the
distance — a lunge must "never leave the corner it stands in or reach the panel
floating beside it" — so distance had less headroom than duration anyway. At
225ms the 8px lunge is 3.6px per 100ms, close to the swap's 2.8 and well below
the 12.8 that was the actual defect. The recoil stays identical for every hit;
a recoil that grew with the multiplier would be a verdict on the board.

### One thing to watch in the hand pass

`--motion-swap` is the whole budget by design — "the same kind of event" as the
shadow — so a species swap is now 900ms rather than 500. That is the honest
consequence of keeping one number, and it is flagged rather than pre-emptively
special-cased: a swap that reads as sluggish is a reason to revisit the
derivation, not a reason to add a second constant before anyone has watched one.

## 4. The setting

"Too fast" is a judgement, not a measurement, so the second half of the answer
is a control rather than a second guess at one number.

`ui/settings.ts` gains `battleSpeed`, a third presentation axis beside `density`
and `moveBar`, on the same reasoning the move bar was a second one: density is
how much space every fact costs, the move bar is the shape of one bar, and this
is how long one screen's beats last. A player who wants a slower turn should not
have to accept a padding scale with it.

| value | scale | resulting budget | beat |
|---|---|---|---|
| `swift` | 2/3 | 600ms | 150ms |
| `even` (default) | 1 | **900ms** | **225ms** |
| `patient` | 3/2 | 1350ms | 337.5ms |

**Multipliers, not durations.** `data/displayTuning.ts` stays the one place the
number lives; a settings value in milliseconds would be a second constant and
the next one would be a third. `even` is exactly `1` rather than approximately
1, so the default reproduces the shipped value bit for bit and the visual tests
that assert `--motion-duration` equals `battleFeedbackMs` are not asserting a
rounding.

The picker is the drawer's third, through the `createPicker` helper that was
extracted when the second arrived — so the pressed state, the repaint
subscription and the aria wiring are shared rather than copied for a third time.
`applyMotion` is re-applied on every settings change, so a turn already on
screen picks up the new pace at its next beat.

**Reduced motion is not a fourth value and must never become one.** The OS
setting is answered in the stylesheet by `prefers-reduced-motion`, which
re-answers itself when the setting changes mid-session; a value written into the
store at startup would not.

## 5. Gates

`tsc --noEmit` clean. `eslint` clean. `npm run content-hash` `b381d0`.

**The hash is pinned in three places and all three caught the move**, which is
the instrumentation working rather than three chores:

| pin | file | note |
|---|---|---|
| the literal | `test/ai-priority.test.ts` | "a hash nobody can read off the tree by eye is exactly the kind that moves without anyone noticing" |
| the sim fixture | `test/fixtures/sim-report.json` | regenerated; one line differs |
| the visual baseline | `docs/visual/baseline/data-digest.txt` | the digest **is** `contentHash` since overnight Branch 3, precisely so a presentation stage moves it exactly when it moves the axis |
| the run records | `docs/visual/baseline/runs/*.json` | six recorded runs, each carrying a `versions` block twice |

The last of those is the strongest evidence in this report and was not
anticipated. `test/visual-baseline.test.ts` replays six seeds and compares the
whole recording byte for byte. It failed, naming all six files — and **every
differing line in all six is a `contentHash` field**:

```
$ diff -r docs/visual/baseline /tmp/freshbase | grep -E '^<|^>' | grep -vc contentHash
0
```

Zero non-hash lines across six runs. Every party, every node, every logged
decision, every casualty, every battle protocol identical. Re-recorded on that
basis.

Browser suite: **21 files, 176 tests, all passing** after the re-record —
including `visual-tokens` (the hardcoded-duration pin still reads 17, so no beat
length was written as a literal), `visual-release-c` and `visual-v5`, whose
duration assertions derive from the constant and therefore followed it from 500
to 900 without an edit. That they needed no edit is the evidence the derivation
is real.

Non-browser suite: **103 files, 1480 tests, all passing** (5 skipped).

`npm run build` green. `npm run smoke` at 390x844 on SMOKE24: **passed**, with
the battle screen's move grid ending at y=697 and both stat panels at y=460 —
unchanged, as a patch that writes one custom property should leave them.

One label list needed updating: `test/party-drawer.test.ts` names every control
allowed on the read-only drawer, and `Swift`, `Even` and `Patient` joined it.
The half of that test which matters — pressing every control and comparing party
state before and after — is unchanged and still passes, which is what says the
picker writes a display setting and not run state.

### A measurement artifact worth recording

A first full-suite run reported four failures. Three of them —
`test/tutorial-browser.test.ts`, `test/map-fold.test.ts` and
`test/gym-pays-twice.test.ts` — each ran for **670 to 690 seconds** and were
timeouts, not assertions: an orphaned `vitest` process from an earlier stopped
run was still resident and the two together held about 70% of RAM. Killed and
re-run in isolation, all three pass in seconds. Recorded because a suite result
read without looking at the durations would have sent the next session hunting a
defect that is not there — the same class of mistake open item 8 documents,
where a stale red gate was believed and a patch was planned around it.

## 6. What Branch 1 did not do

No new animation. No `core/` change. No balance number. The outro, the gate on
the result screen and the abnormality vocabulary are Branches 2 and 3.

---

# Branch 3A: the gate, and the outro

Deviations: [`../../generation.md`](../../generation.md) section 22.

## 7. The one line that fixes the reported bug

```ts
reviewBattle: async (review, state) => {
  await battleScreen.outro(outroFor(review));   // this
  lastReview = review;
  resultScreen.render(review, review.offer, state, (index) => rewardPick.submit(index));
  showScreen('result');
  return rewardPick.wait();
},
```

`reviewBattle` is the only path every battle completion takes — `core/run.ts`
says so itself, "It is one path, not a second one" — so one `await` covers gym,
trainer, wild, victory and defeat with **no `core/` change, no new projection
field and no version axis moved.** `won` and the node's capture offer are
already on the review, so `outroFor` is pure and reads nothing new.

This supersedes `ui/theme/motion.ts`'s "nothing waits for this", at this seam
and nowhere else. Section 22 is the record; the file's own header was corrected
in the same commit rather than left asserting a rule the tree no longer keeps.

## 8. The proof, in a browser

jsdom resolves no custom properties, so no hold ever runs there and **the one
claim the patch exists for cannot be asserted in jsdom at all.**
`test/visual-battle-outro.test.ts` plays a real fight on SMOKE24 to its end and
reads the frame that did not previously exist:

```
OUTRO PROBE {"screen":"battle","scrollWidth":390,
             "kinds":["caught","recall"],
             "anim":["sprite-recall","sprite-recall"]}
AFTER HOLD  result
```

Read across: the **stage is still up** while the outro plays, where before the
screen was already `result`; both bodies are actually animating rather than
merely marked; the wild foe is taken by the ball and the player's own lead is
recalled, the two sides getting different treatments; nothing overflows a 390px
phone; and the hold ends.

| | before | after |
|---|---|---|
| screen at the KO frame | `result` | **`battle`** |
| frames of the last turn's beats painted | 0 | the whole budget |

## 9. Three things the build got wrong first

Recorded because each was caught by an instrument rather than by care, and the
next animation patch will meet all three again.

**1. A recalled body must not travel.** The first cut moved the sprite toward
its trainer by `--recall-travel`, using the `--beat-direction` the lunge already
carries per side. It read correctly and it was a horizontal-overflow bug: the
foe sits at `right: 0` of the stage, `.stage` has no `overflow: hidden`, and a
transform contributes to scrollable overflow — so a 96px body moving 22px past
the edge of a 390px screen widens the document. `scripts/smoke.mjs` asserts
against exactly that and **could not have caught it**, because the outro never
runs in a smoke walk. Clipping the stage was the other option and is worse: the
two panels are children of `.stage` and overhang it deliberately. The direction
is now carried by `transform-origin`, which moves nothing and so overflows
nothing, and the browser test asserts `scrollWidth` at the outro frame.

**2. A browser helper's witness stopped being sufficient.** `playATurn` finds a
turn *the fight survived*, so later assertions read a live battle. Its witness
was "still on the battle screen, and the log grew" — and the gate makes both
true of a **finished** fight for the whole hold, which is the entire point. Both
copies began asserting against a fight that was over. The third condition is
that the run has asked for another choice: an enabled move button, which a
finished fight has none of whether or not the result screen has arrived.
Generalised in section 22: *a test that waits a fixed fraction of the feedback
budget and then reads the screen is making an assumption about what the budget
is for.*

**3. The Poké Ball is spritenum 345.** A guess would have said 4. It is read off
`@pkmn/sim`'s `Dex.items.get('pokeball').spritenum`, because a wrong spritenum
draws a different item and nothing fails — no exception, no test, just the wrong
picture. The asset rule in `theme/scenes/index.ts` is not bent: the ball is a
cell of the Showdown item sheet the party screen already draws every held item
from, so nothing raster is added.

A fourth was a flaw in a *test* rather than in the code, and is recorded because
it produced a false green for one run: `settled()` in `test/battle-outro.test.ts`
raced a promise against `Promise.resolve()`, and a `.then` continuation runs one
microtask later than the marker it races — so an already-resolved promise lost
its own race and the helper returned `false` for everything. It flushes a fixed
number of microtask turns and reads a flag now.

## 10. Gates at 3A

`tsc --noEmit` clean, `eslint` clean, `npm run build` green, `npm run smoke`
passed. `contentHash` unmoved at `b381d0` — Branch 3A touches no `data/` file
and no `core/` file at all.

New: `test/battle-outro.test.ts`, 13 jsdom cases (which body leaves and how,
including the negative that a body which already fainted is not recalled and
that a defeat marks neither side; the hold resolving at once when the token is
zero, which is also the reduced-motion path; cancel resolving rather than
rejecting; a tap clearing it), and `test/visual-battle-outro.test.ts`, the
browser proof above.
