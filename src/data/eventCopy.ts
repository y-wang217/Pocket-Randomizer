/**
 * What a capability event says about the standing that pays it. **Patch
 * 4.8.0.2.**
 *
 * Stage 4.6c gave every event a required capability and three drawn outcomes
 * per choice, selected by the run's standing — `none`, `latent` or `known` —
 * at resolution. It shipped the selector and not a sentence of copy for it:
 * the choice hints in `data/events.ts` were written against the `latent`
 * table, so at `none` a hint promising "45 coins" paid a berry, and the reveal
 * was one label, `+18 coins`, with no word about why. A player who routed
 * toward "Requires Surf" on the map arrived at an event that never mentioned
 * Surf. This file is the missing half: a hint per choice at the two bands the
 * authored hint is wrong for, and a conclusion per choice at every band that
 * names the standing and what it did, before the outcome label says what it
 * paid.
 *
 * ## Read by `ui/` only, and excluded from `contentHash`
 *
 * Nothing under `core/` imports this file, so it sits on the exclusion list
 * in `build-config/content-hash.ts` beside `tierInfo.ts` and `tutorial.ts`:
 * rewording a sentence here must not move a seed. The payouts themselves stay
 * in `data/events.ts`, which is hashed, and are not touched by this patch —
 * `latent` is still the authored table and `none` and `known` are still the
 * shared ones. Changing *what* a band pays is a `RANDOMIZER_VERSION` change and
 * belongs to its own patch; changing what the screen *says* about it is this
 * file.
 *
 * ## The copy rule
 *
 * Part 4: attributes, never verdicts. A `none` hint says what the party
 * cannot do here and that the event still resolves; it does not say the
 * choice is pointless, because it is not — the `none` table pays, and the
 * player is unrewarded rather than punished. A `known` hint names what the
 * relic does as a fact, and says something living is here, because at `known`
 * every choice is the encounter; it does not promise the catch. A conclusion
 * names the standing and what it did, and stops — `describeOutcome` says what
 * it paid on the line below. No sentence here ranks a choice or a band, and
 * every one is linted against `TUTORIAL_FORBIDDEN_WORDS` in
 * `test/event-copy.test.ts`.
 *
 * `latent` hints are absent on purpose: the authored hint in `data/events.ts`
 * *is* the latent hint, and editing that file moves the hash.
 */
import type { CapabilityBand } from '../core/capabilities';
import type { Capability } from './capabilities';

/** The capability names, as a player reads them rather than as ids. */
export const CAPABILITY_LABELS: Readonly<Record<Capability, string>> = {
  cut: 'Cut',
  surf: 'Surf',
  strength: 'Strength',
  rockSmash: 'Rock Smash',
  fly: 'Fly',
  waterfall: 'Waterfall',
  dive: 'Dive',
  flash: 'Flash',
};

/**
 * What each band says about the run. Attributes, and deliberately flat.
 *
 * None of the three is phrased as good or bad. `latent` is not "almost" and
 * `none` is not "you cannot" — the event pays at every band, and a player who
 * reads `none` as a locked door has been told something untrue.
 */
export const BAND_LABELS: Readonly<Record<CapabilityBand, string>> = {
  known: 'you have the relic',
  latent: 'your party has the type',
  none: 'neither',
};

export interface EventBandCopy {
  /**
   * Per choice index, shown in place of `EventChoice.hint` before the pick.
   * Present at `none` and `known`; absent at `latent`, where the authored hint
   * is the right one.
   */
  hints?: readonly string[];
  /** Per choice index, shown above the outcome label after the pick. */
  conclusions: readonly string[];
}

export type EventCopy = Readonly<Record<CapabilityBand, EventBandCopy>>;

/**
 * Shown at `known` when the drawn encounter is empty — `generateEvent`'s
 * offer callback returned nothing, so the outcome degraded to `nothing`. The
 * relic still did its work; there was nobody there to meet.
 */
export const KNOWN_WITHOUT_OFFER =
  'The relic opens the way, and the way is empty this time. Nothing here was waiting to be met.';

export const EVENT_COPY: Readonly<Record<string, EventCopy>> = {
  'abandoned-ball': {
    none: {
      hints: [
        'No light to see by. You open it blind, and whatever is inside has the first move. What you come away with is small.',
        'Nobody buys a rattling ball from a stranger in the dark. You settle for what the roadside offers.',
      ],
      conclusions: [
        'Without Flash you open it by feel. The lid comes off, something bolts into the grass, and this is what it left behind.',
        'Without Flash you cannot show a buyer what is inside, and nobody pays for a rattle. You keep what was under the ball.',
      ],
    },
    latent: {
      conclusions: [
        'A party member of the right type lights the grass enough to open the ball with your hand clear.',
        'A party member of the right type lights the ball enough to show the collector what he is buying.',
      ],
    },
    known: {
      hints: [
        'With Flash the dent lights up, and so does what is behind it: eyes. Opening the ball is an introduction.',
        'Lit up, the ball is plainly occupied. The collector loses interest and the occupant does not.',
      ],
      conclusions: [
        'Flash lights the grass and the ball. The rattle was a Pokemon, awake, and it stays put while you look.',
        'Flash lights the ball and the collector steps back. It is occupied, and the occupant would rather come with you.',
      ],
    },
  },
  'roadside-berries': {
    none: {
      hints: [
        'Without Cut the ripe ones stay out of reach. You get the low branches, and the low branches are thin.',
        'Without Cut, picking by hand fills half a bag. The market pays by the bag.',
      ],
      conclusions: [
        'Without Cut you pick what you can reach. Thin pickings, and this much of it edible.',
        'Without Cut the bag stays light, and the market pays by the bag.',
      ],
    },
    latent: {
      conclusions: [
        'A party member of the right type brings the branch down. You eat what the branch had.',
        'A party member of the right type opens the bush to the trunk. A full bag, for the market.',
      ],
    },
    known: {
      hints: [
        'Cut brings the whole branch down. Something has been eating from the top of it, and it is still up there.',
        'Cut clears the bush to the trunk, and clears out what was living in it.',
      ],
      conclusions: [
        'Cut brings the branch down, and the thing eating from the top of it comes down with it, unhurried.',
        'Cut clears the bush to the trunk. What was living in it is now looking at you.',
      ],
    },
  },
  'toll-bridge': {
    none: {
      hints: [
        'Without Surf the bridge is the only way over. The gatekeeper knows it, and charges like it.',
        'Without Surf you pick your way along the bank and cross where it is shallowest. Slow, and it costs the day.',
      ],
      conclusions: [
        'Without Surf the bridge is the only crossing. You cross it, and the far bank has this for you.',
        'Without Surf you keep to the shallows and cross downstream, out of the gatekeeper’s sight. This is what the bank had.',
      ],
    },
    latent: {
      conclusions: [
        'A party member of the right type could have carried you over. You pay the toll anyway, and the gatekeeper’s pack opens.',
        'A party member of the right type carries you across the current.',
      ],
    },
    known: {
      hints: [
        'With Surf the bridge is optional, and the gatekeeper’s price drops to conversation. He mentions something living under it.',
        'With Surf the river is yours. Something is in it, and it surfaces to look.',
      ],
      conclusions: [
        'Surf makes the bridge optional. You pay nothing to cross, and meet what lives under it instead.',
        'Surf takes you straight across. Halfway over, something in the river decides to come along.',
      ],
    },
  },
  'old-trainer': {
    none: {
      hints: [
        'Without Strength she sets the bar where she likes and you do not clear it. She notices, and eases the follow-through.',
        'Without Strength you have nothing to show her. She talks anyway, and sends you off with a little something.',
        'Without Strength you are a customer, not a student. Lunch is lunch.',
      ],
      conclusions: [
        'Without Strength the drills stop at the first station. She sends you off with what she had in her pockets.',
        'Without Strength there is little to talk about. She points you down the road with something for it.',
        'Without Strength you are a customer. Lunch is lunch, and this is the change.',
      ],
    },
    latent: {
      conclusions: [
        'A party member of the right type keeps pace with her. You spar to the end.',
        'A party member of the right type earns her attention. You talk routes.',
        'A party member of the right type makes it a meal between trainers. She pays you back in kind.',
      ],
    },
    known: {
      hints: [
        'With Strength you keep pace. She has a partner she wants you to meet.',
        'With Strength she talks shop, and the partner she trains with listens in.',
        'With Strength she eats with you as a peer. Her partner eats too, and stays.',
      ],
      conclusions: [
        'Strength clears every station. At the end she introduces her partner, who wants a trainer with somewhere to go.',
        'Strength makes it a conversation between equals. Her partner has been listening, and follows you out.',
        'Strength earns you a seat at her table. Her partner sits with you, and stays when she leaves.',
      ],
    },
  },
  'hot-spring': {
    none: {
      hints: [
        'Without Dive you stay in the shallows at the edge. Warm enough.',
        'Without Dive you fill from the surface, where the water is cloudy. Nobody pays full price for cloudy.',
      ],
      conclusions: [
        'Without Dive you keep to the edge. A short soak, and this.',
        'Without Dive you bottle surface water. It sells for surface prices.',
      ],
    },
    latent: {
      conclusions: [
        'A party member of the right type takes you into the deep end. The heat gets to work.',
        'A party member of the right type fetches water from the source, which is what tourists pay for.',
      ],
    },
    known: {
      hints: [
        'With Dive you go under. The pool is deeper than it looks, and not empty.',
        'With Dive you fill from the source at the bottom, where something has made its home.',
      ],
      conclusions: [
        'Dive takes you to the bottom of the pool, and something down there follows you back up.',
        'Dive takes you to the source. Its resident comes up with the bottle.',
      ],
    },
  },
  'card-sharp': {
    none: {
      hints: [
        'Without Fly you have no view of his hands from above. You play at his table, on his terms.',
        'Without Fly you walk on at road speed. He calls something after you.',
      ],
      conclusions: [
        'Without Fly you play blind. He wins the round, then softens, and slides you something for your trouble.',
        'Without Fly you walk on at road speed. A little further along, this was at the roadside.',
      ],
    },
    latent: {
      conclusions: [
        'A party member of the right type gives you the angle on his hands. The round is played fair.',
        'A party member of the right type puts you above the game. You walk on.',
      ],
    },
    known: {
      hints: [
        'With Fly you watch the cups from a height he did not plan for. He folds the table, and something has been sleeping under it.',
        'With Fly you leave over the treeline. Something in the branches leaves with you.',
      ],
      conclusions: [
        'Fly gives you the view from above his table. He packs up, and what was sleeping under it does not.',
        'Fly lifts you over the treeline. Something in the branches comes along.',
      ],
    },
  },
  'storm-shelter': {
    none: {
      hints: [
        'Without Rock Smash the cave mouth is half blocked. You crouch in the entrance.',
        'Without Rock Smash there is only the long road round. You take it in the rain.',
      ],
      conclusions: [
        'Without Rock Smash you crouch in the mouth of the cave and wait it out. This is what the rain left.',
        'Without Rock Smash the long road is the only road. You arrive wet, with this.',
      ],
    },
    latent: {
      conclusions: [
        'A party member of the right type clears the entrance. Dry, and out of the wind.',
        'A party member of the right type breaks a way through the slide. Shorter.',
      ],
    },
    known: {
      hints: [
        'Rock Smash opens the cave mouth. It is dry inside, and inhabited.',
        'Rock Smash makes a short cut through the fallen rock. Something was sheltering on the other side of it.',
      ],
      conclusions: [
        'Rock Smash opens the cave. Dry, and already occupied by something that does not mind company.',
        'Rock Smash clears the slide. What was sheltering behind it walks out with you.',
      ],
    },
  },
  'scrap-heap': {
    none: {
      hints: [
        'Without Waterfall the heap sits under the gym’s outflow. You dig the dry edge.',
        'Without Waterfall you carry out what you can lift from the dry edge.',
      ],
      conclusions: [
        'Without Waterfall you work the dry edge of the heap. This is what was in reach.',
        'Without Waterfall you sell the dry edge. It weighs what it weighs.',
      ],
    },
    latent: {
      conclusions: [
        'A party member of the right type climbs the outflow to the top of the heap, where the gear is newer.',
        'A party member of the right type carries the heavy pieces down. The scale reads higher.',
      ],
    },
    known: {
      hints: [
        'Waterfall takes you up the outflow to where the heap started. Something has been nesting in it.',
        'Waterfall takes you up to the top of the heap. The buyer is not the only one interested.',
      ],
      conclusions: [
        'Waterfall takes you to the top of the heap. Something nesting in it has decided you are worth following.',
        'Waterfall takes you to the top. The buyer takes the scrap; what was nesting in it takes to you.',
      ],
    },
  },
};

/** The hint for one choice at one band: this file's where it has one, the authored hint otherwise. */
export function eventHint(eventId: string, band: CapabilityBand, index: number, fallback: string): string {
  return EVENT_COPY[eventId]?.[band].hints?.[index] ?? fallback;
}

/**
 * The conclusion for one choice at one band, given what it actually paid.
 *
 * At `known` the conclusion describes an encounter, so when the drawn outcome
 * is not one — the offer was empty — it must not. Empty string when no copy
 * exists, so a screen can omit the line rather than print a blank.
 */
export function eventConclusion(
  eventId: string,
  band: CapabilityBand,
  index: number,
  paid: { kind: string },
): string {
  if (band === 'known' && paid.kind !== 'acquisition') return KNOWN_WITHOUT_OFFER;
  return EVENT_COPY[eventId]?.[band].conclusions[index] ?? '';
}
