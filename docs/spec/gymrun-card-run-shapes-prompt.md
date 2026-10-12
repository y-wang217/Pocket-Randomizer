# Card run: no healing between waves, new reward cards, a basic starting deck, and deck shapes

2026-10-11, on `claude/card-run-shapes`, from `main` at `cf496bd`
(`cards-0.5.0`, `cardrun-0.1.0`). Filed **before any work**, verbatim, as
[`README.md`](README.md) rule 7 asks.

The message refers to "the group a and b cards". Those were proposed by the
session in its answer to the author's previous message, so that message and
the two tables it refers to are filed here first, marked as the session's, for
the referent. Only the author's two messages are the request.

---

## The author's previous message, verbatim

> Help me fill in some holes. I want a few new cards
> What parts in the design currently have the most holes? And check storage for latest it should be 0.3?

## The session's proposal it answered with (the referent, not the request)

Group A, built from the existing effect vocabulary, data only:

| Card | Owner | Cost | Effect | Fills |
|---|---|---|---|---|
| Whirlwind (ult) | Dasher | 4 | Move 1, Slash 3 | his missing ult |
| Rally | Commander | 2 | Grant Move 1, Shield 1 ally | Commander tempo |
| Mark Target | Commander | 1 | Strike 1, Target 1 | a Commander damage option |
| Suppress | Gunner | 3 | Blast 1, Target 1, Shield 1 self | Gunner defence |
| Second Wind | Neutral | 1 | +1 MP, next hand +1 | draw |
| Flashbang (equipment) | Neutral | 0 | Blast 1, next hand +1 | market variety |

Group B, the reserved effects, each needing a resolver:

| Card | Effect | Fills |
|---|---|---|
| Shove (Dasher) | Slash 1 + push 1 | board control |
| Grapple (Neutral equipment) | pull 2 | drag a back-line Sniper or Turret into reach |
| Patch Up (Commander) | repair 1 | the only heal |
| Smoke (Neutral equipment) | stealth 1 turn | dodge a telegraphed Strike |

## The message, verbatim

> Okay so lets stop healing in between waves:
> 3 encounters and cards reset but hp shields and mp dont
> New enemies spawn once last enemy of prior wave is defeated.
> That should increase difficulty
> Then lets implement the group a and b cards as rewards
> Does that bridge the gap?
> What else is a big mover for the game state?
> Cards overstuffing the deck feels bad. We should start with a basic deck that doesnt do anything fancy and remove ranger's pierce for an upgrade
> Commander's move others and give shield are both really strong cards and the puppeteer archetype is one of the end states i like for these units but the dream is to have it shape differently if you want eg
> Slasher builds tanky and blocks for commander to only have nukes and mana
>
> Or commander helps ranger move to danger zone and slasher defends but ranger lays massive artillery
>
> Or ranger builds support with equipment and helps cc enemies while slasher aoes them down
>
> These are all shapes of the deck and gives variance. Enemies should scale in hp and attack patterns. Lets do a runthrough for getting these ideas online

## The author's answers to the runthrough's section 7, verbatim

Filed before any build work. The questions are
[`../reports/card-run-shapes-runthrough.md`](../reports/card-run-shapes-runthrough.md)
section 7, Q1 to Q5 in order.

> A
> Yes
> A each new fight (3 waves)
> Replace user chosen
> Yes lets try it

Read as: Q1 (a), every fight node is three waves back to back with HP carried
inside it. Q2 yes, the units stay where they stand and the next wave spawns
at once, under grace. Q3 full HP at each new fight. Q4 a card reward replaces
a card the player chooses. Q5 cover and stun are built.

## The author's go-ahead for checkpoint 2, verbatim

Filed before any checkpoint 2 work.

> Yes go for step 2. Everything we take away we give back in appropriate upgrades

## The author's go-ahead for checkpoint 3, verbatim

Filed before any checkpoint 3 work.

> Go ahead

## The author's go-ahead for checkpoint 4, verbatim

Filed before any checkpoint 4 work. The session's question it answers offered
Group B's four effects and, optionally, a move that also strikes or shields,
for Whirlwind and Rally as first drafted.

> Go ahead yes

Read as yes to both: Group B is checkpoint 4, and a move carrying a second
effect follows it as checkpoint 4b, each stopped for review.

## The author's go-ahead for checkpoint 4b, verbatim

Filed before any checkpoint 4b work.

> Go for 4b

## The author's go-ahead for checkpoints 5a and 5b, verbatim

Filed before any checkpoint 5 work. The session had offered checkpoint 5
(shapes: cover, stun, talents for every unit, shape cards, shape-aware
offers) split as 5a (cover, stun, talents) and 5b (shape cards and offers).

> Go ahead 5a and b

Read as both, built in turn, each committed at its own checkpoint, with the
stop for review after 5b.

## The author's go-ahead for checkpoint 6, verbatim

Filed before any checkpoint 6 work. The runthrough's section 3.4: enemies
gain HP by act, harder attack patterns from act 2, and a second boss so the
Colossus is not all three.

> Go with step 6

## The author's go-ahead for step 7, verbatim

Filed before any step 7 work, on `claude/card-run-shapes-step7`, from `main`
at `e29376b` (the merge of checkpoint 6). The session that built checkpoint 6
proposed step 7 as the plan below. The author's message pasted that plan back
under a heading of their own, so the message is filed whole. The plan's text
is the session's, not the author's; it is the referent.

> New work:
> Art gaps to be filled
> Here's what I'd do for step 7. It's mostly screens. Steps 1–6 added several things that change your decisions but that you can't see yet, so those come first. Nothing is built; this is the plan.
>
> **A. Facts the player can't see yet (must have)**
> 1. **Push and Pull preview.** When you aim Shove or Grapple, show where the enemy will end up and its new attack. Right now you only find out when the round plays.
> 2. **Veteran marker.** A Dire Hound looks exactly like a Hound but hits every turn. I'd add a small "veteran" badge on the token and its panel, and the veteran's name when you tap to inspect it.
> 3. **Act warning.** On the route screen and the fight strip, show something like "Act 2: enemies +1 HP, veterans join", so the jump in difficulty isn't a surprise.
> 4. **Cover and Stun on the board.** When Guard Duty or Interpose is planned, outline the neighbours it will protect. A stunned enemy's token gets the pinned badge; today only its panel says so.
> 5. **Stealth in the plan.** When Smoke is planned, fade the unit right away and mark the enemy attacks it will dodge. Today that only shows during the replay.
> 6. **Shape plans on a phone.** The one-line plan for each shape is a mouse-hover tooltip, so phones never see it. I'd show it under the shape tag instead.
>
> **B. Making the build readable**
>
> 7. **Deck view by shape.** The existing deck overlay would group cards by shape (Basic, Puppeteer, Bodyguard, Escort, Control) with a count each, so you can see where your build is heading.
> 8. **Replace screen.** Mark your basic cards and list them first, since they're usually what you swap out. It also needs to fit a 390px-wide phone screen without scrolling sideways.
> 9. **Boss screen.** Each talent shows which shape it belongs to, plus the unit's current talents beside the offer.
> 10. **End-of-run screen.** Add the shape you leaned into, the talents you took, and which act you died in.
>
> **C. Loose ends**
>
> 11. **Keyword glossary.** Push, Pull, Repair, Hidden, Cover and Stun get a line each in the battle's Inspect panel.
> 12. **Translations.** New card, enemy and talent names currently show English in the other 7 languages. I'd add machine-drafted translations, marked as unreviewed like the rest.
> 13. **Art list.** A one-page list of every new card, veteran and the Warlord, with the art each one currently borrows. That gives you a shopping list for real art. It's a document, not drawing.
> 14. **Browser tests.** Screenshot tests at phone size for the replace, boss and offer screens, plus a battle with a veteran and a stun. These run in the browser part of the checks.
>
> **Not in step 7:** smarter bot choices (so the benchmark can tell good shapes from bad), and tuning act 2's difficulty. Both are worth doing, but they're separate pieces of work.
>
> My suggestion is A and B as step 7a, and C as 7b. Do you want all of it, or should I drop or reorder anything?

The session asked whether the heading meant the art list alone. The author's
answer, verbatim:

> All of step 7

Read as: 7a (A and B) then 7b (C), each committed at its own checkpoint and
stopped for review, in the plan's order.

## The author's go-ahead for step 7b, verbatim

Filed before any step 7b work. Step 7a was built and stopped for review
(`../generation.md` section 140); the session listed 7b as the plan's
section C: the keyword glossary, translations, the art list and browser
tests.

> Go 7b

## The author's instruction during step 7b, verbatim

Received while the gate ran on step 7b, with 7a and 7b both built.

> Gates dont have to run until end of step 7
> Go and run without me all throughout step 7

Read as: within step 7 the gate runs once, at its end, and the session does
not stop between its parts for review. Step 7 was already built when it
arrived, so the gate then running was that end-of-step gate; its findings are
fixed without a stop.
