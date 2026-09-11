/**
 * @vitest-environment jsdom
 *
 * Species stays the label. **Patch 4.8.0.1.**
 *
 * Stage 4.8 named every Pokemon a run offers and rendered the name in place of
 * the species on every surface that names one. The ruling on this patch's
 * report reversed the display: species is the identity on every label, the
 * nickname is state the screens do not show, and the battle text is relabelled
 * to match. The name is still drawn, still on the spec, still the sim's battle
 * name — none of that is touched — which is why this file asserts what is
 * *rendered* and never what is stored.
 *
 * One test per surface, each with a nicknamed member and one without, as the
 * prompt asks. The nicknames here are chosen so a leak is unmistakable: no
 * species is called Bramble.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { createBattle, describeMove, type BattleSession } from '../src/core/battle/driver';
import type { NodeSpec } from '../src/core/encounters';
import { deathsFrom } from '../src/core/graveyard';
import { createParty } from '../src/core/party';
import { chooseStarter, createRun, playRun, scriptedRunPolicy, type BattleReview, type RunResult, type RunState } from '../src/core/run';
import type { Choice, PokemonSpec, TeamSpec } from '../src/core/types';
import { gymForSegment } from '../src/data/gyms';
import { partyCapacityAfter } from '../src/data/partyTuning';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { deathLine, shareText, type ShareView } from '../src/ui/copy/share';
import { createDrawer } from '../src/ui/drawer';
import { memberCardContents } from '../src/ui/member-card';
import { renderCaptureOffer } from '../src/ui/screens/acquisition';
import { createBattleScreen } from '../src/ui/screens/battle';
import { createItemTargetScreen } from '../src/ui/screens/item-target';
import { createMoveReplaceScreen } from '../src/ui/screens/move-replace';
import { createPartyScreen } from '../src/ui/screens/party';
import { createPreGymScreen } from '../src/ui/screens/pre-gym';
import { createResultScreen } from '../src/ui/screens/result';
import { createRunMap } from '../src/ui/screens/run-map';
import { createStarterSelect } from '../src/ui/screens/starter-select';
import { createSummary } from '../src/ui/screens/summary';
import { createSpeciesIndex } from '../src/ui/species-index';
import { scoreRun } from '../src/core/scoring';

const NAMED: PokemonSpec = {
  species: 'Snorlax',
  nickname: 'Bramble',
  ability: 'Thick Fat',
  moves: ['Body Slam', 'Rest', 'Yawn', 'Curse'],
  level: 50,
};
const PLAIN: PokemonSpec = { species: 'Gengar', ability: 'Levitate', moves: ['Shadow Ball'], level: 50 };
const PLAYER: TeamSpec = [NAMED, PLAIN];
/*
 * The opponent carries a nickname *on purpose*. Generation never gives one
 * (`test/nicknames-graveyard.test.ts`), so the only way to prove the foe panel
 * reads species by construction rather than by luck is to hand the sim a foe
 * that has a name and watch the panel ignore it.
 */
const FOE: TeamSpec = [{ species: 'Golem', nickname: 'Pebble', ability: 'Sturdy', moves: ['Tackle'], level: 50 }];
const NICKNAMES = ['Bramble', 'Pebble'];

function nodeFor(seed: string): NodeSpec {
  return {
    id: 's1-1-0',
    kind: 'battle',
    tier: 'normal',
    label: 'A fight',
    encounter: { team: FOE, opponent: 'A trainer', simSeed: seed as never },
    rewards: [],
  } as unknown as NodeSpec;
}

function turn(session: BattleSession, slot = 1): void {
  for (const side of ['p1', 'p2'] as const) {
    if (session.viewFor(side).awaitingChoice) session.submit(side, { kind: 'move', slot } as Choice);
  }
}

function texts(root: ParentNode, selector: string): string[] {
  return [...root.querySelectorAll(selector)].map((node) => node.textContent ?? '');
}

/** The whole of a surface's text carries no nickname, anywhere. */
function noNickname(root: HTMLElement, surface: string): void {
  const text = root.textContent ?? '';
  for (const name of NICKNAMES) expect(text, `${surface} rendered the nickname ${name}`).not.toContain(name);
}

describe('the battle screen', () => {
  function mount(seed: string) {
    const session = createBattle({ teams: { p1: PLAYER, p2: FOE }, seed });
    const screen = createBattleScreen();
    document.body.replaceChildren(screen.root);
    screen.attach(session, nodeFor(seed), { ability: true, item: true }, () => {});
    turn(session);
    return { session, screen };
  }

  it('1. names both panels by species, the nicknamed member and the plain foe alike', () => {
    const { screen } = mount('LABEL01');
    expect(screen.root.querySelector('.panel--me .panel__name')?.textContent).toBe('Snorlax');
    expect(screen.root.querySelector('.panel--foe .panel__name')?.textContent).toBe('Opposing Golem');
  });

  it('2. renders no nickname on the opponent panel even when the sim was handed one', () => {
    const { session, screen } = mount('LABEL02');
    // The sim did receive it: the protocol names the foe by it.
    expect(session.protocolFor('p1').some((line) => line.includes('p2a: Pebble'))).toBe(true);
    expect(screen.root.querySelector('.panel--foe')?.textContent).not.toContain('Pebble');
  });

  it('names the bench by species, for the member with no nickname too', () => {
    const { screen } = mount('LABEL03');
    expect(texts(screen.root, '.bench__name')).toEqual(['Gengar']);
  });

  it('says who acted by species on the strip and in the history sheet', () => {
    const { screen } = mount('LABEL04');
    const event = screen.root.querySelector('.flags__event')?.textContent ?? '';
    expect(event).toMatch(/^(Snorlax|Opposing Golem) used /);
    const log = texts(screen.root, '.log-entry');
    expect(log.length).toBeGreaterThan(0);
    expect(log.some((line) => line.includes('Snorlax'))).toBe(true);
    noNickname(screen.root, 'the battle screen');
  });
});

describe('the species index', () => {
  it('rewrites every identifier that carries a learned name, and nothing else', () => {
    const names = createSpeciesIndex();
    const line = '|switch|p1a: Bramble|Snorlax, L50, M|100/100';
    // A name is not known until its switch line has been seen.
    expect(names.relabel('|move|p1a: Bramble|Body Slam|p2a: Golem')).toBe('|move|p1a: Bramble|Body Slam|p2a: Golem');
    names.observe(line);
    expect(names.relabel(line)).toBe('|switch|p1a: Snorlax|Snorlax, L50, M|100/100');
    expect(names.relabel('|move|p1a: Bramble|Body Slam|p2a: Golem')).toBe('|move|p1a: Snorlax|Body Slam|p2a: Golem');
    expect(names.relabel('|-damage|p2a: Golem|10/100|[from] item: Rocky Helmet|[of] p1a: Bramble')).toBe(
      '|-damage|p2a: Golem|10/100|[from] item: Rocky Helmet|[of] p1a: Snorlax',
    );
    // Keyed by side: the same name on the other side is a different Pokemon.
    expect(names.relabel('|faint|p2a: Bramble')).toBe('|faint|p2a: Bramble');
    // A move called what a Pokemon is called is not an identifier.
    expect(names.relabel('|move|p2a: Golem|Bramble|p1a: Bramble')).toBe('|move|p2a: Golem|Bramble|p1a: Snorlax');
  });
});

describe('the party surfaces', () => {
  const party = () => createParty([NAMED, PLAIN]);

  it('member card: species in the header, so the drawer, party and pre-gym screens inherit it', () => {
    const [named, plain] = party();
    const first = memberCardContents(named!, { holding: null, tuning: DEFAULT_TUNING });
    const second = memberCardContents(plain!, { holding: null, tuning: DEFAULT_TUNING });
    expect(first.querySelector('.panel__name')?.textContent).toBe('Snorlax');
    expect(second.querySelector('.panel__name')?.textContent).toBe('Gengar');
    noNickname(first, 'the member card');
  });

  it('party drawer', () => {
    const drawer = createDrawer();
    const members = party();
    drawer.open({ party: members, holding: members.map(() => null), relics: [], tuning: DEFAULT_TUNING });
    expect(texts(drawer.root, '.panel__name')).toEqual(['Snorlax', 'Gengar']);
    noNickname(drawer.root, 'the party drawer');
  });

  it('party management: cards, slot labels, the release confirm and the give buttons', () => {
    const screen = createPartyScreen();
    document.body.replaceChildren(screen.root);
    screen.render(
      { party: party(), backpack: ['oranberry'], relics: [], tuning: DEFAULT_TUNING, slots: partyCapacityAfter(0), backTo: 'Back', plan: null },
      { onReorder: () => undefined, onRelease: () => undefined, onPlan: () => undefined, onDone: () => undefined },
    );
    expect(texts(screen.root, '.panel__name')).toEqual(['Snorlax', 'Gengar']);
    expect(texts(screen.root, '.slot__label').slice(0, 2)).toEqual(['Snorlax', 'Gengar']);
    noNickname(screen.root, 'the party screen');
    (screen.root.querySelector('.party__release') as HTMLButtonElement | null)?.click();
    noNickname(document.body, 'the release confirm');
  });

  it('pre-gym: the members and the send-in control', () => {
    const screen = createPreGymScreen();
    const members = party();
    screen.render(
      { gym: gymForSegment(0), segment: 0, party: members, holding: members.map(() => null), tuning: DEFAULT_TUNING },
      { onLead: () => undefined, onManageParty: () => undefined },
    );
    expect(texts(screen.root, '.panel__name')).toEqual(['Snorlax', 'Gengar']);
    expect(screen.root.textContent).toContain('Send Snorlax in');
    noNickname(screen.root, 'the pre-gym screen');
  });

  it('recipient screen', () => {
    const screen = createItemTargetScreen();
    screen.render({ kind: 'tm', move: 'Ice Beam' }, party(), () => undefined);
    expect(texts(screen.root, '.panel__name')).toEqual(['Snorlax', 'Gengar']);
    noNickname(screen.root, 'the recipient screen');
  });

  it('replacement screen: the title and the owner line', () => {
    const screen = createMoveReplaceScreen();
    const incoming = describeMove('Ice Beam');
    if (!incoming) throw new Error('Ice Beam is not in the dex');
    for (const [member, species] of [[party()[0], 'Snorlax'], [party()[1], 'Gengar']] as const) {
      screen.render(member!, incoming, () => undefined, DEFAULT_TUNING);
      expect(screen.root.querySelector('.replace__title, h2')?.textContent).toContain(`${species} learns Ice Beam`);
      expect(screen.root.querySelector('.panel__name')?.textContent).toBe(species);
      noNickname(screen.root, 'the replacement screen');
    }
  });

  it('capture card: the offered Pokemon and the members it would replace', () => {
    const root = renderCaptureOffer({ nodeId: 's1-1-0', source: 'encounter', spec: { ...NAMED, nickname: 'Pebble' } }, party(), () => undefined, 2);
    expect(texts(root, '.panel__name')[0]).toBe('Snorlax');
    noNickname(root, 'the capture card');
  });

  it('starter select', () => {
    const screen = createStarterSelect();
    screen.render([NAMED, PLAIN], () => undefined);
    expect(texts(screen.root, '.starter__name')).toEqual(['Snorlax', 'Gengar']);
    noNickname(screen.root, 'the starter select');
  });

  it('map party cards, on a generated run whose starter carries a drawn name', () => {
    const state = chooseStarter(createRun('LABEL-MAP', DEFAULT_TUNING), 0);
    const starter = state.party[0]!;
    expect(starter.spec.nickname, 'generation names the starter').toBeDefined();
    const map = createRunMap();
    map.render(state, () => undefined, () => undefined);
    expect(texts(map.root, '.panel__name')[0]).toBe(starter.spec.species);
    expect(map.root.textContent).not.toContain(starter.spec.nickname!);
  });
});

describe('the result screens and the share text', () => {
  let result: RunResult;
  let review: BattleReview | null = null;
  let reviewed: RunState | null = null;

  beforeAll(async () => {
    result = await playRun(
      'LABEL-RESULT',
      {
        ...scriptedRunPolicy(greedyAiPolicy),
        reviewBattle: async (each, state) => {
          if (!review) {
            review = each;
            reviewed = state;
          }
          return null;
        },
      },
      DEFAULT_TUNING,
    );
  }, 240_000);

  it('node result: the party strip after a fight', () => {
    if (!review || !reviewed) throw new Error('no battle was reviewed');
    const screen = createResultScreen();
    screen.render(review, null, reviewed, () => undefined);
    const labels = texts(screen.root, '.slot__label');
    expect(labels.length).toBeGreaterThan(0);
    for (const [index, label] of labels.entries()) expect(label).toBe(review.party[index]?.spec.species);
    for (const member of review.party) if (member.spec.nickname) expect(screen.root.textContent).not.toContain(member.spec.nickname);
  });

  it('run summary: the final party by species, and the graveyard by species', () => {
    const summary = createSummary();
    summary.render(result);
    const names = texts(summary.root, '.summary__team .starter__name');
    expect(names).toEqual(result.state.party.map((member) => member.spec.species));
    for (const member of result.state.party) {
      if (member.spec.nickname) expect(summary.root.textContent).not.toContain(member.spec.nickname);
    }
    const deaths = deathsFrom(result.state);
    const rows = texts(summary.root, '.summary__grave-row');
    expect(rows).toHaveLength(deaths.length);
    rows.forEach((row, index) => expect(row.startsWith(deaths[index]!.species)).toBe(true));
  });

  it('share text: every party and graveyard line opens with the species', () => {
    const view: ShareView = {
      seed: 'LABEL-RESULT',
      outcome: 'defeat',
      gymsCleared: 1,
      gymTotal: 8,
      score: scoreRun(result.state),
      party: [{ species: 'Charmander', level: 40 }],
      deaths: [
        { nickname: 'Bramble', species: 'Weepinbell', level: 31, segment: 2, nodeKind: 'gym', nodeId: 's2-gym', bySpecies: 'Arcanine', byMove: 'Flare Blitz', indirect: null },
      ],
      relics: [],
      locales: [],
    };
    const text = shareText(view);
    expect(text).toContain('· Charmander, Lv40');
    expect(text).toContain('· Weepinbell, Lv31, fell at Gym 3 to Arcanine, Flare Blitz.');
    expect(text).not.toContain('Bramble');
    expect(deathLine(view.deaths[0]!)).toBe('Weepinbell, Lv31, fell at Gym 3 to Arcanine, Flare Blitz.');
  });
});
