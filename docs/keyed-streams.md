# Keyed streams: what Stage 4.6a shipped

How a GYMRUN seed becomes a run, why that stopped scaling at Stage 4.5.2, and
what Stage 4.6a changed about it.

This is the **implementation record**. The design it implements is
[`gymrun-seeds-and-mappability.md`](spec/gymrun-seeds-and-mappability.md) in
`docs/spec/`, which the 4.6 prompts reference by name.

This file was written during Stage 4.6a, before that design document was
available — the prompt referred to it as existing and it was not in the
repository, so 4.6a was built from the prompt's description of it and the
reasoning was recorded here. The design document has since arrived, and the
two do not agree everywhere: three of its requirements were not built, and
they are listed under "Not yet built" at the end. Read
[`generation.md`](generation.md) alongside this — that one says what a seed
produces, this one says why the draws are arranged the way they are.

---

## 1. The problem

A seed produces five independent sequences: `map`, `rewards`, `battle`,
`randomizer`, `policy` (`src/core/rng.ts`). The split has been load-bearing
since Stage 2 and it solved exactly one problem — **one system cannot move
another system's rolls**. Adding a reward draw cannot reshuffle a map.

It never addressed the other half. Within one stream, every draw in a whole run
came off one sequence in one order:

```
map: [seg 0 steps][seg 0 kinds][seg 0 tiers][seg 1 steps][seg 1 kinds]...
```

So a draw added anywhere shifted everything after it. That is why every stage
from 3 onward *appended* a generation pass rather than editing one, and why
`docs/generation.md` called the pass list a contract whose only legal edit was
to grow downward. It worked, and it cost a `RANDOMIZER_VERSION` bump — a full
retune — every time a stage needed a draw in the middle.

Stage 4.6 needs draws in the middle three times:

- **4.6a** draws a locale offer per segment, and a route *per offered locale*.
- **4.6b** draws banded moves and rekeyed reward pools.
- **4.6c** draws three outcome sets per event instead of one.

Under sequential streams that is three bumps and three balance reports, each of
which moves every number for a reason unrelated to what the stage changed. The
whole point of the split below is to make it **one**.

## 2. Keyed sub-streams

A named stream now opens sub-streams by key:

```ts
rng.map.at('seg3/cave/route')      // an independent sequence
rng.randomizer.at('node/s3-cave-2-0')
rng.rewards.at('node/s3-cave-2-0/offer')
```

Each is `sfc32(cyrb128('gymrun:<stream>#<key>:<seed>'))` — the same construction
the five streams already used, one level down. Two keys are as independent as
two streams, because they are the same mechanism.

Sub-streams are **memoized per key**, so asking twice continues one sequence
rather than restarting it. A version that rebuilt the sequence per call would
make a draw a function of how many times the caller asked, which is the bug
class this exists to remove.

The separator is `#` because it appears in neither a stream name nor a
normalized seed (`A-Z0-9`). With a plain `:`, the triple (`map`, `a`, `b`) and
(`map`, —, `a:b`) would hash to one domain string. `test/stream-keys.test.ts`
asserts that directly rather than trusting the argument.

### What a key names

**A thing that draws, never a moment in time.** `node/s3-cave-2-0` is a key;
"the fourth draw of segment 3" is not. That is the whole discipline, and it is
what makes a key stable across a change to everything around it.

`src/core/streamKeys.ts` holds every key in the game, as functions rather than
literals, because two call sites spelling one key differently is two sequences
where one was intended and nothing would report it.

| stream | key | draws |
|---|---|---|
| `randomizer` | `starters` | the starter options |
| `map` | `seg<i>/locale-offer` | which locales a segment offers |
| `map` | `seg<i>/<locale>/route` | that route's steps, kinds, fix-ups, tiers |
| `randomizer` | `node/<id>` | that node's team |
| `battle` | `node/<id>` | that node's sim PRNG seed |
| `rewards` | `node/<id>/offer` | the three cards |
| `rewards` | `node/<id>/shop` | the shelf |
| `rewards` | `node/<id>/event` | the prompt and its resolved outcomes |
| `rewards` | `seg<i>/gym-reward` | the gym clear offer |

One key on two streams (`node/<id>` on `randomizer` and on `battle`) is safe and
deliberate: the streams are domain-separated by name first, so those are two
unrelated sequences. It means "everything about node x" is one thing to name.

### Purposes are separated even where they cannot co-occur

A node is a fight *or* a shop *or* an event, so one `node/<id>` key on `rewards`
would work today. It is three keys anyway, because "cannot co-occur" is a
property of this stage's node kinds and a key is forever. The moment an event
node also pays a card, separate purposes mean a new draw in a sequence nothing
else reads.

## 3. What this buys, precisely

**A new key moves nothing.** Not "moves little" — nothing. The sequence for
`seg3/cave/route` is a pure function of the seed, the stream name and that
string, so a stage that adds `seg3/cave/weather` has not touched it.

**A new draw inside an existing key moves only that key's own later draws.**
4.6b adds a band draw to a node's reward offer: that node's cards change, and no
other node's do — not the node beside it, not its team, not its sim seed.

**Generation order stops being a contract.** The passes in
`core/encounters.ts` are still passes, because pass 2 needs pass 1's kinds and
because they read well. They are no longer a draw order, so reordering them is a
refactor rather than a break. "The list only ever grows downward" is retired.

### Why 4.6b and 4.6c should not need a `randomizerVersion` bump

They will each change what a seed *rolls*, so both will still bump the version —
that is what the string is for, and neither stage is claiming otherwise.

What they will not need is a bump **for structural reasons**. Under the old
streams, 4.6b's reward rekey would have moved every `rewards` draw in the run
and therefore every acquisition and every shop shelf in every seed; 4.6c's
three-outcome events would have done it again. Those are the bumps this refactor
removes: after 4.6a, a stage's blast radius is the keys it actually touches, so
its balance report can attribute a change to the thing the stage changed. A
stage that adds draws only under new keys — 4.6c's band-3 encounter spec is
designed to be exactly that — can land without moving a single existing roll.

That is also what makes the 4.6c requirement "RNG consumption is identical
regardless of which band resolves" cheap to satisfy: draw all three bands under
one key at map generation and the consumption is fixed by construction.

## 4. Mappability

Locale selection (4.6a) is the first thing in the game where **the player picks
which generated content is real**. A segment offers two or three locales and a
route exists for each.

Keying makes the two candidate implementations equivalent:

- Generate every offered locale's route up front and discard the unpicked ones.
- Derive the picked locale's route at selection time.

Both produce the identical route, because the route is a function of
`(seed, 'map', 'seg<i>/<locale>/route')` and nothing else — not of when it was
generated, not of what else was generated first. **4.6a takes the first**, for
one reason: eager generation is already the rule the codebase is built on
(`docs/generation.md` §1), and a lazy path would be a second way for content to
come into existence, differing from the first only in circumstances nobody would
think to test.

The cost is three routes generated where one is walked, which is a few hundred
microseconds and some data nobody sees.

## 5. What is still a contract

Keying removes the *global* draw order. It removes nothing else.

- **Within one key, order is still a contract.** A node's team is species,
  level, ability, moves, gender, member by member. Inserting a draw in the
  middle of that reshuffles that node — and only that node, which is the
  improvement, but it is still a change every seed feels.
- **Eager generation is still the rule.** Contents are drawn for options the
  player never takes. Keying means a lazily drawn node can no longer corrupt a
  *different* node; it does not stop the node itself depending on when it was
  visited.
- **A reward is still drawn at map generation, never at node completion.** That
  argument was never about stream layout — it is that a draw taken after a fight
  is a draw that depends on how the fight went.
- **Player decisions still consume no RNG.** A locale pick, a capture, a
  release: all are inputs, all serialize into the log in order, none draw.

## 6. Version guards

`RANDOMIZER_VERSION` went to `gymrun-randomizer-7` for 4.6a, and it is the
broadest bump the string has carried. Not one line of *what a Pokemon is*
changed and not one draw moved within its own function — but a value that used
to be the four hundredth off `randomizer` is now the third off
`randomizer#node/s2-1-0`, so every seed rolls a different run. That is exactly
the class of change the string exists to make loud: a 4.5.2 log replays
perfectly and is not the run it recorded.

`RUN_LOG_VERSION` moves separately, when the *questions* change — 4.6a adds a
locale decision, so it moves too. Two guards, two messages, because a reader
diagnosing a rejected log wants to know whether the questions changed or the
answers would now mean something different.

## 7. The tests that hold this up

`test/stream-keys.test.ts`, six groups:

1. Draining one key by ten thousand draws moves no other key and no other
   stream.
2. A key gives the same values however much was drawn elsewhere first, and
   `at(k)` twice is one sequence rather than two.
3. Opening a key that never existed moves nothing.
4. One key on two streams, two seeds, or against another key: three different
   sequences.
5. A key cannot collide with the unkeyed sequence, including the `#` case above.
6. A whole run's generation leaves every *unkeyed* sequence at zero draws, one
   segment generates identically whatever was generated before it, and one seed
   generates one run twice.

Property 6 is the one that catches the regression that matters: a new draw added
straight onto `rng.map` instead of onto a key would pass every other test in the
suite and quietly reintroduce the global order.


---

## Not yet built

Three requirements of `gymrun-seeds-and-mappability.md` are not implemented,
because 4.6a was built before that document was available. None of them is
contradicted by what shipped; all three are additive.

**`contentHash`.** The design replaces the hand-bumped `RANDOMIZER_VERSION`
with a hash computed over the data tables, on the grounds that a hand bump is a
discipline and disciplines fail. `RANDOMIZER_VERSION` is still a hand-edited
string in `core/randomizer.ts`, and it has already been bumped eight times.

**Seed strings that carry their content hash.** Seeds are still bare strings,
so a foreign seed is only caught at replay time rather than at paste time.

**`previewRun`.** Generating a whole map without playing it is possible now
that draws are keyed — nothing structural depends on a battle outcome — but the
function does not exist.

The design also asks that the unkeyed stream API be deleted outright, so that
nobody reaches for it. It is still exported and still drawable; nothing in
generation uses it. Deliberately left for its own commit: nothing in generation
draws off it, so it is not urgent, and deleting an exported API inside a stage
that is changing behaviour makes one commit answer two questions.

### When the three land

All three are **one release, scheduled after 4.6c and before the freeze.** That
ordering is forced rather than chosen: the freeze stamps a `contentHash` as the
first shareable baseline, so the freeze cannot happen until the hash exists.

They are explicitly not to be built inside a data step. The decision came up at
the 4.6c prerequisite, where the prompt asked for a new generated table to be
added to "the `contentHash` file list" — a list that does not exist. Building
the hash mechanism there would have shipped it as a side effect of a table
nobody was reviewing it for. The hand bump carries 4.6c instead, with the
failure mode the design names: a forgotten bump silently reinterprets a shared
seed. `docs/generation.md` section 9 records it from the other side.
