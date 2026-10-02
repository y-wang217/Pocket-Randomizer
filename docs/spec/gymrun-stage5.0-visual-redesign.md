# Stage 5.0: the V5 visual redesign, master plan

Filed **before any change to `src/`**, per [`README.md`](README.md) rule 7.

2026-09-30, on `claude/hopeful-shannon-kch3gw`.

Pasted by the author with one line, *"oaky big 5.0 visual update here's the
prompt and the visual reference"*, and one image. The image is committed as
[`../design/v5-reference.png`](../design/v5-reference.png), converted from the
WebP it arrived as to the PNG path the prompt names; the pixels are unchanged.

Three name collisions a reader will trip on, recorded here and not fixed in the
prompt:

- **"V5"** already names step V5 of
  [`gymrun-visual-identity-plan.md`](gymrun-visual-identity-plan.md), the battle
  stage built from
  [`gymrun-stage-v5-preflight-reconcile-execute.md`](gymrun-stage-v5-preflight-reconcile-execute.md).
  This prompt is a different thing. The file is named for the author's "5.0".
- **"Stage 5"** already names *Meta and Distribution* in
  [`pokerun-build-spec.md`](pokerun-build-spec.md). This prompt's out-of-scope
  list calls that "Stage 5 meta features". The prompt's own Stages 0 to 5 are
  sub-stages of 5.0 and are written 5.0/0 to 5.0/5 anywhere outside this file.
- **"the 4.10 trunk (`claude/visual-revamp-jb20na`)"** is an ancestor of `main`
  at filing time. `main` carries it and 139 later commits (4.10.1, 4.11, both QA
  passes). Work starts from `main`, which is the newer tree.

---

## The prompt, verbatim

# GYMRUN V5 Visual Redesign: Master Plan

Paste into Claude Code on the 4.10 trunk (`claude/visual-revamp-jb20na`). Commit this file verbatim to `docs/spec/` with a register row before doing anything else. The reference image is `docs/design/v5-reference.png`. Commit it alongside.

---

## PROMPT

You are rebuilding the presentation layer of **GYMRUN** toward the V5 reference image: a GBA-era Pokemon interface with a node map, a staged battle screen, and a card reward screen, all inside one persistent shell.

This is a presentation rebuild. It is not a gameplay change. Read `docs/design/` (bible, milestones, discrepancy register), `docs/generation.md`, `docs/architecture.md`, and the existing `src/ui/` before writing anything.

### Rules that hold across every stage

- `core/` never imports from `ui/`. No `Math.random`.
- **No version axis moves.** `contentHash`, `RANDOMIZER_VERSION`, `RUN_LOG_VERSION`, `AI_VERSION` all stay put. Seeded output byte identical to the pre-V5 baseline, SMOKE24 included, is the regression test for every stage.
- **No engine, no canvas, no framework.** Vanilla TS, DOM, CSS, and SVG for map edges only. No new runtime dependency. If a stage seems to need one, stop and report.
- Attributes, never verdicts. No recommendation, score, ranking, or "best" marker anywhere.
- No animation blocks input. Reduced motion resolves everything instantly.
- The reference image is a direction, not a spec. Where it shows mechanics GYMRUN does not have, the game wins. See "Where the reference is wrong" below.
- Stop for review at the end of every stage. One PR per stage. Re-record visual baselines once per stage, at the end, not per commit.

### Rulings already made

1. **Phone first.** The game frame is a portrait column designed for 390x844. Desktop is the same frame plus a sidebar. Not the reverse.
2. **Density modes are retired.** One presentation. The visual language replaces the text that Simple, Detailed and Pocket were rationing. Delete the setting and its branches in Stage 2, do not leave it behind a flag. The rule that survives: no fact is removed, a fact that leaves the face of a screen must be reachable in one tap through the existing inspect layer.
3. **No Legend.** Icons explain themselves, with inspect on tap. Recent Events and Run Progress exist only in the desktop sidebar.
4. **Moves first.** The battle screen rests on the 2x2 move grid. Switch and Info are secondary buttons. There is no Battle button, no Bag, no Run, no EXP bar.
5. **Nodes carry tier and capability.** The map must show each node's type, its tier, and for events the required capability and whether the party holds the relic.
6. **Own names.** Locale name instead of "Route 3". Team slots follow the shipped unlock schedule.
7. **Branching edges are out of scope.** The current model (each step offers 2 or 3 nodes, any node leads to any node in the next step) is rendered as a graph with no generation change. True sparse edges are a later gameplay stage with its own benchmark row.

### Where the reference is wrong

Do not build any of these: Potion or Great Ball rewards, a Run action, a Bag action in battle, an EXP bar, "Route N" naming, a Poke Ball logo, a permanent Legend panel, six fixed team slots, desktop-first layout.

---

## Assets

Three classes. Only the third needs someone to make something.

**A. Sourced at runtime from the Showdown CDN via `@pkmn/img`. Host nothing.**

| Asset | Use |
|---|---|
| Pokemon front sprites, one consistent pixel style | Opponent in battle, cards |
| Pokemon back sprites, same style | Player side in battle |
| Pokemon mini icons | Team slots, sidebar, map marker fallback |
| Item icons, including TM discs by type | Reward cards, shop, bag |
| Trainer sprites | Gym leaders, player marker |

**B. Drawn in CSS. No files.**

Panel and window borders, buttons in four states (rest, pressed, selected, disabled), HP bars, HP boxes, platform ellipses under sprites, band pips, tier pips, the selection cursor, type badges, locked and visited node states, travelled and dashed map edges (SVG).

**C. Original art, committed to `src/ui/assets/`, outside `src/data/**` so `contentHash` does not move.**

| Asset | Count | Notes |
|---|---|---|
| Map backdrops | 8, one per locale | Portrait. Terrain only, no painted roads, since paths are drawn over it. |
| Battle backdrops | 9, one per locale plus gym | Landscape. Sky, horizon, ground. No baked-in platforms. |
| Node icons | one per node type that exists in the codebase | Wild, trainer, rest, shop, event, gym. Count from the code, not from this list. |
| Capability glyphs | one per capability in `data/capabilities` | Shown on event nodes and relic cards. |
| Relic icons | one per relic in `data/relics` | |
| Nav icons | 5 | Map, Team, Bag, Run Info, Settings. |
| Currency icon | 1 | |
| Wordmark | 1 | Original. No Poke Ball. |

All class C art is true pixel art at a fixed native resolution, scaled by whole multiples with `image-rendering: pixelated`. Stage 0 picks the native sizes.

**Placeholder rule.** Art never blocks code. Every class C slot ships first as a placeholder (a flat locale tint for backdrops, a lettered chip for icons). One manifest, `src/ui/assets/manifest.ts`, maps keys to files. Swapping a placeholder for real art is a one-line manifest edit and a file drop, with no code change.

**Open: who makes class C.** Not yet decided. Build every stage against placeholders until it is.

---

## Stage 0: Spike and audit. No production code.

Build throwaway static pages under `spike/`, not wired into the app.

1. A battle screen at 390x844 and 1366x768: real front and back sprites, one placeholder backdrop, CSS borders, HP boxes, 2x2 move grid.
2. A map for five seeds, drawn from `previewRun`: nodes in step rows, player marker, travelled path solid, edges from the current node dashed, future nodes without edges.

Report:

- **Sprite coverage.** For every species in the pool, does a front and a back sprite exist in the chosen style? List the gaps and the fallback.
- **Native resolutions** for map and battle backdrops, and the scaling rule that keeps pixels square on a 3x phone and a 1x desktop.
- **Map fit.** Does the longest segment in the node curve fit in the frame at 390x844 with no scroll and 44px touch targets? If not, say what gives.
- **Density inventory.** Every place that reads the density setting, including tutorial anchors and the heights gates.
- **Conflicts** between this plan and the design bible or milestones, added to the discrepancy register.

**Outcome:** two screenshots per page that I can open on a phone and judge against the reference, plus the five answers. Nothing merged into `src/`.

## Stage 1: Tokens, shell, and density removal

- One set of CSS variables: panel fill, dark border, highlight, selected, disabled, HP green, yellow, red. Low radius, no gradients, no shadows, no `backdrop-filter`.
- Shared primitives: panel, window, button, tab, sprite frame, HP bar, mini slot. Existing shared components are restyled, not duplicated.
- The shell: compact top nav with Map, Team, Bag, Run Info, Settings. The tabs open the existing party, backpack, summary and settings surfaces. Do not build second copies of those screens.
- Desktop, 1024px and wider: the portrait game frame plus a sidebar holding run progress, current team, and recent events. `100dvh`, no page scroll at 1366x768, 1440x900, 1920x1080.
- Delete the density setting and every branch on it. Re-anchor tutorial coach marks against the single layout.
- Asset manifest with every class C key present as a placeholder.

**Outcome:** every existing screen renders inside the new shell with the new borders and nav. Layouts inside the screens are unchanged and may look plain. Nothing scrolls the page on desktop. The density toggle is gone. The game plays start to finish exactly as before.

## Stage 2: Battle screen

- Stage area with backdrop keyed to the current locale, or the gym backdrop at a gym.
- Opponent HP box top left, opponent sprite upper right. Player back sprite lower left, player HP box lower right. CSS platform ellipses under both.
- HP boxes show name, gender, level, HP bar, HP number for the player side, status, and non-zero stat stages.
- Below the stage: the 2x2 move grid as the resting state, each button keeping type, category, PP, band pips, and the effectiveness marker. A secondary row with Switch and Info.
- The existing flag strip and beat animations keep working in their new positions. The full log moves behind Info.
- A missing sprite or backdrop falls back to a placeholder of the correct size, never a broken image.

**Outcome:** on a phone, a battle looks like the middle panel of the reference with the move grid where the action bar is. Everything needed to pick a move is on screen with no scroll. A full fight plays with the existing animations. Run the WebKit suite and test on a real iPhone before review.

## Stage 3: Reward, result, and shop cards

- One card component: icon, name, quantity if any, band pips for moves, one short effect line. Tap to inspect for the rest.
- Reward screen: three cards in a row, selection cursor on the picked card, confirm to claim. Gym clears keep their two pages.
- Result screen and shop reuse the same card. Capture cards keep the coverage line.
- Desktop sidebar shows run progress, team, and recent events beside the cards.

**Outcome:** the reward screen matches the right panel of the reference with GYMRUN's real rewards in it (TMs, held items, berries, relics, gold). A reward can still be claimed exactly once, and a refresh mid-claim does not duplicate it.

## Stage 4: Map

- The current segment renders as a graph inside its locale backdrop: one row per step, 2 or 3 nodes per row, gym node at the end.
- Node positions are presentational, derived in `ui/` from a hash of the node id plus a per-backdrop slot grid. No RNG stream, no core change.
- Each node shows its type icon, tier as pips, and for events the capability glyph with a held or not-held state.
- Player marker sits on the current node. Travelled path is solid. Edges to the next step are dashed. Later steps show nodes with no edges. Visited nodes are dimmed.
- Only next-step nodes are tappable. Keep the current commit behaviour and report what it is.
- Locale select: cards show a crop of that locale's map backdrop, the name, four type badges, and the gym identity.

**Outcome:** the map looks like the left panel of the reference: a trainer standing on a node, dashed paths to the next choices, the gym waiting at the end, the whole segment visible at once on a phone. A player can read tier and capability off the node before committing.

## Stage 5: Art pass

- Replace placeholders with real class C art through the manifest only.
- Tune per-backdrop slot grids so nodes sit on plausible ground, not in water or on rooftops.
- Check HP box and text contrast against every battle backdrop.
- Report total added bytes and first-load impact.

**Outcome:** no placeholder remains. Eight locales are distinguishable at a glance on the map and in battle. Side by side with the reference, the remaining differences are deliberate ones from the rulings above.

---

## Tests required

1. Seeded output byte identical at every stage. All four version axes unmoved.
2. Fit gate: every decision surface fits 390x844 with no scroll. No page scroll at the three desktop sizes.
3. Every manifest key resolves to a file, and every node type, capability and relic in the data has a manifest key.
4. A missing sprite or asset renders the fallback at the correct size.
5. No `<canvas>` in the app and no new runtime dependency, asserted.
6. No symbol reads a density setting after Stage 1.
7. Only next-step nodes accept a tap. Reward claims exactly once across a reload.
8. Tutorial coach marks all resolve an anchor in the new layout.
9. All existing suites pass. Tests asserting density behaviour or old layout heights are updated with a comment naming this plan, not deleted silently.

## Out of scope

Branching edges and any generation change. Balance. New mechanics. Audio. Procedural terrain or tilemaps. Attack animations beyond what exists. Stage 5 meta features.

## Defaults I am taking, flagged for review

- Density modes are deleted, not hidden.
- Branching edges are deferred to a separate gameplay stage.
- Class C art source is undecided, so every stage ships on placeholders.
- The top nav tabs replace the single shell-level drawer button on all viewports.
