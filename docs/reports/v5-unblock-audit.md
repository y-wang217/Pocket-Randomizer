# V5 unblock audit

What stands between `main` and Stage V5 of the visual identity pass.

Audited 2026-09-10 against `origin/main` at `9296ba7`. No source was changed;
every claim below is a file and a line in that tree, not a sentence in `docs/`.
Where a document and the tree disagree, section 4 records it.

**Headline.** Release C does not exist in any form, on any branch. It is V5's
one hard dependency and it is the whole of the blockage. V0 through V4 are all
merged. Two further reuse points V5's prompt calls "already present" are not:
the `BAND n` badge on the move button (Release A's R12) and the effectiveness
chip on every button. Three decisions need a human before the V5 prompt can be
pasted; they are listed in section 3.

---

## 1. Blocker table

| Dependency | State | Proof | Blocks V5 |
|---|---|---|---|
| **Release A** — move learning flow | **absent** | `src/core/run.ts:1022,1046` — both questions return `Promise<number>`, and `run.ts:1031` still carries the rule Release A retires: "**There is no decline, and the return type says so**". `RUN_LOG_VERSION` is `gymrun-run-11` (`run.ts:195`), which is 4.7's own value (bumped from run-10 at `4285312`), so no post-4.7 bump happened. No `docs/generation.md` entry retires the no-decline rule. | soft, except R12 below |
| **Release A / R12** — `BAND n` on the shared move card | **absent** | `bandChip` (`src/ui/chip.ts:61`) has exactly one caller, `src/ui/screens/reward.ts:61`. Neither `renderMove` (`src/ui/scene.ts:551`) nor `moveFacts` (`src/ui/scene.ts:722`) builds one. | **hard** — see §3 note 2 |
| **Release A / R13** — sim scores the recipient it selects | **partial** | `scripts/sim.ts:670-704` does score against a chosen member rather than the lead, landed at `ee39ff1` (4.6b), not Release A. But it selects by "weakest strongest-move" while `greedyMoveRecipient` (`scripts/sim.ts:893`) selects by STAB +60 / free slot +40. Two different rules, so the card is still not priced against the member it is actually given to. | no |
| **Release B** — `describeMove` in `core/` | **merged** (pre-dates Release B) | `src/core/battle/driver.ts:307`, `describeMove(nameOrId): MoveExplanation \| null`. Landed at `6491016` (Stage 4.5.1), not Release B. | no |
| **Release B** — exactly one tooltip mechanism | **partial** | The delegated `data-tip` layer is one mechanism and lives in `src/ui/tooltips.ts` (23 `data-tip` sites). A second, competing mechanism is still live: seven native `title` attributes at `app.ts:709`, `battle-log.ts:273`, `scene.ts:359`, `stamps.ts:56`, `screens/run-map.ts:249`, `screens/summary.ts:193,376`. `tooltips.ts:15` explicitly forbids exactly this ("not a `title` attribute and a `:hover` rule"). | no |
| **Release B** — type wheel trigger off the two panel type badges | **merged** (pre-dates Release B) | `src/ui/scene.ts:440` `panelTypeChip` returns a bare `typeChip` with no `tip`. The trigger was removed at `9407178` ("Threat readout checkpoint 2"), on `main` since 2026-09-09 — not by Release B. | no |
| **Release C** — protocol-to-flags mapper in `core/` | **absent** | No file under `src/` or `test/` defines a flag mapper. `grep -rn "flagWord\|flagsFor\|protocolFlags\|toFlags"` over `src/` and `test/` returns nothing. | **hard** |
| **Release C / R9** — HP chunk-and-shadow bar | **absent** | `src/ui/scene.ts:221-223` builds `.hp` / `.hp__fill` as a plain width transition; no chunk, no shadow. The only `box-shadow` uses in `styles.css` are the chip hairline, the drawer lift and the loss ring. | **hard** |
| **Release C / R10** — jiggle off the ordered turn data | **absent** | `jiggle` appears nowhere under `src/` or `test/` — only in `docs/spec/`. | **hard** |
| **Release C / R11+R14** — flag words, berry-fired flag | **absent** as flags; **data source present** | `readConsumedItems` (`src/core/battle/driver.ts:1634`) already reads `-enditem` for the player's side, covered by `test/berries.test.ts`. Nothing turns it into a flag word, because there is no mapper. | **hard** |
| **Release C** — one added-time-per-turn number in `data/tuning.ts` | **absent** | No duration, delay or ms field in `src/data/tuning.ts` (`DEFAULT_TUNING` at line 423). `src/ui/theme/tokens.css:228` reads `--motion-duration: 0ms;` with the comment "when Release C adds the per-turn number, ui/ writes it here at startup". | **hard** |
| **Release C** — reduced-motion handling | **partial, and not Release C's** | Real handling exists: `styles.css:1766` and `styles.css:2589`, plus `prefersReducedMotion` at `src/ui/scene.ts:849` re-read on locale change at `scene.ts:894`. All of it is V0/V3's world-scene work. There is no reduced-motion path for battle feedback because there is no battle feedback. | soft |
| **V0** — tokens and display face | **merged** | `src/ui/theme/tokens.css` exists; `@font-face` at `tokens.css:54,63`; rule enforced by `test/visual-tokens.test.ts` (9 tests, green). | no |
| **V0** — accent has one consumer | **merged** | `var(--accent)` appears at `styles.css:134,135,136` only, all inside `.primary-action` (`styles.css:133`). | no |
| **V1** — per-locale palettes in `src/ui/` | **merged** | `src/ui/theme/locales.css`, eight blocks of exactly three tokens. `src/data/locales.ts` contains zero colour literals. | no |
| **V2** — the chip component | **merged** | `src/ui/chip.ts`; `stageChip` at `chip.ts:73` is already written for V5 ("For the battle panel to adopt in V5"); `typeChip` at `:51`, `effectChip` at `:97`. | no |
| **V3** — scene layer with a near layer | **merged** | `createWorldScene` at `src/ui/scene.ts:853`; `PARALLAX` at `scene.ts:847` with `near: 1`. | no |
| **V4** — summary restyle and `ui/copy/` | **merged** | `src/ui/copy/summary.ts` exists; `docs/visual/state/V4.done` names `12af46c`. | no |
| **V5 reuse** — ordered turn data | **merged** | `readTurns` at `src/core/battle/turnOrder.ts:126`, consumed by the log at `src/ui/battle-log.ts:218`. | no |
| **V5 reuse** — flag mapper's UI consumer | **absent** | There is no mapper, so there is no consumer. | **hard** |
| **V5 reuse** — effectiveness chip on **every** button | **absent** | `src/ui/scene.ts:610`: `move.band === null \|\| move.band === 'neutral' ? null : …` — neutral and status print nothing, so a typical bar shows a chip on one or two of four buttons. | **hard** — see §3 note 3 |
| **V5 reuse** — "not brighter than a neutral one" | **satisfied by construction** | `.badge--effect` (`src/ui/styles.css:584`) has one recipe, no per-value hue; `styles.css:589` states the rule. Nothing to check because no neutral chip renders. | no |
| **V5 reuse** — species swap animation | **partial** | The trigger exists: `src/ui/scene.ts:264-271` sets `data-swapped` on species change, `styles.css:795` animates `.panel__header` and `.hp` for 260ms, and `scene.ts:110-118` clears it on the first tap. It animates **panel chrome, not a sprite**. | soft |
| **V5 reuse** — sprite resolution and the sprite box | **half absent** | Resolution exists: `src/ui/sprites.ts:14` imports `@pkmn/img/adaptable`, `spriteImg` at `sprites.ts:31`. **There is no sprite anywhere in the battle screen markup.** `spriteImg`'s only caller is `src/ui/screens/summary.ts:276`. | soft (V5.3 creates it) |
| **V2 chip in the battle panel** | **not yet wired** | `createSidePanel` (`scene.ts:195`) renders no stat-stage chip; `V2.md` morning decision 7 says so, and that is what `stageChip` is waiting for. | no (V5.3's own work) |

### Release C, partial-unblock detail

Release C is the hard gate and it is **absent, not partial**: none of its four
items exists. V5 reuses four things from it, and all four are missing —

| V5 reuses | State |
|---|---|
| the protocol-to-flags mapper | absent |
| the `data/tuning.ts` per-turn number | absent (`--motion-duration: 0ms`) |
| reduced-motion handling | present in general (V0/V3), absent for battle feedback |
| HP bar behaviour | absent — the bar is a plain width transition |

So there is no partial credit to claim. Release C has to be built whole.

---

## 2. Overnight loop outcome

**It ran, and it is already merged.** `origin/main` is `9296ba7`, "Merge pull
request #13 from y-wang217/claude/gymrun-visual-identity-overnight-fllr8n". The
local `main` in this checkout is stale at `9a62547` (122 behind); `origin/main`
is the tree.

**Which stages landed.** V0, V1, V2, V3, V4 — merge commits `2db2f59`,
`0d799d5`, `b3cd1e2`, `773ea88`, `0aa2391`, with done markers
`docs/visual/state/V0.done` through `V4.done`. **V5 exited as a clean skip**, at
commit `85afbee` "V5: skipped, Release C not merged; docs point at the overnight
run". No `V5.done` and no `V5.failed` were written, which is what the preamble
specifies for a skip. `docs/visual/reports/V5.md` records it:

> `V5 blocked: Release C not merged`

V6 was never reached; the loop is `for n in 0 1 2 3 4 5` and stops at V5.

### Branch inventory

| Branch | Tip | Ahead of `origin/main` | Contents |
|---|---|---|---|
| `origin/main` | `9296ba7` | — | the merged overnight run |
| `origin/claude/gymrun-4-6c-pocket-randomizer-d88v77` | `7366045` | **1** | "Cleanup: delete the capability move overlay the relic merge left behind" — one commit, unrelated to V5, also 1 behind |
| `origin/claude/gymrun-4-7-legibility-n5j360` | `9e92af1` | 0 | fully merged (PR #12) |
| `origin/claude/prune-dead-branches-0bzoqu` | `2468769` | 0 | fully merged (PR #9) |

No branch anywhere carries Release A, B or C. The one unmerged commit in the
tree is the 4.6c cleanup above.

### Reports newer than the 4.7 merge

Everything under `docs/visual/` postdates it: `OVERNIGHT.md`, the six prompts
`prompts/V0.md`–`V5.md`, the seven reports `reports/V0.md`–`V5.md` and
`reports/merge-4.7.md`, five done markers, and the screenshot and contrast
directories. `docs/reports/` did not exist before this audit. `sim-reports/`
holds six benchmark files; the newest,
`2026-09-10T04-12-11-931Z-gymrun-randomizer-12-400.json`, postdates 4.7.

### Morning decisions, verbatim

The overnight preamble reserves `## Morning decisions` for "anything the plan
says cannot be decided from a desktop". **Two are decisions deferred to a human
with a phone** — the rest of what is filed under that heading is a
default-taken record. Both phone decisions are quoted whole.

**V0.5 legibility gate**, from `docs/visual/reports/V0.md`:

> 1. **`--font-body`.** Numbers and prose render in the system monospace stack
>    (the overnight's conservative default). Pixelify Sans is on headings, labels
>    and chips only. If `docs/visual/reports/v0-legibility/*@2x.png` read fine on
>    a real 390 phone, set `--font-body: var(--font-display)` in
>    `src/ui/theme/tokens.css`. One line. Re-measure the guarded screens after:
>    the display face is wider, and a wrap on the map blurb would move the
>    decision point.

**V3.6 performance check**, from `docs/visual/reports/V3.md`:

> 1. **Verify on a real phone; the 4x throttled trace is a proxy.** The plan's
>    gate is a Chrome trace on a mid-range Android. What ran here is headless
>    Chromium at 390x844 with the CPU throttled 4x, and the metric is the main
>    thread's work per frame, not the interval between frames, because headless
>    Chromium draws only when something changes and the interval is the wheel
>    cadence. Every locale's p95 sits under 8.7ms against the 16ms gate, which
>    is margin, but it is margin on a desktop core. `scripts/visual/perf.mjs`
>    is the instrument; the numbers are below.

Neither blocks V5. The first, if answered "yes", widens the display face and
would move both guarded baselines — so **answer it before V5 or after, never
during**, because V5.1 and V5.6 are a before/after measurement pair and a font
change in the middle of them makes the pair meaningless.

The remaining `## Morning decisions` entries (V0 items 2–6, V1 1–4, V2 1–7,
V3 2–5, V4 1–4, `merge-4.7.md`) are defaults taken and recorded, each with the
one line to change. V2 item 1 is the one V5 must read: it names the two
`--chip` lines for category colour and says the V5 "not brighter" rule "a hue at
the same lightness satisfies".

---

## 3. Unblock sequence

The shortest ordered path from `9296ba7` to a tree where the V5 prompt runs as
written.

| # | What | Merge or build | Version axes it moves |
|---|---|---|---|
| 1 | **Decide the three questions in the notes below.** | neither — a human answers | none |
| 2 | **Release C**, whole: R9 HP chunk-and-shadow, R10 jiggle off `readTurns`, R11 flag words off a new pure mapper in `core/`, R14 berry flag off the existing `-enditem` reader, one added-time-per-turn number in `data/tuning.ts`, reduced-motion path for all of it. | **fresh build** — nothing exists on any branch | **none.** The mapper is a pure protocol reader, draws nothing, and is not asked during a run; the tuning number is a display duration. `RUN_LOG_VERSION`, `RANDOMIZER_VERSION` and `AI_VERSION` all hold. `DEFAULT_TUNING` gains a field, so every future `sim-report.json` `tuning` block differs from today's — expected, and not a seed change. |
| 3 | **R12 only**, from Release A: `BAND n` through `bandChip` on the shared move card, so `renderMove` and `moveFacts` both carry it. | **fresh build**, one insertion point each | **none.** Display only. **It moves the guarded battle baseline** (a chip row per button × 4), so `docs/visual/baseline/heights.json` must be re-recorded in the same commit — the same thing `merge-4.7.md` did. |
| 4 | Re-record `docs/visual/baseline/` from the merged tree with no visual change on top, per `OVERNIGHT.md`'s morning-merge note, if steps 2–3 moved any height. | build | none |
| 5 | **Paste the V5 prompt.** | — | none |

**Release C is on this list, as expected, and it is the only hard blocker of the
seven items in V5's reuse list that has no partial standing.**

Release A entire and Release B entire are **not** on this list. V5 does not
touch the move learning flow, and Release B's two open items (the second tooltip
mechanism, the `title` attributes) are invisible to every V5 checkpoint. Doing
either first is defensible sequencing; it is not unblocking.

### Three decisions a human owes V5 before step 2

**Note 1 — the SMOKE24 gate is red on `main` today, and V5 will not turn it
green.** `npm run smoke` exits 1 on one check:

> FAIL the offered nodes are fully visible without scrolling (cards end at y=869 of 844)

That is the **map** screen, 25px over. V5 touches only the battle screen, so it
will still be red at V5.6. `test/visual-v0.test.ts:47` already handles the twin
of this problem inside the suite by marking the absolute fold assertion
`it.fails` with a comment explaining that it turns back into an error the day
main takes the rows back. **The smoke script has no equivalent, so an absolute
gate in `CLAUDE.md` is failing with no marker saying it is expected.** Decide
before V5: fix the map's 25px, or give the smoke check the same explicit
expected-failure treatment. Do not let V5 be the stage that inherits an
unexplained red gate.

**Note 2 — the move button has no band badge, and V5's prompt says it does.**
V5's §Move grid reads "Each shows name, type chip, category, PP over max, band
badge, and the per-move effectiveness marker, **all already present**". Four of
six are; the band badge is not, and it is Release A's R12. Either land R12 (step
3 above, cheap) or strike the band badge from V5's list. Landing it is the
better answer — `bandChip` already exists and the reward card already proves the
recipe — but it is a height change and needs its baseline re-record.

**Note 3 — "a chip on every button" contradicts what the tree deliberately
built, and the deviation was never recorded.** The round 2 patch specifies four
values including neutral (`docs/spec/gymrun-patch-playtest-round2.md:43`) and no
marker at all on status moves (`:44`). The implementation suppresses neutral,
deliberately, and says so at `src/ui/scene.ts:597-609`: "a row where every
button carries a badge is a row where the badges stop being read, and the 0x
goes unread with them." V5's §Move grid then asks for the marker "same size on
every button" **and** that it "stays exactly as the round 2 patch defined it" —
which the tree's own reading of that patch says are different things. V5's test
4 ("effectiveness chips on all four buttons have identical computed size and
weight") cannot pass on today's markup. Decide which reading wins. Either way,
`CLAUDE.md`'s deviation rule applies and has not been honoured: the suppression
is recorded in a code comment, not as a dated note in `docs/generation.md`
(which carries exactly one deviation note, §9b, and it is about keyed streams).

---

## 4. Baseline and gates

Run on `9296ba7`, `npm ci` from the committed lockfile.

| Gate | Result |
|---|---|
| Full suite | **66 files, 866 tests, all pass**, 590.87s. |
| `eslint .` | clean |
| `tsc --noEmit` | clean |
| `npm run build` | clean. `index.js` 3,586.75 kB raw / 771.97 kB gzipped; `index.css` 53.49 kB / 9.40 kB |
| Strict trim (`GYMRUN_TRIM_STRICT=1`) | clean |
| **SMOKE24 browser smoke** | **RED, exit code 1.** One failure, the map's offered nodes 25px below the fold. Every battle-screen check passes. See §3 note 1. |
| `core/` no timers | asserted green by `test/boundaries.test.ts:168` |
| `core/` never imports `ui/` | asserted green by `test/boundaries.test.ts` and `eslint.config.js:44-56` |
| `playRun` headless | green — `test/headless.test.ts` (8 tests), `test/determinism.test.ts` (8 tests) |
| Seeded output | **byte identical**, twice over — see below |

### Seeded output, and a correction to the audit's premise

**There is no `sim-report.json` and no sha256 in `docs/balance.md`.** Ad-hoc sim
reports are gitignored (`.gitignore`, "Balance reports are generated
artifacts"), and `docs/balance.md` records no digest of any kind — `grep -i
sha256 docs/*.md` returns nothing. The post-4.7 seeded-output contract is
carried by two other instruments, and both are green:

- `test/fixtures/sim-report.json`, sha256
  `49e552ec0632c195da7ead16cd2b77f55303f500e83bb22092784451b6579a7c`, compared
  byte for byte by `test/sim-fixture.test.ts` — **pass**.
- `docs/visual/baseline/`, replayed by `test/visual-baseline.test.ts` — **pass**.

Independently, the pinned benchmark was re-run today
(`npm run sim -- --seeds 400 --policy greedy --prefix RETUNE`, 2m29s) and
compared field by field against
`sim-reports/benchmarks/2026-09-10T04-12-11-931Z-gymrun-randomizer-12-400.json`.
**The only field that differs is `samples[0].durationMs` (139258 → 147220), wall
clock.** Completion 9.75%, mean gyms 3.4125, identical to the committed
benchmark and to `docs/balance.md` §13.1. Nothing has moved the baseline. The
generated report was deleted after comparison; it is gitignored either way.

### The four version axes

| Axis | Value | Where |
|---|---|---|
| Run log | `gymrun-run-11/gymrun-0.3.0` | `src/core/run.ts:195` |
| Randomizer | `gymrun-randomizer-12` | `src/core/randomizer.ts:183` |
| AI | `gymrun-ai-2-switching` | `src/core/battle/ai.ts:69` |
| `contentHash` | **still does not exist** | no definition anywhere in `src/`, `scripts/` or `test/` |

The 0.5 sweep's finding holds: `contentHash` is unbuilt. Nine files under `src/`
now carry comments about what it will be computed over, and `docs/generation.md`
§9 records a decision about its shape, but no code computes one.

### Battle screen, measured at 390x844

Seed SMOKE24, first battle, headless Chromium at the pinned viewport, pointer
parked. Every box from the top of the document down. `.bench` is empty on this
turn.

| # | Element | Top | Height |
|---|---|---|---|
| 1 | shell top padding | 0 | 24 |
| 2 | `header.header` | 24 | 64.5 |
| 3 | gap | 88.5 | 12 |
| 4 | `.shell__drawer-bar` | 100.5 | 32.5 |
| 5 | gap | 133 | 12 |
| 6 | `.battle__header` (title 25.5, blurb 19.5) | 145 | 47 |
| 7 | gap | 192 | 12 |
| 8 | **`.panel--foe`** (header 46, hp 9, meta 20, traits 18.5, volatiles 0, stats 89.75) | 204 | **239.25** |
| 9 | gap | 443.25 | 12 |
| 10 | **`.panel--me`** (header 21, hp 9, meta 20, traits 18.5, volatiles 0, stats 89.75) | 455.25 | **214.25** |
| 11 | gap | 669.5 | 12 |
| 12 | **`.moves`**, 2x2 (button 129.5 = name 21, meta 41.5, tags 13.5, pp 16.5; row gap 6) | 681.5 | **265** |
| 13 | gap | 946.5 | 12 |
| 14 | `.bench` | 958.5 | 0 |
| 15 | gap | 958.5 | 12 |
| 16 | **`.log`**, persistent, multi-line | 970.5 | **320** |
| | **Total** | | **1290.5** |

`section.screen--battle` is 1145.5 (145 → 1290.5). Document `scrollHeight`
1339. This matches `docs/visual/baseline/heights.json` exactly
(`battle.screenHeight` 1145.5, `scrollHeight` 1339, `decisionTop` 681.5,
`decisionBottom` 946.5), so the ruler agrees with the recorded baseline.

**Are all four move buttons above the fold today? No.** Row 1 sits at
681.5..811, fully visible. Row 2 sits at 817..946.5 — it starts above the fold
and is cut at 844, showing 27px of a 129.5px button. **The fourth move button
ends 102.5px below the fold**, and 206.5px below the 740 usable line.

### Against V5's budget table

| Element | V5 target | Today | Delta |
|---|---|---|---|
| Opponent panel, floating | 56 | 239.25 | **+183.25** |
| Scene with both sprites | 260 | **0** — no sprite exists in the battle markup | −260 |
| Player panel, floating | 64 | 214.25 | **+150.25** |
| Event strip, one line | 36 | 320 (the persistent `.log`) | **+284** |
| Move grid, 2x2 | 128 | 265 | **+137** |
| Margins and safe area | 40 | 204 (rows 1–7 above) | **+164** |
| Internal gaps inside `.scene` | — | 36 (3 × 12) | +36 |
| **Total** | **584** | **1290.5** | **+706.5** |

V5.6's assertion is a total at or under 600. The screen is at 1290.5, so **V5
has to remove 690.5px, and 604 of that is the panels and the log alone.** The
plan's own answer is in the budget: the multi-line log becomes a 36px strip
(−284), the two panels shed their six-row stat blocks and float (−333.5), and
the move grid tightens (−137). That is 754.5, which clears it — the budget is
achievable, but only by taking all three cuts, not by restyling.

Note the one row that goes the *other* way: the scene is 0 today and is
budgeted at 260. Sprites are new weight, not a restyle, which is why V5.3
creates them rather than moving them.

---

## 5. Divergence from the record

Every place `docs/` and the tree disagree. The 0.5 sweep found the design doc's
`contentHash` composition stale by 11 tables; this is the same class of drift.

1. **`docs/README.md` §4 is stale in three places.** "Head of `main`: `559fb6b`"
   — it is `9296ba7`, 75 commits later. "Visual identity, V0 to V4, on
   `claude/gymrun-visual-identity-overnight-fllr8n`" — merged as PR #13.
   "Working branch: `claude/gymrun-docs-pass-arsdr7`" — merged as PR #9.

2. **`docs/generation.md` §9 contradicts itself about `contentHash`, and
   neither half is marked superseded.** `generation.md:649` — "**It is computed
   over `src/data/**` by glob, not over a list**. Decided 2026-09-10, Release
   0.5." `generation.md:718`, in the same section — "**The hash's input must be
   an explicit file list, not a directory glob.**" The second is dated to Stage
   4.7, which is *earlier* work than the 0.5 decision, so the glob decision
   presumably wins — but nothing in the file says so, and two source files
   (`src/data/archetypes.ts:25`, `src/data/moveTags.ts:40`) instruct the future
   implementer to use the list form. `CLAUDE.md` requires a superseded rule to
   be deleted from the lineage and recorded with a dated note. **Whoever builds
   the `contentHash` release will read one of these two and build the wrong
   thing.** This is the single highest-value fix in this report and it is not
   V5's.

3. **The type wheel is recorded as unbuilt and is built.**
   `docs/spec/README.md:184` — "Not yet implemented: it is UI work and belongs
   to Release B" — and `docs/README.md` open item 5 says the same. The trigger
   came off the panel type badges at `9407178`, before the QoL plan's Release B
   was scheduled. `src/ui/scene.ts:440` is the proof.

4. **`docs/README.md` §6 records a supersession that has not shipped.**
   "**Decline exists in the move learning flow.** Release A retires the 'there
   is no decline' rule from Stage 4.5.1." It does not exist; `src/core/run.ts:1031`
   still states the rule it is said to have retired. A lineage section that
   records a future change as a past one will mislead the next cold session.

5. **`docs/visual/reports/V5.md` quotes a battle measurement that was already
   superseded when it was written.** It says "four move buttons from 612 to 840,
   above the fold by 4px". The correct figures on that same tree are 681.5 to
   946.5, 102.5px *below* the fold — recorded in `docs/visual/baseline/README.md`
   under "Corrections" and itemised in `docs/visual/reports/merge-4.7.md`. V5.md
   read the pre-merge baseline. **This matters because V5.md calls that number
   "V5.1's before table".** It is not; the table in §4 above is.

6. **`docs/balance.md` §0's benchmark table stops at `randomizer-11`.** A
   `randomizer-12` benchmark exists, is committed
   (`sim-reports/benchmarks/2026-09-10T04-12-11-931Z-…`), and is analysed in
   §13.1 — 400 seeds, `RETUNE`, 9.8% completion, 3.41 mean gyms. `CLAUDE.md`
   points at §0 as "the benchmark table", so the row belongs there. Its absence
   is exactly the "read down a prefix" trap the section warns about: a reader
   comparing the next release against §0 would compare it to `randomizer-11`.

7. **`src/core/randomizer.ts`'s version comment is one bump behind its own
   constant.** The comment block ends at "Went to 11 in Stage 4.6c for relics"
   (`randomizer.ts:172`); the constant on line 183 reads `gymrun-randomizer-12`.
   Nothing explains the 4.7 bump at the axis it moved. `docs/generation.md` §11
   carries the argument, so only the pointer is missing.

8. **Release B's "one tooltip mechanism" was already violated before Release B
   was written.** `src/ui/tooltips.ts:15` states the rule ("not a `title`
   attribute and a `:hover` rule") and seven `title` attributes live outside it,
   two of them added by V4 (`screens/summary.ts:193,376`). The QoL plan §1
   inventories the layer as "at least two mechanisms" and means two *tip kinds*
   inside one layer; the actual second mechanism is the native one, and no
   document names it.

9. **The neutral effectiveness marker deviates from the round 2 patch, recorded
   only in a code comment.** Covered in §3 note 3. `CLAUDE.md` requires this in
   `docs/generation.md` with a dated note; `generation.md` has one deviation
   note, §9b, about keyed streams.

10. **The audit prompt's own premises, corrected by the tree.** Three, recorded
    here so the next reader does not re-derive them: there is no
    `sim-report.json` baseline or sha256 in `docs/balance.md` (§4 above names
    what actually carries the contract); V0's woff2 is under `public/fonts/`,
    not under `src/ui/` — `tokens.css:59,68` point at `/fonts/…`; and V0's "zero
    hardcoded colour values in `src/ui/`" holds only for ordinary declarations —
    **24 colour literals survive**, all of them in `src/ui/theme/locales.css`,
    all of them V1's per-locale custom properties, which
    `test/visual-tokens.test.ts` exempts by design (it skips props starting
    `--`). That is correct behaviour, not a leak, but the count is 24 rather
    than 0 and a future audit will find them again.

---

## 6. Findings, not fixed

Nothing under `src/` was touched. Each of these is a one-line or one-paragraph
change somebody wanted to make and did not.

1. **`docs/generation.md` §9's self-contradiction** (divergence 2). The highest
   priority item in this report. One of the two paragraphs must be deleted and
   replaced with a dated supersession note, and the comments in
   `src/data/archetypes.ts:25` and `src/data/moveTags.ts:40` updated to match
   whichever survives. Blocks the `contentHash` release, not V5.
2. **`docs/README.md` §4's three stale facts and §6's premature supersession**
   (divergences 1 and 4).
3. **`docs/spec/README.md:184` and `docs/README.md` open item 5**, both of which
   say the type wheel change is unbuilt (divergence 3).
4. **`docs/visual/reports/V5.md`'s stale before-table** (divergence 5). It is a
   report and reports are records, so the right fix is a dated correction
   pointing at `merge-4.7.md`, not an edit.
5. **The `randomizer-12` row missing from `docs/balance.md` §0** (divergence 6).
6. **`src/core/randomizer.ts`'s comment, one bump stale** (divergence 7). The
   only item on this list that touches `src/`, which is why it was not made.
7. **The SMOKE24 red gate has no expected-failure marker** (§3 note 1), while
   its in-suite twin has one at `test/visual-v0.test.ts:47`.
8. **`renderMove` does not call `moveFacts`, and `moveFacts`'s own doc comment
   says it does.** `src/ui/scene.ts:704` — "The battle button (`renderMove`)
   builds it and then adds the two things that only exist during a fight". It
   does not: `renderMove` (`scene.ts:551-640`) rebuilds `name`, `meta`, `type`,
   `category`, `power`, `pp` and `tags` inline. The two are byte-equivalent
   today, which is the problem — Part 5's "a move looks identical everywhere"
   rule is currently a coincidence rather than a mechanism, and **V5.4 restyles
   "through the existing component" assuming the mechanism.** Whoever runs V5
   should collapse `renderMove` onto `moveFacts` first, or restyle twice.
9. **The berry flag's data source is one call away from being useful.**
   `readConsumedItems` (`driver.ts:1634`) already returns the eaten berries per
   side and is already surfaced at `driver.ts:1501`. R14 is genuinely "almost
   for nothing", as the QoL plan §1 predicted — worth doing inside Release C
   rather than deferring.
10. **`docs/visual/state/` has no `V5.skipped` marker.** The preamble defines
    `.done` and `.failed` only, so a skip leaves no state file and a re-run of
    the loop re-enters V5 and re-checks Release C from scratch. That is the
    correct behaviour and it is undocumented; `V5.md`'s last line ("No marker
    was written for V5") is the only record.

---

## Appendix: gate assertions for this audit

**No file under `src/` changed. No version axis moved.** Asserted on the tree
this report was written from:

```
$ git status --short
?? docs/reports/

$ git diff --stat
(empty)

$ git status --short -- src/ | wc -l
0
```

The only new path is `docs/reports/`, which holds this file. The three live
version axes read exactly as they do on `9296ba7`:

```
export const RUN_LOG_VERSION = `gymrun-run-11/${ENGINE_VERSION}`;
export const RANDOMIZER_VERSION = 'gymrun-randomizer-12';
export const AI_VERSION = 'gymrun-ai-2-switching';
```

Seeded output is byte identical to the post-4.7 baseline, by both instruments
that carry it (`test/sim-fixture.test.ts` and `test/visual-baseline.test.ts`,
both green) and by a field-by-field re-run of the pinned 400-seed benchmark,
which differs only in wall-clock `durationMs`. See section 4.

The measurement in section 4 was taken with a read-only script held outside the
repository, driving the committed `scripts/visual/browser.mjs` against a
`dist/` built from the unmodified tree. Nothing was added to `scripts/`.
