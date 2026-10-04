/**
 * The defender opening draft, drawn at generation. **Defender Mode v0, step 2.**
 *
 * Three picks of one from three, from species carrying the gym type in either
 * slot. The gym type is the player's first decision, so the draft is drawn for
 * **all three** types on every defender run and the decision selects one
 * (report ruling R3, and CLAUDE.md: a draw that depends on player state draws
 * every outcome at generation). The cost is twenty-seven specs and twenty-seven
 * highlight draws per run, all of them cheap.
 *
 * Drafted mons are the player's starters, so they are generated the way
 * `generateStarters` generates one: the starter level and the starter move
 * bands. Only the species pool differs, narrowed to the type.
 */
import { DEFENDER_DRAFT, DEFENDER_GYM_TYPES, type DefenderGymType } from '../../data/defender';
import { starterLevel } from '../../data/scaling';
import { STARTER_MOVE_BANDS } from '../../data/starters';
import { named } from '../nicknames';
import { drawHighlightSlot, flatPool, generateTypedMons } from '../randomizer';
import type { Rng } from '../rng';
import { defenderDraftKey, defenderHighlightKey, nicknameKey } from '../streamKeys';
import type { PokemonSpec } from '../types';

/** Every draft option of every pick, per gym type: `[pick][option]`. */
export type DefenderDraft = Readonly<Record<DefenderGymType, readonly (readonly PokemonSpec[])[]>>;

/**
 * Give a freshly generated player-side mon its highlight and its name.
 *
 * Both draws are keyed by `id`, which names the mon, so the order mons are
 * finished in cannot move either draw.
 */
export function finishDefenderMon(spec: PokemonSpec, id: string, rng: Rng): PokemonSpec {
  const highlightSlot = drawHighlightSlot(spec, rng.randomizer.at(defenderHighlightKey(id)));
  const finished = named(spec, rng.randomizer.at(nicknameKey(`defender/${id}`)));
  return highlightSlot === undefined ? finished : { ...finished, highlightSlot };
}

export function generateDefenderDraft(rng: Rng): DefenderDraft {
  const { picks, options } = DEFENDER_DRAFT;
  const draft = {} as Record<DefenderGymType, PokemonSpec[][]>;
  for (const type of DEFENDER_GYM_TYPES) {
    const stream = rng.randomizer.at(defenderDraftKey(type));
    const seen = new Set<string>();
    const flat = generateTypedMons(type, 0, starterLevel(), flatPool(STARTER_MOVE_BANDS), picks * options, stream, seen);
    const finished = flat.map((spec, index) => finishDefenderMon(spec, `draft/${type}/${index}`, rng));
    draft[type] = Array.from({ length: picks }, (_, pick) => finished.slice(pick * options, (pick + 1) * options));
  }
  return draft;
}
