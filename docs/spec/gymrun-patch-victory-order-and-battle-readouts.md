# Patch: victory screen order, gym move skip, battle readouts, final segment gauntlet

Filed verbatim before any work, per `docs/spec/README.md` protocol 1.
Branch `claude/victory-screen-battle-ui-p3op20`, 2026-09-17.

## The brief, as it arrived

> Okay small patch reorder victory screens. Get pokemon before learn move
> Also animations are not tied to speed right now, are they? I just saw a snubull go before my sizzlipede and the animation for my attack went first
> Also allow skip gym reward move
> Also i still dont have ability tooltip on mobile for caught pokemon
> X/total pokemon left for trainer battles and wild battles are x/? Labelled and can have up to 10 pokemon in a row in the 8th gym
> 8th gym should also have node patterns that can be wild&trainer choice twice in a row
> Plan first then execute

## The three questions asked before the plan was finalised, and their answers

The brief is a playtest report, so three of its six items were open on scope.
They were put to the author before any code and answered as follows.

**Item 5, what "X/total ... up to 10 pokemon in a row in the 8th gym" asks for.**
Answer: *readout only, row sized to 10.* Add an opponent-remaining readout on the
battle screen — trainer and gym show `3/4 left`, wild shows `1/? left` — with the
pips laid out in one row that stays legible up to ten. **Team sizes themselves do
not change**: `MAX_TEAM_SIZE` stays at 6 and the final gym is not retuned. The
row is built to ten because a readout that breaks at a number the game could
later field is a readout that has to be rebuilt.

**Item 1, whether the newly caught Pokemon may learn the move.**
Answer: *yes, it is a valid target.* The move questions are asked against the
party with the acquisition already applied, so the new member appears in the
recipient list. That is the gameplay reason to reorder at all — a reorder that
only moved screens around would buy nothing mechanically.

**Item 6, what "wild&trainer choice twice in a row" asks for.**
Answer: *guarantee two back-to-back battle steps.* The final segment always
places two consecutive steps whose options are wild-versus-trainer, with no rest,
shop or event on either. A gauntlet before the last gym, guaranteed rather than
left to the draw.

## Scope

Six items. Three of them are presentation only; three move a version axis.

1. **Victory screen order.** The acquisition is asked before any move-learn
   question at the same node, and the caught Pokemon is a legal recipient.
2. **Battle beat order against turn order.** Reproduce before fixing: the marker
   logic is already asserted against a real protocol in
   `test/battle-feedback.test.ts`, and the browser half — the slot delays, and
   whether anything else on the stage resolves ahead of them — is asserted
   nowhere. Report what reproduces, then fix that.
3. **The gym's guaranteed move may be declined.** Part A only. The "there is no
   decline" rule on `chooseMoveToReplace` stands for every move the player chose
   over alternatives, which is every other one.
4. **Ability tooltip on the caught-Pokemon card.**
5. **Opponent-remaining readout**, per the answer above.
6. **Final segment gauntlet**, per the answer above.

## Version axes

- `RUN_LOG_VERSION` moves for items 1 and 3 together. Item 1 reorders the
  questions a node asks; item 3 widens what a `target` entry may say. Either
  alone would move it, so they share one bump.
- `RANDOMIZER_VERSION` moves for item 6: the shape pass draws differently in the
  final segment.
- `contentHash` moves: `src/data/tuning.ts` gains a knob.
- `AI_VERSION` holds. Nothing here touches opponent policy.

## Out of scope

- Raising `MAX_TEAM_SIZE`, or retuning any gym's team.
- Retuning balance. Record the benchmark figure and keep going, per
  `CLAUDE.md`'s standing policy.
- Any second escape hatch on a move the player chose over two alternatives.
