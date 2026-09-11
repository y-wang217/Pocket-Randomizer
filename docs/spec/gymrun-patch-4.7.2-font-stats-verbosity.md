# GYMRUN patch 4.7.2 — font, stat bars, verbosity, move explanations

Committed verbatim before any work began on it, per protocol 7 in
[`README.md`](README.md). Two documents, in the order they were issued: the
patch brief, then the rulings that came back on the report the brief demanded.

**Neither is edited to match what gets built.** Where the built work deviates,
the deviation is recorded in [`../generation.md`](../generation.md) with a dated
note, per protocol 4.

The report itself is not reproduced here — a report is not a prompt. It lives at
[`../visual/reports/patch-4.7.2.md`](../visual/reports/patch-4.7.2.md), written
as the patch runs, and the rulings below name the findings they respond to.

---

## Document 1: the patch brief, as issued

some bug fixes in this patch 4.7.2 You are patching GYMRUN. Read src/ui/, the V0 typography token, and the Stage
4.5.1 prompt (Part 5) before writing anything.

Scope: one font swap, one toggle fix, two party screen bugs. No version bump on
any axis, no data table changes, no new RNG keys or draws, seeded output byte
identical, SMOKE24 stays marked as it is on main. Branch off main, exclude the
strict-trim vitest gate per the standing rule.

The Part 4 editorial rule governs all copy added here: the UI presents
attributes, never verdicts.

### Report first, do not code

1. VERBOSITY FLAG. Stage 4.5.1 Part 5 specced a Simple/Detailed toggle: global,
   persisted across runs, Detailed by default, presentation only, one flag read
   by components. Find the flag. List every call site that reads it, excluding
   the settings control itself.

2. PARTY SCREEN STAT BARS. On the party drawer, the six stat rows render as
   flat dark lines with no numbers. Report which component renders them, what
   values it receives, whether the bar fill width is computed from a real stat
   value or is zero/unset, and whether the component branches on the verbosity
   flag at all. Distinguish three possible causes and say which it is: values
   not passed, fill width not computed, or fill colour invisible against the
   background.

3. FONT DECLARATIONS. Report how many distinct font-family declarations exist
   across src/ui/ and whether they all resolve through the V0 token or some are
   inline.

4. MOVE DATA. The 4.7 report established that the trim strips only learnsets,
   legality and Pokemon GO data, so every move field survives. Confirm that
   accuracy, priority, flags, secondary chance, boosts and the short dex
   description are all reachable at runtime with no generated table.

Stop and report all four.

### Then, in order, stopping for review after each

1. FONT. Pixelify Sans everywhere pixel text currently renders. Blanket swap,
   no per-surface exceptions. Self-host it, do not fetch from a CDN at runtime.
   All families resolve through named tokens in one file: display, body,
   numeral, all three set to Pixelify Sans. No inline font-family anywhere in
   src/ui/. Swapping a face is one line per token. If the V0 token already does
   this, extend it rather than adding a second mechanism.

   Pixelify Sans is proportional, so counters that update in place (HP, PP, stat
   numbers) will reflow as digits change. Use tabular alignment where the layout
   depends on it, or reserve width. Report the bundle cost of the font files.

   Legibility floor for chips, as numbers in data/tuning.ts, not hardcoded:
   minimum chip font-size with a floor of 11px, and a minimum contrast ratio for
   chip text against its chip background. Apply to every chip surface, asserted
   per surface.

2. STAT BARS. Fix per the finding in report item 2. Requirements regardless of
   cause: each of the six stats shows a filled bar whose width is proportional
   to the value, and the bar is visible against the panel background at the
   contrast floor above. Use the same stat component the battle panel uses. Do
   not build a reduced variant.

3. VERBOSITY TOGGLE. Implement the 4.5.1 Part 5 definition exactly: Simple
   replaces raw stat numbers with relative bars and keeps the faster-side
   marker, Detailed shows numbers alongside the bars. One flag, read by
   components. It never branches game logic, never touches BattleView, and never
   changes what core/ produces. Keep the seam shaped so a third mode can be
   added later without a second mechanism.

4. MOVE DESCRIPTIONS ON THE PARTY SCREEN. Every move on every party member is
   tappable and opens an explanation. Implement it as Release B item 3 specifies:

   describeMove(moveId: string): MoveExplanation

   Pure, in core/, no RNG, no DOM. Returns structured fields, not a prose blob:
   accuracy as a number or an explicit never-misses marker, base power,
   category, type, PP, band, priority bracket, target, secondary effect chance
   and effect, stat changes, behavioural flags (contact, sound, recoil, drain,
   charge or recharge, multi-hit range, protection-bypassing), and the short dex
   description last. Band comes from bandOfMove, not a second computation. Omit
   absent fields rather than rendering empty rows. Do not hand-roll any of it and
   do not write a prose sentence in core/.

   Wire it into the shared move card component, one insertion point, not into
   each screen. Report which surfaces that reaches and confirm the count. Tap to
   expand, not hover. Do not add a third tooltip mechanism to src/ui/tooltips.ts;
   the type wheel decision is Release B's and stays untouched here.

   Part 4 applies: "Accuracy 85%" is correct, "risky" is not.

### Tests

1. The verbosity flag is unreachable from core/ (existing test, must still pass).
2. Toggling to Simple changes rendered output on the battle panel and the party
   screen, asserted per surface. Toggling back restores it.
3. Every stat row on the party screen renders a bar with a non-zero width for a
   non-zero stat, and the six values match the member's real stats.
4. No chip renders below the tuning floor for size or contrast, swept over every
   chip surface.
5. Exactly one font family is referenced across src/ui/, resolved through the
   tokens.
6. describeMove returns correct accuracy, priority, secondary chance and boosts
   for a sweep of known moves including a never-miss move, a priority move, a
   stat-change move, a multi-hit move and a recoil move. It is pure: identical
   input to identical output.
7. A multi-hit move reports both its per-hit base power and its band, and they
   disagree without either being wrong.
8. Opening a move explanation never submits a move or advances a turn on any
   surface it reaches.
9. core/ contains no font or style knowledge.
10. Seeded output byte identical. All suites pass.

### Definition of done

On a phone: every chip is readable at a glance with no letter confusable with
another, the party screen shows six real stat bars, tapping a move explains what
it does and how often it hits, the Simple/Detailed toggle visibly changes the
screen, and changing the game's font is one line per token.

---

## Document 2: the rulings on the report

Report reviewed. Proceed. Six rulings and two additions below, then the revised
order of work. Everything else in the original patch brief stands: no version
bump on any axis, no data table changes, no new RNG keys or draws, seeded output
byte identical, SMOKE24 stays marked as it is on main, strict-trim vitest gate
excluded.

### Rulings on your report

1. STAT COMPONENT. You are right and the brief was wrong. V5.3 deleted the
   battle panel stat block and member-card.statBlock is the shared component
   now. Fix it in place. Do not re-add stat rows to the battle panel.

2. DO NOT HIDE HP DIGITS IN SIMPLE MODE. Rejected. Exact HP is the most
   decision-relevant number on the screen and hiding it removes the read rather
   than decluttering. The battle panel does not branch on verbosity in this
   patch. Rewrite test 2 to assert the flag changes the party screen and the
   threats screen, its two real readers. Stage chips and the faster-side marker
   stay in both modes, as you proposed.

3. DETAILED SHOWS BOTH. Today bar.hidden = detailed makes the modes mutually
   exclusive. Change it: Detailed renders the bar and the number together,
   Simple renders the bar alone. This is a change to Detailed, not only to
   Simple.

4. SUBSCRIPTION GAP IS IN SCOPE. A toggle that leaves stale cards on five
   screens is the same bug one step further along. Fix it at the shell: one
   subscription that re-renders the active screen. If the shell cannot do that,
   re-render on screen mount and on drawer open, which covers every case for a
   presentation-only flag. Do not add per-screen subscriptions a future screen
   can forget, same reasoning as the single shell-level drawer trigger in 4.7.

5. CHIP FLOOR. Accept the baseline churn. Delete the @media (max-width: 420px)
   rule that drops .badge--tag to 9px rather than raising it; shrinking text on
   the primary target device is backwards. Report battle.decisionTop and
   decisionBottom before and after the size change, and record any movement as a
   deviation in docs/generation.md the way R12's +1px was. If the decision point
   drops below the fold on 390x844, stop and report rather than shipping it.

6. CONTRAST. Lift --chip-text globally. No per-hue exceptions, since five
   hand-tuned values rot the first time a chip is added. Confirm in your report
   that the desaturation lands on the label and not the chip fill.

### Additions

7. FONT TOKENS. Blanket Pixelify Sans as instructed, and keep --font-numeral as
   a separate token pointing at the same face. Pixelify Sans is proportional and
   likely has no tabular figures, so counters that update in place will reflow.
   That token is the one-line escape hatch. Report whether the face has tabular
   figures, and report any visible jitter on HP and PP counters at 390x844.

8. INLINE-BOX GUARD. .stat__bar-fill was a span with a width that could never
   paint. Add a test that no element receiving an inline width or height is left
   as a non-replaced inline box. This is the class of bug that just cost the
   stat bars and it will recur.

### Recorded, do not build

- Battle move buttons go through moveFacts, not moveCard, so Release B's "one
  insertion point" rule does not reach R8. R8 needs its own insertion point.
- The four current moves on the move-replace screen are also moveFacts, so the
  incoming move will explain itself and the moves being chosen between will not.
  That asymmetry sits on the exact comparison screen and is worse than neither
  explaining. Open item for Release A.

Add both to the open items register with this patch's branch named.

### Order of work, stop for review after each

1. Font tokens. --font-body and --font-numeral to Pixelify Sans, three tokens in
   tokens.css, nothing inline. Report tabular figures, counter jitter, bundle
   delta (expected zero).

2. Chip legibility floor. Minimum chip font-size floor 11px and minimum contrast
   ratio as numbers in data/tuning.ts, the 420px rule deleted, --chip-text
   lifted once. Re-record visual baselines. Report decisionTop and
   decisionBottom before and after.

3. Stat bar fix and the inline-box guard test.

4. Verbosity: Detailed shows bar plus number, Simple shows bar alone, plus the
   shell-level re-render.

5. describeMove wired into scene.moveCard, tap to expand, six surfaces
   confirmed by count. No new tooltip mechanism, type wheel untouched.

### Tests

1. The verbosity flag is unreachable from core/ (existing, must still pass).
2. Toggling changes rendered output on the party screen and the threats screen,
   asserted per surface, and toggling back restores it. The battle panel is not
   asserted.
3. Detailed renders both a bar and a number for every stat row; Simple renders
   the bar alone. Neither mode renders a row with neither.
4. Every stat row renders a fill with non-zero painted width for a non-zero
   stat, and the six values match the member's real stats.
5. No element with an inline width or height computes to a non-replaced inline
   box.
6. A verbosity change applied while a screen is open takes effect on that screen
   without navigating away, asserted on at least the drawer and one other
   non-map screen.
7. No chip renders below the tuning floor for size or contrast, swept over every
   chip surface.
8. Exactly one font family is referenced across src/ui/, through the tokens.
9. describeMove purity and field correctness over the sweep already run in the
   report, including Population Bomb reporting 20 BP and band 4.
10. Opening a move explanation never submits a move or advances a turn, on all
    six surfaces.
11. core/ contains no font or style knowledge.
12. Seeded output byte identical. All suites pass, except any asserting the old
    mutually-exclusive bar/number behaviour, updated with a comment naming this
    patch rather than deleted.

### Definition of done

On a 390x844 phone: every chip is readable with no letter confusable with
another, every stat row shows a painted bar with its number beside it in
Detailed, tapping a move on any of the six card surfaces explains what it does
and how often it hits, the toggle takes effect on whatever screen is open when
it is flipped, and the decision point has not moved below the fold.
