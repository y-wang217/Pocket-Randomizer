/**
 * The map node card's encodings. **Milestone M5.2, discrepancy D37.**
 *
 * M5.2's done-when: *"a test asserts the capability band chevron matches
 * `resolveCapability`."* That is the assertion this file exists for, and it is
 * a unit test rather than a fixture for a reason worth recording.
 *
 * **D35's other half turned out not to need a fixture here.** The row was
 * filed because `gallery-fixtures.ts` grants the run every relic, so every
 * gated node on the map resolves `known` and the census could only ever
 * photograph one of the three bands. The census counts *words*, and after this
 * item the chevron carries none — so a bare-capability map fixture would
 * census identically to the one that exists and prove nothing. What the
 * done-when actually asks for is that the *mark* tracks the band, and that is
 * a claim about three states of one function, which is what a unit test is
 * for. Recorded in `docs/generation.md` §67.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';

import { capabilityBandChevron, capabilityGlyph, tierPips } from '../src/ui/chip';
import { resolveCapability } from '../src/core/capabilities';
import { CAPABILITIES } from '../src/data/capabilities';
import { BAND_LABELS, CAPABILITY_LABELS } from '../src/data/eventCopy';
import { RELICS } from '../src/data/relics';

/** How many chevrons the mark draws filled. The reading the player gets. */
function filled(mark: HTMLElement): number {
  return mark.querySelectorAll('[data-glyph="capability-band-on"]').length;
}

describe('the capability band chevron', () => {
  /*
   * One case per band, against `resolveCapability`'s own output rather than
   * against a hardcoded string: a run holding nothing reads `none`, a run
   * holding a relic that grants the capability reads `known`, and `latent` is
   * the middle rung the context produces on its own.
   */
  it('fills to the band resolveCapability returns', () => {
    const capability = CAPABILITIES[0]!;
    const granting = RELICS.find((relic) => relic.grants === capability);
    expect(granting, `no relic grants ${capability}`).toBeDefined();

    const none = resolveCapability({ relics: [], party: [] }, capability);
    const known = resolveCapability({ relics: [granting!.id], party: [] }, capability);
    expect(none, 'a run holding nothing does not read none').toBe('none');
    expect(known, 'a run holding the relic does not read known').toBe('known');

    expect(filled(capabilityBandChevron(none, BAND_LABELS[none]))).toBe(0);
    expect(filled(capabilityBandChevron('latent', BAND_LABELS['latent']))).toBe(1);
    expect(filled(capabilityBandChevron(known, BAND_LABELS[known]))).toBe(2);
  });

  /*
   * **Wordless, which is the half the census cannot check.** The chevron
   * carried `Latent` and the glyph beside it carried `Requires Cut` until
   * M5.2; the census counts words per surface and would catch a regression
   * there eventually, but only on a fixture that renders this node. Asserted
   * directly so it is caught wherever the mark is drawn.
   */
  it('spends no words, and neither does the capability glyph', () => {
    for (const band of ['none', 'latent', 'known'] as const) {
      expect(capabilityBandChevron(band, BAND_LABELS[band]).textContent?.trim()).toBe('');
    }
    for (const capability of CAPABILITIES) {
      const mark = capabilityGlyph(capability, CAPABILITY_LABELS[capability]);
      expect(mark.textContent?.trim(), `${capability} renders a word`).toBe('');
      // The name is not lost: it is the accessible name and the inspect panel.
      expect(mark.getAttribute('aria-label')).toBe(CAPABILITY_LABELS[capability]);
      expect(mark.dataset['tip']).toBe(`capability:${capability}`);
    }
  });

  /** Every capability has a mark, so a ninth cannot ship unencoded. */
  it('draws a glyph for every capability in the list', () => {
    for (const capability of CAPABILITIES) {
      const mark = capabilityGlyph(capability, CAPABILITY_LABELS[capability]);
      expect(mark.querySelector(`[data-glyph="capability-${capability}"]`), `${capability} has no glyph`).not.toBeNull();
    }
  });
});

describe('the tier pips', () => {
  /*
   * Section 3's Tier row, as a count rather than a word. `NORMAL` and `HARD`
   * were the bracket named; the pips are the bracket shown.
   */
  it('fill to the tier and spend no words', () => {
    const on = (tier: string): number =>
      tierPips(tier).querySelectorAll('[data-on="true"]').length;
    expect(on('normal')).toBe(1);
    expect(on('hard')).toBe(2);
    expect(on('elite')).toBe(3);
    for (const tier of ['normal', 'hard', 'elite']) {
      expect(tierPips(tier).textContent?.trim(), `${tier} renders a word`).toBe('');
      // The definition, including what the tier pays, is one press away —
      // which is why there is no second strip for the reward tier (R3).
      expect(tierPips(tier).dataset['tip']).toBe(`tier:${tier}`);
    }
  });
});
