# Patch: the starter painting fills the page, not the screen

Filed **before any change to `src/`**, per [`README.md`](README.md) rule 7.

2026-10-01, on `claude/sleepy-dijkstra-tp2176`, in reply to the build of
[`gymrun-patch-starter-backdrop.md`](gymrun-patch-starter-backdrop.md), which
put the author's painting inside the game frame behind the starter cards.
Filed as written.

---

## The message, verbatim

> no i'm not a fan of the backgroudn in your implementation. my goal is to have an asset fill the whitespace in the background, which is still empty. undo this last change. it makes the UI too cluttered.

No image: the painting is the one already filed,
[`assets/stage5.0-starter-backdrop.webp`](assets/stage5.0-starter-backdrop.webp).

## The session's reading

1. **Undo**: the in-frame backdrop is reverted whole (commit `20a333b`); the
   starter screen inside the frame is as it was before it.
2. **"The whitespace in the background"** is the page outside the game frame:
   the World layer (bible section 5, *World*), which is empty until a region
   is chosen, so the starter screen sits on a flat page. The painting fills
   that layer while no region's scene is up, on the starter screen and the
   region picker, the two screens before the first region; once a region is
   chosen its own World takes over, as today. Nothing inside the frame
   changes.
