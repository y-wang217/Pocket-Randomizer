# Stage 5.0: the author's rulings on D65 to D71, opening 5.0/3

Filed **before any change to the bible or `src/`**, per [`README.md`](README.md) rule 7.

2026-09-30, on `claude/stage-5.0-3-cards`, from `main` at `b4c8e7b` (5.0/2
merged as #78).

The author asked to prepare 5.0/3, *Reward, result, and shop cards*, of
[`gymrun-stage5.0-visual-redesign.md`](gymrun-stage5.0-visual-redesign.md). The
session put the seven rows that block it
([`../design/bible-discrepancies.md`](../design/bible-discrepancies.md), D65
to D71) to the author, each with its register recommendation, plus one
question on order. The author took every recommendation. Filed as written.

---

## The prompt, verbatim

Message 1:

> Okay let's prep for stage 3
> Five me decisions Anna suggestions

Message 2, answering the list below:

> All as recommended is fine

---

## What was put to the author, and what it rules

The list as the session gave it, one line each, with the recommendation the
author took.

| # | Row | Ruling |
|---|---|---|
| 0 | Order | **Moot by the time it was filed.** The question was whether 5.0/3 goes before 5.0/2, which was waiting on D56 to D60. 5.0/2 merged as #78 while the question was open, so 5.0/3 goes on top of it, in the plan's order. |
| 1 | D66 | **Option 1. Section 3 stands.** The face of a card at rest is its icon: the item or berry sprite, the relic's icon from the asset manifest, the boosted type chip on an item, and the price on the shop. The name and the effect line are on the long press. Coins and restore cards get section 4 rows: `+N` beside its mark, and nothing else. R2 does not move. |
| 2 | D67 | **Option 1.** A move kind (TM, tutor, technique) mounts the full move card inside the one card. Three cards sit in a row where they fit and stack where they do not. No third move face. |
| 3 | D69 | **Option 1.** No resting cursor: a card shows the selected state only after the player taps it. The claim goes through `ui/band.ts`, section 5's Confirm band row gains the result screen and the shop, and the band's cancel returns to the three cards. It never leaves the offer. |
| 4 | D65 | **Option 1.** The capability glyph sits at rest on a relic card, the same glyph as the map node's (R1). Sections 3 and 5 are amended; no rule moves. |
| 5 | D68 | **Option 1.** "Reward screen" means the result screen's card section. No new route. |
| 6 | D70 | **Option 1.** "Coverage line" means D5's two sign rows. The capture card stays outside the one card component, and D38 stays open as it is. |
| 7 | D71 | **Option 1.** No disc on a TM card: the move card is its face and already carries the type. A disc is drawn only where no move card is (the bag). |

The session added one note to D69 that the author did not contradict: the
selection is UI state only. Only the confirm reaches the run policy, so the
run log records one reward decision exactly as it does today, and
`RUN_LOG_VERSION` does not move.

Then: build 5.0/3 as amended by these rulings, recorded in
`../generation.md` §89.
