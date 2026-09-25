# The learn-move decline confirm says "Cancel", not "Forfeit"

Filed 2026-09-25 on `claude/learn-move-cancel-wording-kdjkaa`, before any work.

A playtest note in one message, filed as it was written. One word, on one
surface: the confirm band behind the teach screen's `Don't learn it`.

---

## 1. The brief, verbatim

> Also "forfeit" is wrong its cancel on the learn move but then change your
> mind. Flow is correct but word is wrong thats all.

---

## 2. What is built from it

Copy only. The three `TARGET_COPY` strings the band reads in
`src/ui/copy/screens.ts` — title, confirm, cancel — become `Cancel learning?`,
`Cancel` and `Keep`. The flow, the band, the move card inside it and the
`TEACH_CANCELLED` decision are untouched. No version axis moves: `ui/copy/` is
outside `src/data/`, so `contentHash` does not see it.
