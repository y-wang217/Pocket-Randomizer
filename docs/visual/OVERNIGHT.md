# Overnight protocol

The preamble every stage prompt under `docs/visual/prompts/` reads first. Verbatim
from `docs/spec/gymrun-visual-identity-overnight-prompts.md`, which is the record;
this file is the working copy the prompts point at.

## Substitutions in force for this run

Recorded once here rather than in each report.

- **`main` means the designated session branch.** This run was started on
  `claude/gymrun-visual-identity-overnight-fllr8n` with the instruction to push
  nowhere else. So `visual/vN` branches are cut from that branch and merged back
  into it with a merge commit, and only that branch is pushed. Merging into the
  real `main` is the morning's pull request.
- **`gymrun-visual-identity-plan.md` was not in the repo** when the run started.
  It was pasted into the session and committed verbatim to
  `docs/spec/gymrun-visual-identity-plan.md` before any stage began, per the
  archival rule.
- **Releases A, B and C of the QoL plan are not merged.** Where a checkpoint
  names something one of them would have built (the Release A pinned move card,
  the Release B tooltip inventory, the Release C flag mapper) the report says
  what actually exists instead, and V5 skips per its own precondition.

## What the morning merge needs to know

`main` moved while the run was going: PR #10 (seven commits, `4343fe3`)
landed `data/tierInfo.ts`, ported the last unkeyed draw to a key, and added
`contentHash` by glob. A dry run of merging `main` into this branch is
conflict-free (four files auto-merge). But the visual baseline in
`docs/visual/baseline/` was recorded from the tree at the branch point, and
those commits change `src/data/` (so `data-digest.txt`) and may change seeded
output (the keyed port). After the merge, re-record the baseline **from the
merged tree with no visual change on top**, which is the same thing V0.0 did:

    npx vite-node scripts/visual/baseline.ts --write

Then run the gate. Every visual stage touches nothing under `core/` or
`data/`, so if a seeded run differs after the merge, `main` moved it, not
this branch. Not done overnight because the preamble says the baseline is
never regenerated, and this is the one case where that rule and `main`
disagree.

## Preamble

You are running unattended. There is no one to answer questions. Where the plan says "stop for review", write the report and continue. Where the plan says "decide" or "report first", take the default named in the plan's flagged-defaults section, record it, and continue. Never wait.
State markers. Stage state lives in `docs/visual/state/`. On start:

1. If `docs/visual/state/VN.done` exists and `npm test` passes on the current tree, print `VN already complete at <hash>` and exit. Do nothing else.
2. If `docs/visual/state/VN.failed` exists, read it, delete it, and resume from the last green checkpoint commit it names. Do not redo completed checkpoints.
3. If `docs/visual/state/V(N-1).done` does not exist, for N greater than 0, print `VN blocked: V(N-1) not done` and exit. Do not start.

Branch and commits. Work on `visual/vN`, created from `main` if it does not exist, checked out if it does. Commit only on green. Each checkpoint commit message is `VN.k: <what>`. Never commit with a failing test. Never amend or rewrite a checkpoint that already exists.
Gates. After every checkpoint, run the full gate: `npm test`, the byte-identical seed check against `docs/visual/baseline/` (create the baseline from `main` in V0 if absent), the `core/` import and timer lint, and any stage-specific assertion. Green means commit and continue. Red means: revert the working tree to the last green checkpoint, write `docs/visual/state/VN.failed` containing the checkpoint reached, the failing test names, the last 50 lines of output, and your diagnosis as a hypothesis plus what to check, then exit non-zero. Do not retry more than twice per checkpoint. Do not weaken a test to pass it.
Done. When every checkpoint is green, write `docs/visual/state/VN.done` containing the final commit hash, the bundle size delta measured with `npm run build`, and the layout heights of the two guarded screens. Write `docs/visual/reports/VN.md` with every report the plan asked for and every default taken. Merge `visual/vN` into `main` with a merge commit, no squash. Exit zero.
Decisions that needed a human. Anything the plan says cannot be decided from a desktop, take the conservative default, implement it behind a single CSS variable or constant so the morning swap is one line, and list it under `## Morning decisions` at the top of the report.

## Runner note

Run them in order, one process each, sequential. A shell loop is enough:

```
for n in 0 1 2 3 4 5; do
  claude -p "$(cat docs/visual/prompts/V$n.md)" || break
done

```

Each prompt exits zero on done, zero on a clean skip, non-zero on a failed marker, and the loop stops at the first failure. Re-running the loop in the morning resumes from the failed checkpoint and skips everything already done. Read `docs/visual/reports/` in order; every report opens with its morning decisions.
