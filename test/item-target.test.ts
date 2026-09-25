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
import { openBandOf } from '../src/ui/band';
import { TEACH_CANCELLED, createItemTargetScreen } from '../src/ui/screens/item-target';
import { resetSettings } from '../src/ui/settings';

const ROSTER = [
  { species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam', 'Earthquake', 'Crunch', 'Rest'], level: 40 },
  { species: 'Lapras', ability: 'Water Absorb', moves: ['Surf', 'Ice Beam'], level: 40 },
];

beforeEach(() => {
  resetSettings();
  document.body.replaceChildren();
});

function render(reward: TargetedReward, allowSkip = false) {
  const screen = createItemTargetScreen();
  const picked: number[] = [];
  screen.render(reward, createParty(ROSTER), (slot) => picked.push(slot), DEFAULT_TUNING, allowSkip);
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

    /*
     * **The card is not the control since M3.3.** It is the party row, which
     * carries the fold toggle, six stat labels and four move cards that are
     * all focusable — nesting those inside a `<button>` is invalid and takes
     * the keyboard path to every one of them. The control is a sibling, the
     * shape `screens/pre-gym.ts` already uses for the same question.
     */
    const members = [...screen.root.querySelectorAll<HTMLElement>('.party__member--target')];
    expect(members.length).toBe(ROSTER.length);
    expect(members.every((card) => card.tagName === 'DIV'), 'a card is not a button').toBe(true);
    const controls = [...screen.root.querySelectorAll<HTMLButtonElement>('.target__choose')];
    expect(controls.length).toBe(ROSTER.length);
    controls[1]?.click();
    expect(picked).toEqual([1]);
  });

  it('mounts the party row rather than a card of its own', () => {
    const { screen } = render({ kind: 'tutor', move: 'Ice Beam' });
    const card = screen.root.querySelector('.party__member--target');
    // Section 5's component, so the things M3.2 took off it are off here too
    // without this screen having to know they existed.
    expect(card?.querySelectorAll('.stats--grid .stat')).toHaveLength(6);
    expect(card?.querySelector('.badge--archetype'), 'the bars draw it; the label does not').toBeNull();
    expect(card?.querySelector('.panel__level')?.textContent ?? '').not.toContain('Lv');
    expect(card?.querySelectorAll('.move--card').length).toBeGreaterThan(0);
  });

  it('keeps the per-member line about the pairing, which the card does not replace', () => {
    const { screen } = render({ kind: 'tutor', move: 'Ice Beam' });
    const lines = [...screen.root.querySelectorAll('.target__effect')].map((line) => line.textContent);
    expect(lines[0]).toContain('Knows four moves');
    expect(lines[1]).toContain('Already knows Ice Beam');
  });
});

/**
 * The decline, and the confirm behind it. **Milestone M3.3.**
 *
 * The control used to carry a note spelling out what declining costs, at rest,
 * on every render, for a control most runs never press. The record moves that
 * to a confirm — *"Decline copy: 'Forfeit this reward?' with the two cards"* —
 * and `ui/band.ts` is the one confirm component, which M2.3 gave the `content`
 * slot this uses.
 */
describe('the decline', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    resetSettings();
    openBandOf()?.close();
  });

  it('asks before it forfeits, and shows the card being given up', () => {
    const { screen, picked } = render({ kind: 'tutor', move: 'Ice Beam' }, true);
    const control = screen.root.querySelector<HTMLButtonElement>('.target__decline');
    expect(control, 'the decline is offered when the flow allows a skip').not.toBeNull();
    // The note is gone from the face; the question is what the press opens.
    expect(screen.root.querySelector('.target__decline-note')).toBeNull();

    control?.click();
    const band = openBandOf();
    expect(band, 'the decline opens the one confirm component').not.toBeNull();
    expect(band?.root.querySelector('.confirm-band__title')?.textContent).toBe('Cancel learning?');
    // The card in front of the player when the question is asked, rather than
    // remembered from the screen behind it.
    expect(band?.root.querySelector('.confirm-band__content .move--card')).not.toBeNull();
    expect(picked, 'opening the confirm did not commit').toEqual([]);
  });

  it('commits only on the confirm, and backing out changes nothing', () => {
    const { screen, picked } = render({ kind: 'tutor', move: 'Ice Beam' }, true);
    screen.root.querySelector<HTMLButtonElement>('.target__decline')?.click();

    const buttons = [...(openBandOf()?.root.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    const cancel = buttons.find((button) => button.textContent === 'Keep');
    expect(cancel, 'the way out is labelled').not.toBeNull();
    cancel?.click();
    expect(picked, 'backing out of the confirm forfeited nothing').toEqual([]);
    expect(openBandOf(), 'and it closed the band').toBeNull();

    screen.root.querySelector<HTMLButtonElement>('.target__decline')?.click();
    const confirm = [...(openBandOf()?.root.querySelectorAll<HTMLButtonElement>('button') ?? [])].find(
      (button) => button.textContent === 'Cancel',
    );
    confirm?.click();
    expect(picked).toEqual([TEACH_CANCELLED]);
  });

  /**
   * Section 4 budgets the decline overlay at 6 words, and it measures **4**.
   *
   * The question counts 2 under the rule in section 4's header — `Cancel`,
   * `learning` (it was the record's "Forfeit this reward?" until the
   * 2026-09-25 playtest, `generation.md` section 79). The other two are the
   * band's own controls, and a confirm cannot have fewer than two.
   *
   * **The budget was 4 and D22 raised it to 6**, matching the replace overlay,
   * because both are `ui/band.ts` and only one of the two rows had been
   * written against it: D1's audit already read this one as *"Counting the
   * rule as written: 3"*, derived from the question alone before the component
   * existed. Section 9 carries the bet that raise makes, so this assertion is
   * the instrument for it — if the overlay ever reaches 6, that is the
   * register's row firing, not a passing test.
   *
   * Asserted rather than left to the census because no gallery fixture opens a
   * confirm: the component reads `absent` on that table, and a budget nothing
   * measures is a budget nothing holds.
   *
   * **The band's own copy, not its content.** The card mounted inside it is
   * the move card, which carries its own row in section 4 and censuses 0 in
   * Pocket — and jsdom applies no stylesheet, so every word form the Pocket
   * face hides is in `textContent` here. Counting the whole subtree would be
   * measuring the card twice and measuring it in the wrong mode.
   */
  it('spends four words, under the ceiling D22 corrected', () => {
    const { screen } = render({ kind: 'tutor', move: 'Ice Beam' }, true);
    screen.root.querySelector<HTMLButtonElement>('.target__decline')?.click();
    const band = openBandOf();
    const own = [
      band?.root.querySelector('.confirm-band__title'),
      ...(band?.root.querySelectorAll('.confirm-band__actions button') ?? []),
    ];
    const words = own
      .flatMap((node) => (node?.textContent ?? '').split(/\s+/))
      .map((token) => token.replace(/[^\p{L}\p{N}]/gu, ''))
      .filter((token) => token.length > 0);
    expect(words).toEqual(['Cancel', 'learning', 'Cancel', 'Keep']);
  });

  it('offers no decline where the flow has none', () => {
    const { screen } = render({ kind: 'tutor', move: 'Ice Beam' });
    expect(screen.root.querySelector('.target__decline')).toBeNull();
  });
});
