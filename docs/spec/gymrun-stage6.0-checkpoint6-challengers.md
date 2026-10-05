# GYMRUN Stage 6.0, checkpoint 6: challengers

Filed before any work, under [`README.md`](README.md) rule 1. The stage's
prompt is [`gymrun-stage6.0-encounter-library.md`](gymrun-stage6.0-encounter-library.md);
this file holds the author's two messages that redirected it after checkpoint
5, and the rulings taken on them.

---

## PROMPT, verbatim

The first message, sent while checkpoint 6 was being scoped:

> also the gym defender shouldn't be facing gyms as bosses. bosses should be more like 'this is an ace trainer at this stage' like the rival in red/blue or the main character in any of the games.

The second, in answer to a question about splitting the work:

> my idea is that maps are training, and there's only a progress bar that shrinks as the 'next challenger approaches'
> so there doesn't need to be a badge, just that you can go to an area to get the resources (typing) in the ones available in that area. the challenger is agnostic of the trianing

---

## Rulings taken 2026-10-05 (not part of the prompt)

Put to the author by question in the same session, before any work. Each
changes what is built.

1. **The challenger pool.** Rivals and protagonists, **and** gym leaders and
   Elite Four members: *"Challenger x where x is gym leader brock, mysterious
   trainer blue, elite four y, etc"*. Champions and villain bosses are not in
   it, except a rival or protagonist who holds the title (Blue, Red, Trace,
   Hau, Green).
2. **The class word is the game's own.** `Rival Blue`, `Pokemon Trainer Red`,
   `Leader Brock`, `Elite Four Lorelei`. No flavour class.
3. **The type leaves the stage entirely.** The gym has no type identity, the
   challenger is agnostic of the training, and the typed resource is the
   area's: the locale's four wild types, which `data/locales.ts` already
   carries. The mono-type gym rule retires.
4. **Gym leaders also appear as route trainers at `hard` and `elite`.**
5. **One record per trainer name per candidate window** (asked first, before
   the redirect, as the fix for the Rock gym's five Brocks): Brock once, not
   five times.
6. **The bundle seam** (asked beside ruling 5): a host-filled registry for the
   route trainers, with `core/` throwing loudly on an unfilled one, is
   acceptable against the no-side-effects rule. **Deferred**: not built in
   this checkpoint.

Ruling 1 of the stage ("gyms draw canonical leaders of the gym's type, per
seed") is superseded by rulings 1 and 3 here. It is not edited there; the
dated note is in [`../generation.md`](../generation.md) section 105.

## What this checkpoint builds, and what it files

Built: the challenger pool, leaders on routes, the name-deduplicated window,
the node's label (`Challenger Rival Blue`), every type chip off the screen,
the census and the Chromium leg recorded.

Filed, not built: the second message's map as training, with no badge and a
progress bar that shrinks as the next challenger approaches. That replaces
the eight-badge rail at four call sites and the badge mark on the node, the
battle header and the summary; section 5 of the bible has no row for it and
D46, D72 and D100 put the badge where it is. It is **D102** in
[`../design/bible-discrepancies.md`](../design/bible-discrepancies.md), with
options, for checkpoint 7 after the ruling. Until then the badge mark stays
as the untyped kind glyph.
