# GYMRUN Presentation Milestones: the working checklist

Companion to [`design-bible.md`](design-bible.md). Release 4.10.

The document itself is
[`../spec/gymrun-presentation-milestones.md`](../spec/gymrun-presentation-milestones.md),
verbatim, which is the record. This file is the working copy: the same items,
with their status, their branch and the discrepancy rows that block them. It
changes constantly; the record never does.

Same relationship `docs/visual/OVERNIGHT.md` has with its spec copy.

## How 4.10 is built

`claude/visual-revamp-jb20na` is the 4.10 trunk, cut from `main` at `e16decd`.
One sub-branch per item, `visual/4.10-<item>`, merged back with a merge commit
and no squash, so any single item is reverted by reverting its merge. One pull
request at the end. See D13 in
[`bible-discrepancies.md`](bible-discrepancies.md) for why that is compatible
with the record's "one item, one PR" rule.

## The bible wins, and blocked items wait

Every conflict between an item and the bible is a row in
[`bible-discrepancies.md`](bible-discrepancies.md). **An item with an unruled
row against it is not built.** Rulings land as amendments to the bible under its
section 10, or as deviation notes in `docs/generation.md`, never as an item
quietly doing something else.

## Status

`blocked` means a discrepancy row is waiting on a ruling. `ready` means nothing
is in its way. `open` means it is ready but its tier is not.

### Tier 0: measure before touching anything

| Item | Status | Blocked by |
|---|---|---|
| M0.1 Text census | blocked | D1 (budgets vs counting rule), D2 (census unit) |
| M0.2 Glyph and mechanism inventory | ready | — |
| M0.3 Close the verdict-copy violations | blocked | D3 (six, not four) |

### Tier 1: foundations

| Item | Status | Blocked by |
|---|---|---|
| M1.1 Glyph sheet | open | — |
| M1.2 One inspect layer | blocked | D4 (acceptance narrower than R5) |
| M1.3 Exposure store | open | — |

### Tier 2: the move card

| Item | Status | Blocked by |
|---|---|---|
| M2.1 Move card face | open | — |
| M2.2 Battle move button | blocked | D9 (two move-button faces vs R6) |
| M2.3 Move chip | open | — |

### Tier 3: panels and party

| Item | Status | Blocked by |
|---|---|---|
| M3.1 Pokemon battle panel | blocked | D6 (chevron missing from the canon) |
| M3.2 Stat block and party row | open | — |
| M3.3 Teach target screen | blocked | D1 (the decline overlay's figure) |

### Tier 4: battle feedback

| Item | Status | Blocked by |
|---|---|---|
| M4.1 Flag precedence | blocked | D12 (`contentHash`) |
| M4.2 Forecast and feedback vocabulary | open | — |
| M4.3 Log at rest | blocked | D7 (the flag strip has no budget row) |

### Tier 5: remaining surfaces

| Item | Status | Blocked by |
|---|---|---|
| M5.1 Reward, shop and TM shelf cards | blocked | D12 (`contentHash`) |
| M5.2 Map node card | open | — |
| M5.3 Locale card and pre-gym screen | blocked | D1 |
| M5.4 Result screen and capture card | blocked | D1, D5 (a tenth glyph family) |
| M5.5 Confirm overlays | blocked | D1 |
| M5.6 Event screen | blocked | D8 (a remedy reserved for amendment) |

### Tier 6: onboarding and density

| Item | Status | Blocked by |
|---|---|---|
| M6.1 Exposure labels | blocked | D5, D12 |
| M6.2 Coach marks re-anchored | blocked | D10 (ordered against section 7) |
| M6.3 Pocket default | open | — |
| M6.4 Retire Simple and Detailed | blocked | D11 (one cycle or two rounds) |

### Tier 7: validation

| Item | Status | Blocked by |
|---|---|---|
| M7.1 Playtest protocol | open | — |
| M7.2 Post-census | open | — |

## What the record says that this file does not repeat

The item text, the done-when and the kills-it for every row above. Read them
from the record before building. Where this file and the record disagree on what
an item asks for, the record is right; where they disagree on whether it is
built, this file is.
