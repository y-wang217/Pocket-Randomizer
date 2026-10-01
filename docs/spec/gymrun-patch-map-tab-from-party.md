# Patch: the Map tab from the party screen goes back to the map

**Filed after the fix, not before it.** [`README.md`](README.md) rule 7 asks
for the prompt to be committed before any change to `src/`; this session wrote
the fix first and files the report in the same commit. Recorded here so the
order is not mistaken for the protocol.

2026-10-01, on `claude/map-tab-from-party`, from `main` at `9f8f45c`, against
production on an iPhone. Filed as written, with the screenshot it arrived with
([`assets/patch-map-tab-from-party.png`](assets/patch-map-tab-from-party.png)).

---

## The message, verbatim

> Bug report going to team and coming back to map breaks it both visually and i cant press anything

## The session's reading

Reproduced at 390x844: map screen, Team tab, Map tab. Team from the map opens
the writable party screen (Stage 5.0/1's one writable tab route). Map from
there was not "the tab of what is on view", so it opened the map **readout**
over the party screen: the overlay that renders the graph with no `onChoose`,
whose nodes are divs by construction (`ui/map-drawer.ts`). The router stayed
on `party`. That is the "can't press anything": the player was looking at the
readout, not the map, and the only way to the real map was the party screen's
own back control under the overlay. The readout also leaves out the map
screen's chrome, which is the "visually" half.

The fix: the Map tab pressed on the party screen, when that screen was opened
from the map and no rest or shop is waiting on its answer, does what the
party screen's back control does when nothing is armed, `showScreen('map')`,
with the held plan untouched. From the pre-gym screen, or with a boundary
waiting, it still opens the readout, as from any other decision.

Presentation and routing only: no `core/` change, no version axis moves, no
bible rule changes. The rules touched are the shell nav's guard (a tab
opened over a pending decision is a readout), which still holds, since this
path runs only when nothing is pending.

Test: `test/visual-shell-nav.test.ts`, the map-to-team leg now presses Map
and asserts the routed map with pressable nodes, no readout, and an unchanged
saved log.
