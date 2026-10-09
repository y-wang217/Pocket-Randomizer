# Patch: card battle opening grace, Blast friendly fire, new enemies, scenarios, colour coding, unit filter

2026-10-09, on `claude/vibrant-hopper-axlk79` (the session's designated branch;
the prompt names `claude/wizardly-cannon-l8fktg`, and this branch starts at that
branch's head, `6afdaa8`, the `cards-0.3.0` work). Filed **before any work**,
verbatim, as [`README.md`](README.md) rule 7 asks.

The card battler is outside the design bible by the author's ruling
([`gymrun-card-battle-engine-rulings.md`](gymrun-card-battle-engine-rulings.md)).
Part A is built; Parts B to G are queued and not begun.

---

## The message, verbatim

> here's a new patch so we can update # Patch: card battle opening grace, Blast friendly fire, new enemies, scenarios, colour coding, unit filter
>
> For Claude Code, on the Pocket-Randomizer repo. 2026-10-09. Amended the same day after the 7-deep board, placement and seeded spawns landed as `cards-0.3.0`.
>
> ## Read first
>
> - Work on branch `claude/wizardly-cannon-l8fktg`, on top of the `cards-0.3.0` work you just pushed (7-deep board, placement phase with `place` and `start`, seeded or fixed enemy spawns, scenario list with Skirmish, Front line, Staggered).
> - **File this prompt verbatim** in `docs/spec/` before any work (README rule 7), with a register row.
> - **What already shipped stands.** Where this prompt and the `cards-0.3.0` code disagree on placement, spawns, log action shapes or the scenario format, the shipped code wins. Do not rework it.
> - **The bot waits until this patch is merged.** Grace, Fast, friendly fire and the new enemies all change how scenarios play, so a bot tuned before them would be re-measured immediately. It is Part B below, next in line.
> - This patch moves rules again: engine version to `cards-0.4.0`, older logs refused as before.
> - The design doc for this work (v0.3) lives in Claude project knowledge, not the repo. Everything you need is in this prompt. Do not go looking for it.
> - The card battler is outside the design bible by ruling (`gymrun-card-battle-engine-rulings.md`). Card data stays in `src/cardData/` so `contentHash` cannot move. No run seed, run stream or run version axis is touched.
> - Every rule number goes in `src/cardData/rules.ts`. Every player-facing word goes in `src/cardData/copy.ts`. **No em dashes in any player-facing string.**
> - **Do not invent cards or classes.** The puppeteer deck is unchanged in this patch. If a task seems to need a new card, stop and ask.
>
> ## Part A: build now
>
> Checkpoint per item, one commit or more each, tests green at every checkpoint. Stop after A8 and report.
>
> Already done in `cards-0.3.0`, not repeated here: the 7-deep board, the placement phase, seeded spawns, the scenario list.
>
> ### A1. Opening grace and Fast
>
> - **Grace:** when the player presses Start and enemies take their opening step, a normal enemy's starting step is rolled only among steps whose act deals no damage (`nothing` or `Shield`). A conditional act that can deal damage counts as damage.
> - **Fast:** new `fast: true` flag on `EnemyDef`. A Fast enemy starts on its first damaging step instead of rolling. Fast enemies are designed to hit for 1.
> - Data validation: a non-Fast enemy with no non-damage step fails a test, naming the enemy.
> - Keep the rule switchable in `rules.ts` (`openingGrace: true`) so it can be measured off.
> - Grace must not change the placement phase: placing still draws no randomness, and spawns are drawn exactly as in `cards-0.3.0`.
> - Test: over 500 seeds of every scenario, Skirmish included, no non-Fast enemy telegraphs damage in round 1.
>
> ### A2. Blast hurts allies
>
> - Player Blast (Fire!, Artillery) damages every player unit on its tiles, through shield, base shield, HP, as for enemies. Strike, Pierce and Slash still never hit allies.
> - **The caster is exempt from its own Blast** by default. Make it a `rules.ts` switch (`blastFriendlyFire: 'alliesExceptCaster' | 'allies' | 'none'`) so the open ruling flips in one line.
> - Legality is unchanged: a damage card still needs at least one enemy on its tiles.
> - Preview: while aiming, any ally on the Blast's tiles shows a warning outline and the damage it would take. An ally fainting from friendly fire faints normally, cards and all.
>
> ### A3. New enemies and difficulty grades
>
> Add to `src/cardData/enemies.ts`, built only from the existing vocabulary. New field `grade` on `EnemyDef` (provisional numbers, all of them).
>
> | id | HP / base | fast | steps (move / act) | grade |
> | --- | --- | --- | --- | --- |
> | drone | 3 / 1 | no | unchanged | 2 |
> | lancer | 2 / 0 | no | unchanged | 1 |
> | hound | 2 / 0 | yes | hunt / Strike 1 · advance / nothing | 1 |
> | turret | 4 / 1 | no | stay / Shield 1 · stay / Strike 2 · stay / nothing | 2 |
> | bulwark | 4 / 2 | no | advance / Shield 2 · if slash in range: stay / Slash 1, else hunt / Shield 1 · stay / nothing | 2 |
> | sniper | 2 / 0 | no | hunt / nothing · stay / nothing · stay / Strike 3 | 3 |
> | pikeman | 3 / 1 | no | stay / Shield 1 · hunt / nothing · stay / nothing · stay / Pierce 2 | 3 |
>
> If the script types cannot express Bulwark's conditional with Shield as the else-act, stop and report rather than widening the vocabulary.
>
> Each new enemy needs a sprite or a placeholder through the existing card-battle asset manifest.
>
> ### A4. Four more scenarios
>
> Add these to the existing scenario list, in the shipped scenario format, alongside Skirmish, Front line and Staggered. Spawn order as listed (it sets e0, e1, ... and act order). All spawns fixed. Coordinates are engine `L{lane}C{col}`, column 1 the player's back edge, column 7 the enemy's. Default unit tiles L1C2, L2C2, L3C2; placement changes them.
>
> | id | Enemies in spawn order | Grade total |
> | --- | --- | --- |
> | turret-alley | turret L1C7, hound L2C6, turret L3C7 | 5 |
> | wall-and-gun | bulwark L1C6, sniper L2C7, bulwark L3C6 | 7 |
> | the-pack | hound L1C6, hound L2C6, hound L3C6, pikeman L2C7 | 6 |
>
> - Give each a short display name: Turret Alley, Wall and Gun, The Pack.
> - The scenario list shows each scenario's grade total. For a seeded-spawn scenario the total is still known, since the enemy set is fixed and only tiles are seeded.
> - Narrate prints the grade total in its summary.
> - Existing scenarios keep their ids and layouts; they only gain grade totals.
>
> ### A5. Colour coding
>
> Use the existing tokens in `sandbox.css` and add a grey.
>
> | Thing | Colour |
> | --- | --- |
> | Commander (A), its unit panel, token ring and cards | `--cb-teal` |
> | Gunner (B) | `--cb-blue` |
> | Sword dasher (C) | `--cb-purple` |
> | Neutral cards | new `--cb-grey` |
> | Enemies and their telegraphs | `--cb-red` family; telegraphs stay hatched with the enemy number chip |
> | Zones | keep the existing solid fills: home pale cool, danger pale amber, enemy home pale red |
> | Fast badge | on the enemy token and its roster panel |
>
> - Each card shows its owner colour as its frame plus the owner letter, so colour is never the only signal. Neutral shows a grey frame and no letter.
> - Zones solid, telegraphs hatched, never the other way round.
> - Text on every coloured surface passes 4.5:1 contrast. Report any that does not.
>
> ### A6. Unit filter (provisional)
>
> - Tap a unit panel or token: the hand shows only cards that unit can play right now (its own plus neutrals). The rest collapse into one "+N other" chip.
> - A visible chip reads "Showing B · Show all". Tapping it, tapping the same unit again, or End Turn clears the filter.
> - Selecting a filtered unit's card skips the "Pick who plays it" step when the filter already names the unit.
> - No change to the engine or log. This is presentation only.
>
> ### A7. Communication
>
> Every rule new in this patch is shown three ways: a board marker, an Inspect entry, and a narrate log line.
>
> | Rule | Board | Inspect copy (draft, keep in copy.ts) | Narrate line |
> | --- | --- | --- | --- |
> | Grace | Round 1 intent strip notes enemies are getting into position | "Round 1: most enemies set up instead of attacking." | `grace: e1 starts on a setup step` |
> | Fast | Fast badge | "Fast: attacks from round 1, for 1." | `e1 Hound is Fast: starts on an attack step` |
> | Blast ally damage | Warning outline plus damage on allies while aiming | "Blast hits allies on its tiles too. Not the unit that plays it." | `B Gunner takes 1 from Fire! (friendly fire)` |
>
> ### A8. Docs and report
>
> - Update `docs/handoff/card-battle-log-reading.md` for `cards-0.4.0`: new enemies with grades and the Fast flag (section 3), grace and friendly fire (section 4), the three new scenarios and grade totals (section 8), and move delivered items out of section 9. Keep the board diagram the way the phone shows it. Replace the worked example with a fresh `cards:narrate` run on a `cards-0.4.0` log if one is easy to produce, otherwise keep the old one with its version note.
> - Report: tests and check status (the two known environmental vitest RPC timeouts are not new), main-chunk delta, measured board height at 390x844, `contentHash` unmoved, starting-step distribution under grace for each enemy, and one bot-free note per scenario on whether it can be won at all (a random-bot win rate over 200 seeds is enough).
>
> ## Parts B to G: queued, do not start
>
> Each needs its own go-ahead and some need rulings first. Listed in build order.
>
> - **B. Bot.** As you proposed after `cards-0.3.0`, now measured on `cards-0.4.0`: a defensive bot following the author's rules (tanky units in front of fragile ones, keep everyone alive), then many seeds per scenario keeping the placements and positions that win most, reporting wins, units kept alive and rounds per scenario. Stamp every figure with seed prefix and seed count. Its per-scenario numbers are what corrects the provisional enemy grades.
> - **C. Waves.** A fight of several waves. On a new wave base shields restore and card shields clear; HP persists; fainted units stay fainted. Grace opens every wave. Open rulings: MP carry (default carry, cap 5), full reshuffle (default yes), re-place units (default yes). A three-wave scenario ending in Part D's boss.
> - **D. Boss Colossus and Harpoon.** Multi-tile enemy (2x2), up to 3 moves per round, script hunt x3 / Crush 2 (Pierce both lanes) · advance x3 to C3 / Stomp 1 (Slash every lane) · stay / Shield 3. HP 12, base 3, grade 10. Harpoon: granted into hand at spawn, Retain (holds one of the 5 hand places), 2 MP, any unit, Target boss: Pinned next round (0 moves) and shield to 0. Open rulings: area hits per card or per tile; whether Pinned makes area cards hit per tile.
> - **E. Full reskin at 3x7.** Felt-table look, enemy roster strip on top, unit panels below the board. Waits on art redrawn at 3x7. The reference mock must keep enemy shields, MP numbers, telegraph enemy chips and card owner letters, and its "Balatro" header text cannot ship.
> - **F. Card rewards.** Waits on the author's class and card design session. Decks stay small; the author leans to pure swaps over add-and-cut.
> - **G. Mini campaign.** Into the Breach style, the three base classes only. Destinations: City (heal, upgrade), Wilds (resources), Small town (quests that win cards). Waits on the campaign design session.
