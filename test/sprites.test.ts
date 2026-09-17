/**
 * A sprite on every surface where a Pokemon is chosen or inspected, in a
 * figure that bobs while it waits. **Idle-sprites patch.**
 *
 * @vitest-environment jsdom
 *
 * jsdom, because every assertion is about which elements exist, where, and
 * with which attributes and inline properties: one figure per Pokemon on each
 * surface, the phase written from the slot, the image's `alt`, and none of it
 * inside the battle stage's actors. Whether the figure actually animates, and
 * holds still under reduced motion, is computed style and lives in
 * `test/visual-sprites.test.ts`.
 *
 * The last case is the tree grep every component in this suite carries: the
 * one image factory is `spriteImg`, and no surface builds an `<img>` by hand.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createBattle, describeMove } from '../src/core/battle/driver';
import { createParty } from '../src/core/party';
import type { NodeSpec } from '../src/core/encounters';
import type { PokemonSpec, TeamSpec } from '../src/core/types';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { memberCardContents } from '../src/ui/member-card';
import { renderCaptureOffer } from '../src/ui/screens/acquisition';
import { createBattleScreen } from '../src/ui/screens/battle';
import { createItemTargetScreen } from '../src/ui/screens/item-target';
import { createMoveReplaceScreen } from '../src/ui/screens/move-replace';
import { createStarterSelect } from '../src/ui/screens/starter-select';
import { IDLE_PHASES, spriteFigure } from '../src/ui/sprites';

const SNORLAX: PokemonSpec = { species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam', 'Rest'], level: 50 };
const GENGAR: PokemonSpec = { species: 'Gengar', ability: 'Levitate', moves: ['Shadow Ball'], level: 50 };
const PIKACHU: PokemonSpec = { species: 'Pikachu', ability: 'Static', moves: ['Thunderbolt'], level: 50 };
const PLAYER: TeamSpec = [SNORLAX, GENGAR];
const FOE: TeamSpec = [{ species: 'Golem', ability: 'Sturdy', moves: ['Tackle'], level: 50 }];

/** The figures under a root, as `[species alt, phase]` pairs, in document order. */
function figures(root: ParentNode): Array<[string, string]> {
  return [...root.querySelectorAll<HTMLElement>('.figure')].map((figure) => [
    figure.querySelector('img.sprite')?.getAttribute('alt') ?? '',
    figure.style.getPropertyValue('--idle-phase'),
  ]);
}

describe('the figure', () => {
  it('wraps the one sprite image, hidden from the tree, with its phase from the slot', () => {
    const figure = spriteFigure('Snorlax', { phase: 4 });
    expect(figure.className).toBe('figure');
    expect(figure.getAttribute('aria-hidden')).toBe('true');
    expect([...figure.children].map((child) => child.className)).toEqual(['sprite']);
    expect(figure.querySelector('img')?.alt).toBe('Snorlax');
    expect(figure.style.getPropertyValue('--idle-phase')).toBe('4');
  });

  it('wraps the phase so a seventh slot starts where the first did, and never goes negative', () => {
    expect(spriteFigure('Snorlax', { phase: IDLE_PHASES }).style.getPropertyValue('--idle-phase')).toBe('0');
    expect(spriteFigure('Snorlax', { phase: IDLE_PHASES + 2 }).style.getPropertyValue('--idle-phase')).toBe('2');
    expect(spriteFigure('Snorlax', { phase: -1 }).style.getPropertyValue('--idle-phase')).toBe(String(IDLE_PHASES - 1));
    expect(spriteFigure('Snorlax').style.getPropertyValue('--idle-phase')).toBe('0');
  });

  it('faces the way it is asked, and the front by default', () => {
    expect(spriteFigure('Snorlax').querySelector('img')?.src).toContain('/gen5/');
    expect(spriteFigure('Snorlax', { side: 'p1' }).querySelector('img')?.src).toContain('/gen5-back/');
  });
});

describe('the surfaces', () => {
  it('starter pick: one figure per card, phased by card', () => {
    const screen = createStarterSelect();
    screen.render([SNORLAX, GENGAR, PIKACHU], () => undefined);
    expect(figures(screen.root)).toEqual([['Snorlax', '0'], ['Gengar', '1'], ['Pikachu', '2']]);
    for (const card of screen.root.querySelectorAll('.starter')) expect(card.firstElementChild?.className).toBe('figure');
  });

  it('learn move: the owner line carries the recipient', () => {
    const screen = createMoveReplaceScreen();
    const incoming = describeMove('Ice Beam');
    if (!incoming) throw new Error('Ice Beam is not in the dex');
    const [member] = createParty([GENGAR]);
    screen.render(member!, incoming, () => undefined, DEFAULT_TUNING);
    expect(figures(screen.root.querySelector('.replace__owner')!)).toEqual([['Gengar', '0']]);
    // And nowhere else: the four moves being weighed are not bodies.
    expect(figures(screen.root)).toHaveLength(1);
  });

  it('member card: the party screen, the drawer and the pre-gym lead choice inherit it, phased by slot', () => {
    const [first, second] = createParty([SNORLAX, GENGAR]);
    const cards = [
      memberCardContents(first!, { holding: null, tuning: DEFAULT_TUNING, index: 0 }),
      memberCardContents(second!, { holding: null, tuning: DEFAULT_TUNING, index: 1 }),
      // No index: the drawer's card stands in no collection and starts at rest.
      memberCardContents(second!, { holding: null, tuning: DEFAULT_TUNING }),
    ];
    expect(cards.map((card) => figures(card))).toEqual([[['Snorlax', '0']], [['Gengar', '1']], [['Gengar', '0']]]);
    for (const card of cards) expect(card.firstElementChild?.className).toBe('figure');
  });

  it('recipient: one figure per party member, inside the button and out of its hit path', () => {
    const screen = createItemTargetScreen();
    screen.render({ kind: 'tm', move: 'Ice Beam' }, createParty([SNORLAX, GENGAR]), () => undefined, DEFAULT_TUNING);
    expect(figures(screen.root)).toEqual([['Snorlax', '0'], ['Gengar', '1']]);
    for (const button of screen.root.querySelectorAll('.party__member--target')) {
      expect(button.querySelector('.figure')?.parentElement).toBe(button);
    }
  });

  it('capture: the offered Pokemon and every member it would replace', () => {
    const party = createParty([SNORLAX, GENGAR]);
    const root = renderCaptureOffer({ nodeId: 's1-1-0', source: 'encounter', spec: PIKACHU }, party, () => undefined, 2);
    expect(figures(root)).toEqual([['Pikachu', '0'], ['Snorlax', '0'], ['Gengar', '1']]);
  });

  it('battle: the bench carries a figure per member, phased by slot, and the stage actors carry none', () => {
    const session = createBattle({ teams: { p1: PLAYER, p2: FOE }, seed: 'FIGURE01' });
    const screen = createBattleScreen();
    document.body.replaceChildren(screen.root);
    const node = {
      id: 's1-1-0',
      kind: 'battle',
      tier: 'normal',
      label: 'A fight',
      encounter: { team: FOE, opponent: 'A trainer', simSeed: 'FIGURE01' },
      rewards: [],
    } as unknown as NodeSpec;
    screen.attach(session, node, { ability: true, item: true, teamSize: true }, () => {});
    // Phased by the protocol's slot, which is 1-based: Gengar is the second
    // member, slot 2. A position on the team, the same number the switch
    // choice carries.
    expect(figures(screen.root.querySelector('.bench')!)).toEqual([['Gengar', '2']]);
    // The stage's two sprites are the beats' and never wrapped: the lunge,
    // the recoil and the faint own `.stage__actor .sprite`, and a figure
    // there would put two animations on one transform.
    expect(screen.root.querySelectorAll('.stage__actor .figure')).toHaveLength(0);
    // Two bodies and their two ghosts, all bare images under the actor.
    expect(screen.root.querySelectorAll('.stage__actor img.sprite:not(.sprite--ghost)')).toHaveLength(2);
  });
});

describe('one image factory', () => {
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      return statSync(path).isDirectory() ? walk(path) : path.endsWith('.ts') ? [path] : [];
    });
  }

  it('builds every sprite image in ui/sprites.ts and nowhere else', () => {
    const root = join(process.cwd(), 'src', 'ui');
    const offenders = walk(root)
      .filter((file) => !file.endsWith('sprites.ts'))
      .filter((file) => /el\(\s*'img'|createElement\(\s*'img'|new Image\(/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(process.cwd(), file));
    expect(offenders).toEqual([]);
  });
});
