# GYMRUN 4.8.0.3: Pre-Merge Closeout

Paste into Claude Code on `claude/focused-ride-vet50c`. This closes the patch, it does not extend it.

---

## PROMPT

You are closing out patch 4.8.0.3 on `claude/focused-ride-vet50c` before merge. The three items are built and pushed. Do not add features, do not refactor, do not touch anything the patch did not already touch. Everything below is verification, one commit split, and one deferred file.

The patch's whole safety argument is that it is presentation only: no `core/` state change, no log version bump, no `contentHash` movement, seeded output byte identical including SMOKE24. Every check below exists to test that claim rather than assume it.

### Order of work, stop for review after each

1. Gates.
2. The three verification checks.
3. The commit split.
4. The deferred follow-up file.

---

## Part 1. Gates

Report the result of each, individually, with the command run:

- Visual/browser suite.
- `trim-strict`.
- Smoke, including SMOKE24 byte-identical against the current baseline.

If any of the three fails, stop and report before touching anything in Part 2. A failure in SMOKE24 specifically means the patch is not presentation only and the cause must be found and named, not worked around.

## Part 2. Three checks

**Check 1. The copy fix moved targets, so verify the string is actually gone.**

The prompt named `run-map.ts:87`. The fix landed on `statusInfo`'s Disable advice, on the grounds that the original line lost its marker at `6351009` and `docs/README.md` tracked the survivor.

That reasoning may be right, but the register row now claims a closed invariant violation, and a register that claims a closure it did not get is worse than the open violation was.

- Grep the verdict string and its near variants across `src/`, `data/` and any copy file, not only the two files already touched.
- Report every live occurrence with its surface, or report zero.
- If any occurrence is still rendered, fix it in this patch and say so. If the only hits are dead or in comments, say that explicitly.
- Only once the grep comes back clean does the register row stand. If you have to amend it, amend it.

**Check 2. The `heights.json` correction is scope creep and needs its own commit.**

Correcting the three stale Pocket fields was right, and isolating the staleness across three builds rather than accepting the first reading was the right call. But it moves a checked-in measurement baseline inside a patch whose premise is that nothing moved.

- Split the `heights.json` correction into its own commit, ordered before or after the patch commits, whichever keeps each commit individually green.
- The commit message names the pre-existing staleness, names the three fields, gives the 24px figure, and says it predates 4.8.0.3.
- The §12 entry says the same, so someone diffing heights against this patch does not read the 24px as a regression it caused.
- Do not re-measure. The isolation work is done, this is a history change only.

**Check 3. The ceiling of five must live in `data/`.**

Keeping `tuning.maxMoveTagsOnFace` computed and unread is correct, since deleting it edits a hashed data file and moves `contentHash`.

- Confirm the measured ceiling of five is defined in `data/`, not inline in the smoke test. If it is inline, move it to `data/` in a file that is not part of the `contentHash` set, and have the smoke test read it.
- Confirm the move does not itself move `contentHash`. If no non-hashed `data/` home exists, report that and leave it, rather than moving the hash to satisfy a style rule.
- Comment the five with the worst real case behind it, Fake Out at four, and with the fact that it exists because the tuning value is stranded.

## Part 3. Deferred, file only

Do not build this. Write it into whichever register or open-items file the project uses, with enough context to act on later.

**Always-hits marker.** A never-miss move currently renders no accuracy icon, on the grounds that `accuracy: true` and `accuracy: 100` mean different things and one icon reading `100` for both would collapse the distinction. That call stands.

The consequence is that absence on that icon now means two things: the field does not apply, and the field applies without limit. That collides with Item 1, because the player can now see an evasion boost, and a never-miss move is exactly the case where that boost does nothing. A distinct always-hits marker reads better than nothing.

File it with that reasoning. It is not a blocker for this merge.

---

## Tests required

No new tests. Existing suites must still pass after the commit split and any Check 1 or Check 3 change, with the same gate results reported in Part 1.

## Definition of done

All three gates green and reported individually. The verdict string returns zero live occurrences or is fixed here. The `heights.json` correction is its own commit with the staleness named in the message and in §12. The strip ceiling lives in `data/` or the reason it cannot is on record. The always-hits marker is filed, not built. `contentHash` has not moved.
