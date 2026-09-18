# Patch: the party drawer showed a Pokemon the player had already released

**Filed after the work, not before, and says so here rather than in a commit
message.** [`README.md`](README.md) rule 7 is that a session must not begin
implementation from a prompt that is not in `docs/spec/`, and this session did:
the report arrived as a defect sighting rather than as a brief, the cause was
found and the fix verified, and only then was the prompt filed. The nearest
precedent in the register is
[`gymrun-patch-missing-sprite-alt-box.md`](gymrun-patch-missing-sprite-alt-box.md),
filed the same way and for the same reason — a defect found rather than
commissioned. Recording the breach is the point: a prompt that claimed to
predate its patch would make the register unreadable as a record of what was
asked when.

2026-09-18, on `claude/party-check-mantyke-anorith-xttrxm`.

A playtest report. It arrived as two screenshots and one sentence, and it is
filed as it was written: it names the contradiction and asks for nothing
specific, which is part of the record.

---

## The prompt, verbatim

> But Report same time in screenshots but the learn move page acknowledges ive
> dropped  mantyke for anorith but the party check does not

Attached: two screenshots, both stamped `22:43`, transcribed below and kept
beside this file as
[`assets/party-drawer-stale-capture-tm-screen.png`](assets/party-drawer-stale-capture-tm-screen.png)
and
[`assets/party-drawer-stale-capture-drawer.png`](assets/party-drawer-stale-capture-drawer.png).

---

## Screenshot 1 — the recipient screen

Header: `SUMMIT`, `2 / 8`, with the `MAP` and `PARTY` triggers in the top right.
Footer stamp: `GYMRUN-94c6c1-5MUZVRNX`, `0.3.0 · R18`.

> **TM: AIR SLASH**
>
> Who learns it? You choose what it replaces next.
>
> *Air Slash — FLYING · SPEC · 75 BP · ◎95 · ✦30% · PP 24 · EXPLAIN*

Three recipient cards:

| slot | member | level | archetype | typing | ability | HP |
|---|---|---|---|---|---|---|
| 1 | Sobble | Lv14 | SPEC. ATTACKER | WATER | SWARM | 31 / 42 (74%) |
| 2 | Spiritomb | Lv14 | MIXED ATTACKER | GHOST · DARK | MOLD BREAKER | 23 / 42 (55%) |
| 3 | Anorith | Lv14 | PHYS. ATTACKER | ROCK · BUG | HADRON ENGINE | 40 / 40 (100%) |

Each card: "Knows four moves. You choose which one Air Slash replaces."

## Screenshot 2 — the party drawer, opened from that same header

> **Your party** · CLOSE
>
> `3` **Mantyke** Lv14 ♂ · SPEC. TANK · WATER · FLYING · GUTS
> 40 / 40 HP (100%) · PP 144/144 · NO ITEM
> Hit Points 40 · Attack 14 · Defence 23 · Special Attack 26
> Special Defence 42 · Speed 23
> Bubble Beam · Ember · Shadow Sneak · Mega Drain
> Dealt 0 · Taken 0 · KOs 0 · Faints 0 · Turns 0

Slot 3 is Mantyke. On the screen underneath, slot 3 is Anorith.

---

## What the report establishes on its own

- **The build is this tree.** The stamp reads `94c6c1`, which is this tree's own
  `contentHash`, and `R18` is its `RANDOMIZER_VERSION`. Unlike the relics
  report, this one was met on the build it describes.
- **Both readouts are of the same run at the same moment.** The clock reads
  `22:43` in both, and the drawer was opened from the header of the screen in
  the first shot without leaving it — which is what the drawer is for.
- **The party was shortened, not merely added to.** Anorith stands where Mantyke
  stood, in a party of three, so the decision was `release` and not `accept`.
  That matters to the diagnosis: `applyAcquisition` appends the newcomer and
  removes the released slot, so a release is the case in which every slot behind
  it becomes a different Pokemon.

## What it does not say, and what was not assumed

The report names no fix and no cause. In particular it does not say which of the
two screens is wrong, and the answer is not symmetric: the recipient list is
the one the run will resolve the recorded target index against, so it is correct
by construction and the drawer is the surface that has to move.

It also says nothing about items, and a second defect of the same family sits
one line away from the first — an unspent `ItemPlan` names slots, and this is
the other of the two paths that can shorten a party. That is treated as part of
the same fix rather than as separate scope, because the first fix is what makes
it visible: a drawer drawing the shortened party through a plan composed against
the old one would point the Leftovers at whoever shifted up.

## Scope

Presentation only. No `core/` change, no version axis moves, `contentHash`
unmoved at `94c6c1`.

[`../generation.md`](../generation.md) section 36 is the account.
