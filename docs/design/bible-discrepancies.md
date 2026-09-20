# Bible discrepancies: the 4.10 presentation milestones

Rev 1, Sept 20, 2026. Opened against
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
| D9 | M2.2 | The tree ships two move-button faces; R6 forbids two faces | **2026-09-19** |
| D10 | M6.2, M6.3 | The items are ordered against section 7 | **2026-09-19** |
| D11 | M6.4 | "One validation cycle" and "two playtest rounds" are not defined as equal | **2026-09-19** |
| D12 | M4.1, M5.1, M6.1 | Three items move `contentHash`, which the standing gates forbid | **2026-09-19** |
| D13 | process | "One item, one PR" against the single 4.10 pull request | **2026-09-19** |
| D14 | M0.3 (closed around it) | Two event sentences break section 8, and `data/events.ts` is inside `contentHash` | **open** |
| D15 | M1.2 (closed around it) | The `Explain` expander is a second explanation mechanism, and no item removes it | **open** |

## Rulings, 2026-09-19

Eleven of thirteen closed 2026-09-19; **D2 and D8 closed 2026-09-20, so all
thirteen are ruled and no item is blocked.** Each ruling is restated under its
own row below; the
bible amendments they produced are Rev 2, marked inline in
[`design-bible.md`](design-bible.md) with the row that produced them.

| Row | Ruling | Where it landed |
|---|---|---|
| D1 | Budgets are ceilings; the four milestone equalities become "at or under". Counting rule stands. | Bible section 4, new paragraph. Milestone M3.3, M5.3, M5.4, M5.5 done-when |
| D3 | Fix all six. Rename `statusInfo.ts:88` to "Toxic" so the lint needs no allowlist. Widen the word list with risky, safe, worth, drop its tutorial scope, point it at `src/data/*Info.ts`. **Building it found three more: the count is nine.** | Bible section 8. Milestone M0.3 |
| D4 | The acceptance test enumerates all 17 inspect rows of section 3, archetype excepted. | Milestone M1.2 done-when |
| D5 | No tenth family. The plus and minus signs are permanent from day one. Section 9 loses "after the label fades"; the fallback is "add the two words". | Bible sections 3 and 9. Milestone M5.4 loses its label line |
| D6 | Add the chevron to the Pokemon panel. | Bible section 5 |
| D7 | Add a flag strip row, 1 word per hit. Battle screen budget excludes it. | Bible section 4 |
| D9 | Build the compact 2x2 first, re-measure column mode against it in the same PR, rule with the number. Both branches in the done-when. | Milestone M2.2 |
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
