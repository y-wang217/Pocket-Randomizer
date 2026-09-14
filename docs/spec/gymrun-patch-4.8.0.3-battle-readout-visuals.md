# GYMRUN Patch: Battle Readout Visuals (stat stages, move facts, band pips)

Paste into Claude Code on top of merged main. This is a patch, not a stage.

---

## PROMPT

You are patching **GYMRUN**. Read `docs/spec/pokerun-build-spec.md`, `docs/generation.md`, the Stage 4.5.1 prompt (Part 4 specifically), and the existing `src/ui/` before writing anything.

Three items, all presentation. Nothing here touches `core/` state, no version axis moves, and seeded output must stay byte identical to the current baseline including SMOKE24. If any item turns out to need a core change, stop and report rather than making it.

Existing rules hold. `core/` never imports from `ui/`. No `Math.random`. Every copy or layout number a tuning pass would touch lives in `data/`. The Part 4 editorial rule governs every string added here: the UI presents attributes, never verdicts. No recommendation, no "best" marker, no score, no colour that implies one option beats another. The live type effectiveness exception against the mon currently on the field is the only carve-out and it is unchanged.

Do not add a second tooltip mechanism. Everything that needs a tap-to-expand uses the existing tooltip layer.

### Report before you write any code

1. **Where do stat stages render today, and in what form?** Name the component and the current string. Report whether the stage value reaches the UI as a stage integer or as anything pre-formatted.
2. **After the trim, which of these does `describeMove` actually return:** secondary effect chance, contact, priority bracket, charge or recharge, recoil, drain, multi-hit range, sound, accuracy. The 4.7 report said only learnsets, legality and GO data are stripped, so expect all of them. Confirm, and name any that are absent.
3. **Is the BAND badge on the shared move card component or still duplicated?** R12 moved it via `moveBandChip` in `scene.ts`. Confirm the single insertion point and list every surface it currently reaches.
4. **Who reads the archetype label?** List every caller, including any test or sim policy. If anything outside `ui/` reads it, item 3 changes shape.

Stop and report all four. Do not proceed until reviewed.

### Order of work, stop for review after each

1. The four report questions.
2. Stat stage multipliers.
3. Move fact icon strip on the shared move card.
4. Band pips, archetype label, copy fix.

---

## Item 1. Stat stages render as multipliers

A stage integer is a number only a Pokemon player can read. The multiplier is the same fact in a form anyone can read.

- Every non-zero stage shows its multiplier to one decimal, plus a short ladder bar showing where the stage sits in its range.
- The stage-to-multiplier table lives in `data/`, not inline in a component. Attack and Defense stages and accuracy or evasion stages use different tables, so encode both rather than one formula.
- Show the multiplier the mechanics actually apply. A single drop is 0.7x, not 0.5x. If the two disagree anywhere, the mechanics win and the table gets a comment naming why.
- Both sides, same component, same form.
- Zero stages render nothing. No "1.0x" rows.

Density behaviour, per the density modes ruling that no mode removes a fact:

- Detailed: multiplier plus ladder, inline.
- Simple: multiplier plus ladder, inline.
- Pocket: a single collapsed marker per side that expands to the full set on one tap, through the existing tooltip layer.

## Item 2. Move fact icon strip

`describeMove` already returns structured fields on six card surfaces and renders them as rows. Rows cost vertical space that the battle screen does not have. Convert to an icon strip on the card face.

- On the face: secondary effect chance as a number with its icon, contact, priority bracket when non-zero, charge or recharge, recoil, drain, multi-hit range. Accuracy stays as a number and stays on the face, since it is the field the whole explanation layer exists for.
- Everything else, including the dex description, stays behind the existing tap.
- Absent fields render nothing. No empty slots, no greyed placeholders.
- Icons carry a text label on tap. An icon nobody can decode is worse than the row it replaced.
- Wire this into `moveFacts` so it reaches all six card surfaces at once, and handle the four battle buttons alongside it, mirroring the existing two-call-site shape of `moveBandChip`. Do not collapse the two sites into one.
- Read contact and sound out of `flags[]`. Do not add named fields to `describeMove`.
- `chargeTurns` is derived from the `charge` flag and is always 1, so render charge as a flag, not as a turn count. Any other field derived from a flag follows the same rule.
- Absent fields render nothing. No empty slots, no greyed placeholders.
- Part 4 applies to every label. "Contact" is correct. "Risky" is not. "30% burn" is correct. "Good odds" is not.

**Vertical budget.** On 390x844 the battle screen currently measures 844 with `decisionTop` at 681.5. The strip must not move `decisionTop`. If it does, the strip gets a compact height variant rather than the budget getting a deviation. Record the measured numbers in `docs/generation.md` §12 alongside the existing entries. Release C's 36px flag strip is a separate element and must not be duplicated or merged into this one.

## Item 3. Band pips, archetype label, copy fix

**Band pips.** `BAND n` becomes four pips, n filled. Same resolution through `bandOfMove`, same `bandInfo.ts` tooltip attached unchanged, both existing call sites. The number stays available through the tooltip.

**Archetype label.** The six stat bars already draw the shape the label describes, and the label is known to lie under full move randomization. Nothing outside `ui/` reads it, so remove the rendering from every surface that also draws the stat bars. Keep `archetypeOf` and `ActiveUiView.archetype` in place, untouched. On any surface with no stat bars, leave the chip. Update `test/party-drawer.test.ts:104` and `test/visual-chips.test.ts:249` with a comment naming this patch rather than deleting them.

**Copy fix.** `run-map.ts:87` carries "best rewards", which is a verdict and a standing invariant violation. Replace it with the attribute it is describing. Close the violation in whichever register file tracks it.

---

## Tests required

1. Stat stage multipliers match the applied mechanics across every stage from -6 to +6 for the main table, asserted against the table rather than a hardcoded string.
2. Accuracy and evasion stages reach the UI through the new field and render their multipliers, and the six-stat block is unchanged in shape everywhere it appears.
3. A zero stage renders nothing.
4. The move fact strip renders exactly the fields `describeMove` returns for a sweep including a never-miss move, a priority move, a multi-hit move, a recoil move, a charge move and a pure status move, and renders nothing for absent fields.
5. Band pips render on both call sites, asserted per surface, resolving through `bandOfMove` in both.
6. Exactly one tooltip mechanism exists after this patch.
7. Pocket mode removes no fact: everything visible in Detailed is reachable in Pocket within one tap.
8. `battle.decisionTop` is unmoved at 390x844. Any deviation is recorded, not absorbed.
9. `playRun` completes headless under Node, no log version bump, no `contentHash` movement, seeded output byte identical including SMOKE24.
10. All existing suites pass, except those asserting the old stage string or the archetype label, updated with a comment naming this patch rather than deleted.

## Out of scope

Damage range or hits-to-KO readouts. An opponent revealed-information panel. A party type matrix. The type wheel decision. Release A, the Release B closeout, the AI tier patch, the density modes patch itself. Any change to `core/battle/ai.ts`. Any change to `statViews` or `BOOSTABLE_STATS`.

## Definition of done

On a 390x844 phone, a player who has never played Pokemon can read what a boost actually did to a number, can see why a move missed when evasion was raised, can see a move's accuracy and its odds of doing something extra without leaving the battle screen, and sees a band as a filled meter rather than a word. Nothing on any screen tells them which option is better, and the decision point has not moved down by a single pixel.
