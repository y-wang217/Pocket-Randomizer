/**
 * The shop: a shelf, a balance, and one decision made all at once.
 *
 * **The basket is committed whole, on Leave, and that shape is deliberate.**
 * Buying item by item would let a player spend their way into a corner one
 * click at a time; selecting a basket and seeing the remainder update is the
 * version where the trade-off is visible while it is still reversible. It also
 * matches what the run log records — one `shop` decision holding a set of shelf
 * indexes — so what the player does and what gets replayed are the same act.
 *
 * Unaffordable rows are disabled rather than hidden. A shelf that quietly
 * dropped what you cannot afford would teach the player nothing about prices;
 * one that shows a Leftovers at 145 coins next to your 60 tells them what to
 * save for. The disabling is a courtesy either way — `economy.applyPurchases`
 * is what actually refuses an overdraft, because a replayed log has no buttons.
 */
import { describeMove } from '../../core/battle/driver';
import { basketCost, type ShopStock } from '../../core/economy';
import type { Reward } from '../../core/rewards';
import type { RunState } from '../../core/run';
import { relicById } from '../../data/relics';
import { itemCopy, relicCopy } from '../../data/itemCopy';
import { itemById, BERRIES } from '../../data/items';
import { moveCardData } from '../move-detail';
import { el, moveCard } from '../scene';
import { prose, setProse } from '../dom';
import { SHOP_COPY } from '../copy/screens';

export interface ShopScreen {
  root: HTMLElement;
  render(stock: ShopStock, state: RunState, onLeave: (indexes: number[]) => void): void;
}

export function createShopScreen(): ShopScreen {
  const root = el('section', 'screen screen--shop');

  const title = el('h2', 'screen__title');
  title.textContent = 'Shop';
  const blurb = el('p', 'screen__blurb');
  setProse(blurb, SHOP_COPY.blurb);

  const wallet = el('div', 'shop__wallet');
  const shelf = el('ul', 'shop__shelf');
  const footer = el('div', 'shop__footer');

  const leave = document.createElement('button');
  leave.type = 'button';
  leave.className = 'button primary-action';

  footer.append(leave);
  root.append(title, blurb, wallet, shelf, footer);

  return {
    root,
    render(stock, state, onLeave) {
      const selected = new Set<number>();

      const refresh = (): void => {
        const spent = basketCost(stock, [...selected]);
        const left = state.currency - spent;

        wallet.replaceChildren(
          coin('Carrying', state.currency),
          coin('Basket', spent),
          coin('Left', left, left === 0 && spent > 0 ? 'warn' : undefined),
        );

        leave.textContent = selected.size === 0 ? 'Leave without buying' : `Buy ${selected.size} and leave`;

        for (const row of shelf.querySelectorAll<HTMLElement>('.shop__item')) {
          const index = Number(row.dataset['index']);
          const price = Number(row.dataset['price']);
          const chosen = selected.has(index);
          row.classList.toggle('shop__item--chosen', chosen);
          const button = row.querySelector('button');
          if (button) {
            // Affordable means "affordable *given what is already in the
            // basket*", which is the only version of the word that helps.
            button.disabled = !chosen && price > left;
            button.textContent = chosen ? 'Remove' : 'Add';
          }
        }
      };

      shelf.replaceChildren(
        ...stock.items.map((item, index) => {
          const row = el('li', 'shop__item');
          row.dataset['index'] = String(index);
          row.dataset['price'] = String(item.price);

          const label = el('div', 'shop__item-label');
          /*
           * The category, printed on the row.
           *
           * The shelf guarantees one of each (`data/shop.ts`), and a guarantee
           * the player cannot see is not a guarantee they can plan around — it
           * is a coincidence they have to infer over several visits. Read back
           * off the resolved reward rather than carried on the row, so the
           * label can never claim a category the row did not deliver.
           *
           * It is an attribute and not a verdict: no ordering by it, no marker
           * on a better one, and the rows stay in shelf order.
           */
          const kind = el('span', 'shop__item-kind');
          kind.textContent = categoryLabel(item.reward);
          const name = el('span', 'shop__item-name');
          name.textContent = describeStock(item.reward);
          const detail = el('span', 'shop__item-detail');
          detail.replaceChildren(detailOf(item.reward));
          label.append(kind, name, detail);

          const price = el('span', 'shop__price');
          price.textContent = `${item.price}`;

          const add = document.createElement('button');
          add.type = 'button';
          add.className = 'button';
          add.addEventListener('click', () => {
            if (selected.has(index)) selected.delete(index);
            else selected.add(index);
            refresh();
          });

          const top = el('div', 'shop__item-row');
          top.append(label, price, add);
          row.append(top);

          /*
           * The move card, which closes `docs/README.md` open item 13.
           *
           * The shelf printed `Tutor: Flamethrower` and nothing else, while the
           * reward screen offering the identical move printed its type, base
           * power, band, PP, category and tags. Same decision, same move, two
           * different amounts of information depending on which screen it was
           * met on — and the shop is the screen where the player is also being
           * asked to price it.
           *
           * The same insertion point the reward screen uses (`scene.moveCard`
           * over `moveCardData`), so the two cannot drift. **No holder is
           * passed**, for the reason `screens/reward.ts` gives at length: the
           * move is unassigned until the purchase asks who learns it, so a STAB
           * tag here would claim something not yet true.
           */
          if (isMoveRow(item.reward)) {
            const facts = describeMove(item.reward.move);
            if (facts) row.append(moveCard(moveCardData(facts, state.tuning)));
          }

          return row;
        }),
      );

      leave.onclick = () => onLeave([...selected].sort((a, b) => a - b));
      refresh();
    },
  };
}

function coin(label: string, amount: number, tone?: 'warn'): HTMLElement {
  const box = el('div', `shop__coin${tone ? ` shop__coin--${tone}` : ''}`);
  const key = el('span', 'shop__coin-label');
  key.textContent = label;
  const value = el('span', 'shop__coin-value');
  value.textContent = String(amount);
  box.append(key, value);
  return box;
}

/** The shelf name. A shop sells rewards, so this mirrors the reward card. */
function describeStock(reward: Reward): string {
  switch (reward.kind) {
    case 'relic':
      return relicById(reward.relic)?.name ?? reward.relic;
    case 'item':
      return itemById(reward.item)?.name ?? reward.item;
    case 'heal':
      return reward.fraction >= 1 ? 'Full restore' : `Restore ${Math.round(reward.fraction * 100)}%`;
    case 'tm':
      return `TM: ${reward.move}`;
    case 'tutor':
      return `Tutor: ${reward.move}`;
    case 'technique':
      return `Technique: ${reward.move}`;
    case 'currency':
      return `${reward.amount} coins`;
  }
}

/** Whether this row teaches a move, and therefore earns a card under it. */
function isMoveRow(reward: Reward): reward is Extract<Reward, { move: string }> {
  return reward.kind === 'tm' || reward.kind === 'tutor' || reward.kind === 'technique';
}

const BERRY_IDS = new Set(BERRIES.map((entry) => entry.id));

/**
 * The category a row fills, read back off what it resolved to.
 *
 * Mirrors `ShopCategory` in `data/shop.ts` without importing the slot tables:
 * what the player is owed is one row of each category, and what this says is
 * which one they got. A berry and a held item are both `kind: 'item'` and are
 * told apart by the id, exactly as the shelf tables tell them apart.
 */
function categoryLabel(reward: Reward): string {
  switch (reward.kind) {
    case 'tm':
    case 'tutor':
      return 'Battle move';
    case 'technique':
      return 'Technique';
    case 'heal':
      return 'Restore';
    case 'relic':
      return 'Relic';
    case 'item':
      return BERRY_IDS.has(reward.item) ? 'Berry' : 'Held item';
    case 'currency':
      return 'Coins';
  }
}

/** The shelf line under a name: an item's own blurb, or the two-form copy. */
function detailOf(reward: Reward): Node {
  switch (reward.kind) {
    case 'item':
      return document.createTextNode(itemCopy(reward.item));
    case 'heal':
      return prose(SHOP_COPY.heal);
    case 'tm':
    case 'tutor':
    case 'technique':
      // Stage 4.5.1: the shop asks the same two questions a reward card does —
      // who learns it, then what it displaces — so the shelf can no longer
      // promise which move goes.
      return prose(SHOP_COPY.teach);
    /*
     * **The relic's own effect text, carried over with the R19 reward-card
     * fix.** A relic row fell through to the empty default and showed a bare
     * name, which is the same gap the reward card had: `describeStock` reads
     * the table for the name and nothing read it for the effect. The ruling
     * asked for relics to say what they are on the card, and a shelf that
     * charged 260 coins for a name the reward card now explains would be the
     * inconsistency this fix created rather than one it found.
     */
    case 'relic':
      return document.createTextNode(relicCopy(reward.relic));
    default:
      return document.createTextNode('');
  }
}
