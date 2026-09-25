# Patch 4.10.1: map node icons

Committed 2026-09-25 before any work, on `claude/map-icons-conversion-plan-tvab5v`.
Filed verbatim, per the protocol in [`README.md`](README.md). The prompt arrived
with one image, saved beside it as
[`assets/map-node-icons-example.png`](assets/map-node-icons-example.png).

The prompt asks for a scope and a plan, not a build. **That is a report before
code, which `CLAUDE.md` makes a hard stop.** The plan is section 2 of this file.
No `src/` file changes on this branch.

---

## 1. The prompt, verbatim

> *(image: a hand-drawn node map. A skull over crossed swords at the top, then a
> chain of round black nodes joined by lines, each carrying a white mark: a
> head, a fuzzy bush-like blot, a question mark, a face in a hat. The branches
> fork and rejoin. No words anywhere on it.)*
>
> Do we have a plan to convert map to icons?
>
> Look at the given example
> Trainer is a head symbol
> Wild is a bush symbol
> Shop and event we steal
> The tier levels can remain as labels beneath
>
> Scope out the work and plan this change for 4.10.1

---

## 2. Scope and plan

### 2.1 The short answer

**No plan existed, and the bible currently rules against one.** The map node
kind is a *word* by a ruling made three days ago, and it is a word on the
battle header by a ruling made the day before that. Both rulings are in the
register, both were made by choosing the cheaper of two options, and the
option not taken is exactly this request. So the work is not "draw six icons".
It is: reverse one ruling as a reversal, draw six marks that pass the sheet's
own contrast floor, mount them on the two surfaces that carry the kind, and
re-record every number that moves. About two days of a session, most of it
gates and records rather than drawing.

### 2.2 What the tree does today

`ui/screens/run-map.ts` renders every node as a card. The label line is the
kind as a word from a six-entry table (`Wild`, `Trainer`, `Rest`, `Shop`, `?`
for an event, and the leader's name plus `'s Gym` for a gym), followed by the
tier as three pips filled to tier (M5.2), and on the current step a detail line
with the payout number and, on a fight, the AI tier word. The map drawer mounts
the same component. The battle screen header (`ui/screens/battle.ts`) prints
the same kind word as its title, by D28.

So the event node is already a mark. Everything else is a word.

### 2.3 Where the bible stands, and why this is an amendment

The bible disagrees with itself on this attribute, and the disagreement is
already filed:

- **Section 5's component canon** lists the map node card as *"Node-type glyph,
  tier pips, reward-tier pips, capability glyph with band chevron"* (D29,
  2026-09-22).
- **Section 4's budget note, one day later (D37)**, says *"there is no such
  glyph: section 2's families are attributes of a Pokemon or a move, and a node
  kind is neither"*, budgets the card at 3 words, and keeps the kind a word to
  match D28's ruling on the battle header.
- **D37 itself named this request as its option 2**: *"Tenth and eleventh:
  `capability` and `node kind`. M5.2 as written, zero words on the card, and
  D28 is reopened, because the battle header's first budgeted word becomes a
  glyph too. Consistent with R1"*, and closed with *"that is a reversal of D28,
  not an extension of it, and it should be ruled as one."*

Section 2 says *"Ten glyph families. Adding an eleventh is an amendment."*
Section 10.3 says a milestone that needs a new family *"stops and files an
amendment before building."* So this patch opens with a discrepancy row, not a
commit to `src/`. That row is **D46**, filed in
[`../design/bible-discrepancies.md`](../design/bible-discrepancies.md) with this
plan. The lead designer rules it; the bible goes to Rev 13; then the build.

The section 9 hypothesis *"Ten glyph families is the right size"* is the one
this spends. Its disconfirmer is *"testers confuse any two glyphs after labels
fade"*, and M7.1 is the playtest that can observe it. **That is the argument
for 4.10.1 landing before Tier 7 rather than after**: the playtest should see
the eleven-family map, or it validates a face the game no longer wears.

### 2.4 The six marks

One family, `node`, one glyph per kind. Read against the example image and the
prompt's four lines:

| Kind | Mark | Where it comes from | Note |
|---|---|---|---|
| `trainer` | A head, shoulders up | The prompt: *"Trainer is a head symbol"*. Drawn new in `ui/theme/glyphs.ts` | Silhouette, no face. A face is a person; a silhouette is a kind |
| `wild` | A bush | The prompt: *"Wild is a bush symbol"*. Drawn new | Two or three rounded lobes. The example's blot is this at pen resolution |
| `event` | `?` | *"we steal"*: the map already prints `?` for an event, and the example uses it | Text art, the way the status family's lettering is the glyph. The one kind that changes nothing on screen |
| `shop` | A coin purse or a bag | *"we steal"*: reuse a sprite the item sheet (`ui/theme/itemIcons.ts`) already draws rather than design one | Reading the prompt's *steal* as *take from what is already drawn*. If a drawn mark is wanted instead, a bag is the fallback |
| `rest` | A tent | Not in the prompt or the example, which has no rest node. Drawn new | Every kind wears a mark or R1 fails; a word beside five glyphs is exactly the *"nine words and one glyph"* shape R3 forbids. **Open question 1, below** |
| `gym` | A badge, eight-pointed | The example's skull over crossed swords is a boss mark. A gym badge is the same idea in this game's own vocabulary. Drawn new | Sits beside the leader's name, which stays: a proper noun is free under section 4's counting rule, and it is the identity, not the kind. **The `'s Gym` suffix goes** from the face; the name is enough once the mark says gym |

All six at the sheet's two sizes, 24 and 16, monochrome, `currentColor`, the
same `path()` entries the capability family uses. The glyph sheet script
(`scripts/visual/glyph-sheet.ts`) rasterises every pair in a family at 16px
and holds a distinctness floor; six marks is the largest family after type and
stat, and the head against the bush and the tent against the badge are the
pairs to watch.

### 2.5 The node card after

Reading the prompt's *"tier levels can remain as labels beneath"*, with the
bible's encoding: the tier is pips, not a word, since M5.2, and the pips stay
pips. What moves is the slot. Today the pips sit on the label line to the right
of the kind word. After, the card is two rows:

```
[ glyph 24 ]             upcoming and done steps: this row alone
[ ●●○ ]  [ capability glyph + chevron, if gated ]
[ 24 coins · Rookie ]    current step only, as today
```

- Row one is the mark. On a gym, the mark then the leader's name.
- Row two is the tier pips, beneath, as asked. The reward-tier pips and the
  capability glyph with its chevron keep their slots on this row.
- The detail line is unchanged: the payout number and its unit, the AI tier on
  a fight, the shelf line on a shop, the record on a done node.

Section 4's map node card row goes **3 to 2** (the payout's unit word and the
AI tier; the kind word is gone). The census budget in
`scripts/visual/census.ts` and the recorded baseline move with it.

R1 makes the battle header follow: the same attribute cannot be a glyph on the
card and a word on the header. The header's title becomes the same `node`
glyph at 16 beside the opponent, and section 4's battle header row goes **4 to
3**. Section 5's header row is rewritten to say so. This is the D28 reversal
D37 described, and the D46 row asks for it by name.

R5: long-press on the mark opens the kind's hint from `KIND_HINTS` in
`ui/copy/screens.ts`, through a `node:` tip kind in `ui/tooltips.ts`. The hint
already exists in long and short forms; nothing is written. Today an untiered
node prints the short hint on its detail line; that stays until the ruling
says otherwise, since it is a tier fact's stand-in and not the kind.

R7: the eleventh family gets its labels in `data/glyphLabels.ts` (`Wild`,
`Trainer`, `Rest`, `Gym`, `Shop`, `Event`), so the first and third time a
player sees the map the word sits beside the mark and then never again. The
exposure store reads the family roster and needs no change. This is what makes
the prompt's *labels* line hold twice over: the tier stays as pips beneath, and
the kind's word is beneath the mark for exactly two visits.

### 2.6 Files, in the order they change

| Step | File | Change |
|---|---|---|
| 0 | `docs/design/bible-discrepancies.md` | D46, filed with this plan. **Waits on a ruling** |
| 0 | `docs/design/design-bible.md` | Rev 13 on the ruling: section 2 eleven families and a `node` row; section 3 a *Node kind (map node, battle header)* row; section 4 map node card 3 to 2, battle header 4 to 3; section 5 the header row; section 9's hypothesis row reads eleven |
| 1 | `src/data/glyphFamilies.ts` | `'node'` appended, with the D46 note in the style of the `'capability'` entry. Excluded from `contentHash` already |
| 1 | `src/data/glyphLabels.ts` | Six labels. Excluded from `contentHash` already |
| 1 | `src/ui/theme/glyphs.ts` | Six entries; the sheet's header count goes to eleven |
| 1 | `test/glyphs.test.ts` | `toHaveLength(10)` becomes 11; the pairwise floor runs over the new family by itself |
| 2 | `src/ui/screens/run-map.ts` | `KIND_LABELS` deleted; `glyphNode('node-<kind>', { size: 24, label })` in the label slot; pips to a second row; gym prints the leader's name without the suffix |
| 2 | `src/ui/styles.css` | `.node` becomes two rows; the drawer inherits because it mounts the same component |
| 2 | `src/ui/tooltips.ts`, `test/tip-kinds.test.ts` | The `node:` tip kind, fed by `KIND_HINTS` |
| 3 | `src/ui/screens/battle.ts` | Header title: the mark at 16 and the opponent; `'s Gym` off the title |
| 4 | `src/data/tutorial.ts`, `docs/copy.md` | The `map.kinds` coach mark names the marks, not the words. Excluded from `contentHash` already |
| 5 | `test/exposure-labels.test.ts`, `test/visual-exposure-labels.test.ts` | An eleventh case; D41's family walk must find the map painting a `node` glyph that reports itself |
| 5 | `scripts/visual/census.ts`, `docs/visual/baseline/` | Budgets 2 and 3; census re-recorded; map, drawer and battle screenshots re-recorded |
| 6 | `docs/generation.md` §78, `docs/design/milestones.md`, `docs/README.md` | The dated note, the item row, the current-state paragraph |

Nothing under `src/core/` changes. `core/encounters.ts` keeps `label:
"<Leader>'s Gym"` because the log and the share text read it; the UI renders
the leader from the gym definition instead of trimming the string. **No version
axis moves**: every `data/` file touched is on the content-hash exclusion list
with a reason already.

### 2.7 Gates

The absolute gates, unchanged: determinism, stream isolation, version guards,
type check, lint, build, strict trim, smoke run, full suite. Plus the three
this patch is judged on:

- `test/glyphs.test.ts` at eleven families, every pair in `node` above the
  16px floor.
- The census reading **2** on the worst map node card and **3** on the battle
  header, in Pocket, with exposures exhausted (D44).
- The browser suite's contrast sweep and the Pocket no-scroll gate on the map
  screen, which gains no height: the card grows one row and loses one word.

### 2.8 Open questions, each with the default the build takes

1. **The rest node.** Not in the prompt. Default: a tent, drawn new. The
   alternative that keeps the prompt literal is no rest mark and the word
   `Rest`, which R3 forbids once five siblings are glyphs.
2. **What "steal" means for the shop.** Default: an item sprite the sheet
   already ships, so nothing is designed. If it means *borrow the merchant mark
   from the example's source*, that is a drawn bag, and it is a ten-minute
   difference.
3. **The gym mark.** The example's skull is a boss. Default: a badge, because
   the game already has a badge vocabulary and a skull is a verdict about
   difficulty in a way a badge is not. Either passes C1; the badge passes it
   without an argument.
4. **Glyph size on the card.** `ui/theme/glyph.ts` says 16 unless a surface
   says otherwise, and the card face is a 16px surface. Default: **24** on the
   map node, because the mark is the only thing on the face of an upcoming
   node and the example draws it as the node itself; 16 on the battle header,
   where it sits beside text. D46 asks section 5 to say which.
5. **Order against Tier 7.** Default: 4.10.1 lands after Tier 6 merges and
   before M7.1 opens, for the reason in 2.3.

### 2.9 What this does not do

- No coloured edge per kind. The V0 note in `styles.css` records why: four
  type hues doing a second job, and an elite edge that was a verdict.
- No node shape change. The card stays a card; the example's circles are the
  example's, and section 5 says one component for the map and the drawer.
- No change to what a node contains, pays, or reveals. Presentation only.
- No touch to the event screen, which has its own budget and its own glyph
  and chevron since M5.6.
