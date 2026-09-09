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

**Which of these are actually here.** Only `gymrun-seeds-and-mappability.md`. `pokerun-build-spec.md` and
`gymrun-qol-release-plan-rev2.md` are named above but have not been supplied, so a prompt that says to read
them is asking for something this directory does not have. Say so rather than proceeding on an assumption
about what they contained — the same rule the missing stage prompts get below.

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
| `gymrun-stage4_5_1-claude-code-prompt.md` | Merged |
| `gymrun-stage4_6-claude-code-prompts.md` | 4.6a merged, 4.6b merged at `c6d730a`, 4.6c not started |

The three missing prompts are recorded rather than omitted. If a prompt here tells you to read one of them,
say so in your report instead of proceeding on an assumption about what it contained.

## Amendments that override the file they sit in

These are live. The underlying file was not rewritten, so read the amendment as authoritative.

1. **HMs are ordinary moves.** `gymrun-qol-release-plan-rev2.md` section 7 overrides Part C of
   `gymrun-stage4_6-claude-code-prompts.md`. No `data/hms.ts`, no HM item class, no teaching screen, no
   permanence, no backpack exemption. HM moves live in `data/movePools.ts` and band through `bandOfMove`.
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
