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

**Eleven of the thirteen discrepancy rows were ruled 2026-09-19** and the bible
went to Rev 2. **D2 and D8 are open**, and they are the only things blocking
anything: D2 holds M0.1, and with it the whole list, because no tier closes
without a census. D8 holds M5.6 alone.

**M0.2 is shipped**, and [`inventory.md`](inventory.md) section 4 carries four
findings the items downstream depend on: M1.1 is smaller than it reads (band and
status need no glyph, type has a drawn set already, category has none), M2.1 has
two R3 collisions to resolve before it mounts anything, and M4.1 has a
vocabulary collision that would cost four facts if it is walked into.

### Tier 0: measure before touching anything

| Item | Status | Blocked by |
|---|---|---|
| M0.1 Text census | blocked | D2 (census unit) |
| M0.2 Glyph and mechanism inventory | **done** | — ([`inventory.md`](inventory.md), `visual/4.10-m0.2`) |
| M0.3 Close the verdict-copy violations | ready | — (D3 ruled: six lines, no allowlist) |

### Tier 1: foundations

| Item | Status | Blocked by |
|---|---|---|
| M1.1 Glyph sheet | open | — |
| M1.2 One inspect layer | open | — (D4 ruled: 17 mount points) |
| M1.3 Exposure store | open | — |

### Tier 2: the move card

| Item | Status | Blocked by |
|---|---|---|
| M2.1 Move card face | open | — |
| M2.2 Battle move button | open | — (D9 ruled: build 2x2, re-measure, rule with the number) |
| M2.3 Move chip | open | — |

### Tier 3: panels and party

| Item | Status | Blocked by |
|---|---|---|
| M3.1 Pokemon battle panel | open | — (D6 ruled) |
| M3.2 Stat block and party row | open | — |
| M3.3 Teach target screen | open | — (D1 ruled: at or under 4) |

### Tier 4: battle feedback

| Item | Status | Blocked by |
|---|---|---|
| M4.1 Flag precedence | open | — (D12 ruled: per-file split) |
| M4.2 Forecast and feedback vocabulary | open | — |
| M4.3 Log at rest | open | — (D7 ruled: the strip has its own row) |

### Tier 5: remaining surfaces

| Item | Status | Blocked by |
|---|---|---|
| M5.1 Reward, shop and TM shelf cards | open | — (D12 ruled) |
| M5.2 Map node card | open | — |
| M5.3 Locale card and pre-gym screen | open | — (D1 ruled) |
| M5.4 Result screen and capture card | open | — (D1, D5 ruled: no label line) |
| M5.5 Confirm overlays | open | — (D1 ruled) |
| M5.6 Event screen | **blocked** | D8 (a remedy reserved for amendment) |

### Tier 6: onboarding and density

Order confirmed by D10: M6.2 re-anchors the coach marks **before** M6.3 flips the
default, and section 7 was amended to say so.

| Item | Status | Blocked by |
|---|---|---|
| M6.1 Exposure labels | open | — (D5, D12 ruled) |
| M6.2 Coach marks re-anchored | open | — |
| M6.3 Pocket default | open | — |
| M6.4 Retire Simple and Detailed | open | — (D11 ruled: two rounds) |

### Tier 7: validation

| Item | Status | Blocked by |
|---|---|---|
| M7.1 Playtest protocol | open | — |
| M7.2 Post-census | open | — |

## What the record says that this file does not repeat

The item text, the done-when and the kills-it for every row above. Read them
from the record before building, and read the ruling in
[`bible-discrepancies.md`](bible-discrepancies.md) beside it: eight items have a
done-when the rulings changed, and the record is not edited to match. Where this
file and the record disagree on what an item asks for, the record plus its
ruling is right; where they disagree on whether it is built, this file is.
