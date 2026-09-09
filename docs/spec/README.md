# GYMRUN Specs

Canonical copies of the design documents and stage prompts. Every stage prompt tells Claude Code to read
`pokerun-build-spec.md` and `gymrun-seeds-and-mappability.md`. Until this directory existed, that
instruction silently did nothing. Read from here, not from memory.

## Standing documents

| File | What it is |
|---|---|
| `pokerun-build-spec.md` | The original build spec. Architecture, hard rules, stage ladder, out-of-scope list. |
| `gymrun-seeds-and-mappability.md` | Keyed sub-stream derivation, the two version axes (`contentHash` and run log version), seed string format, `previewRun`. Load-bearing for Stage 5 seed sharing. |
| `gymrun-qol-release-plan-rev2.md` | Current release plan. Requirement register R1 to R14, Releases 0/A/B/C, and the 4.6c HM amendment in section 7. |

**Which of these are actually here.** All three, as of 2026-09-09. Every standing document and every
recovered stage prompt named in the tables now exists in this directory. The two prompts marked MISSING
below are still missing and are the only gap left.

**`gymrun-seeds-and-mappability.md` verification: done, and it diverged.** The copy previously in the repo
was a reconstruction written from a prompt description. It was diffed against the real document at the 4.6c
prerequisite. The keyed derivation agrees and is what Stage 4.6a shipped. Three requirements were never
built — `contentHash`, seed strings carrying it, and `previewRun` — and the design's instruction to delete
the unkeyed stream API was not carried out either. The reconstruction now lives at `docs/keyed-streams.md`
as the record of what 4.6a actually did, and it lists the four gaps at the end. All four are scheduled as
one release after 4.6c and before the freeze; `docs/generation.md` section 9 says why they are not bundled
into a data step.

## Stage prompts, in order

| File | Status |
|---|---|
| Stage 0 prompt | MISSING. Not recovered. |
| `gymrun-stage1-claude-code-prompt.md` | Merged |
| `gymrun-stage2-claude-code-prompt.md` | Merged |
| `gymrun-stage3-claude-code-prompt.md` | Merged |
| Stage 4 prompt | MISSING. Not recovered. |
| Stage 4.5 prompt | MISSING. Referenced by 4.5.1 and by the QoL plan. |
| `gymrun-patch-playtest-round2.md` | Merged |
| `gymrun-stage4.5.1-claude-code-prompt.md` | Merged |
| `gymrun-stage4.6-claude-code-prompts.md` | 4.6a and 4.6b merged. **Part C superseded** — see below. |
| `../../gymrun-stage4.6c-relics-claude-code-prompt.md` | Live. Capabilities as relics, the third and final design. Sits at the repo root rather than here, because it is the prompt being worked rather than an archived one. |

The three missing prompts are recorded rather than omitted. If a prompt here tells you to read one of them,
say so in your report instead of proceeding on an assumption about what it contained.

## Amendments that override the file they sit in

These are live. The underlying file was not rewritten, so read the amendment as authoritative.

1. **Capabilities are relics.** *(Superseded twice; this is version 3, 2026-09-09.)*
   `../../gymrun-stage4.6c-relics-claude-code-prompt.md` overrides **both** Part C of
   `gymrun-stage4.6-claude-code-prompts.md` (HMs as items) and section 7 of
   `gymrun-qol-release-plan-rev2.md` (HMs as ordinary moves). A capability is granted by a permanent,
   run-scoped, passive relic. No move slot, no backpack capacity, no teaching, no legality query — and
   **knowing a capability-named move grants nothing**. Surf-the-move and Surf-the-capability are unrelated
   systems that share a name. Both earlier versions remain in this directory and both are wrong; read the
   supersession notice at the top of the relics prompt before either.
2. **Decline exists in the move learning flow.** Release A retires the "There is no decline" rule from
   Stage 4.5.1 Part 6. Decline is a parameter of the flow entry point, defaulted on, and forfeits the reward.
3. **Species rewards are gone.** 4.6b removed them from the pools and deleted `tuning.allowSpeciesRewards`.
   Capture from 4.6a is the acquisition path. `offensiveCoverage` survives on capture cards.

## Rules that hold in every prompt

- `core/` never imports from `ui/`. No `Math.random`.
- Every balance or copy number a tuning pass would touch lives in `data/`.
- The Part 4 editorial rule from Stage 4.5.1: the UI presents attributes, never verdicts. The one exception
  is live type effectiveness against the Pokemon currently on the field.
- UI comes last in every stage.
- Commit at each checkpoint and stop for review.

## Open decisions, not yet made

- **Type wheel** in `src/ui/tooltips.ts`: keep it but drop the trigger from the two Pokemon panel type
  badges, delete it, or leave as is. Option 1 recommended. Release B forces the call.
- **`latent` definition**: generated gen 7 learnset table, or type-based. Decide before 4.6c starts.
- **Band 3 encounters**: node transition (Option A) or descope (Option B). Decided by the 4.6c prereq report.
- **Priority-blind and speed-blind AI**: own pass, own `AI_VERSION` bump, deliberately outside 4.6.
