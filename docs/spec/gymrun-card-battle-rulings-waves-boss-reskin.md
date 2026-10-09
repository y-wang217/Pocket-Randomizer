# Rulings: card battle Parts C (waves), D (Colossus and Harpoon), E (reskin)

2026-10-09, on `claude/vibrant-hopper-axlk79`. Filed **before any work**,
verbatim, as [`README.md`](README.md) rule 7 asks, with the image it arrived
with ([`assets/card-battle-reskin-reference.webp`](assets/card-battle-reskin-reference.webp)).

The author's answers to the decision list the session put after Part A of
[`gymrun-patch-card-battle-grace-friendly-fire.md`](gymrun-patch-card-battle-grace-friendly-fire.md).
The numbers answer that list's questions, in order; the list is reproduced
below the message so each answer can be read against its question. Some
answers open follow-ups (D3 asks for one; C4, C6, D2, D7, D9 and D10 are
read back to the author before building).

---

## The message, verbatim

> *(the image: `assets/card-battle-reskin-reference.webp`)*
>
> c
>
> 1. mp resets
> 2. reshuffle
> 3. replace
> 4. comes back per fight
> 5. do not carry
> 6. per round loss
> 7. draft based on your call. i'll playtest and feel it
> 8. yes, but more importantly, the fights should be successively harder.
>
>
> D
>
> 1. once
> 2. pinned causes collosus to scream, doing aoe damage on all adjacent tiles
> 3. follow up what is hunt and i'll decide again
> 4. not sure
> 5. no that's intended
> 6. yes
> 7. back into the deck, with a finite number of uses
> 8. harpoon is only 3 units range, so someone needs to go close; gate its use until a unit feasibly can cast it
> 9. all shields, but they return once the harpoon wears off (2 turns)
> 10. movement, and it forces a melee attack to "remove" the harpoon
>
>
> e
>
> 1. chatgpt. give me a prompt for exactly what assets are needed. I'll give you a nice image to base the design around.
> 2. shrink tiles and test readability.
> 3. the colours can show better if the cards have a border. try it
> 4. no header. that was a internal label
> 5. reskin after c and d
>
>
> try to take inspo from the attached image

---

## The questions they answer (the session's list, condensed)

**C.** 1 MP between waves. 2 Deck between waves. 3 Re-place units between
waves. 4 Once-per-battle cards: used up for the fight, or back each wave.
5 Focus and Need Help: carry into the next wave, or clear. 6 Round count and
the 30-round loss: whole fight, or per wave. 7 Waves 1 and 2 of the
three-wave scenario. 8 A wave scenario's grade total is the sum of its waves.

**D.** 1 Area hits on the 2x2 boss: once per card, or per tile. 2 Does
Pinned make area cards hit per tile. 3 Hunt x3 on a 2x2 enemy shifts at
most one lane. 4 At C3 its front row is on C3 (it holds C3 and C4), Stomp
hitting C2 in every lane. 5 Under grace it always opens on Shield 3.
6 Harpoon holds one of the 5 hand places. 7 Harpoon after use: one-off, or
back into the deck. 8 Harpoon range. 9 "Shield to 0": card shields only, or
base 3 too. 10 Pinned: movement only, for one round.

**E.** 1 Who redraws the art. 2 Phone height with the roster on top and
panels below. 3 Owner colours on felt. 4 What replaces the mock's header.
5 Reskin before or after C and D.

---

## Follow-up, the same day, verbatim

The session answered D3 (what hunt is, and options a to c: keep it, hunt 1
and advance 2, or a new boss-only "stalk 3") and read back C1 and C4, C6,
D2/D9/D10 as one reading, D4, D7 and D8. The author's answers:

> hunt should be use-once and trigger at half hp, bringin the monster much closer. player will want to prevent this, and hunt/stalk should do damage if it is close enough. the 'step's should stomp and do damage over tiles its moving through. you can show this as 3 separate animations, kind of like slashes
>
> read-backs:
>
> 1. yes
> 2. yes
> 3. yes, but its shields renew on the second turn
>    1. yes
>    2. yes
> 4. i'm not sure i get this so just implement it and we'll tune after
> 5. 2 uses, use becomes a keyword and can be applied to dig in (show a shovel for flavor) etc
> 6. no diagonals, in a straight line in the correct lane.

The read-backs those answer, as put: 1, each wave starts at 0 MP, and Prep
and Dig In come back every wave with the full reshuffle. 2, the 30-round
loss limit restarts each wave. 3, the Harpoon pins the Colossus for 2
rounds, no moves and every shield gone (base 3 included); pinned, it does
not act but Screams, 1 damage to every tile touching its 2x2 (3.1: 1
damage; 3.2: it hits its own allies too); shields come back when the pin
ends. 4, at C3 its front row is on C3 (it holds C3 and C4) and Stomp hits
C2 in every lane. 5, how many Harpoon uses. 6, Harpoon range: within 3
steps of a boss tile along lanes and rows, the card greyed out until a unit
is in range.
