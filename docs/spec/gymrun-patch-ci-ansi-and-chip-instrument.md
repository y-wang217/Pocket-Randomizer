# GYMRUN patch: the gate runner's ANSI blindness, and a chip sampler that answers

Filed 2026-10-04 on `claude/sleepy-mccarthy-crfmqt`, before any work, under
protocol 1 and 7 of [`README.md`](README.md).

## The brief, verbatim

> continue the work from this response's description, asking me for places where it isn't clear

## What "this response's description" named

The brief continues a prior response rather than describing work of its own, so
the two items it points at are recorded here. Both were reported on
[`gymrun-patch-bench-carryover-and-gym-levels.md`](gymrun-patch-bench-carryover-and-gym-levels.md)
after that patch merged as PR #49, as the things left red on `main`:

> **Two things are still open on `main`, and neither came from this patch:**
>
> 1. **The `visual-chips` contrast failure** — red on chromium, WebKit and both strict-trim legs, byte-identical before and after this merge. A real assertion failing on real chips (`1.32:1` on a full-health bar fill, `4.36:1` on a battle flag word). This is the one I'd prioritise: it's a genuine accessibility miss that only shows up in the container, and the sprites-loaded hypothesis is untested.
> 2. **`check.mjs`'s reporter-timeout tolerance is ANSI-blind** — one line, already verified, unblocks every PR in the repo rather than just one.

## Three claims in that description are wrong, and the brief is what caught them

The brief's "asking me for places where it isn't clear" produced a log read
before any code, and the log refuted the description above on three points.
Recorded here rather than by editing it, under protocol 4 — and recorded in the
prompt rather than only in `generation.md` because the brief's whole instruction
was to find the unclear places, so what that instruction found is part of what
was asked.

Run #9 on `main` (`379c154`), jobs `browser suite (chromium)`,
`browser suite (webkit)` and `strict trim`:

| screen | chip | ratio | on |
|---|---|---|---|
| `party (gallery, loaded)` | `"Ghost"` | 4.43:1 | rgb(46,50,54) |
| `party (gallery, loaded)` | `"Dark"` | 4.21:1 | rgb(46,50,54) |
| `party (gallery, loaded)` | `""` *(empty)* | 1.32:1 | rgb(62,186,82) |
| `party (gallery, loaded)` | `"◎100"` | 1.32:1 | rgb(62,186,82) |
| `party (gallery, loaded)` | `"✦10%"` | 1.32:1 | rgb(62,186,82) |
| `battle` *(WebKit only)* | `"Not very effective"` | 4.36:1 | rgb(70,82,58) |

1. **"byte-identical before and after this merge" was true of the wrong axis.**
   The comparison that holds is one engine's leg across `main` and the PR. The
   claim as written says chromium and WebKit agree, and they do not: they fail
   on different screens, with different chips, against different backgrounds.
2. **"a genuine accessibility miss" is true of three of the six, not all six.**
   The 1.32:1 group is an instrument fault — see below.
3. **"the sprites-loaded hypothesis" named a variant that does not exist.**
   `test/visual-chips.test.ts` has no sprites-loaded axis; its `VARIANTS` loop is
   over `chip--*` classes. What the hypothesis was reaching for is real but is a
   *leg*: the gallery harness at `:325-336`, which opens
   `gallery.html#seed=S49B-1&screen=party&fixture=loaded`.

## The two defects this patch fixes

**1. `scripts/check.mjs` cannot recognise a passing suite under colour.** The
tolerance filed at section 33 of [`../generation.md`](../generation.md) matches
`/Test Files\s+\d+ passed \(\d+\)/` against output vitest colours whenever `CI`
is set, TTY or not. The escape sequences land where the regex expects
whitespace, so the tolerance has never once fired. Same flaw in `tally()`.

**2. `test/visual-chips.test.ts` reads pixels that no longer belong to the box
it measured.** `chipsOn` reads every chip's `getBoundingClientRect`, then takes
a `fullPage` screenshot. Sprites load from Showdown's CDN
(`src/ui/sprites.ts:5`), so the layout can shift between those two passes, and
the boxes then index whatever moved into place. Three signs say instrument
rather than chip: one failing sample has **empty text**, so a text-contrast
floor has no glyphs to measure; all three report a **solid HP-bar fill**
(`--hp-high: #3fb950`) as background, which a chip's own translucent fill should
always dominate within its own box; and the failures appear only where the CDN
is reachable. The test's own comment at `:116-127` records this same 1.32:1
signature from the previous wrong-pixel defect: *"An instrument that reads the
wrong pixels does not fail; it answers."*

## The three answers, verbatim

Asked 2026-09-18 before any code, on the brief's own instruction to ask.

**Q1 — which of these should I take on in this patch?**

> check.mjs ANSI fix (Recommended), Chip-sampler instrument fix (Recommended)

So the three genuine near-misses — `"Ghost"` 4.43, `"Dark"` 4.21 and
`"Not very effective"` 4.36 — are **out of scope and stay red.**

**Q2 — the chip suite loads sprites from Showdown's CDN, which is why it passes
in a sandbox and fails in CI. How should I handle that?**

> Make the suite hermetic (Recommended)

**Q3 — for the genuine near-misses, which way do you want contrast raised?**

> Decide after the instrument is fixed (Recommended)

## Constraints

- **This patch does not turn CI green, and is not expected to.** Six chip
  failures become three; the node leg goes green. The three real near-misses
  remain by the answer to Q1.
- `src/data/displayTuning.ts` is not touched. Lowering `minChipContrastRatio` to
  make a miss disappear is forbidden by `CLAUDE.md` under gates and balance.
- No version axis moves. Nothing under `src/data/**` changes, so `contentHash`
  must hold; `RUN_LOG_VERSION`, `RANDOMIZER_VERSION` and `AI_VERSION` are
  untouched.
- `src/` is not changed at all. Both defects are in the gate runner and the test
  instrument.
- No baseline is re-recorded. The sprite stub is scoped to
  `test/visual-chips.test.ts` so that `docs/visual/baseline/` and `heights.json`
  keep their meaning.
