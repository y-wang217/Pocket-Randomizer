/**
 * The held items a run may hand out. **A curated whitelist, not the item dex.**
 *
 * The dex has several hundred items and most of them would be noise here. The
 * bar for inclusion is two questions a player has to be able to answer at the
 * reward screen: *what does this do*, and *is it better than the other two
 * cards*. An item that fails either one turns a decision into a shrug.
 *
 * So the list below is roughly twenty items that are legible in one line and
 * that visibly change a battle. Items are a native Showdown concept — the
 * engine already implements every one of these correctly — so the work in
 * `core/items.ts` is plumbing, not mechanics.
 *
 * ## What is excluded, and why it is documented rather than deleted
 *
 * Four groups are deliberately absent. Writing them down is the point: the
 * reasons are stage-dependent, and a future stage should be able to see which
 * exclusions expire.
 *
 *   - **Switching items** — Air Balloon, Red Card, Eject Button, Eject Pack,
 *     Shed Shell, Room Service. Every one of them either forces or exploits a
 *     switch, and there is no switching until Stage 4. They would not be
 *     *broken* here, they would be blank cards. **This exclusion expires in
 *     Stage 4**, and it is the largest single batch of items waiting on it.
 *   - **EV, IV and training items** — Power Weight and friends, Macho Brace.
 *     Every Pokemon in GYMRUN has 0 EVs and 31 IVs (see `toPokemonSet` in
 *     core/battle/driver.ts). These items modify a system that does not exist.
 *     This exclusion does not expire; EVs are explicitly out of scope.
 *   - **Breeding and evolution items** — Everstone, evolution stones, incense.
 *     There is no breeding and no evolution: a Pokemon's species is fixed from
 *     the moment it is generated.
 *   - **Consumables** — every Berry, Z-crystals, Mega Stones. Berries fire once
 *     and vanish, which needs an inventory to be interesting and needs the
 *     player to be able to *not* use one. The spec puts consumables out of
 *     scope for Stage 3 and this is why.
 *
 * ## One item per Pokemon
 *
 * There is no inventory. A Pokemon holds one item; acquiring a second offers a
 * swap and the swapped-out item is gone. That is enforced in `core/items.ts`
 * and it is a deliberate refusal to build a bag: a bag needs a screen, a
 * capacity rule, and a decision about what happens on a wipe, and none of those
 * are interesting until there is a party to spread items across.
 */

/** A held item the reward pools may draw. */
export interface ItemEntry {
  /** Dex id. The value handed to the sim, and the key everything else uses. */
  id: string;
  /** Dex name, as the engine spells it. Shown to the player. */
  name: string;
  /** One line for the reward card. Says the effect, not the flavour. */
  blurb: string;
  /**
   * The type this item boosts, for the type-boosting items and null otherwise.
   *
   * Present so a reward card can say *"+20% Fire — your Pokemon is Water"* out
   * loud. A type item that does not match your STAB is a near-dud, and the
   * design decision below is that near-duds belong in the normal-tier pool
   * rather than nowhere. Hiding that from the player would make the reward
   * screen a lottery; naming it makes the low tier legibly low.
   */
  boostsType: string | null;
  /**
   * True for the Choice items, which lock the holder into the first move it
   * uses for the rest of the battle.
   *
   * Flagged rather than inferred because Stage 3 could not tell whether it was
   * a strong item or a trap. At `PARTY_SIZE` 1 with no switching, a Choice lock
   * lasted the *whole battle* — there was nothing to switch out to, so the
   * drawback had no escape hatch and the item was a coin flip on your first
   * move being the right one.
   *
   * **Stage 4 settles it: they are not a trap.** Switching now exists, and a
   * Choice item locks the *move* while leaving the switch legal — the sim
   * reports the other moves as disabled and sets no trapping flag at all, which
   * `test/switching.test.ts` asserts against the raw request rather than
   * against our reading of it. Switching out and back resets the lock, which is
   * the mechanic that makes the item playable, and it is exactly the escape
   * hatch Stage 3 was missing.
   */
  locksMove: boolean;
}

function item(id: string, name: string, blurb: string, extra: Partial<ItemEntry> = {}): ItemEntry {
  return { id, name, blurb, boostsType: null, locksMove: false, ...extra };
}

/**
 * The premium four: items that change how a fight is *played*.
 *
 * The elite pool and nothing else. Each one rewrites a fight's shape rather
 * than nudging a number — Leftovers turns a losing attrition race, Focus Sash
 * buys a turn back from a one-shot, Life Orb turns a two-turn kill into a
 * one-turn kill, Assault Vest trades your status moves for the bulk to survive
 * the turn you needed them.
 *
 * **Split out from the wider staples by the Stage 3 tuning pass.** The first cut
 * had one `STAPLE_ITEMS` list feeding both the hard and the elite pools, which
 * meant the two tiers offered the *same items* and the reward gradient between
 * them was nothing but a heal fraction. The rule the spec states — elite pools
 * contain strictly better entries — has to hold between elite and hard, not just
 * between elite and normal, and it did not.
 */
export const PREMIUM_ITEMS: readonly ItemEntry[] = [
  item('leftovers', 'Leftovers', 'Restores 1/16 max HP at the end of every turn.'),
  item('lifeorb', 'Life Orb', 'Attacks do 1.3x damage. Costs 1/10 max HP per attack.'),
  item('focussash', 'Focus Sash', 'Survive one KO at full HP with 1 HP left. Once per battle.'),
  item('assaultvest', 'Assault Vest', 'Sp. Def 1.5x, but status moves cannot be selected.'),
];

/**
 * The solid middle: real effects that do not rewrite a fight.
 *
 * The hard pool. Every one of these is strictly better than a coin-flip on a
 * type match and strictly worse than the four above, which is exactly the shape
 * the middle tier should have.
 */
export const GOOD_ITEMS: readonly ItemEntry[] = [
  item('rockyhelmet', 'Rocky Helmet', 'Attackers making contact lose 1/6 of their max HP.'),
  item('expertbelt', 'Expert Belt', 'Super-effective hits do 1.2x damage.'),
  item('shellbell', 'Shell Bell', 'Heals 1/8 of the damage the holder deals.'),
  item('eviolite', 'Eviolite', 'Def and Sp. Def 1.5x — but only if the holder can still evolve.'),
  item('punchingglove', 'Punching Glove', 'Punching moves do 1.1x damage and make no contact.'),
  item('weaknesspolicy', 'Weakness Policy', 'Raises Atk and Sp. Atk two stages when hit super effectively.'),
];

/** Everything above the type items, for the shop tables and for tests. */
export const STAPLE_ITEMS: readonly ItemEntry[] = [...PREMIUM_ITEMS, ...GOOD_ITEMS];

/**
 * The Choice items, together, because they stand or fall together.
 *
 * Grouped so that cutting them if the simulator calls them a trap is one edit
 * to `data/rewardPools.ts` and not a hunt through a flat list.
 */
export const CHOICE_ITEMS: readonly ItemEntry[] = [
  item('choiceband', 'Choice Band', 'Attack 1.5x — locked into the first move used.', { locksMove: true }),
  item('choicespecs', 'Choice Specs', 'Sp. Atk 1.5x — locked into the first move used.', { locksMove: true }),
  item('choicescarf', 'Choice Scarf', 'Speed 1.5x — locked into the first move used.', { locksMove: true }),
];

/** The small flat boosters. Real, modest, and never a wrong pick. */
export const MODEST_ITEMS: readonly ItemEntry[] = [
  item('muscleband', 'Muscle Band', 'Physical attacks have 1.1x power.'),
  item('wiseglasses', 'Wise Glasses', 'Special attacks have 1.1x power.'),
];

/**
 * Type-boosting items: +20% to one type, and nothing at all to the other
 * seventeen.
 *
 * **These are the normal pool's filler, and that is the design rather than a
 * compromise.** The spec's rule is that elite pools contain strictly better
 * entries, and a reward that pays out only when it happens to match your
 * Pokemon's typing is exactly what "strictly worse" should look like. A normal
 * node offering three guaranteed upgrades would make the tier gradient a
 * formality; a normal node offering a Charcoal to a Lapras is the reason to
 * consider the hard node next to it.
 *
 * Eight types rather than all eighteen, because eighteen entries would drown
 * every other kind of reward in the normal pool. `boostsType` lets the reward
 * card say whether this particular one is a dud for this particular Pokemon.
 */
export const TYPE_ITEMS: readonly ItemEntry[] = [
  item('silkscarf', 'Silk Scarf', 'Normal-type moves have 1.2x power.', { boostsType: 'Normal' }),
  item('charcoal', 'Charcoal', 'Fire-type moves have 1.2x power.', { boostsType: 'Fire' }),
  item('mysticwater', 'Mystic Water', 'Water-type moves have 1.2x power.', { boostsType: 'Water' }),
  item('miracleseed', 'Miracle Seed', 'Grass-type moves have 1.2x power.', { boostsType: 'Grass' }),
  item('magnet', 'Magnet', 'Electric-type moves have 1.2x power.', { boostsType: 'Electric' }),
  item('blackbelt', 'Black Belt', 'Fighting-type moves have 1.2x power.', { boostsType: 'Fighting' }),
  item('twistedspoon', 'Twisted Spoon', 'Psychic-type moves have 1.2x power.', { boostsType: 'Psychic' }),
  item('sharpbeak', 'Sharp Beak', 'Flying-type moves have 1.2x power.', { boostsType: 'Flying' }),
];

/**
 * Every item a run can produce, in a fixed order.
 *
 * The order is a **draw order** — `data/rewardPools.ts` names items and
 * `core/rewards.ts` picks an index into a filtered view — so re-sorting this
 * list reshuffles what every recorded seed offers. Append; do not insert.
 */
export const ITEMS: readonly ItemEntry[] = [
  ...PREMIUM_ITEMS,
  ...GOOD_ITEMS,
  ...CHOICE_ITEMS,
  ...MODEST_ITEMS,
  ...TYPE_ITEMS,
];

const BY_ID = new Map(ITEMS.map((entry) => [entry.id, entry]));

/**
 * Look an item up by id, or null if it is not on the whitelist.
 *
 * Null rather than a throw: an item id can reach this from a stored run log
 * recorded before the whitelist changed, and refusing to render a save is a
 * worse outcome than rendering an item with no blurb. The version guard on
 * `RunLog` is where a genuinely incompatible save is rejected, loudly and once.
 */
export function itemById(id: string): ItemEntry | null {
  return BY_ID.get(id) ?? null;
}

/** The name an item should display under, falling back to its raw id. */
export function itemName(id: string): string {
  return itemById(id)?.name ?? id;
}
