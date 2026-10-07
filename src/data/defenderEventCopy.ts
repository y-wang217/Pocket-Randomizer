/**
 * What a defender question mark says. **2026-10-06.**
 *
 * One hook per event and one label and hint per option, in the option order
 * `data/defenderEvents.ts` lists them. The same budgets as the attacker's event
 * copy (bible section 8, D33, D111): a hook under thirty words and two lines
 * at 390px, a label under six words, a hint at most six words and a fragment,
 * naming the shape of what the button does and never the drawn outcome. No
 * hedge word: `test/defender-event-copy.test.ts` lints every string against
 * `TUTORIAL_FORBIDDEN_WORDS` and holds the budgets.
 *
 * ## Read by `ui/` only, and excluded from `contentHash`
 *
 * Nothing under `core/` imports this file, so it sits on the exclusion list in
 * `build-config/content-hash.ts`: rewording a hint here must not refuse every
 * defender seed recorded before it (D12).
 */

/** The situation, over the buttons. */
export const DEFENDER_EVENT_HOOKS: Readonly<Record<string, string>> = {
  'd-wayside-offerings': 'A wayside shrine with three offerings left on it, and nobody about.',
  'd-abandoned-camp': 'A camp struck in a hurry. The fire is still warm.',
  'd-rigged-wheel': 'A painted wheel on a cart, and a hand out for your coins.',
  'd-shell-game': 'Three cups on a crate. The dealer smiles too easily.',
  'd-masked-challengers': 'Masked trainers step out of the trees and name a price.',
  'd-sealed-sphere': 'A sealed sphere humming in the clearing. Something inside is awake.',
  'd-travelling-bazaar': 'A travelling bazaar, set up for the afternoon.',
  'd-night-market': 'A night market under paper lanterns, half the stalls already closing.',
  'd-hot-spring': 'A hot spring off the path, and an attendant with a ledger.',
  'd-healers-tent': 'A healer’s tent, lamp lit, flap open.',
  'd-forgotten-cache': 'A cache under the floorboards, forgotten by whoever packed it.',
  'd-dusty-reliquary': 'A reliquary under a century of dust, its lid ajar.',
};

/** The button labels, in option order. Under six words each. */
export const DEFENDER_EVENT_LABELS: Readonly<Record<string, readonly string[]>> = {
  'd-wayside-offerings': ['Take the medicine', 'Take the coins', 'Take the heavy box'],
  'd-abandoned-camp': ['Take the berries', 'Swap for the pack', 'Take the purse'],
  'd-rigged-wheel': ['Spin the wheel', 'Walk on'],
  'd-shell-game': ['Play for small stakes', 'Play for the pot', 'Walk on'],
  'd-masked-challengers': ['Fight them', 'Pay them off', 'Back away'],
  'd-sealed-sphere': ['Break the seal', 'Leave it humming'],
  'd-travelling-bazaar': [],
  'd-night-market': [],
  'd-hot-spring': ['Soak a while', 'Pay for the full treatment', 'Walk on'],
  'd-healers-tent': ['Pay for the lead', 'Rest in the shade', 'Walk on'],
  'd-forgotten-cache': ['Take the bottles', 'Take the wrapped thing'],
  'd-dusty-reliquary': ['Lift the lid', 'Take what is loose'],
};

/** The hint under each label, in option order. Six words at most. */
export const DEFENDER_EVENT_HINTS: Readonly<Record<string, readonly string[]>> = {
  'd-wayside-offerings': ['The party mends a third.', 'Coins, and nothing owed.', 'Heavy enough to hurt.'],
  'd-abandoned-camp': ['Two berries, left behind.', 'One bag item for the pack.', 'A purse of coins.'],
  'd-rigged-wheel': ['Even odds. The pin is bent.', 'Nothing lost, nothing won.'],
  'd-shell-game': ['Likely a little. Lose a little.', 'Unlikely a lot. Lose more.', 'Nothing lost, nothing won.'],
  'd-masked-challengers': ['A hard fight. They carry coin.', 'A stated price. A berry back.', 'They let you go.'],
  'd-sealed-sphere': ['A hard fight. Something inside.', 'Nothing lost, nothing won.'],
  'd-travelling-bazaar': [],
  'd-night-market': [],
  'd-hot-spring': ['The party mends some.', 'A stated price. Everyone mended.', 'Nothing lost, nothing won.'],
  'd-healers-tent': ['A stated price. The lead mended.', 'The party mends a little.', 'Nothing lost, nothing won.'],
  'd-forgotten-cache': ['Two bottles for the bag.', 'One item, wrapped.'],
  'd-dusty-reliquary': ['Something old inside.', 'One small item.'],
};

/** The label on option `index` of event `id`, or the empty string. */
export function defenderEventLabel(id: string, index: number): string {
  return DEFENDER_EVENT_LABELS[id]?.[index] ?? '';
}
