/**
 * The event copy table is complete, band-correct, and says nothing it may not.
 * **Patch 4.8.0.2.**
 *
 * `data/eventCopy.ts` is read by `ui/` only and excluded from `contentHash`,
 * so nothing in the seeded pipeline notices a missing sentence. This does. It
 * holds the table to the events table it describes — every id, every band,
 * one conclusion per choice, a hint per choice at the two bands the authored
 * hint is wrong for — and lints every sentence against the tutorial's
 * forbidden-word list, because the Part 4 rule is the same rule.
 */
import { describe, expect, it } from 'vitest';

import { CAPABILITIES } from '../src/data/capabilities';
import { EVENTS } from '../src/data/events';
import {
  BAND_LABELS,
  CAPABILITY_LABELS,
  EVENT_COPY,
  KNOWN_WITHOUT_OFFER,
  eventConclusion,
  eventHint,
} from '../src/data/eventCopy';
import { TUTORIAL_FORBIDDEN_WORDS } from '../src/data/tutorial';
import type { CapabilityBand } from '../src/core/capabilities';
import { EXCLUDED } from '../build-config/content-hash';

const BANDS: readonly CapabilityBand[] = ['none', 'latent', 'known'];

/** Every sentence the table can print. */
function sentences(): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [{ where: 'KNOWN_WITHOUT_OFFER', text: KNOWN_WITHOUT_OFFER }];
  for (const [id, copy] of Object.entries(EVENT_COPY)) {
    for (const band of BANDS) {
      copy[band].hints?.forEach((text, i) => out.push({ where: `${id} ${band} hint ${i}`, text }));
      copy[band].conclusions.forEach((text, i) => out.push({ where: `${id} ${band} conclusion ${i}`, text }));
    }
  }
  return out;
}

describe('the event copy table', () => {
  it('covers exactly the events in data/events.ts', () => {
    expect(Object.keys(EVENT_COPY).sort()).toEqual(EVENTS.map((event) => event.id).sort());
  });

  it('has one conclusion per choice at every band, and a hint per choice at none and known', () => {
    for (const event of EVENTS) {
      const copy = EVENT_COPY[event.id];
      if (!copy) throw new Error(`no copy for ${event.id}`);
      for (const band of BANDS) {
        expect(copy[band].conclusions.length, `${event.id} ${band} conclusions`).toBe(event.choices.length);
      }
      expect(copy.none.hints?.length, `${event.id} none hints`).toBe(event.choices.length);
      expect(copy.known.hints?.length, `${event.id} known hints`).toBe(event.choices.length);
      // The authored hint is the latent hint; a second one here would be a
      // second source of truth for the band the events were written against.
      expect(copy.latent.hints, `${event.id} latent hints`).toBeUndefined();
    }
  });

  it('prints no empty sentence, and no sentence identical to the authored hint at a band it is wrong for', () => {
    for (const { where, text } of sentences()) {
      expect(text.trim().length, where).toBeGreaterThan(20);
    }
    for (const event of EVENTS) {
      event.choices.forEach((choice, i) => {
        expect(eventHint(event.id, 'none', i, choice.hint), `${event.id} none ${i}`).not.toBe(choice.hint);
        expect(eventHint(event.id, 'known', i, choice.hint), `${event.id} known ${i}`).not.toBe(choice.hint);
        expect(eventHint(event.id, 'latent', i, choice.hint), `${event.id} latent ${i}`).toBe(choice.hint);
      });
    }
  });

  it('names the capability in every conclusion at none and known, so the reveal says what the gate was', () => {
    for (const event of EVENTS) {
      const label = CAPABILITY_LABELS[event.requires];
      for (const band of ['none', 'known'] as const) {
        for (const [i, text] of EVENT_COPY[event.id]![band].conclusions.entries()) {
          expect(text, `${event.id} ${band} conclusion ${i}`).toContain(label);
        }
      }
      for (const [i, text] of EVENT_COPY[event.id]!.latent.conclusions.entries()) {
        expect(text, `${event.id} latent conclusion ${i}`).toMatch(/party member/);
      }
    }
  });

  it('contains no forbidden word, as whole words', () => {
    const pattern = new RegExp(`\\b(${TUTORIAL_FORBIDDEN_WORDS.join('|')})\\b`, 'i');
    const offenders = sentences().filter(({ text }) => pattern.test(text)).map(({ where, text }) => `${where}: ${text}`);
    expect(offenders).toEqual([]);
  });

  it('degrades the known conclusion when the encounter is empty, and only then', () => {
    const event = EVENTS[0]!;
    expect(eventConclusion(event.id, 'known', 0, { kind: 'nothing' })).toBe(KNOWN_WITHOUT_OFFER);
    expect(eventConclusion(event.id, 'known', 0, { kind: 'acquisition' })).toBe(EVENT_COPY[event.id]!.known.conclusions[0]);
    expect(eventConclusion(event.id, 'none', 0, { kind: 'nothing' })).toBe(EVENT_COPY[event.id]!.none.conclusions[0]);
    expect(eventConclusion('no-such-event', 'latent', 0, { kind: 'heal' })).toBe('');
  });

  it('labels every capability and every band', () => {
    for (const capability of CAPABILITIES) expect(CAPABILITY_LABELS[capability]).toBeTruthy();
    for (const band of BANDS) expect(BAND_LABELS[band]).toBeTruthy();
  });

  it('is on the contentHash exclusion list, because core/ never reads it', () => {
    expect(EXCLUDED.map((entry) => entry.path)).toContain('src/data/eventCopy.ts');
  });
});
