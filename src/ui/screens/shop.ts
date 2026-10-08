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
import { partyAfterPurchases, type RunState } from '../../core/run';
import { openBand } from '../band';
import { el } from '../scene';
import { setProse } from '../dom';
import { BUY_COPY, SHOP_COPY } from '../copy/screens';
import { renderRewardCard, restorePreviewRow } from './reward';
import { coinAmount } from '../chip';

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
          const button = row.querySelector<HTMLButtonElement>('button.reward');
          if (button) {
            // Chosen only after a tap, never at rest (Stage 5.0/3, D69).
            button.setAttribute('aria-pressed', String(chosen));
            // Affordable means "affordable *given what is already in the
            // basket*", which is the only version of the word that helps.
            button.disabled = !chosen && price > left;
          }
        }
      };

      shelf.replaceChildren(
        ...stock.items.map((item, index) => {
          const row = el('li', 'shop__item');
          row.dataset['index'] = String(index);
          row.dataset['price'] = String(item.price);

          /*
           * **The shelf mounts the reward card. Milestone M5.1, D29.**
           *
           * This file used to build `.shop__item` from scratch — a kind label,
           * a name, a detail line, its own `itemById`, `relicById` and
           * `describeMove` reads, and its own copy of the move-card insertion
           * point — while `screens/reward.ts` exported `renderRewardCard` to
           * exactly one caller. Section 4 has said since Rev 1 that a shop card
           * *"follows the reward card, plus price number"*, and it did not:
           * the same reward drew two different faces depending on which screen
           * you met it on. Section 5 closes with that exact defect — *"a
           * component that exists twice"* — and D29 ruled the unification.
           *
           * So the card is the control. It was already a `<button>`, the price
           * rides on it, and the separate `Add` button is gone: two controls
           * doing one job was the same defect one level down, and its label was
           * a word at rest on a surface budgeted at eight. **Chosen is a class,
           * not a word** — `shop__item--chosen` already existed and already
           * carried the state; the text beside it was a second channel for one
           * fact, which R3 forbids.
           *
           * `scripts/smoke.mjs` and `scripts/visual/browser.mjs` both walk
           * `.shop__item button:not([disabled])`, which is still exactly this
           * card, so the two walks needed no edit.
           */
          row.append(
            renderRewardCard(
              item.reward,
              state,
              () => {
                if (selected.has(index)) selected.delete(index);
                else selected.add(index);
                refresh();
              },
              { price: item.price },
            ),
          );

          return row;
        }),
      );

      /*
       * **A basket is bought through the band. Stage 5.0/3, D69.** The shop
       * already selected before it committed, which is the shape D69 asks of
       * the result screen; what it lacked was the one confirm component. The
       * band shows the basket's cards, and its way out returns to the shelf
       * with the basket intact. Leaving with nothing is not a buy and does not
       * ask.
       */
      leave.onclick = () => {
        const basket = [...selected].sort((a, b) => a - b);
        if (basket.length === 0) {
          onLeave(basket);
          return;
        }
        const cardsBought = el('div', 'shop__basket');
        for (const index of basket) {
          const item = stock.items[index];
          if (item) cardsBought.append(renderRewardCard(item.reward, state, () => undefined, { price: item.price, inert: true }));
        }
        /*
         * A basket that heals shows the party it heals to (2026-10-08). The
         * whole basket, through `applyPurchases` on a throwaway state, so two
         * heals stack the way the run will stack them.
         */
        let content: HTMLElement = cardsBought;
        if (basket.some((index) => stock.items[index]?.reward.kind === 'heal')) {
          content = el('div', 'reward-claim');
          content.append(cardsBought, restorePreviewRow(partyAfterPurchases(state, stock, basket)));
        }
        openBand({
          title: BUY_COPY.title,
          content,
          confirm: BUY_COPY.confirm,
          cancel: BUY_COPY.cancel,
          onConfirm: () => onLeave(basket),
          onCancel: () => leave.focus(),
        });
      };
      refresh();
    },
  };
}

function coin(label: string, amount: number, tone?: 'warn'): HTMLElement {
  const box = el('div', `shop__coin${tone ? ` shop__coin--${tone}` : ''}`);
  const key = el('span', 'shop__coin-label');
  key.textContent = label;
  // The currency mark beside the number, as the shelf's prices under it wear
  // it (2026-10-08). The three words stay: they name which balance, and the
  // mark names the unit.
  box.append(key, coinAmount(String(amount), 'shop__coin-value'));
  return box;
}





