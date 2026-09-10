# Restoring the fold on both guarded screens

**2026-09-10.** The prompt is
[`../../spec/gymrun-patch-restore-the-fold.md`](../../spec/gymrun-patch-restore-the-fold.md).
Everything below is at 390x844 on seed `SMOKE24`, measured with
`scripts/visual/measure.mjs` and the same clicks the smoke bot makes.

The target: the fourth move button and the map's last offered node card both
end at or above y=740.

| | before | after |
|---|---|---|
| battle, fourth move button | 946.5 | **722.5** |
| map, last offered node card | 728.22 | **683.72** |

Both pass. Four of the prompt's five cuts were taken; the fifth was not needed
and is not built. `test/visual-v0.test.ts` no longer carries the fold assertion
as `it.fails`.

## 1. Every element above each target, before any cut

Read as a nesting: each row is a child of the row above it, and the rows at one
depth are in document order down to the one containing the target.

### Battle — the fourth move button, ending at 946.5

| element | top | height | bottom |
|---|---:|---:|---:|
| `main.shell` | 0 | 1338.5 | 1338.5 |
| ` header.header` | 24 | 64.5 | 88.5 |
| ` form.seedbar` | 0 | 0 | 0 |
| ` div.shell__drawer-bar` | 100.5 | 32.5 | 133 |
| ` div.screens` | 0 | 0 | 0 |
| `  section.screen--battle` | 145 | 1145.5 | 1290.5 |
| `   div.battle__header` | 145 | 47 | 192 |
| `   div.board` | 204 | 1086.5 | 1290.5 |
| `    div.scene` | 204 | 754.5 | 958.5 |
| `     div.panel--foe` | 204 | **239.25** | 443.25 |
| `     div.panel--me` | 455.25 | **214.25** | 669.5 |
| `     div.moves` | 681.5 | 265 | 946.5 |
| `      button.move` x4, two rows of 129.5 | 681.5 | 129.5 | 946.5 |

The `div.world` behind the shell is `position: fixed` and out of flow; it is
listed by the measurer and costs nothing.

A move button's own 129.5 breaks down as name 21, meta 41.5 (**two lines** —
four chips wrapping), tags 13.5, PP 16.5, plus gaps and padding.

### Map — the last offered node card, ending at 728.22

| element | top | height | bottom |
|---|---:|---:|---:|
| `main.shell` | 0 | 1169.69 | 1169.69 |
| ` header.header` | 24 | 64.5 | 88.5 |
| ` div.shell__drawer-bar` | 100.5 | 32.5 | 133 |
| `  section.screen--map` | 145 | 976.69 | 1121.69 |
| `   ol.rail` | 145 | 34.5 | 179.5 |
| `   div.map__heading` | 191.5 | 108.5 | 300 |
| `   ol.chain` | 614.5 | 438.69 | 1053.19 |
| `    li.step--current` | 614.5 | 113.72 | 728.22 |
| `     div.step__nodes` | 614.5 | 113.72 | 728.22 |
| `      button.node` x2 | 614.5 | 113.72 | 728.22 |

**The 314.5px between the heading and the chain is not empty space.** It is the
party HUD, `div.party`, measured at 312 to 603. The map screen is a grid and on
a phone `grid-template-areas` places the party above the chain, so the HUD is a
DOM sibling *after* the chain and a visual row *before* it. That is deliberate —
HP and PP are the cost of the node about to be chosen — and it is left alone.

## 2. The cuts, measured after each

| # | cut | battle | map |
|---|---|---:|---:|
| — | before | 946.5 | 728.22 |
| 1 | drawer trigger out of the flow bar | 902 (−44.5) | 683.72 (−44.5) |
| 2 | foe panel header does not wrap | 877 (−25) | 683.72 |
| 3 | six-stat block collapses to one row | 759.5 (−117.5) | 683.72 |
| 4 | tag row shares the PP line, one tag on the face | **722.5** (−37) | **683.72** |
| 5 | map tier copy truncates to one line | not needed, not built | |

### 1. The drawer trigger — 44.5px, both screens

A full-width bar between the seed bar and the screens, costing every decision
surface 44.5px for one 26.5px button. It is a fixed pill in the bottom-right
safe area now, directly above `.stamp--br`, which also puts it where a thumb
already is rather than at the top of the phone.

**It carried a live bug.** `.shell__drawer-bar` set `display: flex`, which beats
the UA's `[hidden]` rule, so `drawerBar.hidden = true` did nothing and the Party
button rendered on the starter screen — where there is no party — and on the
summary. Measured, not inferred: `hidden` present, `display: flex`, height 32.5.
As a flow bar that looked like spacing; as a fixed pill it would have floated
over both, so the `[hidden]` guard went in with the cut. This is the **third**
occurrence of that trap in `styles.css`, after `.rewards` and `.drawer`.

### 2. The foe panel header — 25px, battle only

`panel--foe` measured 239.25 against `panel--me`'s 214.25 for the same content.
The whole 25px was one wrapped row: the foe's name is prefixed with "Opposing",
and at 390px that pushed the archetype chip and the type badges onto a second
line.

**`nowrap` alone was tried first and was wrong, which a screenshot caught and
the numbers then explained.** With the header refusing to wrap, the name is the
only thing that can give, and it gave: `Opposing Mudbray` rendered as
`Opposing Mu…` on the real screen. Measured, the header is 329px wide and its
four children want 358 — name 135, level 43, archetype chip 102, types 54, plus
three 8px gaps — so on the foe panel something always has to yield, and the
species being fought is the one thing on that panel that must not be
abbreviated.

So the chip moves to the meta row, which is the 4.7 prompt's own other option,
and the header keeps `nowrap` with the ellipsis as a valve for a name longer
than any the game ships. Without the chip the header wants 248 of 329 and
nothing clips. The meta row absorbs it without a line: measured at 20px with the
HP text alone and 20px with the longest status label forced onto it beside the
chip. The chip is still on both panels, still ungated by the reveal policy,
still one tap from its tip; only its row changed. Both panels are 214.25 after
this cut.

### 3. The stat block — 117.5px, battle only, and it is V5's budget

**Note for V5: this is the stat-block collapse the visual plan reserved, spent
early. Do not spend it twice.** The four-row block was 71.5px per panel more
than it needed to be, 143 across the two, and it was the largest single
reclaimable thing on the screen. Collapsed it is one row of six values plus a
toggle in the same row, so opening costs a row and closing gives it back.

Nothing is removed. Every number the expanded block prints is still printed, the
stage colouring rides on `.stat__value` so a boosted stat still reads as
boosted, the stat-label tooltips still answer what `SpA` means, and the speed
marker keeps its `▲` and its title — only the word "first" is dropped, which is
why the marker is two spans now. In Simple mode the bar is narrowed rather than
hidden, because there the bar *is* the readout. Panels go 214.25 → 155.5 each.
Wide viewports never collapse and never render the toggle.

### 4. The move tag row — 37px, and it did not have to hide anything

Two changes, and the order matters.

The card became a two-column grid so the **tag row shares the PP line**. That
alone took the button from 129.5 to 111 and the fourth button to 722.5, with
every tag still on the face — the same ~37px the 4.7 prompt estimated for this
cut, reclaimed by layout rather than by dropping tags.

But that height is a function of how many tags a move happens to carry, and the
`maxMoveTagsOnFace` ceiling is 3. **Measured rather than reasoned about**: with
three real chips cloned onto every face, the fourth move button went back to
751.5, over the line. So the prompt's cut is built as well — one tag on the face
at narrow widths — and with it the button holds at 722.5 whether the faces carry
one tag or three. That is the point of it: a bounded height, not a lucky seed.

The folded tags are not lost. `moveTagRow` builds a `+N` chip carrying all of
them in one `movetags:` tip, a new kind in the same tooltip layer every other
badge on the card already uses, with the words still coming from
`data/moveTags.ts`. It is a tooltip and not a disclosure toggle deliberately: in
a battle the card *is* the submit button, and `ui/drawer.ts` has the argument —
a control inside the move grid is one mistap away from spending a turn.

The chip is `badge--tag-more`, not `badge--tag`, because `scripts/smoke.mjs`
counts `.badge--tag` against the cap and a chip standing for two tags must not
read as a third. It is sized with the tags rather than with the badges; left at
the default badge size it cost 4px back.

### 5. The map's tier copy — not needed, not built

The map cleared the line at cut 1 with 56.28px to spare and never came near it
again. Truncating the tier copy would have been a cut taken for its own sake, on
the one screen whose whole job is to let the player weigh a trade before
committing to it.

## 3. What the gate caught, and one thing older than this patch

Three rounds of browser failures, none of which named the thing that was wrong.
They are worth writing down because the shape repeats: **a cut that changes a
card's height slides a different pixel under the player's thumb**, and on these
screens a large share of every card is tooltip triggers.

### Three selectors that reached past the screen they were for

Cuts 2, 3 and 4 were each first written against the class the battle screen uses
and each hit three or four other surfaces that share it.

| cut | written as | also reached | scoped to |
|---|---|---|---|
| 2 | `.panel__header`, `.panel__name` | member cards, acquisition cards, item-target cards | `.scene .panel__header` |
| 3 | `.stats:not([data-expanded="true"])` | `stats--party`, on every party, drawer and result card | `.stats[data-expanded="false"]` |
| 4 | `.move` | `.move--card`, `.move--victim` | `.moves .move` |

Cut 3's was the worst of the three on its own terms: the member card blocks
collapsed into one row of six **with no toggle on any of those surfaces to open
them again**, which is exactly the information loss the rest of this patch was
written to avoid.

But all three failed the same indirect way. None of them reported as a squashed
card. Each reflowed cards on screens nobody was measuring, the new centre of one
landed on a badge, and a badge stops the click from reaching the button under it
— so the browser bot tapped the middle of a replacement card and replaced
nothing, or tapped a result card and raised a tooltip. **Four tests in three
files timed out on `<div class="tip" role="dialog"> subtree intercepts pointer
events`, none of them anywhere near a stylesheet.**

Only the battle screen is over the fold, so only the battle screen pays for
these cuts now.

### A tooltip that outlived the screen it explained

`ui/app.ts` closes the drawer on every navigation, on the argument that a panel
left open across a screen change is an overlay over a decision the player has
already made. The tooltip layer was never closed there, and it is the worse of
the two: it sits over the content and **eats the first tap on the new screen** —
the tap that would dismiss it is the tap the player meant for the card
underneath. `showScreen` closes it now.

**This is older than the fold patch.** The same walk on the tree before it
leaves tips open across a screen change a dozen times and gets away with it,
because of where the cards happen to sit. That was checked in a worktree at the
pre-patch commit rather than assumed.

### A pointer that never moved

The last round of failures was not the app at all. Chromium leaves the mouse
where the last click put it, the app re-renders under it, and whatever lands
beneath that stationary pointer gets a `mouseover` — which `ui/tooltips.ts`
answers by opening a tip, hover being a desktop enhancement. So the bot kept
raising panels it had never tapped.

**A phone has no hover**, and these are 390x844 runs, so this is an artifact of
driving a desktop browser rather than anything a player can reach.
`scripts/visual/browser.mjs` parks the pointer after every decision now, which is
what `measureScreen` already did before reading a box. With it the SMOKE24 walk
reaches the summary having raised no tooltip at all; before it, on either tree,
it raised a dozen.

`clickMoveCard` in the same file is the other half: the bot aims at
`.move__name` rather than at a card's geometric centre, because which pixel is a
badge depends on how the meta row wraps, and a card whose centre is a badge is a
card the bot taps forever without choosing anything.

## 4. What else moved

- `docs/visual/baseline/heights.json` re-recorded. This patch exists to change
  those numbers, so the pin follows it rather than the other way round.
- `scripts/smoke.mjs`'s own map check, which measures a different point in the
  run than the guarded measurement does, goes from **869 of 844 (FAIL)** to
  **824 of 844 (ok)**. Both instruments now agree.
- `test/fold-controls.test.ts` is new: seven tests on the two controls, in
  jsdom. They assert the way *back* — the block expands, the folded tags resolve
  by name through the tip — because a cut that hid a number would reclaim the
  same pixels and be a different change.
