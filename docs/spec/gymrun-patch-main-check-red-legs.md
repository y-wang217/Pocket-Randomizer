# Patch prompt: the two red legs on `main`'s `check` workflow

**Filed 2026-09-18, and filed late.** `CLAUDE.md` says every prompt is
committed here verbatim *before* any work begins on it, and on this one the
first message was acted on before it was filed. The register already carries a
precedent for saying so rather than quietly back-dating
(`6ce30fb`, "File the sprite patch in the register, after the fact and saying
so"), and this is that. The second message below arrived mid-session and
re-ordered the work; both are reproduced as received, in order, with nothing
edited, including the parts the session then failed to satisfy.

Record of what was built: [`../generation.md`](../generation.md) section 47.

---

## Message 1

> Fix the two failures on main's `check` workflow. Do not change the branch
> under test, fix main.
>
> 1. `test/visual-chips.test.ts:379` fails on the Ghost type chip at 4.43:1 on
>    `party (gallery, loaded)`, text rgb(165,144,175) on sampled background
>    rgb(46,50,54). Find the Ghost entry in the type colour table under
>    `src/data/`. Lift it so the ratio clears `displayTuning.minChipContrastRatio`
>    on that surface with at least 0.1 of margin, since the sampler quantises the
>    background to 4-value steps. Do not change the floor, the gallery chrome, or
>    any other type's colour. Report the new ratio on every surface Ghost
>    renders. This moves contentHash if the colour table sits in `src/data/`; say
>    so.
> 2. `test:node` exits 1 with `[vitest-worker]: Timeout calling "onTaskUpdate"`
>    while 1650/1650 pass. First, report the runner core count and the current
>    pool and worker settings. Then cap workers in CI only and re-run the leg
>    three times. Report whether the error reproduces at the cap. Separately,
>    make `scripts/check.mjs` report an unhandled runner error as its own status
>    distinct from test failures, so the table stops saying FAILED for a green
>    suite.
>
> Do not touch the webkit leg. Determinism, stream isolation, version guards and
> seeded output must be byte identical apart from contentHash if item 1 moves
> it.

## Message 2

> don't worry. we have more context now and here are added instructions.
> consolidate the two Ruling on order: instrument first, then colours. Before any
> colour change, make chipsOn wait until every image on the page reports complete
> and skip chips whose trimmed text is empty, then re-run the chromium leg.
> Report which failures survive. Expect Ghost and Dark on party (gallery, loaded)
> to survive and the three 1.32:1 rows to vanish; if the split comes out
> differently, stop and report.
>
> Separately, take test:webkit out of the check workflow entirely. Create a
> non-blocking webkit workflow with a weekly cron, workflow_dispatch, and a PR
> paths trigger on the motion CSS, sprite code, and test/visual-motion*.test.ts.
> Cache ~/.cache/ms-playwright keyed on the Playwright version. On failure it
> updates one pinned issue, never a deploy status. Report the first-run install
> time with and without the cache.

---

## Three premises in message 1 that did not hold, recorded rather than corrected

Protocol 4 forbids editing a prompt to match what was found. These are named
here, outside the quoted text, so that a reader of the register is not sent
looking for things that do not exist.

1. **"the type colour table under `src/data/`."** It is not there. The
   eighteen type colours plus Stellar live in `src/ui/theme/tokens.css`, and
   they have since the move recorded in that file's own comment. Nothing in
   `src/data/` carries a hue.
2. **"This moves contentHash if the colour table sits in `src/data/`."** It
   does not sit there, so it does not move it. `contentHash` is a glob over
   `src/data/**` minus one exclusion list and is unmoved at `b8b419` — checked
   by running `npm run content-hash` on both sides of the edit, not by reading
   the glob.
3. **"`test:node` exits 1."** On run 21 — the run the failure was reported
   from — the leg that exits 1 on the reporter timeout is `trim:node`, inside
   the `strict trim` job; the `unit` job passed. The distinction does not change
   the diagnosis or the fix, both of which are about the Node half generally,
   and it does change where a reader should look in the log.

## What message 2 asked for and did not get

The chromium re-run cannot produce the split it predicts on the machine this
session had. See [`../generation.md`](../generation.md) section 47.4: this
container cannot reach the sprite CDN at all, so the instrument fix has nothing
to bite on here and the leg is green with and without it. Per the prompt's own
stop condition, the colour work stops at that line.

The three CI runs of the capped Node leg and both WebKit install timings are
likewise unmeasured, for the same reason in a different shape: `check.yml`
fires on `push` to `main` and on `pull_request`, and `workflow_dispatch` is only
offered for a workflow that is already on the default branch. Section 47.7 and
47.8.
