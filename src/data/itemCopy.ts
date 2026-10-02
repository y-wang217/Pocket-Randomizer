/**
 * The words a held item, a berry and a relic are explained in. **Milestone
 * M5.1, discrepancy rows D12, D14 and D36.**
 *
 * ## Why this file exists
 *
 * These strings were `ItemEntry.blurb` in `data/items.ts` and
 * `Relic.playerDescription` in `data/relics.ts`, and both of those tables are
 * inside `contentHash` because `core/` reads them. So a reworded effect line
 * refused every seed recorded before it — for copy that changes nothing a seed
 * generates, resolves or pays.
 *
 * **D12 ruled the split and `build-config/content-hash.ts` names the rule it
 * follows**: a file no `src/core/` module imports at any depth is excluded,
 * mechanically, and `test/content-hash.test.ts` walks the import graph to hold
 * it. `displayTuning.ts` is the precedent and `flagPrecedence.ts` is M4.1's
 * worked example.
 *
 * **What D12 could not rule was the one-time cost.** M4.1 obeyed "no hash move"
 * because its table did not exist yet — it created a file and edited nothing.
 * These fields *did* exist, so lifting them out edits two hashed tables and the
 * hash moves once on the way through. Ruled 2026-09-22: take the move now, with
 * `data/eventCopy.ts`'s half of the same split, so the tier pays one version
 * event and every future rewrite on any of the three is free.
 *
 * ## Nothing here was rewritten
 *
 * Every string below is the one that was in the table, to the character. D34
 * was ruled to cut them to eight words for the card face; **D36 then found that
 * section 3 of the design bible — "the single source of truth for how each
 * attribute renders at rest" — puts the name, the effect line and a relic's
 * capability all on inspect**, and leaves the face as a sprite. On inspect
 * there is no budget: R5 gives that layer "the full explanation". So the move
 * is a move and not an edit, which is also what makes it reviewable — the diff
 * that lifts them is a diff nobody has to read for meaning.
 *
 * ## The rule this file lives under
 *
 * Read by `ui/` and by nothing under `core/`, forever. Both maps are keyed by
 * the id in the table the copy came from, so a lookup here and a lookup there
 * cannot drift apart without a type error.
 */
import type { RelicId } from './relics';

/**
 * One effect line per held item and berry, keyed by dex id.
 *
 * Says the effect, not the flavour, and never a verdict: the Stage 4.5.1
 * editorial rule and the bible's C1 both bind these as hard as they bind a
 * card, because this is the text a long press shows.
 */
export const ITEM_COPY: Readonly<Record<string, string>> = {
  leftovers: 'Restores 1/16 max HP at the end of every turn.',
  lifeorb: 'Attacks do 1.3x damage. Costs 1/10 max HP per attack.',
  focussash: 'Survive one KO at full HP with 1 HP left. Once per battle.',
  assaultvest: 'Sp. Def 1.5x, but status moves cannot be selected.',
  rockyhelmet: 'Attackers making contact lose 1/6 of their max HP.',
  expertbelt: 'Super-effective hits do 1.2x damage.',
  shellbell: 'Heals 1/8 of the damage the holder deals.',
  eviolite: 'Def and Sp. Def 1.5x — but only if the holder can still evolve.',
  punchingglove: 'Punching moves do 1.1x damage and make no contact.',
  weaknesspolicy: 'Raises Atk and Sp. Atk two stages when hit super effectively.',
  choiceband: 'Attack 1.5x — locked into the first move used.',
  choicespecs: 'Sp. Atk 1.5x — locked into the first move used.',
  choicescarf: 'Speed 1.5x — locked into the first move used.',
  muscleband: 'Physical attacks have 1.1x power.',
  wiseglasses: 'Special attacks have 1.1x power.',
  silkscarf: 'Normal-type moves have 1.2x power.',
  charcoal: 'Fire-type moves have 1.2x power.',
  mysticwater: 'Water-type moves have 1.2x power.',
  miracleseed: 'Grass-type moves have 1.2x power.',
  magnet: 'Electric-type moves have 1.2x power.',
  blackbelt: 'Fighting-type moves have 1.2x power.',
  twistedspoon: 'Psychic-type moves have 1.2x power.',
  sharpbeak: 'Flying-type moves have 1.2x power.',
  oranberry: 'Restores 10 HP when the holder drops below half.',
  sitrusberry: 'Restores 1/4 max HP when the holder drops below half.',
  lumberry: 'Cures any status condition, once.',
  chestoberry: 'Wakes the holder from sleep, once.',
  persimberry: 'Cures confusion, once.',
  leppaberry: 'Restores 10 PP to a move that has run out.',
  occaberry: 'Halves one super-effective Fire hit.',
  passhoberry: 'Halves one super-effective Water hit.',
  rindoberry: 'Halves one super-effective Grass hit.',
  wacanberry: 'Halves one super-effective Electric hit.',
  chopleberry: 'Halves one super-effective Fighting hit.',
  payapaberry: 'Halves one super-effective Psychic hit.',
  yacheberry: 'Halves one super-effective Ice hit.',
  habanberry: 'Halves one super-effective Dragon hit.',
  colburberry: 'Halves one super-effective Dark hit.',
};

/**
 * What a relic does, keyed by relic id.
 *
 * Two sentences each by construction: the capability it opens, then what it
 * pays while held. Section 3 routes both to inspect along with the name, so
 * neither is under a word budget — which is the whole of what D36 changed
 * about them.
 */
export const RELIC_COPY: Readonly<Record<RelicId, string>> = {
  'rusted-machete': 'Opens the way through anything overgrown. Something turns up in the cleared brush after every fight.',
  'woodsmans-hatchet': 'Opens the way through anything overgrown.',
  'tidecaller-shell': 'Carries the party across open water. The sound inside it mends a little at every stop.',
  'ferrymans-oar': 'Carries the party across open water. Other travellers pay for the crossing.',
  'ironbound-gauntlet': 'Moves what will not be moved. One more thing fits in the bag while you are wearing it.',
  'prospectors-hammer': 'Breaks stone that blocks a path. What falls out of the rubble is worth something.',
  'windrider-feather': 'Carries the party over anything on the ground.',
  'cascade-talisman': 'Climbs water that falls. A Pokemon that goes down comes back with more left in it.',
  'abyssal-lens': 'Goes down where the light stops. Shopkeepers name a lower price when you are holding it.',
  'everburning-lantern': 'Lights a place that has none. The party rests easier near it.',
};

/** The effect line for an item or berry, or the empty string if it has none. */
export function itemCopy(id: string): string {
  return ITEM_COPY[id] ?? '';
}

/** What a relic does, or the empty string if the id is not in the table. */
export function relicCopy(id: RelicId): string {
  return RELIC_COPY[id] ?? '';
}
