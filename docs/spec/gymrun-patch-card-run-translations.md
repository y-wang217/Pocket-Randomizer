# Patch: card run, its menus in every language

2026-10-12, on `claude/brave-bardeen-54slbx`, from `main` at `3938a86` (#116
merged: the card run's menus in the mock's art). Filed **before any change to
`src/`**, verbatim, as [`README.md`](README.md) rule 7 asks.

## The author's message, verbatim

> new ask: translations for accessibility of all new menus

## How it is read

"Accessibility" is the language setting the author asked for on the card
battle ([`gymrun-patch-card-battle-accessibility.md`](gymrun-patch-card-battle-accessibility.md)):
default English, then Traditional Chinese, Simplified Chinese, Japanese,
German, Ukrainian, Spanish and French. "All new menus" is the card run's own
screens (`ui/cardrun/`), which step 7b left in English while their names were
translated (`../generation.md` section 141): the title, the route, the City,
the market, the camp, the offer, upgrade, replace and leave-a-card screens,
the Wild and its events, the boss's offers, the end screen, and every line a
screen reader is given on them. Machine-drafted like the battle's, flagged for
a native read. Outside the design bible, like the run.
