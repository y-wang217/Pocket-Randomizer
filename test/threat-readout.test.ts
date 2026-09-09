/**
 * The threat readout on screen: what it draws, and what it refuses to draw.
 *
 * @vitest-environment jsdom
 *
 * ## Why this one is a DOM test when the others are not
 *
 * The house rule is that DOM assertions belong in `scripts/smoke.mjs`, in a
 * real browser, because the questions usually being asked are about *layout at
 * a viewport size* and jsdom has no layout engine — `getBoundingClientRect`
 * returns zeros and a passing test would mean nothing. The map's
 * above-the-fold check lives there for exactly that reason and stays there.
 *
 * Nothing below is about layout. They are about which elements exist, in what
 * order, and carrying which text — and those are the assertions that would
 * otherwise only be checked by a person looking at the screen. The most
 * important of them is a *negative*: that no severity ordering and no severity
 * colour reaches the DOM. Part 4's prohibitions are the kind that get violated
 * by a plausible one-line change, and a rule with no test is a comment.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { createBattle, WHEEL_TYPES } from '../src/core/battle/driver';
import { buildBattleUiView } from '../src/core/battle/view';
import { createPartyMember } from '../src/core/party';
import { NO_THREATS, partyThreats } from '../src/core/typeMatchup';
import type { PokemonState } from '../src/core/types';
import { abilityEffects } from '../src/data/abilityEffects';
import { OPPONENT_TEAM, PLAYER_TEAM } from '../src/data/mons';
import { createScene, moveFacts } from '../src/ui/scene';
import { resetSettings, setVerbosity } from '../src/ui/settings';
import { createThreatReadout } from '../src/ui/screens/threats';

function member(species: string, ability: string, moves: string[]): PokemonState {
  return createPartyMember({ species, ability, moves, level: 30 });
}

/** Weak to Grass and Electric, answering neither. */
const WATER = [member('Squirtle', 'Torrent', ['Water Gun', 'Tackle'])];

function chipsOf(root: HTMLElement): string[] {
  return [...root.querySelectorAll('.threats__item .type')].map((chip) => chip.textContent ?? '');
}

beforeEach(() => {
  resetSettings();
});

describe('the readout draws the types and nothing else', () => {
  it('renders one badge per listed type', () => {
    const readout = createThreatReadout();
    readout.render(WATER);
    expect(chipsOf(readout.root)).toEqual(['Electric', 'Grass']);
  });

  it('draws the badges in the order the function returned them', () => {
    // The component does not sort, and this is the assertion that says so: the
    // DOM order is the function's order, which is the canonical dex order.
    const party = [
      member('Squirtle', 'Torrent', ['Tackle']),
      member('Geodude', 'Sturdy', ['Tackle']),
      member('Sandshrew', 'Sand Veil', ['Tackle']),
    ];
    const readout = createThreatReadout();
    readout.render(party);

    const drawn = chipsOf(readout.root);
    expect(drawn).toEqual(partyThreats(party).map((entry) => entry.type));
    expect(drawn).toEqual(WHEEL_TYPES.filter((type) => drawn.includes(type)));
  });

  it('never orders by how many members a type reaches', () => {
    /*
     * The same party the core ordering test uses, for the same reason: Grass
     * reaches all three and Electric reaches one, so a component that sorted by
     * severity — or that reversed the list to put the worst last — would draw
     * them in a different order than this.
     */
    const party = [
      member('Squirtle', 'Torrent', ['Tackle']),
      member('Geodude', 'Sturdy', ['Tackle']),
      member('Sandshrew', 'Sand Veil', ['Tackle']),
    ];
    const readout = createThreatReadout();
    readout.render(party);

    const drawn = chipsOf(readout.root);
    expect(drawn.indexOf('Electric')).toBeLessThan(drawn.indexOf('Grass'));
  });

  it('says there is nothing to list rather than drawing an empty box', () => {
    const readout = createThreatReadout();
    // Levitate cancels this Pikachu's only weakness, so the list is genuinely
    // empty rather than merely untested.
    readout.render([member('Pikachu', 'Levitate', ['Body Slam'])]);

    expect(chipsOf(readout.root)).toEqual([]);
    expect(readout.root.querySelector('.threats__none')?.textContent).toBe(NO_THREATS);
  });

  it('renders an empty party without throwing', () => {
    const readout = createThreatReadout();
    expect(() => readout.render([])).not.toThrow();
    expect(chipsOf(readout.root)).toEqual([]);
  });

  it('redraws from the party it is given, so a release changes the line', () => {
    const readout = createThreatReadout();
    readout.render([member('Pikachu', 'Static', ['Body Slam'])]);
    expect(chipsOf(readout.root)).toEqual(['Ground']);

    readout.render(WATER);
    expect(chipsOf(readout.root)).toEqual(['Electric', 'Grass']);
  });
});

describe('nothing on screen implies a ranking or a severity', () => {
  it('gives every badge the type class it wears everywhere else, and no other', () => {
    /*
     * A 4x entry and a 2x entry must be indistinguishable in the DOM. A
     * `--severe` modifier, a `data-band`, or an extra class on the worst entry
     * would each be the stylesheet delivering the verdict the copy refuses to.
     */
    const party = [member('Gyarados', 'Intimidate', ['Body Slam'])]; // Electric 4x, Rock 2x.
    const readout = createThreatReadout();
    readout.render(party);

    const chips = [...readout.root.querySelectorAll('.threats__item .type')];
    expect(chips.map((chip) => chip.className)).toEqual([
      'type type--electric',
      'type type--rock',
    ]);

    for (const item of readout.root.querySelectorAll('.threats__item')) {
      expect(item.className).toBe('threats__item');
      // No data attribute of any kind: `data-band` is how this codebase marks
      // severity on an HP bar, and it must not appear here.
      expect(Object.keys((item as HTMLElement).dataset)).toEqual([]);
    }
  });

  it('prints no count of the list, which would be a score', () => {
    const readout = createThreatReadout();
    readout.render(WATER);
    // "2 unanswered types" is a rating with the word filed off. The only
    // numbers allowed are the per-type membersHit figures below.
    expect(readout.root.textContent ?? '').not.toMatch(/\b2 (unanswered|types|gaps)\b/);
  });
});

describe('verbosity is presentation only', () => {
  it('shows the type list alone in Simple', () => {
    setVerbosity('simple');
    const readout = createThreatReadout();
    readout.render(WATER);

    expect(chipsOf(readout.root)).toEqual(['Electric', 'Grass']);
    expect(readout.root.querySelectorAll('.threats__count')).toHaveLength(0);
  });

  it('adds the members-hit figure per type in Detailed', () => {
    setVerbosity('detailed');
    const readout = createThreatReadout();
    readout.render(WATER);

    const counts = [...readout.root.querySelectorAll('.threats__count')].map((c) => c.textContent);
    expect(counts).toEqual(['hits 1 of 1, unanswered', 'hits 1 of 1, unanswered']);
  });

  it('lists the same types in both modes, because the flag changes no fact', () => {
    const readout = createThreatReadout();

    setVerbosity('simple');
    readout.render(WATER);
    const simple = chipsOf(readout.root);

    setVerbosity('detailed');
    readout.render(WATER);

    expect(chipsOf(readout.root)).toEqual(simple);
  });

  it('speaks the count in both modes, because a screen reader has no density problem', () => {
    setVerbosity('simple');
    const readout = createThreatReadout();
    readout.render(WATER);

    const labels = [...readout.root.querySelectorAll('.threats__item')].map((item) =>
      item.getAttribute('aria-label'),
    );
    expect(labels).toEqual([
      'Electric: hits 1 of 1, unanswered',
      'Grass: hits 1 of 1, unanswered',
    ]);
  });
});

describe('the map gets a disclosure and the party screen does not', () => {
  it('renders collapsed as a closed details element', () => {
    const readout = createThreatReadout({ collapsed: true });
    readout.render(WATER);

    expect(readout.root.tagName).toBe('DETAILS');
    expect((readout.root as HTMLDetailsElement).open).toBe(false);
    expect(readout.root.querySelector('summary')?.textContent).toBe('Watch for');
  });

  it('stays open across a redraw once the player opens it', () => {
    // The map redraws on every node, every rest and every flip of the Detail
    // toggle. A disclosure that closed itself each time would be unusable.
    const readout = createThreatReadout({ collapsed: true });
    readout.render(WATER);
    (readout.root as HTMLDetailsElement).open = true;

    readout.render(WATER);
    expect((readout.root as HTMLDetailsElement).open).toBe(true);
  });

  it('renders expanded as a plain section on the party screen', () => {
    const readout = createThreatReadout();
    readout.render(WATER);

    expect(readout.root.tagName).toBe('SECTION');
    expect(readout.root.querySelector('summary')).toBeNull();
    expect(readout.root.querySelector('.threats__title')?.textContent).toBe('Watch for');
  });
});

// ---------------------------------------------------------------------------
// Part 4 of the patch: which badges still open the type wheel
// ---------------------------------------------------------------------------

describe('the type wheel', () => {
  /*
   * The wheel itself is unchanged and `test/tooltips.test.ts` still covers its
   * content. What changed is which badges raise it, and that is a fact about
   * the DOM rather than about the lookup — so it is asserted here, where there
   * is a DOM.
   *
   * A move type badge keeps the wheel because "what does my Rock move hit" is a
   * real question the per-move effectiveness markers do not answer: they speak
   * only about the Pokemon currently opposite.
   */
  it('is still reachable from a move type badge', () => {
    const facts = moveFacts({
      name: 'Rock Slide',
      type: 'Rock',
      category: 'Physical',
      basePower: 75,
      maxPp: 16,
    });
    const badge = facts.meta.querySelector('.type');
    expect(badge).not.toBeNull();
    expect((badge as HTMLElement).dataset['tip']).toBe('type:Rock');
  });

  it('is no longer reachable from either Pokemon panel', () => {
    /*
     * A real battle rather than a hand-built view, because the thing under test
     * is what `scene.update` puts in the DOM and a fabricated `BattleUiView`
     * would be asserting against a shape this test wrote rather than the one
     * the projection produces.
     *
     * The wheel on a panel answered "what does Water do offensively" beside a
     * Pokemon whose four moves are drawn off-species — a Water type here
     * routinely knows no Water move at all. The badge invited a reading that
     * was true about the type and false about the Pokemon wearing it.
     */
    const session = createBattle({ teams: { p1: PLAYER_TEAM, p2: OPPONENT_TEAM }, seed: 'WHEEL' });
    const scene = createScene();
    scene.update(
      buildBattleUiView(session.factsFor('p1'), { ability: true, item: true }, abilityEffects),
      () => undefined,
    );

    const panelBadges = [...scene.root.querySelectorAll('.panel .type')];
    // Both panels drew types, so the assertion below is not vacuous.
    expect(panelBadges.length).toBeGreaterThan(1);
    for (const badge of panelBadges) {
      expect((badge as HTMLElement).dataset['tip']).toBeUndefined();
      // And it is no longer keyboard-focusable or announced as a button, which
      // is what a trigger with no tooltip behind it would leave behind.
      expect(badge.getAttribute('role')).toBeNull();
    }

    // The move buttons in the same scene still carry it.
    const moveBadges = [...scene.root.querySelectorAll('.moves .type')];
    expect(moveBadges.length).toBeGreaterThan(0);
    for (const badge of moveBadges) {
      expect((badge as HTMLElement).dataset['tip']).toMatch(/^type:/);
    }
  });

  it('is not reachable from a badge in the threat readout', () => {
    /*
     * The readout's badges are labels. Opening the wheel from one would put a
     * general fact about Fire next to a list that is specifically about *this
     * party*, which is the same confusion of scopes the Pokemon panels just
     * had removed.
     */
    const readout = createThreatReadout();
    readout.render(WATER);

    for (const chip of readout.root.querySelectorAll('.type')) {
      expect((chip as HTMLElement).dataset['tip']).toBeUndefined();
    }
  });
});
