# Patch: the second QA pass, TM teach and held-item rollback on refresh

Filed **before any change to `src/`**, per [`README.md`](README.md) rule 7.

2026-09-30, on `claude/eager-knuth-y99w3m`.

A second QA report from the outside tester against the production deploy,
following the pass filed as
[`gymrun-patch-opening-playtest-qa.md`](gymrun-patch-opening-playtest-qa.md).
Pasted by the author with one line. Filed as it was written.

---

## The prompt, verbatim

> more playtesting feedback: Pocket Randomizer QA status — September 30, 2026
> Target: production `pocket-randomizer.vercel.app`, seed `GYMRUN-715122-KV6M6VMS`.
> Important status note
> There is no background playtest process. Browser actions run only while an active tool call is executing. When I appeared paused, testing had stopped at the party item-management screen; nothing continued unseen. The browser state is visible in the Cloud Browser surface during active calls. This report summarizes all completed work.
> What was tested
>
> * Opening starter, region, route, wild battle, event, rest, reward and party flows.
> * Refresh while wild, event and gym rewards were pending.
> * Double-clicking Pokémon, item, move, coin and continuation controls.
> * Lead selection and refresh persistence.
> * Recruiting with a full party and declining a replacement.
> * TM teaching, move replacement confirmation, refresh during teaching, and post-teaching refresh.
> * Held-item unequip to backpack and refresh persistence.
> * First gym battle, gym reward, gym completion, region transition and refresh.
>
> Passed
>
> * Pending reward choices were preserved after refresh; no reward duplication observed.
> * Double-clicking reward and continuation actions did not duplicate coins, items, Pokémon, or route steps.
> * Lead Pokémon selection now survives refresh.
> * Recruitment HP/PP preview now matched the party’s actual damaged state.
> * Garnet Gym 1 advanced exactly once to Marina Gym 2; this persisted across refresh.
> * Gym completion restored party HP/PP and advanced party levels.
> * Final checked state: Garnet marked complete, Gym 2/8, 73 coins, two level-20 Pokémon, both at full HP.
>
> Confirmed regressions
> QA-008 — TM teaching rolls back after refresh
> Severity: High — player-facing progression loss.
> Steps: Start seed; win first Bonsly battle; take Icy Wind; choose Sandile; replace Snore; verify Sandile’s moves show Icy Wind and the TM list shows `Icy Wind → Sandile`; refresh.
> Expected: Sandile retains Icy Wind, Snore is gone, and the TM remains consumed.
> Observed: After refresh Sandile has Snore again, while the Icy Wind TM returns to the TM list. Reproduced with both double-click and ordinary single-click confirmation.
> QA-009 — Held-item unequip rolls back after refresh
> Severity: Medium — inventory/equipment state loss.
> Steps: Acquire Sharp Beak; open party management; choose `To bag`; verify backpack contains Sharp Beak and Sandile has no held item; refresh.
> Expected: Sharp Beak remains in the backpack.
> Observed: After refresh the backpack is empty and Sharp Beak is re-equipped to Sandile. Double-click unequip was used; the post-refresh rollback is clear. A single-click transfer should be retested after the persistence fix.
> Lower-priority observations
>
> * The first pending-reward refresh can show recruitment before the three reward choices. The choices reappeared after recruitment, so no loss was proven; this is a substep-order inconsistency (QA-006).
> * Browser title remains `GYMRUN — Stage 1` after the map reaches Gym 2/8 (QA-007).
> * Earlier QA-003 reward-card “Carrying” wording, QA-004 Restore wording, and QA-005 starter-card layout were not rechecked in this pass.
>
> Recommended next implementation checks
>
> 1. Persist TM replacement atomically with consuming the TM; verify reload from party, map and battle entry points.
> 2. Persist held-item moves atomically; verify equip, unequip, swap, backpack and party reloads.
> 3. Add automated regression tests for every state transition that writes `runState`.
> 4. Retest normal single-click item transfer after the fix.
> 5. Continue shop purchase, TM teaching at shop/rest, and full-party replacement once the persistence bugs are fixed.
