# Handoff: battle animation run, Branch 2 and 3B, the abnormalities

Branch `claude/busy-noether-jfszvi`, from
[`../spec/gymrun-overnight-battle-animation.md`](../spec/gymrun-overnight-battle-animation.md).
Deviations: [`../generation.md`](../generation.md) sections 23 and 24.
Evidence: [`../reports/battle-anim-2-protocol-census.md`](../reports/battle-anim-2-protocol-census.md).
Report: [`../visual/reports/patch-battle-animation.md`](../visual/reports/patch-battle-animation.md).

## Merged at

Not merged. Code commits `02a3844` (Branch 2) and `79d671f` (Branch 3B), pushed
to `origin/claude/busy-noether-jfszvi`. `main` was not pushed to by this session.

## Version axes

| axis | before | after |
|---|---|---|
| `RUN_LOG_VERSION` | `gymrun-run-15/gymrun-0.3.0` | **none** |
| `contentHash` | `b381d0…` | **none** |
| `AI_VERSION` | `gymrun-ai-3-priority` | **none** |
| `randomizerVersion` | `gymrun-randomizer-15` | **none** |

Flags are derived from the protocol every render and never serialized, so no log
schema moved. `data/flagWords.ts` is on the `contentHash` exclusion list, so the
words moved no hash — verified before and after.

## Baseline for the next branch

- **Test count.** Non-browser **105 files, 1518 tests**, all passing (104/1493
  at the retune). Browser **22 files, 183 tests**, all passing. `lint`, `tsc`,
  `npm run build`, `npm run smoke` green. Duration pin back at **17**.
- **`test/fixtures/sim-report.json` sha256:**
  `72bd4b9d3571b66f0d7d206dc1229e108ba864f6ec7110d51d2aac4933d6487d`, unchanged.
- **SMOKE24:** passed, all checks.
- **Benchmark:** not re-run and does not need to be. Nothing under `core/` that
  a run reads changed — `flags.ts` is a pure reader over the protocol and
  decides nothing.

## Decisions taken

1. **Seven kinds, five classes.** `prevented`, `failed`, `boost`, `unboost`,
   `ability`, `volatile`, `field`. Damage shape **cut on zero** — `-recoil`,
   `-drain`, `-hitcount` appear not once in 699 battles, and the plan had
   drafted words for all three. Identity **deferred** at 2.9%, and `-item` at
   2.1% with it.
2. **Volatiles filtered to `DISPLAYED_VOLATILES`**, the allowlist the panel
   already uses. Takes the class from a raw 45% to a meaningful 4.8% by dropping
   `Charge`, `Doom Desire`, `Salt Cure` — engine bookkeeping with no word a
   player can act on — and means the strip and panel cannot disagree about which
   volatiles exist.
3. **The words went in `data/flagWords.ts`, against the plan.** That file is
   already excluded from the hash, and its two tables are `Record<FlagKind, …>`,
   so splitting the vocabulary would have meant making them partial and losing
   the mechanism that guarantees every kind has a word and a tooltip. The wart
   is neither widened nor fixed.
4. **`settle()` retracts on `failed` too**, unasked. A move that failed did
   nothing, so it made no contact and got no STAB — the identical argument the
   function already makes for a miss.
5. **Beats are concurrent**, riding the causing action's slot. A turn with six
   abnormalities costs what a turn with none costs.
6. **`boost` and `unboost` share one beat.** Direction is a word on the strip
   and a chip on the panel; a beat that rose for one and fell for the other
   would be the board taking a view on which is better.
7. **The reduction lives outside the scene** — see below.

## For the next branch

- **`ui/scene.ts` may not read `.flags` or `.residual`, and the reason is load
  bearing.** `test/boundaries.test.ts`: "a beat that read `flags` would be one
  step from a recoil that grew with the multiplier, which is a verdict drawn on
  the board." Branch 3B's first build broke it with careful comments promising
  not to rank anything — which is exactly what the rule replaces with a
  guarantee. Anything new that wants flag content on the stage goes through
  `ui/abnormality.ts` and is **handed** to the scene.
- **A consumer that finds "the current turn" by looking for actions cannot see
  the turns where nothing acted**, and those are the interesting ones. `|cant|`
  replaces the `|move|` line, so a flinched turn has no action at all.
  `flag-strip.ts` and now `abnormality.ts` both prefer the last group carrying
  flags; a third consumer should copy that, not re-derive it.
- **Two protocol shapes that produce plausible wrong output rather than errors.**
  Weather and terrain name themselves in the line's *first* field, not the third
  where every other flag's payload sits. And a weather line repeats every turn
  it is up — 6.1% of battles — so only a start is an event.
- **`scripts/protocol-census.ts` is the instrument.** Re-run it before adding
  any vocabulary. It cut a whole class to zero that the plan had drafted copy
  for, and refuted two predictions in the same pass.
- **Nothing on the stage may leave the box its body stands in**, and `.stage`
  cannot clip because its two panel children overhang it by design. Smoke cannot
  catch a violation: no outro or abnormality beat runs in a smoke walk. Extend
  `test/visual-battle-outro.test.ts`'s `scrollWidth` assertion instead.
- **No literal `ms` anywhere.** `test/visual-tokens.test.ts` counts them and
  caught a `0ms` delay in this branch. Zero is the initial value; omit the rule.

## Morning decisions

1. **Watch a fight.** Everything is asserted structurally and in a browser, but
   nobody has seen a recall, a capture or an abnormality beat on a phone. In
   particular: whether 750ms with a 6px lunge is right, whether the five beats
   read as five different things, and — the rule the whole patch turns on —
   whether any of them reads as *louder* than the others. If one does, that is a
   defect, not a preference.
2. **The deferred vocabulary.** Identity (2.9%) and `-item` (2.1%) are filed,
   not built. `-fieldend` and `-sidestart` likewise.
3. **Merge to `main`.** This session pushed the branch only. The earlier morning
   decisions still stand, including the one-time `contentHash` move from the
   retune.
