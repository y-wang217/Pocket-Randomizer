# Patch: the flash on the card battle's sprites when a card is clicked

2026-10-12, on `claude/card-sprite-flash`, from `main` at `e29376b`.
Filed **before any change to `src/`**, verbatim, as [`README.md`](README.md)
rule 7 asks. A bug report of one sentence, then an investigation, then the
author's go-ahead. The investigation changed no file; its findings are
summarised below because the go-ahead refers to them.

---

## The message, verbatim

> Ug report theres this ugly flash that happens on all the spritesbwhen i click a card. Can you investigate?

## The go-ahead, verbatim

> go ahead and file the bug report and build and test the fix

## What the investigation found, as reported before the go-ahead

The card battle (`src/ui/cardbattle/`) draws every sprite as a CSS
background (`cardAsset` in `assets.ts`), and nothing loads an image before the
screen first draws it. A card click adds pieces the board has not drawn yet in
this battle: a reticle on every unit that could play the card, the selected
card's overlay, the filled slot, the selected ring. Each paints empty for a
frame and fills in when its image arrives, which on a phone is a network round
trip.

Measured in headless Chromium against the production build, with 150ms of
latency added to every image request, six runs each:

| | first card click |
|---|---|
| as shipped | 5 of 6 paint a late frame about 150ms after the click |
| preloaded with `new Image()` | still flashes: Chromium fetched the selected ring a second time for the CSS background, under the preview server's `Cache-Control: no-cache` |
| each image drawn once as a CSS background in a hidden holder kept for the battle | 6 of 6 clean, no late frame, no second request |

Proposed fix, the third row: a hidden holder of every asset in use, drawn when
the battle opens and kept until it closes. Presentation only; no fact is shown
or removed.

Unverified and said so: every render rebuilds every sprite element, which
Chromium paints cleanly once the image is cached. WebKit was not available to
the session. If the flash is on every click on an iPhone, not just the first
of each kind, that is a second cause and this patch is not claimed to fix it.
