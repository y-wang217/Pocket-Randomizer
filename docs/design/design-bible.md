# GYMRUN Design Bible: Card and Battle Presentation

Repo home: `docs/design/design-bible.md`. Owner: lead designer. Rev 14, Sept 25, 2026.

**Rev 14** carries three amendments, ruled 2026-09-25 on rows D47 to D49,
filed with the Stage 4.11 plan before it wrote any code and ruled after its
Tier 0 census. **D47**: section 2 gains a twelfth family, **field**, nine
marks for the weather and terrain on the board, and its opening line reads
twelve; section 3 gains a *Field state* row; section 5 gains a *World* row and
the header row names the glyph; section 6 gains a step for a field effect
beginning and ending. **D48**: section 6 gains a step for an ability firing,
with the bound that keeps it an attribute: one keyframe for every ability,
never weighted. **D49, ruled against the recommendation**: C1's one exception
becomes two. The move button's forecast multiplier folds in the field's own
factor for that move, on the reading that a weather multiplier is a fact about
the present board exactly as a type multiplier is. R8's enforce line says the
forecast helper reads the field. Section 9 carries the bet: if a tester reads
the button as telling them what to pick, the factor comes back out. The
census that these rulings followed is
[`../reports/stage-4.11-field-census.md`](../reports/stage-4.11-field-census.md).

**Rev 13** carries one amendment, ruled 2026-09-25 on row D46, filed before
patch 4.10.1 wrote any code. Section 2 gains an eleventh family, **node**, the
kind of a map node as a mark, and its opening line reads eleven. Section 3 gains
a *Node kind* row. Section 4's map node card goes 3 to **2** and the battle
screen header 4 to **3**, each one word lighter for the kind that is now a
glyph; the two notes under the table that argued the kind could have no glyph
are corrected to say what was ruled and why. Section 5's header row names the
glyph, and its map node card row, which had said *node-type glyph* since D29
while section 4 said there was none, is finally true. Section 9's family-size
hypothesis reads eleven and M7.1 tests it. **This is D37's option 2 taken and
D28 reversed as a reversal**, which is how D37 said it would have to be done.
The rules are untouched: R1 is the one rule the amendment invokes, and it is
satisfied rather than bent.

**Rev 12** carries five amendments, all ruled 2026-09-23 on rows D40 to D44,
filed before Tier 6 opened. R2 and R3 each gain a permit for R7's exposure label
on exposures 1 and 3 (D42): section 1 lets the lower-numbered rule win a
conflict, and both rules forbid exactly what R7 requires. Section 4 gains a
**starter card** row and a sentence saying budgets bind the steady-state face
(D40, D44). Section 5's move card serves a seventh card surface, and the
exposure label row says every family passes through the glyph (D40, D41).
Section 7's classroom names the families that screen can actually carry, an
exposure is defined as a painted glyph, and the item order is written down
(D40, D43). No rule's substance moved. Each amendment either writes down what
a rule already assumed, or corrects a table so it agrees with the tree.

**Rev 11** carries two amendments, both ruled 2026-09-22 on row D33. Section
4's **event screen** row goes from 40 to **59**, and for the first time names
every part of the screen it budgets: the hook at 12, four labels at 4, four
hints at 6 — the 52 the ruling composed — plus the Toll's price at 5 and the
control at 2. The old row was *"prompt under 30, choices under 6 each, outcome
one line"*, which is 54 before the outcome and never mentioned the four hints
that were the whole of the overflow, so the row's own composition exceeded the
row's own total and every one of the twenty-four events failed it by a median
of twenty-seven words. The number was wrong rather than the copy — though the
copy was rewritten to the new sub-budgets too, which is milestone M5.6.

The second is section 5: the canon gains the **event choice**, the fifth
surface D29 found budgeted and canonised nowhere. Nothing else moved. In
particular **no rule changed and the remedy section 9 reserves was not taken**:
the capability requirement stayed on the event screen and was re-encoded there
as the glyph and chevron section 3 has specified since Rev 1, which is R2 and
R1 doing their ordinary work, not D8's disconfirmer firing early.

Rev 11 also corrects two counts Rev 9 left behind. R7's enforce line and
section 2's opening still said **nine** families three revisions after D37
added the tenth, which R7's own forbid — *"shipping a glyph family that never
gets a label"* — makes a live omission rather than a typo: M6.1 reads that line
for its scope, and at nine the capability glyph would ship without ever
carrying a label. Section 9's row is corrected with them.

**Rev 10** carries one amendment, ruled 2026-09-22 on row D32: section 4 gains
a **Locale screen** row at 4. It is the fourth surface found carrying words
against no row at all — after the battle screen header (D28), the map node card
(D37) and the two reward kinds M5.1 named — and the pattern is worth stating
once: a budget table written per *component* leaves every screen's own chrome
unbudgeted, and nothing measures what nothing budgets. M7.2 inherits the
question of whether the remaining screens need rows.

**Rev 9** carries two amendments, both ruled 2026-09-22 on row D37. Section 2
gains a **tenth family, capability** — not a new claim, but the family section
3's map-node row has specified since Rev 1 and this roster never carried; the
disagreement survived nine revisions because nothing had to draw it. And
section 4's **map node card** row goes from 0 to **3**: M5.2 assumed a node
type glyph that no section names, and D28 had already ruled that same attribute
a word one day earlier. No rule moved; R1 is the reason the kind is a word on
both surfaces rather than a glyph on one.

**Rev 8** carries two amendments, both ruled 2026-09-22. On **D36**: section
4's reward-card and shop-card rows reach **zero** words, because section 3 —
this document's own single source of truth for at-rest rendering — puts the
name, the effect line and a relic's capability on inspect, and the 8 becomes
the headroom D1 says a budget is. On **D29**: section 5's canon gains the
reward card, the map node card and the locale card, and the party row gains the
capture card as a call site. No rule moved in either: four surfaces that had no
row have one, and a table that disagreed with section 3 was read the way
section 3 claims.

**Rev 7** carries one amendment, ruled 2026-09-22 on row D29: section 5's
canon gains the **confirm band**, which R1 already named, section 4 already
budgeted twice and section 9 already bet on, and which had no row here. The
same entry records that a flow decline and a band cancel are distinguished by
weight rather than by position (milestone M5.5). No rule moved: a component
that had no row has one, which is what D28 did for the battle screen header
the day before.

**Rev 6** carries one amendment, ruled 2026-09-21 on row D28: the battle
screen's **header** gets a budget row and a place in the component canon. It has
carried three facts since Stage 1 — the node kind, the opponent, and, since the
AI tiers patch, how that opponent plays — and no row in this document has ever
said so, which left M4.3 asking a surface to reach zero that was never given a
ceiling. The tier is not droppable: the node card shows the same word before the
click, and a readout that changed between the card and the fight would be worse
than no readout. **No rule moved.** A surface that had no row has one.

**Rev 5** carries two amendments, both ruled 2026-09-21 on rows opened against
Tier 4 and both in section 4. **D23**: R9 binds a hit on a target, so the kinds
that are not outcomes on a target — a priority bracket, a weather change, a turn
a condition prevented — are a second channel beside the one hit flag rather than
competitors inside its precedence, bounded at one per side in protocol order.
**D24**: the flag strip's row means one *flag* per hit, not one word; nine of
the shipped flag words are two or three words, and the row was written to give
R9's one flag a budget at all. **Neither rule moved.** R9 is unchanged and is
the reason D23 reads the way it does: it says *on a target*, and the six kinds
that are not about a target were written a release after it.

**Rev 4** carries one amendment, ruled 2026-09-21 on row D22: the decline
overlay's budget rises from 4 to 6, matching the replace overlay, because both
are `ui/band.ts` and a confirm cannot have fewer than two controls. No rule
moved — a figure that was derived before the component existed was corrected to
the component. Section 9 carries the bet it makes, because a ceiling raised to
fit what shipped is exactly the kind of change that should be watched rather
than trusted.

**Rev 3** carries one amendment, ruled 2026-09-21 on row D19 of
[`bible-discrepancies.md`](bible-discrepancies.md). The ability and the
volatile conditions had no row in section 3, no family in section 2 and no
budget line in section 4, and both render on the battle panel and the party
row. Neither is droppable — an ability decides which move is worth using and a
volatile is the reason a turn did not go as expected — and neither needs a new
family: section 2's Status family absorbs the volatiles, because a volatile is
a thing happening to a Pokemon right now and that is what the family already
means, and the ability gets a row saying it is the one attribute with no glyph,
plus a budget that names it. Section 5's Pokemon panel and Party row rows are
corrected to list what those components draw — including **"four move cards"
where the Party row said "four move chips"**, which is D21a: that row was
written before M2.3 decided what a chip leaves out, and three invariant tests
caught three different fact families going off the party surfaces with the card
face. **None of the twelve rules moved.**

**Rev 2** carries seven amendments, all of them rulings on
[`bible-discrepancies.md`](bible-discrepancies.md), which filed the places this
document and the 4.10 presentation milestones disagreed. Each is marked inline
with its date and its row: D1 (section 4, budgets are ceilings), D3 (section 8,
six violations not four), D5 (sections 3 and 9, coverage carries permanent
signs and no label), D6 (section 5, the priority chevron joins the Pokemon
panel), D7 (section 4, the flag strip gets a budget row), D10 (section 7, coach
marks re-anchor before the Pocket default), D11 (R6 and section 11, a validation
cycle is two rounds). None of the twelve rules changed; six of the seven correct
a table or an ordering that disagreed with a rule, and the seventh (D11) defines
a term R6 already used.

This document is permanent. Stage prompts and patch prompts are disposable. Where a prompt and this document disagree on how an attribute is shown, this document wins. Where they disagree on what an attribute is, the prompt and `data/` win: this document governs presentation only, never generation, balance, or the run log.

Every rule below is a hypothesis with a named disconfirmer in section 9. A rule changes only through the amendment process in section 10, never by a patch quietly doing something else.

---

## 0. The two constraints that outrank everything

**C1. The UI presents attributes, never verdicts.** No recommendation, no score, no "best" marker, no conditional emphasis, no sort that implies rank, no effectiveness against content not yet reached. Two exceptions, both facts about the present board and neither a hint about a future decision: live type effectiveness against the Pokemon currently on the field, and the field multiplier the weather or terrain on the board applies to the move on the button (2026-09-25, D49). (Inherited from Stage 4.5.1 Part 4; the second exception amended 2026-09-25.)

**C2. No fact that changes a decision is removed. It is re-encoded.** A redesign that drops a decision-relevant fact has failed even if it hits every text budget. The density-modes rule "no mode removes a fact" is a special case of this.

Engineering constraints that this document assumes and does not restate: `core/` never imports `ui/`, no `Math.random`, every tunable number lives in `data/`, and every milestone under this document ships with seeded output byte identical and no version axis moved unless the milestone says otherwise.

---

## 1. Twelve rules

Each rule: the rule, what it forbids, how it is enforced. Rules are numbered by priority. When two conflict, the lower number wins.

**R1. Position encodes identity.** Every attribute has one fixed slot on every surface where it appears. Base power is in the same corner of a battle button, a reward card, a TM card, a party row chip and a confirm overlay.
Forbids: moving an attribute between surfaces; a "compact variant" that reorders slots.
Enforce: one shared component per attribute cluster (section 5). A surface that positions an attribute itself instead of mounting the component is a defect.

**R2. Numbers stay. Labels go. Sentences go.** "90" is not text load. "BP 90" is. "Physical" beside a fist glyph is.
Forbids: field labels at rest ("Type", "BP", "PP", "BAND", "HP", "Acc"); any sentence on a card at rest; type names and category words at rest.
Permits: R7's exposure label, on exposures 1 and 3 only (2026-09-23, D42). It is transient by R7's own terms, and section 4 budgets the steady state.
Enforce: the text census (section 4) counts words at rest, excluding proper nouns and bare numbers. Budget breaches fail the milestone.

**R3. One fact, one channel, per surface.** Never render the same attribute twice on one surface at rest.
Forbids: type glyph plus type name; category glyph plus category word; band pips plus a band number; a stat as both bar and label where the label is a word.
Permits: glyph plus number (a fist and a 90 are two facts, category and power). R7's exposure label beside its glyph, on exposures 1 and 3 only (2026-09-23, D42): R3 outranks R7, so without this line the label would be forbidden by the rule it is meant to sit under.
Enforce: the redundancy audit in the glyph inventory (milestone M0.2) lists every double render; each one is a bug.

**R4. Exception-based display.** Show a value only when it departs from the default.
Defaults that render nothing: accuracy 100, priority 0, stat stage 0, no status, no item, neutral effectiveness.
Forbids: "Acc 100", "Priority 0", empty status slots, a neutral effectiveness marker.
Enforce: the encoding table (section 3) names the default per attribute; a test asserts the default renders no node.
Ruling on never-miss moves: absence means "100 and applies". A move that cannot miss (Swift, Aerial Ace, Shock Wave) shows a distinct never-miss glyph, because evasion stages are visible and a 100-accuracy move can miss against them while a never-miss move cannot. This closes the carried "always-hits marker" item.

**R5. One inspect gesture, one layer.** Long press on any card, chip, glyph, badge or pip opens its full explanation, in one docked sheet at the top of the viewport. The sheet stays open on release and closes on a tap anywhere outside it, on its own close control, or on Escape. Tap still selects. There is exactly one mechanism, and it is fed by `describeMove`, `bandInfo`, `statusInfo`, `categoryInfo` and the type chart, never by copy written into a screen.
Forbids: a type wheel, a band tooltip, a move popup, a legend screen, a help button, or a verbosity mode as a way to see an explanation. Opening inspect during battle must never submit a move, and neither must closing it. A panel positioned beside its trigger. Selectable text under a trigger.
Enforce: a test asserts one tooltip mechanism exists; a test asserts opening inspect on a move button does not advance the turn; a test asserts the tap that closes the sheet reaches nothing under it; a test asserts the stylesheet declines selection and the touch callout.
Amended 2026-09-25 (the docked sheet patch). The rule read *"Release closes"* and the panel opened beside its trigger, sized to its content. The author's playtest on an iPhone found the panel under the thumb and too small to read, and found that iOS took the long press as text selection, whose callout cancelled the pointer and closed the panel. **This was not a registered disconfirmer**: the R5 row in section 9 names accidental submission, and no submission happened. The author's directive amended the clause directly, and the row in [`playtest-log.md`](playtest-log.md) records the observation as the log requires. The hold, and what it eats, are unchanged.

**R6. The default face is the compact face.** What a card shows at rest is the compact encoding in section 3. The full version is what inspect opens, not what a setting enables.
Forbids: shipping two card faces; a setting that adds words to a card at rest.
Ruling on density modes (Detailed, Simple, Pocket): the card face this document specifies is the Pocket face. Pocket becomes the default. Simple and Detailed stay for one validation cycle and are retired if the disconfirmer in section 9 does not fire. Density modes may change spacing, stacking and whether a secondary fact sits behind a tap. They never change the encoding of a fact.
Amended 2026-09-19 (D11). **A validation cycle is two rounds of the section 10 playtest protocol**, three testers each, at least one with no Pokemon knowledge. It is the same two rounds milestone M7.1 runs, and the glossary carries the term.

**R7. The first exposure carries the label, the tenth does not.** The first time a glyph family appears for this player, a small label renders beside it for that screen. The label returns once more on the third exposure, then never. Exposure count persists across runs in the settings store, beside the tutorial flags.
Forbids: permanent labels on glyphs; shipping a glyph family that never gets a label.
Enforce: ten glyph families are tracked (type, category, band, PP, accuracy, priority, effectiveness, status, stat, capability). A test asserts each family's label renders on exposure 1 and 3 and not on exposure 4. The tenth was added 2026-09-22 (D37); this line and the count below still read nine until M5.6 found them, which is why R7's own forbid — *"shipping a glyph family that never gets a label"* — is the reason they are corrected rather than left.

**R8. Forecast on the button, feedback on the target, same vocabulary, never the same place.** Pre-selection effectiveness sits on the move button (the C1 exception). Post-resolution outcomes appear on the Pokemon that was hit, in resolution order.
Forbids: rendering post-resolution flags on move buttons; rendering the forecast on the opponent panel; deriving one from the other.
Enforce: the forecast comes from the core effectiveness helper, which reads the field since D49 (2026-09-25); feedback comes from the protocol-to-flags mapper. They share a colour family and a glyph family and nothing else.

**R9. One flag per hit.** After resolution, at most one flag appears on a target, by fixed precedence: no effect, miss, super effective or not very effective, critical, status inflicted, berry fired, stat stage changed. STAB and contact are causes, not outcomes, and never get a flag.
Forbids: stacking flags on one hit; a flag for a cause.
Enforce: the mapper returns a list; the renderer takes the first by precedence. Precedence order lives in `data/tuning.ts`. Note: recoil, drain and multi-hit fired zero times over 699 measured battles and are not in the vocabulary. Add a flag kind only from measurement.

**R10. Bars compare members, never options.** Six stats as glyph, bar and number across party members is an attribute readout. Emphasising the stat that matches the current decision is a verdict.
Forbids: highlighting Atk because the incoming move is Physical; sorting recipients by fit; projected damage on a recipient card.
Enforce: the recipient and teach screens mount the party stat component unchanged, in party order.

**R11. The log is never rendered at rest.** The battle log lives in the log sheet, reachable by a pull, kept for bug reports and determinism. The battle screen shows the turn header, the panels, the flags and nothing written.
Forbids: a scrolling log on the battle screen; a text line for turn order.

**R12. If a concept cannot be encoded without a sentence, restructure the concept.** Applies to the coverage line, the decline copy, the item effect line, and any future readout.
Forbids: adding a sentence to a card because the concept was hard to draw.
Enforce: the amendment process. A proposed sentence at rest is an amendment, not a patch.

---

## 2. Canonical vocabulary

Twelve glyph families (2026-09-25, D47; eleven under D46 the same day, ten under D37, 2026-09-22). Adding a thirteenth is an amendment.

| Family | Glyphs | Colour |
|---|---|---|
| Type | 18 glyphs inside a coloured chip | Genre-standard type colours, colour-blind checked; glyph is primary, colour secondary |
| Category | Fist (Physical), ring (Special), wave (Status). Same glyph on the Atk and SpA stat rows | Neutral |
| Band | One pip per band, filled to band. Pip count is read from `bandInfo`, never hardcoded (five today) | Neutral. No glow, no colour shift by band |
| PP | Small PP glyph, remaining number, max dimmed | Neutral |
| Accuracy | Target glyph plus number, under 100 only. Never-miss glyph for moves that cannot miss | Neutral |
| Priority | Up or down chevron beside the move name, nonzero only. Same chevron on the panel when a bracket decided the turn | Neutral |
| Effectiveness | Coloured left edge on the button plus the multiplier as a fraction or numeral (¼, ½, 2, 4). Neutral shows nothing. The same colour on the feedback flag | Red/green family, colour-blind checked |
| Status | Three-letter chip: BRN, PAR, PSN, TOX, SLP, FRZ. Fixed colour each. One per volatile condition on the same pattern, and **not a tenth family** (2026-09-21, D19): a volatile is a thing happening to this Pokemon right now, which is what this family already means, and it takes the same shape, the same slot rule and the same inspect text | Genre-standard |
| Stat | Six stat glyphs. Stage as multiplier plus ladder bar (shipped in 4.8.0.3), nonzero only | Neutral |
| Capability | One glyph per capability, plus a band chevron filled to the run's reach — none, latent, known (2026-09-22, D37) | Neutral |
| Node | One glyph per node kind: a head (trainer), a bush (wild), a tent (rest), a badge (gym), a bag (shop), a question mark (event). On the map node card at 24, on the battle screen header at 16 (2026-09-25, D46) | Neutral |
| Field | Nine glyphs for the state of the board: rain, sun, sand, snow, strong winds, and the four terrains. Heavy rain and Extreme sun wear the rain and sun marks and differ on inspect. At 16 in a fixed slot on the battle screen header, dimmed while an ability suppresses the weather. The world behind the stage carries the same state as a wash and a terrain tint, colour secondary to the glyph (2026-09-25, D47) | Neutral glyph; the wash and tint are global tokens mixed into the locale's own three |

Font: Pixelify Sans, blanket, per the 4.7.1 decision. If the numeral font jitters on HP and PP counters, `--font-numeral` falls back to the mono stack, one line, and this table is annotated.

---

## 3. Encoding table

The single source of truth for how each attribute renders at rest. Inspect shows everything in the last column.

| Attribute | At rest | Default (renders nothing) | On inspect |
|---|---|---|---|
| Type | Type chip | None | Type name, matchups |
| Category | Category glyph | None | Category word, what it means for Atk vs SpA |
| Base power | Bare number, largest text on the card, fixed slot | None | Same, plus per-hit power for multi-hit moves |
| PP | Number beside PP glyph, max dimmed. Reward, TM and recipient cards show max only | None | Max and remaining |
| Band | Pip strip | None | Band definition line from `bandInfo` |
| Accuracy | Number beside target glyph | 100 | Accuracy, evasion interaction |
| Priority | Chevron | 0 | Bracket value |
| Effectiveness (forecast) | Edge colour plus multiplier on the button. The multiplier folds in the field's factor for the move: Surf under rain reads its type factor times 1.5 (2026-09-25, D49) | Neutral, with the field folded in | Full type interaction, and the field's part of it |
| Effectiveness (feedback) | One word on the target, edge colour family | Neutral | Log sheet entry |
| Status | Three-letter chip | None | Full name, effect |
| Volatile condition | Three-letter chip, same family and same slot rule as Status, one per condition | None | Full name, effect, from `statusInfo` (2026-09-21, D19) |
| Ability | Name, in a fixed slot. The one attribute with no glyph and no shorthand: abilities are a pool, not a family | Absent. An unrevealed opponent's renders a `?` in the slot rather than nothing, because held-and-unknown is not the same fact as none | Full text, from `abilityOverrides` (2026-09-21, D19) |
| Stat stages | Multiplier plus ladder, nonzero only | 0 | Stage count, source |
| Six stats | Glyph, bar, number. Always all six. Party order | Never hidden | Stat definition |
| Held item | Item sprite in a fixed slot | Empty slot renders nothing | Name, one effect line |
| Berry | Berry sprite, same slot | Empty slot renders nothing | Name, trigger condition (the one place a sentence survives) |
| Relic | Relic sprite in the relic row | None | Name, capability it satisfies |
| Coverage change (capture card) | Two rows of type chips, plus row and minus row, signs only. The signs are permanent, not an exposure label: coverage is not a glyph family (2026-09-19, D5) | Empty row renders nothing | The full before and after sets |
| Capability requirement (map node) | Capability glyph plus band chevron (none, latent, known) | None | Capability name, what satisfies it |
| Tier (map node) | Tier pips, reward-tier pips | None | Tier definition |
| Field state (weather, terrain) | Field glyph at 16 on the battle screen header; the world's wash and terrain tint behind the stage. Turns remaining are never shown (2026-09-25, D47) | None: the locale's own world, no glyph | Name and effect line, from `fieldCopy`; under suppression, which ability holds it off |
| Node kind (map node, battle header) | Kind glyph. A gym's leader name beside it, a proper noun, is the identity and not the kind (2026-09-25, D46) | Never hidden | The kind's hint, from `KIND_HINTS` |
| Archetype | Not rendered where the stat bars already draw it (4.8.0.3) | Absent | Not on inspect either; it is a derived label and can lie under randomization |

Disappears from every default view: field labels, type names, category words, accuracy at 100, priority at 0, item names, the coverage sentence, the battle log.

---

## 4. Surface text budgets

Words at rest, excluding proper nouns and bare numbers. The census (milestone M0.1) records the current count; the budget is the ceiling after the milestone that touches the surface. A surface over budget is not done.

| Surface | Budget | Words that survive |
|---|---|---|
| Battle move button | 0 | Name |
| Move card (reward, TM shelf, recipient, replacement, confirm) | 0 | Name |
| Move chip (compact list form) | 0 | Name |
| Item, berry or relic reward card | 8 | **None** — the face is the sprite; name and effect line are inspect facts (2026-09-22, D36) |
| Recipient / teach target card | 0 | Species name |
| Party row and party drawer | 0 plus the ability name | Species name, nickname, ability name (2026-09-21, D19) |
| Pokemon battle panel | 0 plus the ability name | Name, nickname, ability name (2026-09-21, D19) |
| Flag strip (battle) | 1 flag per hit, plus 1 non-hit kind per side | The one flag R9 allows, and the second channel (2026-09-21, D23 and D24) |
| Battle screen header | 3 | Opponent, AI tier; the kind is the node glyph (2026-09-25, D46; was 4 under D28, 2026-09-21). The field glyph is a glyph and costs nothing (2026-09-25, D47) |
| World behind the stage | 0 | None. The field state is a wash and a tint, never a word (2026-09-25, D47) |
| Result screen | 6 | Outcome word, "+N", continue |
| Capture card | 0 | Follows the recipient card |
| Event screen | 59 | Hook 12, four labels 4, four hints 6 — 52 — plus the Toll's price 5 and the control 2. The requirement, the band and the reward tier are glyphs (2026-09-22, D33) |
| Locale card | 0 | Locale name plus four type chips |
| Locale screen | 4 | The instruction (2026-09-22, D32) |
| Starter card | 0 plus the ability name | Species name, ability name. The moves are move cards and the stats are the stat block (2026-09-23, D40) |
| Pre-gym screen | 4 | Gym leader name, type chip, "Choose lead" |
| Confirm overlay (replace) | 6 | "Replace Tackle with Fire Punch?" |
| Confirm overlay (decline) | 6 | "Forfeit this reward?", and the band's two controls (2026-09-21, D22) |
| Map node card | 2 | The payout's unit, AI tier; the kind is the node glyph (2026-09-25, D46; was 3 under D37, 2026-09-22) |
| Shop stock card | 8 | **None** — one component with the reward card since M5.1, plus a bare price number (2026-09-22, D29 and D36) |
| Summary and graveyard | Unbudgeted | Archive surfaces; complete outcome in the first screenful |

The event screen is the only decision surface where prose is load-bearing. Everything else reaches zero sentences.

**Budgets bind the steady state** (2026-09-23, D44). R7's exposure labels are on a surface for two visits per family and then never again, so the census measures every surface with every family's labels already used up, and records the first-run face in a separate column that gates nothing.

**The ability is the one attribute budgeted by name rather than by count**
(ruled 2026-09-21, D19). It has no glyph and cannot be given one — `Levitate`,
`Flash Fire` and `Wonder Guard` each change which move is worth using this
turn, and there are as many of them as there are abilities in the pool — so R2
has nothing to trade the word for, and the budget says so rather than
pretending the word is not there. Volatile conditions are not budgeted
separately: they are three-letter chips in the Status family, and the counting
rule already treats a three-letter chip as the glyph rather than as a word.

**The decline overlay's 4 became 6** (ruled 2026-09-21, D22), which is the
replace overlay's figure, because the two are the same component doing the same
job. D1's audit had already read that row as *"Counting the rule as written:
3"* — the 4 was derived from the question alone, and `ui/band.ts` did not exist
when it was written. A confirm cannot have fewer than two controls, so the
question plus `Forfeit` and `Keep` is 5 against a ceiling of 4, and the number
was wrong rather than the overlay. Section 9 carries the bet this makes.

**The flag strip is budgeted in flags, not in words** (ruled 2026-09-21, D24).
`Super effective` and `Not very effective` are one flag each; the row was added
by D7 because R9 puts a flag on every hit and no surface budgeted it, and it
counts R9's flag rather than counting to one word. **The second channel is the
other half of the same row** (ruled 2026-09-21, D23): a priority bracket, a
weather change, an ability firing and a turn a condition prevented are not
outcomes on a target, so R9's precedence does not rank them and they render
beside the hit flag — at most one per side, in the protocol's own order. The
bound is what keeps the row a budget: without it the second channel is the
unbounded strip R9 was written against.

**The battle screen's header is budgeted at 3** (ruled 2026-09-25, D46; 4 under
D28, 2026-09-21), for the three facts it has carried since Stage 1: which node
this is, who is in it, and how that opponent plays. The first is the node glyph
since D46, the same mark the card wore before the click, because R1 forbids one
attribute encoded two ways on two surfaces. The third has no glyph and cannot be
given one — the families are attributes of a Pokemon, a move or a node, and an
AI tier is none of those — so R2 has nothing to trade its word for, exactly as
it has nothing to trade the ability name for one row above.

**The locale screen has a row now** (ruled 2026-09-22, D32). M5.3's done-when
read *"census reads 0 and 4"*, taking the first number from the *Locale card*
row and the second from the *Pre-gym screen* row — a component and a screen.
The locale screen itself was budgeted nowhere and carried ~30 words of chrome
above a card row budgeted at 0: a heading, an explanation of what a region
decides, the gym rail's label, and a party strip drawing a derived archetype
label six times. It is 4, the pre-gym screen's own figure, because it is the
same job on the same kind of surface — name the thing you are about to walk
into, and choose. Measured after the cut: **3**.

**The map node card is budgeted at 2, where it read 3 and before that 0**
(ruled 2026-09-25, D46; 3 under D37, 2026-09-22). M5.2 assumed zero on the
strength of a *node type glyph*, and D37 ruled there was none: section 2's
families were attributes of a Pokemon or a move, and a node kind was neither,
which was D28's reasoning one day earlier for keeping the same attribute a
**word** on the battle screen header. Encoding it one way here and another
there is what R1 forbids, so D37 kept the kind a word on both and budgeted the
card at 3, measured before the number was chosen. D46 took D37's own option 2:
the eleventh family is the node kind, it is a glyph on both surfaces, and the
two that survive are the unit word on the payout and the AI tier — the last
budgeted by name on the header already, for the same reason.

**The two card rows reach zero, and their 8 is headroom** (ruled 2026-09-22,
D36). Section 3 is this document's *"single source of truth for how each
attribute renders at rest"*, and its Held item, Berry and Relic rows put the
name, the effect line and a relic's capability in the **inspect** column. This
section's *words that survive* column said *"One effect line"*, and the two
disagreed for six revisions without anything noticing, because nothing measured
a card on its own until D30 gave the census a row for one. Section 3 wins, on
its own claim to the at-rest question; the figures stay where they are, as the
headroom D1 says a budget is when it is larger than the surviving words can
reach. **A relic card is the one deviation and it is recorded rather than
absorbed**: no relic sprite exists in the tree, so its name is the encoding —
a proper noun, which this section's counting rule excludes, so the card still
reads zero.

**Two reward kinds have no row in this table at all**: a coins card and a
restore card. Found by M5.1, which does not name them and left them untouched,
and recorded here so the gap is visible rather than inferred from silence. It
is the same shape as the battle header before D28 and the locale screen before
D32, and it belongs to M7.2.

**Every figure in this table is a ceiling, not a target** (ruled 2026-09-19, D1). A surface under its budget is done; a surface over it is not. The counting rule in this section's header stands as written — proper nouns and bare numbers are excluded — and where a budget is larger than the words that survive can reach, the difference is headroom, not a quota. The flag strip row is the one budget stated per event rather than per surface: one flag per hit, and the battle screen's own budget excludes it.

---

## 5. Component canon

One component per attribute cluster. A screen mounts components; it never draws an attribute itself.

| Component | Owns | Call sites today |
|---|---|---|
| Move card | Name, type chip, category glyph, BP, PP, band pips, accuracy, priority, describeMove icon strip | `moveFacts` (seven card surfaces; starter select added 2026-09-23, D40) and `renderMove` (battle button). Two call sites is the accepted shape; a third is an amendment |
| Move chip | Name, type chip, category glyph, BP | Replacement and teach lists |
| Stat block | Six rows of glyph, bar, number | Party drawer, recipient, capture, pre-gym |
| Pokemon panel | Name, level, gender, HP bar and number, status chips, volatile chips, ability name, stat stage ladder, item sprite, priority chevron (2026-09-19, D6; volatiles and ability 2026-09-21, D19) | Battle |
| Party row | Species, level, gender, HP bar and number, status chips, ability name, item sprite, the stat block, four move cards | Drawer, party screen, pre-gym, map rail, teach target, **capture card** (call sites corrected 2026-09-21; ability, gender and the block, D19 and M3.2; **cards not chips**, D21a re-ruled 2026-09-21; capture added 2026-09-22, D29, and M5.4 is the item that makes it true) |
| Type chip | Glyph in colour | Everywhere a type appears |
| Inspect layer | The full explanation of whatever was long-pressed | One mechanism, mounted at the shell |
| Flag strip | One flag per hit by R9's precedence, plus one non-hit kind per side (2026-09-21, D23) | Battle |
| Battle screen header | Node glyph at 16, opponent, AI tier, field glyph at 16 in a fixed slot after the tier (2026-09-25, D46 and D47; the kind was a word under D28, 2026-09-21) | Battle |
| World | The locale's three layers and drift, and during a battle the field state as a weather wash and a terrain tint, global tokens mixed into the locale's own (2026-09-25, D47) | Every screen, mounted once by `app.ts`; the field state on the battle screen only |
| Reward card | The item or berry sprite in a fixed slot, a relic's name, the boosted type chip, the move card on a move kind, and the shop's price number (2026-09-22, D29 and D36) | `screens/result.ts` and `screens/shop.ts`. Two call sites, one component: the shelf mounted its own copy until M5.1 |
| Map node card | Node glyph at 24 with the leader's name on a gym, then beneath it the tier pips, reward-tier pips, capability glyph with band chevron (2026-09-22, D29; the glyph exists and the pips sit beneath it since 2026-09-25, D46) | The map screen and the map drawer |
| Locale card | Locale name, four type chips, the palette swatch (2026-09-22, D29) | The locale screen |
| Confirm band | The question, an optional line, the content being traded, and exactly two controls: the one that commits and the way out (2026-09-22, D29) | `ui/band.ts`, mounted by the four screens that confirm. No screen builds its own |
| Event choice | The label, the hint, the reward-tier pips and the Toll's price. The requirement and the band sit above the choices, as the map node card's glyph and chevron (2026-09-22, D33) | `screens/event.ts`. One surface, and the only one section 4 budgets prose on |
| Exposure label | The first-encounter label for a glyph family | Rendered by the glyph, driven by the exposure store. Every family's marks pass through the glyph renderer, band pips, status lettering and the effectiveness edge included, so a family cannot be drawn without reporting itself (2026-09-23, D41) |

A component that exists twice, or a screen that draws a stat without the stat block, is the defect this document exists to prevent.

**Four card surfaces were budgeted and canonised nowhere** (added 2026-09-22
under D29). Section 4 budgets a reward card, a shop stock card, a map node card
and a locale card; this table named none of them, while its own closing line
forbids exactly what that silence allowed. `renderRewardCard` had **one** call
site and `screens/shop.ts` built its own `.shop__item` from scratch — one
component existing twice, on the two surfaces section 4 says are the same
thing. The capture card is the other half: it wears `.party__member` and
hand-builds its contents, so it is a screen drawing a stat without the stat
block while looking like it is not.

**The confirm band was budgeted twice, bet on once, and canonised nowhere**
(added 2026-09-22 under D29's ruling). R1 names it — *"base power is in the
same corner of a battle button, a reward card, a TM card, a party row chip and
a confirm overlay"* — section 4 gives it two rows, and section 9 carries D22's
bet about its two controls. It had no row here, which is how a component with
four call sites came to read `absent` in the census for four tiers.

**A flow decline is not a band cancel, and the two are told apart by weight,
never by position** (2026-09-22, M5.5). A band cancel backs out of a confirm
and changes nothing; a flow decline answers the screen's question with "none"
and moves the run on. They are on screen together only while the band is up,
and for that time the decline carries no live weight, so the band's own pair is
the only live control — the same rule the primaries behind a band already
follow. R1 holds because nothing moves: the decline keeps its slot, its hit
area and its place in tab order.

---

## 6. Battle turn grammar

In resolution order, on a 390x844 phone. Timings are the numbers already in `data/tuning.ts` and the Swift/Even/Patient setting; this section adds no time.

1. Turn header replaces itself in place. "Turn 4". No scroll.
2. First actor jiggles. If a bracket decided the order, the priority chevron flashes on that panel. Same-bracket turns are unmarked, matching the log rule.
3. An ability fires: the ability name pulses on its panel, one keyframe for every ability, never weighted, never coloured. Intimidate and Drizzle are drawn identically. An ability that announces itself through an activation line is the same event (2026-09-25, D48).
4. A field effect begins: the world takes the weather's wash or the terrain's tint and the field glyph appears on the header. When it ends, both leave. No words. The event flag and the sweep on the causing actor are the *event*; the wash and the glyph are the *state*, the same split as the status chip and the *Burned* flag (2026-09-25, D47).
5. Hit lands. HP drops as a chunk with the fading shadow. A damage number rises. One flag by R9 precedence.
6. Status chip appears on the panel the moment it is inflicted. Nothing written.
7. Berry fires: sprite pops, flag names it, sprite disappears.
8. Second actor. Steps 2 to 7.
9. Stat stage change: ladder moves with a short pulse. No words.

Steps 3 and 4 run on the opening batch too, before "Turn 1": over half of all field starts and nearly half of all ability announcements land there (2026-09-25, D47 and D48, from the Tier 0 census).

The log sheet records all of it for the player who pulls it down and for bug reports.

---

## 7. Onboarding

Three mechanisms, each with one job. A fourth is an amendment.

- **Coach marks** (shipped, 29 marks over 8 screens) explain screens: what this screen is for and where the decision is.
- **Exposure labels** (R7) explain glyphs: what this symbol means, the first and third time you see it.
- **Inspect** (R5) explains things: what this move, item, status or band does, on demand, forever.

Starter select is the classroom: it has no clock, three full cards, and every glyph family a move and a stat block can carry. On a first run every glyph on that screen carries its label. A player who reads three starter cards has seen category, type, band, PP and the six stats with words once, and accuracy and priority when a starter's move departs from the default. Effectiveness, status and capability need an opponent or a map, and are labelled where they first appear. Corrected 2026-09-23 (D40): this paragraph used to say "every glyph family present", which no screen without an opponent can be.

**An exposure is a painted glyph** (2026-09-23, D43). A screen that shows a family's word instead of its glyph, as Detailed and Simple do, does not count toward that family. A player who meets the glyphs later still gets both labels.

All three persist in the settings store. Coach marks forced Detailed per screen until milestone M6.2 deleted the rule (2026-09-23); they now show in the player's own mode, and their copy explains the screen, leaving the glyphs to the exposure labels. Amended 2026-09-19 (D10): **before Pocket becomes the default**, coach marks re-anchor to the Pocket face and the forced-Detailed rule is deleted, so the flip lands on marks that are already anchored to the face they will be read against. Amended 2026-09-23 (D43): exposure labels land **after** both, since while the guard stands the classroom is in Detailed on run one and paints no glyph to label. Tier 6's order is M6.0, M6.2, M6.3, M6.1.

Rejected: a no-label first session (category is not guessable by a non-player); a legend button (a mechanism the player must know exists).

---

## 8. Copy rules for the words that remain

- State outcomes, not advice. "Forfeit this reward?" not "Are you sure? This is usually a bad idea."
- Item effect line: under eight words, no "Effect:" prefix, no second clause. "Heals 1/16 max HP each turn." not "Restores a small amount of HP at the end of every turn, useful for bulky Pokemon."
- Event prompt: under 30 words, two lines on 390px. Choices under six words. Outcome under one line.
- Never a hedge word (risky, safe, strong, weak, good, bad, worth) on any surface. Amended 2026-09-19 (D3), **closed 2026-09-20 (M0.3) at nine violations, not four and not six.** Six were found by reading: `categoryInfo.ts:48`, `statusInfo.ts:125`, `:139`, `:171`, `:242`, and `bandInfo.ts:75` (the line the original four-item list gave as `bandInfo.ts:68`, which is now a band label). Three more appeared only once **worth** was on the word list, which this sentence had asked for and the shipped lint had not carried: `statusInfo.ts:72`, `:202`, `:231`. The rule found them; the enforcement had not been built yet. The lint carries no allowlist: `statusInfo.ts:88`'s label was renamed to "Toxic", matching the TOX chip in section 2, rather than exempted. All nine are rewritten; the lint is `scripts/hedge-lint.ts`, the words are `src/data/forbiddenWords.ts`, and `test/hedge-lint.test.ts` holds it.
- **The lint reads string literals, never comments.** A comment is not a surface, and a rule whose enforcement outlawed the prose documenting it would be a rule that could not be explained in its own repo.
- No em-dashes in any player-facing string.

---

## 9. Hypothesis register

Every rule is a bet. The observation that loses it is written here, and section 10 says what happens then.

| Rule | Disconfirmed if | Then |
|---|---|---|
| R2, category glyph learnable in three exposures | Testers open inspect on category more than twice in run two, or Special-move-on-high-Atk picks do not fall between run one and run three | Category word returns permanently; budget rises by one on every move surface |
| R4, hidden accuracy reads as 100 | A tester asks "does this always hit?" after the exposure label has fired | Accuracy renders always, as a number |
| R4, never-miss glyph is distinct from absent | Testers cannot say which of two moves cannot miss | Never-miss becomes a number-slot word "sure" |
| R9, one flag per hit | Testers cannot say why a hit did what it did, and the missing fact is one precedence dropped | Precedence gains a second slot for the dropped kind |
| Band pips and base power do not read as two ratings | A tester says "a 4 and a 90" as independent scores, or asks which matters | Pips move behind inspect; band rests as a single small numeral |
| Coverage rows read as gain and loss | A tester cannot say which row is added | Add the two words |
| R5, long press never submits | Any accidental submission during inspect in playtest | Inspect moves to two-finger tap |
| R5, the docked sheet reads as dismissable (2026-09-25) | A tester holds, releases, and is stuck with the sheet up, or taps a move to close it and is surprised that nothing was chosen | The scrim dims, so the sheet reads as modal; a second failure returns a visible "tap anywhere to close" line under the text budget |
| R6, Pocket default and retiring Simple/Detailed loses nothing | A tester asks for all numbers always visible | A single "numbers on stats" setting returns, not a global mode |
| Event screen holds at 59 words (2026-09-22, D33; was 40) | Rejigged events with four reward tiers need more than two lines to state requirement and choice | Requirement moves to the map node glyph; prompt shrinks |
| Six-word hints carry the shape of a risk (2026-09-22, D33) | A tester cannot say which of two options is the variable one, or presses a button expecting no cost and is charged | The hints go back up, and the row rises with them rather than the hints being dropped |
| Move chips suffice for the discard decision | Testers expand every chip to a full card before choosing | Chips gain PP at rest, still no words |
| Twelve glyph families is the right size (2026-09-25, D47; eleven under D46, ten under D37, 2026-09-22) | Testers confuse any two glyphs after labels fade | One of the pair becomes a word permanently |
| Reward-tier pips read as a range, not a rating (2026-09-22, D33) | A tester reads more filled pips as a recommendation, or cannot say which options can pay the same thing | The tier letters return beside the pips, and the row rises by four |
| The field factor on the button reads as a fact, not a hint (2026-09-25, D49) | A tester says the button is telling them what to pick, or picks a field-boosted move into an immunity and says the number sent them | The multiplier returns to the plain type factor and the field's part of it moves to inspect |
| R7, three exposures is the right count | Inspect rate on a family has not fallen by run three | Count becomes a tuning number per family |
| A confirm's two controls belong inside its budget (2026-09-21, D22) | A confirm overlay reaches 6 with copy that reads as padded, or a third control is ever needed on one | The controls are excluded from the count and every confirm budget drops by two, rather than the ceiling rising again |

**Retiring Simple and Detailed is open** (recorded 2026-09-23, milestone M6.3). Pocket is the default for new installs since M6.3, and an existing store keeps the mode it was showing. The R6 row above decides retirement after the validation cycle M7.1 runs, and M6.4 carries out whichever way it falls.

The "three exposures" figure is a design guess with no study behind it. Everything else in this table has a precedent or a finding named in the research brief.

---

## 10. Amendment process

1. A rule changes only when its disconfirmer in section 9 has been observed in a playtest and recorded in `docs/design/playtest-log.md` with the date, the tester count and the observation.
2. The amendment is a PR to this file, with the register row updated and the rule's revision date added.
3. A milestone that finds it needs a sentence at rest, a second mechanism, a tenth glyph family or a third move-card call site stops and files an amendment before building.
4. A patch prompt never overrides this document by saying so. If a prompt and this document conflict on presentation, the prompt is wrong until amended here.

---

## 11. Glossary

- **At rest**: what a surface shows with nothing pressed, hovered or expanded.
- **Inspect**: the single long-press layer (R5), a docked sheet since 2026-09-25.
- **Exposure label**: the first-encounter word beside a glyph (R7).
- **Forecast**: effectiveness shown before the choice, on the button.
- **Feedback**: what the protocol says happened, on the target.
- **Flag**: one word of feedback (R9).
- **Chip**: a small fixed-shape element carrying one fact (type chip, status chip, move chip).
- **Pip**: one filled or empty dot in a strip (band, tier).
- **Census**: the measured word count at rest per surface (section 4).
- **Validation cycle**: two rounds of the section 10 playtest protocol, three testers each, at least one with no Pokemon knowledge. What R6 waits for before Simple and Detailed are retired, and what milestone M7.1 runs.
