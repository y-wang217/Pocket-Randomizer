# Patch 4.10.2: the grass mark, and the node card is the mark

Committed 2026-09-25 before any work, on `claude/map-icon-only-nodes-grass`,
on top of merged [#71](https://github.com/y-wang217/Pocket-Randomizer/pull/71)
(`6581860`). Filed verbatim, per the protocol in [`README.md`](README.md).
The prompt arrived as a follow-up to patch 4.10.1's merge, in the same
session, with no image.

---

## 1. The prompt, verbatim

> okay the wild icon should be like grass, more crown shaped. like a curved
> grass that's slightly bent from the wind.
>
> Also, I want to change the map to even fewer words. so remove the things
> that aren't the icon, so it's even more closely resembles the sts map. open
> a new branch for this

---

## 2. Reading, before code

Two items. The first is a redraw inside the `node` family and touches no rule:
the bush becomes a tuft of grass, five blades bent to the right, and section
2's node row is corrected to say so.

The second takes words off a face section 4 budgets, so it is filed as
**D47** in [`../design/bible-discrepancies.md`](../design/bible-discrepancies.md)
before the build. What the map node card carries today besides the mark, and
where each fact goes:

| On the face today | Kind of thing | After |
|---|---|---|
| The payout, `8 coins` | A number and its unit | Inspect on the mark: *8 coins* |
| The AI tier, `Rookie` | A word, budgeted by name since D28 | Inspect on the mark |
| The shop's shelf line, `3 on the shelf, from 12` | Two numbers and prose | Inspect on the mark |
| An untiered node's short hint, `Something happens.` | Prose | Inspect on the mark, which carries the long hint already |
| The gym's leader name and `· 2 Pokemon` | A proper noun and a count | The leader is on the rail and in the heading above the chain already; the count goes to inspect |
| A done node's record, `Pidgey · 3 turns` | A proper noun and a number | Inspect on the mark |
| A rested node's `restored` | A word | Nothing: a done rest node is a done rest node |
| Tier pips, reward-tier pips, capability glyph and chevron | Marks | Stay. The prompt's earlier instruction, *the tier levels can remain as labels beneath*, still holds |

C2 says no fact that changes a decision is removed, it is re-encoded. Every
row above is re-encoded onto the mark's inspect panel (R5), which is where
D37 sent rarity and section 3 sends every tier definition. Section 4's map
node card budget goes **2 to 0**, and the card reaches the number M5.2 first
assumed for it, three tiers later.

**The one row worth a second look is the payout.** R2 says numbers stay,
and the file's own header calls the payout *the most important pixel in the
game*. It moves behind a press here because the prompt asks for the mark and
nothing else, and the number is one press away on every current option. If a
playtest finds players routing without pressing, section 9 gets a row and the
bare numeral comes back beside the mark; that is a reversal of this patch,
not an extension of it.

The battle header is untouched: it carries the opponent and the AI tier,
and the prompt is about the map.
