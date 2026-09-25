# Stage 4.11 Tier 3: the battle screen under five skies, in every locale

**2026-09-25**, `claude/dazzling-archimedes-wc1frw`. Forty shots in
[`stage-4.11-fields/`](stage-4.11-fields/), `battle-<locale>[-<weather>].png`,
at 390x844 in Pocket, from

```
node scripts/visual/locale-shots.mjs --screens battle --fields none,rain,sun,sand,snow --out docs/visual/reports/stage-4.11-fields
```

The script plays SMOKE24 to its first battle and then re-tags `<html>` with
each locale and each weather in turn, the way the V1 locale report was made:
the same board wearing each sky, which is what the eye is asked to compare.
**Because the sky is re-tagged rather than played into, the header carries no
field glyph in these shots**: the mark comes from the battle's own facts and
this battle has none. A fight that starts under a Drizzle lead wears both, as
[`../../../test/visual-field.test.ts`](../../../test/visual-field.test.ts)
drives it on the gallery's loaded board.

## What each sky is

| kind | wash | texture | motion |
|---|---|---|---|
| rain | `--weather-rain` at 22% | diagonal streaks | falling, `--weather-period-rain` |
| sun | `--weather-sun` at 22% | none | the wash breathes, `--weather-period-sun` |
| sand | `--weather-sand` at 22% | two grain fields | drifting sideways, `--weather-period-sand` |
| snow | `--weather-snow` at 13% | two mote fields | falling slowly, `--weather-period-snow` |
| wind | `--weather-wind` at 15% | level streaks | crossing, `--weather-period-wind` |

Every wash is a `color-mix` of one global token with transparency over the
locale's own art, and every texture is `transform` and `opacity` only, on a
`::before` twice the viewport tall, under the scrim. A terrain tints the near
layer's fill with a third of its token and moves nothing. Under
`prefers-reduced-motion` every animation is cancelled by name and the wash
stays; a suppressed weather is drawn at half with its texture still.

## What the text costs

Measured by `visual-field.test.ts` on the loaded board's locale, the chip
sweep's method: the dominant rendered colour inside the element's box against
its computed colour. The floor is `minChipContrastRatio`, 4.5.

| style | bare sky | rain | sun | sand | snow | wind |
|---|---|---|---|---|---|---|
| `.screen__title` | above floor | above | above | above | above | above |
| `.panel__name` | above floor | above | above | above | above | above |
| `.battle__detail-text` | **7.25** | 5.85 | 5.85 | 5.49 | 5.91 | 5.91 |

The faint detail line is the faintest ink on the screen and pays the most,
about a fifth of its reading, and clears the floor with room under every sky.
The test holds it to the floor and to two thirds of its bare reading, so a
wash that ever cost more than this is a number in a failure rather than a
drift.
