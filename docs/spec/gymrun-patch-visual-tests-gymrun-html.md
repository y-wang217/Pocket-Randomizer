# GYMRUN patch: five browser tests still open the card run

Filed 2026-10-11 on `claude/fix-gymrun-visual-urls`, from `main` at
`e25036b`, **before any change to the tree**.

## The brief, verbatim

> Yes open a new small fix pr

It answers the offer made after #113 was opened: the card run (#112) made
`index.html` the card battler and moved GYMRUN to `gymrun.html`, and two
browser tests still loaded the bare address and timed out waiting for
GYMRUN's starter screen, on `main` as on #113; the offer was a separate small
PR pointing them at `gymrun.html`.

## What the fix found

Run on `main` at `e25036b`, five tests fail the same way, not two. Each goes
to `${harness.url}/` (`#seed=...`, or bare for a reload) and waits for GYMRUN:

- `test/visual-v1.test.ts`, data-locale: the reload that resumes a saved run
- `test/visual-v2.test.ts`, the corner stamps: copy the full seed string
- `test/visual-v3.test.ts`, the world: the parallax trace's reduced-motion page
- `test/visual-motion.test.ts`, reduced motion keeps the outcome
- `test/visual-release-c.test.ts`, reduced motion: every animation instant

Scope: the URL in those five places, nothing else. No version axis moves.
