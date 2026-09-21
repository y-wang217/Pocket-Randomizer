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
import { formatStageMultiplier } from '../src/data/statStages';

const PLAYER: TeamSpec = [
  { species: 'Snorlax', ability: 'Thick Fat', moves: ['Swords Dance', 'Body Slam'], level: 50 },
];
const FOE: TeamSpec = [{ species: 'Golem', ability: 'Sturdy', moves: ['Tackle'], level: 50 }];

/** The same two sides, with the foe holding something. M3.1's item slot. */
const FOE_HOLDING: TeamSpec = [
  { species: 'Golem', ability: 'Sturdy', moves: ['Tackle'], level: 50, item: 'Leftovers' },
];

beforeEach(() => {
  resetSettings();
});

function sceneFor(seed = 'STAGE01', foe: TeamSpec = FOE): { scene: Scene; view: BattleUiView } {
  const session = createBattle({ teams: { p1: PLAYER, p2: foe }, seed });
  const view = buildBattleUiView(session.factsFor('p1'), { ability: true, item: true, teamSize: true }, abilityEffects);
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

  /**
   * **Rewritten at patch 4.8.0.3, and the property it holds is unchanged.**
   *
   * The chip read `Atk +2`. It reads `Atk 2.0x` now, with a ladder carrying
   * the stage — a stage integer is a number only a Pokemon player can read,
   * and the multiplier is the same fact in a form anyone can. What this test
   * was written for survives the change word for word: a bare `2.0x` on a row
   * of mixed chips would not say 2.0x *of what*, so the label is still
   * asserted to be part of the chip's own text rather than a second element
   * beside it.
   *
   * The multiplier is not written out as a literal here. It comes from
   * `formatStageMultiplier`, which `test/battle-readout.test.ts` holds against
   * `applyStage` across the whole -6..+6 range — so this test cannot start
   * passing on a number the engine does not apply.
   */
  it('names the stat a stage is on, so a multiplier is not 2.0x of what', () => {
    const session = createBattle({ teams: { p1: PLAYER, p2: FOE }, seed: 'STAGE02' });
    const scene = createScene();
    scene.update(buildBattleUiView(session.factsFor('p1'), { ability: true, item: true, teamSize: true }, abilityEffects), () => {});
    // Swords Dance, both sides submitting, so the player's Attack is +2.
    for (const side of ['p1', 'p2'] as const) {
      if (session.viewFor(side).awaitingChoice) session.submit(side, { kind: 'move', slot: 1 } as never);
    }
    scene.update(buildBattleUiView(session.factsFor('p1'), { ability: true, item: true, teamSize: true }, abilityEffects), () => {});

    const chips = [...panelOf(scene, 'me').querySelectorAll('.panel__stages .chip--stage')];
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.map((chip) => chip.textContent)).toContain(`Atk ${formatStageMultiplier(2)}`);
    // And the stage itself is still reachable: it is what the ladder draws,
    // and it is on the ladder's label as a signed number.
    const boosted = chips.find((chip) => chip.textContent?.startsWith('Atk'))!;
    expect(boosted.querySelectorAll('.stage-ladder__seg[data-on="true"]')).toHaveLength(2);
    expect(boosted.querySelector('.stage-ladder')?.getAttribute('aria-label')).toContain('+2');
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
    /*
     * **M3.1 took the word off it and left the fact.** `▲ FIRST` spent a word
     * on a surface budgeted at zero, and its triangle borrowed the Priority
     * family for something that is not a bracket. The Stat family's Speed
     * glyph is the mark now; the sentence is where it always was.
     */
    expect(markers[0]?.textContent).toBe('');
    expect(markers[0]?.querySelector('.glyph')?.getAttribute('data-glyph')).toBe('stat-spe');
    expect(markers[0]?.getAttribute('aria-label')).toBe('Moves first at this Speed');
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
    scene.update(buildBattleUiView(session.factsFor('p1'), { ability: true, item: true, teamSize: true }, abilityEffects), () => {});
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
      /*
       * `move__facts-effect` joined the list in the playtest patch and is **a
       * position class, not a weight class**: it pins the marker to the end of
       * the fact line, which is where it went when `.move__meta` stopped
       * wrapping. It is identical on a super effective marker and on a 0x,
       * which is the property this assertion is about.
       */
      expect(badge.className).toBe('chip chip--effect badge badge--effect move__facts-effect');
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
      scene.update(buildBattleUiView(session.factsFor('p1'), { ability: true, item: true, teamSize: true }, abilityEffects), () => {});
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

  it('leaves no turn order marker on either panel either', () => {
    const { session, scene, draw } = opened('SWAP05');
    session.submit('p1', { kind: 'move', slot: 1 } as never);
    if (session.viewFor('p2').awaitingChoice) session.submit('p2', { kind: 'move', slot: 1 } as never);
    draw();
    // Release C's nudge followed the swap beat onto the sprite in the bar and
    // beats patch, for the same reason. The panel is a scrim; it does not move.
    // `test/battle-feedback.test.ts` holds where the lunge went instead.
    expect(scene.root.querySelectorAll('.panel[data-jiggle]')).toHaveLength(0);
  });
});


/**
 * The panel at rest. **Milestone M3.1.**
 *
 * Section 4 budgets this surface at zero words with "Name, nickname"
 * surviving, section 5 says what it owns, and D18 ruled what happens to the
 * one thing it owned that the canon never listed. Each test below is one of
 * those, and each names the word it is there to keep off the panel — because
 * the census measures a total and a total cannot say which element regained a
 * word three patches from now.
 */
describe('the panel at rest', () => {
  it('names the foe by species and puts the side on the panel, not in the slot', () => {
    const { scene } = sceneFor();
    expect(panelOf(scene, 'foe').querySelector('.panel__name')?.textContent).toBe('Golem');
    expect(panelOf(scene, 'foe').getAttribute('aria-label')).toContain('Opposing Golem');
    expect(panelOf(scene, 'me').querySelector('.panel__name')?.textContent).toBe('Snorlax');
  });

  it('prints the level as a number, with no field label welded to it', () => {
    const { scene } = sceneFor();
    for (const kind of ['me', 'foe'] as const) {
      const level = panelOf(scene, kind).querySelector('.panel__level')?.textContent ?? '';
      expect(level).not.toContain('Lv');
      // The number, and the gender mark, and nothing else. Genderless renders
      // no mark at all, which is why the tail is optional.
      expect(level).toMatch(/^50( [\u2640\u2642])?$/);
    }
  });

  it('carries the level and the gender on the panel’s accessible name', () => {
    const { scene } = sceneFor();
    expect(panelOf(scene, 'me').getAttribute('aria-label')).toMatch(/^Snorlax, level 50(, (male|female))?$/);
  });

  it('draws no archetype label, on either side', () => {
    const { scene } = sceneFor();
    // D18, ruled 2026-09-21. Section 3 bars the label; the numbers it was
    // derived from are behind the long press, which the next test holds.
    expect(scene.root.querySelectorAll('.panel .badge--archetype')).toHaveLength(0);
    for (const kind of ['me', 'foe'] as const) {
      expect(panelOf(scene, kind).textContent).not.toContain('Attacker');
    }
  });

  it('is an inspect trigger carrying all six stats, in display order', () => {
    const { scene, view } = sceneFor();
    for (const kind of ['me', 'foe'] as const) {
      const panel = panelOf(scene, kind);
      expect(panel.dataset['tip']).toBe(`stats:${kind === 'me' ? 'Snorlax' : 'Golem'}`);
      expect(panel.getAttribute('role')).toBe('button');
      const rows = (panel.dataset['detail'] ?? '').split('\n').map((row) => row.split('\t')[0]);
      expect(rows).toEqual(['hp', 'atk', 'def', 'spa', 'spd', 'spe']);
    }
    // The numbers are the projection's, pre-boost, and the panel derives none
    // of them: `base`, not `effective`, so the stages on the chip row are not
    // the same fact in a second channel.
    const detail = panelOf(scene, 'me').dataset['detail'] ?? '';
    expect(detail).toContain(`atk\t${view.player.stats.atk.base}`);
    expect(detail).toContain(`hp\t${view.player.hp.max}`);
  });

  it('spends no word on the roster count', () => {
    const { scene } = sceneFor();
    const label = panelOf(scene, 'foe').querySelector('.panel__roster-label');
    // A fraction and a row of marks. "left" was the field label on it.
    expect(label?.textContent).toMatch(/^\d+\/(\d+|\?)$/);
    expect(panelOf(scene, 'foe').querySelector('.panel__roster')?.getAttribute('aria-label')).toContain('left');
  });

  it('keeps the priority chevron slot empty until a bracket fills it', () => {
    const { scene } = sceneFor();
    for (const kind of ['me', 'foe'] as const) {
      const panel = panelOf(scene, kind);
      // The slot exists, which is D6: a slot missing from the canon is a slot
      // a screen draws itself. It renders nothing, which is R4 — `data-bracket`
      // is what fills it and M4.2 is what sets that.
      const slot = panel.querySelector('.panel__priority');
      expect(slot, 'the slot is built').not.toBeNull();
      expect(panel.dataset['bracket']).toBeUndefined();
      // Both marks, so filling the slot is one attribute rather than a
      // re-render in the middle of a beat.
      expect([...(slot?.querySelectorAll('.glyph') ?? [])].map((g) => g.getAttribute('data-glyph'))).toEqual([
        'priority-up',
        'priority-down',
      ]);
    }
  });

  it('folds the stage chips into marks rather than into the word STAGES', () => {
    const { scene, view } = sceneFor();
    /*
     * The stages are set on the projection rather than played out over a real
     * turn, because what is under test is the *marker's face* and not how a
     * boost is applied — `test/battle-readout.test.ts` holds the second
     * against the engine's own table. One Attack boost and one evasion drop,
     * so both halves of the marker are exercised: the five that have a stat
     * glyph, and the two that do not and take the accuracy family's target.
     */
    view.player.stats.atk.stage = 2;
    view.player.accuracyStages.evasion = -1;
    scene.update(view, () => {});

    const marker = panelOf(scene, 'me').querySelector('.badge--stages') as HTMLElement;
    expect(marker, 'the Pocket fold is still built in every mode').not.toBeNull();
    // No word, and no count either: the marks are the count, and a numeral
    // beside them would be the same fact in a second channel (R3).
    expect(marker.textContent).toBe('');
    expect([...marker.querySelectorAll('.glyph')].map((g) => g.getAttribute('data-glyph'))).toEqual([
      'stat-atk',
      'accuracy-target',
    ]);
    // The sentence is where a reader who cannot count marks still finds it.
    expect(marker.getAttribute('aria-label')).toBe('STAGES 2');
    // And the set itself is unchanged behind the press.
    expect(marker.dataset['detail']).toContain('Atk');
    expect(marker.dataset['detail']).toContain('Eva');
  });

  it('draws the held item as a sprite in a fixed slot, and nothing when there is none', () => {
    const empty = sceneFor('STAGE-ITEM0').scene;
    const emptySlot = panelOf(empty, 'foe').querySelector('.panel__item') as HTMLElement;
    expect(emptySlot, 'the slot is always built, so its position never moves').not.toBeNull();
    expect(emptySlot.hidden).toBe(true);
    expect(emptySlot.childElementCount).toBe(0);

    const held = sceneFor('STAGE-ITEM1', FOE_HOLDING).scene;
    const slot = panelOf(held, 'foe').querySelector('.panel__item') as HTMLElement;
    expect(slot.hidden).toBe(false);
    // Showdown's own icon sheet, through `ui/slots.ts` — the same cell the
    // party slots and the summary draw, so an item looks the same everywhere.
    const icon = slot.querySelector('.slot__icon') as HTMLElement;
    expect(icon, 'the sprite, not the name').not.toBeNull();
    expect(icon.style.backgroundImage).toContain('url(');
    expect(slot.textContent).toBe('');
    // The name and the effect line did not go anywhere: they are what the
    // long press opens, per section 3's Held item row.
    expect(slot.dataset['tip']).toBe('item:leftovers');
    expect(icon.getAttribute('aria-label')).toBe('Leftovers');
  });
});
