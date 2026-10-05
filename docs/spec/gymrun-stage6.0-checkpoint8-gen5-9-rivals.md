# GYMRUN Stage 6.0, checkpoint 8: the Gen 5 to 9 rivals

Filed before any work, under [`README.md`](README.md) rule 1. Closes the
open item section 105 of [`../generation.md`](../generation.md) named: the
library's challenger pool has no Gen 5 to 9 rival, because pokemondb's
leader pages carry none.

---

## PROMPT, verbatim

> yea add the gen 5-9 then checkpoint 8

---

## What the tree says at filing (not part of the prompt)

- The challenger pool (`data/encounters/library.ts`, checkpoint 6) draws
  roles `rival`, `gym` and `elite` and the titled protagonists. The rivals
  it has are Gen 1 to 4's from the pret decompilations (Blue, Silver,
  Brendan, May, Wally, Barry) and, from pokemondb's pages, only the few
  Gen 5 to 9 rival fights those pages list beside the leaders (Bede, Hop,
  Marnie's Champion Cup, Nemona, Penny).
- Source for the rest: Serebii, which this container can read and which
  checkpoint 5 already pins in `scripts/import-encounters/sources.json` for
  the Champion Cup. Which pages carry the rival battles per game is the
  research this checkpoint starts with; a game whose page cannot be read or
  parsed is recorded as a gap, not guessed.
- No version axis is owed by the data alone; a record that enters a
  candidate window moves the record a seed draws, which is the regenerate
  rule the tables state, so `RANDOMIZER_VERSION` moves to `-29` if any does.
