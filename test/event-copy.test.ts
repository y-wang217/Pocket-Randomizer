/**
 * Event copy says nothing it may not. **Rewritten by the event rejig.**
 *
 * The suite that lived here held `data/eventCopy.ts`'s per-event band table to
 * the events table it described: every id, every band, one conclusion per
 * choice. That table is **deleted** by this patch rather than flagged off — it
 * was keyed by event ids the rejig renames and described a mechanism (a choice
 * paying a different outcome at each capability band) the rejig replaces. See
 * `docs/generation.md` section 14.
 *
 * What replaces it is the copy that is actually live: every event now supplies
 * a hook, four option labels and four hints in `data/events.ts`, and those are
 * what a player reads. They are linted here against the same forbidden-word
 * list, because the Part 4 rule is the same rule — attributes, never verdicts.
 */
import { describe, expect, it } from 'vitest';

import { CAPABILITIES } from '../src/data/capabilities';
import { EVENTS } from '../src/data/events';
import { BAND_LABELS, CAPABILITY_LABELS } from '../src/data/eventCopy';
import { EVENT_ARCHETYPES } from '../src/data/eventPools';
import { TUTORIAL_FORBIDDEN_WORDS } from '../src/data/tutorial';
import type { CapabilityBand } from '../src/core/capabilities';
import { EXCLUDED } from '../build-config/content-hash';

const BANDS: readonly CapabilityBand[] = ['none', 'latent', 'known'];

/** Every sentence an event can print, from the one place they now live. */
function sentences(): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  for (const band of BANDS) out.push({ where: `BAND_LABELS ${band}`, text: BAND_LABELS[band] });
  for (const capability of CAPABILITIES) {
    out.push({ where: `CAPABILITY_LABELS ${capability}`, text: CAPABILITY_LABELS[capability] });
  }
  for (const event of EVENTS) {
    out.push({ where: `${event.id} hook`, text: event.hook });
    for (const archetype of EVENT_ARCHETYPES) {
      out.push({ where: `${event.id} ${archetype} label`, text: event.labels[archetype] });
      out.push({ where: `${event.id} ${archetype} hint`, text: event.hints[archetype] });
    }
  }
  return out;
}

describe('the copy every event supplies', () => {
  it('gives every event a hook and all four labels and hints', () => {
    for (const event of EVENTS) {
      expect(event.hook.trim().length, `${event.id} hook`).toBeGreaterThan(20);
      for (const archetype of EVENT_ARCHETYPES) {
        expect(event.labels[archetype].trim().length, `${event.id} ${archetype} label`).toBeGreaterThan(3);
        expect(event.hints[archetype].trim().length, `${event.id} ${archetype} hint`).toBeGreaterThan(20);
      }
    }
  });

  it('writes a different label for every archetype within one event', () => {
    for (const event of EVENTS) {
      const labels = EVENT_ARCHETYPES.map((archetype) => event.labels[archetype]);
      expect(new Set(labels).size, event.id).toBe(labels.length);
    }
  });

  it('never names the drawn outcome in a hint, because the pools decide it', () => {
    /*
     * A hint that said "+45 coins" would be describing something
     * `data/eventPools.ts` draws and this file cannot see. The check is crude
     * on purpose — a number with a unit is the shape a promise takes.
     */
    for (const event of EVENTS) {
      for (const archetype of EVENT_ARCHETYPES) {
        expect(event.hints[archetype], `${event.id} ${archetype}`).not.toMatch(/\d+\s*(coins?|HP|%)/i);
      }
    }
  });

  /**
   * Two sentences are known to break this and are **not** exempted quietly.
   *
   * **M0.3, 2026-09-20.** The forbidden-word list gained `worth`, which design
   * bible section 8 had always named and the twelve-word list shipped in
   * `data/tutorial.ts` had never carried. Widening it made this test see two
   * event sentences that were in violation the whole time:
   *
   *   `forest-thornwall` safe hint — "passes a grove worth passing"
   *   `marsh-leech-bed`  hook      — "lying over something worth having"
   *
   * They are not rewritten here because they live in `data/events.ts`, which is
   * **inside `contentHash`** (`src/core/events.ts` imports it), so two words of
   * flavour text would move the hash, refuse every seed recorded before it, and
   * force the visual baseline to be re-recorded. Discrepancy D12 was ruled the
   * other way — split rather than move — and the pin in `test/ai-priority.test.ts`
   * states in its own comment that the display split was the last time this
   * number moves for a display edit.
   *
   * So the decision is the lead designer's and it is row **D14** in
   * `docs/design/bible-discrepancies.md`. This list is the record of what is
   * owed, it is asserted to be exactly these two, and it shrinks to nothing the
   * moment D14 is ruled. A new violation cannot hide behind it.
   */
  const KNOWN_UNFIXED = [
    'forest-thornwall safe hint: The detour is slow and passes a grove worth passing.',
    'marsh-leech-bed hook: A leech bed lying over something worth having.',
  ];

  it('contains no forbidden word, as whole words', () => {
    const pattern = new RegExp(`\\b(${TUTORIAL_FORBIDDEN_WORDS.join('|')})\\b`, 'i');
    const offenders = sentences()
      .filter(({ text }) => pattern.test(text))
      .map(({ where, text }) => `${where}: ${text}`);
    // Exactly the two, neither more nor fewer: a fixed line drops off this
    // list and fails here, which is what makes D14 impossible to forget.
    expect(offenders).toEqual(KNOWN_UNFIXED);
  });

  it('prints no empty sentence anywhere a player can reach', () => {
    for (const { where, text } of sentences()) {
      expect(text.trim().length, where).toBeGreaterThan(0);
    }
  });
});

describe('the labels that outlived the table', () => {
  it('labels every capability and every band', () => {
    for (const capability of CAPABILITIES) expect(CAPABILITY_LABELS[capability]).toBeTruthy();
    for (const band of BANDS) expect(BAND_LABELS[band]).toBeTruthy();
  });

  it('is on the contentHash exclusion list, because core/ never reads it', () => {
    expect(EXCLUDED.map((entry) => entry.path)).toContain('src/data/eventCopy.ts');
  });
});
