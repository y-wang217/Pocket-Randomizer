# GYMRUN Presentation Milestones

Repo home: `docs/design/milestones.md`. Companion to `design-bible.md`. Rev 1, Sept 19, 2026.

One item per Claude Code session. Table one, ship it, check it off, table the next. Tiers are ordered; items inside a tier are ordered. Do not start a tier until the one above is closed, because each tier's items assume the components the tier above built.

Every item ships under the standing gates unless its row says otherwise: seeded output byte identical, no version axis moved, `contentHash` unmoved, heights and `decisionTop` unmoved or recorded, SMOKE24 green, all three density modes exercised by the visual bot. "Done when" is the acceptance test. "Kills it" is the observation that sends the item back to the bible for amendment instead of into the tree.

Current state this list is written against: Sep 18 tree after PRs #40 to #52 (band recut to five bands, TMs as inventory, animation patch, density modes, AI tiers, contentHash, tutorial). Items already shipped are listed as **verify**, not build.

---

## Tier 0: Measure before touching anything

Every count in the research brief is an estimate read off the spec. Nothing below Tier 0 starts until the real numbers exist.

**M0.1 Text census.**
Build a script that counts words at rest per surface, in all three density modes, excluding proper nouns and bare numbers, and commits `docs/design/text-census.md` with the table. Add it to `scripts/check.mjs` as a non-blocking leg that prints the delta.
Done when: the census table exists for all 14 surfaces (12 router screens plus drawer and log sheet) and reruns from one command.
Kills it: nothing. Measurement cannot fail the bible.

**M0.2 Glyph and mechanism inventory.**
Report only. List every glyph currently rendered, which family it belongs to, every place an attribute renders in two channels on one surface (R3), and every explanation mechanism in the tree (type wheel, band tooltip, describeMove card, icon strip, statusInfo, categoryInfo, coach marks, moveFacts vs renderMove). Commit as `docs/design/inventory.md`.
Done when: the redundancy list and the mechanism list are in the repo with file and line for each.
Kills it: nothing.

**M0.3 Close the four verdict-copy violations.**
`categoryInfo.ts:48`, `statusInfo.ts:125`, `statusInfo.ts:242`, `bandInfo.ts:68`. Rewrite each as an attribute statement per bible section 8. Add a lint leg that fails on a short hedge-word list in `src/data/*Info.ts` and `data/tutorial.ts`.
Done when: the four lines are rewritten, the lint leg is in `check.mjs`, and it fails on a planted "best".
Gates: the four files are outside `contentHash` by design; confirm the digest does not move.

---

## Tier 1: Foundations

Nothing player-visible changes in Tier 1 except M1.2. These are the parts everything else mounts.

**M1.1 Glyph sheet.**
Ship the nine families from bible section 2 as one sprite or SVG sheet under `ui/`, with a colour-blind check (deuteranopia, protanopia, tritanopia simulations committed as PNGs). Band pip count is read from `bandInfo`, not hardcoded. Do not mount any glyph on any screen yet.
Done when: every glyph in the sheet has a name, a family, and a rendered size at 24px and 16px; the simulations are in `docs/visual/`.
Kills it: two glyphs in the same family are indistinguishable at 16px under any simulation. Redraw before mounting.

**M1.2 One inspect layer.**
Fold the type wheel and the band tooltip into the long-press inspect mechanism. Implement the type-wheel decision recorded 2026-09-10 (keep it, drop the trigger from the two Pokemon panel type badges) as the first step, then delete the wheel as a separate mechanism. Give battle move buttons the same insertion point (this is R8: `renderMove` gets what `moveFacts` already has). Content comes from `describeMove`, `bandInfo`, `statusInfo`, `categoryInfo` and the type chart only.
Done when: a test asserts exactly one tooltip mechanism exists; a test asserts long press on a move button during battle does not submit and does not advance the turn; inspect opens on every type chip, status chip, band strip, item sprite and move card in the tree.
Kills it: any accidental submission during playtest. Then inspect moves to two-finger tap.

**M1.3 Exposure store.**
Add a per-glyph-family exposure counter to the settings store beside the tutorial flags. Nine families. Increment on first render per screen. No labels rendered yet.
Done when: the counter persists across runs, resets with the tutorial reset control, and a test asserts increments per screen not per render.
Gates: settings store only, nothing in `core/`.

---

## Tier 2: The move card

The one component on the most surfaces. Fixing it once changes seven.

**M2.1 Move card face.**
Rebuild the shared move card at rest to bible section 3: name, type chip, category glyph, BP as the largest number in a fixed slot, PP number beside the PP glyph with max dimmed (max only on reward, TM shelf and recipient cards), band pips, accuracy under 100 only with the never-miss glyph where applicable, priority chevron nonzero only. Remove every field label, the type name, the category word, and the BAND numeral. Keep the describeMove icon strip. Both call sites, `moveFacts` and `renderMove`, mount the new face.
Done when: census on all six card surfaces reads 0 words at rest; a test asserts accuracy 100 and priority 0 render no node; a test asserts a never-miss move renders the never-miss glyph and a 100-accuracy move does not.
Kills it: playtesters name "a 4 and a 90" as two ratings. Then pips go behind inspect.

**M2.2 Battle move button.**
2x2 grid, 44px minimum, the move card face plus the forecast: coloured left edge and multiplier fraction, neutral shows nothing. Zero words. Remove the text effectiveness hint.
Done when: census reads 0; `decisionTop` unmoved or recorded; forecast comes from the core effectiveness helper and nothing else.

**M2.3 Move chip.**
A compact form: name, type chip, category glyph, BP. Used in the TM teach flow and the replacement list. The incoming move stays a full pinned card; the four current moves render as chips in one row; tapping a chip opens the existing confirm overlay with two full cards side by side. Five full cards become one card and four chips.
Done when: the pinned card plus at least one full target row fit above the fold at 390x844; a test asserts the overlay shows both full cards with band.
Kills it: testers expand every chip before choosing. Then chips gain PP at rest.

---

## Tier 3: Panels and party

**M3.1 Pokemon battle panel.**
Name, level, gender, HP bar and number, status as three-letter chips, stat stage ladder nonzero only (shipped), item sprite in a fixed slot. Remove item name text and any status word. Add the priority chevron slot for the turn-order flash (used in M4.2).
Done when: census reads 0; item sprite legible at 24px against Showdown's icon sheet; empty item slot renders nothing.

**M3.2 Stat block and party row.**
Six rows of glyph, bar, number, always all six, party order. Item sprite, status chips, four move chips per row. Mount in the drawer, recipient, capture and pre-gym screens. Remove the archetype label wherever the bars now draw it (verify: 4.8.0.3 already did this on some surfaces; finish the rest).
Done when: census reads 0 on drawer and party row; a test asserts no sort and no conditional emphasis on any stat row under any incoming move (R10).

**M3.3 Teach target screen.**
Mount the party row unchanged as the target card. Pinned incoming card from M2.3. Part 4 in full: no sort, no highlight, no projected damage. Decline copy: "Forfeit this reward?" with the two cards. This is the presentation half of the parked Release A; the policy-interface and run-log half of Release A stays parked and is not in this list.
Done when: census reads 0 on the target card and 4 on the decline overlay; Chromium smoke test on the flow passes in all three density modes.

---

## Tier 4: Battle feedback

**M4.1 Flag precedence.**
The protocol-to-flags mapper already returns a list. Add precedence order to `data/tuning.ts` per R9 and have the flag strip render only the first. Remove STAB and contact from the vocabulary. Keep the seven measured kinds.
Done when: a test over recorded turns asserts one flag per hit and the correct winner for a crit plus super-effective hit, a miss plus status, and a berry plus stat stage.
Gates: the mapper is in `core/` and pure; precedence is data.
Kills it: testers cannot say why a hit did what it did and the dropped fact is one precedence removed. Then a second slot returns for that kind.

**M4.2 Forecast and feedback vocabulary.**
The feedback flag uses the same colour family and glyph family as the forecast edge on the button. The priority chevron on the panel is the same chevron as on the card. Verify the jiggle order still reads off the log's ordered data, not a second computation.
Done when: a visual diff shows the same colour tokens on button edge and flag; a test asserts the chevron token is shared.

**M4.3 Log at rest.**
Verify the battle screen renders no log text at rest and the log sheet is reachable by pull. If any turn-order text line survives on the battle screen, remove it.
Done when: census on the battle screen reads 0 outside the flag strip.

---

## Tier 5: Remaining surfaces

Each one is a budget hit. Order by how often the surface is seen.

**M5.1 Reward, shop and TM shelf cards.**
Item, berry and relic cards: sprite in the fixed slot, one effect line under eight words from a `playerDescription` field in `data/items.ts` and `data/relics.ts`, no name text at rest, name on inspect. TM cards mount the move card. Shop adds the price number.
Done when: census reads 8 or under per card; a lint asserts every `playerDescription` is under eight words and contains no hedge word.
Gates: `data/items.ts` is inside `contentHash`. Confirm the description field is in the excluded-display set or accept one hash move and record it.

**M5.2 Map node card.**
Node type glyph, tier pips, reward-tier pips, capability glyph with band chevron where present. Zero words.
Done when: census reads 0; the decision point stays above the fold; a test asserts the capability band chevron matches `resolveCapability`.

**M5.3 Locale card and pre-gym screen.**
Locale: name plus four type chips. Pre-gym: leader name, type chip, "Choose lead". The random showcase mon stays cut.
Done when: census reads 0 and 4.

**M5.4 Result screen and capture card.**
Outcome word, "+N" currency, continue. Capture card mounts the party row. Coverage change as two rows of type chips with plus and minus signs, no words.
Done when: census reads 6 for the result screen and 0 for the capture card; exposure label for the coverage rows fires under M6.1.
Kills it: testers cannot say which row is added after the label fades. Then the two words return.

**M5.5 Confirm overlays.**
Replace: "Replace Tackle with Fire Punch?" and two full cards. Decline: "Forfeit this reward?" and the two cards. Overlay cancel and flow decline visually distinct.
Done when: census reads 6 and 4.

**M5.6 Event screen.**
Prompt under 30 words, choices under six, outcome one line. Rejigged four-tier events included. Capability requirement moves to the map node glyph if the prompt cannot fit.
Done when: census reads 40 or under on every event in `data/events.ts`; a lint asserts it at build.
Kills it: any event needs more than two lines to state requirement and choice. Then the requirement leaves the prompt entirely.

---

## Tier 6: Onboarding and density

**M6.1 Exposure labels.**
Render the first-encounter label beside each glyph family on exposure 1 and 3, driven by the M1.3 store. Starter select carries every label on run one. Nine families, copy in `data/glyphLabels.ts`, each label under three words.
Done when: a test asserts label on exposure 1 and 3 and none on 4 for every family; the visual bot records the starter screen with all labels on a fresh store.

**M6.2 Coach marks re-anchored.**
The 29 coach marks were written against Detailed mode and force Detailed per screen. Re-anchor each to the compact face, delete the forced-Detailed rule, and confirm no mark is silently dropped because its anchor sits behind a tap.
Done when: the coach-mark test runs in Pocket and every mark resolves an anchor.

**M6.3 Pocket default.**
Default density to Pocket for new installs. Keep Simple and Detailed available. Record the retirement decision as open in the bible's register.
Done when: a fresh store starts in Pocket; existing stores keep their choice.

**M6.4 Retire Simple and Detailed.**
Gated on M7.1. Delete the two modes and the per-surface density branches only if the R6 disconfirmer did not fire across two playtest rounds. If it fired, ship the single "numbers on stats" setting instead and close this item.
Done when: one density branch exists, or the stat-numbers setting exists, and the bible register row is updated either way.

---

## Tier 7: Validation

**M7.1 Playtest protocol.**
Write `docs/design/playtest-protocol.md`: for each row in the bible's hypothesis register, the task the tester is given, the observation to record, and the tester count. Run it on two rounds of at least three testers each, at least one with no Pokemon knowledge. Record in `docs/design/playtest-log.md`.
Done when: every register row has an observed or not-observed entry with a date.

**M7.2 Post-census.**
Rerun M0.1. Commit the delta against the Tier 0 baseline and against the bible budgets. Any surface over budget becomes a new milestone or an amendment, never silently tolerated.
Done when: the census table shows every decision surface at or under budget, or names the amendment that raised it.

---

## Standing rules for every item

- Read `design-bible.md` before the item. If the item cannot be done inside it, stop and file an amendment; do not build around it.
- Presentation only. If an item touches `core/` beyond the pure flag mapper (M4.1), it is the wrong item.
- Commit the census delta with the PR. A PR that raises a word count on any surface says so in its description.
- One item, one session, one PR. Two items in one PR cannot be reverted independently.
