# Research prompt: the GymRun playloop as a roguelike system

Filed 2026-10-01, verbatim, before any work, on `claude/determined-tesla-ieq8q3`.
A research prompt, not a stage or patch prompt: it asks for a diagnosis and
says in its own last lines that nothing is to be implemented. The report it
produced is [`../reports/playloop-diagnosis.md`](../reports/playloop-diagnosis.md).

---

here's a research prompt. run it on pocket-randomizer

Investigate the current GymRun playloop as a roguelike game system.
GymRun is a Pokémon-based browser roguelike. I want this investigation to focus specifically on game mechanics, player decisions, interactions, progression, and replayability, not implementation quality, UI polish, or generic engagement psychology.
Use the existing game and codebase as the source of truth. Play through or simulate the actual loop where useful. Do not assume the intended design is what the player actually experiences.
Framework
Analyze GymRun against these principles drawn from developer-authored roguelike design literature:

1. Mastery loop
   * Challenge → failure → learning → improved decision → eventual success.
   * What does the player actually learn between runs?
   * Does player knowledge materially improve future runs?
2. Variety, not randomness
   * Randomness should create new decisions rather than simply different outcomes.
   * Identify where GymRun creates meaningful variation versus arbitrary RNG.
3. Making do
   * Strong roguelikes give players imperfect sets of tools and ask them to construct a solution.
   * Does GymRun force adaptation to the Pokémon, moves, items, encounters, etc. that appear?
   * Or can the player mostly pursue the same strategy every run?
4. Emergent interaction
   * Look for mechanics whose value changes because of other mechanics.
   * Pokémon abilities, types, moves, status, items, team composition, encounter rules, switching, routes, etc. should ideally form combinations rather than isolated bonuses.
   * Identify existing interaction chains and missed opportunities.
5. Strategic commitment
   * Good decisions should carry opportunity cost.
   * Identify points where choosing A meaningfully means giving up B.
   * Look especially at team composition, Pokémon replacement, move selection, healing/resources, route choices, encounters and upgrades.
6. Build identity
   * At some point during a good roguelike run, the player should be able to think:
"This run has become something."
   * Determine whether GymRun develops recognizable run identities.
   * Identify what currently causes a run to diverge from another run.
7. Reward cadence
Examine rewards at several timescales:
   * encounter-to-encounter
   * gym-to-gym
   * whole run
   * multiple runs
Identify stretches where the player's strategy does not meaningfully change for too long.
8. Meaningful rewards
   * Distinguish numerical improvement from rewards that create new decisions.
   * Look for rewards equivalent to "+10% stronger" versus rewards that change team strategy, interactions or future choices.
9. Failure and restart
   * What does losing teach the player?
   * How quickly does the player get back into an interesting decision?
   * Does death feel like useful information, lost time, or both?
10. Long-term progression
Separate:
   * player knowledge/mastery
   * power gained during a run
   * permanent unlock breadth
   * permanent numerical power
   * difficulty/mastery progression
Identify which of these GymRun currently has and which ones are carrying most of the replayability.

Most important investigation
Map the actual GymRun loop from the player's perspective.
Something roughly like:
Start run → acquire team → encounter → decision → reward → team/build changes → gym preparation → gym battle → consequence → next section → eventual win/death → next run
But do not assume this representation is correct.
Find the real loop.
For every stage, document:
PLAYER STATE → CHOICE → CONSEQUENCE → NEW INFORMATION → REWARD → NEXT CHOICE
Then identify where the loop is strongest and where it becomes mechanically flat.
Pay special attention to Pokémon
Pokémon already contains an enormous interaction grammar:

* types
* dual types
* moves
* coverage
* abilities
* status
* speed
* switching
* team composition
* counters
* resistances/immunities
* setup
* utility
* evolution/stat differences

The question is not simply whether GymRun contains these systems.
Ask:
Does GymRun's roguelike structure make players discover, combine, exploit and improvise with them?
A huge Pokémon database is not automatically equivalent to a large roguelike possibility space.
Look for situations where two or three simple systems combine to create unexpected strategic value.
Output
Produce:

1. The current GymRun core loop
   * diagram or concise state-machine representation.
2. What is already working
   * specific mechanics responsible.
   * cite actual game examples.
3. Where the loop becomes weak
   * repetitive decisions
   * inconsequential RNG
   * obvious dominant choices
   * rewards that don't alter strategy
   * sections with weak reward cadence
   * failure that teaches little
   * runs that converge toward similar strategies.
4. Existing emergent interactions
   * list concrete examples of mechanics combining well.
5. Missing interaction opportunities
   * especially opportunities using systems already present in the codebase.
6. Run identity analysis
   * explain what makes two current GymRun runs strategically different, not merely numerically or cosmetically different.
7. Progression map
   * in-run progression
   * between-run progression
   * mastery progression.
8. Top design hypotheses
   * not feature requests yet.
   * formulate them as testable statements such as:
"If X decision appears more frequently, players will have to adapt their team strategy more often because Y."
or
"System A currently has little strategic consequence because System B rarely interacts with it."

Do not start implementing fixes.
First give me a mechanical diagnosis of GymRun's existing playloop.
The goal is to determine whether the game currently produces the core roguelike cycle:
stable rules + variable situations + interacting systems + constrained choices + transformative rewards + meaningful failure + rapid re-entry
and, more importantly, identify exactly where GymRun succeeds or fails at each part of that cycle.
