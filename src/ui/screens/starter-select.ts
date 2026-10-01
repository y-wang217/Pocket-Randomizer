/**
 * Starter select: three randomized Pokemon, one pick, no take-backs.
 *
 * **Compact cards and a detail panel. Bible Rev 19, D78 to D80**
 * (`docs/spec/gymrun-patch-starter-select-redesign.md`).
 *
 * The author's playtest of 2026-10-01 found this screen unreadable at the one
 * number the pick turned on: the stat block drew bars with the numbers one
 * press away, three times over, and Speed could not be compared. The redesign
 * is the author's mockup, built to the bible:
 *
 * - **The card** (D78) is the sprite on a crop of a battle backdrop, the name,
 *   level and gender, the type chips, the ability name and four move chips.
 *   Band, PP, accuracy and priority went off the face with the move cards D40
 *   put here, and each is one long press away on its chip, which is C2.
 * - **A tap selects**, never before it (D69's rule, and C1: a preselected card
 *   is a card the screen chose). The selection fills the detail panel and
 *   shows the *Choose* control, which commits. The selection is the confirm,
 *   so no band opens over the panel it would hide.
 * - **The detail panel** carries the stat block with its numbers at rest (D79)
 *   and the two coverage rows (D80): what the starter's damaging **moves** hit
 *   for 2x or more, and what hits its own typing for more than 1x. Both are
 *   type chart facts against no opponent, in the wheel's order.
 *
 * **Stage 5.1, bible Rev 21, D88 to D90**
 * (`docs/spec/gymrun-stage5.1-band-bars-and-starter-fit.md`). The panel moved
 * from below the cards to **over the selected card's move column** (D89), so a
 * selection never scrolls, and the card's own tap flips the column between the
 * panel and the moves, which keeps the moves one tap away (C2). The stat block
 * carries its band bars (D88). The cards are tightened so three of them, the
 * heading, the blurb and the Choose control fit a phone without a scroll (D90).
 *
 * Everything comes from `describeSpecCard` and `core/coverage.ts`, so this
 * file never sees the sim.
 */
import { describeSpecCard, type SpecCard } from '../../core/battle/driver';
import { moveCoverage, typeVulnerabilities } from '../../core/coverage';
import type { PokemonSpec } from '../../core/types';
import { LOCALES, type LocaleId } from '../../data/locales';
import { applyBackdrop, type AssetKey } from '../assets/manifest';
import { el, levelAria, levelText, moveChip } from '../scene';
import { setProse } from '../dom';
import { STARTER_COPY, STARTER_LABELS } from '../copy/screens';
import { abilityChip, monTypeChip, typeChip as chip } from '../chip';
import { spriteFigure } from '../sprites';
import { statBlock } from '../stat-block';

export interface StarterSelect {
  root: HTMLElement;
  render(options: readonly PokemonSpec[], onPick: (index: number) => void): void;
}

export function createStarterSelect(): StarterSelect {
  const root = el('section', 'screen screen--starter');
  const heading = el('h2', 'screen__title');
  heading.textContent = 'Choose your starter';
  const blurb = el('p', 'screen__blurb');
  setProse(blurb, STARTER_COPY.blurb);
  const grid = el('div', 'starters');
  grid.dataset['tutorial'] = 'starters';
  const choose = document.createElement('button');
  choose.type = 'button';
  choose.className = 'button primary-action starter-select__choose';
  choose.hidden = true;

  root.append(heading, blurb, grid, choose);

  return {
    root,
    render(options, onPick) {
      const cards = options.map((spec) => describeSpecCard(spec));
      let selected: number | null = null;
      let committed = false;

      const built = cards.map((card, index) => renderCard(card, index, () => tap(index)));
      const buttons = built.map((entry) => entry.card);
      grid.replaceChildren(...buttons);
      choose.hidden = true;

      /*
       * A tap on another card selects it and opens its panel over its moves;
       * a tap on the selected card flips that column between the panel and
       * the moves. Only one card ever carries a panel, so the other two keep
       * their moves at rest.
       */
      function tap(index: number): void {
        if (committed) return;
        if (selected === index) {
          const entry = built[index]!;
          entry.show(entry.card.dataset['view'] === 'detail' ? 'moves' : 'detail');
          return;
        }
        selected = index;
        built.forEach((entry, i) => {
          entry.card.setAttribute('aria-pressed', String(i === index));
          if (i === index) entry.show('detail');
          else entry.clear();
        });
        const card = cards[index]!;
        choose.textContent = STARTER_LABELS.choose(card.species);
        choose.hidden = false;
        /*
         * The screen fits a phone at rest and with a selection (D90), so this
         * is a no-op there. On a frame shorter than the goal it brings the
         * commit into view. `nearest`, and no smooth scroll under reduced
         * motion.
         */
        const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        choose.scrollIntoView?.({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
      }

      choose.onclick = () => {
        if (committed || selected === null) return;
        committed = true;
        onPick(selected);
      };
    },
  };
}

/**
 * The battle backdrop a starter stands on: the first region whose types admit
 * its primary type. Every one of the eighteen types is in some region's four,
 * and this is a table read in a fixed order, so nothing is drawn.
 */
function backdropFor(types: readonly string[]): LocaleId | null {
  const primary = types[0];
  const locale = LOCALES.find((entry) => primary !== undefined && entry.types.includes(primary));
  return locale ? locale.id : null;
}

interface BuiltCard {
  card: HTMLElement;
  /** Fill the panel if it is empty, and show the panel or the moves. */
  show(view: 'detail' | 'moves'): void;
  /** Empty the panel and show the moves: the card is no longer selected. */
  clear(): void;
}

function renderCard(detail: SpecCard, index: number, onTap: () => void): BuiltCard {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'starter';
  card.setAttribute('aria-pressed', 'false');

  // The figure stays the card's first child, which `test/sprites.test.ts`
  // reads; the stylesheet stands it on the scene.
  const figure = spriteFigure(detail.species, { phase: index });

  const scene = el('span', 'starter__scene');
  scene.setAttribute('aria-hidden', 'true');
  const locale = backdropFor(detail.types);
  if (locale) applyBackdrop(scene, `battle-backdrop:${locale}` satisfies AssetKey);

  const header = el('div', 'starter__header');
  const name = el('span', 'starter__name');
  name.textContent = detail.species;
  const level = el('span', 'starter__level');
  level.textContent = levelText(detail.level, detail.gender);
  level.setAttribute('aria-label', levelAria(detail.level, detail.gender));
  const types = el('span', 'panel__types');
  types.replaceChildren(...detail.types.map(monTypeChip));
  header.append(name, level, types);

  const side = el('div', 'starter__side');
  const meta = el('div', 'starter__meta');
  meta.append(abilityChip(detail.ability, detail.abilityId));
  const moves = el('div', 'starter__moves');
  moves.replaceChildren(
    ...detail.moves.map((move) =>
      moveChip({
        id: move.id,
        name: move.name,
        type: move.type,
        category: move.category,
        basePower: move.basePower,
        pickable: false,
      }),
    ),
  );
  side.append(meta, moves);

  // The panel over the move column (D89): empty and hidden until selected.
  const panel = el('div', 'starter-detail');
  panel.hidden = true;

  card.append(figure, scene, header, side, panel);
  card.dataset['view'] = 'moves';
  card.addEventListener('click', onTap);
  return {
    card,
    show(view) {
      if (panel.childElementCount === 0) panel.replaceChildren(...renderDetail(detail));
      panel.hidden = view !== 'detail';
      card.dataset['view'] = view;
    },
    clear() {
      panel.replaceChildren();
      panel.hidden = true;
      card.dataset['view'] = 'moves';
    },
  };
}

/**
 * The detail panel's contents for one starter. D79, D80 and D88. No name
 * heading: the panel sits on the card that already carries it (D89).
 */
function renderDetail(detail: SpecCard): HTMLElement[] {
  const stats = statBlock({ ...detail.baseStatsAtLevel, hp: detail.maxHp }, { layout: 'grid', level: detail.level });

  const rows = [
    coverageRow('effective', STARTER_LABELS.effective, moveCoverage(detail.moves)),
    coverageRow('vulnerable', STARTER_LABELS.vulnerable, typeVulnerabilities(detail.types)),
  ].filter((row): row is HTMLElement => row !== null);

  return [stats, ...rows];
}

/** One coverage row: the label and its type chips. An empty row renders nothing. */
function coverageRow(kind: string, label: string, types: readonly string[]): HTMLElement | null {
  if (types.length === 0) return null;
  const row = el('div', `starter-detail__row starter-detail__row--${kind}`);
  const title = el('span', 'starter-detail__label');
  title.textContent = label;
  const chips = el('span', 'starter-detail__types');
  chips.replaceChildren(...types.map(monTypeChip));
  row.append(title, chips);
  return row;
}

export function typeChip(type: string): HTMLElement {
  return chip(type);
}
