/**
 * What the player may start a run as.
 *
 * Stage 1 shipped this as eleven hand-picked Pokemon with hand-picked kits, and
 * the reasoning was sound at the time: the player carries one Pokemon through a
 * whole segment, so a dud roll is a lost run they never had a hand in.
 *
 * Stage 2 kept the *guarantee* and dropped the whitelist: a **band window**
 * over data/speciesPools.ts, fully evolved, roughly 490+ base stat total,
 * while segment 0's opponents drew from bands 0 and 1, so the player started
 * ahead of the first gym and the curve caught up around segment 4.
 *
 * **Stage 4.9 inverted that, 2026-09-15.** The window is band 0 and the rule
 * is "a base form with an evolution": the player starts with the measliest
 * thing in the dex and grows it, and the opponents start measly too. The
 * guarantee that survives is the one that mattered — the pool is a window
 * over the generated table, not a hand-picked list — and the promise the old
 * window made (a strong opening) is deliberately gone.
 *
 * The ability and the moveset are rolled by the randomizer like everything
 * else. That is not a detail: a randomizer where the *opponents* are randomized
 * and the player's Pokemon is a curated set piece is a game about reacting to
 * chaos rather than a game about playing it.
 *
 * `getStarterPool(unlocked)` survives unchanged in shape because it is Stage
 * 5's seam, and unlocks are strictly **additive** — appended after the base
 * pool, never inserted and never removed. Generation draws an index into this
 * list, so an unlock that reordered it would change what every previously
 * recorded seed offers.
 */
import { isSpeciesBlacklisted } from './blacklists';
import { hasEvolution, isBaseForm } from './evolution';
import { SPECIES_POOL, type SpeciesEntry } from './speciesPools';

/**
 * The species bands a starter is drawn from.
 *
 * The one place the randomizer deliberately favours the player, and the number
 * to move if the simulator says gym 1 is either a formality or a wall.
 */
export const STARTER_BANDS: readonly number[] = [0];

/**
 * The lowest base stat total a starter may have.
 *
 * Band 0 runs from Sunkern at 180 to the 340 cut, and a Caterpie or a Magikarp
 * at level 7 is not a measly starter, it is a run that ends at the first
 * trainer. The real starters sit at 309 to 318 and every pseudo-legendary's
 * base form at 300; 280 keeps those and the Nidorans, Growlithe and Machop,
 * and drops the ninety-odd base forms whose first stage is a cocoon or a
 * baby. The first Stage 4.9 sweep without this floor cleared gym 1 27% of the
 * time; the number with it is in `docs/balance.md` section 0.
 */
export const STARTER_BST_FLOOR = 280;

/**
 * The move bands a starter's kit is drawn from.
 *
 * **Not segment 0's bands, and the difference is the single largest balance
 * finding of Stage 2.** The first cut rolled the starter's moves from the
 * segment it appears in, which reads as obviously correct and is a trap: the
 * player keeps that kit for the whole run, with no XP, no move relearner and
 * no rewards until Stage 3, while every opponent's kit climbs to band 3 by
 * segment 6. The player was fighting segment 8 with segment 1's moves.
 *
 * The simulator measured it as a 9% chance of losing *any given ordinary
 * fight*, which compounds to a run that never sees gym 4 — and it read as a
 * level-curve problem right up until the per-node death counts said two thirds
 * of deaths happened at wild and trainer nodes rather than at gyms.
 *
 * So the starter's kit is drawn from the *whole run's* range instead. It is
 * strong at segment 1 and ordinary by segment 8, which is the correct shape for
 * a resource the player cannot upgrade.
 *
 * **Stage 3 is that stage, and the window narrowed as predicted.** Band 3 — the
 * 100+ BP moves — is out. The reasoning is the mirror image of the Stage 2
 * finding: a starter holding band-3 moves has a best attack no reward can beat,
 * so every TM and tutor card in the game is a dead card. The simulator measured
 * it precisely: with the wide window, move rewards were taken 2-3% of the time,
 * and the report read that as "nobody wants a TM" when it was really "nobody
 * can be offered an upgrade".
 *
 * That matters beyond the take rate, because moves are what carries the tier
 * gradient. A Pokemon holds one item, so a second item reward is worth almost
 * nothing and a risk-greedy player's advantage saturates after one good card;
 * a move slot is one of four and keeps improving. Killing the move reward
 * therefore killed the risk gradient it was meant to pay for.
 *
 * So the kit is strong at segment 1, ordinary by segment 4, and the way back is
 * the reward screen — which is the shape a resource the player *can* upgrade
 * should have.
 *
 * ## Stage 4.6b: band 1 only, and the renumbering that hides how big a change
 * that is
 *
 * This read `[1, 2]` and now reads `[1]`, which looks like a one-band narrowing
 * and is not. Move bands were renumbered from 0-3 to 1-4 in the same stage, so
 * the old `[1, 2]` is the new `[2, 3]` — the starter has come down **two**
 * bands, from "the middle of the table" to "the bottom of it".
 *
 * That is the ramp's opening position, and it is the point of the stage: a run
 * starts with Tackle and Growl and climbs. The Stage 3 finding above still
 * holds and is what makes the narrowing safe rather than cruel — a starter
 * whose best attack no reward can beat makes every move card in the game a dead
 * card, and this is that argument taken to its conclusion. The compensation is
 * that the *opponents* start at band 1 too: segments 1-2 draw band 1 only, so
 * the opening is a fight between two weak kits rather than a weak kit against
 * the old one.
 */
export const STARTER_MOVE_BANDS: readonly number[] = [1];

/*
 * **Stage 4.9: a starter is a base form that goes somewhere.** Band 0 — 340
 * base stat total or less, measly by construction — and at least one
 * in-pool evolution, so the run opens with a Pokemon that has to be carried
 * through gyms to become anything. Every pseudo-legendary's base form is in
 * this window (Gible, Dratini, Larvitar, Bagon, Beldum at 300), so the high
 * roll is real and still has to be nurtured: a Gible is a Garchomp at the
 * gym 7 clear and not before. A base form with no evolution (Tauros, Lapras)
 * is out, because its whole arc would be over at the starter screen.
 */
const BASE: readonly SpeciesEntry[] = SPECIES_POOL.filter(
  (entry) =>
    STARTER_BANDS.includes(entry.band) &&
    entry.bst >= STARTER_BST_FLOOR &&
    isBaseForm(entry) &&
    hasEvolution(entry) &&
    !isSpeciesBlacklisted(entry.id),
);

/**
 * Species that exist but are not offered until unlocked.
 *
 * Empty, and that is the honest state of it: there is no unlock system yet, so
 * there is nothing to unlock. Stage 5 fills this and changes nothing else.
 */
const LOCKED: readonly SpeciesEntry[] = [];

/**
 * The species a run may offer as starters, in a fixed draw order.
 *
 * @param unlocked Ids the player has unlocked. Stage 2 never passes it.
 */
export function getStarterPool(unlocked?: readonly string[]): readonly SpeciesEntry[] {
  if (!unlocked || unlocked.length === 0) return BASE;
  const wanted = new Set(unlocked);
  return [...BASE, ...LOCKED.filter((entry) => wanted.has(entry.id))];
}
