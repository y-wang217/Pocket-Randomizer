# GYMRUN patch: the Node leg's `onTaskUpdate` timeout

Filed 2026-10-09 on `claude/sharp-ritchie-qb95px`, from `main` at `f58835e`,
**before any change to the tree**.

## The brief, verbatim

Message 1, a report with no code:

> part of my ci is always timing out "vitest worker timeout" investigate this and repor tback dont make changes

Message 2, after the report:

> start with the smallest fix

Message 3, after the smallest fix was opened as PR 107:

> now fix the errored masking issue

## The report message 2 answers

`[vitest-worker]: Timeout calling "onTaskUpdate"` is not load. Vitest's worker
RPC gives every call a 60s timer; the reply is only read when the worker's
event loop turns, and `core/` has no timers, so `playRun` and `resumeRun` never
turn it. A single test that runs synchronously for more than 60s therefore
expires the timer for the update sent when it started. Reproduced on an idle
box with one file of seventy 1s synchronous tests; the same file with one
`setImmediate` between tests is clean.

The test is `test/party.test.ts`, "resumes from the save taken at every forced
switch to an identical run": 90.5s locally, every other test under 36s.

"The smallest fix" offered in the report: yield a macrotask between resumes in
that test's loop, so it checks every forced switch as before and lets the event
loop turn between them. Test-only, nothing under `src/`.

The follow-ups offered alongside it (retire ERRORED, reconsider the fork cap,
correct the load explanation, the `species-label` leaked timer) are not in this
brief.

## What message 3 refers to

Named in the report as a follow-up: `everyTestPassedAnyway` in
`scripts/check-tally.mjs` reads a leg as ERRORED, not FAILED, when its output
holds the `onTaskUpdate` string, a passing files tally and no `N failed`. A
second unhandled error in the same output meets all three, so it would be
reported green. Run 37928075949 had one such error (a leaked `setTimeout` from
`test/species-label.test.ts`); it was reported FAILED only because no timeout
fired in that run.
