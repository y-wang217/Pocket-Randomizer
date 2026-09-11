GYMRUN 4.8.0.1: species stays the label
You are patching GYMRUN on top of merged 4.8. Presentation only. No `core/` state change, no version axis moves, no new draws. Seeded output stays byte identical.
Report first, do not code. Nicknames were added in 4.8 and now render in place of the species everywhere a Pokemon is named. Find out which of these is true and say which:

1. `PokemonState` still carries the species and the nickname as separate fields, and the nameplate component just picked the wrong one. Display fix, proceed.
2. The nickname overwrote the species-derived display name in state, or the species is only recoverable through the spec. Stop and report. That is a core change and it is not this patch.

Also report every component that renders a Pokemon's name, with its file and line. I expect battle nameplates, party drawer, party management, the recipient screen, capture card, result screen, damage contribution counters, graveyard, and share text. Confirm the real list before editing any of them.
The rule. Species is the identity. A nickname is an accessory to it and never replaces it.

* Every surface where the player is evaluating a Pokemon renders the species as the primary label: battle panels, party drawer and management, recipient and replacement screens, capture card, result screen, contribution counters.
* The nickname renders secondary, visually subordinate, and is omitted entirely where there is no room for both.
* Opponents read species only. A nicknamed enemy makes the board harder to read and buys nothing.
* Graveyard and share text are the exception: nickname first, species immediately after it in the same line. That is where the name is the point.
* No surface renders a nickname with no species anywhere on it.

Layout constraint, this is the part that will bite. The battle screen measured 1290.5 against a 584 budget before Release C and 4.7.2 work, and `battle.decisionTop` is pinned at 681.5. Two stacked lines on every nameplate moves it. Use a single-line composite where vertical space is contested, truncate the nickname before the species, never the other way round, and re-record heights. If `decisionTop` moves at all, record it as a deviation in `generation.md` §12 with the number, same as R12.
Tests

1. Every name-rendering surface shows the species, asserted per surface, including one with a nicknamed mon and one without.
2. Opponent panels render no nickname.
3. Graveyard and share text carry both, nickname first.
4. Nickname truncation never truncates the species.
5. `battle.decisionTop` unchanged, or the deviation recorded.
6. All suites pass, seeded output byte identical, no version bump on any axis.

Done when a screenshot of any screen tells you what Pokemon you are looking at without tapping anything.
One flagged default: I kept nicknames on by default rather than hiding them behind the verbosity toggle. Tying name display to Simple/Detailed adds a branch to a component that should have one rule, and Pocket mode will want its own truncation behaviour anyway, which is cleaner to handle as a width rule than a mode branch.
