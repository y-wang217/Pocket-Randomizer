# Patch: card battle sandbox, hearts, bubbles, a mana bar, and a tutorial

Filed 2026-10-10 on `claude/card-battle-hearts-tutorial`, from `main` at
`c40143b`, **before any change to `src/`**, verbatim, as
[`README.md`](README.md) rule 7 asks.

The card battler is outside the design bible by the author's ruling
([`gymrun-card-battle-engine-rulings.md`](gymrun-card-battle-engine-rulings.md)),
so this patch touches no rule of it. Scope is the card battle sandbox only.

## The brief, verbatim

> Patch for improvement in visuals:
> Hp can be hearts
> Shield can be bubbles
> Shield up should be visible on the mon
> Mana can actually be a bar that maxes out at 5 but shows an indicator for what they need to cast their ult (4/5 bars for moon strike eg)
> Also implement a tutorial the same way we did for gymrun. This one should be interactive and show the placement, moves, card slots and defeat a dummy (literally target dummy) enemy

## How it is read

- "Hp", "Shield", "Mana" are the sandbox panels' HP, Sh and MP lines.
  "The mon" is the piece on the board: a unit's or an enemy's token.
- "Their ult" is the unit's most expensive card: Moon Strike (4) for the
  Commander, Artillery (4) for the Gunner. The Sword dasher has no card above
  1 MP, so it shows no mark until one is named.
- "The same way we did for gymrun" is GYMRUN's coach marks (`ui/tutorial.ts`):
  a panel anchored to the real element, tap to advance, Skip on the first,
  shown once on first open and reachable again from the menu. "Interactive"
  means the steps that ask the player to act wait for the act, on the real
  board, rather than advancing on a tap.
- The dummy is a new enemy, the Target Dummy, which never moves or attacks,
  in a tutorial scenario of its own, outside the scenario list and the bench.
