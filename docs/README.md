# GYMRUN docs

Where things stand. Read [`../CLAUDE.md`](../CLAUDE.md) first for the rules that
do not change, then this for the ones that do.

This file is expected to go stale and to be corrected often. Sections 4 and 5
especially.

## 1. What this project is

GYMRUN is a seeded browser roguelike built over `@pkmn/sim`. There is no
overworld: a run is a starter, then a chain of node choices through eight
segments, each ending in a gym. The same seed and the same decisions reproduce
the same run exactly, and that property is the thing every other design decision
defers to.

## 2. Where to start reading

A session starting cold, in order:

1. [`../CLAUDE.md`](../CLAUDE.md), the invariants. Short by design.
2. This file, for what is merged, what is open, and which designs are dead.
3. [`spec/README.md`](spec/README.md), for the design lineage, the prompt
   register, and what you must commit before you start building.
4. [`generation.md`](generation.md), for what is drawn where and when.

Stop there unless you need a specific answer. The rest of the map is below.

## 3. The document map

One row per document. If a fact changes, exactly one of these files should need
editing.

| File | Authoritative for | Read it when |
|---|---|---|
| [`../CLAUDE.md`](../CLAUDE.md) | The invariants, and nothing else | Every session, first |
| `docs/README.md` (this file) | Current state, open items, design lineage | Every session, second |
| [`spec/README.md`](spec/README.md) | The prompt register, the archival rule, the parallel session protocol | Before starting any stage or patch |
| [`generation.md`](generation.md) | What each pass draws, from which stream, under which key. Levels, tiers, the band ceiling. Relics and capability gates. Versioning, and what `contentHash` is waiting on | Adding or moving a draw |
| [`balance.md`](balance.md) | Every simulator figure, the standing policy that balance is not a gate, and the benchmark table | Reading or quoting any number |
| [`keyed-streams.md`](keyed-streams.md) | What the 4.6a stream refactor actually shipped, and the four requirements of its design that were not built | Working on RNG, seeds or replay |
| [`engine-notes.md`](engine-notes.md) | `@pkmn/sim` findings: browser viability, the Gen 3 lock, bundle and trim analysis | Touching the sim adapter or the bundle |
| [`spec/`](spec/) | The prompts and design documents themselves, verbatim | Its README says which are live |

### Where two files touch the same fact

The root [`../README.md`](../README.md) is the player-facing and
contributor-facing front door: quick start, scripts, and the per-stage
changelog. It also currently restates the architecture rules, bundle figures,
balance headlines and an open-questions list. **It owns none of those.**
`architecture.md`, `engine-notes.md`, `balance.md` and this file do,
respectively. Where the root README disagrees with one of them, the other one is
right. Trimming it to pointers is a pending follow-up.

[`architecture.md`](architecture.md) owns layers, seams, the policy interfaces
and run log structure. Where `CLAUDE.md` states an architecture invariant,
`architecture.md` carries the argument for it.

## 4. Current state

**Merged:** everything through Stage 4.6c. Locales and capture (4.6a), base
power banding and berries (4.6b), and relics, capability events and band 3
encounters (4.6c). The benchmark for the current randomizer version is recorded
in `sim-reports/benchmarks/`.

**Head of `main`:** `f0c53f2`. The visual identity branch (V0 to V4) and Stage
4.7 both merged into it, as PR #13 and PR #12; PR #10 before them is the 0.5
verification release, PR #14 the V5 unblock audit, and PR #15 the 4.7 phone
regression patch. The three facts this section carried before 2026-09-10 were
all stale, and the audit
([`reports/v5-unblock-audit.md`](reports/v5-unblock-audit.md) divergence 1)
listed them; they are corrected here.

**Visual identity, V0 to V4: merged**, as PR #13 (`9296ba7`). An overnight run
under [`visual/OVERNIGHT.md`](visual/OVERNIGHT.md) built the first five stages
of [`spec/gymrun-visual-identity-plan.md`](spec/gymrun-visual-identity-plan.md):
tokens and the display face, locale palettes, world chrome, the scene layer,
and the run summary. Each stage's report in `visual/reports/` opens with its
morning decisions, **and two of those decisions are still open and still want a
phone**: V0.5's `--font-body` and V3.6's performance check. V5 exited as a clean
skip because Release C was not merged.

**Merged since:** the 4.7 phone regression patch, as PR #15
([`spec/gymrun-patch-4.7-phone-regressions.md`](spec/gymrun-patch-4.7-phone-regressions.md)).
Presentation only, no `core/` change, no version bump. Its step 1 shipped — the
pre-gym screen had no control that submitted the current lead, so a party of one
could not leave it — and its steps 2 to 4 stopped on the prompt's own stop
condition, because the vertical budget they were to reclaim is missed by 100px
on trees that predate Stage 4.7 entirely.
[`visual/reports/phone-regressions-4.7.md`](visual/reports/phone-regressions-4.7.md)
has the three measurements; `generation.md` section 12b records the deviation.

**Merged since that:** Release C, PR #16 (`846975c`), **battle feedback
visuals**. Presentation only — the HP chunk and its
shadow, the turn order jiggle, post-resolution flag words off a new pure reader
in `core/battle/flags.ts`, and the berry flag off the `-enditem` reader 4.6b
already had. No `core/` state change, no version axis moved, seeded output byte
identical by both instruments. It is the last hard blocker in front of V5.
Report: [`reports/release-c-battle-feedback.md`](reports/release-c-battle-feedback.md).

**The two branches agree about the map's 25px overflow, from opposite
directions**, which is worth recording because they were written independently:
the phone patch stopped on it as a budget miss that "predates Stage 4.7
entirely", and Release C measured the same check reporting the same number on a
tree with 4.7 in and no visual pass on top. Neither release owns it. Release C's
smoke marker is the countdown; see `reports/release-c-battle-feedback.md` §0.

**Working branch:** `claude/band-badge-move-card-t02z1t`, **R12: the band badge
on every move card**
([`spec/gymrun-patch-r12-band-badge-move-card.md`](spec/gymrun-patch-r12-band-badge-move-card.md)).
Display only, one commit, no version axis moved, seeded output byte identical by
both instruments. `bandChip` had one caller — the reward screen, which resolved
the band itself and hung the badge off its own name line — so `BAND 3` was
readable on the offer and absent from the four moves the player was comparing it
against. It now renders on all eight surfaces that draw a move, through one
insertion point (`moveBandChip` in `ui/scene.ts`) and one resolution path
(`bandOfMove`, read once in the adapter). **The badge fits on the battle button
at 390 wide**: `.move__meta` was already wrapping, so the whole cost is 1px on
the move grid and the decision point does not move. Deltas and the measurement
are in [`visual/baseline/README.md`](visual/baseline/README.md); `generation.md`
section 12c records the one-pixel reading of the prompt's height rule.

**Still unblocked by Release C, and now by R12:** V5, whose test 5 assumes R12
is on `main`. Its prompt needs the four amendments in section 2 of the R12
document applied before it is pasted — the event strip Release C already built
is V5's strip and must not be built twice, the 36px it costs is already spent
against V5's budget, test 4 becomes a same-weight rule rather than a
chip-on-every-button rule, and the open V0.5 `--font-body` decision has to be
answered before V5 or after it, never inside it. Both R12 and V5 are named in
[`spec/gymrun-release-c-battle-feedback-amended.md`](spec/gymrun-release-c-battle-feedback-amended.md).

**V5 is running now**, on `claude/zen-mayer-9sp9bn`, and its state — preflight,
measurements, cuts and gates — is in
[`visual/reports/v5-battle-stage.md`](visual/reports/v5-battle-stage.md) rather
than in this section.

**Next scheduled work:** the `contentHash` release. It bundles four things that
are specified but unbuilt: `contentHash` itself, seed strings that carry it,
`previewRun`, and deleting the unkeyed stream API. It runs after 4.6c and
before the freeze, and it is deliberately not to be built inside a data step.
[`keyed-streams.md`](keyed-streams.md) lists the four; `generation.md` section 9
says why they are their own release.

**Blocked:**

- **The freeze** is blocked on `contentHash` existing, because the freeze is the
  act of stamping one as the first shareable baseline.
- **Re-reading the gym currency pick rate** is blocked on R13, the simulator's
  move-reward scorer defect, in Release A. Any figure taken before that fix is
  confounded.
- **The type wheel change** is decided but unbuilt, and lands in Release B.

**No longer blocked.** Release A was a hard dependency of 4.6c under the HM
design, because HM teaching was going to be the move reward flow. Relics removed
teaching entirely, so that dependency dissolved and 4.6c shipped ahead of it.

## 5. Open items

One line each. The analysis lives where the pointer goes, not here.

1. **Fight length.** Early fights are an exchange rather than a shape. It is now
   the root cause behind two separate carried misses, below, and has earned its
   own investigation. `balance.md`, and open question 1 in the root README.
2. **Berry clog past gym 6.** Above target. Traced to short fights rather than
   to the berry table or backpack capacity, so item 1 is the fix.
   `balance.md` section 11.
3. **Gym currency pick rate.** `balance.md` section 11.6 records it as closed
   against a banded field. The QoL plan reopens it: any figure taken before R13
   is confounded by the scorer defect, so it needs re-reading after Release A.
   Treat it as open with a closed-looking number.
4. **Priority-blind and speed-blind AI.** `MoveView` carries no priority and
   `BattleView` carries no speed. Its own pass, its own `AI_VERSION` bump, kept
   outside 4.6 so its effect on the table stays separable.
   [`spec/gymrun-stage4.6-claude-code-prompts.md`](spec/gymrun-stage4.6-claude-code-prompts.md).
5. **The type wheel. Decided, not yet built.** Keep it, and drop the trigger
   from the two Pokemon panel type badges. It is UI work and belongs to
   Release B. Recorded in [`spec/README.md`](spec/README.md).
6. **Party threat readout. Shipped.** Carried as open in the QoL plan, which
   predates the merge. It is live on the party screen and the map, and covered
   by `test/threat-readout.test.ts`. The plan is a historical record and is not
   edited to match; this row is the deviation note.
7. **The 390x844 vertical budget. Met at V5.4, and the marker came off.** The
   visual plan asks both decision points to end at or above y=740. This was
   carried as a 206.5px miss that was *not* Stage 4.7's to give back — the same
   measurer puts the fourth move button at 840 on the commit before PR #10 — and
   the row said reaching 740 was a decision about the battle heading, the two
   Pokemon panels and the move grid. V5 is that decision and it spent all three:
   the fourth move button ends at **704** and the map's last offered card at
   **728.22**, so `test/visual-v0.test.ts`'s `it.fails` reported its expected
   failure as an error and is a real assertion from here. Numbers per step:
   [`visual/reports/v5-battle-stage.md`](visual/reports/v5-battle-stage.md).
   History: [`visual/reports/phone-regressions-4.7.md`](visual/reports/phone-regressions-4.7.md).
   **The SMOKE24 map `xfail` is a different check and stays**: it measures the
   offered cards against the 844 fold in the scrolled view, not against the 740
   usable line, and still reports y=869.
8. **Strict trim is red, and the app does not boot under it.** `CLAUDE.md`
   names it an absolute gate. `GYMRUN_TRIM_STRICT=1 vitest run` fails 22 tests
   across the five browser test files on `9296ba7`, every one of them at
   `openApp` waiting for the starter screen: something in the bundle reads the
   trimmed `learnsets`/`legality` tables at start-up and the strict proxy throws.
   Its own patch — find the read and make it lazy or remove it.
   [`visual/reports/phone-regressions-4.7.md`](visual/reports/phone-regressions-4.7.md).

9. **R8 needs its own move-card insertion point.** Release B's "one insertion
   point" rule is `scene.moveCard`, and the battle move buttons do not go
   through it — `renderMove` calls `scene.moveFacts` directly, because
   `test/boundaries.test.ts` holds `scene.ts` to the battle projection. So a
   tap-to-explain wired into `moveCard` reaches six surfaces and *not* the
   battle bar. R8 is a separate insertion point, not a wider version of this
   one. Recorded by patch 4.7.2, branch `claude/cool-dijkstra-apme8u`.
   [`spec/gymrun-patch-4.7.2-font-stats-verbosity.md`](spec/gymrun-patch-4.7.2-font-stats-verbosity.md).
10. **The move-replace screen explains the incoming move and not the four it is
   compared against.** Same cause as item 9: the incoming card is a `moveCard`
   and the four current moves are `moveFacts` submit buttons. The asymmetry
   lands on the one screen whose entire purpose is that comparison, and is
   worse than neither side explaining. Release A's to fix, with R8. Recorded by
   patch 4.7.2, branch `claude/cool-dijkstra-apme8u`.
   [`spec/gymrun-patch-4.7.2-font-stats-verbosity.md`](spec/gymrun-patch-4.7.2-font-stats-verbosity.md).

Five audit findings, where the tree does not currently satisfy an invariant in
`CLAUDE.md`, are recorded in the message of the commit that added that file.
They are unfixed on purpose and each needs its own patch.

## 6. The design lineage, briefly

The repo contains superseded designs. They are kept, not deleted, because a
prompt is a record of what was asked. **Only `spec/README.md` can tell you which
version is live**, so check it before building on anything in `spec/`.

**The capability system, designed three times.** This is the one that will
catch a reader out, because two dead designs are still sitting in the specs.

1. **HMs as items.** A separate permanent item class, free of backpack capacity,
   taught into a move slot. Retired: it needed a teaching flow, a legality table
   and a build-config artifact. Part C of
   [`spec/gymrun-stage4.6-claude-code-prompts.md`](spec/gymrun-stage4.6-claude-code-prompts.md).
2. **HMs as ordinary attacks.** Capability moves join the general move pools and
   band normally. Retired: it made capability value track move quality, so a
   move a player wants anyway resolves at the top band constantly and a move
   nobody keeps resolves at the bottom. Section 7 of
   [`spec/gymrun-qol-release-plan-rev2.md`](spec/gymrun-qol-release-plan-rev2.md).
3. **Capabilities as relics. Live.** A capability is granted by a permanent,
   run-scoped, passive relic. No move slot, no backpack capacity, no teaching,
   no legality query. Knowing a capability-named move grants nothing: the move
   and the capability are unrelated systems that share a name.
   [`generation.md`](generation.md) section 10 describes what shipped.

**Three smaller supersessions,** all recorded in `spec/README.md`:

- **Species rewards are gone.** Removed from the pools in 4.6b. Capture, from
  4.6a, is the acquisition path.
- **Decline exists in the move learning flow.** Release A retires the "there is
  no decline" rule from Stage 4.5.1.
- **The seeds document was reconstructed, then replaced.** 4.6a was built from a
  prompt's description of a design document that was not in the repo. The real
  one now sits at
  [`spec/gymrun-seeds-and-mappability.md`](spec/gymrun-seeds-and-mappability.md)
  and the reconstruction was re-homed to [`keyed-streams.md`](keyed-streams.md)
  as the record of what was actually built. Where they disagree, the spec is the
  design and `keyed-streams.md` is the truth about the code. This is the whole
  case for the archival rule in one incident.
