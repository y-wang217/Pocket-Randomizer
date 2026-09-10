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
| [`gymrun-visual-identity-plan.md`](gymrun-visual-identity-plan.md) | release plan | `active` | | |
| [`gymrun-visual-identity-overnight-prompts.md`](gymrun-visual-identity-overnight-prompts.md) | stage prompt | `active` | | |

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
| **Priority-blind and speed-blind AI** | **Not a blocker.** Its own pass and its own `AI_VERSION` bump, deliberately outside 4.6. Carried in [`../README.md`](../README.md) section 5. |
