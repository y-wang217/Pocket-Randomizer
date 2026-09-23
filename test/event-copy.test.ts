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
 * What replaces it is the copy that is actually live: every event supplies a
 * hook, four option labels and four hints, and those are what a player reads.
 * They are linted here against the same forbidden-word list, because the Part
 * 4 rule is the same rule — attributes, never verdicts.
 *
 * **They live in `data/eventCopy.ts` now, not `data/events.ts`.** M5.6's split
 * closed D14 on 2026-09-22: the words were inside `contentHash` and a reworded
 * sentence refused every seed recorded before it, which is what kept two
 * violations unfixed for a whole release. This file reads them through the
 * accessors and asserts the same words against the same list, from the file
 * that now holds them — and the exemption list it used to carry is empty.
 *
 * **Budgets are not here.** How many words an event may spend is
 * `test/event-budget.test.ts`, against design bible section 4. This file is
 * about what the words may *say*.
 */
import { describe, expect, it } from 'vitest';

import { CAPABILITIES } from '../src/data/capabilities';
import { EVENTS } from '../src/data/events';
import {
  BAND_LABELS,
  CAPABILITY_LABELS,
  OUTCOME_TIER_INFO,
  eventHint,
  eventHook,
  eventLabel,
} from '../src/data/eventCopy';
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
  // The inspect panel behind the reward pips. Written by M5.6, so it is new
  // copy and subject to the same list as everything else here.
  for (const [tier, text] of Object.entries(OUTCOME_TIER_INFO)) {
    out.push({ where: `OUTCOME_TIER_INFO ${tier}`, text });
  }
  for (const event of EVENTS) {
    out.push({ where: `${event.id} hook`, text: eventHook(event.id) });
    for (const archetype of EVENT_ARCHETYPES) {
      out.push({ where: `${event.id} ${archetype} label`, text: eventLabel(event.id, archetype) });
      out.push({ where: `${event.id} ${archetype} hint`, text: eventHint(event.id, archetype) });
    }
  }
  return out;
}

describe('the copy every event supplies', () => {
  it('gives every event a hook and all four labels and hints', () => {
    for (const event of EVENTS) {
      expect(eventHook(event.id).trim().length, `${event.id} hook`).toBeGreaterThan(20);
      for (const archetype of EVENT_ARCHETYPES) {
        expect(eventLabel(event.id, archetype).trim().length, `${event.id} ${archetype} label`).toBeGreaterThan(3);
        expect(eventHint(event.id, archetype).trim().length, `${event.id} ${archetype} hint`).toBeGreaterThan(20);
      }
    }
  });

  it('writes a different label for every archetype within one event', () => {
    for (const event of EVENTS) {
      const labels = EVENT_ARCHETYPES.map((archetype) => eventLabel(event.id, archetype));
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
        expect(eventHint(event.id, archetype), `${event.id} ${archetype}`).not.toMatch(/\d+\s*(coins?|HP|%)/i);
      }
    }
  });

  /**
   * **The two known violations are gone, and D14 is closed. M5.6, 2026-09-22.**
   *
   * `forest-thornwall`'s hint passed *"a grove worth passing"* and
   * `marsh-leech-bed`'s hook lay over *"something worth having"*. Both broke
   * section 8's list from the day M0.3 widened it to carry `worth`, and both
   * stayed broken for a whole release because the words lived in
   * `data/events.ts`, which `src/core/events.ts` imports, so two words of
   * flavour text cost a `contentHash` move and refused every seed recorded
   * before them.
   *
   * D14 was ruled option 2 and built with M5.1's half: the copy moved to
   * `data/eventCopy.ts`, which `core/` never reads, and the hash moved once
   * for the three tables together. M5.6 then rewrote all twenty-four events to
   * section 4's budget, which is where these two sentences went. Rewording any
   * of them is free from here on, and the list this block used to hold is
   * empty rather than shorter — a violation has nowhere left to hide.
   */
  it('contains no forbidden word, as whole words', () => {
    const pattern = new RegExp(`\\b(${TUTORIAL_FORBIDDEN_WORDS.join('|')})\\b`, 'i');
    const offenders = sentences()
      .filter(({ text }) => pattern.test(text))
      .map(({ where, text }) => `${where}: ${text}`);
    expect(offenders).toEqual([]);
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
