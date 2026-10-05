# GYMRUN Stage 6.0, checkpoint 10: merge main, renumber, open the PR

Filed before any work, under [`README.md`](README.md) rule 1.

---

## PROMPT, verbatim

> We're good to open a pr to push this library to prod

Asked how to sequence the PR against a `main` that had moved, the author
chose: **open the PR now, then merge main on the branch.**

---

## What the tree says at filing (not part of the prompt)

- The PR is [y-wang217/Pocket-Randomizer#97](https://github.com/y-wang217/Pocket-Randomizer/pull/97),
  opened on the branch as it stood after checkpoint 9 (`30dc31b`).
- `main` is 29 commits and 136 files ahead of the fork point (`9b29b09`):
  Defender Mode v0, with its own `gymrun-randomizer-26`, `gymrun-run-24`,
  bible Rev 25, rulings D100 to D103 and `generation.md` sections 103 to
  106. This branch used the same numbers for different things.
- The precedent for two branches taking one number is the `-18` note in
  `test/ai-priority.test.ts` and main's own `-26` note: one string never
  names two schemas, so the merged tree takes the next number. This
  checkpoint's renumbering table is in `generation.md`'s merge note.
- A merge commit, never a rebase: the branch has been pushed and reviewed
  at every checkpoint.
