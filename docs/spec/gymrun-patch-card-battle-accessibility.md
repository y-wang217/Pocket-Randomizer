# Patch: card battle sandbox, a colour mode and a language setting

2026-10-09, on `claude/nifty-lamport-6bj8bd`, from `main` at `a8b0c96`. Filed
**before any change to `src/`**, verbatim, as [`README.md`](README.md) rule 7
asks. Two messages from the author: a scoping question, answered with a lift
estimate and no code, then the go-ahead.

The card battler is outside the design bible by the author's ruling
([`gymrun-card-battle-engine-rulings.md`](gymrun-card-battle-engine-rulings.md)),
so this patch touches no rule of it. Scope is the card battle sandbox only; the
rest of GYMRUN is not translated and gains no colour mode.

---

## The first message, verbatim

> okay for the card battler we're working on, can we add a simple (rough) two
> accessibility settings that matter to me personally. 1 is color blind mode,
> other is language. default english, but menu option to change language to
> traditional chinese, simplified chinese, japanese, and german, ukranian,
> spanish, french. what's the lift on that?

## What was answered

The lift, sandbox only: the colour mode small, because the sandbox's colours
are already tokens; the language setting small to medium, because every word
is already in `src/cardData/copy.ts` and its sentences with slots are
functions. Translations machine-drafted and flagged for a native read; German
and Ukrainian length on a 390-wide frame the main risk. The whole game a
different order of lift, and not proposed. Asked which colour deficiency, since
the palette depends on it.

## The second message, verbatim

> I blue green color blind ish otherwise go ahead w the secondary language

## How it is read

"Blue green" is read as a tritan-type deficiency (blue and green confused,
yellow drifting toward pink), so the colour mode is tuned for that rather than
for red-green. "Go ahead" is read as building both settings.
