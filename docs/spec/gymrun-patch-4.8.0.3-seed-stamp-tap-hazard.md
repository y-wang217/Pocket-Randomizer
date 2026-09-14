# GYMRUN 4.8.0.3: Seed Stamp Tap Hazard

Paste on `claude/focused-ride-vet50c`. Scoped exception to the closeout's "don't touch what the patch didn't touch". This is the only authorized deviation.

## PROMPT

Fix carried item B, option (a), from `docs/README.md` § "Carried out of patch 4.8.0.3". Nothing else.

`.stamp--seed` is `position: fixed`, `z-index: 20`, `pointer-events: auto`, occupying a 121x9 band at (6, 829) over a 1630px scroll region. It takes taps meant for content underneath it. Main passes `visual-v3 > the world > mounts once, survives every screen, and never takes a tap` positionally, not structurally, so any layout change re-rolls which control is caught.

Option (a): let content win the tap where they overlap. Stamp below the shell, shell transparent to pointers, interactive descendants opted back in.

Rules:

- The stamp's own copy affordance must still take taps. `visual-v2`'s stamp-copy test taps it on the starter screen at 390x844 and must stay green untouched.
- Do not end the scroll region above the stamp band and do not drop the stamp on phone. Both were considered and rejected.
- Do not reintroduce the accuracy-chip change. It was reverted for cause and stays carried item C.
- No `core/` change, no log version bump, no `contentHash` movement.
- Touch the stamp and the app shell only. Anything wider, stop and report.

Report after: `visual-v3`, `visual-v2`, the full visual/browser suite, `trim-strict`, `npm run smoke` with SMOKE24, and measured heights against baseline in all three modes. Heights must be unchanged. If any move, report rather than absorb.

Then, separately and in the same commit or its own, whichever is cleaner: add the four live verdict strings to the invariant register as open violations with their surfaces. `categoryInfo.ts:48`, `statusInfo.ts:125`, `statusInfo.ts:242`, `bandInfo.ts:68`. File only, do not fix them here.

Definition of done: the world never takes a tap by construction rather than by position, the stamp copy still works at 390x844, all gates green, heights and `contentHash` unmoved, and the four verdict strings are on the register.
