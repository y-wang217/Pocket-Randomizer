# GYMRUN Patch: the bar primitive, and the beats move onto the sprites

Filed before any work, under [`README.md`](README.md) rule 1. Branch
`claude/kind-mccarthy-w3kml6`.

---

## PROMPT, verbatim

> where did we land on the 'jiggle the sprite' on attack or slight animation to hp features? were they included in a patch?
> proposed feature:
> a reusable 'bar' animation in browser to to show 'hp hit' as a chunk disappearing for added effect to impact of the battle. also to useful for showing progress on any future UI features.
>
> Also design a way to show battle animations, giving the fights more impact stick to conventions plan first.

---

## Where the two features landed

Both shipped, in **Release C** (PR #16, merge `846975c`), filed as
[`gymrun-release-c-battle-feedback-amended.md`](gymrun-release-c-battle-feedback-amended.md).
Two things about what shipped shape this patch:

1. **The jiggle is on the stat panel, not the sprite.** Release C item 2
   nudges `.panel` by 2px in resolution order. Sprites only reached the battle
   screen at V5.3, after Release C, and V5.5 moved only the *swap* beat onto
   them. "Jiggle the sprite on attack" does not exist yet.
2. **The HP bar was de-animated on purpose.** Release C item 1 makes the fill
   snap to the new value with no width transition and leaves a shadow over the
   span it vacated, fading over `--motion-hp-shadow`. That is already the
   "chunk disappearing". What is missing is that it lives only inside the
   battle panel's code in `scene.ts`, while five other files hand-build the
   same track and fill with no chunk and a copy-pasted band ternary.

## The three decisions, taken 2026-09-15 before any code

| question | decision |
|---|---|
| Does the sprite lunge replace the panel nudge, or run beside it? | **Replace.** Same argument V5.5 made when it moved the swap beat: two animations for one event is noise, and the panel is a scrim over the body that acted. The panel-nudge rule is deleted and recorded as superseded. |
| How far does the bar primitive migrate? | **All six sites**: battle panel, bench, party member card, item target, acquisition, run map. DOM shape and class names unchanged. |
| Which beats? | **Lunge, hit, faint.** Attacker lunges in resolution order; the defender recoils when, and only when, its bar drew a chunk; a KO'd sprite sinks and stays down until replaced. |

## What the patch does

**`src/ui/bar.ts`.** One factory, `createBar({ variant, shadow })`, returning
`{ root, fill, shadow, set(fraction, { chunk }), cancel() }`. `set` owns the
band colour and the chunk-on-decrease rule exactly as Release C wrote it
(first draw never chunks, a heal clears, `chunk: false` for a swap, the
`MIN_CHUNK` floor, restart rather than extend). It returns whether a chunk was
drawn, which is what lets the hit beat agree with the chunk by construction.
Variants `hp`, `slim`, `neutral`; `neutral` never writes a band and is the
"any future UI feature" half of the ask.

**The beats.** All on `.stage__actor` and its `.sprite`, all `transform` and
`opacity` only, all driven by `data-*` attributes set in `scene.ts` from the
same `turns` reading the log and the flag strip already share, and all
inside the one `--motion-duration` budget:

| slot | beat | attribute | delay | length |
|---|---|---|---|---|
| 1 | lunge, first actor | `data-acted="1"` | 0 | D/4 |
| 2 | hit, its target | `data-hit="1"` | D/4 | D/4 |
| 3 | lunge, second actor | `data-acted="2"` | D/2 | D/4 |
| 4 | hit, its target | `data-hit="2"` | 3D/4 | D/4 |
| — | faint, reusing `sprite-sink` | `data-fainting` | its hit's slot | the rest of D |

The hit is the same size for every hit. The beat never reads a flag: a super
effective hit is not a bigger recoil, because the chunk already says how big
the hit was and a heavier beat would be a verdict.

## Versioning

Moves nothing. No `core/` change, no `data/` change, no version axis, seeded
output byte-identical by both instruments.

## Gates

Every absolute gate in `CLAUDE.md`; `test/visual-tokens.test.ts`'s hardcoded
duration pin stays at 17; `docs/visual/baseline/` compared and re-recorded in
the same commit only if it moves.
