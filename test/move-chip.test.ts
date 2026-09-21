/**
 * The move chip, and the confirm it opens. **Milestone M2.3.**
 *
 * @vitest-environment jsdom
 *
 * Section 5's component canon has listed a move chip beside the move card
 * since the bible was written — *"Move chip | Name, type chip, category glyph,
 * BP | Replacement and teach lists"* — and the Tier 0 census recorded it
 * `absent`. This is the first surface to mount one.
 *
 * **What the item is actually trading.** The replacement screen drew five full
 * faces: the incoming move and the four it could displace. That shape was
 * chosen deliberately — Part 4's rule is that the comparison belongs to the
 * player, and five identical cards is the least opinionated way to lay one
 * out — and it missed the fold. Five full cards do not fit 390x844, so the
 * player scrolled between the options they were choosing between.
 *
 * So the four shrink and the confirm carries the full pair. The bet is that a
 * name, a type, a category and a base power are what differ between a member's
 * own four moves; the disconfirmer is in the milestone and is behavioural —
 * *"testers expand every chip before choosing. Then chips gain PP at rest."*
 * Nothing here can test that. What these cases hold is the half that is
 * structural: the chip is the same component's compact form, the confirm shows
 * both full faces, and neither ranks anything.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { createParty } from '../src/core/party';
import { describeMove } from '../src/core/battle/driver';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { createMoveReplaceScreen } from '../src/ui/screens/move-replace';
import { openBandOf } from '../src/ui/band';
import { resetSettings } from '../src/ui/settings';

const ROSTER = [
  { species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam', 'Earthquake', 'Crunch', 'Rest'], level: 40 },
];

beforeEach(() => {
  resetSettings();
  openBandOf()?.close();
  document.body.replaceChildren();
});

function render() {
  const screen = createMoveReplaceScreen();
  const replaced: number[] = [];
  const member = createParty(ROSTER)[0]!;
  const incoming = describeMove('Ice Beam')!;
  screen.render(member, incoming, (slot) => replaced.push(slot), DEFAULT_TUNING);
  document.body.append(screen.root);
  return { screen, replaced, member, incoming };
}

describe('the replacement screen draws one card and four chips', () => {
  it('shrinks the four current moves to chips and keeps the incoming one full', () => {
    const { screen } = render();
    const chips = screen.root.querySelectorAll('.replace__moves .move--chip');
    expect(chips, 'the four current moves are chips').toHaveLength(4);
    // The incoming move is the one thing on this screen that is not being
    // compared against three others, so it keeps the full face.
    expect(screen.root.querySelectorAll('.replace__incoming .move--card')).toHaveLength(1);
    expect(screen.root.querySelectorAll('.replace__moves .move--card'), 'no full card survives in the row').toHaveLength(0);
  });

  it('carries section 5s four fields and not the two it gives up', () => {
    const { screen } = render();
    const chip = screen.root.querySelector<HTMLElement>('.replace__moves .move--chip')!;
    expect(chip.querySelector('.move__name')?.textContent).toBe('Body Slam');
    expect(chip.querySelector('.chip--type'), 'type chip').not.toBeNull();
    expect(chip.querySelector('.badge--category'), 'category glyph').not.toBeNull();
    expect(chip.querySelector('.move__power'), 'base power').not.toBeNull();
    // PP and the band are what the chip trades away, and they are the two the
    // confirm below brings back. If the disconfirmer fires, PP comes here.
    expect(chip.querySelector('.move__pp'), 'the chip gives up PP').toBeNull();
    expect(chip.querySelector('.band'), 'the chip gives up the band').toBeNull();
  });

  it('is in slot order, which ranks nothing', () => {
    const { screen } = render();
    const names = [...screen.root.querySelectorAll('.replace__moves .move__name')].map((n) => n.textContent);
    expect(names).toEqual(ROSTER[0]!.moves);
  });
});

describe('the confirm shows both full cards', () => {
  it('opens the shared band with two faces, each carrying its band pips', () => {
    const { screen } = render();
    const chip = screen.root.querySelector<HTMLElement>('.replace__moves .move--chip')!;
    expect(openBandOf(), 'nothing is open before the tap').toBeNull();

    chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const band = openBandOf();
    expect(band, 'the tap opened the shared confirm').not.toBeNull();
    const cards = band!.root.querySelectorAll('.move--card');
    expect(cards, 'the incoming move and the one it would displace').toHaveLength(2);
    /*
     * **With band**, which is the milestone's own word for it. The band strip
     * is one of the two fields the chip gave up, so a confirm that showed it
     * without them would be asking the player to decide on less than the
     * screen used to show.
     */
    for (const card of cards) {
      expect(card.querySelector('.band'), 'each card keeps its band pips').not.toBeNull();
    }
  });

  it('spends nothing until the confirm is pressed', () => {
    const { screen, replaced } = render();
    const chip = screen.root.querySelector<HTMLElement>('.replace__moves .move--chip')!;
    chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(replaced, 'the tap opened a question, not a replacement').toEqual([]);

    const band = openBandOf()!;
    band.root.querySelector<HTMLButtonElement>('.primary-action')!.click();
    expect(replaced, 'the confirm commits the slot the chip named').toEqual([0]);
  });

  it('names both moves in the question, so the confirm is readable alone', () => {
    const { screen } = render();
    const chips = [...screen.root.querySelectorAll<HTMLElement>('.replace__moves .move--chip')];
    chips[2]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const title = openBandOf()!.root.querySelector('.confirm-band__title')?.textContent ?? '';
    expect(title).toContain('Crunch');
    expect(title).toContain('Ice Beam');
  });

  it('commits the slot that was tapped, not the first one', () => {
    const { screen, replaced } = render();
    const chips = [...screen.root.querySelectorAll<HTMLElement>('.replace__moves .move--chip')];
    chips[3]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    openBandOf()!.root.querySelector<HTMLButtonElement>('.primary-action')!.click();
    expect(replaced).toEqual([3]);
  });
});
