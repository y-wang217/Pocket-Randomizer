# GYMRUN specs

Canonical copies of the design documents and stage prompts, verbatim. Every
stage prompt in this project says to read `pokerun-build-spec.md` and
`gymrun-seeds-and-mappability.md`. For several stages those files were not in
the repo, so that instruction silently did nothing and sessions worked from
memory of a design they could not check. **Read from here, not from memory.**

This file says what each document is and whether it is live. It does not
summarise what any of them say.

- The invariants that hold across every prompt: [`../../CLAUDE.md`](../../CLAUDE.md).
- Current state, open items, and the design lineage in prose:
  [`../README.md`](../README.md).

## The register supersedes an archived instruction

**2026-09-10.** Several prompts here contain an instruction to *decide* an open
question. Some of those questions have since been decided, and protocol 4
forbids editing the prompt to say so. Both facts are correct and together they
re-litigate a settled decision every time a session opens the older document.

**The rule: where a decision appears in "Decisions, resolved" below, that
decision stands, and an instruction inside an archived prompt to make it again
is a record of when it was open — not a live instruction.** Implement what the
register says. If you believe the register is wrong, that is a new decision with
a new date, not a rediscovery.

**The current instance** is the type wheel.
[`gymrun-qol-release-plan-rev2.md`](gymrun-qol-release-plan-rev2.md) section on
Release B says "Resolve it now" and offers three options. It was resolved on
2026-09-10 — keep the wheel, drop the trigger from the two Pokemon panel type
badges — and the row below records it. Release B implements that. It does not
choose again.

## The register

One row per document. **Status is exactly one value:** `draft`, `active`,
`merged`, or `superseded`.

| Document | Kind | Status | Superseded by | Merged at |
|---|---|---|---|---|
| [`pokerun-build-spec.md`](pokerun-build-spec.md) | spec | `active` | | |
| [`gymrun-seeds-and-mappability.md`](gymrun-seeds-and-mappability.md) | design note | `active` | | partly built at `94040e9` |
| [`gymrun-qol-release-plan-rev2.md`](gymrun-qol-release-plan-rev2.md) | release plan | `active` | section 7 only, by the relics prompt | |
| [`gymrun-stage1-claude-code-prompt.md`](gymrun-stage1-claude-code-prompt.md) | stage prompt | `merged` | | `b20aa26` |
| [`gymrun-stage2-claude-code-prompt.md`](gymrun-stage2-claude-code-prompt.md) | stage prompt | `merged` | | `9a62547` |
| [`gymrun-stage3-claude-code-prompt.md`](gymrun-stage3-claude-code-prompt.md) | stage prompt | `merged` | | `e2f312b` |
| [`gymrun-patch-playtest-round2.md`](gymrun-patch-playtest-round2.md) | patch prompt | `merged` | | `8a7897d` |
| [`gymrun-stage4.5.1-claude-code-prompt.md`](gymrun-stage4.5.1-claude-code-prompt.md) | stage prompt | `merged` | | `42c6961` |
| [`gymrun-stage4.6-claude-code-prompts.md`](gymrun-stage4.6-claude-code-prompts.md) | stage prompt | `merged` | Part C only, by the relics prompt | `dfa18dc` (A), `c6d730a` (B) |
| [`gymrun-stage4.6c-relics-claude-code-prompt.md`](gymrun-stage4.6c-relics-claude-code-prompt.md) | stage prompt | `merged` | | `4b63528` |
| [`gymrun-visual-identity-plan.md`](gymrun-visual-identity-plan.md) | release plan | `active` | | V0 to V4 built on the overnight branch; V5 waits on Release C; V6 not started |
| [`gymrun-visual-identity-overnight-prompts.md`](gymrun-visual-identity-overnight-prompts.md) | stage prompt | `active` | | V0 to V4 done, V5 skipped, see `docs/visual/reports/` |
| [`gymrun-patch-4.7-phone-regressions.md`](gymrun-patch-4.7-phone-regressions.md) | patch prompt | `active` | | step 1 built; steps 2-4 stopped on the prompt's own stop condition, see `../generation.md` section 12b |
| [`gymrun-release-c-battle-feedback-amended.md`](gymrun-release-c-battle-feedback-amended.md) | stage prompt | `active` | supersedes section 6 of the QoL release plan | items 1-4 built; R12 and V5 are its named follow-ons |
| [`gymrun-patch-r12-band-badge-move-card.md`](gymrun-patch-r12-band-badge-move-card.md) | patch prompt | `draft` | | |

`gymrun-seeds-and-mappability.md` stays `active` rather than `merged` because
four of its requirements are unbuilt. [`../keyed-streams.md`](../keyed-streams.md)
lists them.

The visual identity plan and its overnight prompts were pasted into the
session that ran them and committed here on 2026-09-10 before that run began.
Neither was in the repo before that. The working copies the overnight runner
reads live under `docs/visual/`; these two files are the record.

The relics prompt sat at the repo root until 2026-09-10 and was moved here.
Rule 1 below was always satisfied for it: it was committed at `47d4d0e`, before
its first implementation commit at `3764e89`. Only the location was wrong.

### Prompts that were never recovered

Not in this directory, so they get no register row, but recorded rather than
omitted: **Stage 0**, **Stage 4**, and **Stage 4.5**. The last is referenced by
the 4.5.1 prompt and by the QoL plan. If a prompt here tells you to read one of
them, say so in your report instead of proceeding on an assumption about what it
contained.

**Do not reconstruct any of the three.** The seeds document is the cautionary
case: a reconstruction written from a prompt's description of it was built on
for a whole sub-stage before the real document arrived and turned out to specify
something else. A reconstruction is indistinguishable from a source once it is
committed, and this project has already paid for that once.

What Stage 4.5 *delivered* is not lost, and it is recorded in live documents
rather than restated here — **derived from what those documents say, not from
the prompt, which nobody has read since**:

- [`../architecture.md`](../architecture.md) — the battle screen's projection
  seam, rule 5, and the four things the stage needed out of `@pkmn/sim`.
- [`../balance.md`](../balance.md) section 8 — "the non-result": the stage
  changed no balance number, deliberately, and the section explains why that is
  a finding worth a section.
- [`../../README.md`](../../README.md), "What Stage 4.5 added" — the
  player-facing half.

That is enough to work against. It is not a substitute for the prompt and is
not to be treated as one.

## Resolving a path an archived prompt names

Every prompt here opens by naming documents to read. Ten of those names do not
resolve as written: nine are bare filenames from a time when the documents sat
at the repo root, one is a source path that moved under `screens/`, plus one
prompt that was never recovered.

**They are not corrected, and that is protocol 4 working rather than failing.**
A prompt is a record of what was asked. Editing one to match where a file ended
up would make it a description of what exists, which is the one thing it must
not become. So the archive gets a lookup table instead, and the automated check
in `test/boundaries.test.ts` deliberately excludes this directory — a test that
went red on a document nobody may edit would be deleted, and the live half of
the invariant would go with it.

If a prompt tells you to read something below, read the right-hand column.

| Named in a prompt as | Actually |
|---|---|
| `pokerun-build-spec.md` | [`pokerun-build-spec.md`](pokerun-build-spec.md), here |
| `gymrun-seeds-and-mappability.md` | [`gymrun-seeds-and-mappability.md`](gymrun-seeds-and-mappability.md), here |
| `gymrun-stage4.6-claude-code-prompts.md` | [`gymrun-stage4.6-claude-code-prompts.md`](gymrun-stage4.6-claude-code-prompts.md), here |
| `data/movePools.ts`, `data/rewardPools.ts`, `data/scaling.ts`, `data/events.ts` | `src/data/…` — the `data/` shorthand for `src/data/` |
| `core/events.ts` | `src/core/events.ts` — same shorthand |
| `data/hms.ts` | **Deleted at 4.6c.** Capabilities are relics; there is no HM table and there will not be one |
| the Stage 4.5 prompt | **Unrecoverable.** See "Prompts that were never recovered" above. Do not reconstruct it |
| `src/ui/reward.ts` around line 61 | `src/ui/screens/reward.ts:61` — the reward screen moved under `screens/` at Stage 4.5.1, item D. The line number is right in the new location: `bandBadge` is there |

The `data/` and `core/` shorthand is used consistently across every document
and is not a defect, merely shorter than the tree. The first three rows exist
because those documents moved into this directory at `47d4d0e`, which is later
than every prompt that names them — the prompts are not wrong, they are older
than the layout.

## The archival rule

**Every prompt is committed to `docs/spec/` verbatim before any work begins on
it.** Not after, not at merge time. The commit that adds the prompt is the first
commit of the stage.

Three things this buys:

1. **The repo is the source of truth.** An instruction to read a design document
   that is not in the repo does nothing, and nobody can tell.
2. **Parallel sessions cannot diverge.** Two sessions on the same tree read the
   same committed prompt. A prompt that exists only in one context window is
   invisible to the other, and the first that session hears of it is a merge
   conflict in a file it did not know was in scope.
3. **Supersession becomes visible.** A design that changes three times leaves
   three documents. Without a status column the fourth reader cannot tell which
   one is live, and this project has already produced exactly that situation.

### The protocol

1. Before starting a stage or patch, commit its prompt to `docs/spec/` verbatim.
   **Do not edit it to match what you intend to build.**
2. Add its row to the register with status `draft`, and flip to `active` when
   work starts.
3. Naming: `gymrun-stage<N>-<slug>.md` for stages, `gymrun-patch-<slug>.md` for
   patches. Dotted stage numbers, matching the cross-references already in the
   docs.
4. Where the built work deviates from the prompt, **do not edit the prompt.**
   Record the deviation in [`../generation.md`](../generation.md) with a dated
   note naming the prompt and the reason. The prompt is a historical record of
   what was asked, not a description of what exists.
5. On merge, flip the row to `merged` and fill the commit.
6. When a later design replaces an earlier one, flip the earlier row to
   `superseded` and fill the pointer. **Do not delete the document.**
7. A session must not begin implementation work from a prompt that is not in
   `docs/spec/`. If one is pasted that is not there, commit it first, then start.

## Parallel session protocol

- One branch per prompt, named for it.
- A session declares scope by the prompt it is working from. **Two sessions must
  not be `active` on prompts that touch the same data tables at the same time**,
  because `contentHash` moves for both and neither report is attributable.
- Before starting, read the register and check nothing overlapping is `active`.
- Documentation commits are always safe to land in parallel. **Data table
  commits are never safe to land in parallel.**

## Decisions, resolved

These four were carried here as open. All four are now closed, recorded with the
evidence that closed them.

| Decision | Resolution |
|---|---|
| **Type wheel** in `src/ui/tooltips.ts` | **Keep it, drop the trigger from the two Pokemon panel type badges.** Decided 2026-09-10. Not yet implemented: it is UI work and belongs to Release B. |
| **`latent` definition** | **Type-based**, not a generated learnset table. Shipped in `src/data/capabilityTypes.ts`, whose header records the measurement and the three reasons. No `hmLearnsets.ts` exists or will. |
| **Band 3 encounters** | **Node transition**, Option A. Shipped, covered by `test/band3.test.ts` and `test/event-bands.test.ts`, described in [`../generation.md`](../generation.md) section 10. |
| **Priority-blind and speed-blind AI** | **Not a blocker.** Its own pass and its own `AI_VERSION` bump, deliberately outside 4.6. Carried in [`../README.md`](../README.md) section 5. **That pass also owns the unguarded `AI_VERSION`, and it is not the cheap fix the `8c3bff8` audit implies** — see below. |

## Scope corrections

**`AI_VERSION` is guarded nowhere, and guarding it is a log-version bump.**
Recorded 2026-09-10, Release 0.5. The `8c3bff8` audit lists "`AI_VERSION` is
stamped onto reports but never guarded at replay" beside four one-line defects,
which reads as a one-line fix. It is not. `RunLog` in `core/types.ts` has no
`aiVersion` field at all, so there is nothing for `assertReplayable` to compare
— adding the guard means adding the field, which changes the decision schema and
forces `RUN_LOG_VERSION`. It stays homed to the priority-blind and speed-blind
AI pass, which already bumps `AI_VERSION` and already produces its own balance
report, and which should scope it as a schema change rather than a null check.
