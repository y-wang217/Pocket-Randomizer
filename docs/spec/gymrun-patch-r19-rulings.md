# Patch: the R19 playtest rulings — four items, one deferred

Filed 2026-09-18 on `claude/blissful-brown-5tv8fv`, **before any work on any of
them**, per [`README.md`](README.md) rule 7. Nothing in this file has been built.

The author's rulings on the re-measured findings in
[`gymrun-patch-r19-overnight-playtest.md`](gymrun-patch-r19-overnight-playtest.md),
which is the report this answers. That file is the diagnosis and carries every
measurement; this one is the decision and carries none. **Read them together.**

Two messages, verbatim, in the order they arrived.

---

## Message 1 — the ask

> here's 4 items from a prior commit that we should address. validate these as
> changes that we can make, and I'll make decisions on how to address them
>
> 1. Duplicate reward cards (root-caused, not fixed)
>
> Scanned 18,000 offers: 3,044 (16.9%) repeat a kind. Most are benign — two item
> cards are two different items, two move cards two different moves. The real
> defect is the fungible kinds: currency 53 (your screenshot) and heal 528, where
> the second card is the same decision with a different number.
>
> Cause: every relic card carries a fallback drawn from the pool's non-relic
> entries, with no knowledge of the other two cards; resolveOffer collapses onto
> it when you already hold the relic. A pool never holds two currency entries, so
> without-replacement drawing couldn't have produced your pair.
>
> Blocked on: the fix needs the fallback drawn after the other two cards, or
> resolved last — either moves RANDOMIZER_VERSION. Your "put a good item there"
> falls out of the same change; which item list, and hard rule vs. weight, is
> yours.
>
> Also in that screenshot and not in your report: the RELIC card rendered blank.
>
> 2. Wild encounters shouldn't swap optimally
>
> Seam is already right for this: tieredOpponentFor reads data/ai.ts, so "wild
> plays a different policy" is a table entry plus a policy, not a special case in
> the run loop. Moves AI_VERSION, wants a benchmark row on mean gyms cleared.
>
> Blocked on: "no knowledge" is stronger than "random". A wild Pokémon switching
> blindly will sometimes switch into a KO — a different game from one that rarely
> switches. You specified how they swap, not how often. Does the swap rate stay
> where the tier table has it?
>
> 3. Status moves underpriced
>
> Leech Seed 81 vs TM Mystical Power (70 BP) 95. Moves contentHash only.
>
> Blocked on: the number. You said "around a +2 band move or a relic, maybe less
> than a relic" — a range, not a value. I'd derive it from the existing price
> table and report what I picked rather than invent one. Worth knowing: §31 made
> status moves reachable at all (they were structurally unreachable before — all
> four routes called damagingInBands), so this is the first playtest where their
> price has ever been visible.
>
> 4. Items on gym leaders' Pokémon
>
> From the same message as #1. Touches gym definitions and team generation; moves
> contentHash. Nothing measured — I didn't investigate this one at all.
>
> Blocked on: which items, whether they scale by segment like the rest of the gym
> ladder, and whether a gym's held item is revealed — there's an existing
> tuning.revealOpponentItem rule it has to sit inside rather than beside.

**Note on this message, for the reader.** It is a summary of a *previous*
session's findings, pasted forward. Two of the four diagnoses it repeats were
re-measured on this tree and are wrong — item 1's root cause and item 2's
premise — and the corrections are in the playtest file, not here. It is filed
verbatim anyway because it is what was asked, and because the ruling below was
given against the corrected report rather than against this text.

---

## Message 2 — the rulings

> We'll ignore 2 until i reproduce it again in real battles. Otherwise, lets
> follow your plan
>
> 1 a and b your suggestions are good
> Add that relics should show you what they are. On the card.
> Def add items as reward option
>
> 3. We can tune this number later. Currently ok w your plan
>
> 5. Yes lets add battle items at random for now and do item scaling: leftovers
> is much stronger than expert belt for example. If we already have scaling, just
> use the same bands. Otherwise, we increase number of non-berry items as gyms
> progress. Gym 8 should have 6 mons w 6 battle items equipped (also heal 1/4 hp
> berry is top tier) if this doesnt exist check smogon for top items usage in pvp

---

## What the rulings resolve, item by item

Each row names the open question from the report and the answer given. Where the
answer leaves something still open, that is said rather than guessed at.

### Item 1b — the blank card

**Approved as reported, plus one addition.** The report proposed adding the two
missing cases to `renderRewardCard`. The ruling adds: *"relics should show you
what they are. On the card."* So a relic card carries the relic's **name and its
effect**, not only its name — which is what the `item` case already does through
`entry.blurb`, and the relic table already carries the text to do it with.

The Technique case is not mentioned in the ruling and is not dropped: it is the
same defect in the same switch, found in the same reading, and the report filed
both together.

### Item 1a — the duplicate cards

**Approved, and the tuning call is answered:** *"Def add items as reward option."*
So the gym page-2 pool gains an `item` entry. That is what removes the duplicate
in the case the screenshot shows, because it gives the with-replacement draw a
third kind to land on, and it is also the report's own ask from the original
playtest ("Put an item option there, whatever would be comparable to the move
like a good one").

**Still open, and decided by the build rather than by the ruling:** whether the
same-relic-twice defect is fixed in the same pass. The report filed it as a
second violation of the same invariant found in the same draw, the ruling says
"your suggestions are good" against a report that named it, and the axis is
already moving. It ships with 1a.

### Item 2 — wild switching

**Deferred, and not to a later patch — to a reproduction.** *"We'll ignore 2
until i reproduce it again in real battles."* Nothing is built and no version
axis moves for it. The report's finding stands as the reason: the wild tier holds
neither `smartSwitching` nor `smartSendIn`, and it switched 0 times in 500 calls
on a board where medium and hard both switched.

### Item 3 — the technique price

**Approved as derived, with the number explicitly held loose:** *"We can tune
this number later. Currently ok w your plan."* So the build ships 150 base in
shop band 1 and 190 in band 2, and records them as a first cut rather than a
settled value. By `CLAUDE.md`, balance is not a gate: the number is recorded and
the pass keeps going.

### Item 5 — items on gym Pokemon

The longest ruling and the only one that asks for something the report did not
propose. Five separate instructions are in it:

1. **"lets add battle items at random for now"** — non-berry held items, drawn
   at random rather than chosen per leader or per species. "For now" is the
   author naming this as a first cut.
2. **"do item scaling: leftovers is much stronger than expert belt for
   example"** — the items are not equally strong and the draw must know it.
3. **"If we already have scaling, just use the same bands. Otherwise, we
   increase number of non-berry items as gyms progress."** — an explicit
   preference for reusing an existing mechanism over inventing one, with a named
   fallback if none exists. **This is a conditional instruction and the build
   must report which branch it took and why.**
4. **"Gym 8 should have 6 mons w 6 battle items equipped"** — a hard target at
   the top of the ladder: full roster, every member holding. This pins the
   segment-7 rate at 1.0 and makes the gym column a ramp rather than a flat
   rate.
5. **"(also heal 1/4 hp berry is top tier) if this doesnt exist check smogon for
   top items usage in pvp"** — Sitrus Berry named specifically, and a source
   named for the rest. The second half is conditional on the first: check
   whether the item exists before going to look anything up.

**Note on the numbering.** The author's "5" is the playtest file's item 5, which
is the gym-items request — it arrived inside item 1's message and was given its
own section during the re-measurement. The playtest file's *own* item 4, the TM
teach bug, shipped in a previous session and is not in scope here.

---

## Scope of the resulting patch

Four items, in the order the report proposed and the ruling accepted ("lets
follow your plan"):

| step | item | axis |
|---|---|---|
| 1 | 1b — relic and technique reward cards render, relics name their effect | none (UI) |
| 2 | 5 — gym held items, scaled, ramping to a full holding roster at gym 8 | `contentHash` |
| 3 | 3 — technique base price to 150 / 190 | `contentHash` |
| 4 | 1a — gym pool gains an item entry; duplicate kinds and duplicate relics fixed | `RANDOMIZER_VERSION` |

Steps 2 and 3 share one `contentHash` bump. Step 4 is last because it is the only
one that reinterprets recorded seeds, and by `CLAUDE.md` that mismatch must fail
loudly and name the axis.

Item 2 is out of scope by the ruling and stays open in the playtest file.
