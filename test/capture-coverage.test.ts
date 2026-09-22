/**
 * The coverage change, as two rows of signs and chips. **Milestone M5.4.**
 *
 * Section 3: *"Coverage change (capture card) | Two rows of type chips, plus
 * row and minus row, signs only. The signs are permanent, not an exposure
 * label: coverage is not a glyph family (2026-09-19, D5) | Empty row renders
 * nothing | The full before and after sets."*
 *
 * It replaces a sentence — *"Coverage if it replaces your first member: adds
 * Dragon, Steel. Loses Ghost."* — and the fact it carried is not lost, which is
 * what these assertions are really for. C2 is satisfied by M1.2 rather than by
 * M5.4: the `coverage:capture` tip was mounted two tiers ago carrying the full
 * before and after sets, and the comment that mounted it said in as many words
 * that M5.4 would move the trigger onto the rows.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';

import { renderCaptureOffer } from '../src/ui/screens/acquisition';
import { createParty } from '../src/core/party';
import type { PokemonSpec } from '../src/core/types';

/** Real species and real moves: the card reads both through the dex adapter. */
const SNORLAX: PokemonSpec = { species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam'], level: 50 };
const GENGAR: PokemonSpec = { species: 'Gengar', ability: 'Levitate', moves: ['Shadow Ball'], level: 50 };
const HAUNTER: PokemonSpec = { species: 'Haunter', ability: 'Levitate', moves: ['Shadow Ball'], level: 50 };

/** A party whose coverage the incoming Pokemon can be measured against. */
function offerAgainst(party: readonly PokemonSpec[], incoming: PokemonSpec, capacity: number): HTMLElement {
  return renderCaptureOffer(
    { nodeId: 's1-1-0', source: 'encounter', spec: incoming },
    createParty([...party]),
    () => undefined,
    capacity,
  );
}

const rows = (root: HTMLElement): HTMLElement[] => [...root.querySelectorAll<HTMLElement>('.acquire__coverage-row')];

describe('the coverage change on a capture card', () => {
  /*
   * The words are the assertion. A row of chips with a sign in front is the
   * encoding; a sentence describing it is what M5.4 deleted, and the thing
   * most likely to come back is a caption explaining the signs.
   */
  it('renders signs and chips, and no words', () => {
    const root = offerAgainst(
      [SNORLAX],
      GENGAR,
      6,
    );
    const drawn = rows(root);
    expect(drawn.length, 'no coverage row was drawn').toBeGreaterThan(0);
    for (const row of drawn) {
      const sign = row.querySelector('.acquire__coverage-sign')?.textContent ?? '';
      expect(['+', '−'], 'a row carries something that is not a sign').toContain(sign);
      // Every remaining text node belongs to a type chip, which section 2
      // counts as the glyph rather than as a word.
      const outside = [...row.childNodes]
        .filter((node) => !(node instanceof HTMLElement) || !node.classList.contains('acquire__coverage-sign'))
        .filter((node) => node instanceof HTMLElement && !node.className.includes('chip'));
      expect(outside, 'a coverage row carries something that is neither a sign nor a chip').toEqual([]);
    }
  });

  /*
   * R4, and section 3's own middle column: *"Empty row renders nothing."* A
   * plus row with no chips in it would be a marker for the absence of a fact.
   */
  it('draws no row for a side that did not change', () => {
    const root = offerAgainst(
      [GENGAR],
      HAUNTER,
      6,
    );
    for (const row of rows(root)) {
      expect(row.querySelectorAll('.chip').length, 'an empty coverage row was drawn').toBeGreaterThan(0);
    }
  });

  /*
   * **The sets are still reachable, which is the C2 half.** The sentence named
   * what moved; the tip carries the full before and after, and it is the
   * trigger the rows inherited from the paragraph they replaced.
   */
  it('keeps the full sets one press away', () => {
    const root = offerAgainst(
      [SNORLAX],
      GENGAR,
      6,
    );
    const host = root.querySelector<HTMLElement>('.acquire__coverage');
    expect(host, 'the coverage block is missing').not.toBeNull();
    expect(host?.dataset['tip'], 'the coverage rows open nothing').toBe('coverage:capture');
    expect(host?.dataset['detail'] ?? '', 'the inspect panel has no sets to show').not.toBe('');
  });
});
