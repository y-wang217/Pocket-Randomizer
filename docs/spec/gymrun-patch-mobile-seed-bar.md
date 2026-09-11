# GYMRUN Patch: the seed bar on mobile

Prompt, verbatim, as given in the session on 2026-09-11. The plan below it is
the session's report, which the prompt asked for before any code. The ruling
on that report was "yes go ahead".

## PROMPT

So, gymrum on mobile doesnt show the new seed button or the other continue buttons is this intended can we scope the patch for this? Report on the existing repo and what code determines this and where we made that decision (which release)
Then scope how to fix it.
Come up with a plan first

[screenshot: Safari on an iPhone 14 Pro Max, the starter-select screen, no seed bar, the seed stamp `GYMRUN-b022fc-SKQRAC2C` at the bottom left, build stamp `0.3.0 · R13`]

See it for yourself safari iphone 14max

yes go ahead

## The report, as given

Intended, by 4.5.2 checkpoint 6 (`8a7897d`, item F of the playtest round 2
patch). `.shell[data-phase='running'] .seedbar { display: none; }` under the
760px media query removes the bar once a run is under way, and a run is under
way from page load because `app.ts` always starts one. The phase returns to
`setup` only when the summary shows. So on a phone Start run, Copy, New seed
and Resume saved run are unreachable from the first screen until the run ends.
The 4.5.2 comment justified the rule with "during setup the seed box *is* the
screen", but keyed it off the run phase rather than the screen, and the run
phase begins before the player has chosen a starter.

The summary screen's own action row is not hidden by anything.

## The plan, as approved

1. Commit this prompt to `docs/spec/` before any work.
2. Keep the space reclaimed: on a phone during a run, the bar collapses to one
   small toggle on the drawer bar row rather than disappearing. Tapping it
   expands the full bar below, with its existing controls and handlers. No
   `core/` change, no version axis moves, no new draws.
3. Collapse again whenever a run starts, so every run begins with the space
   back.
4. A 390x844 Playwright case: the toggle is visible and tappable during a run,
   the four controls are reachable after a tap, and the move buttons still
   start inside the viewport so the 4.5.2 measurement does not regress.
5. Record the superseding rule in `docs/generation.md` with a dated note; the
   4.5.2 prompt is not edited.
6. `npm run check`, smoke, commit on the branch, stop for review.
