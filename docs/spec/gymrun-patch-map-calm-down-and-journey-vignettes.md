# Patch: Map Calm-Down and Journey Vignettes

2026-10-07, on `claude/vibrant-sagan-bg399f`, from `main` at `371dcfe` (PR #99).
Filed **before any work**, verbatim, as [`README.md`](README.md) rule 7 asks.
The prompt's own first step is a report and a hard stop.

---

## The prompt, verbatim

# GYMRUN Patch: Map Calm-Down and Journey Vignettes

Paste into Claude Code on the current V5 trunk. Commit this file verbatim to `docs/spec/` with a register row before doing anything else.

---

## PROMPT

You are patching the presentation layer of **GYMRUN**. Read `docs/design/` (bible, milestones, discrepancy register), the V5 master plan in `docs/spec/`, `docs/generation.md`, and the existing `src/ui/` map and screen router before writing anything.

Two problems, one direction.

1. **The map is too busy and does not read.** It looks like a graph laid over a painting. Node types are hard to tell apart, and the player cannot see at a glance where they can go.
2. **The run has no connective tissue.** Map, battle, shop and rest feel like separate apps. The fix is visual storytelling: a short illustrated beat between screens that tells the player, in a picture and a few words, what kind of moment they are entering.

Starter select is judged good. Do not touch it.

### Rules that hold

- Presentation only. No version axis moves: `contentHash`, `RANDOMIZER_VERSION`, `RUN_LOG_VERSION`, `AI_VERSION` all stay put. Seeded output byte identical, SMOKE24 included, is the regression test.
- `core/` never imports from `ui/`. No `Math.random`. No canvas, no engine, no new runtime dependency.
- Attributes, never verdicts. Vignette captions are flavour tied to the node TYPE, identical for every node of that type, and appear only AFTER the player commits. They never compare, rank, or recommend one option over another.
- No animation blocks input. Every beat is skippable by tap. Reduced motion shows the vignette as a static frame, still skippable.
- Phone first, 390x844. Decision surfaces fit with no scroll.
- Art never blocks code. Every new asset ships first as a placeholder through `src/ui/assets/manifest.ts`.

### Report before you write any code

1. Which V5 master plan stages are merged on this tree, specifically Stage 4 (map) and Stage 5 (art pass). Are map nodes still placeholder chips?
2. A screenshot of the current map at 390x844 for three seeds, plus a list of every visual element on it (backdrop, edges, node icons, pips, glyphs, labels, marker, chrome) with its size and colour.
3. Hypothesis to check: the map reads badly because the backdrop competes with the nodes at equal contrast, and because every step renders at equal weight. What would disconfirm it: nodes still blur together when the backdrop is replaced by a flat colour. If so, the problem is node design, not backdrop, and say so.
4. Where per-screen transitions currently happen in the router, and whether one seam exists that every map commit and every node completion passes through. The end-of-battle hold fix used a single seam; reuse that pattern.
5. Where display copy that must not move `contentHash` lives today (the displayTuning precedent). Vignette captions go there.

Stop and report. Do not proceed until reviewed.

---

## Part 1: Calm the map

Goal: the map passes a five-second test on a phone. Where am I, what can I tap next, what type is each option, where is the gym.

- **Push the backdrop back.** A flat overlay at reduced opacity over the locale backdrop, value in `displayTuning`. The backdrop sets mood, it does not compete. No `backdrop-filter`, no blur.
- **Three weights only.**
  - Next-step options: full size, full colour, the only tappable things.
  - Current node and travelled path: solid, with the player marker.
  - Everything later: small, desaturated, no edges. Visited: dimmed further.
- **Node types distinct by silhouette, not only by icon.** Each node type gets its own shape and its own colour token, so a player can tell rest from battle at thumbnail size without reading the glyph. Count types from the code. Gym is the largest and visually unique.
- **Fewer edges.** Draw only travelled path and edges from the current node to the next step. No other lines.
- **Keep what is decided.** Tier pips and the event capability glyph stay on nodes. No legend, no hover. Inspect on tap stays the route to detail.
- Remove anything from the report inventory that is not one of the above. Report what you removed.

## Part 2: Journey vignettes

A vignette is a small pixel illustration plus a caption of at most five words, shown as a brief beat at a transition.

**When they play**

- On map commit, before the node screen opens, keyed to the node type entered.
- On return to the map after a node resolves: the "where to go next" beat, which ends with the map scrolled to the current step.
- On gym entry: its own vignette, distinct from trainer battles.

**Starting caption table, in the display copy file, all editable**

| Moment | Caption |
|---|---|
| Return to map | Where to next? |
| Wild battle | Something stirs |
| Trainer battle | Prepare yourself |
| Gym | The leader awaits |
| Shop | Stay safe, spend wisely |
| Rest | Rest and improve |
| Event | Something unusual |

Charlie's own lines are "where to go next", "stay safe, spend your money", "prepare yourself", "rest and improve". Tune the rest to match their voice. Captions stay short: the picture carries the meaning, the words only confirm it.

**How they look**

- The vignette sits on a crop of the current locale's map backdrop, so the same "Rest and improve" reads differently in Cave and in Shore with no extra art.
- The illustration is one sprite per moment, class C art, through the manifest. Placeholder first: a lettered chip of the correct size on the locale crop.
- Where an existing sprite fits, use it instead of new art: trainer sprite for gym and trainer, the lead party member's sprite for return-to-map and rest.

**Timing**

- One duration in `displayTuning`, starting at 900ms. Tap skips immediately.
- A setting to turn vignettes off, in the existing settings store. Default on.
- Reduced motion: static frame, same tap to skip.
- The headless path never runs any of this. Assert `core/` has no timers and `playRun` completes under Node unchanged.

## Part 3: Make node screens match their vignette

Each node screen carries a thin header using the same colour token and silhouette as its map node and vignette, so map node, vignette, and screen read as one thing. Header shows the node type name and locale name. Nothing else is added to the screen.

---

## Assets needed (for Charlie to generate)

One sprite per vignette moment above, seven total, transparent background, true pixel art at the native size you pick in the report. Write the exact pixel size and a one-line art brief per sprite into the report so the art can be generated to spec.

## Tests required

1. Seeded output byte identical, all four version axes unmoved.
2. Map at 390x844: every next-step node tappable at 44px or more, nothing else tappable, no scroll needed to see the decision.
3. Every node type has a distinct silhouette and colour token, asserted from the type list in code.
4. Every vignette moment and node type has a manifest key and a caption; missing art renders the placeholder at the correct size.
5. A vignette never blocks input: tap during it skips, and a tap cannot fall through to the screen underneath.
6. Vignettes off in settings skips every beat; reduced motion shows static frames.
7. Every map commit and node completion passes through the one transition seam, so no screen can skip its vignette by accident.
8. Captions live outside `contentHash`; editing one does not move the hash.
9. All existing suites pass. Tests asserting old map visuals are updated with a comment naming this patch.

## Out of scope

Starter select. Branching edges or any generation change. Revealing node contents before commit. Any caption that differs between two options of the same type. Audio. New mechanics.

## Definition of done

On a phone: the map reads in five seconds, with the next choices obviously brighter than everything else and each node type recognisable by shape. Choosing a node plays a short illustrated beat that says what kind of moment is coming, set in the current locale. Finishing it plays "where to next?" and lands on the map at the current step. The run feels like one journey instead of separate screens.
