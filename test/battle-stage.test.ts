/**
 * The battle stage: two sprites in the scene, two panels floating. **V5.3.**
 *
 * @vitest-environment jsdom
 *
 * The same split every battle-UI file in this suite uses: which elements
 * exist, which side each faces and which chips a panel carries are DOM
 * questions and jsdom answers them; whether a panel reads as a card and
 * whether the two sides are drawn at the same weight are questions about
 * computed style at 390 wide, and those are in `test/visual-v5.test.ts`.
 *
 * Release C's HP behaviour is deliberately **not** re-asserted here.
 * `test/battle-feedback.test.ts` owns it and runs unchanged, which is the
 * plan's own instruction for this checkpoint: V5 restyles the bar's
 * surroundings and does not touch the bar.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { createBattle } from '../src/core/battle/driver';
import { buildBattleUiView, type BattleUiView } from '../src/core/battle/view';
import type { TeamSpec } from '../src/core/types';
import { abilityEffects } from '../src/data/abilityEffects';
import { createScene, type Scene } from '../src/ui/scene';
import { resetSettings } from '../src/ui/settings';

const PLAYER: TeamSpec = [
  { species: 'Snorlax', ability: 'Thick Fat', moves: ['Swords Dance', 'Body Slam'], level: 50 },
];
const FOE: TeamSpec = [{ species: 'Golem', ability: 'Sturdy', moves: ['Tackle'], level: 50 }];

beforeEach(() => {
  resetSettings();
});

function sceneFor(seed = 'STAGE01'): { scene: Scene; view: BattleUiView } {
  const session = createBattle({ teams: { p1: PLAYER, p2: FOE }, seed });
  const view = buildBattleUiView(session.factsFor('p1'), { ability: true, item: true }, abilityEffects);
  const scene = createScene();
  scene.update(view, () => {});
  return { scene, view };
}

/** The panel a side's facts are drawn on. */
const panelOf = (scene: Scene, kind: 'me' | 'foe'): HTMLElement =>
  scene.root.querySelector(`.panel--${kind}`) as HTMLElement;

describe('the sprites', () => {
  it('stand in the stage, one a side, with no box of their own', () => {
    const { scene } = sceneFor();
    const actors = [...scene.root.querySelectorAll('.stage .stage__actor')];
    expect(actors).toHaveLength(2);
    // The old separate sprite box is gone because it never existed: this is
    // the first stage to draw a sprite in a battle at all, and it draws it
    // straight onto the stage.
    for (const actor of actors) expect(actor.parentElement?.className).toBe('stage');
  });

  it('faces the player on the near side and the player on the far side', () => {
    const { scene } = sceneFor();
    // `:not(.sprite--ghost)` because an actor holds two sprites since V5.5 —
    // the one standing there and the one that just left. The ghost is empty at
    // rest, so a bare `img` here would read the wrong element.
    const src = (kind: string): string =>
      (scene.root.querySelector(`.stage__actor--${kind} .sprite:not(.sprite--ghost)`) as HTMLImageElement).src;
    // `p1` is the near side and wears the back sprite; `p2` faces the player.
    // The protocol's own sides, so nothing here translates between two
    // vocabularies.
    expect(src('me')).toContain('gen5-back/');
    expect(src('foe')).not.toContain('gen5-back/');
    expect(src('me')).toContain('snorlax');
    expect(src('foe')).toContain('golem');
  });

  it('is decorative, and says so', () => {
    const { scene } = sceneFor();
    // The panel beside it names the Pokemon, its level, its types and its HP.
    // A screen reader that also read the sprite would hear the same body twice.
    for (const actor of scene.root.querySelectorAll('.stage__actor')) {
      expect(actor.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('does not re-request an image on a turn that changed nobody', () => {
    const { scene, view } = sceneFor();
    const img = scene.root.querySelector('.stage__actor--me .sprite:not(.sprite--ghost)') as HTMLImageElement;
    const first = img.src;
    let requests = 0;
    Object.defineProperty(img, 'src', {
      get: () => first,
      set: () => {
        requests++;
      },
      configurable: true,
    });
    scene.update(view, () => {});
    scene.update(view, () => {});
    // Re-setting `src` to the URL it already holds makes the browser re-decode
    // an image, and on a phone that is a repaint a move.
    expect(requests).toBe(0);
  });
});

describe('the floating panel', () => {
  it('has both panels inside the stage rather than above and below it', () => {
    const { scene } = sceneFor();
    // The whole reason the budget closes. Stacked, the two panels and the
    // sprite band put the move grid past the 740 line.
    for (const kind of ['me', 'foe'] as const) {
      expect(panelOf(scene, kind).parentElement?.className).toBe('stage');
    }
  });

  it('carries no six-stat block, and says the stages as V2 chips instead', () => {
    const { scene } = sceneFor();
    expect(scene.root.querySelectorAll('.stats')).toHaveLength(0);
    expect(scene.root.querySelectorAll('.stat__label')).toHaveLength(0);

    // Nothing has moved a stage yet, so there is nothing to say and the row
    // holds no chip at all — the same rule the flag strip follows one band
    // below.
    const me = panelOf(scene, 'me');
    expect(me.querySelectorAll('.panel__stages .chip--stage')).toHaveLength(0);
  });

  it('names the stat a stage is on, so `+2` is not +2 of what', () => {
    const session = createBattle({ teams: { p1: PLAYER, p2: FOE }, seed: 'STAGE02' });
    const scene = createScene();
    scene.update(buildBattleUiView(session.factsFor('p1'), { ability: true, item: true }, abilityEffects), () => {});
    // Swords Dance, both sides submitting, so the player's Attack is +2.
    for (const side of ['p1', 'p2'] as const) {
      if (session.viewFor(side).awaitingChoice) session.submit(side, { kind: 'move', slot: 1 } as never);
    }
    scene.update(buildBattleUiView(session.factsFor('p1'), { ability: true, item: true }, abilityEffects), () => {});

    const chips = [...panelOf(scene, 'me').querySelectorAll('.panel__stages .chip--stage')];
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.map((chip) => chip.textContent)).toContain('Atk +2');
    // Through the V2 component, whose docstring has said "for the battle panel
    // to adopt in V5" since that stage landed.
    for (const chip of chips) expect(chip.classList.contains('chip')).toBe(true);
  });

  it('keeps the speed marker the six rows used to carry', () => {
    const { scene } = sceneFor();
    // A fact about the board as it stands right now — the same kind of fact as
    // the live effectiveness marker, and the one exception the copy rule names.
    const markers = [...scene.root.querySelectorAll('.panel__stages .badge--first')];
    expect(markers).toHaveLength(1);
    expect(markers[0]?.textContent).toContain('FIRST');
  });

  it('leaves Release C’s HP elements exactly where they were', () => {
    const { scene } = sceneFor();
    for (const kind of ['me', 'foe'] as const) {
      const panel = panelOf(scene, kind);
      const track = panel.querySelector('.hp') as HTMLElement;
      expect(track, 'the track is still on the panel').not.toBeNull();
      // Shadow before fill, so the fill paints over it. Release C's ordering,
      // and the reason its comment gives is a hairline seam on the leading
      // edge of the bar on exactly the frames the player is watching it.
      expect([...track.children].map((child) => child.className)).toEqual(['hp__shadow', 'hp__fill']);
    }
  });
});

/**
 * The effectiveness marker. **V5.4, and the plan's test 4 as amendment A4
 * rewrites it.**
 *
 * The plan asked for "an effectiveness chip renders on every button", which
 * contradicts what the tree deliberately built: the round 2 patch's neutral
 * suppression, at the bottom of `renderMove`, whose own comment says "a row
 * where every button carries a badge is a row where the badges stop being
 * read, and the 0x goes unread with them". The audit found that collision and
 * A4 resolves it — the rule is **sameness**, not presence: every marker that
 * does render is the same size and weight as every other, and none of them is
 * brighter than the neutral state.
 *
 * Suppression stays exactly as it was. This file asserts that too, because a
 * rule that is only a comment is a rule until somebody reads the plan instead.
 */
describe('the effectiveness marker', () => {
  /**
   * Golem is Rock/Ground, and these four moves are one of each reading:
   * Psychic 1x (neutral, and therefore suppressed), Water 4x, Electric 0x,
   * Normal 0.5x. Three markers across three different bands, so sameness is
   * asserted across bands rather than across one band three times.
   */
  const SPREAD: TeamSpec = [
    {
      species: 'Alakazam',
      ability: 'Synchronize',
      moves: ['Psychic', 'Surf', 'Thunderbolt', 'Body Slam'],
      level: 50,
    },
  ];

  function markers(): { scene: Scene; badges: HTMLElement[] } {
    const session = createBattle({ teams: { p1: SPREAD, p2: FOE }, seed: 'EFFECT01' });
    const scene = createScene();
    scene.update(buildBattleUiView(session.factsFor('p1'), { ability: true, item: true }, abilityEffects), () => {});
    return { scene, badges: [...scene.root.querySelectorAll('.moves .badge--effect')] as HTMLElement[] };
  }

  it('prints nothing for a neutral damaging move, exactly as before', () => {
    const { scene, badges } = markers();
    expect(scene.root.querySelectorAll('.moves .move')).toHaveLength(4);
    // Psychic is 1x into Golem and carries no marker. The other three do.
    expect(badges).toHaveLength(3);
    expect(scene.root.querySelector('.move--psychic .badge--effect'), 'the neutral move is bare').toBeNull();
  });

  it('draws every marker it does draw as the same chip', () => {
    const { badges } = markers();
    const bands = badges.map((badge) => badge.dataset['band']);
    expect(new Set(bands)).toEqual(new Set(['super', 'none', 'resisted']));
    /*
     * One class list for all of them. `data-band` is the only thing that
     * differs, and it is a hook rather than a style: no `--chip` override, no
     * size modifier, no per-band variant. A super effective marker larger or
     * brighter than a 0x would turn a reading into a recommendation, and the
     * accent belongs to `.primary-action`.
     */
    expect(new Set(badges.map((badge) => badge.className)).size).toBe(1);
    for (const badge of badges) {
      expect(badge.className).toBe('chip chip--effect badge badge--effect');
      expect(badge.getAttribute('style')).toBeNull();
    }
  });

  it('still names the ability when one is the reason', () => {
    // The 0x on Thunderbolt into a Ground type is the type chart's, not an
    // ability's, so nothing is outlined here — the point is that the branch
    // survives the restyle rather than that it fires on this board.
    const { badges } = markers();
    for (const badge of badges) {
      if (badge.dataset['ability'] === 'true') expect(badge.dataset['tip']).toMatch(/^ability:/);
    }
    expect(badges.some((badge) => badge.getAttribute('aria-label')?.includes(':'))).toBe(true);
  });
});

/**
 * The species swap. **V5.5, and the plan's test 5.**
 *
 * Two claims, and the second is the one that matters: it fires **only** on a
 * switch, and it adds **zero** time to a turn without one. The second follows
 * from the first here rather than from a measurement of milliseconds — the
 * animation exists only while `data-swapped` is on the actor, so a turn that
 * never sets it has no animation to run and nothing to wait for. That is the
 * strongest form the claim has: not "it is fast", but "there is nothing there".
 *
 * `test/visual-v5.test.ts` reads the resolved `animation-duration` in Chromium,
 * where the token chain from `data/tuning.ts` actually resolves.
 */
describe('the species swap', () => {
  const TWO: TeamSpec = [
    { species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam'], level: 50 },
    { species: 'Gengar', ability: 'Levitate', moves: ['Shadow Ball'], level: 50 },
  ];

  const swapped = (scene: Scene): string[] =>
    [...scene.root.querySelectorAll('.stage__actor')].map((actor) => (actor as HTMLElement).dataset['swapped'] ?? '');

  function opened(seed: string): { session: ReturnType<typeof createBattle>; scene: Scene; draw: () => void } {
    const session = createBattle({ teams: { p1: TWO, p2: FOE }, seed });
    const scene = createScene();
    const draw = (): void =>
      scene.update(buildBattleUiView(session.factsFor('p1'), { ability: true, item: true }, abilityEffects), () => {});
    draw();
    return { session, scene, draw };
  }

  it('does not fire on the opening switch-in', () => {
    const { scene } = opened('SWAP01');
    // An arrival is not a swap, and sinking a body that was never on the field
    // at the start of every battle is the failure this guard exists for.
    expect(swapped(scene)).toEqual(['', '']);
  });

  it('adds nothing to a turn where nobody switched', () => {
    const { session, scene, draw } = opened('SWAP02');
    for (const side of ['p1', 'p2'] as const) {
      if (session.viewFor(side).awaitingChoice) session.submit(side, { kind: 'move', slot: 1 } as never);
    }
    draw();
    // No attribute, so no animation, so no time. The plan's "adds nothing to
    // the per-turn budget" is a structural fact rather than a measurement.
    expect(swapped(scene)).toEqual(['', '']);
    expect(scene.root.querySelectorAll('.sprite--ghost[src]')).toHaveLength(0);
  });

  it('fires on the side that switched, and only that side', () => {
    const { session, scene, draw } = opened('SWAP03');
    session.submit('p1', { kind: 'switch', slot: 2 } as never);
    if (session.viewFor('p2').awaitingChoice) session.submit('p2', { kind: 'move', slot: 1 } as never);
    draw();

    const actors = [...scene.root.querySelectorAll('.stage__actor')] as HTMLElement[];
    const me = actors.find((actor) => actor.classList.contains('stage__actor--me'));
    const foe = actors.find((actor) => actor.classList.contains('stage__actor--foe'));
    expect(me?.dataset['swapped'], 'the side that switched').toBe('true');
    expect(foe?.dataset['swapped'], 'and only that side').toBeUndefined();
    // The body that left is held only while it is leaving.
    const ghost = me?.querySelector('.sprite--ghost') as HTMLImageElement;
    expect(ghost.getAttribute('src')).toContain('snorlax');
    expect((me?.querySelector('.sprite:not(.sprite--ghost)') as HTMLImageElement).src).toContain('gengar');
  });

  it('is cancelled by a tap, like every other transition on this screen', () => {
    const { session, scene, draw } = opened('SWAP04');
    session.submit('p1', { kind: 'switch', slot: 2 } as never);
    if (session.viewFor('p2').awaitingChoice) session.submit('p2', { kind: 'move', slot: 1 } as never);
    draw();
    expect(swapped(scene)).toContain('true');

    scene.root.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true }));
    expect(swapped(scene)).toEqual(['', '']);
    // And the stage lets go of the body that left, rather than keeping it one
    // repaint away from being back.
    expect(scene.root.querySelectorAll('.sprite--ghost[src]')).toHaveLength(0);
  });

  it('leaves no swap marker on either panel', () => {
    const { session, scene, draw } = opened('SWAP05');
    session.submit('p1', { kind: 'switch', slot: 2 } as never);
    if (session.viewFor('p2').awaitingChoice) session.submit('p2', { kind: 'move', slot: 1 } as never);
    draw();
    // The beat is the sprite's now. Two animations for one event is noise, and
    // a stale marker on the panel would be a rule left behind a flag.
    expect(scene.root.querySelectorAll('.panel[data-swapped]')).toHaveLength(0);
  });
});
