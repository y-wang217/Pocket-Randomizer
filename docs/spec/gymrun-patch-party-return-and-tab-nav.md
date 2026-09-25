# The party screen's way out says "Return", and a tabbed thumb-nav prototype

Filed 2026-09-25 on `claude/learn-move-cancel-wording-kdjkaa`, before any work,
following the learn-move cancel wording note on the same branch.

Two asks in one message, both on the party ("Manage") screen. The second is
explicitly a rough prototype to feel the navigation on a phone, not a finished
surface.

---

## 1. The brief, verbatim

> one more copy needs changing. the 'learn move' screen that opens the party,
> sharing the page when user clicks manage, permanently the back out says
> 'return to gym' which isn't true. the logic is correct. it just needs to
> simply say 'return' so that the player is not jarred by it not being the gym
> also, despite this being a browser game, the scrolling on mobile absolutely
> sucks. better to create a sub-folder viewing. so 'manage' then only show the
> lead mon. separate buttons at the bottom to see mons, items, tms
> actually, each of them could be a scroll in itself (don't scroll the
> screen). then, you click through to show the detailed stats.
> Scope this out and don't need to make it pretty. I just want ot feel the new
> menu nav to see if it's easier on my thumbs physically

---

## 2. What is built from it

**The label.** The string in the code is "Back to the gym" / "Back to the
map", chosen in `src/ui/app.ts` from `partyReturn`, which is never reset after
a pre-gym visit, so the teach boundary and every Teach round trip inherit the
gym label. The routing is right; only the promise is wrong. The button becomes
`Return` from `PARTY_COPY` in `src/ui/copy/screens.ts`, and the `backTo` prop
goes, so `npm run copy-audit` sees the one string.

**The prototype.** `src/ui/screens/party.ts` keeps its working-copy model and
every renderer, and changes the container: a title, a panel host, and a bottom
bar of four buttons — `Mons`, `Items`, `TMs`, `Return`. Manage lands on the
lead's card; `Mons` is a list of compact rows that click through to a member's
card; `Items` is the backpack and relics; `TMs` is the TM shelf. The screen
clamps to the viewport and each panel scrolls inside itself. At a teach
boundary the screen lands on `TMs`. No `core/` change, no version axis moves.
