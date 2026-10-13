# Floor 2: new enemies, root and frail, Cleanse, melee into the end zone, and a skin

**2026-10-13. Built** after the author's go-ahead (`../generation.md` section 149), with one change: the Reaver is not Fast, see below.
For [`../spec/gymrun-patch-card-run-floors-commander-card.md`](../spec/gymrun-patch-card-run-floors-commander-card.md),
its last message. Every number is a first draft.

## 1. Two statuses, on player units

| status | what it does | how long |
|---|---|---|
| **Root n** | the unit cannot move: no Move card for it (it shows *Rooted*), and no Command can move it | `n` of its turns, counting down at each turn start |
| **Frail n** | shields from cards give it nothing; its base shield still works | the same |

Only enemies put them on, through their attacks, and only on a unit the attack
hits. A second Root on a rooted unit takes the longer of the two, so it never
stacks past what the enemy wrote. Each shows as an icon with its turns left on
the unit's panel and token.

## 2. Cleanse n

**Cleanse n:** every living ally's Root and Frail lose `n` turns. Two cards carry it:

| card | owner | MP | does | upgrade | where |
|---|---|---|---|---|---|
| **Cleanse** | any | 1 | Cleanse 2 | Cleanse 3 | the reward pool, in the Puppeteer's shape (the support cards) |
| **Antidote** | any | 0 | Cleanse 9, then gone for the run | none | a City item from floor 2, like the other equipment |

## 3. Three new enemies, floor 2 on

They hit harder and come faster than floor 1's. They lead floor 2's waves
beside the veterans, and floor 3's too.

| enemy | HP | base | Fast | script, one step a round, looping |
|---|---|---|---|---|
| **Snarer** | 3 | 1 | yes | Hunt, Strike 1 and **Root 2** · Advance, Shield 1 |
| **Breaker** | 4 | 1 | no | stay, Pierce 2 and **Frail 2** · Hunt, Strike 2 · stay, Shield 1 |
| **Reaver** | 3 | 0 | no (built) | Hunt, Strike 2 · Hunt, Strike 2 · Advance, Shield 1 |

Each keeps one step that deals nothing, which opening grace needs. The Reaver
is the "faster" one: two hits out of every three rounds. **As built it is not
Fast:** the game's rule is that a Fast enemy attacks from round 1 for 1, and
the Reaver hits for 2, so it waits out opening grace like any other.

## 4. Melee into the end zone

Today a unit's reach stops at column 5, so a Slash from there touches column
6 and nothing ever reaches the top row, column 7.

- **A melee unit (the Sword dasher) may move into the end zone**, columns 6
  and 7, onto a free tile. Ranged and special units still stop at 5.
- **It may Slash from there**: from column 6, the Slash hits column 7.
- **It is repelled**: right after a card of its deals damage in the end zone,
  it is pushed straight back to column 5 in its lane (or the nearest free tile
  short of it). A unit that ends the plan in the end zone without hitting is
  pushed back too. No enemy ever acts against a unit standing there.

So reaching the top row takes a Move and a hit in the same turn: two MP,
which is the cost the author asked for.

## 5. The floor 2 skin

Floor 1 stays the meadow. Floor 2 gets its own battle background and tiles, a
dusk-lit ruined fort, and the new enemies get their own sprites. The asset
prompt is [`floor-2-asset-prompt.md`](floor-2-asset-prompt.md).

## Version and balance

Every part moves `cards-` and `cardrun-` on, and each is benchmarked as it lands.
