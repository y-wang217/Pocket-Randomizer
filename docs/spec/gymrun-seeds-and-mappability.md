# GYMRUN: Seeds, Versioning, and Whether Runs Are Still Mappable

Companion to `gymrun-stage4.6-claude-code-prompts.md`. Read this before starting 4.6a. It contains a refactor that Part A depends on.

---

## The question, split in two

"Are runs still mappable" is two properties that have been treated as one, and they have different answers.

**1. Replay determinism.** Same seed plus same decision log reconstructs the same run, inside one build. This is a correctness property. Save and resume depends on it, the simulator depends on it, and bug reports depend on it. It must never break.

**2. Seed portability.** A seed string means the same run across builds and across players. This is a product feature. It is what makes shared seeds, daily seeds, and "beat my run" work.

4.6 threatens only the second one, and it threatens it three times, once per sub-stage. Nothing here endangers the first.

---

## Why the current mechanism does not survive 4.6

Today the protection is `randomizerVersion` plus the run log version, both bumped by hand, with a loud rejection on mismatch. That is correct behaviour and it should stay. The problem is what forces the bump.

Streams are sequential. Every draw comes off a stream in order, so **inserting one new draw anywhere shifts every draw after it on that stream**. That is why the 4.5.1 gym reward pool had to be appended as a sixth pass: it was the only way to add draws without shifting the map and battle streams for existing seeds.

Appending a pass works once. It does not work for 4.6, which adds:

- Locale offers, and a route per offered locale. (4.6a)
- Wild encounter placement and species. (4.6a)
- Banded move draws replacing flat move draws. (4.6b)
- Berry hold rolls on trainer and wild mons. (4.6b)
- Three band outcome sets per event, plus a band 3 encounter spec. (4.6c)

Done sequentially with appended passes, that is a stack of six or seven passes in a fixed order that nobody can safely reorder afterward, three `randomizerVersion` bumps in a row, and a stream isolation test suite that has to be rewritten at each sub-stage to prove something that should be structurally true.

---

## The fix: keyed sub-streams

Replace sequential streams with streams derived by key. A child PRNG is derived by hashing the run seed with a stable string:

```ts
rng.at('locale:segment3:offer')
rng.at('rewards:segment3:node2:offer')
rng.at('rewards:segment3:node2:event:band:known')
rng.at('randomizer:segment3:wild:species')
```

Each key gets its own independent generator seeded from `hash(runSeed, key)`. Draw order stops existing as a global concept.

**What this buys.**

- Adding a draw creates a new key. It cannot shift any existing key, by construction, not by convention.
- Stream isolation stops being a property you test per stage and becomes a property of the derivation. The test becomes one test, written once: inserting a draw under an arbitrary key leaves output under every other key byte identical.
- 4.6b and 4.6c should not need a `randomizerVersion` bump at all for their new draws. They bump only for the content changes described below.
- Sub-stages stop invalidating each other's seeds mid-development.

**What it costs.** One refactor, done as step 1 of 4.6a, before any locale work. Every existing draw site moves from `rng.stream('map')` to a key. The existing determinism tests are the safety net: the refactor is done when they pass unchanged.

**The one discipline it requires.** Keys must be stable strings, never derived from anything that varies with player behaviour. A key containing a turn count or a party size reintroduces the exact coupling this removes. Write that rule into `docs/generation.md` next to the existing entries.

---

## Two version axes, not one

Once streams are keyed, what actually invalidates a shared seed is not code, it is content. Separate the axes:

**`contentHash`.** A hash computed at build time over the data tables: `speciesPools`, `movePools`, `scaling`, `rewardPools`, `locales`, `items`, `hms`, `events`, `blacklists`, `starters`, `tuning`. Any change to a balance number changes the hash. Code changes that do not touch data do not.

This replaces hand-bumped `randomizerVersion` with something that cannot be forgotten, which matters because a forgotten bump is the failure mode that silently reinterprets a shared seed. The hand bump is a discipline problem and disciplines fail. A hash does not.

**Run log version.** Bumps when the *decision schema* changes: a new logged decision, a reordering, a changed shape. 4.6a adds locale selection and capture decisions, 4.6b adds nothing, 4.6c adds HM teaching. So the log version bumps at 4.6a and 4.6c, and it is independent of `contentHash`.

Both go in the log. Replay checks both. Mismatch on either fails loudly with a message naming which axis mismatched and what the two values were.

---

## Seed strings carry their content

Right now a seed is a bare string, so a mismatch is only detectable at replay time, after the player has already committed. Make the shareable identity carry its version:

```
GYMRUN-a3f91c-8827364
        ^        ^
        |        run seed
        contentHash, first 6
```

Pasting a seed with a foreign content hash is caught at paste time, with a message that says the seed was made on a different balance version and will not reproduce. The bare seed still works for a fresh run, it just is not a promise of the same run.

This is the piece that makes the Stage 5 daily seed and seed sharing links actually work, and it is much cheaper to build now than to retrofit onto seeds already in circulation.

---

## Are runs mappable? Yes, and more so after this

Keyed streams make something possible that sequential streams did not: **generating the full map without playing it.**

Because every structural draw is keyed and none of it depends on battle outcomes, `previewRun(seed, contentHash)` can produce the entire run topology in milliseconds, with no battles simulated:

- Every segment's locale offers.
- The route under each offered locale, node types and tiers.
- Wild encounter placement and species pool.
- Reward offers at every node.
- Event capability requirements and all three band outcomes.
- Shop stock.

What it cannot produce is anything downstream of a player decision or a battle roll: which locale gets picked, what the party looks like, which event band resolves, whether the run is won.

Three uses, in order of near term value:

1. **Balance work.** Inspecting a thousand maps without simulating a thousand runs is orders of magnitude faster than the current report loop, and it answers the structural questions directly. Does every segment really contain a rest? Do locales distribute evenly? Is any capability required more often than any other?
2. **Bug reports.** A seed plus a preview is a complete reproduction of the structural half of any bug, with no replay needed.
3. **Stage 5.** Seed sharing pages, daily seed previews, and a spectator layout all read off this.

Build `previewRun` as part of the 4.6a stream refactor while the derivation is fresh. It is a thin function over keyed streams and it is a poor retrofit later.

---

## What to accept during 4.6 development

Seeds shared during 4.6a, 4.6b, and 4.6c are disposable. Each sub-stage changes data tables, so each changes `contentHash`, so no seed survives the patch. Do not spend any effort preserving cross-sub-stage seed compatibility. It has no user and it will constrain the tuning passes, which are the point.

**Freeze at the end of 4.6c.** Once the retune from 4.6b and the gate rates from 4.6c have settled, stamp that `contentHash` and treat it as the first shareable baseline. Everything before it is development. Everything after it moves seeds deliberately, with the hash making the move visible.

---

## Order this implies for 4.6a step 1

1. Implement `rng.at(key)` with a stable hash derivation, alongside the existing sequential streams.
2. Port every existing draw site to a key. Existing determinism tests must pass unchanged against ported call sites, with the *values* allowed to change since the derivation is new. This is the one and only intentional seed break of the refactor.
3. Delete the sequential stream API entirely. Leaving both means someone uses the old one.
4. Write the single isolation test: a draw inserted under an arbitrary key leaves output under all other keys byte identical.
5. Add `contentHash` computed over the data tables, put it in the run log next to the run log version, and make replay check both.
6. Build `previewRun`.
7. Bump `randomizerVersion` once, or retire it in favour of `contentHash` if you prefer one mechanism. Retiring it is cleaner but check nothing else reads it first.

Then start locales.
