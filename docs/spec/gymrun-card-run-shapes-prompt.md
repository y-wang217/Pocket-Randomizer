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
