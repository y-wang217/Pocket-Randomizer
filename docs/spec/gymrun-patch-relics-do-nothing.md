# GYMRUN Patch: a relic does nothing

Filed before any work, under [`README.md`](README.md) rule 1.

---

## PROMPT, verbatim

> no ignore that now. the stupid event bug means the events don't work at all. which also nullifies relics. fix that first. chase down the cause. play every possible event and event caller

---

## What the chase found, in the order it found it

### 1. The event bug is fixed, and is not deployed

Every event definition, at every band, on every archetype, across every
segment band — **1344 resolutions** — was played through `resolveNode` and
compared against what the screen promises, with exact multiset accounting on
the backpack rather than length checks. **No promise is broken.** Every item
id the pools can pay resolves in `data/items.ts`; all 216 of them.

That is on this branch. **`origin/main` still has `case 'relic': return state`
and the move no-op**, and the build the report came from is stamped
`GYMRUN-1e6f02-…`, which is `main`'s `contentHash`. So "events don't work at
all" is exactly true of the build being played and exactly false of the branch
sitting unmerged in front of it. Nothing needs fixing there; it needs merging.

### 2. Relics really are nullified, and not by the event bug

`core/relics.ts` folds every held relic into a `RelicEffects` — a per-node
heal, per-node currency, a backpack slot, a revive bonus, a shop discount —
and **`applyRelicPassives` has no caller anywhere in `src/`.** It is imported
by two test files and by nothing else. `core/capabilities.ts` imports
`grantsCapability` from the same module, which is why the file looks live.

So a relic does exactly one thing today: it satisfies the capability gate on
an event. Every passive in `data/relics.ts` is inert, including the two that
say so in their own player-facing description —

> Tidecaller Shell: "The sound inside it mends a little at every stop."
> Everburning Lantern: "The party rests easier near it."

— which is the game telling the player something untrue, on screen, for the
rest of a run.

**It is the same defect shape as the two the event rejig found and the two the
playtest patch found:** a fold that is correct at one end, a promise made at
the other, and nothing joining them. Fifth instance. `docs/generation.md`
section 14 and section 15 carry the other four.

## What this patch does

Give each of the five passives the one site it belongs at, and nothing else:

| passive | where it lands |
|---|---|
| `nodeHealPercent` | the node boundary, beside `betweenNodes` |
| `nodeCurrency` | the payout for a won battle node |
| `backpackSlots` | `backpackCapacity`, added to the party-derived slots |
| `reviveBonus` | the revive `betweenNodes` already performs |
| `shopDiscount` | `resolveStock`, which already takes the held set |

One fold, read at five sites, rather than five `hasRelic` checks — the rule
`core/relics.ts` opens with, and the reason it was written as a fold.

## Versioning, and what this is allowed to move

- `RUN_LOG_VERSION` **does not move.** No decision is added, removed,
  reordered or reshaped.
- `RANDOMIZER_VERSION` **does not move.** Nothing new is drawn, and no draw
  moves; this changes how already-drawn state is folded.
- `contentHash` **does not move** unless a table changes.
- **Seeded output does move**, and heavily: a run that holds a relic now plays
  differently from the first node after it. Balance is not a gate
  (`CLAUDE.md`); record the number and keep going.

## Gates

Unchanged, and the one that bites: `test/relic-permanence.test.ts` holds that
exactly one place writes the held set. Reading the fold is not writing it, and
that rule must still pass untouched.
