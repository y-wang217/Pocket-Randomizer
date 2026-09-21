# Bible discrepancies: the 4.10 presentation milestones

Rev 2, Sept 21, 2026. Opened against
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
| D14 | M0.3 (closed around it) | Two event sentences break section 8, and `data/events.ts` is inside `contentHash` | **open** |
| D15 | M1.2 (closed around it), then M2.1 | The `Explain` expander is a second explanation mechanism, and no item removes it | **2026-09-20** |
| D16 | M2.1 | Pocket reaches its word count by hiding four facts, which is C2, and M2.1 does not say which modes its zero binds | **2026-09-20** |
| D17 | M2.1 done-when, then M7.2 | The census cannot read 0 on a move face: the strip's icons and a split number are counted as words, and the status readout is a sentence the item keeps | **2026-09-20** |
| D18 | M3.1, then M3.2 | The archetype chip has no row in the canon, and deleting it takes the opponent's build off the battle screen | **open** |
| D19 | nothing; timed with M3.2 | The ability and the volatile chips have no row anywhere in the bible | **open** |

## Rulings, 2026-09-19

Eleven of thirteen closed 2026-09-19; D2 and D8 closed 2026-09-20. D15, D16 and
D17 closed 2026-09-20 across Tier 2. **Sixteen of nineteen rows are ruled.**
D14 is timed with M5.6 and D19 with M3.2, and neither blocks anything; **D18,
opened 2026-09-21, blocks M3.1** and is the only row in anybody's way. Each
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

## Rulings pending, 2026-09-21, opening Tier 3

Two rows opened reading into M3.1. **D18 blocks it**; D19 blocks nothing and is
timed with M3.2, which meets the same gap on the party row.

Both come from one measurement. The panel censuses **20 words in Pocket**, ten
per surface across `battle` and `log-sheet`, and every one of them is in five
places:

| Element | Words, per surface | Section 5 lists it |
|---|---|---|
| `.panel__roster-label` — `3/4 left` | 1 (`left`) | no |
| `.panel__name` — `Opposing Golem` | 1 (`Opposing`) | name, yes |
| `.panel__level` — `Lv100` | 1 | level, yes |
| `.badge--archetype` — `Phys. Attacker` | 2, both panels | **no** |
| `.badge--stages` — `STAGES 2` | 1, both panels | stat stage ladder, yes |

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
