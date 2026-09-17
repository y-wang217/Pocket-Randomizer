# Patch: chip audit, type/ability chip sweep, and move-card type icons

Filed verbatim on 2026-09-17, before any work, on `claude/serene-bohr-xn433h`.

## Context: the message before it

The session opened with a verification question, answered without a code change.
It is not part of this patch and is recorded here only because the patch message
below begins with "also" and would otherwise read as a fragment.

> help me verify something:
> phys/spec tanks are measured based on attack or defense?
>
> like they're supposed to be labelled based on what they defend well against - so if they have high spdef, they would be a special tank. player needs to know what they can counter with that tank, not how the tank hits, which is less important.

Answer, verified against `src/core/archetype.ts` and `src/data/archetypes.ts`:
tanks split on `def` vs `spd`, never on the offences. `pTank` is Defence >
Special Defence, `sTank` is the reverse. No change was made.

## The brief, verbatim

> lets do a scan to make sure that chip is readable on every mon screen including acquire, learn move, party pop up, and manage screens
>
> then, do a second sweep to make sure types and abilities are available clickable chips in every screen with mons like above
>
> also, since we have some dead space inside move cards (in battle), i'd like a small QOL to show types in certain colors. attached are type icons. i'd like something like this attached to each move as a visibility to enforce what type each is. these icons should be 50% opacity max, and shouldn't distract.
>
> this is a small qol patch

## The attachment

One image: eighteen circular type icons, one per Pokemon type, each a flat
white glyph centred on a filled circle in that type's colour. Read in the image
as three rows of six — Normal, Fighting, Flying, Poison, Ground, Rock; Bug,
Ghost, Steel, Fire, Water, Grass; Electric, Psychic, Ice, Dragon, Dark, Fairy.
The file itself is not committed: it is a reference for the glyph vocabulary,
not an asset to ship, and the patch draws its own SVG paths.

## What "that chip" means

The archetype chip of Stage 4.7 Part 7 — `src/ui/archetype-chip.ts`, the six
labels of `src/data/archetypes.ts`. The preceding message is what fixes the
referent.

## Scope as filed

Three items. The first two are audits and produce a report; the third is a
build. The brief calls the whole thing "a small qol patch", which is a scope
instruction and is treated as one: no `core/` change, no version axis moves.

## The two questions, asked after the audit and before any code

The audits found that both items 1 and 2 collide with decisions already on the
record, so neither was implemented as a rediscovery. Both were put to the author
with the standing decision named, and both answers supersede it with today's
date. `docs/spec/README.md`: "If you believe the register is wrong, that is a
new decision with a new date, not a rediscovery."

**Q1 — archetype chip scope.** Asked with Patch 4.8.0.3 item 3 quoted: the chip
is deliberately absent from the party popup, party screen, pre-gym lead, starter
select, evolution and the acquire offer panel, because those surfaces draw the
six stat bars and the chip reads base stats only. The only surface with neither
bars nor chip is the learn-move recipient. Three options offered: fill the one
gap, chip everywhere, or chip everywhere plus bars on learn-move.

> **Chip everywhere, bars or not.**

So **Patch 4.8.0.3 item 3 is superseded.** The chip returns to every surface
that carries a Pokemon, bars or no bars. Recorded in `../generation.md`.

**Q2 — type and ability chips.** Asked with the 2026-09-10 type wheel ruling
quoted ("keep the wheel, drop the trigger from the two Pokemon panel type
badges"), and with the finding that it had been applied far wider than the two
panels it named: type chips trigger nothing on *any* Pokemon surface, and
abilities are a real chip on two surfaces, a non-focusable span on two, bare
text on one, and absent on four. Three options offered: types plus abilities,
abilities only, or types everywhere including gym and threat badges.

> **Types on mon surfaces + abilities everywhere.**

So **the 2026-09-10 ruling is superseded for Pokemon type badges** and stands
everywhere else: a gym leader's type, a locale's types, a threat entry's type
and an item's boosted type keep no trigger. That split is why the wrapper is
not simply given a tooltip — see `monTypeChip`.
