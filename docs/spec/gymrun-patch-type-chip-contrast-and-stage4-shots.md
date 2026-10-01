# Patch: the type chips back over the contrast floor, and 5.0/4's report screenshots

Filed **before any work**, per [`README.md`](README.md) rule 7.

2026-10-01, on `claude/loving-darwin-lpx2r4`, restarted from `main` at
`2853ef7` after #80 (5.0/4) merged.

---

## The exchange, verbatim

The session, reporting on #80 after it merged:

> CI on the merged head: red in two jobs, the Chromium browser suite and strict
> trim. Both fail on one test: six type chips under the 4.5:1 contrast floor, on
> the map heading, the summary and the party screen. This isn't from #80. #79
> failed with the identical six chips at identical ratios before #80 merged, so
> `main` has been red since 5.0/3. [...] One gap in what merged: the 5.0/4
> report lists eight screenshots in `docs/visual/reports/5.0-stage4/`, but I
> never committed them. The folder doesn't exist on `main`. Since #80 is
> merged, any follow-up is a new PR off `main`. I'd do both in one: 1. Lift the
> six type chips over the contrast floor so `main` goes green. 2. Add the
> missing report screenshots. Should I go ahead?

The author:

> go ahead, open pr when done

---

## The failure being fixed

`test/visual-chips.test.ts`, *the chip legibility floor > renders the type chip
at or above the contrast floor on every surface*, on CI for #79's head and for
#80's merged head, identically:

| Surface | Type | Ratio | Text on fill |
|---|---|---:|---|
| map | Rock | 3.91 | rgb(90,87,50) on rgb(186,190,182) |
| summary | Steel | 4.03 | rgb(91,95,111) on rgb(202,206,218) |
| summary | Bug | 4.34 | rgb(84,96,39) on rgb(198,210,190) |
| summary | Ground | 3.9 | rgb(108,99,69) on rgb(206,210,202) |
| summary | Grass | 4.14 | rgb(66,102,59) on rgb(190,210,198) |
| party (gallery, loaded) | Electric | 4.38 | rgb(116,105,46) on rgb(230,230,214) |

The floor is `displayTuning.minChipContrastRatio`, 4.5. The fix may not lower
it: a floor moved to make a miss disappear is what CLAUDE.md forbids for
targets, and this is a legibility gate.
