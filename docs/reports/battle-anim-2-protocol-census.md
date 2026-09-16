# Branch 2 step 1: what the engine actually says

Prompt: [`../spec/gymrun-overnight-battle-animation.md`](../spec/gymrun-overnight-battle-animation.md),
Branch 2. Branch `claude/busy-noether-jfszvi`, 2026-09-16.
Instrument: `scripts/protocol-census.ts`.

**This is the hard stop the branch prompt asks for: evidence before vocabulary.**
`CLAUDE.md` says table entries "are populated only from simulator evidence"; a
word for an event no fight produces is dead copy, so the vocabulary is cut to
what fires rather than built to what seems likely.

```
npx vite-node scripts/protocol-census.ts --seeds 30
30 runs, 699 battles, prefix CENSUS
```

No run ended early. `opponent` was deliberately left unset, so every fight used
the tiered bot the real game picks rather than one pinned policy.

## By class — the number the decision turns on

Branch 3B animates one beat per **class**, and a battle carrying four different
stat drops is one battle that wants one "state change" beat. So this is the
union per battle, not a sum of rows.

| class | battles | % of 699 | verdict |
|---|---|---|---|
| **state change** (stat stages) | 416 | **59.5%** | build |
| **volatile** (start/end/activate) | 317 | **45.4%** | build |
| **trait fired** (ability/item) | 313 | **44.8%** | build |
| **field** (weather/terrain/side) | 162 | **23.2%** | build |
| **prevented** (`cant`/fail/block) | 115 | **16.5%** | build |
| identity (typechange/forme) | 20 | 2.9% | **defer** |
| damage shape (recoil/drain/hitcount) | 0 | **0.0%** | **cut** |

## The census refuted two predictions, which is why it was run

The branch plan guessed at this table before measuring. It was wrong twice, and
both errors would have shipped.

**1. "Weather and terrain may never fire at all on the shipped move pools."**
Wrong by a wide margin. `-weather` is on 12.3% of battles and `-fieldstart` on
9.6%; as a class, **field is 23.2%** — the fourth most common thing that
happens. Cutting it on the guess would have left a quarter of battles with an
unexplained change to the whole board.

**2. "`|cant|` fires often — build it first."** `cant` is on 6.3% of battles and
the whole prevented class is 16.5%: real, and the **least** common of the five
that survive. The argument for building it first was never frequency, it was
that a turn where nothing happens is the abnormality a player most wants named,
and that argument stands. But it is not the headline.

**The actual headline is stat stages at 59.5%.** Well over half of all battles
contain a stat change that the player is never told about *as an event*. The
panel shows the resulting stage as a chip — present tense, what is true now —
and nothing marks the moment it moved.

## The two classes that do not earn a word

**Damage shape: cut, on zero.** `-recoil`, `-drain` and `-hitcount` appear
**not once** in 699 battles. The plan listed the class and drafted words for it;
all of it would have been dead copy — a tooltip, a test and a reader's attention
spent on something no fight produces. This row alone justifies the instrument.

**Identity: deferred, on 2.9%.** `-start|typechange` is on 1.6% of battles.
`core/battle/flags.ts` already *reads* typechange for STAB purposes, so the
truth is available and only the word is missing; it can be added later with no
new protocol reading. Not built now, because at 2.9% it would be the least-seen
beat in the game.

## Sub-keys, and why the bare tag is not enough

`-start`, `-end`, `-activate`, `-fail` and `-immune` carry the effect in
`parts[3]`; `-boost`/`-unboost` carry the stat. One `-start` count says nothing
about whether it was confusion, a substitute or a type change — and those want
different words. The long table shows why: `-start|confusion` is on 8.4% of
battles while `-start|Salt Cure` is on 0.4%, and a vocabulary built on the bare
tag would have treated them as one thing.

Most common sub-keys, for the word list:

| line | battles | % |
|---|---|---|
| `-ability` | 279 | 39.9% |
| `-unboost\|spe` | 132 | 18.9% |
| `-unboost\|spa` | 114 | 16.3% |
| `-unboost\|def` | 90 | 12.9% |
| `-weather` | 86 | 12.3% |
| `-unboost\|spd` | 80 | 11.4% |
| `-fail` | 76 | 10.9% |
| `-boost\|spe` | 73 | 10.4% |
| `-fieldstart` | 67 | 9.6% |
| `-boost\|spa` | 64 | 9.2% |
| `-start\|confusion` | 59 | 8.4% |
| `-unboost\|atk` | 57 | 8.2% |
| `-activate\|confusion` | 46 | 6.6% |
| `cant` | 44 | 6.3% |

Note `-unboost` outnumbers `-boost` on every stat. The opponent AI uses stat
drops more than the player's greedy baseline uses boosts, so **the common case
is something being done *to* the player** — which is the case a readout most
needs to explain.

## One caveat the count carries

Battles cut off at `TURN_LIMIT` are truncated, so weather and other residual
end-of-turn lines are **under**-counted. Every figure here is a floor: a class
that looks marginal is marginal or better, never worse. That strengthens the
cut of damage shape (zero is zero) and weakens the deferral of identity only
slightly.

## What Branch 2 builds, on this evidence

Five classes, in frequency order: **state change, volatile, trait fired, field,
prevented.** Identity deferred, damage shape cut.

Order of work is not frequency order, though. `prevented` is built first
regardless, because it is the only class whose events are *invisible by
construction* — a flinched turn produces no damage, no chunk and no beat, so
today it is indistinguishable from a turn that did not happen. The other four
at least leave a changed panel behind.


---

# Step 2: what was built, and how it measured

Seven kinds in five classes. Verified by replaying 20 fresh runs (**438
battles**, prefix `FLAGCHK`, tiered opponents) and reading the flags back
through `readFlags` — the same reader the strip uses — rather than by counting
protocol lines a second time.

| kind | % of battles | census comparison |
|---|---|---|
| `unboost` | 52.5% | state change class 59.5% as a union with `boost` |
| `boost` | 26.0% | " |
| `ability` | 35.2% | trait fired 44.8% less `-item`, deferred |
| `field` | 18.3% | field 23.2% less `-fieldend`/`-sidestart`, not built |
| `failed` | 9.8% | part of prevented 16.5% |
| `prevented` | 5.3% | census `cant` 5.7% — **essentially exact** |
| `volatile` | 4.8% | narrowed from a raw 45% by the panel's allowlist |

`prevented` landing within 0.4 points of the census figure for the line it reads
is the strongest single check here: two independent instruments, one counting
protocol lines and one reading flags through the shipped reader, agreeing on the
same event.

The gaps are all deliberate and named above: `-item` and `-fieldend` are not
built, and the volatile filter is doing exactly what it was added for — a raw
`-start` flag would have fired on 45% of battles, most of it `Charge` and
`Doom Desire`, which are not things a player can act on.

Sample flags, one per kind, taken from the same run:

```
Rhyhorn:    ability(Intimidate)      Salazzle:   field(Sandstorm)
Aster:      prevented(slp)           Aster:      volatile(confusion)
Gimmighoul: unboost(spa)             Alomomola:  boost(spe)
Galvantula: failed(-)
```

## The words

Checked directly rather than inferred. Part 4 holds throughout — each is a
restatement of a protocol line, and none says whether what happened was good:

```
prevented flinch          -> "Flinched"        boost  atk      -> "Attack rose"
prevented par             -> "Fully paralysed" unboost spe     -> "Speed fell"
prevented slp             -> "Asleep"          unboost spa     -> "Sp. Atk fell"
prevented frz             -> "Frozen solid"    ability Intimidate -> "Intimidate"
prevented ability: Truant -> "Truant"          volatile confusion -> "Confused"
failed    -               -> "Failed"          field  RainDance -> "Rain"
                                               field  SunnyDay  -> "Harsh sunlight"
```

A stat stage says **which stat and which way, and not how far**. The panel's
stage chip beside it already carries the magnitude, and a word that grew with
the number would be the mistake `--hit-recoil`'s comment names: a verdict on the
board rather than a fact about the turn.

An unfamiliar `cant` reason is still shown, in sentence case, on the same
argument the `status` fallback already makes — a word the player has not seen
before is one they can look up, and a silent gap is not.
