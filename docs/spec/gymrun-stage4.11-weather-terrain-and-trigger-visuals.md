# Stage 4.11: weather, terrain and trigger visuals

Committed 2026-09-25 before any work, on `claude/dazzling-archimedes-wc1frw`.
Filed verbatim, per the protocol in [`README.md`](README.md).

The prompt asks for an investigation, a plan and a tiered scope, not a build.
**That is a report before code, which `CLAUDE.md` makes a hard stop.** The
investigation and the plan are sections 2 to 5 of this file. No `src/` file
changes on this branch.

---

## 1. The prompt, verbatim

> one big visual request:
> weather that changes the background
> design: have a css show weather and terrain effectsand highlight when a move or ability is triggered.
>
> 1. investigate if the logic of weather is already in battles. should be since smogon is big on weather meta
> 2. plan the change and where it touches
> 3. scope out the plan into tiers (separate the weather visual from the logic and highlighting triggers)
> 4. make this a big 4.11 feature and write the plan into the codebase for handoff

---

## 2. Investigation: is the weather logic already in battles?

### 2.1 The short answer

**Yes, and it has been since Stage 0, because the engine is `@pkmn/sim` and
weather is the engine's.** GYMRUN has never written a line of weather logic and
never will: rain halving Fire, Sandstorm chipping non-Rock bodies, Grassy
Terrain healing, Swift Swim doubling Speed, all of it resolves inside the sim
and shows up in the protocol. The census that Branch 2 of the battle animation
run took over 699 battles found the field class on **23.2%** of them, the fourth
most common thing that happens in a fight
([`../reports/battle-anim-2-protocol-census.md`](../reports/battle-anim-2-protocol-census.md)).
The player is told almost none of it.

What is missing is not logic. It is **state**. The tree reads weather and
terrain as an *event* (it started) and never as a *fact about the board* (it is
raining now). That distinction is the whole of this stage.

### 2.2 Where the weather comes from in a GYMRUN fight

Two doors into a battle, and only one is open:

- **Abilities: open.** `data/abilities.ts` is the whole gen 9 pool, and the
  randomizer draws any ability onto any species. Drizzle, Drought, Sand Stream,
  Snow Warning, the four Surges, Orichalcum Pulse, Hadron Engine, Sand Spit,
  Seed Sower, and the three primal weathers are all in it.
  `BLACKLISTED_ABILITIES` is empty. So are the users and suppressors: Swift
  Swim, Chlorophyll, Sand Rush, Slush Rush, Solar Power, Rain Dish, Ice Body,
  Dry Skin, Protosynthesis, Quark Drive, Cloud Nine, Air Lock.
- **Moves: closed.** `data/movePools.ts` contains **no** weather- or
  terrain-setting move. `scripts/gen-pools.ts` excludes them on purpose:
  *"weather with no follow-up. Rolling those is not variety, it is a wasted
  move slot."* Weather Ball and Terrain Pulse are in the pool; Rain Dance is
  not. `data/moveCopy.ts` carries copy for the eight setters (*sets rain for 5
  turns*) that no card can currently show.

**So every weather and every terrain a player sees is set by an ability, and
almost always on switch-in.** That fact decides the shape of the trigger work
in section 5, and it is the first of three findings below that the plan turns
on.

The AI knows nothing about it: `core/battle/ai.ts` calls `@smogon/calc` with
no `Field`, so its damage estimates ignore rain and sun. That is a balance
question, out of scope here, and recorded in section 8.

### 2.3 What reaches the player today

| Layer | File | What it does with weather and terrain |
|---|---|---|
| Adapter | `core/battle/driver.ts` | Reads `battle.field.pseudoWeather` for Trick Room (`invertedSpeed`) and **nothing else off `battle.field`**. `battle.field.weather` and `battle.field.terrain` are never read. `describeMove` reads the dex's `weather` and `terrain` fields for the move card's effect line |
| Facts and projection | `core/battle/view.ts` | `BattleFacts` and `BattleUiView` carry no field state at all |
| Flag reader | `core/battle/flags.ts` | A `field` flag on `\|-weather\|` and `\|-fieldstart\|`, **start only**: `[upkeep]` lines are skipped (6.1% of all battles on their own), `none` is skipped, and `\|-fieldend\|` is not read. Attributed to the `[of]` side or whoever just acted. The `[from] ability: Drizzle` tag is discarded, so a weather-setting ability produces a `field` flag and **no `ability` flag** |
| Words | `data/flagWords.ts` | `FIELD_WORDS`: Rain, Harsh sunlight, Sandstorm, Hail, Snow, Strong winds, Extreme sun, Heavy rain; terrains fall through to their own names |
| Strip | `ui/flag-strip.ts` | `field` and `ability` are second-channel kinds (D23): one per side, neutral chip, beside the hit flag |
| Beat | `ui/abnormality.ts`, `ui/scene.ts`, `styles.css` | `field` maps to the `field` class, animated as `mark-sweep` **inside the causing actor's box**. The stylesheet says why: *"the board has no element of its own on this stage, and giving it one is a bigger change than this patch"*. This stage is that bigger change |
| Log | `ui/battle-log.ts` | Every line, including upkeep, end, `-activate` and `-item`, as prose through `@pkmn/view`. Behind a pull (R11) |
| Background | `ui/scene.ts` `createWorldScene`, `theme/locale.ts`, `theme/locales.css`, `theme/scenes/*` | One `.world` behind every screen, mounted once in `app.ts`, keyed by `data-locale` on `<html>`. Three SVG layers plus one drift element, painted from **exactly three tokens per locale** (`test/visual-locales.test.ts` fails on a fourth). Reduced motion unmounts the drift and freezes the parallax. **Nothing about the battle touches it** |

Three findings that a plan written from memory would have missed:

1. **The opening batch never animates.** `screens/battle.ts` shows the opening
   protocol with `animate=false`: no strip, no marks. Since 2.2 says weather
   comes from abilities and abilities fire on switch-in, **the commonest way
   weather starts in this game is the one way the player is never shown it**,
   except in the log. A lead Sand Stream is invisible.
2. **The setter gets no `ability` flag.** The reader keys the field line's name
   and drops the `[from]` tag. So Drizzle is the one class of ability firing
   that the `trait` beat and the strip never name. The prompt's *"highlight
   when an ability is triggered"* starts here, not with a new animation.
3. **Weather ending is unread.** `-fieldend` and `-weather|none` are dropped,
   which was correct when the only channel was an event strip (an ending is a
   readout, not a turn). Once the board carries the state, the end has a
   channel for free: the background reverts. No flag kind is needed.

### 2.4 What the sim offers

`Battle.field` in the pinned `@pkmn/sim` (`^0.10.11`) carries `weather` and
`terrain` as ids, each with a state object holding the source and remaining
`duration`, and `pseudoWeather` as a map the driver already reads.
`field.effectiveWeather()` returns the empty id while Cloud Nine or Air Lock is
on the board. **Read these exact names against the installed version at Tier
1's first step**, since `node_modules` is not in this session's tree.

## 3. Where the bible stands

The stage touches four player-facing surfaces: the world behind the battle,
the battle header, the Pokemon panel, and the flag strip. Per `CLAUDE.md`, the
bible was read before this was written and these are the rules it touches.

**C1, attributes never verdicts.** Weather on the board is a fact about the
present board, the same footing as the one C1 exception (live effectiveness
against the Pokemon on the field). A background that says *it is raining*
recommends nothing. What C1 forbids is the next step: a marker on the move
button saying *Surf is boosted now*. That is a forecast, and it is not covered
by C1's exception as worded. It is D49 below, recommended declined.

**C2, nothing removed.** Nothing is. Every existing flag, beat and log line
stays; the stage adds a state channel beside the event channel.

**R3, one fact one channel.** The `field` flag on the strip is the *event*
(rain began); the background and its glyph are the *state* (it is raining).
The bible already draws exactly this line for status: the panel's `BRN` chip
is present tense, the strip's *Burned* is past tense, and `flagWords.ts` says
*"one table cannot hold both"*. Same split, no double render.

**R4, exception-based.** No weather renders nothing: the locale's own world,
untouched. No terrain renders nothing.

**Section 2, glyph families.** The bible's own rule is *glyph primary, colour
secondary*. A background wash is colour, so the state needs a glyph or it is a
fact only a sighted, non-colour-blind, motion-enabled player receives. That
glyph is a **twelfth family, `field`**, eight marks (four weathers, four
terrains; the three primal weathers and Strong winds reuse their base
weather's mark at inspect-distinguishable copy), and section 2 says a twelfth
is an amendment. **D47.**

**Section 3, encoding table.** There is no row for weather or terrain. An
attribute with no encoding cannot be built to the bible. The row: *Field state
(weather, terrain) | Field glyph at 16 in a fixed slot on the battle header,
world wash behind the stage | None | Name, effect line, from a `fieldCopy`
table.* Also D47.

**Section 4, budgets.** The battle header is budgeted at 3 words. A glyph is
not a word, so the budget holds. The world is unbudgeted: it carries no text.

**Section 6, battle turn grammar.** Seven steps and none of them is a field
change or an ability firing, though both beats have shipped since Branch 3B.
The grammar gains two steps (*a field effect begins: the world changes and the
header glyph appears; an ability fires: the ability name pulses on its
panel*). Also D47, since it is the same amendment.

**R7, exposure labels.** A twelfth family gets labels in `data/glyphLabels.ts`
and joins the family walk in `test/exposure-labels.test.ts`.

**R5, one inspect.** Long-press on the field glyph opens the effect line.
Nothing else explains it.

**Trigger highlighting and C1's "no conditional emphasis".** A pulse on the
ability name when it fires is feedback of a resolved event, the same standing
as the status chip appearing the moment a burn lands (section 6 step 4). It
is *conditional* only on the protocol having said so. What it must never be
is weighted: Intimidate and Drizzle pulse identically, the pulse is one
keyframe for every ability, and the `trait` mark it accompanies already holds
that rule (*"a colour here would rank one class against another"*). **D48**
asks the bible to say so in section 6 rather than leaving it to a comment.

**The stylesheet's own reservation.** `styles.css` under `mark-sweep`: the
field beat sweeps inside the actor's box because the board has no element.
Once the world carries the state, the sweep is redundant with the wash and R3
asks which survives. Default: the sweep stays as the *event* beat (it rides
the action slot and costs no time), the wash is the *state*, and the pair is
the same event-and-state pair the strip and the panel already are.

## 4. The plan and where it touches

### 4.1 The state, in `core/`

`BattleFacts` gains one field, collected once and never gated by the reveal
policy, because weather is public to both sides by the rules of the game:

```ts
field: {
  weather: string | null;   // the sim's id: 'raindance', 'sunnyday', 'sandstorm', 'snow', ...
  terrain: string | null;   // 'electricterrain', 'grassyterrain', 'mistyterrain', 'psychicterrain'
  suppressed: boolean;      // effectiveWeather() is empty while weather is set: Cloud Nine, Air Lock
}
```

Read off `battle.field` in `buildFacts`, beside `invertedSpeed`, which is the
precedent: a board fact the driver reads straight off the sim rather than
re-deriving from the protocol. **Remaining duration is deliberately not
carried.** The games never show it, and a countdown is a fact the player is
not given at the table; open question 2 below.

`BattleUiView` projects it as `field: { weather, terrain, suppressed }` with
the sim id mapped to a `FieldKind` from a new `data/fieldCopy.ts`. The
projection does not carry a word.

**No version axis moves.** `BattleFacts` is a projection: nothing in the run
log, the randomizer or the AI reads it. `data/fieldCopy.ts` is imported by
`ui/` only, so `build-config/content-hash.ts` excludes it by the same
mechanical rule that excludes `flagWords.ts`, and `test/content-hash.test.ts`
holds it. **Do not put the words in `moveCopy.ts`**: `core/battle/view.ts`
imports from it and it is inside the hash.

### 4.2 The state, on screen

Two surfaces, one fact, the bible's glyph-primary rule deciding the order.

**The glyph.** A `field` family in `ui/theme/glyphs.ts`: rain, sun, sand,
snow, and four terrain marks, at 16 and 24, `currentColor`, through the same
`path()` sheet the capability and node families use. Mounted **on the battle
header** in a fixed slot after the AI tier: the header is the one battle
surface that is not a Pokemon's, which is what the state is. R7 labels in
`data/glyphLabels.ts` (*Rain*, *Sun*, *Sand*, *Snow*, *Electric*, *Grassy*,
*Misty*, *Psychic*). Long-press opens the effect line from `fieldCopy.ts`
through a `field:` tip kind in `ui/tooltips.ts`. When `suppressed`, the glyph
is drawn dimmed, the same recipe as a disabled chip: the rain is still there
and an ability is holding it off, which is two facts and both are true.

**The world.** `ui/theme/field.ts` exports `applyField(field | null)`, writing
`data-weather` and `data-terrain` onto `<html>` exactly as `applyLocale`
writes `data-locale`, from `screens/battle.ts`'s `draw`, and cleared by
`scene.reset()` and by every navigation that clears the locale. The `.world`
gains one child, `world__weather`, between the near layer and the scrim, and
the stylesheet does the rest:

- `:root[data-weather='raindance'] .world__weather`: diagonal streaks as a
  repeating linear gradient, one `@keyframes weather-rain` translating it.
- `sunnyday`: a warm wash, `color-mix` of the locale glow toward a global
  `--weather-sun` token, breathing slowly.
- `sandstorm`: a grain texture drifting horizontally, `weather-sand`.
- `snow`: sparse motes falling, `weather-snow`, the same technique as the
  `firefly` drift.
- Terrain tints the **near layer** only: `--terrain-tint` mixed into
  `--layer-fill` at a fixed ratio, four hues, no motion. The ground changes
  colour; the sky does not.
- `data-weather` with `suppressed`: the wash at half opacity, no motion.

Rules the stylesheet must keep: **weather tokens are global, never per
locale** (`--weather-rain`, `--weather-sun`, `--weather-sand`, `--weather-snow`,
`--terrain-electric`, `--terrain-grassy`, `--terrain-misty`,
`--terrain-psychic` in `tokens.css`), because `visual-locales.test.ts` fails a
locale on a fourth token, and because eight locales times four weathers is
thirty-two palettes nobody will maintain. Every wash is a `color-mix` of a
global token with the locale's own three, so the art recolours with the
region as V1 intended. Under `prefers-reduced-motion`, every `weather-*`
animation is cancelled by name in the existing block at the same specificity
(`test/reduced-motion-specificity.test.ts`), leaving the static wash: the fact
survives, the motion does not. The `world__scrim` holds the contrast floor
under the lightest wash (sun), which the browser suite's contrast sweep
measures.

### 4.3 The triggers

The prompt's *"highlight when a move or ability is triggered"*, read against
2.3's findings, is three things of different sizes.

**Ability fired.** Two defects and one addition:

1. The opening batch animates nothing. `screens/battle.ts` passes
   `animate=false` for the opening protocol so that a subscriber attached late
   still sees a coherent log; the marks and strip were never separated from
   that. Split them: the opening batch still skips the strip's *event line*
   (there is no action) but runs `abnormalityMarks` and shows the second
   channel, so a lead Sand Stream sweeps and reads *Sandstorm* on turn 0.
2. `flags.ts` drops the `[from] ability:` tag on field lines. Read it: a
   field line carrying `[from] ability: X` emits **both** a `field` flag and
   an `ability` flag with `detail: X`, on the `[of]` side. `test/flags.test.ts`
   gains the Drizzle case; `abnormality.ts` already maps `ability` to `trait`.
   The strip's one-per-side bound means only the first shows, in protocol
   order, which is the field; the ability is in the log and on the panel.
3. The panel's ability slot pulses when its side's `ability` flag fires.
   `AbnormalityMark` gains nothing; `scene.update` already receives the marks,
   and for a `trait` mark it sets `data-fired` on that side's
   `panel__traits` for the beat, cleared with the other beat attributes. One
   keyframe, `trait-fired`, same duration token, same slot delay as the mark.
   `test/boundaries.test.ts` is untouched: the scene still reads a class and
   a side, never a flag.

**Item fired.** Section 6 step 5 says *berry fires: sprite pops*. Verify at
Tier 4 whether the panel's item sprite animates on the `berry` flag today; the
census says the `berry` flag exists and the bible says the pop does, and the
bible-discrepancies file has caught that kind of gap before (D6). If it does
not, the same `data-fired` mechanism on the item slot closes it. `-item`
(Frisk, Trick, an Air Balloon announcing itself) stays deferred unless Tier
0's census moves it.

**Move triggered.** The only protocol shape for *a move triggered because of
the field* is what the sim writes as `-activate` or as damage the log already
formats. The census counted `-activate` under the volatile class and read it
as *confusion* 6.6% of the time; it did not sub-key it by move. **Tier 0
re-runs the census sub-keyed** before this is designed, per R9's own note:
*add a flag kind only from measurement*. If the count clears the bar Branch 2
set (a class on more than a few percent of battles), it is a `trait`-class
mark on the actor plus a strip word; if not, it is dead copy and is not built.
The forecast side (*Surf is boosted in this rain*) is D49, recommended
declined.

### 4.4 Files, in the order they change

| Tier | File | Change |
|---|---|---|
| 0 | `scripts/protocol-census.ts` | Sub-key `-activate`, `-item`, `-fieldend`, and `-weather`/`-fieldstart` by kind and by `[from] ability:`. Report to `docs/reports/stage-4.11-field-census.md` |
| 0 | `docs/design/bible-discrepancies.md` | D47, D48, D49, filed with this plan. **Wait on rulings** |
| 0 | `docs/design/design-bible.md` | Rev 14 on the rulings: section 2 twelve families and a `field` row; section 3 a *Field state* row; section 5 a *World* component row and the header row; section 6 two new steps; section 9 the family-count hypothesis reads twelve |
| 1 | `src/core/battle/driver.ts` | `field` read off `battle.field` in `buildFacts` |
| 1 | `src/core/battle/view.ts` | `BattleFacts.field`, `BattleUiView.field` |
| 1 | `src/data/fieldCopy.ts` | Sim id to `FieldKind`, present-tense word, effect line. Excluded from `contentHash` by the import-graph rule |
| 1 | `test/battle-view.test.ts`, `test/content-hash.test.ts` | A rain fixture through the projection; the exclusion holds |
| 2 | `src/data/glyphFamilies.ts`, `src/data/glyphLabels.ts`, `src/ui/theme/glyphs.ts`, `test/glyphs.test.ts` | Twelfth family, eight marks, labels, `toHaveLength(12)`, the pairwise floor over `field` |
| 2 | `src/ui/screens/battle.ts`, `src/ui/tooltips.ts`, `test/tip-kinds.test.ts` | The header slot; the `field:` tip kind |
| 2 | `test/exposure-labels.test.ts`, `test/visual-exposure-labels.test.ts` | A twelfth case in the family walk |
| 3 | `src/ui/theme/field.ts`, `src/ui/theme/tokens.css`, `src/ui/styles.css`, `src/ui/scene.ts` | `applyField`; the eight global tokens; `world__weather` and the four keyframes; terrain tint on the near layer; the reduced-motion block; the child mounted in `createWorldScene` |
| 3 | `test/world.test.ts`, `test/visual-locales.test.ts`, `test/reduced-motion-specificity.test.ts`, `test/visual-motion.test.ts` | Every weather has a keyframe and every keyframe is cancelled; the three-token rule still holds; the wash is there under reduced motion and the motion is not |
| 3 | `scripts/visual/locale-shots.mjs`, `src/ui/gallery-fixtures.ts`, `docs/visual/baseline/` | The gallery grows a weather axis; eight locales times five field states, recorded |
| 4 | `src/ui/screens/battle.ts` | The opening batch runs marks and the second channel |
| 4 | `src/core/battle/flags.ts`, `test/flags.test.ts`, `test/abnormality.test.ts` | The `[from] ability:` read; the Drizzle case emits two flags |
| 4 | `src/ui/scene.ts`, `src/ui/styles.css`, `test/battle-stage.test.ts`, `test/visual-motion.test.ts` | `data-fired` on the traits row and, if the Tier 4 check finds it missing, the item slot; `trait-fired` keyframe; cancelled under reduced motion |
| 5 | `scripts/visual/census.ts`, `docs/visual/baseline/`, `docs/design/text-census.md` | Header still at 3; battle screen re-recorded |
| 5 | `docs/generation.md` §81, `docs/design/milestones.md`, `docs/README.md`, `docs/copy.md`, `docs/handoff/4.11-*.md` | The dated note, the checklist, the current-state paragraph, the new strings, the handoff |

Nothing under `core/` changes except the two reads (driver, flags) and the
projection. `core/` still imports nothing from `ui/`; `scene.ts` still imports
only types from `core/battle/flags`. **No version axis moves at any tier**, and
`contentHash` is asserted unmoved at every checkpoint by the six baseline run
records.

## 5. Tiers

The prompt asks for the weather visual, the logic, and the trigger
highlighting as separate tiers. They are, and the order below is the
dependency order: nothing in a later tier can be shown to work headless without
the tier before it. One sub-branch per tier, `visual/4.11-t<N>`, merged into
the `claude/dazzling-archimedes-wc1frw` trunk with a merge commit and no
squash, the 4.10 shape (D13).

| Tier | Name | Builds | Done when | Hard stop |
|---|---|---|---|---|
| **0** | Measure and rule | The sub-keyed census; D47, D48, D49 filed; the bible amended on the rulings | The report is in `docs/reports/`, every row is ruled, the bible is at Rev 14 | **Yes.** Nothing under `src/` changes until the rulings land. A `field` family without D47 is a twelfth family the bible forbids |
| **1** | The state, headless | `BattleFacts.field`, the projection, `fieldCopy.ts` | `playRun` under Node reports rain on a Drizzle lead through the projection; `contentHash` unmoved; no UI | No |
| **2** | The readout | The `field` glyph family, the header slot, the tip, the labels | Census reads 3 on the header; the family walk finds the header painting a `field` glyph that reports itself; the pairwise floor holds over eight marks | No |
| **3** | The weather and terrain visual | `applyField`, `world__weather`, the tokens, the keyframes, the terrain tint, the gallery axis | Forty recorded shots; the contrast sweep passes under sun; reduced motion shows the wash without motion; the three-token rule holds | No |
| **4** | Trigger highlighting | The opening batch animates; the `[from] ability:` read; the traits-row pulse; the item slot check; `-activate` **only if Tier 0's census earns it** | A lead Sand Stream sweeps on turn 0 and reads on the strip; Intimidate and Drizzle pulse the same keyframe; `boundaries.test.ts` unchanged | No, unless the census says `-activate` is marginal, in which case that half is not built and the report says so |
| **5** | Closeout | Census, baseline, §81, milestones, README, copy, handoff | Full suite green; every number in this file's tables re-recorded | No |

Tier 2 and Tier 3 both depend on Tier 1 and not on each other. They ship
together: a wash with no glyph fails the bible's colour-secondary rule, and a
glyph with no wash is not what the prompt asked for. Tier 4 depends on Tier 1
only for the `suppressed` read and could land before 3 if the visual is slow.

Rough cost: Tier 0 half a session including the wait for rulings; Tiers 1 and 2
a session together; Tier 3 a session, most of it the gallery and the contrast
gate; Tier 4 a session; Tier 5 half. **Four sessions**, most of it gates and
records rather than drawing, which is the 4.10 ratio.

## 6. Gates

The absolute gates, unchanged: determinism, stream isolation, version guards,
type check, lint, build, strict trim, smoke run, full suite. Plus the ones this
stage is judged on:

- `test/content-hash.test.ts`: `fieldCopy.ts` excluded by the rule, hash
  unmoved, six baseline records byte-identical.
- `test/glyphs.test.ts` at twelve families, every pair in `field` above the
  16px floor. Rain against snow and Electric against Psychic are the pairs to
  watch.
- `test/visual-locales.test.ts`: still three tokens per locale.
- `test/reduced-motion-specificity.test.ts`: every `weather-*` and the
  `trait-fired` keyframe named in the block.
- The browser suite's contrast sweep on the battle screen under `sunnyday`,
  the lightest wash, on every locale.
- The Pocket no-scroll gate on the battle screen, which gains no height: the
  glyph sits on the header's existing line and the world is behind everything.
- The census reading 3 on the header with exposures exhausted (D44).

## 7. Open questions, each with the default the build takes

1. **Where the field glyph sits.** Default: the battle header, after the AI
   tier, because the header is the one battle surface that belongs to neither
   Pokemon. The alternative is a corner of the stage, which would need a fourth
   absolutely positioned child in a band that is a budgeted number. D47 asks
   section 5 to say which.
2. **Turns remaining.** Default: **not shown**, on inspect or anywhere. The
   games do not show it; the sim knows it; showing it is information the
   player is not given at the table and it is a decision-relevant fact the
   bible would then never let us remove (C2). Rule it before it is ever drawn.
3. **Suppressed weather.** Default: the glyph dimmed and the wash at half with
   no motion, because the rain is still on the board and Cloud Nine is holding
   it off, and both are true. The alternative, nothing, hides a fact that
   returns the moment the suppressor switches out.
4. **The sweep beat under a wash.** Default: keep `mark-sweep` as the event
   beat. It rides an action slot and costs nothing; the wash is state. If a
   playtest finds it redundant, it is one CSS rule.
5. **Primal weather and Strong winds.** Default: reuse the base weather's
   mark (Heavy rain is the rain glyph, Extreme sun the sun glyph, Strong winds
   the sand glyph's motion with no grain) and distinguish them on inspect.
   Four extra glyphs for three abilities the census has never seen fire is
   dead art.
6. **Order against Tier 7 of 4.10.** Default: 4.11 Tiers 0 to 2 land before
   M7.1 opens, for the same reason 4.10.1 did: the playtest should see the
   twelve-family face or it validates a face the game no longer wears. Tier 3
   can follow.

## 8. What this does not do

- **No weather from the locale.** A marsh does not rain and a summit does not
  snow. Locale weather would be a draw at map generation, under a new stream
  key, moving `RANDOMIZER_VERSION` and the AI's inputs, and it is a different
  stage with a different argument. This stage shows the weather the fight
  already has.
- **No weather moves in the pool.** `gen-pools.ts`'s exclusion stands until a
  simulator report argues otherwise; that is the moveset patch's territory.
- **No AI awareness.** The AI still estimates damage with no `Field`. It is
  a balance lever and belongs in `docs/balance.md`'s queue, not here.
- **No forecast on the button.** D49, recommended declined: a *boosted now*
  marker is a verdict about a move under the present board and C1's exception
  does not cover it.
- **No change to what a node contains, pays, or reveals.** Presentation only,
  plus two reads in `core/` that report what the sim already decided.
