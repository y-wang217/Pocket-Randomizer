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
import { basketCost, type ShopStock } from '../../core/economy';
import type { Reward } from '../../core/rewards';
import type { RunState } from '../../core/run';
import { relicById } from '../../data/relics';
import { itemById } from '../../data/items';
import { el } from '../scene';

export interface ShopScreen {
  root: HTMLElement;
  render(stock: ShopStock, state: RunState, onLeave: (indexes: number[]) => void): void;
}

export function createShopScreen(): ShopScreen {
  const root = el('section', 'screen screen--shop');

  const title = el('h2', 'screen__title');
  title.textContent = 'Shop';
  const blurb = el('p', 'screen__blurb');
  blurb.textContent =
    'Pick what you want, then leave. Nothing is bought until you do, and there is ' +
    'no selling and no coming back.';

  const wallet = el('div', 'shop__wallet');
  const shelf = el('ul', 'shop__shelf');
  const footer = el('div', 'shop__footer');

  const leave = document.createElement('button');
  leave.type = 'button';
  leave.className = 'button button--primary';

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
          const name = el('span', 'shop__item-name');
          name.textContent = describeStock(item.reward);
          const detail = el('span', 'shop__item-detail');
          detail.textContent = detailOf(item.reward);
          label.append(name, detail);

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

          row.append(label, price, add);
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
    case 'currency':
      return `${reward.amount} coins`;
  }
}

function detailOf(reward: Reward): string {
  switch (reward.kind) {
    case 'item':
      return itemById(reward.item)?.blurb ?? '';
    case 'heal':
      return 'Heals HP and PP, and clears status.';
    case 'tm':
    case 'tutor':
      // Stage 4.5.1: the shop asks the same two questions a reward card does —
      // who learns it, then what it displaces — so the shelf can no longer
      // promise which move goes.
      return 'You choose who learns it, and what it replaces.';
    default:
      return '';
  }
}
