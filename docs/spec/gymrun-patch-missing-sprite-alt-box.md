# Patch: the missing sprite's alt-text box

Filed on 2026-09-17, on `claude/serene-bohr-xn433h`, on top of merged PR #44
(`df2982f`).

## Why this file exists, and why it is not a brief

**There is no prompt for this patch.** Nobody asked for it. It is a defect the
gates found while verifying the chip-audit patch, and it is filed here because
`CLAUDE.md` says work starts from a filed record and the closeout precedent
extends that to a follow-up: *"a closeout that changes the tree is work, and
work starts from a filed prompt."*

So what follows is the finding rather than a request — the register's own
`gymrun-patch-ios-diagnose-instrument.md` is the nearest shape, a patch filed
because something the previous session believed was true was not.

## The exchange that authorised it

The chip-audit patch's PR was merged while its last gate was still running. The
author then asked, in the same session:

> for my knowledge, what's the convention for identifying missed fixes on a
> branch? do i reopen the prior PR or do we just make a new one and patch
> overtop?

and, on being told this repo files a follow-up as its own patch with its own
row:

> yes file the spec entry into the register, and once the suite is done, open a
> new PR

That is the authorisation. The work was already done and verified when it was
given; this file is the register catching up with it, which is the honest
account and not the protocol working as intended.

## The finding

`test/visual-phone-seed-bar.test.ts` asserts `documentElement.scrollWidth` is
390 on the starter screen. It began failing at 401 — **only inside the full
136-file run**. It passed standalone, passed under `GYMRUN_TRIM_STRICT=1`, and
passed with all 28 browser files in parallel.

**Two measurements contradicted each other, and both were right.** A full-suite
run on `9616ade`, the commit before the chip audit, passed — which said the
chip audit was responsible. An instrumented probe run on `9616ade` reproduced
the overflow identically — which said it was not. The defect is three patches
old; the chip audit added two chips per starter card, which moved the render
timing that had been hiding it.

**The mechanism.** `ui/sprites.ts` sets `alt = species` and `width = height =
96` as attributes, and `.figure > .sprite` sizes the image in CSS, which beats a
presentational hint. That holds while the image loads. It stops holding when the
image fails: a broken `<img>` carrying alt text is no longer a replaced element,
so Chromium lays it out as an inline box around the alt string and `width` does
not apply to a non-replaced inline. The box becomes as wide as the species name
— `Zorua` 48px, `Flabébé` 59px, `Hippopotas` 84px, inside a 48px figure.
`visibility: hidden` hid that box and kept every pixel of it in the flow.

## What shipped, and the fix that was reverted after it was committed

`display: inline-block`, keeping `visibility: hidden`. `width` applies to a
non-replaced inline-block, so the box gets back the dimensions the stylesheet
already specifies.

**`display: none` was committed first (`498c364`) and reverted (`cbd90c3`).** It
also returns the page to 390, and it stopped every stage beat — an element that
is not displayed runs no CSS animation, so `sprite-hit`, `sprite-sink`, the
switch-in and the recall all failed. Branch 3A of the battle-animation run made
`reviewBattle` *wait* on those beats, so that version would have left a player
whose sprite request failed waiting on an animation that could never start. The
overflow scrolls a page sideways; that would have stalled a fight.

It is recorded as rejected rather than replaced, per `CLAUDE.md`: a superseded
rule is deleted from the lineage and recorded with a dated note.

## Scope

Presentation only: one CSS declaration and one regression test. No `core/`
change, no version axis moves, `contentHash` unmoved. Account in
`../generation.md` section 31.
