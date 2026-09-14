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
 *   - **Z-crystals and Mega Stones** — a once-per-battle nuke and a mid-battle
 *     stat rewrite, neither of which the greedy AI scores, so both would make
 *     the balance report measure the mis-scoring.
 *
 * **Berries were on that list and came off it in Stage 4.6b.** The Stage 3 note
 * said they "fire once and vanish, which needs an inventory to be interesting
 * and needs the player to be able to *not* use one" — and both conditions are
 * met now. The inventory is 4.5.1's backpack, and the choice not to use one is
 * a backpack slot spent on a Leftovers instead. See `BERRIES` below.
 *
 * ## One item per Pokemon, and a bag for the rest
 *
 * A Pokemon still holds exactly one item. What changed in Stage 4.5.1 is what
 * happens to the others: **there is an inventory now, and nothing is destroyed
 * except by an explicit discard.**
 *
 * Stage 3 refused to build one and wrote down what it would need — "a screen, a
 * capacity rule, and a decision about what happens on a wipe" — and gated the
 * refusal on there being a party to spread items across. All three exist: the
 * screen is the party screen, the capacity rule is `tuning.backpackCapacity`,
 * and the answer on a wipe is that the run is over and the bag goes with it.
 *
 * The consequence for this file is that the cost of an item moved. It used to
 * be paid on *assignment* — giving a Pokemon a Leftovers destroyed whatever it
 * held — and it is now paid on *acquisition*, against a finite bag. Which is
 * the better place for it: the reward screen is where the player is choosing
 * between three cards, and the party screen is where they are free to change
 * their mind. See `core/items.ts`.
 */

/** A held item the reward pools may draw. */
export interface ItemEntry {
  /**
   * True for a berry: a held item that fires once and is destroyed.
   *
   * **Stage 4.6b, and it is the one property that changes what an item *is*
   * rather than what it does.** Every other item on this whitelist is
   * permanent — assign it, unassign it, discard it, but it exists until the
   * player says otherwise. A berry leaves the run the moment it triggers, and
   * `core/battle/driver.ts` reads that off the `-enditem` protocol message so
   * the run state agrees with the battle that spent it.
   *
   * A flag rather than a separate table, because a berry *is* a held item in
   * every other respect: it occupies the one item slot, it occupies a backpack
   * slot, it is assigned on the party screen, and the sim resolves it with no
   * help from us. A second table would be a second set of rules for all four.
   */
  consumable?: boolean;
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
   * The type this item *halves an incoming hit of*, for the resist berries and
   * null otherwise.
   *
   * **A separate field from `boostsType`, and the separation is a correction.**
   * The first draft of the berry table set `boostsType: 'Fighting'` on a Chople
   * Berry, which reads the same and means the opposite: `boostsType` is what
   * `itemSuitsTypes` checks the *holder's* types against, so a Chople would
   * have been offered as a match for a Fighting-type Pokemon — precisely the
   * one that does not want it. A resist berry is wanted by whatever is about to
   * be hit by that type, which is a fact about the opponent.
   *
   * Which is why nothing reads this to decide who should hold one. It is here
   * so the reward card can name the type, and so the player can make the plan
   * the gym rail already lets them make: every leader's type is on screen from
   * segment 1.
   */
  resistsType?: string | null;
  /**
   * What this item puts back on the holder when it fires, for the one consumer
   * that has to *predict* it: the opponent AI's kill line, under `itemAware`.
   *
   * **A description of the engine's behaviour, not the behaviour.** @pkmn/sim
   * implements the berry; this is what a player holds in their head when they
   * look at a Sitrus Berry and decide the attack in front of them is not
   * actually lethal. `flat` is in HP, `fraction` is of max HP, and an item with
   * neither leaves the kill line alone.
   */
  restores?: { flat?: number; fraction?: number };
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
  return { id, name, blurb, boostsType: null, resistsType: null, locksMove: false, ...extra };
}

/** A berry: the same record, with `consumable` set. */
function berry(id: string, name: string, blurb: string, extra: Partial<ItemEntry> = {}): ItemEntry {
  return item(id, name, blurb, { ...extra, consumable: true });
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
 * Berries: the low denomination of the whole economy.
 *
 * **They matter early, they fade as HP totals scale, and the fade is the
 * design.** An Oran Berry restores 10 HP. At segment 1 that is a fifth of a
 * health bar and the difference between two fights and three; at segment 7 it
 * is a rounding error, and the slot it occupies is worth more as a Leftovers.
 * A player who is still carrying berries into the last two segments has not
 * been offered anything better, which is a fact about the reward pools that the
 * simulator can see.
 *
 * That is also why they occupy backpack slots against
 * `tuning.backpackCapacity` rather than sitting in a pocket of their own. A
 * separate berry pouch would make them free, and a free consumable is one the
 * player never has to think about; competing with held items is what makes
 * dropping them a decision the player makes deliberately, at the point the
 * economy has moved past them.
 *
 * ## Why these fifteen
 *
 * Three groups, and each earns its place differently:
 *
 *   - **Healing** — Oran and Sitrus fire at half HP and buy a turn. The
 *     cheapest possible effect and the one the early game is short of.
 *   - **Status** — Lum, Chesto and Persim answer the thing a run cannot play
 *     around: a turn-two sleep or freeze that outlasts the fight. Stage 1
 *     cleared status between nodes for exactly this reason; a berry is the
 *     *within*-fight version of the same mercy.
 *   - **Type resist** — the six that halve one super-effective hit. These are
 *     the interesting ones, because they are the only berry a player can
 *     *plan* with: the gym rail names every leader's type from segment 1, so
 *     holding a Chople into a Fighting gym is a decision rather than a hope.
 *
 * Leppa is the odd one out and is here on the spec's list: PP is the resource
 * a run quietly runs out of, and 4.6 does not otherwise touch PP restoration.
 */
export const BERRIES: readonly ItemEntry[] = [
  berry('oranberry', 'Oran Berry', 'Restores 10 HP when the holder drops below half.', {
    restores: { flat: 10 },
  }),
  berry('sitrusberry', 'Sitrus Berry', 'Restores 1/4 max HP when the holder drops below half.', {
    restores: { fraction: 0.25 },
  }),
  berry('lumberry', 'Lum Berry', 'Cures any status condition, once.'),
  berry('chestoberry', 'Chesto Berry', 'Wakes the holder from sleep, once.'),
  berry('persimberry', 'Persim Berry', 'Cures confusion, once.'),
  berry('leppaberry', 'Leppa Berry', 'Restores 10 PP to a move that has run out.'),
  berry('occaberry', 'Occa Berry', 'Halves one super-effective Fire hit.', { resistsType: 'Fire' }),
  berry('passhoberry', 'Passho Berry', 'Halves one super-effective Water hit.', { resistsType: 'Water' }),
  berry('rindoberry', 'Rindo Berry', 'Halves one super-effective Grass hit.', { resistsType: 'Grass' }),
  berry('wacanberry', 'Wacan Berry', 'Halves one super-effective Electric hit.', { resistsType: 'Electric' }),
  berry('chopleberry', 'Chople Berry', 'Halves one super-effective Fighting hit.', { resistsType: 'Fighting' }),
  berry('payapaberry', 'Payapa Berry', 'Halves one super-effective Psychic hit.', { resistsType: 'Psychic' }),
  berry('yacheberry', 'Yache Berry', 'Halves one super-effective Ice hit.', { resistsType: 'Ice' }),
  berry('habanberry', 'Haban Berry', 'Halves one super-effective Dragon hit.', { resistsType: 'Dragon' }),
  berry('colburberry', 'Colbur Berry', 'Halves one super-effective Dark hit.', { resistsType: 'Dark' }),
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
  // Appended, like every list before them, because the order is a draw order.
  ...BERRIES,
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
