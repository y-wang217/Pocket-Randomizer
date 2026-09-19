/**
 * @vitest-environment jsdom
 *
 * The intro panel: shown once, recorded on every way out, and never on screen
 * at the same time as a coach mark.
 *
 * The geometry, the scrim, Escape and focus restoration are the shared
 * overlay's and are asserted over every block in `test/overlay.test.ts`,
 * `intro` included. What is here is the three things this surface owns:
 *
 *   - **once**, keyed on a content version rather than a boolean;
 *   - **every close records it**, because a greeting the player dismissed by
 *     any route is a greeting they received, and the one behaviour a one-time
 *     panel must not have is greeting them again every launch;
 *   - **it does not collide with the tutorial**, which is the failure the
 *     sequencing in `ui/app.ts` exists to prevent and the one a unit test can
 *     actually see.
 */
import { describe, expect, it, beforeEach } from 'vitest';

import { INTRO_COPY, INTRO_VERSION } from '../src/data/intro';
import { createIntro } from '../src/ui/intro';
import { initSettings, introDue, introFlags, resetIntro } from '../src/ui/settings';
import { notFirstLaunch } from '../scripts/first-launch.mjs';

function mount(): ReturnType<typeof createIntro> {
  const host = document.createElement('div');
  document.body.append(host);
  return createIntro(host);
}

describe('the intro panel', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    initSettings();
    document.body.replaceChildren();
  });

  it('is due on a fresh store and opens itself', () => {
    expect(introDue()).toBe(true);
    const intro = mount();
    expect(intro.openIfDue()).toBe(true);
    expect(intro.isOpen()).toBe(true);
  });

  it('carries the greeting and the pointer at the coach marks', () => {
    const intro = mount();
    intro.open();
    const text = intro.root.textContent ?? '';
    expect(text).toContain(INTRO_COPY.title);
    expect(text).toContain(INTRO_COPY.body);
    expect(text).toContain(INTRO_COPY.dismiss);
    // The pointer names the header control by its face, so the sentence and
    // the button the player is looking for use one word.
    expect(text).toContain('Tutorial');
  });

  /*
   * The dismiss records at the current version, not at `true`.
   *
   * A boolean could not express "seen, but at the old wording", which is the
   * whole reason `INTRO_VERSION` exists — see `data/intro.ts`.
   */
  it('records the version it was dismissed at, and does not open again', () => {
    const intro = mount();
    intro.openIfDue();
    intro.root.querySelector<HTMLButtonElement>('[data-intro-dismiss]')?.click();

    expect(intro.isOpen()).toBe(false);
    expect(introFlags().seenVersion).toBe(INTRO_VERSION);
    expect(introDue()).toBe(false);
    expect(intro.openIfDue()).toBe(false);
    expect(intro.isOpen()).toBe(false);
  });

  /*
   * Every route out is the same route out.
   *
   * The panel holds no decision, so a scrim tap is not "ask me again next
   * launch". Each case mounts its own layer, because a layer that has already
   * recorded cannot tell the next assertion anything.
   */
  it.each([
    ['the scrim', (root: HTMLElement) => root.querySelector<HTMLElement>('.overlay__scrim')?.click()],
    ['the header close', (root: HTMLElement) => root.querySelector<HTMLElement>('.overlay__close')?.click()],
    [
      'Escape',
      (root: HTMLElement) =>
        root.dispatchEvent(new globalThis.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    ],
  ])('records it when closed by %s', (_name, close) => {
    resetIntro();
    const intro = mount();
    intro.openIfDue();
    close(intro.root);

    expect(intro.isOpen()).toBe(false);
    expect(introDue()).toBe(false);
  });

  it('announces a close exactly once, however it was closed', () => {
    const intro = mount();
    intro.openIfDue();
    let closes = 0;
    intro.onClose(() => {
      closes++;
    });
    intro.root.querySelector<HTMLButtonElement>('[data-intro-dismiss]')?.click();
    expect(closes).toBe(1);
    // A second close on an already-closed panel announces nothing: the shell
    // reopens the coach marks from this hook, and a spurious second call
    // would replace a screen's marks mid-read.
    intro.dismiss();
    expect(closes).toBe(1);
  });

  it('opens again after a reset, which is what the header control does', () => {
    const intro = mount();
    intro.openIfDue();
    intro.root.querySelector<HTMLButtonElement>('[data-intro-dismiss]')?.click();
    expect(introDue()).toBe(false);

    resetIntro();
    expect(introDue()).toBe(true);
    expect(intro.openIfDue()).toBe(true);
  });

  /*
   * Skipping the coach marks says nothing about the greeting.
   *
   * They are separate surfaces answering separate questions, and a player who
   * skipped the marks on a build where the intro did not exist has not
   * declined a panel they were never shown.
   */
  /*
   * The regression this file exists downstream of.
   *
   * The panel is a modal with a scrim, and a driven browser clicks by
   * selector. It shipped seeded in neither harness and five of the nine legs
   * of `npm run check` failed on "subtree intercepts pointer events", none of
   * them about the thing they were testing. The seed both harnesses now use is
   * one file, and this asserts it covers the greeting — in jsdom, in a
   * second, rather than in a browser leg that takes twelve minutes to say so.
   */
  it('is suppressed by the store the test harnesses seed', () => {
    globalThis.localStorage.setItem('gymrun.settings', notFirstLaunch());
    initSettings();
    expect(introDue()).toBe(false);
  });

  it('is still due for a player who had already skipped the tutorial', () => {
    globalThis.localStorage.setItem(
      'gymrun.settings',
      JSON.stringify({ density: 'detailed', tutorial: { skipped: true, seen: ['starter', 'map'] } }),
    );
    initSettings();
    expect(introDue()).toBe(true);
  });
});
