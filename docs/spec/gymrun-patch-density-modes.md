# GYMRUN Patch: Density Modes (Detailed / Simple / Pocket)

Prompt, verbatim, as given in the session on 2026-09-11. Committed before any
work, per the archival rule.

## PROMPT

GYMRUN Patch: Density Modes (Detailed / Simple / Pocket)
Paste into Claude Code after `main` has been fast forwarded to the overnight integration branch. This patch has to see the tutorial, so do not run it against a tree without it.
Presentation only. No `core/` state changes. No version axis moves.
PROMPT
You are patching GYMRUN. Read `docs/spec/pokerun-build-spec.md`, the Stage 4.5.1 prompt (Part 4 and Part 5 specifically), `src/ui/`, `src/data/tuning.ts`, `src/data/tutorial.ts`, and `docs/visual/` before writing anything.
The Simple/Detailed toggle shipped in 4.7.2 and changes something on three screens out of thirteen. That is not a wiring bug. It is the definition from Stage 4.5.1 Part 5, "Simple hides raw stat numbers in favour of relative bars," having nowhere to bite on the ten screens that carry no stat numbers. Wiring that definition into more screens produces a toggle that does nothing on ten screens more thoroughly.
This patch replaces it with a global density setting of three modes, redefined on an axis that exists on every screen, and gates that claim with a test rather than a promise.
The definition
Density is how much space and prose a fact costs, not which facts exist.

* No mode removes a fact. Every fact reachable in Detailed is reachable in Pocket.
* Detailed. Every fact on screen, zero taps, full labels and descriptions. Current behaviour.
* Simple. Every fact on screen, zero taps, reduced prose and chrome. Labels abbreviate, descriptions shorten, padding tightens.
* Pocket. Zero scroll on a 390x844 phone. Secondary facts may cost one tap through the existing tooltip layer. Primary facts stay on screen.

This axis is what makes the setting governable everywhere: a screen with no stat numbers still has prose, padding, and chrome to spend.
Part 4 still governs. Deciding a fact is secondary is a ranking, and a per field ranking is a verdict. So the omission rule is uniform across peers: all six stats collapse together or none do, all four move cards collapse together or none do. Never promote two stats and demote four. If you cannot find a uniform rule for a group, the group stays on screen and the space comes from somewhere else.
Report before you write any code. Four questions.

1. Enumerate the screens. List every screen and overlay the shell can route to, with its file. State the real count. Thirteen is my estimate from the visual bot's eleven plus the two it does not reach, and the whole coverage test below is keyed to this list, so it must be measured and not assumed.
2. Where does the current flag live and who reads it? Name the settings store field, every component that reads it, and confirm which screens it actually changes today. Confirm the Stage 4.5.1 test asserting it is unreachable from `core/` still exists and still passes.
3. Current heights. Report `docs/visual/heights.json` for every guarded screen at 390x844 on this tree, as one table. Battle was 1376 after Release C's flag strip against a 584 decision budget. I need the full table before Pocket gets per screen budgets, and the table in the patch report is the before column of the done condition.
4. Tutorial geometry. The 29 coach marks were written against Detailed. Do they position from live element geometry at runtime, or from fixed offsets? If fixed, Pocket moves every anchor and the tutorial breaks silently. Report which, before Part 5 below is built.

Stop and report all four. Do not proceed until reviewed.
Order of work:

1. The four report questions.
2. Rename to a three valued density setting, with store migration. Simple behaves exactly as today, Pocket routes to Simple as a placeholder. No layout work. Suites green, seeded output byte identical.
3. The coverage test and the Pocket height gate, both failing. Write the gates before the work that satisfies them.
4. Pocket layouts, hardest first: battle, map, party drawer, then the rest.
5. Simple mode's prose and chrome pass, so Simple is a real middle point rather than Detailed with bars.
6. Tutorial interaction.
7. Mode picker UI.

Part 1: The setting

* `verbosity: 'simple' | 'detailed'` becomes `density: 'detailed' | 'simple' | 'pocket'` in the same cross run settings store.
* Migrate existing stored values: `simple` to `simple`, `detailed` to `detailed`. A missing value defaults to `detailed`, unchanged from 4.5.1, because a new player should meet the help before knowing it exists.
* Delete the boolean rather than leaving it behind a flag or an alias. One name, one read path.
* Presentation only, still. One value, read by components. It never branches game logic, never reaches `BattleView`, never changes what `core/` produces. Extend the existing unreachable from `core/` test to the new name.
* Every number this patch introduces (per mode padding scale, per mode font scale, Pocket per screen budgets) lives in `data/tuning.ts`. A density pass should be a table edit.

Part 2: The coverage gate
This is the requirement, stated as a test rather than an intention.

* For every screen on the report's list, render it in all three modes against a fixed fixture and assert no two modes produce identical output. Three comparisons per screen, all must differ.
* The assertion is per screen and named per screen, so a failure says which screen has nothing to say in which mode rather than failing one aggregate.
* A screen that cannot justify three distinct densities is a finding, not an exemption. Report it and propose either a rule that gives it three or a reason the setting should be two valued after all. Do not add a cosmetic difference to pass the test. A one pixel padding change that no player can see is worse than an honest failure, because it converts a real gap into a green check.

Part 3: The Pocket gate

* Extend the visual bot to run every guarded screen in all three modes.
* Pocket asserts `scrollHeight <= 844` at 390 wide on every guarded screen. That is the whole definition of the mode and it is measurable, so it is a gate and not a guideline.
* Detailed and Simple keep the existing per screen budget assertions unchanged. Pocket does not relax them and does not replace them.
* Battle at 1376 is the hard case. It is roughly 530px over. Report the breakdown by region (scene, panels, flag strip, move grid, log) before cutting, so the cut is a choice between measured regions rather than a sweep.
* Where Pocket cannot fit a screen without violating the uniform omission rule from the definition, stop and report. Do not break the rule to hit the number, and do not quietly exempt the screen from the gate.
* `heights.json` grows a mode axis. Re-record it. Recording new numbers for Detailed on an unchanged tree is a bug, not a re-record, so diff it.

Part 4: What each mode does, per screen family
Build these as shared primitives in the component layer, not as per screen conditionals. If a screen needs its own density branch, that is a sign the primitive is missing.

* Stat blocks. Detailed: six stats, labels, numbers. Simple: six stats, abbreviations, numbers. Pocket: six stats as a compact bar row, numbers on tap. All six move together, per Part 4 of 4.5.1.
* Move cards. Detailed: full card, type, base power, PP, category, band, explain affordance. Simple: same facts, tighter, description on tap. Pocket: name, type, band, PP, everything else on tap. All four cards move together.
* Prose and copy. Every player facing string gets a short form alongside its long form in the same copy table it already lives in. Pocket and Simple read the short form. Do not write a second copy file.
* Chrome. Headers, section titles, padding, and margins scale by mode from `tuning.ts`. This is where most of Pocket's 530px on the battle screen should come from, before any fact moves behind a tap.
* The flag strip, the type chips, and the effectiveness markers stay in all three modes. They are the live board state exception from 4.5.1 Part 4 and they are the thing a player is reading when the screen is busiest.

Part 5: Tutorial interaction
The 29 coach marks were written against Detailed mode.

* First run forces Detailed for the duration of the tutorial, regardless of stored density. The mode picker is offered once the tutorial completes or is skipped.
* Replaying the tutorial from settings does the same: forces Detailed, restores the player's mode on exit.
* Do not write Pocket variants of 29 coach marks. If the report on question 4 says the marks position from live geometry and Pocket happens to work, say so and this becomes a one line guard anyway, because the copy was written for the Detailed layout even where the anchors survive.
* No copy change in `data/tutorial.ts` in this patch.

Part 6: Mode picker

* Reachable from the party drawer, which is shell level and therefore reaches every screen. Do not add a per screen control.
* Three options, named, with a one line factual description each. "Pocket: fits every screen without scrolling." Not "Pocket: best for small phones." State what it does, per Part 4.
* Changing mode applies immediately, on the screen the player is looking at, with no reload and no loss of run state.

Determinism and versioning

* No run log version bump. No `contentHash` change. No new draws, no new keys, no RNG.
* Seeded output byte identical, SMOKE24 included. That is a valid regression test for this entire patch, so run it at every checkpoint rather than at the end.

Tests required

1. Coverage: every screen on the report's list renders differently in all three modes, asserted per screen, three comparisons each.
2. Pocket height: every guarded screen at 390x844 in Pocket mode has `scrollHeight <= 844`.
3. Detailed and Simple budgets unchanged from the pre patch `heights.json`, per screen.
4. The density value is unreachable from `core/`, extending the 4.5.1 test to the new name.
5. Store migration: an existing `simple` and an existing `detailed` value both land on the right mode, and a missing value defaults to Detailed.
6. Mode switch mid run preserves run state and does not touch the run log.
7. Tutorial runs in Detailed regardless of stored mode, and the stored mode is restored on completion and on skip.
8. Uniform omission: for a fixture where Pocket collapses a stat block, all six stats collapse, and for one where it collapses move cards, all four collapse. Assert the group, not a member.
9. Seeded output byte identical, SMOKE24 included. All existing suites pass, except those asserting the two valued flag, updated with a comment naming this patch rather than deleted.

Definition of done
A player picks one of three named modes from the drawer, and the choice visibly changes every screen in the game. In Pocket, no screen scrolls on a 390x844 phone, including the battle screen, and every fact that was on screen in Detailed is still reachable in one tap. The tutorial still reads correctly because it runs in Detailed. `heights.json` carries a mode axis and the Detailed column has not moved.
Defaults I am taking, flagged for review

* No mode removes a fact. Pocket moves secondary facts behind a tap. The alternative, Pocket dropping facts outright, is faster to build and puts the mode straight into Part 4 territory, since deciding what to drop is a ranking.
* Tutorial forces Detailed rather than getting Pocket copy. Cheap, and it means Pocket layout work cannot silently break 29 coach marks.
* The mode picker lives in the drawer only. Same reasoning as the 4.7 drawer trigger: one shell level entry point means no screen can be forgotten.
* Simple gets a real pass in this patch rather than staying as Detailed with bars. Without it the setting is really two modes with a gap in the middle, and the coverage test would be passing on a difference nobody asked for.

Sequencing note, for you and not for Claude Code
This patch and V5 pull in opposite directions on the same axis. Pocket sets a height budget on every screen. V5 spends height composing sprites into the scene with floating panels. Both re-record `docs/visual/baseline/` and `heights.json`.
Landing Pocket first means V5 builds against a stated budget and inherits a gate it has to honour. Landing V5 first means Pocket's battle screen target moves before it is measured and the 530px figure above is wrong on arrival.
My read is Pocket first, and V5's prompt gains one line: the Pocket zero scroll assertion must still pass after the scene composes. That is the cheaper order, and it is the one where the constraint is written down before the work that would violate it.

## The rulings on the report, verbatim

Given in the session on 2026-09-11, after the report in
[`../visual/reports/patch-density-modes.md`](../visual/reports/patch-density-modes.md).
The prompt above is not edited; where a ruling below corrects it, this section
and `generation.md` section 12l are the record.

so some changes have occured since we started. here are my responses below. validate them against current state to see if anything is extraneous/wrong. don't adjust anything in the current codebase based on these instructions if they contradict. instead, flag them and report back to me Six things back to Claude Code. Four are decisions, two are corrections.
1. Amend the committed prompt. Part 3's battle figures are wrong now that V5 has landed and taken the 532px. The doc is in `docs/spec/` and future prompts read it, so a stale 1376/530px in there will mislead someone. Have it commit a correction replacing the battle paragraph with the real hard-case table: pre-gym 2608, summary 3741, party 1638. Also strike the sequencing note at the bottom, since Pocket-before-V5 is moot.
2. Coverage test in a browser: yes. DOM identical across modes is exactly what 4.7.2 built, so comparing DOM would assert nothing. Computed styles or rendered screenshots, its call, but it has to be a browser.
3. Fixture: worst case per screen, not one global fixture. Six-member party is right for party and pre-gym. Summary's worst case is eight gyms cleared with a full graveyard, and the drawer's is a full backpack. One shared fixture will under-measure at least two screens, and Pocket is a gate on the worst case or it is nothing.
4. Split the Pocket gate in two. Summary at 3741 cannot reach zero scroll without gutting it, and gutting a post-run artifact the player reads and shares is the wrong trade. My recommendation:

* Decision surfaces (battle, map, starter, pre-gym, result, shop, event, reward, party, target, locale): zero scroll, hard gate, no exemptions.
* Archive surfaces (summary, log sheet, graveyard): the first screenful holds the complete outcome, everything below it may scroll.

That keeps the gate honest and still testable. Pre-gym stays on the hard side and has to fit at six members, which is the real work in this patch.
5. The two screens without three honest densities: let them be two. Twelve of fourteen is "nearly every page," and a manufactured difference on the log sheet is exactly the cosmetic pass the prompt forbids. Have it record both as documented exemptions with the measured reason, in the report, not as a silent skip in the test.
6. Tutorial: per screen, not per run. Force Detailed only on a screen that still has unseen marks, and release that screen to the player's mode once its marks are done. "Until every screen is seen or Skip is pressed" means a Pocket player spends their entire first run in Detailed and never sees the mode they picked. The finding that matters here is the one it found on its own: a mark whose anchor is behind a tap gets dropped with no trace. Ask it to add an assertion that no mark is ever silently dropped, so the guard failing is loud rather than invisible.
Nothing else is blocking. Heights matching `heights.json` to the pixel and the tutorial resolving anchors from live geometry are both clean results.

## The validation of the rulings, and the answers

The session's validation, item by item, followed by the ruling on each.

1. Editing the prompt contradicts `CLAUDE.md` and protocol rule 4 ("do not edit
   the prompt; record the deviation in `docs/generation.md`"). Offered instead:
   this appendix, verbatim, plus a dated `generation.md` note carrying the
   correction. **Ruling: yes, both.**
2. Browser coverage test: consistent. **Ruling: good.**
3. Worst case per screen: consistent, one correction. The drawer does not show
   the backpack (its view is party, held items, relics, tuning); its worst case
   is six members each holding an item plus the maximum relic count. The full
   backpack is the party screen's worst case. Feasibility note: the gallery's
   rule is "played rather than fabricated" and a summary with eight gyms
   cleared and a full graveyard may not exist as a played seed; if none is
   found the fixture is constructed state, recorded as a deviation.
   **Ruling: sure.**
4. Split gate: consistent in principle, three list errors. "reward" is not a
   screen (cards render inside `result` since 4.5.2). "replace" was missing
   and belongs on the hard side. "graveyard" is a section inside `summary`,
   so the archive side is summary and the log sheet. The drawer was on
   neither side; proposed hard side, gated on the sheet's own scroll extent.
   "First screenful holds the complete outcome" proposed as: the outcome
   block's bottom edge at or above 844, named per archive screen.
   **Ruling: okay, go with the proposal.**
5. Two-valued exemptions: consistent. To keep it loud, the test asserts the
   exemption rather than omitting it: log sheet and target differ Detailed
   against the other two and are identical Simple against Pocket.
   **Ruling: okay.**
6. Per-screen tutorial guard: consistent, two build notes. Detailed must be
   applied before `showFor` resolves anchors, since the visibility check reads
   computed style. "Never silently dropped" needs the worst-case fixture from
   item 3, because three marks are conditional by design (`relics`, `capture`,
   `coverage`) and `seed` has two anchors on purpose; on that fixture every
   screen shows exactly its mark count. **Ruling: yes.**
