# Stage 5.0: the author's rulings on D50 and D52 to D55

Filed **before any change to the bible or `src/`**, per [`README.md`](README.md) rule 7.

2026-09-30, on `claude/hopeful-shannon-kch3gw`.

The author's answer to the 5.0/0 report
([`../visual/reports/5.0-stage0-spike.md`](../visual/reports/5.0-stage0-spike.md)),
which listed D50 and D52 to D55 as blocking 5.0/1. Each line answers one row, in
the report's order. Filed as written.

---

## The prompt, verbatim

> d50 playtests are done. i did a full successful playthrough. i've also been doing playtest runs via chatgpt and given feedback.
> yes, long press to inspect
> change bible to open screens
> add mid-run run info screen
> no problem. big visual update is what makes changes like this
> keep run progress as a continuation of recent decisions made. this is a new feature, built on top of the battle log, and should include all player decisions as just a replay (we already record the replay play by play)
>
> write down these decisions in the repo
> Any other blockers?

---

## How each line reads against the register

| Line | Row | Reading |
|---|---|---|
| 1 | D50 | The validation cycle R6 waits for is ruled done: the author's full playthrough, plus the ChatGPT-driven QA passes already filed as [`gymrun-patch-opening-playtest-qa.md`](gymrun-patch-opening-playtest-qa.md) and [`gymrun-patch-qa-persistence-pass.md`](gymrun-patch-qa-persistence-pass.md). R6's disconfirmer did not fire. Simple and Detailed retire; Pocket is the one face. |
| 2 | D52 | Option 1. Inspect stays the long press; every "tap to inspect" in the plan means the long press. Tap selects. |
| 3 | D53 | The nav tabs open screens, not overlays, and the bible says so. |
| 4 | D53 | A mid-run Run Info screen is built. |
| 5 | D54 | Option 1. A section 4 Shell row for the tab words, and a thirteenth family, `currency`. |
| 6 | D55 | Run Progress is the player's decisions, replayed from the run log in play order and continuing as the run goes: a new feature. It replaces the plan's separate Recent Events. |
