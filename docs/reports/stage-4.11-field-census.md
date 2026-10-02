# Stage 4.11, Tier 0: the field and the triggers, counted

Prompt: [`../spec/gymrun-stage4.11-weather-terrain-and-trigger-visuals.md`](../spec/gymrun-stage4.11-weather-terrain-and-trigger-visuals.md),
Tier 0. Branch `claude/dazzling-archimedes-wc1frw`, 2026-09-25.
Instrument: `scripts/protocol-census.ts`, extended with a second section that
sub-keys the field and trigger lines. The first section is unchanged and its
class table is reprinted below so the two censuses can be read against each
other.

**This is the hard stop the plan asks for: evidence before vocabulary.** The
plan's section 2 made three claims from reading code, and section 7 defaulted
six open questions. This counts the claims and finds one default wrong.

```
npx vite-node scripts/protocol-census.ts --seeds 150 --prefix FIELD
150 runs, 982 battles, prefix FIELD
```

No run ended early. `opponent` was left unset, so every fight used the tiered
bot the real game picks. Every figure is per battle as a union: one sandstorm
writes twenty lines and is one fact. **Read down this prefix, never across to
the Branch 2 census**: the game has moved since (Stage 4.9 levels, the gym
level patches, the moveset patch), and 150 runs now produce 982 battles where
30 produced 699.

## The class table, for continuity with Branch 2

| class | battles | % of 982 | Branch 2, % of 699 |
|---|---|---|---|
| state change (stat stages) | 517 | 52.6% | 59.5% |
| trait fired (ability/item) | 381 | 38.8% | 44.8% |
| volatile (start/end/activate) | 301 | 30.7% | 45.4% |
| field (weather/terrain/side) | 211 | **21.5%** | 23.2% |
| prevented (cant/fail/block) | 142 | 14.5% | 16.5% |
| identity (typechange/forme) | 41 | 4.2% | 2.9% |
| damage shape (recoil/drain) | 0 | 0.0% | 0.0% |

The shape holds. Field is still the fourth most common thing that happens.

## 1. Every weather and every terrain is set by an ability

The plan's claim, from reading `gen-pools.ts`. Counted:

| weather start | battles | % | source |
|---|---|---|---|
| DesolateLand | 32 | 3.3% | ability: Desolate Land, 32 |
| Sandstorm | 26 | 2.6% | Sand Stream 14, Sand Spit 12 |
| SunnyDay | 14 | 1.4% | Drought 9, Orichalcum Pulse 5 |
| RainDance | 10 | 1.0% | Drizzle 10 |
| DeltaStream | 9 | 0.9% | Delta Stream 9 |
| PrimordialSea | 9 | 0.9% | Primordial Sea 9 |
| Snowscape | 2 | 0.2% | Snow Warning 2 |

| terrain start | battles | % | source |
|---|---|---|---|
| Electric Terrain | 32 | 3.3% | Hadron Engine 16, Electric Surge 16 |
| Grassy Terrain | 21 | 2.1% | Grassy Surge 15, Seed Sower 6 |
| Psychic Terrain | 9 | 0.9% | Psychic Surge 9 |
| Misty Terrain | 6 | 0.6% | Misty Surge 6 |

**One hundred percent of both tables carry `[from] ability:`. Zero weather or
terrain starts came from a move**, in 982 battles. Weather starts in 10.2% of
battles, terrain in 6.9%. Trick Room and the side conditions (Stealth Rock
3.7%, Spikes 1.1%, Toxic Spikes 0.9%) are the rest of the field class and are
out of this stage's scope.

## 2. Over half of field starts land in the batch the screen never animates

| | before `|turn|1` | turn 1 or later |
|---|---|---|
| field starts (weather or terrain) | **102 battles, 10.4%** | 75, 7.6% |
| weather starts alone | 56, 5.7% | 51, 5.2% |
| `-ability` lines | 158, 16.1% | 181, 18.4% |

The plan's finding 1 holds and is larger than *some*: 58% of field starts and
47% of ability announcements happen before the first turn line, which
`screens/battle.ts` shows with `animate=false`. Tier 4's first item, running
the marks and the second channel on the opening batch, is the single change
that makes the most of this stage visible.

## 3. The setter never writes an `-ability` line

Sand Stream set 14 sandstorms and appears once in the `-ability` table; Drizzle
set 10 rains and appears zero times; Desolate Land set 32 and appears once.
The engine announces a weather ability through the `[from]` tag on the
`-weather` line and nothing else. The plan's finding 2 holds: today the reader
discards that tag, so a weather-setting ability is the one kind of ability
firing that never produces an `ability` flag or a `trait` beat. Tier 4's
second item reads the tag.

## 4. The primal weathers are half of all weather

**This overturns the plan's open question 5.** The plan defaulted the three
primal weathers to reusing the base marks on the argument that they are
*"three abilities the census has never seen fire"*. The Branch 2 census did
not sub-key weather by kind, and this one does:

| | battles | % |
|---|---|---|
| standard weather (rain, sun, sand, snow) | 51 | 5.2% |
| primal (Desolate Land, Primordial Sea, Delta Stream) | 49 | **5.0%** |

Desolate Land alone is the single most common weather in the game, ahead of
sandstorm, because the ability pool is uniform and the primal abilities are
three entries in it like any other. So the default is wrong in its premise but
right in its remedy for two of the three: Extreme sun *is* sun and Heavy rain
*is* rain, drawn the same and distinguished on inspect (the effect line says
what cannot be done under them). **Delta Stream has no base**: Strong winds is
neither rain nor sun nor sand nor snow, and it needs a mark of its own, a
ninth. D47's four defaults gain a fifth line saying so.

Snow at 0.2% is the marginal one, and it is still drawn: the family is the
four weathers the games have, and a family with a hole in it is the R7 defect
of a glyph that never earns its label, in reverse.

## 5. The end has a channel to carry

| field end | battles | % |
|---|---|---|
| `-weather|none` | 44 | 4.5% |
| `-fieldend` (four terrains) | 17 | 1.7% |

Upkeep lines (`[upkeep]`) repeat on 8.7% of battles. All of it is unread today
and stays unread: the state channel the plan builds carries the end and the
continuation for free, as the background reverting and the glyph leaving the
header. No flag kind. The plan's finding 3 holds.

## 6. The triggers, cut to what fires

**Abilities through `-ability`: 31.5% of battles.** The `ability` flag and the
`trait` beat already exist. The Tier 4 pulse on the panel's ability slot reads
off the same flag and adds no reader.

**Abilities through `-activate`: 7.2% of battles as a union**, and this is the
one thing the plan did not predict. Emergency Exit, Lingering Aroma, Quick
Draw, Toxic Debris, Mummy, Wimp Out, Supreme Overlord, Forewarn: abilities
that fire by writing `|-activate|p1a: X|ability: Y` and **no `-ability` line
at all**. They are abilities firing by any reading of the prompt, and the
census bar Branch 2 set (the prevented class was built at 16.5%, identity
deferred at 2.9%) puts 7.2% on the build side. **Recommendation: not a new
kind.** The existing `ability` flag gains a second pattern, `-activate` whose
effect is `ability: X`, with the same word, the same channel, the same
`trait` class. One regex, one test case. This is a Tier 4 addition to the plan
and is recorded here rather than by editing the plan.

**Moves through `-activate`: 4.6% as a union**, and it is not what the prompt
means. Whirlpool, Fire Spin, Sand Tomb, Bind: the trapping moves announcing a
bind, which the panel already shows as the `partiallytrapped` volatile chip
and the strip as *Bound*. Protect is 0.4%. **Recommendation: not built.** There
is no *move triggered by the field* line in the protocol at all; a Weather
Ball under rain is `|move|` and `-damage` like any other move. The plan's
section 4.3 said this half would be built only if the census earned it, and it
did not.

**Items.** `-enditem` is 11.3% of battles, almost all of it berries (Sitrus
3.4%, Oran 2.5%); the `berry` flag reads it. `-item` (held and revealed:
Frisk, Trick, the odd Sitrus by Pickpocket) is **2.2%** and stays deferred, as
Branch 2 left it.

**Suppression.** Cloud Nine 0.5% and Air Lock 0.4%. The plan's open question 3
(dimmed glyph, half wash) is cheap and stays the default; it is not worth
more than one CSS rule and one projection field.

## What this changes in the plan

Per the deviation rule, the plan is not edited. Three things:

1. **Nine marks, not eight.** Delta Stream's Strong winds is its own glyph.
   D47 carries the line.
2. **A second pattern on the `ability` flag** at Tier 4, for `-activate`
   lines naming an ability, at 7.2%. No new kind, no new class, no new word.
3. **The move half of Tier 4 is not built**, on 4.6% of the wrong thing.

Nothing in the plan's version-axis claim moves: the census is an instrument,
`scripts/` is outside `src/`, and no data table changed.
