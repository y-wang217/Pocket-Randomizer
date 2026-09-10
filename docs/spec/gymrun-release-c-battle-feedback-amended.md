# GYMRUN Release C, amended: Battle Feedback Visuals on top of V0 to V4

Supersedes section 6 of `gymrun-qol-release-plan-rev2.md`. That prompt assumed Release C would land before V0. The V5 unblock audit (`docs/reports/v5-unblock-audit.md`) found V0 to V4 merged at `9296ba7` and Release C absent, so C now lands on top of the visual pass, not under it. Three things change as a result and they are called out below.

Paste into Claude Code on main after the three decisions in the audit have been applied.

---

## PROMPT

You are building **Release C** of GYMRUN. Presentation only. No `core/` state changes, no version bump on any axis, seeded output byte identical to the post-4.7 baseline by both instruments.

Read `docs/reports/v5-unblock-audit.md` first, then `src/ui/scene.ts`, `src/ui/theme/tokens.css`, the chip component from V2, the HP bar as V0 to V4 left it, the turn order log from the round 2 patch, and the `-enditem` reader from 4.6b.

### What changed because V0 to V4 landed first

1. **Every colour, duration and size you add goes through `tokens.css`.** V0 deleted hardcoded values from `src/ui/`. Do not reintroduce one. The shadow segment colour, the flag word surface, and the jiggle distance are tokens.
2. **The HP bar you are restyling is the V0 bar, not the Stage 0 bar.** Locate it before touching it and report which file owns it.
3. **`docs/visual/baseline/` is a guarded baseline now.** Release C moves the battle screen, so re-record it in the same commit as the change that moved it, never in a separate commit, so a bisect always lands on a self-consistent pair.

### Step 0, before any code

- Apply the SMOKE24 marker decision: the map fold overflow at y=869 gets an explicit expected-fail with a comment naming the cause and its ticket, matching `visual-v0.test.ts:47`. Report `git blame` on the offending markup: if the overflow came from V0 to V4 rather than 4.7, stop and say so, because then it belongs to the visual pass and must be fixed before V5.
- Confirm `data/tuning.ts` has no added-time-per-turn number yet. If one exists from any earlier stage, reuse it, do not add a second.

### Order of work, stop for review after each

1. Step 0.
2. Protocol-to-flags mapper in `core/`, pure, with tests. No UI.
3. HP chunk and shadow.
4. Turn order jiggle.
5. Flag words and berry-fired, rendered.
6. Reduced motion, timing token, baseline re-record.

### Rules

- No animation blocks input. Every transition is skippable by tapping.
- Total added time per turn is one number in `data/tuning.ts`. `tuning.ts` is under `data/`, so confirm adding it does not move `contentHash`. The audit says `contentHash` does not exist yet, so this is a no-op today, but write the finding into the report because the contentHash release will need to decide whether presentation timing belongs in the hashed set.
- Respect the OS reduced-motion setting. Under reduced motion every animation resolves instantly and every flag still displays.
- `core/` contains no timers. `playRun` completes headless unchanged.
- Attributes, never verdicts, extended to visual weight per the visual pass rules. A super effective flag word is not larger, brighter or accent-coloured relative to a not-very-effective one. The accent stays on `.primary-action` only.

### Item 1. HP chunk and shadow

When HP drops, the bar falls immediately to the new value and a shadow segment marks where it was, fading over a tokenised duration defaulting to 0.5s. Healing gets no shadow, it gets the explicit restore line from the round 2 patch, unchanged.

### Item 2. Turn order jiggle

The acting side jiggles first, then the other, in resolution order, driven from the same ordered turn data the log reads. Do not compute turn order a second time. Priority marking follows the log rule exactly: bracket-driven turns only, same-bracket turns unmarked.

**Report, do not fix.** The AI is priority-blind and speed-blind. Say whether the jiggle makes misplays read as bugs. Do not touch `core/battle/ai.ts`.

### Item 3. Flag words

Post-resolution truths read off the protocol: STAB, super effective, not very effective, no effect, critical hit, missed, contact, priority, status inflicted. A pure mapper in `core/` from protocol lines to a flag list, UI renders only. These are a different thing from the pre-selection effectiveness marker on the move button, which is a forecast. Do not merge them, do not derive one from the other, and leave the neutral-suppression behaviour at `scene.ts:610` exactly as it is.

Render flag words through the V2 chip component so V5's event strip can hold them without a restyle.

### Item 4. Berry fired

On the existing `-enditem` signal, a flag word naming the berry and what it did.

### Tests required

1. Mapper returns correct flags for a fixed set of recorded turns including a crit, a miss, a no-effect hit, a status infliction, and a berry consumption.
2. Jiggle order matches the log's resolution order for a fixed seed.
3. `core/` contains no timers and `playRun` completes headless unchanged.
4. Under reduced motion all flags display and no animation delays input.
5. Every new colour, size and duration in `src/ui/` resolves through a token. The V0 hardcoded-value grep still returns its post-V4 count.
6. Seeded output byte identical, SMOKE24 green except the marked map case, `docs/visual/baseline/` re-recorded in the same commit that moved it.
7. All 866 tests pass plus the new ones.

### Definition of done

A player watching a turn can tell who moved first, how much HP was actually taken, whether a berry fired, and why the hit landed the way it did, without reading the log. The report names the file that owns the HP bar, states whether the SMOKE24 overflow belongs to 4.7 or to V0 to V4, and records the contentHash note for the tuning number.

---

## Follow-on, separate paste: R12

After Release C is merged. Display only, one commit.

Move `bandChip` from its single caller in `reward.ts:61` into the shared move button component so every move card surface carries `BAND n` through `bandOfMove`. Keep the `band` tooltip from `bandInfo.ts` attached. Re-record `docs/visual/baseline/` in the same commit. Assert per surface: reward card, move button, party drawer, and wherever else the audit found the component rendered. Seeded output byte identical, no version axis moves.

Then paste V5 with test 4 rewritten to: every rendered effectiveness marker is the same size and weight, and no marker is brighter than the neutral state.
