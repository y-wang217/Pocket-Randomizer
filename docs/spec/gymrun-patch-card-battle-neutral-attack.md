# Patch: card battle sandbox, a Neutral card goes to the Commander unasked

2026-10-09, on `claude/neutral-attack-commander-bug-b3chim`, from `main` at
`2dd6fd6`. Filed **before any change to `src/`**, verbatim, as
[`README.md`](README.md) rule 7 asks. A bug report from the author on the card
battle sandbox, with one phone screenshot of round 1 of the `#test` fight,
saved as
[`assets/card-battle-neutral-attack-screen.webp`](assets/card-battle-neutral-attack-screen.webp),
and the fight's battle log, sent as a second message while the session was
reading, saved byte for byte as
[`assets/card-battle-neutral-attack-log.json`](assets/card-battle-neutral-attack-log.json).

The card battler is outside the design bible by the author's ruling
([`gymrun-card-battle-engine-rulings.md`](gymrun-card-battle-engine-rulings.md)),
so this patch touches no rule of it.

---

## The message, verbatim

> Bug report when i use neutral attack it automatically is used on commander
> Also check this log to see if this makes sense
> Since there are no animations and no order it's hard to know what happened after actions are locked

## The second message, verbatim

The battle log, `cards-0.1.0`, seed `X5A72HUA`, encounter `test`. Its full
text is the asset file above.

## What the screenshot shows

Round 1. The neutral Attack card is selected (teal outline) and already sits
in A Commander's single slot, A's MP reading `0/1`. B Gunner and C Sword
dasher both read `MP 0/0`. No "pick who plays it" prompt was shown.

---

## Follow-up messages, verbatim

Sent in the same session after the first fix (`df03b81`, committed, not
pushed) and the session's read of the log. Filed before any work on them.

> Nondont run it yet

> More fixes: animations and showing turn order
> Card order is play order

> Log play doesn't match my actions. I tried to shield the slash but it didn't work. Check the order of actions resolving
>
> Also show me a log of actions so i can verify
> Amend rule players can move or shoot first and that's part of strategy
> Dont run gates until i give all my feedback

> Do animations before we open the pr and push the riff through

"riff" is read as "diff".
