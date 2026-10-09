/**
 * @vitest-environment jsdom
 *
 * The card battle sandbox's hidden entry. **Card battle engine, checkpoint 5.**
 * The real starter screen and the real lazy load are the browser test's
 * (`test/visual-card-battle.test.ts`); this holds the listener's rules.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CARD_TEST_SEQUENCE, createCardTestEntry, wantsCardTest } from '../src/ui/cardbattle-entry';

const press = (key: string, target: EventTarget = document.body): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
};

describe('the key sequence', () => {
  let entry: ReturnType<typeof createCardTestEntry> | null = null;
  afterEach(() => entry?.setActive(false));

  it('opens the sandbox on ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Enter', () => {
    const open = vi.fn();
    entry = createCardTestEntry(open);
    entry.setActive(true);
    for (const key of CARD_TEST_SEQUENCE) press(key);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('resets on a wrong key, and a wrong key that is the first key starts again', () => {
    const open = vi.fn();
    entry = createCardTestEntry(open);
    entry.setActive(true);
    press('ArrowUp');
    press('ArrowDown');
    press('x');
    expect(entry.progress).toBe(0);
    press('ArrowLeft');
    press('ArrowRight');
    press('Enter');
    expect(open).not.toHaveBeenCalled();
    press('ArrowUp');
    press('ArrowUp');
    expect(entry.progress).toBe(1);
    for (const key of CARD_TEST_SEQUENCE.slice(1)) press(key);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('ignores keys typed into an input, a textarea or an editable element', () => {
    const open = vi.fn();
    entry = createCardTestEntry(open);
    entry.setActive(true);
    const input = document.createElement('input');
    const area = document.createElement('textarea');
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    document.body.append(input, area, editable);
    press('ArrowUp');
    press('ArrowDown', input);
    press('x', area);
    press('q', editable);
    expect(entry.progress).toBe(1);
    for (const key of CARD_TEST_SEQUENCE) press(key, input);
    expect(open).not.toHaveBeenCalled();
    input.remove();
    area.remove();
    editable.remove();
  });

  it('cancels and stops only the completing Enter, so it never also presses a starter', () => {
    const open = vi.fn();
    const below = vi.fn();
    entry = createCardTestEntry(open);
    entry.setActive(true);
    document.body.addEventListener('keydown', below);
    const events = CARD_TEST_SEQUENCE.map((key) => press(key));
    expect(events.slice(0, -1).every((e) => !e.defaultPrevented)).toBe(true);
    expect(below).toHaveBeenCalledTimes(CARD_TEST_SEQUENCE.length - 1);
    expect(events.at(-1)!.defaultPrevented).toBe(true);
    document.body.removeEventListener('keydown', below);
  });

  it('listens only while active', () => {
    const open = vi.fn();
    entry = createCardTestEntry(open);
    for (const key of CARD_TEST_SEQUENCE) press(key);
    entry.setActive(true);
    entry.setActive(false);
    for (const key of CARD_TEST_SEQUENCE) press(key);
    expect(open).not.toHaveBeenCalled();
  });
});

describe('the URL entry', () => {
  it('opens on #test and nothing else', () => {
    expect(wantsCardTest('https://example.com/#test')).toBe(true);
    expect(wantsCardTest('https://example.com/?x=1#test')).toBe(true);
    expect(wantsCardTest('https://example.com/#seed=ABC')).toBe(false);
    expect(wantsCardTest('https://example.com/#tests')).toBe(false);
    expect(wantsCardTest('not a url')).toBe(false);
  });
});
