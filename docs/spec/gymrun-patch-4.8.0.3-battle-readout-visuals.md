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
- Icons carry a text label on tap. An icon nobody can decode is worse than the row it
