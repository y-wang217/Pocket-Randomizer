# Bible discrepancies: the 4.10 presentation milestones

Rev 4, Sept 22, 2026. Opened against
[`../spec/gymrun-presentation-milestones.md`](../spec/gymrun-presentation-milestones.md)
Rev 1 and [`design-bible.md`](design-bible.md) Rev 1.

**The bible wins in every case.** This file does not resolve anything. It states
each conflict exactly, names the bible section and the milestone line that
disagree, and gives the options. The lead designer rules case by case; a ruling
becomes either an amendment to the bible under its section 10, or an edit to the
milestone under `docs/generation.md`'s deviation note rule. Until a row is ruled,
the item it blocks is not built.

Rows are ordered by what they block, not by severity. D1 to D3 block Tier 0,
which blocks everything.

| ID | Blocks | One line | Ruled |
|---|---|---|---|
| D1 | M0.1, then M3.3, M5.3, M5.4, M5.5 | The budget numbers do not reconcile with the counting rule | **2026-09-19** |
| D2 | M0.1 | The census counts screens; the budgets are written per component | **2026-09-20** |
| D3 | M0.3 | There are six verdict-copy violations, not four, and one false positive | **2026-09-19**; built 09-20, and it was **nine** |
| D4 | M1.2 | The inspect acceptance test is narrower than R5 | **2026-09-19** |
| D5 | M5.4, M6.1 | The coverage rows need a tenth glyph family | **2026-09-19** |
| D6 | M3.1 | The component canon omits the priority chevron that R9 and section 6 require | **2026-09-19** |
| D7 | M4.3 | The flag strip's one word has no budget row | **2026-09-19** |
| D8 | M5.6 | The item pre-authorises a remedy the bible reserves for amendment | **2026-09-20** |
| D9 | M2.2 | The tree ships two move-button faces; R6 forbids two faces | **2026-09-19**, closed **2026-09-20**: column mode deleted |
| D10 | M6.2, M6.3 | The items are ordered against section 7 | **2026-09-19** |
| D11 | M6.4 | "One validation cycle" and "two playtest rounds" are not defined as equal | **2026-09-19** |
| D12 | M4.1, M5.1, M6.1 | Three items move `contentHash`, which the standing gates forbid | **2026-09-19** |
| D13 | process | "One item, one PR" against the single 4.10 pull request | **2026-09-19** |
| D14 | M0.3 (closed around it), then M5.6 | Two event sentences break section 8, and `data/events.ts` is inside `contentHash` | **2026-09-22**, option 2, with M5.1's half |
| D15 | M1.2 (closed around it), then M2.1 | The `Explain` expander is a second explanation mechanism, and no item removes it | **2026-09-20** |
| D16 | M2.1 | Pocket reaches its word count by hiding four facts, which is C2, and M2.1 does not say which modes its zero binds | **2026-09-20** |
| D17 | M2.1 done-when, then M7.2 | The census cannot read 0 on a move face: the strip's icons and a split number are counted as words, and the status readout is a sentence the item keeps | **2026-09-20** |
| D18 | M3.1, then M3.2 | The archetype chip has no row in the canon, and deleting it takes the opponent's build off the battle screen | **2026-09-21** |
| D19 | nothing; timed with M3.2 | The ability and the volatile chips have no row anywhere in the bible | **deferred to M3.2** |
| D20 | M3.2 | There are two six-stat components in the tree, and M3.1 made it three | **2026-09-21** |
| D21 | M3.2's last line | The party row's "four move chips", and two done-when numbers other items own | **2026-09-21**; the drawer's own 13 words are recommended to M6.3 |
| D22 | M3.3's done-when, then M7.2 | The decline overlay's budget was derived before the component it budgets existed | **2026-09-21** |
| D23 | M4.1 | R9's precedence ranks seven outcomes; the vocabulary it ranks has fifteen kinds | **2026-09-21** |
| D24 | M4.1's strip, then M4.3's done-when | The flag strip's budget is one *word* per hit, and nine flag words are two or three | **2026-09-21** |
| D25 | M4.3 | The event line is a sentence at rest on the screen R11 says carries nothing written | **2026-09-21** |
| D26 | M4.3 | The log sheet opens by a labelled button where the item says pull, and the label is a word over budget | **2026-09-21** |
| D27 | M4.2 | The strip's shipped rule says every chip is the same chip; section 2 gives the feedback flag the forecast's colour | **2026-09-21** |
| D28 | M4.3's done-when, then M7.2 | The battle screen's header carries three facts, section 4 budgets none of them, and the census cannot see one of them | **2026-09-21** |
| D29 | M5.1, M5.2, M5.3, M5.4 | Section 5's canon names none of the five card surfaces section 4 budgets | **2026-09-22**, amended and unified in M5.1 |
| D30 | M5.1 to M5.4's done-whens | The census has no component row for any of the five, so four done-whens are not computable | **open**, self-closing |
| D31 | M5.5's done-when | The census calls a built component absent, because no fixture opens a band | **2026-09-22**, closed inside M5.5 |
| D32 | M5.3 | The locale *screen* has no budget row, and M5.3 pairs a card number with a screen number | **2026-09-22**, option 1, built |
| D33 | M5.6 | The event budget is smaller than the sum of its own row, and the row has no line for the four hints | **2026-09-22**, option 1, built |
| D34 | M5.1 | Eight words cannot carry what a relic description carries, and C2 forbids dropping the difference | **2026-09-22**, ruled on a false premise; **moot if D36 is ruled option 1** |
| D35 | M5.1, M5.2 done-whens | The fixture's every-relic grant is the worst case for one surface and the blind spot for three | **2026-09-22**, closed: M5.1's fixture, M5.2's unit test, M5.6's widened event draw |
| D36 | M5.1 | Section 3 puts the effect line on inspect; section 4 and M5.1 put it on the card | **2026-09-22**, option 1, built |
| D37 | M5.2 | M5.2 needs two glyphs: section 2 carries neither, and section 3 already promised one of them | **2026-09-22**, option 1, built |
| D38 | M5.4's second clause | The capture card cannot mount the party row and stay above the fold | **open** |
| D39 | M5.6 (filed), then M6.1 or M7.2 | `Costs` is a field label at rest, and no family encodes a price | **open** |
| D40 | M6.1's done-when | The classroom does not carry the families section 7 says it does: starter select draws its own move rows | **2026-09-23**, option 3: new item M6.0 |
| D41 | M6.1 | Three of ten families never pass through the glyph, and the canon says the glyph renders the label | **2026-09-23**, option 1 plus option 3's test |
| D42 | M6.1 | R2 and R3 outrank R7, and both forbid what R7 requires | **2026-09-23**, option 1 |
| D43 | M6.1, M6.2 | What an exposure is while two modes paint words, and the guard puts the classroom in one of them | **2026-09-23**, option 1: order M6.0, M6.2, M6.3, M6.1 |
| D44 | M6.1's census, then M7.2 | The census has no exposure state, so M6.1 raises every surface's count on a fresh store | **2026-09-23**, option 1 |

## Rulings, 2026-09-19

Eleven of thirteen closed 2026-09-19; D2 and D8 closed 2026-09-20. D15, D16 and
D17 closed 2026-09-20 across Tier 2; D18 on 2026-09-21, opening Tier 3.
**Thirty-eight of thirty-nine rows are ruled**, and the one that is not — D38,
filed inside M5.4 — blocks one clause of that item and nothing else. D39 was
filed on M5.6's build and blocks nothing: it is a word M5.6 chose to keep and
said why. Tier 5 opened with six rows filed on 2026-09-22 (D29 to D34) and
closed with all six ruled and built, plus D14 from Tier 0 and D35 from Tier 4.
**D14 stopped being nobody's blocker when D33 was filed**: M5.6 reaches every
string in `data/events.ts` whichever way D33 is ruled, which is the condition
D14's own recommendation had been waiting five tiers for. D35 closed across
three items — M5.1's relic fixture, M5.2's unit test, and M5.6 widening
`wordiestEvent` past one locale and off character-length ranking. Tier 4 filed six: five before the tier opened, four of them
ruled the same day, then D26 and D28 ruled together once M4.1 and M4.2 had
shipped and M4.3 was the item in front of them. D18 was opened and ruled on 2026-09-21,
inside M3.1. Each
ruling is restated under its own row below; the bible amendments they produced are Rev 2, marked inline in
[`design-bible.md`](design-bible.md) with the row that produced them.

| Row | Ruling | Where it landed |
|---|---|---|
| D1 | Budgets are ceilings; the four milestone equalities become "at or under". Counting rule stands. | Bible section 4, new paragraph. Milestone M3.3, M5.3, M5.4, M5.5 done-when |
| D3 | Fix all six. Rename `statusInfo.ts:88` to "Toxic" so the lint needs no allowlist. Widen the word list with risky, safe, worth, drop its tutorial scope, point it at `src/data/*Info.ts`. **Building it found three more: the count is nine.** | Bible section 8. Milestone M0.3 |
| D4 | The acceptance test enumerates all 17 inspect rows of section 3, archetype excepted. | Milestone M1.2 done-when |
| D5 | No tenth family. The plus and minus signs are permanent from day one. Section 9 loses "after the label fades"; the fallback is "add the two words". | Bible sections 3 and 9. Milestone M5.4 loses its label line |
| D6 | Add the chevron to the Pokemon panel. | Bible section 5 |
| D7 | Add a flag strip row, 1 word per hit. Battle screen budget excludes it. | Bible section 4 |
| D9 | Build the compact 2x2 first, re-measure column mode against it in the same PR, rule with the number. Both branches in the done-when. **Closed 2026-09-20 with the number: option 1, column mode deleted.** | Milestone M2.2 |
| D10 | Re-anchor before the default flips. | Bible section 7. Milestone order M6.2 then M6.3 |
| D11 | A validation cycle is two rounds of the M7.1 protocol, three testers each, one without Pokemon knowledge. | Bible R6 and section 11 |
| D12 | Split all three per the `displayTuning.ts` precedent, copy into `EXCLUDED`, generation-bearing fields stay. No hash move. | Milestone M4.1, M5.1, M6.1 gates |
| D2 | **Count both.** Per screen for the 14 screens, per component instance for the six components, one table with a column naming which. (2026-09-20) | Milestone M0.1 done-when |
| D8 | **Wait for the playtest.** M5.6 holds every event at 40 words; one that cannot fit is reported, not moved, and the remedy waits for M7.1 to observe it. (2026-09-20) | Milestone M5.6 done-when |
| D13 | Branch shape accepted. | Nothing to rule |

**One note on process, recorded rather than raised.** Section 10.1 says a rule
changes only once its disconfirmer has been observed in a playtest. Six of the
seven Rev 2 amendments change a table, an ordering or a glossary entry that
disagreed with a rule, and the seventh defines a term a rule already used, so
none of the twelve rules moved and no disconfirmer was needed. D5 is the closest
call: it edits a section 9 row, but it edits the row's *premise* (a label that no
family exists to produce), not the bet it records. The bet is unchanged and still
falsifiable.

## Rulings, 2026-09-20, opening Tier 2

D15 and D16 are ruled together because they are one change: the expander is the
only surviving route to the facts Pocket hides, so removing it and unhiding them
cannot be two items. D14 stays open and is still nobody's blocker.

| Row | Ruling | Where it lands |
|---|---|---|
| D15 | **Fold into M2.1.** The expander goes; the card itself becomes the inspect trigger, in every density mode, which is also the keyboard path it was carrying. | Milestone M2.1 scope |
| D16 | **Pocket only.** M2.1's "0 words at rest" binds the Pocket face. Detailed and Simple keep their labelled face until M6.4 rules on them with M7.1's evidence. | Milestone M2.1 done-when |

**What D16's ruling closes and what it leaves.** It closes C2. Pocket stops
hiding base power, the category glyph, the status readout and the fact strip,
because section 3's face *renders* all four — so building the face is what
deletes the `display: none` block, not a separate decision. (**D17A later put
the status readout back behind the long press**, which is not a reversal: the
gesture that reaches it did not exist when this was ruled, and M2.1 is what
created it.) Detailed and Simple
were never hiding a fact; they label it. Once M2.1 lands, no mode removes a
fact.

What it leaves is R6's "forbids: shipping two card faces", knowingly and for a
bounded time. R6's own density ruling is the authority for that: Simple and
Detailed "stay for one validation cycle and are retired if the disconfirmer in
section 9 does not fire", and M6.4 is that retirement. **The bible is not
amended and no rule moved.** M2.1 is scoped to the face R6 already calls the
one this document specifies.

---

## D1. The budget numbers do not reconcile with the counting rule

**Blocks M0.1.** Then M3.3, M5.3, M5.4 and M5.5, whose acceptance tests are exact
numbers measured by M0.1's script.

Bible section 4's header states the rule: *"Words at rest, excluding proper nouns
and bare numbers."* Its own rows only make sense if proper nouns are counted, and
even then they do not land on the stated figures:

| Section 4 row | Budget | Words that survive | Counting the rule as written | Counting proper nouns too |
|---|---|---|---|---|
| Confirm overlay (replace) | 6 | "Replace Tackle with Fire Punch?" | 2 | 5 |
| Confirm overlay (decline) | 4 | "Forfeit this reward?" | 3 | 3 |
| Result screen | 6 | Outcome word, "+N", continue | 2 | 2 |
| Pre-gym screen | 4 | Gym leader name, type chip, "Choose lead" | 2 | 3 |

No column reproduces the budget. The milestone then turns four of these into
equalities rather than ceilings: M5.5 "census reads 6 and 4", M5.4 "census reads
6 for the result screen", M5.3 "census reads 0 and 4", M3.3 "4 on the decline
overlay". Under the rule as written, a correctly built decline overlay censuses
3 and fails an acceptance test that demands 4.

M0.1 is the item that fixes the counting rule in code, so this has to be ruled
before a line of it is written.

**Options.**

1. **Budgets are ceilings, and the milestone's equalities become "at or under".**
   Section 4 already says "the budget is the ceiling after the milestone that
   touches the surface" and "A surface over budget is not done", so this is the
   bible's own reading. Nothing in the bible changes except that its four
   unreachable figures stay as headroom. The milestone's four done-when lines are
   edited.
2. **Restate the rule to count proper nouns, and re-derive every budget.** Makes
   the replace overlay's 6 nearly right and leaves the other three still wrong.
   Touches section 4's header, which R2 enforces against.
3. **Amend the four figures to match the rule.** Replace 6/4/6/4 with 2/3/2/2.
   Exact, but leaves no headroom for a surface that legitimately gains a word.

**Recommendation: 1.** It is the only option that changes no rule. Option 3 also
makes M7.2 brittle: any future copy change on those four surfaces becomes an
amendment rather than a budget check.

---

## D2. The census counts screens; the budgets are written per component

**Blocks M0.1.**

M0.1: *"the census table exists for all 14 surfaces (12 router screens plus
drawer and log sheet)"*. Bible section 4 budgets 17 rows, and six of them are not
screens — battle move button, move card, move chip, party row, capture card, and
the two confirm overlays are components that appear on several screens each.

A per-screen census cannot check a per-component budget. A move card three words
over budget disappears inside a screen total that is under it, which is precisely
the failure R1 and section 5 exist to catch: the defect is a component drawing an
attribute itself, and it shows up per component or not at all.

**Options.**

1. **Census counts both.** Per screen for the screens, and per component instance
   for the components, in one table with a column saying which. Superset; no rule
   changes; M7.2's delta needs both anyway.
2. **Per component only.** Loses the screen totals that the event screen and
   result screen budgets are written against.
3. **Per screen only, and re-cut section 4 into screen rows.** An amendment to the
   bible's most-referenced table, to make the measurement cheaper.

**Recommendation: 1.** It costs one column and needs no ruling to proceed, so
unless you object I will build M0.1 this way and this row closes itself.

---

## D3. There are six verdict-copy violations, not four, and one false positive

**Blocks M0.3.**

Bible section 8 and M0.3 both name four lines. Measured on the current tree
(`e16decd`), the hedge-word vocabulary section 8 gives — risky, safe, strong,
weak, good, bad — plus the comparatives the existing lint already carries:

| Line | Text | Status |
|---|---|---|
| `categoryInfo.ts:48` | "...Worth it when you can survive the reply..." | named, real |
| `statusInfo.ts:125` | "...which is usually better than rolling the dice..." | named, real |
| `statusInfo.ts:242` | "...so it is strongest into a wall." | named, real |
| `bandInfo.ts:68` | `label: 'Band 3'` | **named, not a violation** |
| `bandInfo.ts:75` | "...A risky node reaches here before the segments do." | **real, unnamed** |
| `statusInfo.ts:139` | "...so it is worse than poison at the same rate." | **real, unnamed** |
| `statusInfo.ts:171` | "...is usually the answer if the locked move does nothing useful." | **real, unnamed** |
| `statusInfo.ts:88` | `label: 'Bad poison'` | **false positive** |

The line numbers drifted because the milestone was written against the Sep 18
tree and this is the Sep 20 one; `bandInfo.ts:68` is now a band label and the
violation it meant sits at 75. The two unnamed `statusInfo` lines are new to this
register.

`statusInfo.ts:88` is the genre-standard name of the Toxic status, not advice.
M0.3's lint will fail on it, and section 8's rule as written ("Never a hedge word
... on any surface") does not exempt it.

So M0.3's done-when cannot be satisfied as written: rewriting four lines and
adding the lint leaves the lint failing on three more.

**Options.**

1. **Rewrite all six, exempt `'Bad poison'` as a status name, amend section 8's
   count and its four-line list.** The lint carries a names allowlist with the one
   entry and a comment.
2. **Rewrite four, file the other two as a follow-up item, land the lint
   non-blocking.** Leaves two verdict lines shipping behind a lint that is known
   to be red, which is the state M0.3 exists to end.
3. **Rewrite six and rename the status to "Toxic"** so no allowlist is needed.
   Touches a player-facing name for a lint's convenience.

**Recommendation: 1.**

### What building it found: nine, not six

**2026-09-20, M0.3.** The ruling was carried out and the count moved again. The
six above are right, and three more exist that neither the bible nor this row
had counted:

| Line | Text | Why it was missed |
|---|---|---|
| `statusInfo.ts:72` | "Burning an opposing physical attacker is often **worth** more than the chip damage." | `worth` |
| `statusInfo.ts:202` | "it is **worth** the switch almost every time" | `worth` |
| `statusInfo.ts:231` | "You need a second move **worth** using." | `worth` |

All three turn on one word. Section 8 names **worth** in its own hedge list, and
the twelve-word list shipped in `data/tutorial.ts` did not carry it — so the
rule had always forbidden these three lines and the only thing enforcing the
rule had never been able to see them. D3's instruction to widen the list is
what surfaced them. The rule did not change; its enforcement caught up.

Recorded here rather than treated as scope creep: the ruling said fix the
violations, and these are violations of the sentence the ruling was
interpreting.

**One decision taken while building, and it is in the bible now.** The first
lint read whole files and returned 31 hits, of which 3 were real. The other 28
were doc comments explaining why hedge words are banned — including the comment
M0.3 had just written above the Toxic rename. A comment is not a surface, and a
lint that cannot tell the difference makes the prose documenting a rule illegal
under it. The lint reads string literals, via TypeScript's own parser, and
section 8 says so.

**Already in the tree, and M0.3 should extend rather than invent it:**
`src/data/tutorial.ts:335` exports `TUTORIAL_FORBIDDEN_WORDS`, a twelve-word list
linted over the coach marks by `test/tutorial.test.ts`. It is missing three words
section 8 names: **risky**, **safe**, **worth**. M0.3's lint is that list, widened
and pointed at `src/data/*Info.ts`.

**The gate note checks out.** `bandInfo.ts`, `categoryInfo.ts` and `statusInfo.ts`
are all three already in `EXCLUDED` in `build-config/content-hash.ts`, so the
digest does not move. `tutorial.ts` is not in that list; if the lint only reads it
and nothing is rewritten there, the digest still holds.

---

## D4. The inspect acceptance test is narrower than R5

**Blocks M1.2.**

R5: *"Long press on any card, chip, glyph, badge or pip opens its full
explanation."* Section 3 gives an "on inspect" entry for eighteen attributes.

M1.2's done-when names five mount points: *"inspect opens on every type chip,
status chip, band strip, item sprite and move card in the tree."*

Missing against section 3: category glyph, PP glyph, accuracy glyph, priority
chevron, effectiveness edge, the six stat glyphs, the stat-stage ladder, berry
sprite, relic sprite, tier pips, capability glyph, and the coverage rows.

This is not a scope question. R5 is a *one mechanism* rule, and a partial mount is
how the second mechanism gets built: a family with no inspect behind it needs its
explanation somewhere else, and that somewhere else is the type wheel and the band
tooltip returning under new names. It also breaks R7 downstream — M6.1 fires an
exposure label on nine families, and a label that names a glyph the player then
cannot long-press is the legend button section 7 rejects.

**Options.**

1. **M1.2 ships every row of section 3's inspect column, done-when rewritten to
   cite the encoding table rather than a list of five.** Larger item, one session
   still.
2. **M1.2 ships the five, a new Tier 1 item finishes the rest before Tier 6.**
   Two sessions; R5's one-mechanism test passes at the end of the second, not the
   first.
3. **Amend R5 to name the surfaces inspect is required on.** Narrows a C-adjacent
   rule to match an acceptance test, which is the direction section 10.4 forbids.

**Recommendation: 1.**

---

## D5. The coverage rows need a tenth glyph family

**Blocks M5.4 and M6.1.**

M5.4's done-when: *"exposure label for the coverage rows fires under M6.1."*

Section 2 lists nine families and says *"Adding a tenth is an amendment."*
Coverage change is not among them. M6.1 says *"Nine families, copy in
`data/glyphLabels.ts`"* — so the item that is supposed to render M5.4's label has
no family to hang it on. Section 10.3 is explicit: an item that finds it needs a
tenth glyph family *"stops and files an amendment before building."*

**The bible disagrees with itself here.** Section 9's coverage row reads
*"A tester cannot say which row is added **after the label fades**"* — which
assumes a coverage label exists and therefore a tenth family — while section 2
caps the count at nine. Whichever way you rule, one of the two sections is edited.

**Options.**

1. **Amend section 2 to a tenth family, "coverage".** Section 9's disconfirmer
   then reads correctly as written, M6.1 becomes ten families, and R7's test grows
   a row. Costs the "nine families is the right size" hypothesis a variable.
2. **No label on the coverage rows; reword section 9's disconfirmer to drop
   "after the label fades".** The plus and minus signs are signs, not a glyph
   family, and the type chips in the rows already carry the type family's label.
   Cheapest, and leaves the family count at nine.
3. **Coverage rides the type family's label.** One exposure counter, two meanings;
   R7's per-family test stops meaning what it says.

**Recommendation: 2**, on the grounds that a plus sign beside a row of type chips
is not a glyph in section 2's sense and the row's two type chips already carry a
label on first exposure. But this is a design call about whether a first-time
player reads an unlabelled plus row, and it is yours.

---

## D6. The component canon omits the priority chevron

**Blocks M3.1**, cheaply.

M3.1: *"Add the priority chevron slot for the turn-order flash (used in M4.2)."*

Section 2's Priority row requires it — *"Same chevron on the panel when a bracket
decided the turn"* — and section 6 step 2 has it flashing there. But section 5's
component canon row for the Pokemon panel lists *"Name, level, gender, HP bar and
number, status chips, stat stage ladder, item sprite"* and no chevron.

The milestone is right and the bible's section 5 row is incomplete. Section 5 is
the table that says a screen mounts components and never draws an attribute
itself, so a slot missing from it is a slot a screen will draw itself.

**Options.**

1. **One-line amendment to section 5: add the priority chevron to the Pokemon
   panel's "Owns" column.** Housekeeping; no rule changes.
2. Leave it, and let M3.1 add a slot the canon does not list.

**Recommendation: 1.** This is the one row I would rule by default if you would
rather not spend a decision on it.

---

## D7. The flag strip's one word has no budget row

**Blocks M4.3.**

M4.3's done-when: *"census on the battle screen reads 0 outside the flag strip."*

Section 4 has no row for the battle screen and none for the flag strip. It budgets
the battle move button at 0 and the Pokemon battle panel at 0. Meanwhile section 3
gives feedback effectiveness as *"One word on the target"*, R9 puts one flag on
every hit, and section 5 canonises the flag strip as *"One word per hit,
precedence applied"*.

So the bible requires a word on the battle screen and budgets no surface that
contains it, and M4.3 invents a carve-out ("outside the flag strip") that the
bible never granted. Section 11's "at rest" — *"what a surface shows with nothing
pressed, hovered or expanded"* — arguably excludes a post-resolution flag, but
that is an inference from a glossary entry, and M7.2 measures against rows, not
inferences.

**Options.**

1. **Add a section 4 row: "Battle screen (flag strip) | 1 per hit | one flag
   word".** Explicit; M4.3 and M7.2 both get something to measure.
2. **Rule in section 11 that a post-resolution flag is not at rest, and drop
   M4.3's carve-out as unnecessary.** No new row; the census script has to know
   which nodes are transient, which is a harder thing to hold than a number.
3. Leave it and accept the carve-out as a local exception.

**Recommendation: 1.**

---

## D8. The item pre-authorises a remedy the bible reserves for amendment

**Blocks M5.6.**

M5.6: *"Capability requirement moves to the map node glyph if the prompt cannot
fit."*

Section 9's event-screen row makes exactly that move the **consequence of a
disconfirmer**: *"Rejigged events with four reward tiers need more than two lines
to state requirement and choice → Requirement moves to the map node glyph; prompt
shrinks."* Section 10.1 says a rule changes only once its disconfirmer has been
observed in a playtest and recorded in `playtest-log.md` with a date and a tester
count.

M5.6 would apply the remedy at build time, triggered by a word count, with no
observation and no log entry. That is the pattern section 10.4 names: a prompt
doing quietly what the amendment process is for.

**Options.**

1. **M5.6 holds every event at 40 words. Any event that cannot fit is reported,
   not moved; the move waits for M7.1 to observe it.** The item may then end with
   events that fail their own lint, which is the honest outcome and a Tier 7
   input.
2. **Treat "cannot fit at 40 words" as its own disconfirmer**, record it in the
   playtest log as a build-time observation with the event list, and let M5.6
   apply the remedy. Stretches "observed in a playtest" to mean "observed in a
   lint".
3. Amend section 9's event row to make the remedy automatic.

**Recommendation: 1.**

---

## D9. The tree ships two move-button faces; R6 forbids two faces

**Blocks M2.2.** This is the largest one, and it is a conflict between the bible
and the *shipped tree*, not between the bible and the milestone.

M2.2 specifies *"2x2 grid, 44px minimum"*. The tree ships both that and a second
arrangement. `src/ui/styles.css:1908` documents it:

> **The four-column move bar.** `data-move-bar="columns"` on the root; the absence
> of it, or `"grid"`, is the 2x2 the game has always had and every rule above
> describes. ... **So column mode is a different face:** one field family per line,
> the same line on every button, which is the property that makes a field readable
> *across* the four rather than within one.

"A different face", in the file's own words. R6: *"Forbids: shipping two card
faces."* R1 forbids *"a 'compact variant' that reorders slots"*, which is what one
field family per line is.

The four-column bar shipped under
[`../spec/gymrun-patch-four-column-move-bar.md`](../spec/gymrun-patch-four-column-move-bar.md),
before the bible existed. The bible is permanent and outranks it, so on the rule
as written the column face goes. But that patch's reasoning is a measurement — at
390px, four columns give 85px buttons against 176px in the grid, and nothing about
the current face fits at any type size this project allows — and it was asked for
so a field could be compared *across* the four buttons.

M2.2 as written neither keeps column mode nor deletes it. It cannot ship without a
ruling.

**Options.**

1. **Delete column mode. M2.2 ships the 2x2 only.** R6 and R1 hold as written. The
   comparison the patch was asked for is lost, unless the compact face makes it
   unnecessary — which is plausible, since M2.1 removes every field label and the
   type name, and the measurement above was taken against the labelled face.
2. **Keep column mode and amend R6** to permit arrangement variants that do not
   change encoding. R6's density ruling already says modes *"may change spacing,
   stacking and whether a secondary fact sits behind a tap. They never change the
   encoding of a fact."* If one-field-per-line is stacking and not encoding, column
   mode is already legal and only the styles.css comment's word "face" is wrong.
   This is the narrowest amendment available.
3. **Defer: M2.2 builds the 2x2 compact face, re-measures column mode against it,
   and the ruling comes with numbers.** The measurement that justified column mode
   was taken against a face M2.1 deletes, so it may not survive its own premise.

**Recommendation: 3, then 1 or 2 with the measurement in hand.** I would rather
not delete a shipped, argued-for feature on a reading of the word "face", nor
amend R6 before knowing whether the compact face needs the variant at all. If you
want it settled now rather than measured, option 2 is the smaller change and I
think the honest one: the patch's own argument is about line layout, not about
which facts render.

---

## D10. M6.2 and M6.3 are ordered against section 7

**Blocks M6.2.** Cheap.

Section 7: *"once R6's Pocket default lands, coach marks re-anchor to the Pocket
face and the forced-Detailed rule is deleted."* The milestone orders M6.2
(re-anchor, delete the forced-Detailed rule) **before** M6.3 (Pocket default).

Run in the listed order, M6.2 deletes the forced-Detailed rule while new installs
still start in Detailed, and its done-when — *"the coach-mark test runs in
Pocket"* — tests a mode that is not yet the default.

**Options.**

1. **Swap them: M6.3 then M6.2.** Matches section 7 exactly. Nothing else in
   Tier 6 depends on the order.
2. **Fold them into one item.** Violates "one item, one PR" but they are one
   change in section 7's telling.
3. Leave the order and accept one session where the two disagree.

**Recommendation: 1.**

---

## D11. "One validation cycle" and "two playtest rounds" are not defined as equal

**Blocks M6.4.** Housekeeping.

R6: *"Simple and Detailed stay for one validation cycle and are retired if the
disconfirmer in section 9 does not fire."* M6.4: *"only if the R6 disconfirmer did
not fire across two playtest rounds."* M7.1 defines the protocol as *"two rounds
of at least three testers each"*.

If a validation cycle is M7.1's two rounds, the two agree and the bible should say
so. If it is one round, they disagree about when the retirement is earned, and
M6.4 is stricter than the rule it enforces.

**Options.**

1. **Define "validation cycle" in section 11's glossary as M7.1's two rounds of at
   least three testers.** One glossary line; both documents then agree.
2. Amend R6 to say "two playtest rounds" and leave the glossary alone.

**Recommendation: 1.** Section 11 is where the other terms of art live, and M7.1
is the only definition of a round in either document.

---

## D12. Three items move `contentHash`, which the standing gates forbid

**Blocks M4.1, M5.1, M6.1.**

The milestone's standing gates say `contentHash` unmoved. Three items add fields
under `src/data/`:

| Item | Adds | Hashed today? |
|---|---|---|
| M4.1 | flag precedence order in `data/tuning.ts` | **yes** — not in `EXCLUDED`, and `core/` reads it |
| M5.1 | `playerDescription` in `data/items.ts` and `data/relics.ts` | **yes** — both reached by `core/` |
| M6.1 | new `data/glyphLabels.ts` | new file; hashed by the glob unless excluded |

M5.1 half-anticipates this: *"Confirm the description field is in the
excluded-display set or accept one hash move and record it."* The first branch is
closed. `build-config/content-hash.ts` states the exclusion rule mechanically —
*"a file is excluded only if nothing under `src/core/` imports it, directly or
transitively"* — and `test/content-hash.test.ts` walks the import graph to hold it.
`items.ts` is reached by `core/`, so it cannot be excluded, and there is no
per-field exclusion: the header rejects one explicitly, *"a per-field list that
reintroduces the discipline this file exists to retire."*

CLAUDE.md makes a hash move a loud, versioned event: a seed recorded before it is
refused afterwards. Three of them across one release is three refusals of every
shared seed.

**There is a third way, and it is already in the tree.** The same header names it:
*"**The third way out is a per-file split**, and `src/data/displayTuning.ts` is
it."* A display number that `core/` does not read lives in its own file, is
excluded by the mechanical rule, and moves nothing. Nine copy files already sit in
`EXCLUDED` on exactly this basis.

**Options.**

1. **Per-file split for all three.** Flag precedence into `displayTuning.ts`
   (it is presentation; R9 keeps the mapper in `core/` and pure, and the mapper
   returns the list without reading the order). Item and relic copy into a new
   `src/data/itemCopy.ts` read by `ui/` only. `glyphLabels.ts` added to `EXCLUDED`
   with its reason. `contentHash` holds on all three; the standing gate holds as
   written; no seed is refused.
2. **Accept the hash moves and record them** in `docs/generation.md`. Three
   version events, or one if the three items land in the 4.10 release together and
   the hash is stamped once at the end.
3. Mixed: split M6.1 and M5.1, accept the move for M4.1 on the grounds that
   precedence is arguably balance.

**Recommendation: 1.** It needs no exception to a gate and no version event, and
the precedent is a file that already exists for this exact reason. The one thing
to check while building M4.1 is whether precedence is presentation or balance — if
`core/` ever reads the order to decide anything, option 1 is closed for that item
and the test will say so.

---

## D13. "One item, one PR" against the single 4.10 pull request

**Process, not presentation.** Recorded so the pull request can say why.

The milestone's standing rules: *"One item, one session, one PR. Two items in one
PR cannot be reverted independently."* The instruction for this release is one
4.10 pull request covering the whole list.

The reason behind the rule is independent revertability, and that is preserved by
the branch shape rather than by the pull request count: one sub-branch per item off
the 4.10 trunk, each merged with a merge commit and no squash, so any single item
is reverted by reverting its merge commit. The pull request count is a review
question, not a revert question.

No ruling needed. The 4.10 pull request description says which items it carries
and that each is revertable at its merge commit.

---

## Two things that are not discrepancies, recorded so they are not re-found

**M0.3's gate note is correct.** `bandInfo.ts`, `categoryInfo.ts` and
`statusInfo.ts` are in `EXCLUDED` in `build-config/content-hash.ts` with a reason
each. Rewriting the four (six, per D3) lines does not move the digest.

**M1.2's first step is already done, differently.** The item says to implement the
2026-09-10 type-wheel ruling as step one. `docs/README.md:345` records that ruling
as superseded for Pokemon type badges: the trigger had been applied to every type
chip in the app rather than the two it named, and was corrected so the wheel is
reachable from a battle move card and nowhere else — a gym leader's type, a
locale's types, a threat's type and an item's boosted type are inert. So M1.2's
step one is complete and what remains is deleting the wheel as a separate
mechanism. No ruling needed; the item's text is stale, not wrong.


---

## D14. Two event sentences break section 8, and fixing them moves `contentHash`

**Opened 2026-09-20 by M0.3. M0.3 shipped around it; nothing else is blocked.**

Widening the forbidden-word list with **worth** — which section 8 names and the
shipped twelve-word list had never carried — made an existing test,
`test/event-copy.test.ts`, see two sentences that have been in violation since
they were written:

| Where | Sentence |
|---|---|
| `forest-thornwall`, safe hint | "The detour is slow and passes a grove **worth** passing." |
| `marsh-leech-bed`, hook | "A leech bed lying over something **worth** having." |

Both are player-facing event copy. Section 8 forbids the word on any surface,
so both should be rewritten, and the rewrite is two minutes of work.

**The cost is not the rewrite.** They live in `src/data/events.ts`, which is
inside `contentHash`: `src/core/events.ts:72` imports it, so the mechanical
exclusion rule in `build-config/content-hash.ts` cannot exclude it. Two words of
flavour text therefore move the hash from `d4e080`, and that:

- **refuses every seed recorded before it.** That is the hash working as
  designed, loudly, and it is the whole reason it exists.
- **forces the visual baseline to be re-recorded.** All six run files under
  `docs/visual/baseline/` carry the hash, as does `data-digest.txt`. The
  overnight protocol says the baseline is never regenerated.
- **contradicts the pin's own comment.** `test/ai-priority.test.ts:415` states
  that the display split was "the **last** time this number moves for a display
  edit".
- **cuts against D12**, which was ruled four hours earlier, on this exact
  trade, in the other direction: split the file, do not move the hash.

**Options.**

1. **Rewrite and accept one hash move.** Update the pin, re-record the baseline,
   record it in `generation.md`. Verifiable: the only lines that may change in
   the baseline are the embedded hash strings, and a diff proves it. Costs every
   shared seed and one claim in a comment.
2. **Split, per D12's precedent.** Move event hooks and hints out of
   `data/events.ts` into `data/eventCopy.ts`, which already exists, is already
   excluded, and is already described as "the per-band hints and conclusions on
   the event screen". Then this rewrite and every future one is free. It is a
   real refactor — `core/events.ts` reads the table — and it moves the hash once
   on the way through, so it buys the future at the same one-time price as
   option 1.
3. **Leave them.** Two known violations ship. The test records them exactly, so
   nothing hides, but section 8 says never.

**Recommendation: 2**, timed to whenever something else moves the hash anyway,
or taken on its own as a Tier 5 item beside M5.6 — which is the other item that
has to touch event copy. Option 1 spends the same price and buys nothing
permanent.

**What M0.3 did about it.** Nothing, deliberately. The two sentences are listed
in `test/event-copy.test.ts` as `KNOWN_UNFIXED` and asserted to be *exactly*
those two, so a third violation fails the test rather than joining them, and a
fix fails it too until the list is emptied. The bible was not amended: section 8
is right and the tree is wrong, which is the correct way round.


---

## D15. The `Explain` expander is a second explanation mechanism

**Opened 2026-09-20 by M1.2. M1.2 shipped around it; nothing is blocked.**

R5: *"There is exactly one mechanism."* Its forbids list names *"a type wheel, a
band tooltip, a move popup, a legend screen, a help button, or a verbosity mode
as a way to see an explanation."*

M1.2 folded the first two and gave the battle move button its own long press, so
the tooltip layer is now the only *tooltip* mechanism and the item's done-when
is satisfied as written. But the tree holds a third thing R5's list reaches:

> **`ui/move-explanation.ts`** renders a button reading `Explain` and an inline
> panel under every move card outside a battle. One call site,
> `moveCard` in `ui/scene.ts`, so it appears on all six card surfaces.

It is not a tooltip — it is an inline collapse — which is why M1.2's done-when
can be met without removing it. It is, on any ordinary reading, a help button.

**What the census says it costs.** `Explain` renders **24 times on the summary
screen** and four times on every party card. Section 7 rejects a legend button
as *"a mechanism the player must know exists"*, and twenty-four of them is that
objection at scale rather than a different one.

**Why M1.2 did not simply delete it.** Two reasons, and the second is the real
one:

1. The item names the type wheel and the band tooltip. It does not name this,
   and an item that quietly widened its own scope to a third mechanism would be
   the thing the standing rules forbid.
2. **The expander is the keyboard path.** It is a real `<button>` with
   `aria-controls`; long press is not a keyboard gesture. The tooltip layer does
   answer Enter and Space on a focusable trigger, so the replacement exists —
   but a move *card* outside a battle is not focusable today, and making every
   card a focusable `role="button"` on the way past is an accessibility change
   that deserves its own item rather than a paragraph in this one.

**Options.**

1. **A Tier 2 item, beside M2.1.** M2.1 rebuilds the move card face anyway, and
   the card is exactly where the focusability question has to be answered.
   Delete the expander there, make the card the trigger, and take the 24 words
   off the summary in the same pass that takes off the labels.
2. **Its own item now**, before Tier 2, since it is a live R5 violation.
3. **Amend R5** to permit an inline expander beside the one tooltip layer. The
   honest version of "we are keeping it", and it needs a disconfirmer.

**Recommendation: 1.** It is the same file, the same surfaces and the same
census delta as M2.1, and splitting them means measuring the move card twice.

**Ruled 2026-09-20: option 1.** Folded into M2.1, and D16 below is why it could
not have gone anywhere else.

---

## D16. Pocket reaches its word count by hiding facts, and M2.1 does not say which modes its zero binds

**Opened 2026-09-20 by M2.1, before any code. Ruled the same day.**

Two things, and the second is only visible once the first is.

### The census's 61 is not a compact encoding

`src/ui/styles.css:1088`:

```css
:root[data-density="pocket"] .move .badge--category,
:root[data-density="pocket"] .move .move__power,
:root[data-density="pocket"] .move .move__effect,
:root[data-density="pocket"] .move .move__facts { display: none; }
```

The per-component census reads the move card at **477 words in Detailed and 61
in Pocket**. That gap is not a verbose face against a terse one. Pocket hides
**base power** — which section 3 makes "the largest text on the card" — along
with the category glyph, the status readout and the whole fact strip.

That is removal, not re-encoding. **C2**: *"No fact that changes a decision is
removed. It is re-encoded."* And **R6**: *"Density modes may change spacing,
stacking and whether a secondary fact sits behind a tap. They never change the
encoding of a fact."* Hiding is the limit case of changing it.

R6 permits "behind a tap", so the question is whether the tap exists.

### On a card in Pocket, it does not

- The `power:` inspect trigger M1.2 added is set on `.move__power` itself
  (`scene.ts:1539`, `:1881`) — the element the rule above hides. A hidden
  element cannot be long-pressed.
- `moveCard` sets no `dataset.tip` of its own. The card is not an inspect
  trigger.
- The battle **button** is fine: it carries `move:${move.id}`
  (`scene.ts:1638`) and `renderMoveRows` prints every row.

So on a move card in Pocket, the only surviving route to base power is the
`Explain` expander — **the exact thing D15 proposes to delete**. The CSS
comment still names the other route, the `?` chip on the battle button, which
M1.2 removed.

**This is why D15 and D16 are one ruling.** Delete the expander on its own and
four decision-relevant facts leave the game on six surfaces.

### The second thing: the item does not say which modes it binds

M2.1's done-when is *"census on all six card surfaces reads 0 words at rest"*.
Simple and Detailed render 477. Nothing in the item says whether its zero is
the Pocket face or all three, and the two readings are different items — one
rebuilds a face, the other retires two density modes four tiers before M6.4,
which R6 gates on playtest evidence that does not exist yet.

**Options.**

1. **Unify the encoding, keep the modes.** One encoding everywhere; density
   keeps only spacing, stacking and behind-a-tap. Largest M2.1, and it fixes
   R6's encoding clause across the board.
2. **Pocket only.** M2.1's zero binds the Pocket face. Detailed and Simple keep
   their labelled face until M6.4.
3. **Collapse to one mode now.** Honest zero everywhere, but it decides M6.4
   without the evidence R6 demands.

**Ruled: option 2.** See the rulings table above for what it closes and what it
knowingly leaves.


---

## D17. "Census reads 0" is unreachable for two unrelated reasons

**Opened 2026-09-20 by M2.1, after building it. The face is built and the gate
is green; this is about the number, not the code.**

M2.1's done-when is *"census on all six card surfaces reads 0 words at rest"*.
After the rebuild the census reads **15 for the move card and 14 for the battle
move button**, in Pocket. Both were 61 and 16 before.

The residue is two different things and they want different answers.

### Part A: the battle button's 14 are real words, and the item keeps them

Every one of them is the status readout, `.move__effect` — the line that takes
the base-power region on a status move. The census's Pocket word list for the
battle surface is `Raises` `by` `stages` `Badly` `poisons` `the` `target`:
seven words, two status moves on that board, fourteen.

**They are on screen because M2.1 put them back.** The old Pocket rule hid
`.move__effect` along with base power and the fact strip, which is the C2
violation D16 was filed against. Un-hiding it restores a decision-relevant fact
— and that fact is a *sentence*, on a surface section 4 budgets at 0.

So the item contains a contradiction it cannot resolve inside itself: C2 says
the readout cannot be dropped, R2 says a sentence cannot sit on the face, and
R12 says the answer to that is to restructure the concept rather than write the
sentence. **Restructuring the status readout is not in M2.1's item text**, which
says only "remove every field label, the type name, the category word, and the
BAND numeral".

**Options.** (1) A new item, before M2.2, that re-encodes the readout as glyphs
— it is already a structured `MoveEffectFields`, not free prose, so this is
plausible. (2) Let it sit behind the long press in Pocket, which R6 permits
explicitly ("whether a secondary fact sits behind a tap") and which is now safe
because the card *is* a trigger. (3) Amend section 4 to budget the readout the
way D7 budgeted the flag strip.

**Recommendation: 2.** It is inside R6 as written, it costs no new item, and it
is the one option that keeps the fact reachable without a sentence at rest. The
tap that reaches it did not exist when the old rule hid this; it does now.

### Part B: the move card's 15 are not words at all

Two measurement artifacts, neither of which is text a player reads.

| What | Why it counts | On screen |
|---|---|---|
| `/24` | `bareNumber` is `/^[+\-−]?[\d]+(?:[.,:/][\d]+)*(?:%\|x\|×)?$/`, which needs a leading digit. The token has none. | `24/24`, one number |
| `✥` `↩` | The strip's icons are text characters in `.move__fact-icon`, `aria-hidden`, and `GLYPH_SLOTS` names only `.chip--status` and `.chip--stage`. | a glyph |

The `/24` is mine: section 3 says "max dimmed", dimming needs its own span, and
splitting `24/24` across two spans splits one number into two tokens. What the
player sees is unchanged.

The icons are older. The census's own header says **"Glyphs are not words"**,
and the strip's icons are glyphs by that sentence — they are `aria-hidden` and
the chip carries the real label for a screen reader. `GLYPH_SLOTS` simply
predates the strip. M2.1's item text says "Keep the describeMove icon strip",
so the item cannot reach 0 while the rule counts them.

**Options.** (1) Fix the counting rule: let `bareNumber` accept a leading
separator, and exempt `aria-hidden` text, which is mechanical rather than a
list somebody maintains. (2) Add `.move__fact-icon` to `GLYPH_SLOTS` and leave
the number. (3) Change the markup so the max is not its own token.

**Recommendation: 1.** Both halves follow from sentences the bible and the
census already carry — section 4 excludes bare numbers, the census excludes
glyphs — so this is an implementation catching up with a stated rule, not a
target being moved. It is filed rather than done for exactly that reason: the
change improves the number of the item that would make it, and that is a thing
to have ruled rather than to do quietly. **No bible amendment is involved
either way.**

### What M2.1 did about it, and what the ruling changed

M2.1 filed it and shipped the honest number: **61 → 15 and 16 → 14**, committed
as it read rather than as the item hoped.

**Ruled 2026-09-20. Part A: option 2, behind the long press. Part B: fix the
counting rule.** Both are now built and the census reads **0 on the move card
and 0 on the battle move button** in Pocket.

**A is safe because the tap exists now, and that is the whole difference from
the rule D16 deleted.** `statusReadout` joins `boostPhrase`, `statusPhrase`,
`effectPhrase`, `healPhrase` and `priorityPhrase`; `moveExplanationRows` builds
its Stat change, Status, Effect, Healing and Priority rows from the *same*
functions. The readout is word for word one press away, so hiding it in Pocket
is R6's "whether a secondary fact sits behind a tap" and not C2's removal. The
old rule hid it with no gesture that reached it, which is why that one was a
violation and this one is not.

**B was narrowed after it was measured, and the narrowing is the interesting
part.** The recommendation above was to accept the leading separator *and*
exempt all `aria-hidden` text, on the reasoning that a mark hidden from a
screen reader carries no text load. The separator half is unarguable: section 4
excludes bare numbers, and `24/24` arriving as `24` and `/24` is an artifact of
section 3 requiring the max be dimmed, which needs its own span.

The `aria-hidden` half was too broad, and building it showed why. The only
thing it newly excluded was `.stamps` — the decorative corner stamp, which is
`aria-hidden` and carries a seed string and a version a sighted player can
read. An exemption that quietly stopped counting those would have been the
census lying about a surface to flatter a milestone, which is the exact failure
this row was filed to avoid. So `GLYPH_SLOTS` gains one selector,
`.move__fact-icon`, with its reason beside it, and the app shell still censuses
109.


---

## D9, closed with the measurement

**Ruled 2026-09-19 to defer; closed 2026-09-20 on the number. Option 1:
column mode is deleted and M2.2 ships the 2x2 only.**

The deferral was the right call and the measurement did not say what it was
expected to. At 390x844, with the M2.1 face:

| | width | height | anything cut |
|---|---|---|---|
| 2x2 grid | 176px | 112px | nothing, both densities |
| columns | 85px | 149px | nothing — **and only because it hid four of five fact columns** |

The compact face fits the wide button with room to spare, which is what the
row hoped: the 85px measurement that justified column mode was taken against
the labelled face M2.1 deleted. What it did not anticipate is that the compact
face does not fit 85px either. Showing every fact cell puts a 47px
secondary-chance chip in a 31px cell; one cell per row grows the button and
still cuts it; letting the track fill hands the row to the band strip.

So column mode could only ever exist by dropping facts, which is the
`display: none` this item removed along with the mode.

**A third route was available and was not taken.** R6 permits "whether a
secondary fact sits behind a tap", and since M2.1 the battle button is an
inspect trigger whose panel prints every strip fact — accuracy, priority,
multi-hit, recoil, drain, charge and recharge as their own rows, contact as a
Behaviour row. On D17A's precedent the hiding would therefore have been
re-encoding rather than removal, and column mode could have stayed. The lead
designer ruled for deletion anyway, and the reasons on the table were R6 and R1
holding without interpretation, and the comparison-across-buttons goal that
justified the mode being better served by the grid — every field in a fixed
slot at double the width.

**What went.** the `move-bar` theme module, the `moveBar` setting and its accessors,
the drawer's picker and its copy, the harness option, 179 lines of stylesheet,
and five patterns from `test/density.test.ts`'s forbidden list that could no
longer match. The patch that introduced it,
[`../spec/gymrun-patch-four-column-move-bar.md`](../spec/gymrun-patch-four-column-move-bar.md),
stays where it is: a prompt is a record of what was asked, not a description of
what exists.


---

## Rulings, 2026-09-21, opening Tier 3

Two rows opened reading into M3.1. **D18 blocked it and is ruled below**; D19
blocks nothing and is deferred to M3.2, which meets the same gap on the party
row.

| Row | Ruling | Where it lands |
|---|---|---|
| D18 | **Option 2.** The archetype chip goes, and the six stats it was derived from are re-encoded behind the panel's long press. No amendment: `stat` is already an inspect kind, the stat block is already a canon component, and R6 sanctions a secondary fact behind a tap. | Milestone M3.1 scope |
| D19 | **Defer to M3.2**, which meets the ability and the volatile chips again on the party row, so one ruling covers both surfaces. M3.1 leaves both alone. | Milestone M3.2 scope |

Both come from one measurement. The panel censuses **20 words in Pocket**, ten
per surface across `battle` and `log-sheet`, and every one of them is in five
places:

| Element | Words, per surface | Section 5 lists it |
|---|---:|---|
| `.panel__roster-label` — `3/4 left` | 1 | no |
| `.panel__name` — `Opposing Golem` | 1 | name, yes |
| `.panel__level` — `Lv100` | 2 | level, yes |
| `.badge--archetype` — `Phys. Attacker` | 4 | **no** |
| `.badge--stages` — `STAGES 2` | 2 | stat stage ladder, yes |

Ten per surface, twice over: the roster row is the foe's alone and the name's
prefix with it, and everything below them renders on both panels.

Four of the five are re-encodings with no rule in their way: the side is already
drawn by which panel it is, `Lv` and `left` are the field labels R2 forbids, and
the Pocket stage marker can carry the stat glyph M1.1 drew instead of the word.
The fifth is D18.

**What the table does not show is what the census cannot see.** The panel also
renders the ability name, the held item name and a volatile chip per condition,
and they census near zero by an accident of the counting rule rather than by
being encoded: `properNouns()` is built from `ABILITY_POOL` and both move pools,
so `Levitate`, `Leech Seed` and `Perish Song` are excluded and `Confused`,
`Flinched` and `Drowsy` are not. That is D19.

---

## D18. The archetype chip has no row in the canon, and deleting it takes the opponent's build off the battle screen

**Blocks M3.1.** Then M3.2, which meets the same chip on the party row.

M3.1 enumerates the panel — *"Name, level, gender, HP bar and number, status as
three-letter chips, stat stage ladder nonzero only (shipped), item sprite in a
fixed slot"* — and section 5's Owns column is that list plus D6's chevron.
Neither carries the archetype. Section 4 budgets the panel at 0 with *"Name,
nickname"* as the words that survive, and the chip (`ui/scene.ts:642`, filled at
`:829`) spends four of the panel's twenty: `Phys. Attacker` opposite and
`Spec. Tank` below. **Census 0 requires deleting it.**

Section 3's archetype row agrees: *"Not rendered where the stat bars already draw
it (4.8.0.3) | Absent | Not on inspect either; it is a derived label and can lie
under randomization."* Read whole, that is a bar on rendering archetype and the
parenthetical is a citation rather than a carve-out. The bible and the item
agree with each other. The tree is what disagrees.

**What makes it more than housekeeping is what V5 did.** `ui/scene.ts:910`
records it in as many words: *"Base stats leave the battle panel with the block.
They are not gone from the run — the party drawer is reachable in a battle and
carries the player's six for every member — but the opponent's are now read off
the archetype label rather than as numbers. That is the plan's budget, and the
V5 report records it as the one thing this stage takes away."*

So the chip is not one channel of two. It is the **only** channel for what the
thing opposite is built to do, on the one screen where that changes the next
decision. Deleting it does not move the fact, it ends it, and C2 says a
decision-relevant fact is re-encoded rather than removed.

**Options.**

1. **Delete the chip and leave it at that.** Cheapest, and it has the bible's own
   words behind it: what is removed is *"a derived label [that] can lie under
   randomization"*, and C1 calls a derived summary of six numbers closer to a
   verdict than to an attribute. On that reading no fact is lost, only a label,
   and C2 is not engaged.
2. **Delete the chip and re-encode the opponent's six stats behind the panel's
   long press.** The label goes — the thing section 3 bars, for lying — and the
   six numbers it was derived from take its place, which is what section 3's Six
   stats row specifies anyway: *"Glyph, bar, number. Always all six."* Zero words
   at rest. No amendment: `stat` is already an inspect kind
   (`ui/tooltips.ts:192`), the stat block is already a canon component, and
   `ActiveUiView.stats[...].base` already carries both sides' numbers, so
   nothing in `core/` moves and the reveal policy is untouched — the projection
   has never gated base stats, which is exactly why the archetype label was not
   gated either.
3. **Keep the chip and amend sections 3, 4 and 5.** Archetype gets a canon slot,
   an encoding row and a panel budget of 2. Three tables amended to keep a label
   the bible calls unreliable.

**Recommendation: 2.** It is the only option that satisfies C1 and C2 at once:
the derived label goes, and the attributes it was derived from keep a channel.
It needs no amendment, because R6 sanctions a secondary fact sitting behind a
tap and R5's layer already renders stats.

**D17A is the precedent and it is worth reading before ruling.** M2.1 moved the
status readout behind the long press, and that was ruled re-encoding rather than
removal *because the card became a trigger in the same pass*. The same condition
applies here and is the same cost: the panel is not a trigger today, and option 2
is only honest if it becomes one.

**What option 1 gives up, stated plainly so the ruling is made on it.** A player
would have no way, at any gesture, to tell a physical wall from a special one
before it moves. The bible does not require them to have one — nothing in it
says the opponent's stats are visible — and this row does not claim otherwise.
It claims only that the fact is live today and that removing it is a decision
rather than a tidy-up.

---

## D19. The ability and the volatile chips have no row anywhere in the bible

**Blocks nothing.** Timed with M3.2, which meets both on the party row.

`renderTraits` (`ui/scene.ts:1016`) puts two chips on the panel and
`panel__volatiles` puts up to nineteen more. M3.1 rules on exactly one of them —
*"item sprite in a fixed slot... Remove item name text"* — and section 5's Owns
column lists the item sprite and nothing else of the three.

There is **no ability row and no volatile row in section 3**, no glyph family for
either in section 2, and no budget line for either in section 4. The panel is
budgeted at 0 with "Name, nickname" surviving, so on the tables as written both
are words the panel may not spend.

**They census near zero anyway, and that is the part worth filing.**
`properNouns()` is built from `ABILITY_POOL`, `DAMAGING_MOVES` and
`STATUS_MOVES`, so the counting rule excludes `Levitate`, `Leech Seed`,
`Substitute`, `Nightmare`, `Perish Song`, `Taunt`, `Encore`, `Disable`,
`Ingrain` and `Torment` — and counts `Confused`, `Flinched`, `Bound`, `Trapped`,
`Cursed`, `Drowsy`, `Infatuated` and `Focused`, because `VOLATILE_LABELS`
(`core/battle/view.ts:511`) renames those to a past participle. **Which of two
identically shaped chips costs a word depends on whether its condition happens
to share a name with a move in the pool.** The instrument is doing what D1 ruled
it should; it is the tables it measures against that have no row here.

Neither is droppable. The player's own ability is always revealed, and Levitate,
Flash Fire and Wonder Guard each decide which move is worth using this turn; the
opponent's is gated by `revealOpponentAbility`, the one flag the reveal policy
exists to open. A volatile is the reason a turn did not go as expected. Nor is
either encodable as a glyph: abilities are a pool, not a family, and nineteen
volatiles would be a tenth family and then some.

**Options.**

1. **Amend section 3 with an Ability row and a Volatile row, and section 4 with a
   panel allowance for them.** The honest fix: the tables describe what the
   panel renders, and M7.2 has something to measure. Ability at rest is the
   name; volatiles at rest are the chips, with `statusInfo` behind the press.
2. **Re-cut the volatile labels so every one of them is the move or condition
   name** (`Leech Seed` not `Cursed`), and let the proper-noun rule carry them.
   Cheap in words, dishonest in encoding, and it would rename `Confused` to
   something no protocol line says.
3. **Leave both, record the gap, and let M7.2 raise it if a surface goes over.**
   What M0.3 did with D14, and for the same reason: no item is blocked.

**Recommendation: 1**, timed with M3.2 rather than M3.1, so one ruling covers the
panel and the party row together. **M3.1 is built on option 3 in the meantime**:
it touches neither chip except to replace the item's name with its sprite, which
the item asks for by name.


---

## D18, closed with the build

**Ruled 2026-09-21. Option 2: the chip goes and the six numbers take its
place, one long press away.**

The panel went from **20 words in Pocket to 0**, and 4 of those 20 were this
row. What it cost, and what it turned out to need, is worth recording because
the ruling's own condition was the expensive half:

> D17A is the precedent and it is worth reading before ruling. M2.1 moved the
> status readout behind the long press, and that was ruled re-encoding rather
> than removal *because the card became a trigger in the same pass*. The same
> condition applies here and is the same cost: the panel is not a trigger
> today, and option 2 is only honest if it becomes one.

It became one. `.panel` carries `data-tip="stats:<species>"` and a
`data-detail` of six `stat\tvalue` rows, serialized on the trigger for the
reason `stageMarker`'s set is: which numbers a body has is a property of this
render, not a table entry. `renderMonStats` draws them as section 3's Six stats
row specifies — glyph, bar, number, all six, in display order, no sort and no
emphasis, which is R10 — and the bar is measured against the party card's own
`STAT_BAR_CEILING`, now exported for that reason, so one number is one length
wherever it is drawn.

**Three things the ruling did not anticipate, found by building it.**

1. **The value is `base`, not `effective`.** The projection carries both. Using
   the post-boost number would have put the stat stages on the chip row and the
   stat panel behind the press in disagreement on turn one and in agreement on
   turn zero, which is one fact in two channels on one surface — R3 — and the
   more confusing half of it is that the two would have *looked* independent.
2. **HP is not in `stats`.** `StatView` is the five that boost; the projection
   keeps max HP on `hp`. So the six rows are written HP-first by hand rather
   than mapped off a list, and the comment says why.
3. **The panel had a fourth word source the census could not see, and it was
   the same family this row is about.** `\u25b2 FIRST`, the Speed marker on the
   chip row, spends a word — and its triangle is the mark section 2 gives to
   the **Priority** family, on a fact that is not a bracket. It was not in the
   census because the fixture has no faster side. It is the Stat family's Speed
   glyph now, which is the family Speed actually lives in, and the panel's new
   chevron slot is free to mean what section 6 says it means.

**What was not built, and is not owed.** Nothing was added to `core/`. The
reveal policy is untouched: base stats have never been gated — that is exactly
why the archetype label was not gated either — so re-encoding them changes what
is drawn and not what is known.

---

## D19, deferred

**Deferred to M3.2 on 2026-09-21.** M3.1 touches neither chip, except to
replace the held item's *name* with its sprite, which the item asks for by
name and section 3's Held item row specifies. The ability chip and the volatile
chips render exactly as they did.

One thing M3.1 found that the row should carry into M3.2: the held item's name
was the third member of that set, and it is now gone from the face without an
amendment — because section 3 **does** have a Held item row, and it says
"Item sprite in a fixed slot" at rest and "Name, one effect line" on inspect.
That is the shape of the fix D19's option 1 proposes for the other two. The
ability and the volatiles have no such row, which is the whole of the row.


---

## D20. There are two six-stat components in the tree, and M3.1 made it three

**Blocks M3.2.** Found measuring for it, not while building it.

Section 5 canonises **one**: *"Stat block | Six rows of glyph, bar, number |
Party drawer, recipient, capture, pre-gym."* It closes with the sentence this
row is an instance of: *"A component that exists twice, or a screen that draws
a stat without the stat block, is the defect this document exists to prevent."*

The tree has three.

| # | Builder | Class | Shape | Call sites |
|---|---|---|---|---|
| 1 | `statBlock`, `ui/member-card.ts` | `.stats stats--party` | two-column grid, label, number, bar | the party card, so the drawer, the party screen, pre-gym, the capture list |
| 2 | `statLine`, `ui/screens/starter-select.ts` | `.statline` | one horizontal row of six cells | `screens/starter-select.ts`, `screens/acquisition.ts`, `screens/evolution.ts` |
| 3 | `renderMonStats`, `ui/tooltips.ts` | `.tip__rows--stats` | three-column rows, glyph, bar, number | the battle panel's long press, **added by M3.1** |

**The census cannot see the second one**, and that is the part worth filing
rather than just fixing. Its `stat block` row selects `.stats`, so `.statline`
is charged to whatever component happens to contain it — the party row on the
capture card, screen chrome on starter select — and the component table reads
`stat block | 90 | 108 | 0` while six stat labels are spent on `starter` and
six more on `result-capture` in Pocket. A budget that measures one of two
copies is the D2 failure again, one layer down.

**The third one is M3.1's and it is named here rather than quietly kept.** The
panel's inspect layer draws glyph, bar and number itself instead of mounting
`statBlock`, because `statBlock` takes a `SpecCard` and a `PokemonState` and
the inspect layer has a serialized `data-detail` string and no access to
either. That is an explanation, not a defence: it is a third rendering of one
attribute cluster and section 5's sentence covers it.

**What makes this more than a refactor** is that the three disagree about the
encoding, not only about the markup. Section 3's Six stats row is *"Glyph, bar,
number. Always all six."* Only the one M3.1 built has a glyph. `statBlock`
prints `HP`, `Atk` and `SpA` as text through `.stat__label-long` and
`.stat__label-short`, and `statLine` prints the same six words in a different
element. So "unify the component" and "mount M1.1's stat glyphs" are the same
job, and doing either alone does the work twice.

**Options.**

1. **One component, in its own module, with the glyph.** `statBlock` moves out
   of `ui/member-card.ts` to `ui/stat-block.ts`, takes six numbers rather than
   a `SpecCard` and a `PokemonState`, renders glyph, bar and number per section
   3, and all six call sites mount it — `statLine` is deleted and the inspect
   layer stops drawing its own. The census gains a selector that catches it
   everywhere. Largest diff, and the only option that leaves section 5 true.
2. **Unify the two screen components and leave the inspect layer's third.**
   Smaller, and it keeps the one rendering nobody sees at rest. Section 5 does
   not carve out the inspect layer, so this is an amendment rather than a
   choice.
3. **Amend section 5 to canonise two**: a block for a card and a line for a
   picker. Honest about the two shapes, and it gives up the property the rule
   exists for, which is that one attribute is drawn by one thing.

**Recommendation: 1.** Option 3's premise is real — a wide card and a narrow
picker genuinely want different layouts — but it is a *stylesheet* difference
rather than a component one: `.stats` is already a two-column grid that
collapses, and one component with a modifier class covers both without two
builders to keep in step. Option 2 leaves the sentence in section 5 false and
would have to say so in the bible.

**A note on order.** M3.2's own done-when is *"census reads 0 on drawer and
party row"*, and the drawer surface censuses 83 in Pocket less shell — most of
it map node cards (M5.2) and the density picker (settings chrome), neither of
which is M3.2's. That is a separate question from this row, and it is measured
before M3.2 claims its number.


---

## D21. The party row's "four move chips", and two done-when numbers other items own

**Blocks the last line of M3.2.** Everything else in the item is built.

### A. The chip drops PP and the band, and the party card is where those are read

Section 5's Party row owns *"four move chips"*, and M3.2 asks for them by name.
The card draws four full move cards today.

M2.3 built the chip and its docstring is explicit about what it leaves out and
why: *"What it deliberately leaves out is PP and the band, and that is the
item's bet rather than an oversight. The replacement screen showed five full
cards and the decision it asks for — which of four to displace — is a
comparison the full face makes harder rather than easier."*

That argument is about the **replacement** decision. The party drawer is a
different question, and the two facts the chip drops are the two the drawer is
opened to answer. *Which member is out of PP* is the reason a player opens it
mid-segment; the band is how a move's power reads at a glance across four of
them. Neither has another channel on that surface — the drawer is read-only,
and a card whose moves are chips would put both behind a press on a surface
whose entire job is the readout.

So the chip on the party row is a C2 question, the same shape as D18: a
decision-relevant fact with one channel, and an item that would remove it.

**It is also a control where there is nothing to pick.** `moveChip` returns a
`<button>` because, in M2.3's words, *"every site that draws one is asking the
player to pick it"*. The party row is not: the drawer is read-only by design
and `test/party-drawer.test.ts` holds that there is one write path for party
state. A `<button>` there is a control that does nothing, which is the keyboard
trap `renderTraits` already refuses to build for an unrevealed ability.

**Options.**

1. **Leave the four full cards, and correct section 5's Party row to say so.**
   The card is behind a fold in Pocket already, so it costs nothing at rest and
   the census reads 0 either way. The bible's row is the thing that is wrong:
   it was written before M2.3 decided what a chip leaves out.
2. **Mount the chip, and give it PP on this surface.** Section 9's own
   disconfirmer for M2.3 is *"testers expand every chip before choosing. Then
   chips gain PP at rest"* — so PP returning to the chip is already the
   sanctioned remedy, just fired by a different observation. The band still
   goes, and `moveChip` needs a non-interactive form.
3. **Mount the chip as it is.** Smallest diff, and it drops PP and the band
   from the one surface that exists to show them. C2 says no.

**Recommendation: 1.** Option 2 is defensible and it builds a second chip face
to serve one call site, which is the thing section 5 exists to prevent; option
3 trades a fact for a shape. The full card is already the compact face
everywhere else since M2.1, and a fold is not a removal.

### B. Two of M3.2's numbers are surface totals that other items own

M3.2's done-when is *"census reads 0 on drawer and party row"*. Both are now
measured precisely, and neither is M3.2's to close alone.

**The party row is at 60 in Pocket, from 121, and every one of the 60 is drawn
by a screen rather than by the component:**

| What | Words | Whose |
|---|---:|---|
| `Four moves. You choose what replaces.`, ×6 | 36 | the teach target card, **M3.3** |
| `HP` on the target card's own HP line, ×6 | 6 | the teach target card, **M3.3** |
| `to bag` and `Release`, ×6 each | 18 | the capture list's controls, **M5.4** |

Those come from `screens/item-target.ts` and `screens/acquisition.ts`, which
hand-roll their own card inside `.party__member` rather than mounting the
component. M3.3 mounts the party row as the target card, which takes 42 of the
60; M5.4 mounts it as the capture card, which takes the rest. On every surface
the component itself builds — the drawer, the party screen, pre-gym and the map
rail — it reads **0** today.

**The drawer is at 69 in Pocket less shell, and 68 of it is not the drawer.**
The gallery's `drawer` fixture renders the map screen behind the open drawer,
so the number is mostly map node cards — `Gym of`, `Pokemon steps before the
gym`, the tier chips, the capability chips — which is **M5.2**, plus the
drawer's own settings pickers (`Density`, `Detailed`, `Pocket`, `speed`,
`Even`, `Patient`) and its section headings. The party rows inside it census 0.

Section 4 budgets *"Party row and party drawer"* as one row, and the census has
a `party row` component and no `party drawer` one, so there is nothing that
measures the drawer's own contents.

**Options.**

1. **Add a `party drawer` component to the census, and read M3.2's done-when
   against the component numbers rather than the surface totals.** The
   instrument gains one selector, the same way M2.3 corrected `.move--chip` and
   the battle-button selector; the surface totals stay on the table for M7.2,
   where the number has to be 0 with every item shipped. M3.2 then claims what
   it closed and names what it did not.
2. **Hold M3.2 open until M3.3 and M5.4 ship.** Accurate to the letter of the
   done-when, and it makes one item's completion depend on two later ones,
   which the list's own "one item, one session" rule is built against.
3. **Read the done-when as already satisfied**, since the component reads 0 on
   every surface it builds. Fastest, and it leaves 60 words charged to a
   component nobody is tracking.

**Recommendation: 1.** It is D2's ruling applied one layer down — the reason
the census counts per component at all is that a surface total cannot check a
component's budget, and this is the same failure with the roles reversed.


---

## D20, closed with the build

**Ruled 2026-09-21. Option 1: one component, in its own module, with the
glyph.**

`ui/stat-block.ts` takes six numbers and a layout and nothing else, which is
what let all four kinds of caller mount it — the party card, the three pick
screens, and the battle panel's inspect layer, which has a serialized string
and no `PokemonState` to hand anything. `statLine` is deleted, its `.statline`
rules are folded into `.stats--row`, and the third copy of the bar ceiling went
with them: `STAT_BAR_CEILING` lives in `data/statInfo.ts`, which M3.1 moved it
to and which is outside `contentHash`.

**The row's own claim was right and worth recording: the census could not see
the second component.** Its `stat block` row read `90 | 108 | 0` against
`.stats` while `.statline` spent six words on `starter` and six more on
`result-capture` in Pocket. Mounting the one component made the instrument
honest and the number move the other way for a moment — `stat block` read
**24** in Pocket on the first pass, because the pick cards' six labels were now
inside a selector that could see them and the Pocket rule hiding the short form
was overridden by an older rule further down the stylesheet. One place decides
it now, with the rest of the density rules. Final: **0 in Pocket**, covering
four call sites instead of one, and `starter` fell 78 → 51.

**The glyph and the unification were one job, exactly as the row said.** Only
M3.1's copy had a mark; `statBlock` and `statLine` both printed `HP`, `Atk`,
`SpA` as text. Section 3's *"Glyph, bar, number"* is satisfied once, in one
file, rather than three times in three shapes.

---

## D21, closed with the build

**Ruled 2026-09-21. A: option 2, the chip comes and PP comes with it. B:
option 1, the census gains a `party drawer` component.**

### A, and the correction the suite forced

The ruling was taken on the understanding that *"the band still goes"*, on the
reasoning this row itself offered: the band is a grouping of the base power the
chip already prints. That reasoning is true about the *number* and wrong about
the *badge*, and `test/band-badge.test.ts` is where it broke — four of its
cases went red the moment the party card drew chips.

That file's header carries the argument this row did not:

> Stage 4.6b put the band badge on the reward card and nowhere else, and the
> card it was missing from was the one that mattered: a player offered a band 3
> read `BAND 3` on the offer, then compared it against four *unlabelled* moves
> on the replacement screen and four unlabelled buttons in the next fight. The
> badge exists to make that comparison possible and it was absent from both
> halves of it.

**The party card is one half of that comparison.** M2.3 could drop the band
from the replacement screen's chips because that screen keeps it twice over —
the pinned incoming card and the two full cards in the confirm — so both halves
stayed on screen. The drawer has no such second channel: it is read-only and
the chip is the whole readout. Dropping the band there removes a fact with
nowhere else to read it, which is C2, and it breaks R12 on three surfaces.

So **the band travels with PP**: a readout surface takes the readout fields.
The chip is unchanged everywhere else — `moveChip`'s new fields are
`ppCounter` and `band`, both opt-in, and the option is deliberately not called
`pp`, because every caller holding a `MoveView` spreads it and `MoveView.pp` is
a bare number. A field named `pp` would have made the replacement screen start
printing PP the day the option was added, on the one surface whose bet is that
it should not.

**One thing the chip gained that the ruling did not name.** A readout chip is a
`<span>`, because nothing on that surface is pickable and a focusable control
that does nothing is the keyboard trap `renderTraits` already refuses to build.
But a `<span>` carrying `data-tip` and nothing else is a trigger a keyboard
cannot open, so it keeps `role="button"` and a tab stop — the pair `moveCard`
has carried since M2.1, for the same reason. `test/party-drawer.test.ts` sweeps
it and asserts it still writes nothing.

### B, and the residue it exposed

The census has a `party drawer` component now, on `.drawer__sheet` rather than
`.drawer`, because the overlay's root spans the scrim and the scrim is not the
drawer.

**The party row reads 0 on every surface the component builds** — the drawer,
the party screen, pre-gym and the map rail — and 60 across the two that
hand-roll a card inside `.party__member`: 42 on the teach target (M3.3) and 18
on the capture list (M5.4).

**The drawer itself reads 13 in Pocket, and no item on the list owns any of
it.** Four section headings (`Your party`, `Relics`, `Density`, `speed`), two
two-word blurbs (`Carrying now`, `Read only`) and four picker labels
(`Detailed`, `Pocket`, `Even`, `Patient`). None of it is the party row; all of
it is the settings surface the drawer also happens to be.

**That is the open part of this row.** Section 4 budgets the drawer at 0 and
does have a theory of control labels elsewhere — the result screen's 6 includes
"continue", the pre-gym's 4 includes "Choose lead" — so the drawer's 0 is a
figure written for a drawer that holds a party and not for one that also holds
the density picker. It blocks nothing: M3.2 closed the party row, which is the
half of section 4's row it owns. **Recommended for M6.3**, which is the item
that touches the density default and will be reading that picker anyway, either
as a budget line for the drawer's controls or by moving them off it.


---

## D22. The decline overlay's budget was derived before the component it budgets existed

**Ruled 2026-09-21. The figure rises from 4 to 6, matching the replace
overlay.** Filed and ruled the same day, inside M3.3, because the item that
built the overlay is the item that measured it.

M3.3 built the decline as `ui/band.ts`, the one confirm component, per the
record: *"Decline copy: 'Forfeit this reward?' with the two cards."* It
measures **5** words — `Forfeit`, `this`, `reward`, and the band's `Forfeit`
and `Keep` — against section 4's ceiling of 4.

**The overlay is not over-written; the number was wrong.** D1 audited this
exact row on 2026-09-19 and recorded *"Counting the rule as written: 3"*. The 4
was derived from the question alone, with one word of headroom, at a time when
every confirm in the tree was three hand-rolled dialogs and `ui/band.ts` did
not exist. A confirm cannot have fewer than two controls, so no copy satisfies
4 except by shortening a question both the record and section 4 give verbatim.

The replace overlay carries 6 and absorbs its two controls without comment,
which is the tell: one of the two rows was written against the component and
one was not.

**What was rejected, and why.**

- **5, exact.** Brittle in the way D1 refused for four other rows: any future
  copy change on the overlay becomes an amendment rather than a budget check.
- **Shorten the question to fit 4.** `Forfeit reward?` fits. It edits
  player-facing copy that the record and the bible both give verbatim, in order
  to satisfy an arithmetic error.
- **Rule control labels out of the count.** Conceptually the cleanest — a
  confirm's buttons are its mechanism — but it changes the counting rule D1
  deliberately left standing, and it silently lowers several other surfaces'
  measured numbers. Far more blast radius than the defect.

**The bet, and it is being watched.** Raising a ceiling to fit what shipped is
the change most likely to be wrong, so it is a row in section 9's register
rather than a quiet edit: *if a confirm reaches 6 with copy that reads as
padded, or a third control is ever needed on one, the controls come out of the
count and every confirm budget drops by two* — rather than the ceiling rising
a second time.

`test/item-target.test.ts` pins the measured 5 either way, because no gallery
fixture opens a confirm and the census reads that component `absent`. A budget
nothing measures is a budget nothing holds.

---

## Rulings, 2026-09-21, opening Tier 4

Five rows filed against Tier 4's three items before any of them was built,
from a reading done while Tier 3 was still closing
([`../handoff/4.10-tier-4-prep.md`](../handoff/4.10-tier-4-prep.md), which
carries the options in full and the arguments beneath each ruling). **Four are
ruled; D26 is open and blocks only M4.3's last clause.**

| Row | Ruling | Where it lands |
|---|---|---|
| D23 | **Hits only, plus a bounded second channel.** R9 binds a hit on a target and stays as written. `priority`, `field`, `prevented` and `failed` are not outcomes on a target, so they render beside the one hit flag rather than competing with it, at most one per side, in protocol order. | Bible section 4's flag row gains a clause. Milestone M4.1 scope |
| D24 | **One *flag* per hit, not one word.** The row is corrected to what D7 filed it to say. | Bible section 4 |
| D25 | **Re-encode the event line wordless**: the actor's side mark plus the move's name, the name being a proper noun. Deleted instead if it cannot be drawn inside section 2's nine families. | Milestone M4.3 scope |
| D27 | **Hue on the effectiveness kinds only**, from the forecast's own tokens. The shipped rule is restated as the thing it always was: no weight axis. | `ui/styles.css`, `data/flagWords.ts` headers. Milestone M4.2 scope |
| D26 | **Open.** Build the pull gesture, or keep the tap and record a deviation. | Milestone M4.3 |

**One recommendation was withdrawn by the merged bible rather than ruled.** The
prep doc recommended taking the effectiveness flags *wordless* — the forecast's
edge colour and fraction on the target, no word — on the reasoning that R8 ties
the two vocabularies and the forecast spends no words. Section 3 forecloses it:
*"Effectiveness (feedback) | One word on the target, edge colour family"*. The
encoding table is presentation and the bible wins over a prompt, a milestone and
a recommendation alike, so the word stays and D24 is what makes the budget
reachable. Recorded here because a session reading the prep doc alone would
build the wrong thing.

---

## D23. R9's precedence ranks seven outcomes; the vocabulary it ranks has fifteen kinds

**Ruled 2026-09-21: hits only, plus a bounded second channel. Blocks M4.1.**

R9: *"at most one flag appears on a target, by fixed precedence: no effect,
miss, super effective or not very effective, critical, status inflicted, berry
fired, stat stage changed."* Seven entries, eight kinds.

`FlagKind` carries seventeen. Take away `stab` and `contact`, which M4.1
deletes, and fifteen remain. R9 names eight of them. It says nothing about
`priority`, `prevented`, `failed`, `ability`, `volatile` or `field`.

Those six are not an oversight in the mapper. They are the abnormality classes
the battle-animation run measured over 699 battles
([`../reports/battle-anim-2-protocol-census.md`](../reports/battle-anim-2-protocol-census.md)),
and M4.1's own text says to **keep the seven measured kinds**. R9 predates them
by a release.

The scoping question is inside the same row, and it is what decided it. R9 binds
*a hit on a target*. `field` is about neither Pokemon. `priority` is about turn
order. `prevented` describes a turn in which no hit happened at all — it exists
precisely because a flinched turn draws no damage, no chunk and no beat, so
without a word it is indistinguishable from a turn that did not happen. A
precedence that ranks those against `crit` ranks things that never compete, and
ranking them is how the flinch loses its only channel.

**The ruling.** R9 stays as written and binds hits: one flag per hit, by its
precedence, among the kinds it names. The kinds that are not outcomes on a
target form a second channel and render beside it, bounded at **one per side,
in protocol order** — protocol order because `flags.ts` already argues it is
*"the one ordering that is a fact rather than an opinion"*, and bounded because
an unbounded second channel is the strip before this item.

Section 4's flag row gains a clause saying what the second channel costs. No
rule moved.

**What it costs, and why that is re-encoding rather than removal.** The strip
shows every flag of the group today; under this ruling most turns lose one or
two. `ui/abnormality.ts:109` already takes one mark per side on the stated
argument that *"the strip carries the rest"* — that comment is now half true and
the item says so where it edits it. What leaves the strip is carried elsewhere:
the log sheet holds every line one tap away, the panel draws status and stat
stages independently and permanently, and an emptied item slot is the berry.
C2 is satisfied by those channels, not by the strip's old behaviour.

**The filter belongs at the strip, not in the mapper.** The mapper returns the
list, which is R9's own enforcement clause, and two consumers read it: the strip
and the animation. A precedence applied upstream would silently change which
beats play.

---

## D24. The flag strip's budget is one *word* per hit, and nine flag words are two or three

**Ruled 2026-09-21: the row means one flag. Blocks M4.1's strip and M4.3's
done-when.**

Section 4, Rev 2, the row D7 added: *"Flag strip (battle) | 1 per hit | The one
flag word R9 allows."*

`flagWord()` produces `Super effective` (2), `Not very effective` (3), `No
effect` (2), `Critical hit` (2), `Could not move` (3), `Badly poisoned` (2),
`Attack rose` (2), `Harsh sunlight` (2). The census reads `Paralysed` and
`Badly poisoned` on the battle screen today and will read two or three words
there after M4.1 cuts the strip to one flag per hit.

So M4.3's *"census on the battle screen reads 0 outside the flag strip"* is
unreachable against the shipped vocabulary even when the item has done
everything it was asked to do. One of the two figures is wrong.

**The ruling: the budget row means one flag per hit, whatever that flag's word
count.** That is what D7 filed the row to say — the row exists because R9 puts
one flag on every hit and section 4 budgeted no surface that contained it — and
"the one flag word R9 allows" names R9's one flag rather than counting to one.

**What was rejected.** Cutting the vocabulary to a word each (`Super`,
`Resisted`, `Immune`, `Crit`, `Poisoned`) meets the row as literally written and
costs real distinctions: `Badly poisoned` against `Poisoned` is two different
statuses, and the panel's `TOX` chip carries that difference only for a reader
who already knows the chip. Section 3 asks for *one word* on the feedback flag
specifically for effectiveness, and that row is met by `Super effective` being
one flag; a vocabulary cut is not what it asks for.

The battle screen's own budget still excludes the strip, and everything else on
that screen still goes to 0. This row moves the carve-out's unit, not its
scope.

---

## D25. The event line is a sentence at rest on the screen R11 says carries nothing written

**Ruled 2026-09-21: re-encode it wordless. Blocks M4.3.**

R11: *"The battle screen shows the turn header, the panels, the flags and
nothing written."* Forbids *"a text line for turn order."*

`ui/copy/events.ts` renders `Opposing Snorlax used Body Slam` into
`.flags__event` every turn. It is V5's, it is deliberate, and its header argues
for it: a Splash that did nothing worth a flag still says what was used. Under
the counting rule it costs one word — `used`, or `came in for` — and the census
reads it on the battle screen today.

M4.3 says *"if any turn-order text line survives on the battle screen, remove
it"*, which reads as licence to delete this without naming it.

**The ruling: keep the fact, spend no words on it.** The actor is already drawn
— `.flags__event[data-side]` marks whose Pokemon acted in the log's own
vocabulary — and the move's name is a proper noun, which the counting rule
excludes. What costs a word is the verb between them, and a verb is what R11
calls a sentence. The line becomes the side mark plus the name.

**If that cannot be drawn inside section 2's nine families, the line is deleted
instead** and the item's report says the fact moved to the sheet. Adding a
family to keep it would be a tenth family for a verb, which section 2 makes an
amendment and section 7 would object to on its own terms.

**Why not simply keep it.** Keeping a sentence at rest on this screen is an
amendment to R11, and section 10.1 makes an amendment a disconfirmer observed
in a playtest and recorded with a date. None is recorded. M7.1 can observe one;
this item cannot assume it.

---

## D26. The log sheet opens by a labelled button where the item says pull

**Open. Blocks M4.3's last clause and nothing else.**

M4.3: *"the log sheet is reachable by pull."* It is reachable by a click on
`flags.history`, a `<button>` reading `History`, wired at
`ui/screens/battle.ts:121`. `ui/log-sheet.ts` has no gesture at all.

Two things follow. The item's clause is a build rather than a verification. And
`History` is a word at rest on the battle screen: the census charges it to the
flag strip component because it sits inside `.flags`, but section 4's carve-out
is *"the one flag word R9 allows"*, and a control label is not a flag word. The
screen cannot reach 0 while the button wears a word.

Section 5's canon has no row for a history control. R5 forbids *"a help
button"* as an explanation route, which the sheet is not, so R5 does not reach
it — but a glyph-only control is a mechanism a player must discover, which is
section 7's concern and R7's answer.

**Options.**

1. **Build the pull; keep a glyph handle as the visible affordance.** Both
   routes, one word fewer, and the gesture is discoverable because the handle
   is drawn where the sheet comes from. R7's exposure label carries the first
   encounter.
2. **Keep the tap, swap the word for a glyph**, and record the "pull" clause as
   a deviation in `generation.md`. Cheapest; leaves the item's own text unmet.
3. **Keep both the tap and the word**, and amend section 4 to allow one word of
   furniture on the battle screen.

**Ruled 2026-09-21: option 1.** Build the pull, keep a glyph handle as the
visible affordance, and let R7's exposure label carry the first encounter.

**Recommendation: 1.** It is the only option that meets the item as written, and
the exposure store M1.3 built is exactly the mechanism for a new gesture's first
encounter.

**It waited, and that was the right order.** M4.1 and M4.2 do not touch the
control, so the row blocked nothing until M4.3 was the item in front of it.

---

## D27. The strip's shipped rule says every chip is the same chip; section 2 gives the feedback flag the forecast's colour

**Ruled 2026-09-21: hue on the effectiveness kinds only. Blocks M4.2.**

R8: forecast and feedback *"share a colour family and a glyph family and nothing
else."* Section 2's Effectiveness row: *"Coloured left edge on the button plus
the multiplier as a fraction or numeral. … **The same colour on the feedback
flag**."* Section 3: *"Effectiveness (feedback) | One word on the target, edge
colour family."*

Three places in the tree say the opposite, and all three were written before the
bible:

- `ui/styles.css:545` — *"**Every chip in here is the same chip** … no per-kind
  hue, no size or weight modifier. A super effective flag drawn heavier than a
  not-very-effective one would make the strip a recommendation."*
- `data/flagWords.ts` — *"There is no size, no colour and no emphasis field …
  a `weight` column would be the first place that rule broke."*
- `test/battle-feedback.test.ts` — *"draws every flag on one chip recipe, with
  no per-kind weight or hue."*

**They are not the same claim, and that is the whole row.** What the tree
forbids is a **weight axis**: one kind drawn louder than another, which turns a
reading into a recommendation and is C1. What the bible asks for is an
**encoding axis**: the same family on both sides of one fact, so a player who
has learned the edge on the button reads the flag without learning it twice.
`--stage-up` and `--stage-down` already sit on `super` and `resisted` on the
button, at equal weight, with the fraction carrying the same fact in a channel
colour vision cannot touch.

**The ruling: `super`, `resisted` and `immune` take the forecast's own tokens
and the effectiveness glyph. Every other kind stays exactly as it is drawn
today.** The shipped rule is restated rather than deleted — *no weight axis* —
and the test is rewritten to assert that, not weakened: every kind is one
recipe, one size, one weight, and the two directions of the one fact that has a
colour family are drawn identically apart from which end of it they name.

**What was rejected.** A family per class puts nine chip treatments on one line,
which is section 7's objection at scale. Sharing the glyph family alone leaves
the button and the flag looking unrelated, which is the thing R8 exists to
prevent.


---

## D28. The battle screen's header carries three facts, and section 4 budgets none of them

**Open. Blocks M4.3's done-when. Opened 2026-09-21, reading into M4.3.**

M4.3's done-when: *"census on the battle screen reads 0 outside the flag
strip."* The strip is D24's business and the event line is D25's. What is left
on that screen once both are done is the **header**, and nothing in the bible
has ever said what it may carry.

`ui/screens/battle.ts:130` sets two lines:

| Line | Real values | Words, counting rule applied |
|---|---|---|
| `title` — `node.label` | `Wild encounter`, `Trainer battle`, `<Leader>'s Gym` | 2, 2, 1 |
| `detail` — opponent, then AI tier | `Wild Pidgey · Rookie`, `Trainer's Pidgey · Ace`, `Trainer (3) · Seasoned` | 2, 2, 2 |

Section 4 has no battle-screen row and no header row. Section 5's canon has no
header component. So the done-when asks a surface to reach zero without ever
saying what that surface is allowed to show, which is the same shape of gap D7
filed for the flag strip and D19 for the ability chip.

**And the census cannot see one of the three.** `ui/gallery.ts:479` calls
`battle.attach(session, node, reveal, onChoose)` with **no segment**, and the
tier line is built as `segment === undefined || !node.encounter ? null : …`. The
app passes `state.currentSegment` (`ui/app.ts:1360`); the fixture never has. So
`Rookie`, `Seasoned` and `Ace` have never been counted on any surface, and the
battle screen's measured 10 is lower than the screen a player sees. The
instrument understates the surface the item is about to be judged on, which is
D17B's rule pointing the other way for once.

**The three facts are not furniture.** The AI tier was put on this header by the
tiers patch *deliberately*, and its comment says why: *"The same word the node
card showed before the click, so the card's claim and the fight agree — a
readout that changed between the two would be worse than no readout."* It is an
attribute, it names how the opponent plays, and C2 forbids dropping it. The
opponent line is the one place a wild fight says what it is against a trainer
fight. The node label is what the player clicked.

**Options.**

1. **Budget the header, explicitly.** A section 4 row — *"Battle screen header |
   4 | node kind, opponent, AI tier"* — and a section 5 canon row naming it.
   M4.3's done-when becomes "0 outside the flag strip and the header". Nothing
   moves, nothing is dropped, and the bible stops being silent about a surface
   that has been on screen since Stage 1.
2. **Re-encode the header to zero.** The node kind has a glyph family already
   (the map node card's), and the opponent's species is a proper noun and free.
   **The AI tier has no glyph and cannot borrow one**: section 2's nine families
   are type, category, band, PP, accuracy, priority, effectiveness, status and
   stat, and a tier mark is none of them. This option therefore requires a tenth
   family, which section 2 makes an amendment and section 10.1 makes a
   disconfirmer observed in a playtest. None is recorded.
3. **Scope M4.3 to the board.** Rule that "the battle screen" in the done-when
   means the panels, the moves and the strip, and that the header is a separate
   surface budgeted by a later item. Cheapest, and it leaves M7.2 measuring a
   surface no row covers — which is how this row came to exist.

**Ruled 2026-09-21: option 1.** Section 4 gains a *Battle screen header* row at
**4** — node kind, opponent, AI tier — and section 5's canon names the header as
a component. M4.3's done-when reads "0 outside the flag strip and the header".
Bible Rev 6. No rule moved: a surface that had no row has one.

**Recommendation: 1.** The tier is a fact two surfaces deliberately agree on, C2
forbids removing it, and the only encoding that would take it to zero needs a
tenth glyph family the bible reserves for an amendment with evidence behind it.
A budget row is the honest admission that this screen has a header.

**Independent of the ruling: the fixture is wrong and M4.3 fixes it.** The
gallery must pass a segment so the census counts the tier word. That will
*raise* the battle screen's measured number before any item lowers it, which is
the right direction — D17B's rule is that an instrument which flatters the item
making the change is worse than an honest number.

---

## Rows filed 2026-09-22, opening Tier 5

Seven rows filed against Tier 5's six items before any of them was built, from
the reading in [`../handoff/4.10-tier-5-prep.md`](../handoff/4.10-tier-5-prep.md),
which carries the measurements under each one. **One is closed; the rest are
open.**

**D35 was filed last and is the one Tier 4 asked for by name.** Its handoff said
to check the fixture before trusting a number on any surface, and that nobody
had looked at the others. Looking found three items measured on a fixture that
cannot produce the condition they exist for, two of them from one line of
`gallery-fixtures.ts`.

D30 and D31 are instrument rows: they apply rulings that already exist — D2,
which says the census counts per component *so that* a component budget can be
checked, and D21b, which restated it one layer down for the drawer — rather
than asking for new ones, so they close on the build the way D2 did.

**D30 is closed.** It was built the day it was filed, before any card was
touched, and it grew a second half while being built: the table summed
instances where D1 makes every budget a ceiling and a ceiling binds the worst
one. The before-numbers are under its row.

**D31 is open and is not a pre-tier commit after all.** The two band fixtures
add gated surfaces, which reconciles against `visual-pocket`, `visual-coverage`
and `density`. That is M5.5's own work, and doing it early would put three test
files in a commit that claims to be instrument-only.

D29, D32, D33 and D34 each edit a table in the bible and are the lead
designer's. **D33 is the one to read first**: it is the only row in the
register whose measurement says the item cannot ship anything at all under the
number as written, and it was invisible until a script counted.

| Row | Blocks | Costs |
|---|---|---|
| D29 | M5.1 to M5.4 | A section 5 amendment: three canon rows, one unification, one call site |
| D30 | M5.1 to M5.4's done-whens | **Closed on the build.** Four selectors and a worst-instance column |
| D31 | M5.5's done-when | One fixture and one word of vocabulary, inside M5.5. No ruling |
| D32 | M5.3 | A section 4 row for a screen that has none |
| D33 | M5.6 | Either the number 40, or the four hints |
| D34 | M5.1 | A re-encode, or a second budget on one card row |
| D35 | M5.1, M5.2 done-whens | One fixture each, inside the item. No bible change |

---

## D29. Section 5's canon names none of the five card surfaces section 4 budgets

**Blocks M5.1, M5.2, M5.3 and M5.4.**

Section 4 budgets five surfaces that are cards:

| Section 4 row | Budget | Built in | Class |
|---|---:|---|---|
| Item, berry or relic reward card | 8 | `screens/reward.ts`, `renderRewardCard` | `.reward` |
| Shop stock card | 8 | `screens/shop.ts`, **its own** | `.shop__item` |
| Map node card | 0 | `screens/run-map.ts` | `.node` |
| Locale card | 0 | `screens/locale-select.ts` | `.locale` |
| Capture card | 0 | `screens/acquisition.ts` | `.party__member--offered` |

Section 5 lists ten components and **none of the five is among them**. Its own
opening line is the rule they fail: *"One component per attribute cluster. A
screen mounts components; it never draws an attribute itself."*

**The shop card is the sharp end, and it is section 5's closing sentence
already true in the tree.** Section 4 says *"Shop stock card | 8 | Follows the
reward card, plus price number"*, so the bible's position is that these are one
component. They are two. `renderRewardCard` is exported from
`screens/reward.ts` and has **exactly one** call site, `screens/result.ts:200`.
`screens/shop.ts` never imports it: it builds `.shop__item` from scratch at
lines 86 to 123, with its own kind label, its own name, its own detail line and
its own `itemById`, `relicById`, `describeMove` and `moveCard` reads. Section 5
closes with *"A component that exists twice, or a screen that draws a stat
without the stat block, is the defect this document exists to prevent"* — and
this is the first half of that sentence, on the two surfaces M5.1 names in its
own title. M5.1 cannot hit "8 or under per card" on two cards that are two
different pieces of code without either unifying them or writing the budget
twice.

**The node card has the two call sites the canon's test asks for**, drawn on
the map screen and again inside the map drawer, so it is a component by section
5's own standard and not a screen-local detail.

**The capture card is the other shape of the same defect.** M5.4 says *"Capture
card mounts the party row"*, and section 5's party row row lists its call sites
as *"Drawer, party screen, pre-gym, map rail, teach target"*. Capture is not one
of them — but `screens/acquisition.ts:215` already gives the card the party
row's own class, `.party__member party__member--offered`, and then hand-builds
`panel__header` and `panel__meta` inside it at lines 218 to 266, drawing
species, level, HP and four move names itself. So it wears the component and
does not mount it: the census attributes its words to the party row while the
party row's code never runs. That is the second half of section 5's closing
sentence, and M5.4 is the item that fixes it. Fixing it adds a call site to the
canon, and a canon edit is an amendment.

**Options.**

1. **Amend section 5 with the missing rows, and unify the two that are one.** A
   reward card row (owning the kind glyph, the sprite slot, the effect line, the
   type chip and the shop's price number) with **two** call sites, `result.ts`
   and `shop.ts`, which means `screens/shop.ts` mounts `renderRewardCard` rather
   than its own `.shop__item`; a map node card row (node-type glyph, tier pips,
   reward-tier pips, capability glyph); a locale card row (name, four type
   chips, swatch); and capture added to the party row's call sites. Section 4's
   *"Capture card | 0 | Follows the recipient card"* already says the capture
   card is not its own component, so it gets no row of its own — the recipient
   card's row grows a second call site instead.
2. **Rule the five screen-local and exempt them from section 5.** Cheapest
   today, and it reopens the class of defect C1 and section 5 exist to catch:
   a card three words over budget hides inside a screen total that is under it.
3. **Re-cut section 5 to say which surfaces are exempt.** Turns the canon into
   a list of exceptions, which is the shape it was written to replace.

**Recommendation: 1**, and specifically 1 with the capture card folded into the
recipient card rather than given a row. The budget table already treats them as
one thing — *"Follows the recipient card"* — and two rows for one component is
the defect one row down from the one being fixed. No rule moves: four surfaces
that had no row get one, which is exactly what D28 did four days ago for the
battle screen header.

---

## D30. The census has no component row for any of the five, so four done-whens are not computable

**Blocks M5.1, M5.2, M5.3 and M5.4's done-whens. Ruled by D2; closed on the build, 2026-09-22.**

D2 ruled that the census counts **both** — per screen for the screens, per
component instance for the components — on the grounds that *"a per-screen
census cannot check a per-component budget"*. D21b restated the same thing one
layer down when it found the drawer being measured by the map screen behind it.

`COMPONENTS` in `scripts/visual/census.ts` has ten entries. None of them is a
reward card, a shop stock card, a map node card or a locale card. So:

| Item | Done-when | Computable today |
|---|---|---|
| M5.1 | "census reads 8 or under **per card**" | **no** |
| M5.2 | "census reads 0" (the node card) | **no** |
| M5.3 | "census reads 0 and 4" (the locale *card*) | **no**, and see D32 |
| M5.4 | "0 for the capture card" | yes, by accident — see below |

Four of the tier's six acceptance tests are written against a number the
instrument does not produce. The per-surface totals that do exist are the very
thing D2 ruled insufficient: `shop` reads 64 in Pocket less shell and that
number cannot say whether any one card is over 8.

**The capture card is the exception, and it is not a reassuring one.**
`screens/acquisition.ts:215` gives it `.party__member`, which is the party row's
selector, so the census already counts it — as a party row. The number is
attributable and the attribution is wrong: today it charges the capture card's
own hand-drawn contents to a component whose code never ran on that surface (see
D29). It needs no new selector. It needs M5.4 to make the class tell the truth.

**Options.**

1. **Add the five selectors to `COMPONENTS`, with a reason each, as one
   instrument commit before M5.1.** The same instrument-first move M4.3 made on
   the battle node and the browser-suite item made on the chip sweep.
2. **Check per screen and accept the totals.** Contradicts D2 directly.
3. **Drop the four done-whens and assert each card in a unit test.** Loses the
   delta M7.2 needs, which is the reason the census exists.

**Recommendation: 1.** This row asks for no new ruling: it is D2 applied to
five components D2 did not know about, and the correction belongs to the
instrument rather than to the bible. It closes on the build.

**One thing the build must not do.** Add the rows and re-run the census
*before* touching any card, and commit that number. An instrument that arrives
in the same commit as the change it measures cannot say which of the two moved
the figure — D17B's rule, and M4.3's.

**Built 2026-09-22, before any card was touched, and it found a second half of
itself.** Four selectors went in — `.reward`, `.shop__item`, `.node`,
`.locale` — and the table they produced could still not check a budget, because
`renderTable` **summed** every instance of a component. D2's ruling says "per
component *instance*"; the script was counting per component. For a budget of 0
the two are the same number and nothing was wrong for four tiers. For a budget
of 8 they are not: three reward cards summing to 22 is 8 + 8 + 6, which passes
a ceiling, or 14 + 4 + 4, which does not. D1 ruled every figure in section 4 a
ceiling, and a ceiling binds the worst instance. So `Record_` carries an
instance ordinal now, scoped to its surface, and the per-component table has a
**worst instance** column. That column is the one a budget is read against.

The before-numbers, Pocket, worst instance:

| Component | worst | budget | over by |
|---|---:|---:|---:|
| reward card | 8 | 8 | **0** |
| shop stock card | 11 | 8 | 3 |
| map node card | 12 | 0 | 12 |
| locale card | 6 | 0 | 6 |
| capture card, as a party row | 3 | 0 | 3 |

**Do not read the reward card's 8 as the reward card being done.** The fixture's
result screen offers an item, a heal and a TM; **no relic card renders on any
fixture in the gallery**, and a relic's description is 16 words at the median
(D34). The heaviest reward card the instrument can see is not the heaviest
reward card the game draws. This is Tier 4's second finding for the third time:
a fixture that cannot produce the condition an item exists for cannot measure
that item. M5.1 either adds a relic offer to the result fixture or reports the
relic card asserted rather than censused.

---

## D31. The census calls a built component absent, because no fixture opens a band

**Blocks M5.5's done-when. Closed 2026-09-22, on M5.5's build.**

`docs/design/text-census.md` reads:

    | confirm overlay | absent | absent | absent |

and `scripts/visual/census.ts` documents that value precisely: *"A component
with no call site in the tree yet reports `absent` rather than zero, because
zero words and no component are different facts and only one of them is done."*

`ui/band.ts` has **four** call sites — `item-target.ts`, `party.ts`,
`acquisition.ts` and `move-replace.ts`. The component is built, shipped and
reachable. What is absent is a fixture that taps something: a band only exists
after a click, and the gallery photographs screens at rest.

So the instrument is printing a false statement about the tree, in the one
vocabulary it reserved for the true one, and M5.5's done-when — *"census reads
6 and 4"*, 6 and 6 after D22 — cannot be evaluated at all.

This is Tier 4's second standing finding in a new place: **a fixture that
cannot produce the condition an item exists for cannot measure that item.** M4.1
and M4.2 both hit it and both reported a delta of zero rather than claiming a
reduction.

**Options.**

1. **Two gallery fixtures that open the two bands**, so the census photographs
   the replace confirm and the forfeit confirm at rest inside their own
   surfaces. `openBand` already takes a host element, so this costs a fixture
   and no production code.
2. **Assert both directly in `test/band.test.ts`** and record the census as
   unmeasurable for this component, the way §61 and §62 did.
3. **Split the vocabulary**: `absent` keeps meaning "no call site", and a
   component with call sites that no fixture renders reports `unrendered`.

**Recommendation: 1 and 3 together.** The fixture is the measurement M5.5's
done-when asks for and it is cheap; the vocabulary fix is what stops the next
reader believing what this table currently says. Option 2 is the fallback if a
band turns out to need a real click path the gallery cannot fake — and if it is
taken, it is recorded as a deviation rather than as a reduction.

Neither half needs a ruling. Both close on the build.

---

## D32. The locale screen has no budget row, and M5.3 pairs a card number with a screen number

**Blocks M5.3.**

M5.3's done-when: *"census reads 0 and 4."* Section 4 supplies the two figures
from rows of different kinds:

| Section 4 row | Budget | What it is |
|---|---:|---|
| Locale card | 0 | a **component**, one of four on the screen |
| Pre-gym screen | 4 | a **screen**, chrome included |

The locale *screen* is budgeted nowhere. It carries, in Pocket, a heading
(*"Segment N — choose a region"*), a blurb (*"The region decides the wild
Pokemon here and nothing else"*), the gym rail's label (*"This segment ends
at"*), and a party strip that draws species and level itself. The census reads
**45 in Pocket less shell**, of which the four locale cards' blurbs are roughly
a quarter.

So a session that builds M5.3 exactly as written takes the four cards to 0,
takes the pre-gym screen to 4, leaves some thirty words of locale chrome
standing, and passes its own done-when. M7.2 then measures a surface no row
covers — which is the sentence D28 was filed with four days ago about the
battle screen header, and the reason that row exists.

**Options.**

1. **Add a *Locale screen* row to section 4, at 4.** The same figure as the
   pre-gym screen, because it is the same job on the same kind of surface: name
   the thing you are about to walk into, and choose. M5.3's done-when becomes
   "0 for the card, 4 for each of the two screens". Nothing else changes.
2. **Read M5.3's 0 as the card only and leave the screen unbudgeted** until
   M7.2 finds it. Cheapest, and it defers a known gap into the item whose whole
   job is to have no gaps left.
3. **Budget every screen.** This is D2's option 3, which was refused: it
   re-cuts the bible's most-referenced table to make one measurement cheaper.

**Recommendation: 1.** It changes no rule, it reuses a number the bible already
chose for the sibling surface, and it is the fourth time this shape has come up
(D7, D22, D28, this) — a surface that has been on screen since Stage 1 with no
row, found by the item that finally has to hit a number on it.

---

## D33. The event budget is smaller than the sum of its own row, and the row has no line for the four hints

**Blocks M5.6.**

Section 4: *"Event screen | 40 | Prompt under 30, choices under 6 each, outcome
one line."*

Thirty, plus four choices at six, is **54** — before the outcome line, and
before a single hint. The row's own composition exceeds the row's own total, so
an event that meets every sub-budget the bible names still fails the budget the
bible sets.

**And the row does not mention the hints at all.** Every event has four, one
per option, and they are the whole of the overflow. Measured on this tree:

| | |
|---|---:|
| Events over 40 words | **24 of 24** |
| Median | 67 |
| Range | 62 to 75 |
| Hooks over 30 words | **0 of 24** |
| Labels over 6 words | **1 of 96** |

Hints run 8 to 15 words each, four to an event: roughly 40 words per event
before the hook is counted. The hook and the labels are already inside their
sub-budgets almost without exception. **There is nothing to tighten.** The
number cannot be reached by writing better copy; it can only be reached by
changing the number or by removing the hints.

**D8 ruled the remedy, not the budget.** On 2026-09-20 it ruled that an event
that cannot fit is *reported*, not moved, and that the capability-requirement
remedy waits for M7.1 to observe its disconfirmer. That ruling was made against
an estimate. The measurement says the report is all twenty-four, by a median of
twenty-seven words, which is not a report — it is an item that ships nothing
and a lint that is red on every row from the day it lands.

**C2 is what makes this hard.** `data/events.ts` says of the hints: *"Never
names the drawn outcome — that would make the choice a formality — but it must
be honest about the shape of the risk. 'Might be a trap' is a decision; saying
nothing at all is a coin flip with extra steps."* A fact that changes a
decision is re-encoded, never removed.

**Options.**

1. **Amend the row to name the hints and re-derive the number.** Hook under 12,
   four labels under 4, four hints under 6, one outcome line: 52. Honest, and
   an amendment to a table rather than to a rule — the same class as D28. It
   concedes that 40 was written before the four-tier rejig gave every event four
   hints.
2. **Hold 40 and re-encode the hints wordlessly.** This is available, and it is
   the option the measurement argues for. **The decision content of a hint is
   already on the screen as structured data**: the reward-tier range is drawn
   from `eventCopy.ts` as `Reward T0 to T2` against the safe option's
   `Reward T1`, and that range *is* the shape of the risk; the toll is drawn as
   `Costs HP party` from the `TollPrice` the event already carries. What the
   prose adds on top of the pips and the toll is atmosphere, and section 4
   budgets words rather than atmosphere. C2 holds because the two facts that
   change the decision — variance and price — stay on screen in the encoding
   R2 asks for.
3. **Ship the lint red on 24 of 24** per D8 and hand the whole table to M7.1.

**Recommendation: 2, with 1 as the named fallback.** It is the only option that
keeps a number the bible chose and removes no decision fact, and it is the move
R2 exists for: trade the word for the encoding that is already drawn beside it.
The fallback is not hypothetical — if a playtest shows a tester cannot read
variance off a pip range, option 1 is what the disconfirmer buys, and it should
be written into section 9 as that row's consequence when this is ruled.

**Either way, D14 has to be ruled with it.** Both options reach every string in
`data/events.ts` — option 2 deletes a field, option 1 rewrites twenty-four of
them — and that file is inside `contentHash`. See D14's option 2, which has
been waiting for exactly this and costs the same hash move it cost at Tier 0
while buying the whole table instead of two words.

### Ruled 2026-09-22: option 1, and built the same day

**Option 1: amend the row to name the hints and re-derive the number.** The
recommendation was 2 and it was not taken — the hints stay and the number
moves. Section 4's event row is **59** at Rev 11, and D14 was ruled with it as
this row required (option 2, split, built with M5.1's half at §65).

**The number is 59 and the ruling composed 52, and the seven words are this
row's own defect avoided.** Hook 12 plus four labels at 4 plus four hints at 6
is 52 exactly, with nothing left for anything else on the screen — which is
precisely the shape of the complaint above, one revision later. So the amended
row names every part it budgets: the copy's 52, the Toll's price chip at 5, and
the control at 2.

**Three things left the screen as marks rather than as cuts, and none of them
is option 2.** Option 2 was *remove the hints*; what M5.6 did is re-encode
three attributes that section 3 already specifies and that were rendering as
words anyway — the capability requirement and its band as the glyph and chevron
M5.2 built, the reward range as the reward-tier pips section 3 has named since
Rev 1 with no call site in the tree. The screen's title went too, because the
hook says what it said. Twenty-six words, none of them a hint.

**What the sub-budgets are, and where they came from.** Measured over the tree
before a word was rewritten: hooks p90 12 and max 12; labels p50 4, p90 6;
hints p50 10, min 7. So 12 is the hooks' own ceiling and cost nothing, 4 is the
labels' median and cost twenty-eight rewrites, and **6 is a number no hint
reached** — all ninety-six were rewritten. Derived from the corpus, then
written to; not guessed, then enforced.

Section 9 carries two bets this makes: that a six-word hint still carries the
shape of a risk, and that a span of pips reads as a range rather than as a
rating. Either firing raises the row rather than dropping a fact, which is C2.

---

## D34. Eight words cannot carry what a relic description carries, and C2 forbids dropping the difference

**Blocks M5.1.**

M5.1: *"one effect line under eight words from a `playerDescription` field in
`data/items.ts` and `data/relics.ts`"*. Section 4: *"Item, berry or relic
reward card | 8 | One effect line."*

Measured on this tree:

| | entries | over 8 words | median | max |
|---|---:|---:|---:|---:|
| `items.ts` `blurb` | 38 | 14 | 5 | 14 |
| `relics.ts` `playerDescription` | 10 | **8** | **16** | 18 |

The items are a copy-tightening job: fourteen strings, median 5, and the worst
of them (`eviolite`, 14) says one thing in too many words.

**The census cannot see any of this, and reads 8.** D30's worst-instance column
puts the heaviest reward card in the gallery at exactly its budget — because the
fixture's result screen offers an item, a heal and a TM, and **no relic card
renders on any fixture**. The number that matters here is measured off
`data/relics.ts`, not off the instrument. Whichever way this row is ruled, M5.1
adds a relic offer to the result fixture or says in its report that the relic
card was asserted and not censused.

**The relics are not.** Every one of the ten is two sentences doing two jobs:

> `rusted-machete`: *"Opens the way through anything overgrown. Something turns
> up in the cleared brush after every fight."*

Sentence one is the **capability** — which node gates this relic opens.
Sentence two is the **run effect** — what it pays while held. Eight words
cannot hold both, and C2 says the one that leaves is re-encoded rather than
dropped. Both change decisions: the capability decides which map branches are
reachable, the effect decides whether the relic is worth a pick over an item.

**D12 already ruled the file, and this is not that.** D12 ruled that the copy
splits out to a module `core/` does not import, so the rewrite moves no hash —
and that is settled and correct (neither `blurb` nor `playerDescription` is
read anywhere under `core/`; the split into `src/data/itemCopy.ts` is
mechanical and `test/content-hash.test.ts` will hold it). What D12 did not rule
is what the rewrite is allowed to lose.

**Options.**

1. **Re-encode the capability sentence as the capability glyph.** The family
   exists in section 2, M5.2 mounts it on the map node card with its band
   chevron, and the relic's first sentence is a prose restatement of exactly
   that glyph. The effect sentence then stands alone and tightens under eight
   (*"Cleared brush pays after every fight"*, 6). Ten relics, one pattern, no
   fact lost and the same glyph on the card and the node it unlocks.
2. **Give relics their own budget.** Split section 4's one card row into two and
   budget a relic at 16. Honest about the shape of the object, and it makes the
   reward screen's three cards three different sizes.
3. **Keep both sentences and put the second behind the inspect layer**, which
   R5 already owns and which M1.2 built. Costs nothing on the card face and
   costs a long press to read what a relic pays.

**Recommendation: 1, with 3 for anything that still will not fit.** Option 1
is the R2 trade and it makes the card and the map agree on one symbol, which is
the same argument D6 made for the priority chevron. Option 3 is the honest
overflow valve and needs no amendment, because R5 already says the inspect
layer is where the full explanation lives. Option 2 is last: it turns one
budget row into two to avoid an encoding the bible already has a family for.

**One correction the build should carry either way.** The item says to add a
`playerDescription` field to both tables. `relics.ts` has had one since the
relic card was built; `items.ts` has `blurb`, which `screens/reward.ts`
documents as having been that field since Stage 3. Nothing is added. The fields
are **moved**, per D12, and **shortened**, per this row.

---

## D35. The fixture's every-relic grant is the worst case for one surface and the blind spot for three

**Blocks M5.1's and M5.2's done-whens. Filed 2026-09-22, from the fixture audit
Tier 4's handoff asked for.**

Tier 4 closed with a standing instruction: *"Check the fixture before trusting a
number on any surface you are about to work on,"* and the note that *"other
surfaces may have the same problem, and nobody has looked."* This row is what
looking found. Three of Tier 5's six items are measured on a fixture that cannot
produce the condition the item exists for, and two of the three share one cause.

### The cause

`gallery-fixtures.ts`'s `furnish` grants the run **every relic**:

```
relics: Array.from(RELIC_IDS),
```

It is there for the party screen and the drawer, where holding everything is
genuinely the worst case — the relic list is longest, the backpack is at
capacity. It is the *best* case for every surface that asks what the run does
**not** have, and two of those are Tier 5's.

### What it costs, measured on `SMOKE24`

| Item | What the item needs | What the fixture produces |
|---|---|---|
| M5.1 | a relic reward card and a relic shop card | **28 relic cards on the map, 0 renderable** |
| M5.2 | the capability band chevron | **`known` only; the map can be `known`, `none`, `latent`** |

**M5.1.** The map generates 14 three-card offers holding a relic and 14 shop
shelves holding one, out of 175 offers and 23 shelves. `resolveOffer` and
`resolveStock` both collapse a relic the run already holds to its fallback —
correctly, and by design since 4.6b. The run holds all ten. So every one of the
28 renders as an item, a heal or a move, and **no relic card renders on any
fixture in the tree**. That is the card kind whose copy is 16 words at the
median against a budget of 8 (D34): the one card that most needs measuring is
the one card the instrument is built never to show.

**M5.2.** Six gated nodes in segment 0. Holding every relic, all six resolve
`known`. The same map held bare resolves `none` on four and `latent` on two.
M5.2's done-when is *"a test asserts the capability band chevron matches
`resolveCapability`"* — a three-valued attribute photographed in one value.

### The third one is unrelated and is its own defect

`wordiestEvent` is documented as *"the generated event with the most prose"* and
calls `generateEvent` with `'forest'` hardcoded. Forest holds **3 of the 24**
events, and its ceiling is the **lowest of the eight locales**:

| locale | heaviest event, words |
|---|---:|
| cave, marsh, badlands | 75 |
| summit | 72 |
| city | 71 |
| shore | 68 |
| ruins | 67 |
| **forest** | **66** |

So the fixture named for the worst case produces the best locale's worst case,
and M5.6's budget is checked nine words light. The event surface's census of 89
is an under-count.

### Options

1. **Each item fixes its own fixture, and says so in its report.** M5.1 adds a
   relic-bearing reward and shop fixture; M5.2 adds a bare-relic map; M5.6 widens
   `wordiestEvent` to every locale. Nothing existing changes, so no visual
   baseline moves except the event surface's, which moves because the number it
   was recording was wrong.
2. **Fix `furnish` centrally**, by splitting the relic grant onto its own axis
   beside the existing `fixture=loaded|walked`. Cleaner, and it re-records the
   baseline for the map, the drawer, the party screen and the result screen at
   once — four surfaces, to fix two.
3. **Leave it and assert directly**, the way M4.1 and M4.2 did when the loaded
   board could not produce a flag collision. Honest, and it leaves the census
   permanently blind to a whole card kind.

**Recommendation: 1.** It is the smallest change that makes each done-when
mean what it says, it keeps every existing baseline except the one that was
recording a wrong number, and it puts the fix in the item that needs it rather
than in a shared fixture four surfaces read. **Option 3 is the fallback for
M5.1 only** if a relic-bearing offer turns out to need a second played run:
then the relic card is asserted rather than censused and the report says so.

**And one thing for M7.2.** All three of these were found by hand, by one
session, because a handoff said to look. Nothing in the tree checks that a
fixture can produce the condition it is named for. The post-census is where a
standing check for that belongs, and it is recorded here rather than built now
because the check needs the vocabulary D31 asks for — `absent` against
`unrendered` — to say anything useful.


---

## D31, closed with the build

**M5.5, 2026-09-22.** Option 1 and option 3 together, as recommended.

`CONFIRM_SURFACES` is a third category in `gallery-surfaces.ts` beside the
decision and overlay lists — not an `OVERLAY_SURFACES` entry, because a band is
not built on `ui/overlay.ts` and has no `__sheet`, so the overlay gate's
`.${surface}__sheet` query would have found nothing and the assertion would
have passed by measuring an absence. Each fixture renders its screen and clicks
the real control, so the band measured is the one `ui/band.ts` builds.

**The two bands, Pocket, against ceilings of 6 and 6 (D22):** replace **4**,
forfeit **5**. The component reads 9 total, worst instance 5.

**Option 3 found a second hole while being built, and the goal was standing in
it.** `renderTable` decided a component existed by whether it had produced text
records — so a component that renders correctly and draws **zero words**
produces none, and the table's reward for an item hitting a budget of 0 would
have been a row claiming the component does not exist. Every Tier 5 budget but
two is 0. `presentOn` answers presence separately from words, and the table now
tells three states apart: a number (it rendered; zero is a number),
`unrendered` (in the tree, no fixture reaches it), `absent` (not built, via
`built: false` on a `COMPONENTS` entry — which no entry needs today, and which
exists so the next one can be honest rather than indistinguishable).

Record: [`../generation.md` §64](../generation.md).

---

## D36. Section 3 puts the effect line on inspect; section 4 and M5.1 put it on the card

**Blocks M5.1. Filed 2026-09-22, inside the item, before any card code was
written. It supersedes the premise D34 was ruled on — see the correction at the
end of D34.**

Section 3 opens: *"The single source of truth for how each attribute renders at
rest. Inspect shows everything in the last column."* Its three rows for the
objects M5.1 draws:

| Attribute | At rest | Default | On inspect |
|---|---|---|---|
| Held item | Item sprite in a fixed slot | Empty slot renders nothing | **Name, one effect line** |
| Berry | Berry sprite, same slot | Empty slot renders nothing | **Name, trigger condition** (the one place a sentence survives) |
| Relic | Relic sprite in the relic row | None | **Name, capability it satisfies** |

So at rest each of the three is a **sprite and nothing else**, and the effect
line is an inspect fact.

Section 4 says the opposite in its *words that survive* column: *"Item, berry or
relic reward card | 8 | One effect line."* M5.1 follows section 4 — *"sprite in
the fixed slot, one effect line under eight words … no name text at rest, name
on inspect"* — which moves the **name** to inspect and keeps the **line** on the
face. Section 3 moves both.

**CLAUDE.md decides the prompt half and not the bible half.** *"Where a prompt
and the bible disagree on how an attribute is shown, the bible wins… the prompt
is wrong until the bible is amended."* So M5.1 loses to section 3 outright. What
is left is an internal disagreement between two sections of the bible, and
section 3 carries the words *single source of truth for how each attribute
renders at rest* while section 4 carries a budget. D1 has already ruled how that
reads when they diverge: a budget is a ceiling, and *"where a budget is larger
than the words that survive can reach, the difference is headroom, not a
quota."* Under section 3 the card reaches **0**, and the 8 is headroom.

**Three things follow, and the third is why this is filed rather than built
around.**

1. **The eight-word rewrite is not needed for the card face.** D34 exists
   because eight words cannot hold a relic's two sentences. On inspect there is
   no budget: R5 says the inspect layer carries *"the full explanation"*, and
   `ui/tooltips.ts:830` already renders `playerDescription` there today. The
   copy still moves out of the hashed tables — that is D12, and the hash move
   the lead designer ruled on 2026-09-22 — but it moves to be *read from a
   different file*, not to be cut to eight words.
2. **The card has no sprite today.** `renderRewardCard` draws a kind label, a
   name, a detail line and a note, and calls nothing that draws an item.
   `itemIcon` in `ui/slots.ts` exists and M3.1 and M3.2 already mount it in a
   fixed slot on the battle panel and the party row, citing this same section 3
   row. So the work M5.1 actually has is **mounting the component that exists**,
   and that is what makes a zero-word face possible rather than an empty one.
3. **Nothing in the tree is measuring the difference.** The reward card
   censuses 8 against a budget of 8 and reads as at budget (D30). Under section
   3 it is eight words over.

**Options.**

1. **Section 3 wins as written. The card face is the sprite; name, effect line
   and a relic's capability are inspect facts.** Section 4's row is annotated to
   say its 8 is headroom under D1 and that the surviving words are none. M5.1
   becomes: mount `itemIcon`, move the copy per D12, route name and line to the
   inspect layer, add the price to the shop card. **No copy is rewritten to
   eight words at all**, and D34 is closed as moot rather than implemented.
2. **Amend section 3 to match section 4**, putting one effect line at rest on
   the three rows. Then D34's ruling stands and the rewrite happens. This is an
   amendment to the table the bible calls its single source of truth, to make it
   agree with a budget column, and section 10.1 wants a disconfirmer behind a
   change of that size.
3. **Split the difference: sprite plus line at rest, name on inspect**, which is
   what M5.1 asked for, and amend section 3's three rows to say so. Same
   amendment as option 2, narrower.

**Recommendation: 1.** It is the only option that amends nothing, it takes the
card to 0 rather than to 8, it reuses a component two milestones have already
mounted against this very row, and it deletes an eight-word rewrite of
forty-eight strings rather than performing one. Its one real cost is that a
player reads an item's effect only on a long press — which is what R5 is for,
and what section 3 has said since Rev 1.

**What it does not change.** The copy still leaves `data/items.ts` and
`data/relics.ts` per D12, and the hash still moves once for this tier per the
ruling of 2026-09-22 — the inspect layer needs the strings from a file `core/`
does not import exactly as the card face would have.

---

## D34, corrected 2026-09-22

**Ruled 2026-09-22: option 1, the capability rides the glyph and the inspect
layer takes the overflow. The ruling was made on a premise that is false, and
the correction is recorded here rather than quietly absorbed.**

**What was wrong.** The option said *"the capability glyph is already a section
2 family and M5.2 mounts it on the map node card with its band chevron."* It is
not a family. Section 2 lists nine — type, category, band, PP, accuracy,
priority, effectiveness, status, stat — and capability is not among them;
`data/glyphFamilies.ts` carries the same nine and its header says a tenth is an
amendment. Section 3 does name a *"capability glyph plus band chevron"* on its
map-node row, and `ui/screens/run-map.ts` renders that today — but as
`capabilityChip("Requires Surf")`, a chip carrying a **word**. Re-encoding a
relic's capability sentence onto it would have *added* a word to the card, not
removed one, and taking it to a wordless glyph would have needed the tenth
family section 10.1 reserves for an observed disconfirmer.

**Why it no longer matters, and what replaces it.** D36, filed the same day
before any card code was written, found that section 3 — *"the single source of
truth for how each attribute renders at rest"* — puts the **name, the effect
line and a relic's capability all on inspect**, and leaves the card face as a
sprite. If D36 is ruled option 1 then nothing on the face has eight words to
fit into, no copy is rewritten, and **this row is moot rather than
implemented**: the relic's capability reaches the player through the inspect
layer, which is where section 3 has put it since Rev 1 and where
`ui/tooltips.ts:830` already renders it.

**What survives either way.** The measurement under this row stands — 8 of 10
relic descriptions over eight words, median 16, each two sentences doing two
jobs — and it is what makes D36 matter rather than a formality. So does the
correction at the foot of the row: `items.ts` has `blurb`, not
`playerDescription`, and nothing is added to either table; the fields are
**moved** per D12, at the one hash move ruled for this tier.

**If D36 is ruled option 2 or 3**, this row wakes up and its option 1 is no
longer available on the premise it was written on. The live choices would then
be its option 2 (relics get their own budget) or option 3 (both sentences kept,
the second behind inspect) — and option 3 is option 1's outcome by another
route, which is the honest thing to notice about it.


---

## D14, closed with the build

**2026-09-22, option 2, taken with M5.1's half of the same trade. Open since
Tier 0; the longest-running row in the register.**

Its recommendation was *"split, timed to whenever something else moves the hash
anyway, or taken on its own as a Tier 5 item beside M5.6."* Both halves of that
arrived at once: M5.1's item and relic copy had to leave two hashed tables for
D12's reason, M5.6's event copy for D14's, and the lead designer ruled one
version event rather than two.

`data/events.ts` keeps `id`, `locale`, `requires` and `toll`. `EVENT_HOOKS`,
`EVENT_LABELS` and `EVENT_HINTS` are in `data/eventCopy.ts`, which was already
excluded. **`EventInstance` stopped carrying `prompt` and `EventOption` stopped
carrying `label` and `hint`** — without that the copy file would be imported by
`core/` and back inside the hash by the same mechanical rule, so the refactor is
the price of the exclusion rather than a tidy-up beside it.

`contentHash` **`d4e080` → `0b2c2c`**, once, with two proofs that no generated
output moved with it: the re-recorded baseline changed 26 lines, all of them a
hash string, and the re-minted simulator fixture changed 2, both the hash.

**The two sentences that opened this row are still unfixed, deliberately.** They
are `KNOWN_UNFIXED` in `test/event-copy.test.ts`, asserted to be exactly those
two so a third fails the test. Fixing them is M5.6's, with the rest of the event
copy, and it is free now — which was the entire point of the row.

Record: [`../generation.md` §65](../generation.md).


---

## D29, D34, D35 and D36, closed with M5.1's build

**2026-09-22.** One item settled four rows, and only one of them by doing what
it said.

**D36, option 1 as recommended.** Section 3 wins: the item and berry face is
the sprite, and the name, the effect line and a relic's capability are inspect
facts. Section 4's two card rows are annotated to **none** with their 8 kept as
the headroom D1 says a budget is. **Every item, berry and relic card now reads
0**; the reward card's worst instance stays at 8 because that instance is a
*heal* card, a kind M5.1 does not name and section 4 has no row for. Bible Rev
8.

**D29, amended and unified.** Section 5 gains the reward card, the map node
card and the locale card, and the party row gains the capture card as a call
site. The unification was the half with teeth: `screens/shop.ts` lost **103
lines** the moment the shelf mounted `renderRewardCard`, which is the cleanest
available proof that they were one component written twice. The census lost its
`shop stock card` row with them.

**D34, moot rather than implemented, and its premise was false.** The capability
glyph is not a section 2 family; the correction is at the foot of the row. With
the effect line on inspect there is no eight-word face to fit into, so no copy
was rewritten. The measurement under the row still stands and is what made D36
worth filing.

**D35, half built.** `result-relic` and `shop-relic` stage a map-generated offer
and shelf that really hold a relic against a state holding none — **the first
relic card ever rendered on any fixture in this tree.** M5.2's bare-capability
map and M5.6's widened `wordiestEvent` are still open under this row.

**One deviation from section 3, recorded rather than absorbed.** It asks for a
*"relic sprite in the relic row"* and there is no relic sprite in the tree; a
glyph would be a tenth family. The relic's name is the encoding, it is a proper
noun, and the card still reads 0.

Record: [`../generation.md` §66](../generation.md).

---

## D37. M5.2 needs two glyphs: section 2 carries neither, and section 3 already promised one of them

**Blocks M5.2. Filed 2026-09-22, before any map code was written.**

M5.2: *"Node type glyph, tier pips, reward-tier pips, capability glyph with band
chevron where present. Zero words."* Measured today: the worst map node card
reads **12 words against a budget of 0**, the largest single gap in Tier 5.

Section 3 specifies two of the four and neither of the others:

| M5.2 asks for | Section 3 | Section 2's nine families | In the tree |
|---|---|---|---|
| Tier pips, reward-tier pips | **`Tier (map node) | Tier pips, reward-tier pips | None | Tier definition`** | n/a — pips, not a family | a text chip, `NORMAL` / `HARD` |
| Capability glyph plus band chevron | **`Capability requirement (map node) | Capability glyph plus band chevron`** | **not among the nine** | `capabilityChip('Requires Cut')`, a text chip |
| Node type glyph | **no row** | **not among the nine** | `node__label`, the kind as a word |
| (rarity, which the tree also draws) | no row | no | a text chip |

### The part that is a disagreement inside the bible

**Section 3 names a "capability glyph". Section 2 does not carry one.** Section
2 lists nine families — type, category, band, PP, accuracy, priority,
effectiveness, status, stat — and says *"adding a tenth is an amendment"*;
`data/glyphFamilies.ts` carries the same nine and its header repeats it.

So section 3 has promised, since Rev 1, an encoding that section 2's roster
forbids. Nothing caught it because nothing had to draw it: the map has always
rendered a *word chip*, and M5.2 is the first item that has to make section 3
true. **This is not a new request for a tenth family. It is section 2 being out
of date with section 3**, which is the same shape as every amendment this
register has produced — a table corrected to agree with a rule, rather than a
rule moved.

### The part that is genuinely new, and D28 already ruled it the other way

**The node type glyph is in neither section, and four days ago the same
attribute was ruled to stay a word.** D28 budgeted the battle screen header at
4 for three facts, the first of which is *"which node this is"*, on the
reasoning that *"the nine families are attributes of a Pokemon or a move"*. A
node kind is neither, exactly as an AI tier is neither.

M5.2's *"zero words"* and D28's *"budget it at 4"* are therefore **the same
attribute encoded two ways on two surfaces**, which R1 exists to forbid:
*"every attribute has one fixed slot on every surface where it appears."*

### Options

1. **Tenth family only: `capability`.** Section 2 gains the family section 3
   already specified, `glyphFamilies.ts` gains the tenth row, R7's per-family
   exposure test grows a case, and the band chevron is drawn from the existing
   `none` / `latent` / `known` values. **The node kind stays a word**, matching
   D28 on the same attribute, and section 4 gains a *map node card* row with an
   honest number rather than the unreachable 0 M5.2 assumes. Rarity goes to
   inspect, where the tier row already sends the tier definition.
2. **Tenth and eleventh: `capability` and `node kind`.** M5.2 as written, zero
   words on the card — and D28 is reopened, because the battle header's first
   budgeted word becomes a glyph too. Consistent with R1, and it spends the
   "nine families is the right size" hypothesis that section 9 is still betting
   on.
3. **Neither. Correct section 3 instead.** Its capability row is rewritten to
   say *chip*, which is what has shipped for five tiers, and the map node card
   is budgeted in words. Cheapest, and it resolves the disagreement by
   demoting the more specific of the two sections to match the tree.

**Recommendation: 1.** It makes section 2 agree with section 3 rather than
adding a claim neither carries; it keeps the node kind consistent with a ruling
four days old on the same attribute; and it replaces an unreachable 0 with a
number the surface can actually hit. Option 2 is the one to take if the node
kind's *word* on the battle header is judged the real defect — but that is a
reversal of D28, not an extension of it, and it should be ruled as one.

**What is unblocked either way**: the tier chip becoming tier pips, the
reward-tier pips, and the two tier sentences from `data/tierInfo.ts` moving to
inspect, which is where section 3's Tier row has always put the tier
definition. That is most of the 12 words, and none of it waits on this row.


---

## D37, closed with the build

**2026-09-22, option 1 as recommended. M5.2.**

Section 2 gains a **tenth family, `capability`** — eight marks, one per
capability, plus a chevron pair for the band. Not a tenth *claim*: section 3
had specified this exact encoding since Rev 1 and the roster never carried it,
and the disagreement survived nine revisions because nothing had to draw it.
**That is the line between this and D5**, which was refused: D5 asked section 2
for something no other section had promised.

**The node kind stayed a word**, and section 4's map node card row went from 0
to **3** — measured first, then written. D28 had ruled the same attribute a
word on the battle header one day earlier, and encoding it one way there and
another here is what R1 forbids. The alternative, a tenth *and eleventh*
family, would have reopened D28 rather than extended it.

Worst node card **12 → 3**; the `map` surface 57 → 28 in Pocket less shell. The
family's worst glyph pair separates at **0.164** against a floor of 0.12.

**D35's map half closed with it, without a fixture.** The chevron carries no
words now, so a bare-capability map would census identically to the one that
exists; what the done-when asks is that the mark tracks `resolveCapability`,
and `test/map-node-card.test.ts` asserts that against the function's own output.
**D35's last open half is M5.6's `wordiestEvent`**, which still searches
`forest` alone.

Record: [`../generation.md` §67](../generation.md).


---

## D32, closed with the build

**M5.3, 2026-09-22. Option 1 as recommended: a Locale screen row at 4.**

Measured after the cut: **3**. The locale card reached **0**, and the pre-gym
screen **3** against its own 4.

**It is the fourth surface found carrying words against no row at all** — after
the battle header (D28), the map node card (D37) and the two reward kinds M5.1
named — and the pattern is worth stating once rather than four times: a budget
table written per *component* leaves every screen's own chrome unbudgeted, and
nothing measures what nothing budgets. M7.2 inherits whether the rest need rows.

Two things this item found that the row did not anticipate. The locale strip
was still drawing `archetypeChip`, which section 3 calls *"a derived label that
can lie under randomization"* and puts nowhere — 12 words that survived D18
because that row's first clause is conditional on stat bars being present. And
`Party screen (items)` was the **last route** to item assignment before a gym,
not a duplicate of the shell's drawer button; cutting it would have been a
functional regression. Both are in [`../generation.md` §68](../generation.md).

---

## D38. The capture card cannot mount the party row and stay above the fold

**Blocks M5.4's second clause. Filed 2026-09-22, after building it and
measuring.**

M5.4: *"Capture card mounts the party row."* D29 added capture to section 5's
party row call sites on 2026-09-22, and section 4 has said since Rev 1 that the
capture card *"follows the recipient card"* — which mounts it. So three
documents agree, and the build was straightforward.

**`test/visual-v4.test.ts` refused it.** That gate: *"keeps the capture offer,
its decision buttons included, above the fold at 390x844."* Measured with the
row mounted:

| Density | Offered card | Decision buttons land at | Gate |
|---|---:|---:|---:|
| Pocket | 63px | **661** | 844 |
| Detailed (the gallery's default, and the app's) | **655px** | **2253** | 844 |

The cause is not the capture screen. **The party row draws four move *cards*
since D21a** — re-ruled 2026-09-21, cards and not chips — plus the stat block,
and in Detailed all of it is on screen. In Pocket the same body is one tap
behind the head of the card, which is why that column passes.

**This is not hypothetical.** Detailed is the app's default until M6.3 flips it
to Pocket, and M6.3 is two tiers away.

### Why it is filed rather than worked around

Every fix reaches something ruled:

1. **Collapse the offered card's body by default on this surface.** The row
   already has the expander and the player still reaches everything. But the
   collapsed-or-not default is set by *density* today, per R6's density ruling
   — *"density modes may change … whether a secondary fact sits behind a tap"*
   — and this would make it vary by **surface** instead. That is either a new
   kind of rule or an R6 amendment, and section 10.3 makes it a stop-and-file.
2. **Relax the fold gate for this screen.** It is the only Detailed
   above-the-fold gate in the suite, and it exists because a decision the
   player cannot see is not offered. Relaxing it to accommodate a component is
   the tail wagging the dog.
3. **Leave the card hand-built**, which is what shipped, and accept that
   section 5's canon says a thing the tree does not do — the exact condition
   D29 was filed to end.
4. **Wait for M6.3.** Pocket passes at 661. If Pocket is the default, the gate
   is measured where the bible says the face is, and the conflict dissolves
   without a rule moving. It also means M5.4's second clause is not done for
   two tiers, and section 5 carries a call site that is a promise rather than a
   fact until then.

**Recommendation: 1, with 4 as the honest alternative.** A card being asked to
*be judged* is a different job from a card in a list of six, and "the body is
behind a tap on the surface where the card is the subject" is a defensible
rule — but it is a rule, and it belongs in the bible rather than in a
stylesheet. If that is too much for one clause of one item, 4 costs nothing
except the canon being aspirational about one call site, which this row records
so it is not mistaken for a fact.

**What shipped meanwhile.** The hand-built card stays, with a comment at
`renderOffered` naming this row. **M5.4's other two clauses are built**: the
coverage change is two rows of signs and chips, and the result screen's own
words went 32 → 2 against a budget of 6.

---

## D39. `Costs` is a field label at rest, and no family encodes a price

**Filed 2026-09-22, inside M5.6. Blocks nothing.**

R2: *"Numbers stay. Labels go. Sentences go."* and it forbids field labels at
rest by name — `Type`, `BP`, `PP`, `BAND`, `HP`, `Acc`. The Toll option's
price chip reads `Costs 20% HP, party`, and `Costs` is a field label by that
definition: the word names what the number is, and the number is the fact.

It is four or five words on one of four buttons, and M5.6 kept it rather than
cut it, for a reason that is C2 rather than convenience. **What the chip
carries is not the price, it is the *direction*.** A player who reads
`20% HP, party` beside a reward meter has been told a quantity and not told
whether it is charged or paid, and which of those it is changes the decision.
Section 2 has no family for a price, so R2 has nothing to trade the word for —
the same position the ability is in, which section 4 resolves by budgeting it
by name.

**There is a precedent for the wordless form and it is in this document.** The
capture card's coverage rows carry a plus row and a minus row, *"signs only"*,
ruled on D5 on 2026-09-19 as permanent marks rather than an exposure label. A
`−` on the price is the same move: the sign says taken, the number says how
much, and `Costs` goes.

**Two things stop M5.6 from taking it.** The chip has no `data-tip`, so there
is no inspect answer for a player who does not read the sign — and R5 is the
reason every other mark on that screen has one. And a sign on a price is a new
encoding rather than a mounted one, where the other three changes M5.6 made
were section 3's own, already specified and already built.

**Options.**

1. **Leave it, and budget it by name**, as section 4 does for the ability. The
   row already carries it at 5, so this is what shipped and the cost is one
   label surviving R2 on one surface.
2. **`−` prefix, `Costs` deleted, and a `toll:` inspect tip added.** Saves one
   word, follows D5's precedent, and needs a section 3 row for the price
   attribute plus a section 9 disconfirmer for whether the sign reads.
3. **A price glyph**, which is an eleventh family and therefore section 10.

**Recommendation: 2, timed with M6.1.** The exposure-label item is already
opening `data/glyphLabels.ts` and walking every mark on every surface, which is
when the question *does a player know what this sign means the first time* is
cheapest to answer. Not urgent: nothing is over budget because of it, and
option 1 is what is shipped and is defensible on its own.

---

## Rulings, 2026-09-23, opening Tier 6

Five rows filed against Tier 6 before any of it was built
([`../handoff/4.10-tier-6-prep.md`](../handoff/4.10-tier-6-prep.md) carries the
measurements). **All five were ruled as recommended.** The bible goes to Rev 12.

| Row | Ruling | Where it lands |
|---|---|---|
| D40 | **Option 3.** A new item, **M6.0**, mounts the move card on starter select as its own PR before M6.1. The screen gains a section 4 row, and section 7's "every glyph family present" is corrected to what the screen can carry. | Bible sections 4, 5 and 7. New item M6.0, recorded as a deviation in `../generation.md` §72 |
| D41 | **Option 1 plus option 3's test.** Band pips, status lettering and the effectiveness edge are drawn through `glyphNode`. A browser test walks every surface and asserts every painted family reports itself. | Bible section 5. Milestone M6.1 scope |
| D42 | **Option 1.** R2 and R3 each permit R7's label on exposures 1 and 3. | Bible section 1 |
| D43 | **Option 1.** An exposure is a painted glyph. The order is M6.0, M6.2, M6.3, M6.1; D10's M6.2-before-M6.3 stands. | Bible section 7. `../generation.md` §72 |
| D44 | **Option 1.** The census pins every family to exhausted and adds a `first-run` column that gates nothing. Lands as one instrument commit before M6.1. | Bible section 4. `scripts/visual/census.ts` |

---

## D40. The classroom does not carry the families section 7 says it does

**Filed 2026-09-23, in the Tier 6 prep. Blocks M6.1's done-when.**

Section 7: *"Starter select is the classroom: it has no clock, three full
cards, and every glyph family present. On a first run every glyph on that
screen carries its label. A player who reads three starter cards has seen
category, type, band, PP and the six stats with words once."* M6.1's done-when
asks the visual bot to record *"the starter screen with all labels on a fresh
store"*.

**Measured on `f0fb37e`, Pocket, 390x844, eight seeds `S49B-1` to `-8`: the
starter screen paints two families, `stat` and `type`, on every seed.** No
category glyph, no band pip, no PP glyph, no accuracy or priority mark. Of the
five families section 7 names, three are not on the screen.

**The reason is section 5's closing sentence.** `screens/starter-select.ts`
lines 98 to 113 build each move as a name, a type chip and two text spans —
`${move.basePower} BP` or `Status`, and `${move.maxPp} PP` — rather than
mounting the move card. That is *"a screen that draws an attribute itself"*,
and the census has been counting it since M0.1: **34 of starter select's 51
Pocket words are `BP`, `PP`, `Status` and `HP`**, every one a field label R2
forbids by name. No tier ever owned the screen. Section 4 has **no starter
row**, so no done-when on the list could have failed on it.

Section 7's first sentence is also false on its own terms, independent of the
move rows: effectiveness, status and capability cannot appear on a screen that
has no opponent, no battle and no map, and the sentence's own last line lists
five families, not ten.

**Options.**

1. **Mount the move card on starter select, and give the screen a section 4
   row.** `moveFacts` is the call site the canon counts, and it already serves
   six card surfaces; a seventh surface is not a third call site. The row reads
   0 plus the ability name, like the party row. Section 7's first sentence is
   corrected to name the five families the screen can carry. Costs one fold
   measurement: three full cards with four move cards each at 390 wide.
2. **Amend section 7 to what the screen shows**: type and stat only, and the
   other three families are labelled on their first natural exposure elsewhere.
   Leaves 34 field labels at rest on the first screen of every run.
3. **A new item, M6.0**, that does option 1 before M6.1 opens.

**Recommendation: 3**, which is option 1 as its own PR. It is a surface
rebuild with its own fold risk and its own census delta, and M6.1 is already an
item that touches every glyph on every screen; the two cannot be reverted
independently if they land together. If D38's fold finding repeats here — the
capture card could not mount the party row and stay above the fold — the
ruling needs to say which of the three cards' move lists may fold.

---

## D41. Three of ten families never pass through the glyph

**Filed 2026-09-23, in the Tier 6 prep. Blocks M6.1.**

Section 5's canon row: *"Exposure label | The first-encounter label for a glyph
family | Rendered by the glyph, driven by the exposure store."* `ui/theme/glyph.ts`
writes `data-family` on every node it makes so M6.1 has something to key from.

**Three families are drawn without it**, so a label rendered by the glyph never
fires for them, and R7's forbid — *"shipping a glyph family that never gets a
label"* — is broken by construction:

| Family | Drawn by | Through `glyphNode` |
|---|---|---|
| Band | `bandChip`, `ui/chip.ts:184`, as bare `.band__pip` spans | no. The sheet carries `band-pip-on` and nothing mounts it |
| Status | `statusChip`, `ui/chip.ts:327`, as lettering | no |
| Effectiveness | the move button's coloured edge | no. The sheet's roster row is an entry with no mark |

A test in R7's words — *"each family's label renders on exposure 1 and 3 and
not on exposure 4"* — written against the exposure store would pass for all ten
and ship three that never render. Tier 4's second finding again, one layer up:
a unit test on the store cannot see a family the screens never report.

**Options.**

1. **Route all three through `glyphNode`.** Band pips mount the sheet's own
   pip glyphs; status chips take a `data-family` from a lettering glyph, which
   `glyph.ts` already supports (`art.kind === 'text'`); the effectiveness edge
   gets a zero-size family marker on the button. The canon row stands as written.
2. **Amend the canon row** to *"rendered beside the family's owning component"*,
   and have `bandChip`, `statusChip` and the move button each mount the label.
   Three mount sites instead of one.
3. Both, with a test that walks every gallery surface and asserts every family
   painted there reports itself.

**Recommendation: 1, plus option 3's test.** The test is the part that closes
the class: it is the same walk the prep used to find this (`[data-family]`,
painted, per surface), and it would have caught D37's capability glyph too.

---

## D42. R2 and R3 outrank R7, and both forbid what R7 requires

**Filed 2026-09-23, in the Tier 6 prep. Blocks M6.1.**

Section 1: *"Rules are numbered by priority. When two conflict, the lower
number wins."*

R3 forbids *"type glyph plus type name; category glyph plus category word"* on
one surface at rest. R2 forbids *"type names and category words at rest"*. R7
requires *"a small label renders beside it for that screen"* on the first and
third exposure — which is, for the type and category families, exactly a glyph
plus its name at rest. Read by section 1's own tie-break, R7 loses to both, and
M6.1 is an item whose whole output is forbidden.

Nobody reads it that way, and section 7 plainly intends the labels. But the
rule text does not say so, and this document's section 10.4 exists because a
prompt overriding the bible by intention is the failure it guards against. The
census will also count every label as a word at rest (D44), and with no
exception written, every surface that shows one goes over budget.

**Options.**

1. **Add R7 to R3's Permits line and R2's**, in the same words: *"R7's
   exposure label, on exposures 1 and 3 only."* One line each; section 4 gains a
   sentence saying budgets bind the steady state (D44).
2. **Renumber R7 above R2.** Moves every rule's priority and every register
   row that cites a rule number; out of proportion.

**Recommendation: 1.**

---

## D43. What an exposure is while two modes paint words, and the guard puts the classroom in one of them

**Filed 2026-09-23, in the Tier 6 prep. Blocks M6.1 and orders M6.2.**

**Measured on `f0fb37e`: Detailed paints almost no glyph at all.** Walking every
gallery surface for painted `[data-family]` nodes, Pocket against Detailed:

| Surface | Pocket | Detailed |
|---|---|---|
| starter | stat 18, type 17 | **none** |
| battle | accuracy 3, category 4, pp 4, stat 3, type 17 | accuracy 3, stat 1 |
| map | capability 9, type 13 | capability 9 |
| result | category 1, pp 1, type 1 | **none** |
| party, pre-gym | type 13 | accuracy 8 |

D16 kept the labelled face in Detailed and Simple until M6.4, and the labelled
face is the word *instead of* the glyph. So two questions the item text does
not answer:

**(a) Does a screen shown in Detailed count as an exposure?** If exposure means
"the family's glyph was painted", a Detailed player's counters never move, and
they meet every label on the day they switch to Pocket — which is when they
first see the glyphs, and arguably right. If it means "the family's fact was on
the screen", they burn both labelled exposures reading words, and meet bare
glyphs in Pocket with no label ever.

**(b) The classroom is always in Detailed on run one.** `ui/density-guard.ts`
forces Detailed on any screen with unseen coach marks, and starter select has
five. On a first launch, the exact moment section 7 calls the classroom, the
starter screen paints **no glyph of any family**. Under reading (a)'s first
answer, run one's starter screen shows no label at all; under its second, it
spends exposure 1 of type and stat on words. Either way M6.1's done-when —
*"the starter screen with all labels on a fresh store"* — cannot be recorded
while the guard stands.

**M6.2 is cheaper than its item text says**, which is what makes the reorder
cheap. Measured on the same tree, every surface that carries marks, Pocket with
the guard off: **all 29 anchors that are on the page in Detailed are painted in
Pocket.** The forced-Detailed rule is protecting nothing any longer — Tiers 2 to
5 took every fact that used to fold behind a tap and put it on the compact face.
What M6.2 has left is copy (see the prep).

**Options.**

1. **Count painted glyphs only; take M6.2 before M6.1.** The guard is deleted
   first, the classroom is in Pocket on run one, and a label is shown the first
   time its glyph is. D10's order (M6.2 before M6.3) is kept; M6.1 moves after
   both, so the order becomes M6.2, M6.3, M6.1, M6.4.
2. **Count painted glyphs only; keep the order**, and have M6.1 carve an
   exception into the guard for the starter screen. A rule M6.2 then deletes.
3. **Count by fact, in any mode.** Simplest counter, and it strands every
   Detailed and Simple player without labels if M6.4 retires their mode.

**Recommendation: 1.** It is D10's reasoning applied once more: land each
change on the face it will be read against.

---

## D44. The census has no exposure state

**Filed 2026-09-23, in the Tier 6 prep. Instrument row; blocks M6.1's census and
M7.2.**

The gallery opens every surface in a fresh browser context, so the settings
store is empty and every exposure count is zero. Once M6.1 renders labels,
**every surface in the census counts them as words at rest** on every run of
the script, and every decision surface that shows a glyph goes over its
budget by one word per family on it.

Neither reading is wrong, and both are needed: the first-run face is what a new
player reads, and the steady-state face is what section 4's budgets were
written against. M6.1's own done-when needs the first; M7.2 needs the second.

**Options.**

1. **The census pins exposure to exhausted (every family at 4) by default, and
   gains a `first-run` column** at a fresh store. Budgets bind the steady
   state; the first-run column is recorded, never gated. D42's section 4
   sentence says so.
2. Budget the labels: each surface's row rises by the families it shows.
   Rewrites twenty rows for a face a player sees twice.

**Recommendation: 1.** Like D30, it applies a rule that exists — section 4
budgets what a surface shows *at rest*, and R7 says the labelled face is
transient — rather than asking for a new one. It lands as one instrument
commit before M6.1, the way D30 landed before M5.1.
