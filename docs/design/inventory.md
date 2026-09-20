# M0.2: glyph and mechanism inventory

Milestone M0.2 of
[`../spec/gymrun-presentation-milestones.md`](../spec/gymrun-presentation-milestones.md).
Report only, no tree change. Measured on `ab1fe67`, the 4.10 trunk at bible Rev 2.

Three lists, as the item asks: every glyph rendered and the family it belongs
to, every place one attribute renders in two channels on one surface (R3), and
every explanation mechanism in the tree (R5). Each entry carries a file and a
line.

**The headline is that the tree is further along than the milestone assumes in
two families and further behind in two others**, and that the R3 question raised
when the discrepancy register was filed has a concrete answer in section 2.3.

---

## 1. The nine glyph families, as rendered today

Bible section 2 names nine. Four have a real glyph, three render a word where a
glyph belongs, and two are partial.

| Family | Component | State | Note |
|---|---|---|---|
| Type | `ui/chip.ts:59` `typeChip` | **word** | The type name as text in a coloured chip. An 18-glyph set exists and is not used here — see 1.1 |
| Category | `ui/chip.ts:247` `categoryChip` | **word** | Renders `PHYS`, `SPEC`, `STAT` from `CATEGORY_LABELS` (`ui/scene.ts:1790`). No fist, ring or wave anywhere in the tree |
| Band | `ui/chip.ts:149` `bandChip` | **done** | Pips, filled to band. The numeral moved behind the tap in 4.8.0.3 |
| PP | `ui/scene.ts:1878` (inline) | **word** | `PP ${maxPp}` as text. No glyph, and the label is one R2 forbids |
| Accuracy | fact strip, `src/core/moveFacts.ts:48` | partial | In the strip with an icon, not in a dedicated slot. No never-miss glyph exists |
| Priority | fact strip, `src/core/moveFacts.ts:50` | partial | In the strip. Not on the Pokemon panel, which section 2 and section 6 both require |
| Effectiveness | `ui/chip.ts:255` `effectChip` | partial | A badge closing the fact line, not the coloured left edge section 2 specifies |
| Status | `ui/chip.ts:163` `statusChip` | **done** | Three-letter chip, `data-status` names it, fixed colour each |
| Stat | `ui/chip.ts:195` `stageChip` | partial | Stage as multiplier plus ladder is done (4.8.0.3). The six stat glyphs are abbreviations, not glyphs — `src/data/statInfo.ts` |

### 1.1 The type glyph set exists and is not the type chip

`src/ui/theme/typeIcons.ts:117` `typeIconPath` resolves an 18-entry path table
(`TYPE_ICON_NAMES`, line 122). Its only consumer is the move button's watermark,
`ui/scene.ts:1482`, appended at `ui/scene.ts:1632`. The watermark is decorative
by construction: `aria-hidden`, no tooltip, no title, and `typeIconPath` returns
`null` for an unknown type so a missing glyph renders nothing.

So **M1.1 does not start from zero on the type family.** It starts from a set
that is drawn, colour-keyed and already proven against every type in the game,
and its job there is to move that set from behind the card into the chip.

### 1.2 Two families M1.1 can skip, and one requirement already met

- **Band is done.** `bandChip` draws `BAND_PIPS` pips filled to the band, with
  the numeral on `aria-label` and the words behind `data-tip`. M1.1's
  requirement that *"band pip count is read from `bandInfo`, not hardcoded"* is
  already satisfied: `ui/chip.ts:23` imports `BAND_PIPS` from
  `src/data/bandInfo.ts:54`, where it is `5`.
- **Status is done.** Three letters, fixed colour, `data-status`.
- **M2.1's "remove the BAND numeral" is already done**, by 4.8.0.3. The item's
  text is stale rather than wrong.

### 1.3 The three families that render a word where a glyph belongs

Type, category and PP. All three are on the move card, which is why Tier 2 is
where the glyph sheet earns its keep, and all three are R2 violations at rest
today independent of any glyph work:

| Site | Renders | Rule |
|---|---|---|
| `ui/scene.ts:1868` and `ui/scene.ts:1527` | `${basePower} BP` | R2, field label |
| `ui/scene.ts:1878` | `PP ${maxPp}` | R2, field label |
| `ui/chip.ts:59` via `ui/scene.ts:1857`, `:1511` | the type name | R2, type name at rest |
| `ui/chip.ts:247` via `ui/scene.ts:1858`, `:1525` | `PHYS` / `SPEC` / `STAT` | R2, category word at rest |

---

## 2. R3: one fact, two channels, one surface

### 2.1 Live today: the type renders twice on every battle move button

`renderMove` appends both:

- `ui/scene.ts:1632` — `typeWatermark(move.type)`, the glyph, behind the card.
- `ui/scene.ts:1511` — `typeChip(move.type)`, the type name, in the meta row.

One fact, two channels, one surface. This is the redundancy audit's only
*current* violation on a decision surface, and it resolves itself in M2.1 the
moment the chip takes the glyph and drops the word — the watermark then becomes
the second channel of a fact the chip states in glyph form, which is the same
collision, so **M2.1 has to decide which of the two survives.** The watermark is
the cheaper delete: it is decorative, `aria-hidden`, and carries no tooltip.

### 2.2 Not a violation, recorded so it is not mistaken for one

- **HP bar plus HP number** on the Pokemon panel and the party row. Section 3
  lists both explicitly under Held item's neighbours — *"HP bar and number"* —
  so the encoding table permits it.
- **Stat glyph, bar and number** on the stat block. Section 3's Six stats row
  specifies all three.
- **Stage multiplier plus ladder** (`ui/chip.ts:195`). The comment at
  `ui/chip.ts:180` makes the argument the bible agrees with: the ladder *is* the
  stage, and the signed integer rides `aria-label` rather than being printed
  beside it.
- **`ui/band.ts` is not a band readout.** It is the confirm-band overlay, the
  one confirm component (`openBand`, `ui/band.ts:54`; callers in
  `screens/party.ts` and `screens/acquisition.ts`). The band *explanation* is
  `ui/tooltips.ts:594` `renderBand`. The two share a word and nothing else, and
  `ui/band.ts:11` says so. **M1.2 must not fold `ui/band.ts` into inspect.**

### 2.3 The icon strip question, answered

This is the R3 question raised when the discrepancy register was filed. The
answer is that **the strip will collide with the bible's card face on exactly
two fields, and both are in the strip's vocabulary today.**

`src/core/moveFacts.ts:47` fixes the strip's nine ids:

```
accuracy, secondary, priority, multiHit, charge, recharge, recoil, drain, contact
```

Section 3 of the bible gives `accuracy` and `priority` their own slots on the
card face — accuracy as a number beside a target glyph, under 100 only; priority
as a chevron beside the move name, nonzero only. M2.1 mounts those slots and
keeps the strip (*"Keep the describeMove icon strip"*). Mounted as written, an
accuracy of 85 renders in the accuracy slot **and** in strip column 1, and a
priority of +1 renders as a chevron **and** in the strip. Two facts, two channels
each, one surface.

**This is an M2.1 decision, not an amendment**, because R3 already decides it —
each double render is a bug, and the fix is removing one channel. The choice is
which:

1. **Drop `accuracy` and `priority` from `MOVE_FACT_IDS`**, leaving the strip
   the seven facts with no slot of their own. Smallest change to the bible's
   face; the strip keeps every fact that has nowhere else to go.
2. **Keep the strip whole and do not mount the two slots**, encoding accuracy
   and priority as strip columns. Contradicts section 3, so it is an amendment,
   not a choice.

Option 1 is the only one inside the bible. Flagged here so M2.1 opens with it
rather than discovering it at the census.

### 2.4 A vocabulary collision M4.1 should not walk into

M4.1 says *"Remove STAB and contact from the vocabulary. Keep the seven measured
kinds."* There are **two** vocabularies with these words in them:

| Vocabulary | Where | What M4.1 means |
|---|---|---|
| Flag kinds, post-resolution | `src/data/flagWords.ts`, mapper in `src/core/battle/flags.ts` | **This one.** R9's seven kinds; STAB and contact are causes and get no flag |
| Move facts, on the card face | `src/core/moveFacts.ts:47` | **Not this one.** `contact`, `recoil`, `drain` and `multiHit` are card facts about the move, not outcomes of a hit |

R9's note — *"recoil, drain and multi-hit fired zero times over 699 measured
battles and are not in the vocabulary"* — is about the flag vocabulary only.
Deleting those ids from `core/moveFacts.ts` would remove four decision-relevant
facts from the card and trip C2.

---

## 3. Explanation mechanisms

R5: *"There is exactly one mechanism."* There are **seven** in the tree, plus one
that is not an explanation mechanism and is listed to keep it out of M1.2's way.

| # | Mechanism | Entry point | Reached from | M1.2 |
|---|---|---|---|---|
| 1 | Tooltip layer | `ui/tooltips.ts:177` `createTooltips` | `data-tip` on any element, one delegated listener, hover plus Enter and Space | **This is the survivor.** Everything else folds into it |
| 2 | Type wheel | `ui/tooltips.ts:639` `renderTypeWheel` | `monTypeChip` only (`ui/chip.ts:90`) | Fold. See 3.1 |
| 3 | Band explanation | `ui/tooltips.ts:594` `renderBand` | `bandChip`'s `data-tip` | Already inside mechanism 1; fold means nothing to do but assert it |
| 4 | Move card explanation | `ui/move-detail.ts:64` `moveCardData`, rows at `ui/move-explanation.ts:70` | The move card surfaces | Fold |
| 5 | Move fact strip | `ui/scene.ts:1690` `moveFactStrip` | Both card shapes | Keep as a face element; its icons are already triggers on mechanism 1 (`src/data/moveFactInfo.ts:10`) |
| 6 | Coach marks | `ui/tutorial.ts`, 29 marks in `src/data/tutorial.ts` | Per screen, forced Detailed | Keep. Section 7 gives it its own job: screens, not glyphs |
| 7 | Intro panel | `ui/intro.ts` | Once, before the first decision | Keep. One-time greeting, explains nothing |
| — | Confirm band | `ui/band.ts:54` `openBand` | `screens/party.ts`, `screens/acquisition.ts` | **Not an explanation mechanism.** Do not fold |

Mechanism 1 already renders seventeen kinds — move fact, stages, move rows, gym,
threat, relic, move tag, flag, archetypes, ability, item, category, stat, band,
HP, status and the type wheel (`ui/tooltips.ts:301` dispatches them all). That is
the layer D4's ruling asks M1.2 to mount on all seventeen of section 3's inspect
rows, and it is already the right shape for it.

### 3.1 The type wheel is nearly folded already

`ui/chip.ts:90` `monTypeChip` is the only trigger. Its comment records why it is
a second function rather than a flag: nine screens take `typeChip` through one
wrapper and pass it to `.map`, so before the chip audit there was no site at
which a Pokemon's type and a gym leader's type could be told apart. The audit
made that site.

So mechanism 2 is one renderer reachable from one chip builder, and M1.2's
remaining work on it is deleting `renderTypeWheel` as a distinct panel and
serving the same content from the type chip's own inspect entry. The
milestone's step one — *"drop the trigger from the two Pokemon panel type
badges"* — is not the work; the chip audit already settled where the wheel is
reachable from, as the discrepancy register's closing note records.

### 3.2 Density modes, and why they are not on this list

R5 forbids *"a verbosity mode as a way to see an explanation."* Density
(`ui/theme/density.ts`, tuning in `src/data/densityTuning.ts`) changes spacing,
stacking and what sits behind a tap, which R6's ruling permits in as many words.
It is not listed as a mechanism because no fact is reachable **only** through it.
That is an assertion this inventory makes and does not prove; proving it is the
census in M0.1, which measures all three modes. **If M0.1 finds a fact present in
Detailed and absent in Pocket, it is an R5 violation and a C2 violation, and it
is a finding for the bible rather than a milestone.**

---

## 4. What this inventory changes about the list

Nothing is built here. Four things the items downstream should carry:

1. **M1.1 is smaller than it reads.** Band and status need no glyph. Type has an
   18-glyph set already drawn and proven. Category is the only family with no
   glyph anywhere in the tree, and it is the one section 9 bets on being
   learnable in three exposures.
2. **M2.1 opens with the 2.3 ruling.** Drop `accuracy` and `priority` from
   `MOVE_FACT_IDS`, or the card renders both twice.
3. **M2.1 also decides the watermark.** Type is already double-rendered on the
   move button, before any glyph work.
4. **M4.1 must not touch `core/moveFacts.ts`.** Two vocabularies, one set of
   words, and only the flag one is M4.1's.
