/**
 * The evolution block on the result screen. **Stage 4.9.**
 *
 * A gym clear levels the party and, from this stage, evolves it, and the
 * player sees that here: a row per member that changes, and — where the dex
 * forks — the choice. A block inside the result screen rather than a screen
 * after it, for the reason the capture block gives: there is one path by which
 * a node completes, and this is a fact about the same gym the screen is
 * already reporting.
 *
 * Attributes, never verdicts. An option card shows the sprite, the species,
 * the types and the six stats at the member's level, in dex order, and nothing
 * marks one as better. Eevee is eight cards; the three-option rule is about
 * offers the run draws, not about a fork the dex has.
 */
import { describeSpecCard } from '../../core/battle/driver';
import type { EvolutionQuestion, EvolutionRecord } from '../../core/evolution';
import type { SpeciesEntry } from '../../data/speciesPools';
import { EVOLUTION_CHOICE, EVOLUTION_HEADING, EVOLUTION_LINE } from '../copy/screens';
import { prose } from '../dom';
import { el } from '../scene';
import { spriteFigure } from '../sprites';
import { statLine, typeChip } from './starter-select';

export interface EvolutionPrompt {
  /** What the clear has already decided, in walk order. */
  records: readonly EvolutionRecord[];
  /** The fork the player has to answer, if any. */
  question?: { question: EvolutionQuestion; onChoose: (index: number) => void } | null;
}

export function renderEvolutionBlock(prompt: EvolutionPrompt): HTMLElement {
  const section = el('div', 'evolve');

  const title = el('h3', 'result__heading');
  title.textContent = EVOLUTION_HEADING;
  section.append(title);

  if (prompt.records.length > 0) {
    const list = el('ul', 'evolve__records');
    list.replaceChildren(
      ...prompt.records.map((record) => {
        const row = el('li', 'evolve__record');
        // The figure with the idle bob, as every other selection surface
        // draws a Pokemon since the idle-sprites patch; the two phases differ
        // so the pair does not bob in lockstep.
        const from = spriteFigure(record.from, { phase: 0 });
        const to = spriteFigure(record.to, { phase: 3 });
        const line = el('span', 'evolve__line');
        line.replaceChildren(prose(EVOLUTION_LINE(record.nickname ?? record.from, record.from, record.to)));
        row.append(from, to, line);
        return row;
      }),
    );
    section.append(list);
  }

  if (prompt.question) {
    const { question, onChoose } = prompt.question;
    const blurb = el('p', 'evolve__blurb');
    blurb.replaceChildren(prose(EVOLUTION_CHOICE(question.member.spec.nickname ?? question.member.spec.species)));
    const options = el('div', 'evolve__options');
    options.replaceChildren(
      ...question.options.map((option, index) => renderOption(option, question, index, () => onChoose(index))),
    );
    section.append(blurb, options);
  }

  return section;
}

function renderOption(option: SpeciesEntry, question: EvolutionQuestion, index: number, onChoose: () => void): HTMLElement {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'party__member party__member--target evolve__option';
  card.dataset['species'] = option.id;

  // The card at the member's own level, so the stats are the ones it would
  // actually have, not a level-100 abstraction.
  const detail = describeSpecCard({ ...question.member.spec, species: option.species, nickname: undefined });

  const header = el('div', 'panel__header');
  const name = el('span', 'panel__name');
  name.textContent = option.species;
  header.append(name, ...detail.types.map(typeChip));

  card.append(spriteFigure(option.species, { phase: index }), header, statLine(detail.baseStatsAtLevel, detail.maxHp));
  card.addEventListener('click', onChoose);
  return card;
}
