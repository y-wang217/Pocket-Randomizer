# Patch: a tap opens inspect on a phone, and the panel it opens never closes

Filed **before any change to `src/`**, per [`README.md`](README.md) rule 7. The
reproduction below was found before the filing and the fix was not started until
after it, which is the line rule 7 draws: a session may look, it may not build.

2026-09-22, on `claude/playtest-tooltips-closing-2pz254`.

A playtest report from the author, in one message with one screenshot. It is
filed as it was written.

---

## The prompt, verbatim

> Okay help me with a bug introduced since starting 4.10 thats preventing
> playtest tooltips dont close. And clicking any movr opens a tooltip that
> blocks the screen

Attached: one screenshot, stamped `12:28`, transcribed below and kept beside
this file as
[`assets/inspect-hover-stranded-panel-battle-screen.png`](assets/inspect-hover-stranded-panel-battle-screen.png).

---

## The screenshot

An iPhone, Safari, at `et-randomizer.vercel.app`. Header `GYMRUN`, `MARSH`,
`1 / 8`, with `TUTORIAL`, `SEED`, `MAP` and `PARTY`. Footer stamp
`GYMRUN-d4e080-KJTDU8Y7`, `0.3.0 · R21`.

`TRAINER BATTLE`, `Trainer's Skitty · Seasoned`. The foe panel reads `1/1`,
`Skitty 14 ♀`, `33 / 42 · 79%`, chips `NORMAL`, `FUR COAT` and a berry icon.

Over the board, an inspect panel titled `GRASSY GLIDE`, with the nine rows the
`move:` tip renders — TYPE, CATEGORY, BASE POWER, BAND, PP, ACCURACY, TARGET,
BEHAVIOUR, DEX. It is drawn above the move bar and covers the stage, the log and
part of the bench.

Beneath it the move bar is visible and unobstructed by anything else: the
`Grassy Glide` card reading `GRASS PHYS 55 BP`, `PP 31 / 32`, and the `Synthesis`
card reading `GRASS STAT — BP`, `PP 8 / 8`. The log line under them reads
`Skitty · Echoed Voice`.

**The panel is open with nothing held.** That is the whole report: the player
tapped a move, the move went, and the explanation stayed on the screen.

---

## What the report is and is not

Two symptoms, and the brief names both:

1. *"clicking any movr opens a tooltip"* — a tap, not a hold, opens inspect.
2. *"tooltips dont close"* — the panel it opens cannot be dismissed by tapping.

**Neither is R5's disconfirmer.** The bible's hypothesis register gives R5 one
kills-it condition — *"any accidental submission during inspect in playtest"* —
and what is reported here is the mirror of it: an accidental **inspect during
submission**. The long press did not spend a turn. The tap did, and opened a
panel as well. So this is a defect in the hover enhancement layered over the
gesture, not evidence against the gesture, and it is fixed rather than amended.

---

## Scope

Presentation only. No `core/` change, no data table, no version axis moves —
`contentHash`, `RUN_LOG_VERSION`, `RANDOMIZER_VERSION` and `AI_VERSION` all
hold. The register is checked for an `active` prompt on the same surface before
work starts.

The report says "since starting 4.10" and does not say which item, so naming the
item is part of the work rather than an input to it.
