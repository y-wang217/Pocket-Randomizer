/**
 * The recipient screen shows the move it is asking about. **Patch 4.8.0.2.**
 *
 * @vitest-environment jsdom
 *
 * Stage 4.8 made the gym's move a grant rather than an offer, so it skips the
 * reward screen — the one surface that drew a tutor as a card — and the first
 * thing a player saw of it was the title `Tutor: Ice Beam`. A member with a
 * free slot took the move without ever seeing its type, its category or its
 * power. The fix is the same two lines `screens/reward.ts` uses, and this test
 * holds three things about them: the card is there with the facts a player
 * choosing between a physical and a special attacker needs, the `Explain`
 * expander opens without picking anybody, and the member buttons still pick.
 * The browser half — the seventh surface in the sweep, and the tap-does-not-
 * submit fingerprint — is `test/visual-move-cards.test.ts`.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { describeMove } from '../src/core/battle/driver';
import { createParty } from '../src/core/party';
import type { TargetedReward } from '../src/core/rewards';
import { bandOfMove } from '../src/data/moveOverrides';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { createItemTargetScreen } from '../src/ui/screens/item-target';
import { resetSettings } from '../src/ui/settings';

const ROSTER = [
  { species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam', 'Earthquake', 'Crunch', 'Rest'], level: 40 },
  { species: 'Lapras', ability: 'Water Absorb', moves: ['Surf', 'Ice Beam'], level: 40 },
];

beforeEach(() => {
  resetSettings();
  document.body.replaceChildren();
});

function render(reward: TargetedReward) {
  const screen = createItemTargetScreen();
  const picked: number[] = [];
  screen.render(reward, createParty(ROSTER), (slot) => picked.push(slot), DEFAULT_TUNING);
  document.body.append(screen.root);
  return { screen, picked };
}

describe('the recipient screen', () => {
  it('draws the offered move as a card, with its type, category, power and band', () => {
    const { screen } = render({ kind: 'tutor', move: 'Ice Beam' });
    const card = screen.root.querySelector('.target__move .move');
    expect(card, 'no move card on the recipient screen').not.toBeNull();
    expect(card?.querySelector('.move__name')?.textContent).toBe('Ice Beam');

    const facts = describeMove('Ice Beam');
    if (!facts) throw new Error('Ice Beam is not in the dex');
    // The category badge is the fact the physical-or-special decision turns on.
    const category = card?.querySelector('.badge--category');
    expect(category, 'no category badge').not.toBeNull();
    expect(category?.classList.contains(`badge--cat-${facts.category.toLowerCase()}`)).toBe(true);
    expect((category as HTMLElement).dataset['tip']).toBe(`category:${facts.category.toLowerCase()}`);
    expect(card?.querySelector('.type')?.textContent).toBe(facts.type);
    expect(card?.textContent).toContain(`${facts.basePower} BP`);
    // Patch 4.8.0.3: the band is pips, not a word. Same resolution through
    // `bandOfMove`, read back as the count of lit pips.
    expect(card?.querySelectorAll('.band .band__pip[data-on="true"]').length).toBe(bandOfMove('Ice Beam'));
  });

  it('draws the same card for a TM, and one card only', () => {
    const { screen } = render({ kind: 'tm', move: 'Thunderbolt' });
    expect(screen.root.querySelectorAll('.target__move .move').length).toBe(1);
    expect(screen.root.querySelector('.target__move .move__name')?.textContent).toBe('Thunderbolt');
  });

  /**
   * **This asserted an `Explain` control, and M2.1 removed it (D15).**
   *
   * The card carried a button that opened an inline panel, and the point of
   * the case was that using it did not pick a member — a real hazard, because
   * this screen picks on tap. R5 allows one explanation mechanism and names a
   * help button among the things it forbids, so the card itself is the inspect
   * trigger now.
   *
   * The hazard is unchanged and the guard keeps its shape, but the two halves
   * invert. Reaching the explanation must still cost no pick — it is a long
   * press, and the layer eats the click it leaves behind — while a *tap* on the
   * card must still reach the member under it, because R5 is explicit that tap
   * still selects. Both are asserted: either one failing alone is a live defect
   * on this screen.
   */
  it('is an inspect trigger that costs no pick, and does not swallow the tap', () => {
    const { screen, picked } = render({ kind: 'tutor', move: 'Ice Beam' });
    const card = screen.root.querySelector<HTMLElement>('.target__move .move--card');
    expect(card, 'the card is not an inspect trigger').not.toBeNull();
    expect(card?.dataset['tip']).toMatch(/^move:/);
    // Focusable, because a long press is not a keyboard gesture. This is the
    // half of D15 that had to be replaced rather than deleted.
    expect(card?.tabIndex).toBe(0);
    expect(card?.getAttribute('role')).toBe('button');
    // And it declines hover: a card-sized hover target opens a panel over the
    // very thing the player is reaching for. See `ui/tooltips.ts`.
    expect(card?.dataset['tipHover']).toBe('off');
    expect(screen.root.querySelector('.move__explain-toggle'), 'the expander survived').toBeNull();
    expect(picked, 'merely drawing the card picked a member').toEqual([]);

    const members = [...screen.root.querySelectorAll<HTMLButtonElement>('.party__member--target')];
    expect(members.length).toBe(ROSTER.length);
    members[1]?.click();
    expect(picked).toEqual([1]);
  });

  it('keeps the per-member line about the pairing, which the card does not replace', () => {
    const { screen } = render({ kind: 'tutor', move: 'Ice Beam' });
    const lines = [...screen.root.querySelectorAll('.target__effect')].map((line) => line.textContent);
    expect(lines[0]).toContain('Knows four moves');
    expect(lines[1]).toContain('Already knows Ice Beam');
  });
});
