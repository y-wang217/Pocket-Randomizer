/**
 * What a defender question mark may say. **2026-10-06.** `docs/generation.md`
 * section 120, bible D111.
 *
 * The same two claims `test/event-copy.test.ts` and `test/event-budget.test.ts`
 * make of the attacker's event copy: every string is present for every event
 * and option, under its budget (a hook under thirty words, a label under six,
 * a hint at most six), and none of it carries a hedge word. And the file is
 * read by `ui/` only, so it sits on the hash's exclusion list.
 */
import { describe, expect, it } from 'vitest';

import { EXCLUDED } from '../build-config/content-hash';
import { DEFENDER_EVENTS } from '../src/data/defenderEvents';
import { DEFENDER_EVENT_HINTS, DEFENDER_EVENT_HOOKS, DEFENDER_EVENT_LABELS, defenderEventLabel } from '../src/data/defenderEventCopy';
import { TUTORIAL_FORBIDDEN_WORDS } from '../src/data/tutorial';

const words = (text: string): number => text.split(/\s+/).filter(Boolean).length;
const forbidden = new RegExp(`\\b(${TUTORIAL_FORBIDDEN_WORDS.join('|')})\\b`, 'i');

describe('every question mark has its words', () => {
  it('a hook per event, and a label and a hint per option, in option order', () => {
    for (const event of DEFENDER_EVENTS) {
      expect(DEFENDER_EVENT_HOOKS[event.id], `${event.id} hook`).toBeTruthy();
      expect(DEFENDER_EVENT_LABELS[event.id], `${event.id} labels`).toHaveLength(event.options.length);
      expect(DEFENDER_EVENT_HINTS[event.id], `${event.id} hints`).toHaveLength(event.options.length);
      event.options.forEach((_, index) => {
        expect(defenderEventLabel(event.id, index), `${event.id} label ${index}`).toBeTruthy();
        expect(DEFENDER_EVENT_HINTS[event.id]![index], `${event.id} hint ${index}`).toBeTruthy();
      });
    }
    // And no words for an event that does not exist.
    const known = new Set(DEFENDER_EVENTS.map((event) => event.id));
    for (const table of [DEFENDER_EVENT_HOOKS, DEFENDER_EVENT_LABELS, DEFENDER_EVENT_HINTS]) {
      for (const id of Object.keys(table)) expect(known.has(id), id).toBe(true);
    }
  });

  it('keeps to the budgets: a hook under 30 words, a label under 6, a hint at most 6', () => {
    for (const event of DEFENDER_EVENTS) {
      expect(words(DEFENDER_EVENT_HOOKS[event.id]!), `${event.id} hook`).toBeLessThan(30);
      for (const label of DEFENDER_EVENT_LABELS[event.id]!) expect(words(label), `${event.id} "${label}"`).toBeLessThan(6);
      for (const hint of DEFENDER_EVENT_HINTS[event.id]!) expect(words(hint), `${event.id} "${hint}"`).toBeLessThanOrEqual(6);
    }
  });

  it('carries no hedge word and no em dash', () => {
    for (const event of DEFENDER_EVENTS) {
      const strings = [DEFENDER_EVENT_HOOKS[event.id]!, ...DEFENDER_EVENT_LABELS[event.id]!, ...DEFENDER_EVENT_HINTS[event.id]!];
      for (const text of strings) {
        expect(text, `${event.id}: "${text}"`).not.toMatch(forbidden);
        expect(text, `${event.id}: "${text}"`).not.toContain('—');
      }
    }
  });

  it('is excluded from the content hash, as every copy file is', () => {
    expect(EXCLUDED.map((entry) => entry.path)).toContain('src/data/defenderEventCopy.ts');
  });
});
