# Map calm-down and journey vignettes: the report before code

2026-10-07, on `claude/vibrant-sagan-bg399f`, from `main` at `371dcfe`. This
answers the report section of
[`gymrun-patch-map-calm-down-and-journey-vignettes.md`](../../../spec/gymrun-patch-map-calm-down-and-journey-vignettes.md).
**No code has been written.** The prompt makes this a hard stop.

Each contact sheet below is one seed at 390x844, with four frames from left
to right:

1. the first map of the run;
2. the same map with the backdrop replaced by flat `#2b2f36`;
3. the map two steps in;
4. that map on the same flat colour.

- [`sheet-SMOKE24.png`](sheet-SMOKE24.png): Cave
- [`sheet-GYMRUN01.png`](sheet-GYMRUN01.png): Summit
- [`sheet-SEED-A.png`](sheet-SEED-A.png): Badlands

## 1. V5 stages on this tree

Every sub-stage of the V5 plan is merged:

| Stage | Merged in |
|---|---|
| 5.0/0 | PR #77 |
| 5.0/1 | PR #77 |
| 5.0/2 | PR #78 |
| 5.0/3 | PR #79 |
| **5.0/4, the map** | PR #80, with screenshots and the contrast fix in #81 |
| **5.0/5, the art pass** | PR #83 |

Since then:

- D107 (PR #99) puts the trainer sprite on doors and on walked trainers.
- `dad2a03` adds the defender backdrops.

The `spec/README.md` row for the plan still reads `active`, and says Stage 0 is
the only work begun. That row is stale. `milestones.md` has nothing on 5.0
beyond M6.4.

**The map nodes are not placeholder chips.** Every kind has drawn 8x8 art
through the manifest, shown at 24px as a `currentColor` mask. Even so, each node
is the same neutral disc with a cream glyph on it. Kind is told apart by the
glyph and nothing else, by rule: the Stage V0 comment at `styles.css:3576`, and
the bible's Node family, whose colour is "Neutral".

## 2. Inventory of the map today (resolved values)

| Element | Where it shows | Size | Colour |
|---|---|---|---|
| Shell nav | top, 5 tabs | 48px tall | `#0b0f17` with cream icons |
| Title row | `GYMRUN`, `TUTORIAL`, `SEED` | about 30px | cream on ink, 1px borders |
| Next-challenger rail | leader name and progress bar | about 40px | cream bar on ink |
| Heading | `CHALLENGER n OF 8` and a wallet chip (coin glyph and number, 13px bold, 2px border); then `n Pokemon`; then the region name and 4 type chips | about 70px | cream; the type chips use the type hues |
| Graph frame | | 358x602, 2px border, 4px radius | `#737880` |
| Backdrop | `map-backdrop:<locale>`, 272x408 art at 2px per art pixel, pixelated, anchored to the foot | fills the frame | full painting, with **no overlay or scrim**. The flat locale tint (`--locale-glow` 38% into `#151c27`) shows only when the file is missing |
| Step markers | numbers 1 to n on the left edge | 18px square, 10px text | ink with a 1px rule; cream fill on the row being chosen from |
| Upcoming disc | | 30px | `#151c27` at 90%, black drop shadow, glyph about `#c4bbaa` |
| Disc on the step being chosen from (`node--current`) | | 40px | about `#534c2e`, with a 2px `#4a8ef0` ring and a 12px blue glow |
| Gym | | 40px, 4px radius (the only square) | same ink fill; the leader's sprite fills it |
| Gym label | `Roark · 2 Pokemon` | 11px mono bold plate | cream on ink |
| Facts plate, holding the tier pips | step being chosen from, and walked rows | 32x10 | `#151c27` with a 1px `#737880` border. Three pips at 0.42em: off about `#090c13`, on `#a79f90` |
| Event capability glyph and band chevron | in the facts plate on events | 8px art | neutral |
| Detail line (payout with the coin glyph, AI tier, shop shelf and price) | step being chosen from only | 10px, max width 108px | cream on an ink plate |
| Edges | SVG `<line>` | 4px, round caps | `#737880`. Next-step edges dashed `2 9`, travelled edges solid, later steps none |
| Entrance | | 28x12 ellipse | `#737880` at 45% |
| Passed (not taken) node | | dashed 1px outline | `#737880` |
| Player marker | trainer sprite 36px right of the node; a blue pill if the sprite is missing | 40x40 | pixelated sprite; the pill is `#4a8ef0` |
| Footer stamp | locale, segment, seed, version | 9px | dim |

Measured on SMOKE24:

- The two next-step buttons are **88x72 and 94x72**, so both clear 44px.
- They are the only `<button>` elements in the graph. Later rows are `<div>`s
  that open inspect on a long press.
- The page is 844px tall in an 844px viewport, so **nothing scrolls**, on all
  three seeds.

## 3. The hypothesis: partly disconfirmed

**The disconfirmer fired.** With the painting replaced by a flat colour (frames
2 and 4 on every sheet), the next-step pair still stands out by its blue ring.
Everything else still blurs together:

- Every node is the same grey disc carrying the same cream blob.
- At thumbnail size, the bush, head, tent, bag and question-mark glyphs are
  near-identical round shapes.
- Upcoming rows are 30px against 34px to 40px on the active row, close enough
  to read as equal weight.

So the primary problem is **node design**, as the prompt anticipated. Kind is
carried by a 24px glyph alone, with no silhouette or colour, and weight changes
too little between the three tiers.

The backdrop is a **secondary** problem, and it depends on the locale. It
visibly muddies Cave and Badlands, where the mid-value painting sits at the
same value as the grey discs. Summit is fine, because the dark discs sit on
light snow. A scrim helps, but alone it would not pass the five-second test.

Two things already match Part 1:

- **Edges** already draw only the travelled path and the next-step edges.
- **Later rows** are already glyph-only (D85).

So Part 1 is mostly two jobs: per-kind silhouette and colour, and a stronger
weight split.

## 4. Transitions and the seam

- `router.show` toggles `hidden` and decides nothing.
- Every screen change in the app goes through `showScreen` (`app.ts:330`),
  which has 25 call sites.
- **Commit seam:** `nodePick.submit` (`app.ts:1680`) resolves `chooseNode`
  (`app.ts:829`), or `chooseDoor` in a defender run, through `flushedBefore`.
  Every map pick passes through it. This is where the commit vignette goes,
  awaited before the pick reaches core. It is the same pattern as the
  end-of-battle hold, which is one `await battleScreen.outro(...)` as the first
  line of `reviewBattle` (`app.ts:880`), the one path every battle completion
  takes.
- **There is no single completion seam today.** Each node kind completes
  differently:
  - Battles complete through `reviewBattle`, to the result screen.
  - Shops and events finish on their own screens.
  - **Rest has no screen at all.** It resolves on the map, and only opens Team
    when a TM is teachable.
  - The gym is never picked on the map. It is entered through `chooseLead` on
    pre-gym.
- Every one of those paths reaches the next `chooseNode` or `chooseDoor`, and
  that is what calls `showScreen('map')`. **The return seam is therefore the
  same function as the commit seam**, entered from a screen other than the
  map. I would put "Where to next?" there: play it when the map is about to
  show and the previous screen was not the map.
- **Gym entry seam:** `chooseLead`, after the lead is confirmed and before the
  battle screen.
- **Fall-through.** The existing outro does **not** stop a skipping tap from
  reaching the screen underneath. Its pointerdown listener neither calls
  `preventDefault` nor goes inert, and the next screen shows before that tap's
  `click` fires. The vignette layer must swallow both the pointerdown and the
  click, and test 5 holds it to that.

## 5. Where captions and timing go

- `src/data/displayTuning.ts` is on the `EXCLUDED` list in
  `build-config/content-hash.ts:167`. The rule (at `:42-51`) is that nothing
  under `core/` may import an excluded file at any depth. It already holds
  `battleFeedbackMs` and `reducedMotionOutroMs`. **The vignette duration
  (900ms) and the scrim opacity go there.**
- **The captions go in a new `src/data/vignetteCopy.ts`**, added to `EXCLUDED`
  with a reason. This follows `eventCopy`, `seedCopy` and `trainerClassCopy`.
  The generic tests at `test/content-hash.test.ts:148` and `:168` then cover
  test 8 with no new machinery.
- I would also add the file to `LINTED_COPY_GLOBS`, so the hedge lint reads it.

## Conflicts to rule on before code

Each item below is either a bible rule this prompt would break, or a gap in it.
Under CLAUDE.md the bible wins until it is amended, and section 10.3 says to
stop and file first. My recommendations are in **bold**. Taken together I would
file them as one amendment, **D109**, after the author's message is logged in
`playtest-log.md` as the observation.

1. **A colour per node kind breaks the bible.** The Node family's colour is
   "Neutral", and Stage V0 removed a per-kind coloured edge as "four of the
   type hues doing a second job".
   **Amend the Node family to a silhouette and colour per kind. Shape is
   primary and colour secondary, the colours are drawn from outside the 18
   type hues, and the set is colour-blind checked.** The encoding row (`:678`)
   and the map node card canon (`:847`, "the disc") change with it.
2. **Six kinds.** `NodeKind` is wild, trainer, rest, gym, shop and event
   (`data/tuning.ts:24`). Wild is still generated in attacker runs. Defender
   doors are all trainers.
   **One silhouette per kind:**

   | Kind | Silhouette |
   |---|---|
   | trainer | circle |
   | wild | rounded leaf or blob |
   | rest | dome or arch |
   | shop | square |
   | event | diamond |
   | gym | large shield, the only one at 56px |

   **And should the calm-down apply to the defender map too? I recommend yes:
   it is the same component.**
3. **Two of the starting captions break the copy rules.**
   - *"Stay safe, spend wisely"*: `safe` is on the bible §8 forbidden list
     (`data/forbiddenWords.ts`), and *"spend wisely"* is advice, which §8
     also rules out ("state outcomes, not advice").
   - **Proposal: "Spend your coins"**, which is closest to Charlie's "spend
     your money".
   - The other five stand.
4. **Part 3's header breaks R2 and R3.** A node type *name* beside its
   silhouette renders one fact twice on one surface, and a field label at
   rest. The battle header already carries the kind glyph at 16, under D46.
   **Proposal: the header is a colour band carrying the silhouette, plus the
   locale name, which is a proper noun and costs no budget. No kind word.**
   Rest has no screen, so it gets no header.
5. **"Remove anything not listed" collides with C2.** On the next-step row,
   the payout, AI tier and shop shelf are decision facts (canon `:847`).
   **Keep them on the next-step row only.**
   **Remove:**
   - the step-number markers, because row position already shows the distance
     to the gym;
   - the entrance ellipse;
   - the dashed outline on passed nodes, which "dimmed further" replaces;
   - the facts plate's border.
6. **The vignette is a new surface with no canon row.** The bible says nothing
   on transitions. A caption shown only after a commit is not a sentence at
   rest, but a new surface still needs a canon row, a text budget of
   5 words, and a statement that it is not an onboarding mechanism (§7
   allows three). **File it in D109.**
7. **Rest and return.** Rest never leaves the map, so "Rest and improve"
   followed by "Where to next?" would play back to back.
   **Rest plays its own beat only.** "Where to next?" plays after a battle,
   shop or event, and also when the map opens after locale select.
8. **Manifest test.** `test/asset-manifest.test.ts:70`, "has no placeholder
   left", fails the moment seven `vignette:*` placeholders enter `MANIFEST`.
   **Exempt the `vignette:` keys, with a comment naming this patch.**

## The seven sprites for Charlie

**Native size: 64x64, transparent, drawn at 2x (128px).** At 2x the art pixel
matches the map backdrop's, so a sprite sits on the locale crop on the same
grid. The reused sprites are about the same scale: @pkmn/img trainers are 80px
and Pokemon 96px.

Four moments can use existing sprites, so only **wild, shop and event** are
needed for launch. The other four are fallbacks for when no sprite exists.

| Key | Brief |
|---|---|
| `vignette:return` | A wooden signpost with two arrows pointing different ways, on a short tuft of grass. |
| `vignette:wild` | Tall grass parting, with two eyes glinting in the shadow between the blades. |
| `vignette:trainer` | A trainer's silhouette from behind, cap on, one hand raised holding a Poke Ball. |
| `vignette:gym` | A gym's front doors with a badge-shaped crest above the lintel, doors ajar with light behind. |
| `vignette:shop` | A small market stall with a striped awning, a coin pouch and two potions on the counter. |
| `vignette:rest` | A campfire with a small tent behind it, and a curl of smoke rising. |
| `vignette:event` | A mysterious glowing stone on the path, ringed by a few sparkles and a question-mark wisp. |

## Questions for the author

1. Approve filing D109 (items 1, 4, 5 and 6) as a bible amendment before code?
2. Use "Spend your coins" in place of "Stay safe, spend wisely"?
3. Does this patch apply to the defender map and door screens too?
4. Rest plays one beat and does not chain into "Where to next?". Agreed?
