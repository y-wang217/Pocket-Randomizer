# GYMRUN Overnight Run: battle animations you can actually see

Filed 2026-09-16, before any work, on branch `claude/busy-noether-jfszvi`.
Protocol: [`README.md`](README.md).

A playtest report, so the brief is filed as it was written rather than as a
tidied brief. It arrived in two messages; the second widened the scope from one
patch to an overnight run. Both are verbatim below, followed by the three
planning answers and the branch order agreed before any code.

## The brief, verbatim

### Message 1

> acknowledging that we flagged this initially, i'd like a plan on how to
> resolve how if we finish a fight 1-hit-ko, we don't get any animations. is
> there a way to ensure the animations play BEFORE we swap screens. There's
> should be a pokemon swap quick animation for swaps, moves that swap, moves
> that force opponnent to swap, etc. and the final screen should show the
> pokemon going back to its trainer or a pokeball catching the fainted wild
> pokemon. this is more animation work. what's the least effort lift to
> accomplish this. plan first

### Message 2

> also acknowledge that animations currently have been noted to not work
> because the animations occur too quickly. look into that.
> i also like when changes like status and type and whatever wacky things
> happen are highlighted. make a language system to show battle abnormalities.
> animations to show these more impactful to the player to be included in this
> overnight run

## The three planning answers

Asked before the plan was finalised, answered by the author:

1. **Where the outro plays.** *Hold the battle stage* — the battle screen stays
   up after the KO, the beats finish, the outro plays on the stage the fight
   happened on, and only then does the result screen arrive. Chosen over
   playing it as a result-screen intro, and over doing both.
2. **Which bodies get an outro, and on which outcomes.** *All of the above:*
   win against a trainer, win against a wild, the player's own side on a win,
   and a loss. All four get an animation.
3. **Patch size.** *Gate plus outro*, not the gate alone. Distinguishing a
   chosen switch from a forced drag from a pivot was offered as a third option
   and declined; it stays out of scope.

## What the plan found before it was written

Three complaints, and they are three different bugs. Recorded here because the
brief names one of them and the other two were found while tracing it.

1. **The last turn of every fight has no animation.** Not only a one-hit KO —
   a 1HKO is the case where the last turn is the only turn.
   `driver.ts` drains the final protocol batch and calls `notify` synchronously;
   `screens/battle.ts` renders, starting three CSS animations; the battle loop
   exits; `run.ts` awaits `policy.reviewBattle`; and `ui/app.ts` calls
   `showScreen('result')` on the same microtask. No yield, no paint.
2. **The beats are too fast to see even when they do play.** `--motion-beat` is
   `--motion-duration / 4` = 125ms. That figure was derived, never chosen: four
   beats had to fit inside one budget. The swap gets 14px over 500ms; the lunge
   gets 8px over 125ms.
3. **There is no vocabulary for battle abnormalities.** `FlagKind` reads ten
   truths. The sim emits stat stages, weather, field effects, ability triggers,
   non-berry items, volatiles, `|cant|`, type changes, recoil, drain, multi-hit,
   protect and fail, and none of them reaches the strip.

One thing the brief asks for **already exists and is not being rebuilt**: the
species swap animation. `scene.ts` fires `sprite-sink` on the outgoing body and
`sprite-rise` on the incoming one whenever `data-species` changes on a side.
Because it diffs the species rather than reading a protocol event, a chosen
switch, a forced replacement after a faint, a Whirlwind drag and a U-turn pivot
all get the beat already. It was being swallowed by defect 1 and cut short by
defect 2.

## Two invariant tensions, settled here rather than mid-build

### (a) "Nothing waits for this"

`ui/theme/motion.ts` states it as a rule: *"Nothing waits for this… The number
says how long the feedback stays, not how long the player is held."*

That rule holds for a turn mid-fight, where the next decision is the thing worth
reaching. It fails at the end of a fight, where there is no next decision and
the screen leaves before the feedback does. **Branch 3 breaks it at exactly one
seam — `reviewBattle` — and nowhere else.** Every mid-fight beat stays
non-blocking, and every transition stays skippable by tapping. The rule is
recorded as superseded with a dated note in `docs/generation.md`, and the header
of `motion.ts` is corrected in the same commit.

### (b) Emphasis is banned, and the brief asks for emphasis

The ban is absolute and stated in three places: `core/battle/flags.ts` (*"There
is no severity field, no rank, no ordering by importance, and there never will
be"*), `ui/chip.ts` (*"Every flag is the same chip"*), and `data/flagWords.ts`
(*"Weight is not carried here, and must not be added"*).

The brief asks that abnormalities be *more impactful*. That reads as a direct
conflict and is not one, on this rule:

> **Every abnormality gets its own identity and the same weight.** A status
> infliction, a stat drop and a weather change each get a distinct motion and a
> distinct glyph — they are different events and must be told apart. None is
> larger, longer, brighter or more accent-coloured than another. The categorical
> distinction added here is *something abnormal happened* versus *an ordinary
> hit landed*, which is a fact about the turn, not a ranking of it.

This is the argument `tokens.css` already makes for the hit recoil: *"The same
for every hit… a recoil that grew with the multiplier would be a verdict on the
board."* Distinct is not ranked. No `weight` column, no severity field, no
per-kind size or hue is added anywhere.

A third rule constrains the shape, from the V5 ruling: **do not build a second
strip, and do not add a second reading of the protocol.** Everything new goes
through the existing single read in the battle screen and the existing strip.

## Branch order and handoff protocol

Three branches, run in sequence, each merged on green before the next starts,
in the format of
[`gymrun-overnight-contenthash-ai-tutorial.md`](gymrun-overnight-contenthash-ai-tutorial.md)
section 0.

**Handoff file** per branch at `docs/handoff/battle-anim-<n>-<name>.md`, with
the six mandated sections: `## Merged at`, `## Version axes` (saying "none"
explicitly), `## Baseline for the next branch` (test count, `sim-report.json`
sha256, SMOKE24 status, and the benchmark line — mean gyms cleared with its seed
prefix and seed count, read down a prefix and never across), `## Decisions
taken`, `## For the next branch`, `## Morning decisions`.

**Step 0 of every branch** is: read the previous handoff, confirm the baseline,
and report before writing code. If the baseline does not match, stop and report
rather than building on a moved floor.

**Skip rule.** Branch 3's abnormality beats depend on Branch 2's flags. If
Branch 2's handoff is absent, Branch 3 still runs — the outro half depends on
nothing — and reports the abnormality half as a clean skip.

**Standing rules, unchanged.** `core/` never imports from `ui/`. `core/`
contains no DOM, no timers and no side effects; `playRun` completes headless.
No `Math.random`. Every balance or copy number a tuning pass would touch lives
in `data/`. Attributes, never verdicts. UI comes last in every branch. Commit at
each checkpoint and stop for review. Determinism, stream isolation, version
guards, type check, lint, build, strict trim, smoke and the full suite gate
absolutely. Balance does not gate: record the number and keep going.

**No version axis moves in any of the three branches.** `contentHash`,
`RUN_LOG_VERSION`, `RANDOMIZER_VERSION` and `AI_VERSION` all stand still, and
each handoff says so explicitly.

---

## BRANCH 1: make the beats visible

The smallest branch and the one that pays immediately. No new animation; the
existing ones become watchable.

### Step 1. Move the display fields out of `Tuning`

`battleFeedbackMs` lives in `src/data/tuning.ts` and `tuning.ts` is hashed
whole, so retuning the feel of a battle today refuses every shared seed. That is
unacceptable for a number this branch exists to change, and it is already a
filed item — `docs/generation.md`:

> Release C recommended moving `battleFeedbackMs` and `maxMoveTagsOnFace` into a
> display-only module; that is not done here… The cost is a false rejection when
> a display number moves. **Open, small.**

Also `docs/handoff/overnight-1-contenthash.md`, morning decision 3.

- New `src/data/displayTuning.ts` holding `battleFeedbackMs` and
  `maxMoveTagsOnFace`, modelled on `src/data/densityTuning.ts`.
- Add it to `EXCLUDED` in `build-config/content-hash.ts` with a reason per the
  file's own convention. A file may be excluded only if nothing under `core/`
  imports it at any depth; confirm that before claiming the exclusion.
- **The recorded caveat is real and must be handled, not skipped:** moving a
  field out of `Tuning` changes what the simulator can sweep and what every
  report's `tuning` block records. Grep every reader and fix it. This is the
  seam-gap class open item 15 logs as the standing risk.
- **Verify `npm run content-hash` prints the same value before and after.** If
  it moves, the split is wrong. Record it in the handoff either way.

### Step 2. Retune the beat

With the number free, fix the speed. The default rises from 500ms; the exact
figure is the branch's decision, judged by watching, and is recorded in the
handoff. A starting point of 900–1000ms (a ~225–250ms beat) is suggested and not
binding. Two things to settle and write down:

- **Whether a beat stays `D/4`.** This is the real constraint, not the value
  500: "the budget stays one number" forces beat length and shadow lifetime to
  move in lockstep, so at D=500 a 125ms beat is unavoidable. Keep the partition
  if a readable beat does not make a turn feel sluggish. If it does, decoupling
  `--motion-beat` from `--motion-duration` breaks a recorded rationale and must
  be filed as a superseded decision under the same protocol section 17 used for
  the panel nudge. Decide it in step 0; do not drift into it.
- **Whether `--lunge-distance` and `--hit-recoil` grow too.** A longer beat over
  the same 8px reads as slower, not bigger. Distance has less headroom than
  duration — the token's own comment constrains it — so duration is the primary
  lever and distance the trim. The recoil stays identical for every hit.

### Step 3. A battle-speed setting

`ui/settings.ts` already carries `density` and `moveBar`. Add `battleSpeed`,
written onto `--motion-duration` through the existing `applyMotion`, which
already takes the number as an argument *"so a test — or a future settings
screen — can set it without reaching into `data/`."* That future settings screen
is this step.

Reduced motion still wins and is still handled in the stylesheet, so the media
query re-answers itself when the OS setting changes.

### Branch 1 gates

No test hard-codes 500 and nothing clamps the number upward.
`test/visual-tokens.test.ts` pins a count of hardcoded CSS duration literals plus
regex shape checks, so a different value passes; hardcoding a beat length instead
of keeping the `calc` is what would break it. `test/visual-release-c.test.ts` and
`test/visual-v5.test.ts` derive everything from the constant.
`test/battle-feedback.test.ts` is timing-blind. Spot-check that Chromium
serializes the chosen `ms / 4000` the way the test computes it.

---

## BRANCH 2: the abnormality language

`core/` and copy. No UI. If the vocabulary cannot be shown to work headless,
animating it will not fix it.

### The shape is already right and purely additive

`Flag` is `{ kind, side, subject, detail }`. Adding kinds means a new regex, a
new union member, a new word and a new blurb. No shape change, and no
`RUN_LOG_VERSION` bump: flags are derived from the protocol every render and
never serialized.

### The vocabulary to add

Grouped by class, because Branch 3 animates by class:

| class | protocol | examples |
|---|---|---|
| **prevented** (build first) | `\|cant\|`, `\|-fail\|`, `\|-block\|`, `\|-activate\|` | Flinched, Fully paralysed, Frozen solid, Protected |
| **state change** | `\|-boost\|`, `\|-unboost\|`, `\|-setboost\|`, `\|-clearboost\|` | Attack rose, Speed fell sharply |
| **volatile** | `\|-start\|`, `\|-end\|` | Confused, Substitute, Leech Seed, Taunt, Encore |
| **field** | `\|-weather\|`, `\|-fieldstart\|`, `\|-fieldend\|`, `\|-sidestart\|` | Rain, Sandstorm, Trick Room, Reflect |
| **trait fired** | `\|-ability\|`, `\|-item\|`, `\|-enditem\|` | Intimidate, Rough Skin, Focus Sash, Life Orb |
| **identity** | `\|-start\|typechange`, `\|-formechange\|` | Became Water |
| **damage shape** | `\|-recoil\|`, `\|-drain\|`, `\|-hitcount\|`, `\|-heal\|` | Recoil, Drained, Hit 3 times |

`berry` already exists and stays as it is — it names itself, and a general
`item` kind must not swallow it.

**This is the candidate set, not the commitment.** Step 1 of the branch reports
which of these the sim actually emits in this format, at these levels, with an
observed frequency from a sim run, and cuts anything that never fires. The rule
that blacklist and override entries are populated only from simulator evidence
applies to a vocabulary too: a word for an event no fight produces is dead copy.

### Where the words live

- **Truths** in `core/battle/flags.ts`. Reads the protocol, imports no copy.
- **Words in `src/ui/copy/`, not in `data/flagWords.ts`.**

The obvious move is wrong. `flagWords.ts` sits under `data/` and is kept
hash-neutral by an `EXCLUDED` entry, but the hash is a glob over `src/data/**`
minus `EXCLUDED`, so **any new word table under `data/` is hashed by default**
and moves every seed until someone remembers to exclude it. `src/ui/copy/`
is outside `contentHash` by construction rather than by maintenance, and
`ui/copy/events.ts` already says so, calling `flagWords.ts`'s placement "a wart".
Do not widen the wart. Existing entries in `flagWords.ts` stay where they are
rather than being churned.

### What already exists, and what is actually missing

Stat stages, status and volatiles are **already projected** into `BattleUiView`
and rendered as panel chips. The panel already says what is true now, in the
present tense.

What is missing is the **moment of change** — the past tense. `flagWords.ts`
already draws exactly this distinction (*"`Contact` is a thing the move is,
`Missed` is a thing that happened"*). **This branch adds events, not
projections.** Nothing in `view.ts` needs to change.

The single biggest gap, and the one to build first, is **`|cant|`** — flinch,
full paralysis, frozen solid, asleep. These are the turns where nothing happens,
which is precisely the abnormality a player most wants named, and today they are
silent on the strip. `flinch` is in the volatile allowlist, so the panel says
you are flinched and nothing says you lost the turn to it.

`ui/battle-log.ts` is not a competing language system: it delegates wholesale to
`@pkmn/view`'s `LogFormatter`, hand-writes nothing, and deliberately suppresses
some formatter vocabulary. There is no local table there to reuse.

### Part 4 governs every new word

Each is a restatement of a protocol line. `Attack fell` is correct; `crippled`
is not. `Protected` is correct; `wasted turn` is not. No word says whether what
happened was good, and no `weight` column is added.

### Branch 2 gates

`test/flags.test.ts`: one case per new kind read off real protocol lines, plus
the negatives — a kind that must not fire on an adjacent line. Ordering within a
turn stays the protocol's own order. Also green: `test/content-hash.test.ts`
(hash unchanged, and `core/` imports no copy), `test/tooltips.test.ts` (every
new kind needs a blurb in both directions), `test/boundaries.test.ts`.

---

## BRANCH 3: the animations

UI only, and last. Two halves; the outro half depends on nothing.

### Half A — the gate and the outro

`src/ui/scene.ts` gains `outro(kind): Promise<void>` on the `Scene` interface,
built on `createPending<void>()` from `src/ui/pending.ts` — the existing
primitive for "the UI parks and an event resolves it". Three things resolve it:

1. **The hold elapsing.** Read the length off the computed custom property, not
   from a TS constant. That is what makes reduced motion work with no
   `matchMedia` branch: the media query sets the token to `0ms`, the hold is
   zero, and the query re-answers itself when the OS setting changes.
2. **A tap.** The `pointerdown` capture listener already settles both actors;
   it resolves the pending too. A gate that cannot be skipped is a stall.
3. **`cancel()` on teardown**, so an abandoned run does not leak a parked
   promise.

`src/ui/screens/battle.ts` exposes it on `BattleScreen`. Then in `app.ts`:

```ts
reviewBattle: async (review, state) => {
  await battleScreen.outro(outroKindFor(review));   // the fix
  lastReview = review;
  resultScreen.render(review, review.offer, state, (index) => rewardPick.submit(index));
  showScreen('result');
  return rewardPick.wait();
},
```

One `await` covers gym, trainer, wild, victory and defeat, because
`reviewBattle` is already the single path every battle completion takes, win or
loss. No `core/` change. `releaseBattle()` is not called at battle end, so the
screen keeps its subscription and its last frame throughout the hold.

Token: `--motion-outro: var(--motion-duration)`. Derived, so there is still one
number; zeroed in the reduced-motion block.

**The outro**, all four cases, decided from `review.won` and
`review.node.acquisition`, both of which are on `BattleReview` already:

| case | condition | what plays |
|---|---|---|
| won a gym or trainer fight | `won && !node.acquisition` | foe recalled toward the far side |
| won a wild fight | `won && node.acquisition` | the ball |
| the player's side, on any win | `won` | lead recalled toward the near side |
| lost | `!won` | the existing sink, then the hold |

One keyframe covers both recall directions, because `--beat-direction` already
exists per actor: a recalled body travels toward its own trainer, the direction
it did not lunge. On a win both sides play inside the one `--motion-outro`
window, the player's recall delayed by half, so the outro stays one number. A
body that already fainted is not recalled — a KO is never sunk twice.

**The ball, and the IP rule.** `theme/scenes/index.ts` bans hand-authored Poké
Balls — *"No Pokemon, no Pokeball, no landmark from anywhere: the same IP
posture as the sprite CDN rule"* — and **that rule stands**; it is about
hand-drawn scenery shipping in the repo. `slots.ts` already pulls item icons off
Showdown's CDN sheet through `@pkmn/img`'s `Icons`, and that is where the ball
comes from. Nothing raster is added.

The spritenum goes in a UI-side constant, **not** in `theme/itemIcons.ts`: that
file is generated from `data/items.ts` and its test regenerates and diffs it,
and a ball is not a game item and must not appear in `data/`. Verify the number
against `@pkmn/data` rather than trusting a remembered one.

### Half B — the abnormality beats

One beat per **class**, not per kind — seven motions, not thirty — each with its
own identity and none with more weight than another. Suggested shape, settled by
watching:

- **prevented** — the lunge starts and stalls. The one beat that reads as
  absence, which is what these events are.
- **state change** — the stat chevron rises or falls; direction carries the
  sign, magnitude does not vary.
- **volatile** — a ring settles onto the body and persists while the volatile
  does.
- **field** — the world layer behind the stage, not the body: the one class that
  is about neither Pokemon.
- **trait fired** — a brief flare on the trait chip, on the panel rather than
  the sprite.
- **identity** — a type-colour wash across the sprite.
- **damage shape** — rides the existing hit beat rather than adding a slot.

These slot into the existing `beats()` scheduler. **The budget question is the
real design work and must be reported before it is built:** a turn with four
abnormalities cannot serialize them all inside one `--motion-duration` and stay
a game rather than a cutscene. The likely answer is that abnormality beats run
concurrently with the damage beats they accompany rather than after them, and
that the strip remains the complete record while the stage shows a bounded
number. Decide it, write it down, do not discover it.

### Branch 3 gates

jsdom:

- `outro()` resolves; resolves immediately when the token is `0ms`; a tap
  resolves it early.
- The right `data-outro` per case, and **none on a turn that is not the last**.
- `settleActor` clears `data-outro` and drops the ball; cancelling rejects with
  `RunAbandoned` rather than hanging.
- One attribute assertion per abnormality class, plus the negative that an
  ordinary damage turn sets none of them.

**The seam assertion, and it is the one that matters.** Open item 15 is a
standing risk logged after two defects that both typechecked and both sat in the
gap between two correct halves, with the stated remedy: add the assertion at the
seam rather than at the function. The seam is `app.ts`'s `reviewBattle`, so
assert that **`showScreen('result')` has not run while the outro is parked** —
not merely that `scene.outro` returns a promise. A test that only checks the
scene passes just as happily if someone drops the `await`.

Browser-side: `--motion-outro` resolves, and resolves to `0ms` under emulated
reduced motion. The hardcoded-duration pin does not grow: every new length
derives from a token, and a literal `ms` anywhere in this run is the signal the
split is wrong.
