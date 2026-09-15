# Patch: Carry on does nothing — the soft lock at the event reveal

Filed verbatim, before any work, under protocol 5 of
[`README.md`](README.md). A playtest report rather than a brief, so it is
recorded as it was written.

**Received 2026-09-15**, with three screenshots.

---

## The report, verbatim

> game breaking bug: soft locked at this screen
> help me chase down why. attached are some more screenshots for info for gamestate

---

## The screenshots, described

The images are not in the repository. What they show, transcribed, because the
game state in them is the whole of the evidence the report carries:

**Screenshot 1 — the screen it locked on.** The event screen, on
`pocket-randomizer.vercel.app/#seed=GYMRUN-53145f-UY2SFPQQ`. Stage 4.8,
`gen9customgame`. Corner stamps read `CAVE` top-left and `4 / 8` top-right, so
the run is in segment 4 of 8. Under the title `SOMETHING HAPPENS`, the gate
chips read `Requires Strength` and `your party has the type`, and the prompt is
`A collapsed shaft, and something metallic under the rubble.` —
`cave-collapsed-shaft` in `data/events.ts`, at the `latent` band.

Three choices are rendered, all disabled, with the middle one — `Shift the
rubble by hand`, the Gamble, `Reward: T0 to T2` — carrying the taken
highlight. So the reveal has already run.

The result block underneath is drawn: `Discard one bag item` in red,
`+42 coins` in green, and a `CARRY ON` button. That pair of lines is exactly
`t0-bag-rifled` in `data/eventPools.ts` — `cost: [{ kind: 'discard', count: 1 }]`,
`grant: [{ kind: 'currency', amount: 42 }]` — which sits in the middle segment
band, matching segment 4.

`CARRY ON` does nothing. The run does not advance and the screen does not
change. Recoverable only by a reload.

**Screenshots 2 and 3 — the drawer, opened over the locked screen.** The
read-only party drawer. Slot 1 is `Goodra Lv48`, `DRAGON`, `LEAD`, `Keen Eye`,
159/159 HP, **holding `SHARP BEAK`**. Slot 2 is `Staraptor Lv48`,
`NORMAL`/`FLYING`, `Neutralizing Gas`, 154/154 HP. Screenshot 3 scrolls to the
bottom: a `Relics` row carrying five — `PROSPECTOR'S HAMMER`, `WOODSMAN'S
HATCHET`, `ABYSSAL LENS`, `RUSTED MACHETE`, `TIDECALLER SHELL` — the line
`Read only. Items are assigned on the party screen.`, and the Density and Move
bar settings.

The party is carrying held items. That is the fact the diagnosis turns on.

---

## What is being asked

The report asks for the cause, not for a named fix. It is filed as a patch
prompt because chasing it down changes the tree.

## Scope

Two defects, and the second is why the first is invisible:

1. **The stale item plan.** `ui/app.ts` collects an `ItemPlan` from the party
   screen into `pendingPlan` and spends it at the *next* node boundary,
   unchecked. The plan names item ids against the inventory the screen was
   opened on. Anything the node does to that inventory — an event's `discard`
   or `loseItem`, an item grant that fills the bag, a berry the sim ate —
   leaves the plan naming something the run no longer holds, and
   `items.applyItemPlan` refuses it with a `RangeError`, by design and
   correctly.

2. **The swallowed error.** `ui/app.ts` wraps the whole of `playRun` in
   `catch {}`, on the note that the only non-finishing exit is an abandoned
   pending decision. That is no longer true, and a bare catch cannot tell the
   two apart. Every real failure inside a run therefore ends as a screen with
   the question already answered and no control that advances anything — a
   soft lock with no console error and no way out but a reload.

Out of scope: any change to what `applyItemPlan` accepts. It is loud on an
illegal plan because a silently trimmed backpack replays as a different run,
and that rule stands.
