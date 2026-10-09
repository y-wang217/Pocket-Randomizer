# Patch: card battle sandbox, scenarios, a home-area placement, a wider danger zone, and a bot that learns

2026-10-09, on `claude/wizardly-cannon-l8fktg`, from `main` at `f58835e`.
Filed **before any work**, verbatim, as [`README.md`](README.md) rule 7 asks.
A message from the author on the card battle sandbox, with a battle log pasted
inline, saved byte for byte as
[`assets/card-battle-scenarios-log.json`](assets/card-battle-scenarios-log.json).

The card battler is outside the design bible by the author's ruling
([`gymrun-card-battle-engine-rulings.md`](gymrun-card-battle-engine-rulings.md)),
so this message touches no rule of it.

The message asks for the explanation doc first. It is
[`../handoff/card-battle-log-reading.md`](../handoff/card-battle-log-reading.md).
The mechanics and the bot are not begun.

---

## The message, verbatim

The pasted log is replaced by a pointer to the asset; the asset is the text.

> The game is actually quite fun! here's another log:
> *(the log: `assets/card-battle-scenarios-log.json`)*
>
> translate that to actions or explain to another chat how to read this. then i'll design more scenarios in that chat .
>
> For this one, some new mechanics:
> you should allow user to place units in the homearea.
> also expand the central danger zone to 3x3, so it's harder to cross.
> also, make the enemies not always spawn on the bottom 3. instead, we'll design some scenarios to make it more varied.
>
> also, i won both with some simple strategy. let's design a bot that can actually complete the scenarios competently. strategy should be to always protect units with high hp/shield units, and preserve units as long as possible. defence wins games. also positioning is hard to create an ai for, so i'd love to have a bot run through many times and learn the patterns that do the best, like a TAS type but for turn based much easier to actually win
>
> make sense? start with the explanation doc so I can give the play log to a claude session

---

## Follow-up, verbatim

The session's guide was committed at `691af20` first; it then asked three questions
before building the mechanics: how the board grows to fit a danger zone three
deep, whether units are placed anywhere in the two home rows, and what
"bottom 3" meant. Filed before any work on the answer.

> Danger zone 3 rows tall.
> 2 home rows yes.
> Yes 3 enemies should be positioned somewhere in the 6 available spots, but not always in the 3 closest to the danger zone.

### How the session reads it

The sandbox draws the board with the enemy backline at the top and the lanes
as screen columns (`src/ui/cardbattle/sandbox.ts`), so the author's *rows* are
the engine's columns. The board becomes seven deep: home C1-C2, danger C3-C5,
enemy backline C6-C7. Units are placed by the player on any of the six home
tiles before round 1. The three enemies start on tiles of the six enemy
backline tiles, drawn from the battle's seed when the encounter does not fix
them, so they are not always on the row nearest the danger zone.

---

## Second follow-up, verbatim

Sent after the deployment, board and spawn work was committed at `6afdaa8` and
the session said the bot would come after review. Filed before any work on it.

> go ahead with the bot.
