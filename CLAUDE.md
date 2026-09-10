# CLAUDE.md

Invariants for GYMRUN. A rule is here because it has held across every stage and
is expected to hold for every future one. If a future stage could reasonably
reverse it, it does not belong here.

Current state, stage progress, open items and balance numbers are **not**
invariants. They live in [`docs/README.md`](docs/README.md) and
[`docs/balance.md`](docs/balance.md), which change constantly.

Justifications are deliberately absent. Each section points at the document that
carries the argument.

## Architecture

- `core/` never imports from `ui/`. Asserted by `test/boundaries.test.ts` and by
  `eslint.config.js`, because lint is easy to disable inline.
- `core/` contains no DOM access, no timers and no side effects. `playRun`
  completes headless under Node.
- `@pkmn/sim` is confined to the adapter. Everything above it speaks
  `core/types.ts`.
- Every balance or copy number a tuning pass would touch lives in `data/`. If
  tuning requires editing logic, the split is wrong.

Argument: [`docs/architecture.md`](docs/architecture.md).

## Randomness

- `Math.random` is banned everywhere. All randomness comes from `core/rng.ts`.
- All randomness comes from keyed sub-streams, `rng.at(key)`. The sequential
  stream API is deleted, not deprecated.
- Keys are stable strings, declared in `core/streamKeys.ts` as functions rather
  than literals. A key names a thing that draws, never a moment in time.
- **A key must never be derived from anything that varies with player
  behaviour.** No turn counts, no party size, no visit counts. This is the
  discipline the whole keyed derivation rests on.
- Everything structural is drawn at map generation, in one pass, including
  branches the player will never visit. Nothing is drawn lazily at node entry.
- Draws that depend on player state draw **every** possible outcome at
  generation and select at resolution, so RNG consumption is constant regardless
  of how the player built their run.
- Player decisions consume no RNG. They are inputs, they serialize into the log
  in order, they do not draw.

Design: [`docs/spec/gymrun-seeds-and-mappability.md`](docs/spec/gymrun-seeds-and-mappability.md).
What shipped: [`docs/keyed-streams.md`](docs/keyed-streams.md).

## Versioning

Four axes, each with its own meaning:

| axis | covers |
|---|---|
| `contentHash` | the data tables |
| `RUN_LOG_VERSION` | the decision schema |
| `RANDOMIZER_VERSION` | draw composition |
| `AI_VERSION` | opponent policy |

- A mismatch fails loudly, and the message names which axis mismatched and both
  values. **Never silently reinterpret a seed.**
- A run log version bumps only when a logged decision is added, removed,
  reordered or reshaped.
- `contentHash` is specified but not yet built. It is its own release, after
  4.6c and before the freeze, and it is not to be built as a side effect of a
  data step. See [`docs/generation.md`](docs/generation.md) section 9.

## Player-facing copy

- The UI presents attributes, never verdicts. No recommendations, no "best"
  markers, no scores or ratings, no highlighting that distinguishes a superior
  option, no ordering that implies ranking, no effectiveness against content the
  player has not reached.
- **One exception:** live type effectiveness against the Pokemon currently on the
  field. That is a fact about the present board, not a hint about a future
  decision.
- Post-resolution flag words are truths read off the protocol. Pre-selection
  markers are forecasts. They are different systems and neither derives from the
  other.

## Rewards

- Every offer is exactly 3 distinct options. No skip at the card, no reroll.
- Every node completion routes through the single result screen. There is never
  a second path by which a node completes.

## Process

- UI comes last in every stage. If a mechanic cannot be shown to work headless,
  polish does not fix it.
- **Where a prompt says to report before writing code, that is a hard stop.**
- Commit at each checkpoint and stop for review.
- Every prompt is committed to `docs/spec/` verbatim **before** any work begins
  on it. A session must not begin implementation work from a prompt that is not
  there. Protocol: [`docs/spec/README.md`](docs/spec/README.md).
- Where built work deviates from its prompt, do not edit the prompt. Record the
  deviation in `docs/generation.md` with a dated note. A prompt is a record of
  what was asked, not a description of what exists.
- Blacklist and override table entries start near empty, are populated only from
  simulator evidence, and each carries a comment saying why. "It feels strong"
  is not a reason.
- A superseded rule is deleted from the lineage and recorded with a dated note in
  `docs/generation.md`. It is never left behind a flag.

## Gates and balance

Absolute gates: determinism, stream isolation, version guards, type check, lint,
build, strict trim, smoke run, and the full suite.

- **Balance is not a gate.** Record the number and keep going. Compare against
  the pinned benchmark at each major release rather than stopping to retune.
- Do not retune between checkpoints, and do not move a target to make a miss
  disappear.
- Benchmark on **mean gyms cleared**, not completion rate. Completion is a
  rare-event statistic that discards every run that died early.
- Every benchmark figure is stamped with its seed prefix and seed count in the
  file, next to the number. **Read down a prefix, never across.**

Standing policy and the benchmark table: [`docs/balance.md`](docs/balance.md)
section 0.

## Where to find things

| you want | read |
|---|---|
| current state, what is in flight, open items | [`docs/README.md`](docs/README.md) |
| the design lineage and the prompt register | [`docs/spec/README.md`](docs/spec/README.md) |
| what is drawn where and when | [`docs/generation.md`](docs/generation.md) |
| balance history and every number | [`docs/balance.md`](docs/balance.md) |
| layers, seams and run logs | [`docs/architecture.md`](docs/architecture.md) |
| `@pkmn/sim` findings and the bundle | [`docs/engine-notes.md`](docs/engine-notes.md) |
