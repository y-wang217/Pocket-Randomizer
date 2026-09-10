# GYMRUN Visual Identity: Staged Plan

Rev 1. Companion to `gymrun-qol-release-plan-rev2.md`. Seven stages, V0 through V6. Each is a standalone Claude Code prompt. Cheapest and highest impact first.

---

## 1. Answers to the six questions

**Canvas or DOM.** DOM. Three absolutely positioned layers per locale, built from CSS gradients and inline SVG silhouettes, moved with `transform` on scroll. It stays inside `scene.ts`, costs no new rendering path, and respects reduced-motion for free through media queries. What would make me wrong: a scene that needs more than four layers or any per-frame particle system. The check is a Chrome performance trace on a mid-range Android at 390 width with the busiest locale mounted while the map scrolls. If frames exceed 16ms, or paint time exceeds 4ms per frame, move the scene to a single canvas in V3 and keep every layer above it in DOM. The boundary is drawn so that swap costs one file.

**Typeface.** Pixelify Sans, SIL Open Font License 1.1, self-hosted as a latin-subset woff2. OFL permits bundling, embedding, and redistribution with the licence file kept alongside, including in a static site, and does not distinguish commercial from non-commercial. The trap is every pixel face on itch and dafont marked "free for personal use": that grant does not cover serving the font from a public URL, so none of them are eligible. Alternatives named in the flagged defaults. What would make me wrong: legibility of the six-stat block at 12px on a real 390 phone. If it fails, the fallback is a two-face system, Pixelify Sans for display and labels only, a system monospace stack for numbers, and that is a V0 decision, not a later one.

**How far pure CSS carries this.** Through V2. V0 tokens, V1 locale palettes, and V2 world chrome are a stylesheet over the existing DOM with zero new elements. V3 is the first stage that mounts new nodes. The game is fully shippable at the end of V2 and looks finished, just flat. That is the intended stop point if V3 is not worth the cost.

**The battle stage at 390 width.** The persistent multi-line log gives, and the separate sprite stage gives. Sprites live inside the ambient scene rather than in their own box, stat panels float over the scene with no chrome, and the log collapses to a one-line strip holding the most recent event plus the Release C flag words, with a tap-to-expand sheet for history. Pixel budget in V5.

**Audio.** Out through V5. V6 is an optional stage with no music and no audio assets: four synthesized cues from the Web Audio API, off by default, toggle in the cross-run settings store. Music is out of the plan entirely. It is a licensing problem, a bundle problem, and an attention problem, and none of the three references need it to work as screenshots.

**Sequencing against Release C.** Release C precedes V0. Two reasons. It creates the single added-time-per-turn number in `data/tuning.ts` and the reduced-motion handling that V3 and V5 reuse, so building motion before it means building it twice. And it changes the HP bar and adds flag words, which V5 then restyles rather than designs. Absorbing it would land two changes on the battle screen in one diff with no way to attribute a playtest complaint. If Release C slips, V0 through V2 do not depend on it and can go first, but V5 waits.

---

## 2. Rules that hold across all stages

- Presentation only. No change to `core/`, no new file in `data/`, no new RNG draw, no version bump on any axis. `contentHash` is computed over `data/`, so **flavour copy and palette tables live in `src/ui/`, never in `data/`**. The regression test for every stage is seeded run output byte identical to the post-Release-C baseline, SMOKE24 included.
- `core/` never imports from `ui/`. No `Math.random`. No timers in `core/`. `playRun` completes headless unchanged.
- Attributes, never verdicts. Extended to visual weight: no card, option, or node gets a different size, border weight, background, glow, or elevation than its siblings in the same offer. The only permitted colour variance between sibling cards is the type colour of a fact on the card, and type colours render as reduced-saturation outlined chips so they never read as an accent. Offer order is draw order, never sorted.
- One accent colour, spent on the primary action only. The accent never appears on a card, a node, a stat, a badge, or a type chip. If two things on one screen are accent-coloured, one of them is wrong.
- Vertical budget. Each stage states its pixel delta on the two guarded screens: the battle screen with four move buttons above the fold, and the map screen with the current step's offered nodes above the fold. Reference viewport 390x844, usable height assumed 740 after browser chrome.
- Motion never blocks input. Skippable by tap, reduced-motion respected, total added time per turn read from `data/tuning.ts` and never from a second constant.
- No species on the map. No sprites on the map. The map shows node type, tier, and capability requirement.
- No new assets. Sprites resolve through `@pkmn/img`. Everything else is CSS, inline SVG drawn in-repo, or a font.
- Commit at each checkpoint and stop for review.

---

## 3. Stage table

| Stage | Name | Touches | Bundle delta (estimate, measure at end) | Vertical delta |
|---|---|---|---|---|
| V0 | Tokens and type | CSS, one font file | +30 to 60 kB (woff2, one or two weights) | 0 |
| V1 | Locale palettes | CSS | +2 kB | 0 |
| V2 | World chrome | CSS, minor markup | +4 kB | 0, see stamps |
| V3 | Scene layer | `scene.ts`, inline SVG, CSS | +15 to 30 kB | 0 |
| V4 | Run summary as payoff | one screen, `ui/copy/` | +6 kB | n/a, not a guarded screen |
| V5 | Battle stage composition | battle screen layout | +2 kB | negative, reclaims log height |
| V6 | Audio, optional | one module, settings store | +3 kB, no assets | 0 |

---
---

# V0: Tokens and Type

Saturday sitting. Pure CSS plus one font. This stage decides the palette, the face, and the accent rule, and applies them to every screen through variables. Nothing moves, nothing is added, everything looks different.

## PROMPT

You are building **Stage V0** of the GYMRUN visual identity pass. Read `gymrun-visual-identity-plan.md` sections 1 and 2, then `src/ui/` in full. Presentation only. No `core/` changes, no `data/` changes, seeded output byte identical.

### Order of work, stop for review after each

1. Report: inventory every hardcoded colour, font, and size in `src/ui/`. Count them and list the files. Report whether `src/ui/tooltips.ts` hosts exactly one tooltip mechanism after Release B, because V0 styles that mechanism and must not add one.
2. Token file and font. No screen changes.
3. Apply tokens to every screen through variables. Delete every hardcoded value from step 1.
4. Legibility check on a real phone.

### Tokens

Create `src/ui/theme/tokens.css`. Everything below is a custom property on `:root`. No component may use a raw colour, font, radius, or spacing value after this stage.

- **Base.** A near-black with a slight blue cast, a mid surface for panels, a cream for text, a muted cream for secondary text. Four values.
- **Accent.** One saturated colour. It is used by exactly one class, `.primary-action`, and by nothing else. Pick a hue that no Pokemon type chip uses at full saturation. Type chips are rendered outlined at reduced saturation in this stage so the accent is the only solid saturated fill on any screen.
- **Type colours.** Eighteen tokens, taken from the same table the battle screen already uses for effectiveness markers. Do not invent a second table. If the existing table is in `data/`, read it from there; do not copy it.
- **Tiers and bands.** Normal, hard, elite, and bands 1 through 4 get no colour of their own. They render as text in the same neutral chip style. Colouring tiers is a verdict.
- **Spacing and radius.** A 4px spacing scale and two radii. Reference B chrome is square, Reference C chrome is rounded; pick one radius for cards and one for chips and use nothing else.
- **Motion.** One duration token that reads `data/tuning.ts` for its value where the value already exists, and is otherwise 0. V0 adds no motion.

### Typeface

- Add Pixelify Sans as a self-hosted latin-subset woff2 under `public/fonts/`, with the OFL licence file beside it and a line in `README` crediting it. Two weights maximum. Report the byte size of each.
- One face for everything: headings, labels, numbers, body. `font-display: swap` with a system monospace fallback so the first paint is never blank.
- Numbers use `font-variant-numeric: tabular-nums` if the face supports it. If it does not, report it: HP numbers that shift width as they change are a real readability cost and it decides the fallback below.
- Uppercase letterspaced for labels and headings, per Reference A. Sentence case for any flavour copy. Do not uppercase stat numbers or move names.

**Legibility gate.** On a real 390 phone, the party management six-stat block and a 2x2 move grid must be readable at the sizes they currently render. If either fails, switch numbers and body text to the system monospace stack and keep Pixelify Sans for headings and labels only. Report which outcome you landed on. This is the one decision in V0 that cannot be made from a desktop.

### Verdict check

Reward cards, capture cards, starter cards, and locale cards are siblings. After this stage, siblings must have identical computed background, border, border-width, box-shadow, and font-size. Write the assertion as a test, not a review note.

### Tests required

1. No hardcoded colour, font-family, or font-size literal remains in `src/ui/`, asserted by a lint rule or a grep test.
2. Exactly one element per screen carries `.primary-action`, asserted for every screen with a primary action.
3. Sibling cards in an offer have identical computed styles except type-chip colour.
4. `core/` unchanged, no timers, no `Math.random`, seeded output byte identical, SMOKE24 included.
5. All suites pass.

### Definition of done

Every screen renders in one face, one palette, and one accent. A player can tell which button is the primary action from across the room and cannot tell which reward card is strongest from the card's styling.

---
---

# V1: Locale Palettes

Pure CSS. The locale the player picked becomes the colour of the segment.

## PROMPT

You are building **Stage V1** of the GYMRUN visual identity pass. V0 is merged. Read `src/ui/theme/tokens.css`, `src/ui/scene.ts`, and the map and locale select screens.

### Order of work, stop for review after each

1. Report: where does the UI learn the current locale today, and does that read survive a save and reload? Report the exact projection.
2. Palette overrides per locale.
3. Locale attribute set on `<html>` on segment start, cleared on run end.
4. Locale select and map screens read the palette.

### Locale palettes

`src/ui/theme/locales.css`. For each of the eight locales, override exactly three tokens: a deep background, a mid background, and a glow. Nothing else. Text, accent, chips, and surfaces do not vary by locale, so the decision screens read identically in every region and only the world behind them changes.

- Body background becomes a two-stop vertical gradient of deep to mid, with a single horizon band rendered as a third gradient stop. This is the whole scene in V1. It is deliberately flat; V3 adds depth.
- The locale name renders as a large ghosted watermark behind the map, per Reference A. Low opacity, no interaction, no layout footprint. It must not reduce the contrast of any node card below what V0 established. Measure it.
- The locale select cards preview their own palette as a swatch strip on the card. Four type chips and a name, nothing else, per 4.6a. The swatch is a fact about the locale and is identical in size across cards.

### Where the palette switches

`<html data-locale="cave">` set from the same projection the map already uses to name the region. Set on segment start after locale selection, updated on every segment, removed on the summary screen so the run summary is locale neutral. The gym battle keeps the segment's locale.

Transition between palettes is a single background-colour transition using the V0 motion token, 0 under reduced motion, never blocking.

### Tests required

1. Every locale sets exactly three tokens, no more, asserted by parsing the stylesheet.
2. `data-locale` reflects the current segment's chosen locale across a save and reload.
3. Contrast of node cards and text over the watermark meets the V0 baseline, measured against the darkest and lightest locale.
4. Locale select cards have identical computed styles except swatch colours.
5. `core/` unchanged, seeded output byte identical, all suites pass.

### Definition of done

A player who picked Ruins is looking at Ruins for the whole segment and knows it from the corner of their eye. Swapping the palette changes nothing about how a node card or a move button reads.

---
---

# V2: World Chrome

Pure CSS plus small markup changes. Chrome that belongs to the world, per Reference B: dim bands instead of boxes, numbered slots, corner stamps.

## PROMPT

You are building **Stage V2** of the GYMRUN visual identity pass. V1 is merged. Read the party management screen, the backpack UI, every modal and confirm overlay including the Release A replacement confirm, and `src/ui/scene.ts`.

### Order of work, stop for review after each

1. Report: list every modal and overlay in the UI and which DOM pattern each uses. Report whether they share a helper. If they do not, that is the first thing to fix.
2. Modals as dim bands.
3. Numbered slots for party and backpack.
4. Corner stamps.
5. Chip and badge pass.

### Modals as bands

Every modal, confirm, and sheet is a translucent dim band across the middle of the scene with text-only buttons, not a floating box. One shared helper produces all of them. The Release A confirm overlay keeps its two-card side-by-side content and its distinct cancel-versus-exit affordances, only the container changes.

- The primary action in a band is the one accent-coloured element on screen. Its sibling is a hollow outlined button, per Reference A.
- The band never covers the pinned incoming move card from Release A. Report the y-range the band occupies on 390x844 and confirm the pinned card is outside it.

### Numbered slots

Party members and backpack items render as a hotbar of numbered slots, per Reference B. Party slots count from 1 to party size, backpack slots from 1 to `tuning.backpackCapacity`, empty slots drawn as empty. The number is a position, not a rank. Do not reorder slots by any stat.

- A held item renders inside its member's slot as a small icon from `@pkmn/img` item icons, with the item name on tap.
- Berries and held items are indistinguishable in slot styling. A berry is not lesser chrome.

### Corner stamps

Four corner stamps on every screen in the smallest legible size of the display face, low contrast, texture not information:

- Top left: locale name.
- Top right: segment index of eight.
- Bottom left: seed in the `GYMRUN-xxxxxx-nnnnnnn` form from the seeds doc, copy on tap.
- Bottom right: build version.

Stamps sit in the safe-area insets and occupy no layout height. **Vertical delta is 0 only if they are absolutely positioned outside the flow.** If any screen's flow content would collide with a stamp on 390x844, the stamp on that screen is dropped, not the content.

### Chips and badges

Tier, band, capability requirement, capability band, status, and stat stages all render through one chip component with one neutral style. Type chips are the only coloured chips and remain outlined at reduced saturation. The `BAND n` badge from 4.6b and Release A moves onto this chip component without changing where it appears or what it says.

### Tests required

1. One modal helper, asserted by import graph; no screen builds its own overlay.
2. Every band has exactly one `.primary-action`.
3. Slots render in position order for a fixed party and backpack, and reordering party members in state reorders slots identically.
4. Stamps are positioned out of flow; layout height of the battle and map screens is unchanged from V1 to the pixel.
5. Seed stamp copies the full seed string including content hash prefix.
6. `core/` unchanged, seeded output byte identical, all suites pass.

### Definition of done

No screen has a box on a page. Every overlay is a band over the world, every collection is a row of numbered slots, and the seed is always one tap away.

---
---

# V3: Scene Layer

First stage that mounts new DOM. The locale stops being a gradient and becomes a place.

## PROMPT

You are building **Stage V3** of the GYMRUN visual identity pass. V2 is merged. Read `src/ui/scene.ts`, `src/ui/theme/locales.css`, and the map, battle, and result screens.

### Order of work, stop for review after each

1. Report: the performance baseline. Chrome performance trace at 390 width on a mid-range Android or its emulation, scrolling the map with the V1 gradient background. Record frame time and paint time. This is the number the scene layer is not allowed to break.
2. Scene container in `scene.ts`, one locale, three layers, no motion.
3. All eight locales.
4. Parallax and one drifting element per locale.
5. Performance check against step 1. If it fails, canvas fallback per section 1 of the plan.

### Scene construction

`scene.ts` mounts a `.scene` container behind all screen content, fixed, full viewport, `pointer-events: none`, three child layers: far, mid, near.

- Each layer is CSS gradients plus inline SVG silhouettes authored in the repo under `src/ui/theme/scenes/`. Silhouettes are flat single-colour shapes in the locale's mid and glow tokens: a horizon line, a few landmasses, a treeline, a skyline, ruins, whatever the locale needs. Pixelated look comes from low-resolution SVG upscaled with `image-rendering: pixelated` and `shape-rendering: crispEdges`, not from raster assets.
- No copyrighted shapes. No Pokemon, no Pokeball, no in-game landmark. Generic silhouettes only. This is the same IP posture as the sprite CDN rule.
- One drifting element per locale as a CSS keyframe loop: a boat on the Shore, a bird on the Summit, a light in the Ruins. Loop is 20 seconds or longer and never draws the eye toward any UI element.
- Parallax: far layer moves at 0.2 of scroll, mid at 0.5, near at 1, via `transform: translate3d` from a passive scroll listener. Under reduced motion all three layers are static and the drifting element is hidden.
- The scene is decorative and must never reduce text or card contrast below V0 baseline. Where it would, the mid layer gets a darkening scrim under the content column. Measure per locale.

### What the scene does not do

It does not appear on the run summary screen, which stays locale neutral. It does not react to battle events; that is Release C's job and V5's job. It carries no information. A player who cannot see it loses nothing.

### Bundle and performance budget

Report per-locale SVG bytes and the total. Target under 30 kB total gzipped. Report frame time and paint time against the step 1 baseline. Pass condition: no frame over 16ms during map scroll, paint under 4ms per frame. Fail condition triggers the canvas fallback, which replaces the three DOM layers with one `<canvas>` drawn once per locale change and translated on scroll, keeping everything above it in DOM.

### Tests required

1. Scene mounts exactly once and survives screen navigation without remounting, asserted by node identity.
2. Every locale has three layers and one drifting element; under reduced motion the drifting element is not rendered.
3. Scene container has `pointer-events: none` and every interactive element remains reachable by tap over it, asserted per screen.
4. Contrast of text and cards over every locale's scene meets V0 baseline.
5. Vertical delta 0: layout height of guarded screens unchanged from V2.
6. `core/` unchanged, seeded output byte identical, all suites pass.

### Definition of done

The Marsh looks like a marsh at a glance and the map decision point sits over it exactly where it was. Turning the scene off changes nothing the player needs.

---
---

# V4: Run Summary as Payoff

Reference A's result screen. The end of a run is the most designed screen in the game. It is not a guarded screen and it has one primary action, so it can spend pixels.

## PROMPT

You are building **Stage V4** of the GYMRUN visual identity pass. V3 is merged. Read the run summary screen and the post-battle result screen from the round 2 patch.

### Order of work, stop for review after each

1. Report: list every fact the run summary screen currently has access to from run state, and every fact it would need for the design below that it does not have. Anything in the second list is either derivable in `ui/` from state and the decision log, or it is out of scope. Nothing new comes from `core/`.
2. Layout and copy, static.
3. Data rendered as decoration.
4. Post-battle result screen alignment.

### The screen, top to bottom

- **Outcome.** One large word, VICTORY or FALLEN, in the display face, then gyms cleared as a large number over eight.
- **The route.** The run's node chain rendered as a horizontal path across eight locale-coloured bands, one dot per node taken, gym nodes larger, the death point marked. This is the decision log drawn, and it is the piece that makes a shared seed screenshot legible.
- **Tier table.** Five rows, gyms cleared 0 to 2, 3 to 4, 5 to 6, 7, and 8, each with a small icon, the range, and one line of flavour copy, the player's row bolded, per Reference A. Copy lives in `src/ui/copy/summary.ts`, **not in `data/`**, because `data/` is hashed into `contentHash` and this is presentation. The bolded row states where the player landed. It does not rate the run and it does not compare to other players.
- **Final party.** Party slots from V2, each with sprite, level, types, ability, four moves through the shared move card, held item.
- **Coverage.** The `offensiveCoverage` readout as an 18-spoke wheel with covered types filled. Factual, no score, same rule as the capture card line.
- **Cause of death.** Which gym, which opposing species, which move, as a single band in the V2 style. Absent on victory.
- **Actions.** Rematch as the one accent button. Copy seed as the hollow button.

### Post-battle result screen

Stays compact. Its decision points, the reward cards and the capture offer, remain above the fold. Restyle only: outcome header shrinks to one line, HP and PP state renders through the V2 slot row, currency earned as a chip. Any payoff decoration on this screen goes below the cards and below the fold.

### Tests required

1. The route renders one dot per logged node decision and its count matches the decision log for a fixed seed.
2. The bolded tier row corresponds to gyms cleared for every value 0 to 8.
3. No file under `data/` changed; `contentHash` identical.
4. Result screen decision points above the fold at 390x844 for a three-card reward plus a capture offer.
5. `core/` unchanged, seeded output byte identical, all suites pass.

### Definition of done

A player who dies at gym 5 gets a screen worth screenshotting, reads what gym 5 meant in one line, and hits rematch. A victory screen is visibly the same screen with the top word changed.

---
---

# V5: Battle Stage Composition

The most-seen screen. Sprites go into the scene, panels float, the log collapses. Requires Release C merged.

## PROMPT

You are building **Stage V5** of the GYMRUN visual identity pass. V4 and Release C are both merged. Read the battle screen, `src/ui/scene.ts`, the Release C flag mapper's UI consumer, and the move button component from the round 2 patch.

### Order of work, stop for review after each

1. Report: measure the current battle screen at 390x844. Report the height of each element and the total, and confirm the four move buttons are above the fold today. This is the budget.
2. Log collapse to a strip.
3. Sprites into the scene, panels floating.
4. Move grid restyle.
5. Motion pass against Release C.

### Pixel budget at 390x844, 740 usable

| Element | Target height | Notes |
|---|---|---|
| Opponent panel, floating | 56 | name, level, gender, HP bar plus number, status chip, stage chips |
| Scene with both sprites | 260 | opponent sprite upper right, player sprite lower left, over the V3 near layer |
| Player panel, floating | 64 | same as opponent plus PP is on the buttons, not here |
| Event strip | 36 | last protocol event plus Release C flag words, tap to expand |
| Move grid, 2x2 | 128 | two rows of 56 plus gaps, 44px minimum touch target |
| Margins and safe area | 40 | |
| **Total** | **584** | leaves 156 headroom against 740 |

What gives, stated plainly: the multi-line log is no longer persistent. It becomes a bottom sheet opened from the strip, dismissed by tap, and it never opens on its own. The separate sprite box is gone; sprites sit in the scene with no container.

### Panels

Floating over the scene with no box, per Reference B: text with a subtle scrim behind it, not a card. HP bar keeps the Release C chunk-and-shadow behaviour unchanged. Stat stages render as chips through the V2 chip component. Nothing important sits below the fold, per the round 2 patch, and the budget above proves it.

### Move grid

Four buttons through the existing move button component, restyled only. Each shows name, type chip, category, PP over max, band badge, and the per-move effectiveness marker, all already present. The effectiveness marker is the one place a forecast renders and it stays exactly as the round 2 patch defined it. Do not restyle it into something that reads as a recommendation: it is a chip, same size on every button, and a super effective chip is not brighter than a neutral one.

### Event strip

Holds the most recent event from the same ordered turn data Release C's jiggle reads, plus the flag words from Release C's mapper. Restyle only. Priority marking follows the existing log rule. The strip never grows past one line; overflow truncates and the sheet has the full text.

### Motion

Release C owns HP chunk, jiggle, and flag words. V5 adds one thing: the species swap animation that `scene.ts` already triggers gets a scene-aware version, the outgoing sprite sinks into the near layer and the incoming rises from it. Duration reads the same `data/tuning.ts` number as everything else. Skippable, reduced-motion instant, adds nothing to the per-turn budget because it only fires on switch.

### Tests required

1. Battle screen layout height at 390x844 is at or under 600 with a full status and stage chip row on both sides, asserted by measurement.
2. Four move buttons above the fold with the event strip visible.
3. Opening the log sheet does not submit a move or advance the turn; the same assertion Release B made for tooltips.
4. Effectiveness chips on all four buttons have identical computed size and weight regardless of value.
5. Species swap fires only on switch and adds zero time to a turn with no switch, measured.
6. `core/` unchanged, no timers in `core/`, seeded output byte identical, `playRun` headless unchanged, all suites pass.

### Definition of done

Two sprites stand in a place. The player reads both HP bars, both statuses, and four moves with PP and effectiveness without scrolling, sees the last thing that happened in one line, and never has to close anything to act.

---
---

# V6: Audio, Optional

Stop before this stage without the game looking half-finished. It is here so the decision is recorded, not because it is required.

## PROMPT

You are building **Stage V6** of the GYMRUN visual identity pass. Everything through V5 is merged.

- One module, `src/ui/audio.ts`. Web Audio API only. No audio files, no music.
- Four cues, all synthesized from oscillators and envelopes: select, hit, faint, berry fired. Each under 200ms. The berry cue fires on the same `-enditem` signal Release C's flag word uses.
- Off by default. Toggle lives in the same cross-run settings store as the verbosity toggle. The audio context is created on the first user gesture after the toggle is on, never before, so mobile autoplay policy is respected.
- Cues never delay anything. They are fire-and-forget on the same events the flag mapper already emits; the UI subscribes, `core/` knows nothing.
- Report bundle delta. Target under 3 kB.

### Tests required

1. No audio context exists before the toggle is on and a gesture has occurred.
2. Cues fire on the mapped events for a fixed recorded turn set and never on any other event.
3. `core/` unchanged, no timers, seeded output byte identical, `playRun` headless unchanged, all suites pass.

### Definition of done

A player who turns sound on hears a berry fire. A player who does not never knows the option exists until they look for it.

---
---

# Defaults I took, flagged for your review

- **Pixelify Sans over VT323 or Press Start 2P.** VT323 is closer to Reference A's monospace terminal look and also OFL, but it is not a true bitmap grid and softens at non-integer sizes. Press Start 2P is the purest bitmap look and OFL, but it is wide and fails the six-stat block at 390 width. Pixelify Sans was drawn for small-size legibility. The alternative worth trying in V0 is VT323 for everything, one sitting to swap.
- **Accent hue not named.** The rule is that it is the only saturated fill on screen and type chips are desaturated outlines. Pick the hue in V0 by putting the candidate next to all 18 type chips; the first one that reads as a different kind of thing rather than a nineteenth type is the accent. Hot pink is the Reference A answer and collides with Psychic and Fairy unless the chips are desaturated, which they are.
- **DOM scene, canvas as a measured fallback, not a preference.** The check that flips it is in V3 step 1 and step 5.
- **Pure CSS boundary between V2 and V3.** V2 is the last shippable stop with no new DOM. If V3 is skipped the game looks flat but finished.
- **Release C precedes V0.** Alternative is V0 through V2 first and Release C before V5. That works too; the only thing that must not happen is V5 before Release C.
- **Flavour copy and palettes live in `src/ui/`, not `data/`.** `contentHash` hashes `data/`, so putting presentation tables there would move seeds on a copy edit. If you would rather have all tables in one place, `contentHash` needs an exclusion list, which is a small change to the build config and belongs to the seeds doc.
- **Run summary is the payoff screen; post-battle result stays compact.** Reference A's result screen is the end of the game, not the end of a fight, and the fight result carries decision points that have to stay above the fold.
- **No population bell curve.** There is no server and no player population. The sim's greedy bot distribution could stand in for it as a build-time JSON, but the bot is not players and the artifact would move with every balance report. Deferred, named here so it is not forgotten for Stage 5's daily seed.
- **Corner stamps drop before content.** On any screen where a stamp collides with flow content at 390x844, the stamp loses.
- **Audio synthesized, off by default, no music.** Alternative is a small licensed chiptune loop, which reopens licensing and bundle questions this plan avoids on purpose.
- **Tier and band chips are uncoloured.** Colouring elite gold is the most tempting verdict in the game. Text only.
- **Type chips outlined and desaturated everywhere.** This is what makes a single accent possible. If it reads too flat in V0, the alternative is solid chips at reduced saturation, still never at the accent's saturation.
