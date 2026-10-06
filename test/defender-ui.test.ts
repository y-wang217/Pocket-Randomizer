/**
 * Defender Mode v0's surfaces, built to bible Rev 25 (D100 to D103). **Step 7.**
 *
 * Each block asserts one surface against its encoding row and its budget:
 * what is at rest, what is one press away, and that the attacker's version of
 * a shared surface is unchanged. The screens are the existing components;
 * these are the places the mode reaches into them.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';

import { createRun, type RunState } from '../src/core/run';
import { chooseDraftPick, chooseGymType, draftOptions, gymTypeOptions } from '../src/core/defender/opening';
import { flameSlotFor } from '../src/core/defender/badge';
import type { Reward } from '../src/core/rewards';
import type { BattleBadge, Choice, PokemonSpec, RunLog, TeamSpec } from '../src/core/types';
import { createBattle } from '../src/core/battle/driver';
import { buildBattleUiView } from '../src/core/battle/view';
import { abilityEffects } from '../src/data/abilityEffects';
import { createScene } from '../src/ui/scene';
import { DEFENDER_GYM_TYPES, DEFENDER_RANK_LOCALES } from '../src/data/defender';
import { localeById } from '../src/data/locales';
import { BADGE_COPY, CONSUMABLE_COPY } from '../src/data/defenderCopy';
import { TRAINER_CLASS_NAMES } from '../src/data/trainerClassCopy';
import { trainerClass } from '../src/data/trainerClasses';
import { DEFENDER_FEED_COPY, DEFENDER_SCREEN_COPY, MODE_COPY } from '../src/ui/copy/defender';
import { createSeedBar } from '../src/ui/seed-bar';
import { createDecisionFeed } from '../src/ui/decision-feed';
import { renderBadgeTip, renderConsumableTip, renderTradeAskTip, renderTradeOfferTip } from '../src/ui/defender-tips';
import { createGymSelect } from '../src/ui/screens/gym-select';
import { createPartyScreen } from '../src/ui/screens/party';
import { createPreGymScreen } from '../src/ui/screens/pre-gym';
import { renderRewardCard } from '../src/ui/screens/reward';
import { createRunMap } from '../src/ui/screens/run-map';
import { createStarterSelect } from '../src/ui/screens/starter-select';
import { scriptedRunPolicy } from '../src/core/run';
import { greedyAiPolicy } from '../src/core/battle/ai';

/** A defender run past its opening: the gym type `type`, the first of every pick. */
function drafted(seed: string, type: string): RunState {
  let state = chooseGymType(createRun(seed, undefined, 'defender'), DEFENDER_GYM_TYPES.indexOf(type as never));
  while (draftOptions(state).length > 0) state = chooseDraftPick(state, 0);
  return state;
}

/** A spec with a highlight under `type`, from that type's own draft. */
function highlighted(seed: string, type: string): PokemonSpec {
  const state = chooseGymType(createRun(seed, undefined, 'defender'), DEFENDER_GYM_TYPES.indexOf(type as never));
  const spec = draftOptions(state).find((option) => option.highlightSlot !== undefined);
  if (!spec) throw new Error(`no highlighted ${type} draft option on ${seed}`);
  return spec;
}

describe('the gym type select screen (D101)', () => {
  it('draws one card per gym type, in table order, as a type chip and the badge mark', () => {
    const screen = createGymSelect();
    const picks: number[] = [];
    screen.render(gymTypeOptions(), (index) => picks.push(index));

    expect(screen.root.querySelector('.screen__title')?.textContent).toBe(DEFENDER_SCREEN_COPY.gymSelect);
    const cards = [...screen.root.querySelectorAll<HTMLButtonElement>('.gym-type')];
    expect(cards.map((card) => card.dataset['type'])).toEqual([...DEFENDER_GYM_TYPES]);
    for (const card of cards) {
      const type = card.dataset['type']!;
      expect(card.querySelector(`[data-tip="type:${type}"]`), `${type} has no type chip`).not.toBeNull();
      expect(card.querySelector(`[data-tip="badge:${type}"]`), `${type} has no badge mark`).not.toBeNull();
      // Zero words on a card: what the badge does is the mark's press.
      expect(card.textContent?.trim() ?? '', `${type} carries words at rest`).not.toContain(BADGE_COPY[type]!.effect);
      expect(card.dataset['selected'], 'a card is marked before any input (C1)').toBeUndefined();
    }

    cards[1]!.click();
    cards[2]!.click();
    expect(picks).toEqual([1]);
  });

  it('opens what each badge does on the mark\'s press', () => {
    for (const type of DEFENDER_GYM_TYPES) {
      const tip = renderBadgeTip(type);
      expect(tip?.textContent).toContain(BADGE_COPY[type]!.name);
      expect(tip?.textContent).toContain(BADGE_COPY[type]!.effect);
    }
    expect(renderBadgeTip('Water')).toBeNull();
  });
});

describe('the draft and recruit picks (D100)', () => {
  it('reuses the starter card with the pick\'s heading and no blurb', () => {
    const state = chooseGymType(createRun('UI-DRAFT', undefined, 'defender'), 0);
    const screen = createStarterSelect();
    screen.render(draftOptions(state), () => undefined, { title: DEFENDER_SCREEN_COPY.draft, gymType: 'Fire' });
    expect(screen.root.querySelector('.screen__title')?.textContent).toBe(DEFENDER_SCREEN_COPY.draft);
    expect(screen.root.querySelector<HTMLElement>('.screen__blurb')?.hidden).toBe(true);
    expect(screen.root.querySelectorAll('.starter').length).toBe(draftOptions(state).length);

    // And the attacker's screen is the attacker's again on its next render.
    screen.render(createRun('UI-DRAFT').starterOptions, () => undefined);
    expect(screen.root.querySelector('.screen__title')?.textContent).toBe('Choose your starter');
    expect(screen.root.querySelector<HTMLElement>('.screen__blurb')?.hidden).toBe(false);
    expect(screen.root.querySelector('[data-tip="badge:Fire"]')).toBeNull();
  });

  it('marks the Fire badge\'s highlighted slot with the flame, and only under Fire', () => {
    const fire = highlighted('UI-FLAME', 'Fire');
    const screen = createStarterSelect();
    screen.render([fire], () => undefined, { title: DEFENDER_SCREEN_COPY.draft, gymType: 'Fire' });
    const chips = [...screen.root.querySelectorAll<HTMLElement>('.starter__moves .move')];
    const flamed = chips.flatMap((chip, slot) => (chip.querySelector('[data-tip="badge:Fire"]') ? [slot] : []));
    expect(flamed).toEqual([fire.highlightSlot]);
    expect(flameSlotFor(fire, 'Fire')).toBe(fire.highlightSlot);

    // A Psychic or Flying gym draws no flame, whatever the spec carries.
    const psychic = highlighted('UI-FLAME', 'Psychic');
    screen.render([psychic], () => undefined, { title: DEFENDER_SCREEN_COPY.draft, gymType: 'Psychic' });
    expect(screen.root.querySelector('[data-tip="badge:Fire"]')).toBeNull();
    expect(flameSlotFor(psychic, 'Psychic')).toBeNull();
  });
});

describe('the door on the map (D101)', () => {
  it('names each challenger by class and shows its types on the step being chosen from', () => {
    const state = drafted('UI-DOOR', 'Fire');
    const map = createRunMap();
    map.render(state, () => undefined);
    const doors = state.segments[0]!.routes[0]!.steps[0]!.options;
    const current = [...map.root.querySelectorAll<HTMLElement>('.step--current .node')];
    expect(current.length).toBe(doors.length);
    doors.forEach((door, index) => {
      const card = current[index]!;
      const name = card.querySelector('.node__name--class')?.textContent;
      expect(name).toBe(TRAINER_CLASS_NAMES[door.trainerClass!]);
      const types = trainerClass(door.trainerClass!)!.types;
      const chips = [...card.querySelectorAll('.node__types .type')];
      expect(chips.length, `${door.trainerClass} type chips`).toBe(types.length);
    });

    // A boss has no leader: no attacker challenger name anywhere on the map.
    const leader = createRun('UI-DOOR').segments[0]!.leader;
    expect(leader).not.toBe('');
    expect(map.root.textContent).not.toContain(leader);
    expect(map.root.querySelector('.screen__title')?.hasAttribute('data-tip')).toBe(false);
  });

  it('leaves the attacker map with no class names', () => {
    const map = createRunMap();
    const state = createRun('UI-DOOR');
    map.render(state, () => undefined);
    expect(map.root.querySelector('.node__name--class')).toBeNull();
  });
});

describe('the rank\'s region on the map (the defender map backdrops patch)', () => {
  it('stands the graph on the rank\'s map backdrop and names the region without its type chips', () => {
    const state = drafted('UI-DOOR', 'Fire');
    const map = createRunMap();
    map.render(state, () => undefined);
    const locale = state.segments[0]!.routes[0]!.locale;
    expect(locale).toBe(DEFENDER_RANK_LOCALES[0]);
    expect(map.root.querySelector<HTMLElement>('.map-graph')?.dataset['backdrop']).toBe(`map-backdrop:${locale}`);
    const region = map.root.querySelector<HTMLElement>('.map__region');
    expect(region?.hidden).toBe(false);
    expect(region?.querySelector('.map__region-name')?.textContent).toBe(localeById(locale!).name);
    // The chips say what a region's wild nodes hold; a door's challengers come from their class.
    expect(region?.querySelectorAll('.type').length).toBe(0);
  });

  it('keeps the attacker heading\'s four type chips', () => {
    const run = createRun('UI-DOOR');
    const state = { ...run, localeChoices: run.localeChoices.map((_, index) => (index === 0 ? 0 : null)) };
    const map = createRunMap();
    map.render(state, () => undefined);
    const region = map.root.querySelector<HTMLElement>('.map__region');
    expect(region?.hidden).toBe(false);
    expect(region?.querySelectorAll('.type').length).toBe(4);
  });
});

describe('the pre-gym screen for a defender boss (D101)', () => {
  it('shows the team size beside the gym mark and the level, with no leader and no type chip', () => {
    const state = drafted('UI-BOSS', 'Psychic');
    const segment = state.segments[0]!;
    const team = segment.gym.encounter!.team;
    const screen = createPreGymScreen();
    screen.render(
      {
        gym: segment.gymDefinition,
        leader: '',
        segment: 0,
        party: state.party,
        holding: state.party.map(() => null),
        tuning: state.tuning,
        boss: { size: team.length, level: team[0]!.level },
      },
      { onLead: () => undefined, onManageParty: () => undefined },
    );
    const title = screen.root.querySelector('.screen__title')!;
    expect(title.querySelector('[data-tip="node:gym"]')).not.toBeNull();
    expect(title.querySelector('.pre-gym__size')?.textContent).toBe(String(team.length));
    // The type chip's slot left the heading with D105 (the challenger has no
    // type), so the level sits beside the title in its place.
    expect(screen.root.querySelector('.pre-gym__header .panel__level')?.textContent).toContain(String(team[0]!.level));
    expect(screen.root.querySelector('.pre-gym__header .type')).toBeNull();
    expect(screen.root.querySelector('.pre-gym__type')).toBeNull();
  });
});

describe('the reward card faces (D102)', () => {
  it('draws a consumable as its sprite, with the name and effect on the press', () => {
    const state = drafted('UI-REWARD', 'Fire');
    const card = renderRewardCard({ kind: 'consumable', id: 'superpotion' }, state, () => undefined);
    const sprite = card.querySelector<HTMLElement>('.reward__sprite');
    expect(sprite?.dataset['tip']).toBe('consumable:superpotion');
    expect(card.textContent).not.toContain('Super Potion');
    expect(card.textContent).not.toContain(CONSUMABLE_COPY['superpotion']);
    const tip = renderConsumableTip('superpotion');
    expect(tip?.textContent).toContain('Super Potion');
    expect(tip?.textContent).toContain(CONSUMABLE_COPY['superpotion']);
  });

  it('draws a trade as two sprites and two species names, each opening its own card', () => {
    const state = drafted('UI-TRADE', 'Flying');
    const asked = state.party[1]!;
    const offered = highlighted('UI-TRADE-OFFER', 'Flying');
    const trade: Reward = { kind: 'trade', offers: { Flying: offered }, selector: 0, offered, requested: asked.acquired! };
    const card = renderRewardCard(trade, state, () => undefined);

    const sides = [...card.querySelectorAll<HTMLElement>('.reward__trade-side')];
    expect(sides.map((side) => side.querySelector('.reward__trade-name')?.textContent)).toEqual([offered.species, asked.spec.species]);
    expect(sides.map((side) => side.querySelector('img.sprite')?.getAttribute('alt'))).toEqual([offered.species, asked.spec.species]);
    expect(card.getAttribute('aria-label')).toBe(DEFENDER_SCREEN_COPY.tradeLabel(offered.species, asked.spec.species));

    const [offerTip, askTip] = sides.map((side) => side.dataset['tip']!);
    expect(offerTip).toMatch(/^trade-offer:/);
    expect(askTip).toMatch(/^trade-ask:/);
    // The offered mon's starter card, with its moves; the member's party row.
    const offer = renderTradeOfferTip(offerTip!.slice('trade-offer:'.length));
    expect(offer?.querySelector('.starter')).not.toBeNull();
    expect(offer?.querySelectorAll('.starter__moves .move').length).toBe(offered.moves.length);
    const ask = renderTradeAskTip(askTip!.slice('trade-ask:'.length));
    expect(ask?.textContent).toContain(asked.spec.species);
  });
});

describe('the Bag\'s consumables (D102)', () => {
  function bag(state: RunState, canConsume: boolean, consumed: [string, number][] = []): HTMLElement {
    const screen = createPartyScreen();
    screen.render(
      {
        party: state.party,
        backpack: [],
        tms: [],
        teachable: new Set(),
        relics: [],
        tuning: state.tuning,
        slots: state.party.length,
        backTo: 'Back',
        plan: null,
        focus: 'bag',
        consumables: state.consumables ?? [],
        canConsume,
      },
      {
        onReorder: () => undefined,
        onRelease: () => undefined,
        onPlan: () => undefined,
        onTeach: () => undefined,
        onConsume: (id, slot) => consumed.push([id, slot]),
        onDone: () => undefined,
      },
    );
    return screen.root;
  }

  it('lists each consumable at rest with its name and effect line', () => {
    const state = { ...drafted('UI-BAG', 'Fire'), consumables: ['potion', 'hyperpotion'] };
    const root = bag(state, true);
    const rows = [...root.querySelectorAll('.consumables__item')];
    expect(rows.map((row) => row.querySelector('.backpack__name')?.textContent)).toEqual(['Potion', 'Hyper Potion']);
    expect(rows.map((row) => row.querySelector('.backpack__effect')?.textContent)).toEqual([CONSUMABLE_COPY['potion'], CONSUMABLE_COPY['hyperpotion']]);
  });

  it('uses one by two taps, the item then a member, and refuses a full-HP member loudly', () => {
    const fresh = drafted('UI-BAG', 'Fire');
    const party = fresh.party.map((member, slot) => (slot === 1 ? { ...member, hp: 1 } : member));
    const state = { ...fresh, party, consumables: ['potion'] };
    const consumed: [string, number][] = [];
    const root = bag(state, true, consumed);

    root.querySelector<HTMLButtonElement>('.consumables__item .backpack__pick')!.click();
    const members = [...root.querySelectorAll<HTMLElement>('.held__item')];
    // Slot 0 is at full HP: dimmed, and saying why.
    expect(members[0]!.dataset['refused']).toBe('true');
    expect(members[0]!.querySelector<HTMLButtonElement>('.held__pick')!.disabled).toBe(true);
    expect(members[0]!.textContent).toContain('full HP');
    expect(members[1]!.dataset['refused']).toBeUndefined();

    members[1]!.querySelector<HTMLButtonElement>('.held__pick')!.click();
    expect(consumed).toEqual([['potion', 1]]);
  });

  it('dims the pick where the run refuses a use, and lists nothing in an attacker Bag', () => {
    const state = { ...drafted('UI-BAG', 'Fire'), consumables: ['potion'] };
    const root = bag(state, false);
    expect(root.querySelector<HTMLButtonElement>('.consumables__item .backpack__pick')!.disabled).toBe(true);

    const attacker = createRun('UI-BAG');
    const plain = bag({ ...attacker, party: drafted('UI-BAG', 'Fire').party }, true);
    expect(plain.querySelector<HTMLElement>('.consumables')?.hidden).toBe(true);
  });
});

describe('the decision feed (R11)', () => {
  it('names every defender decision it records', async () => {
    const base = scriptedRunPolicy(greedyAiPolicy);
    const feed = createDecisionFeed(base);
    const state = createRun('UI-FEED', undefined, 'defender');
    await feed.policy.chooseGymType!(gymTypeOptions(), state);
    const typed = chooseGymType(state, 0);
    const offered = draftOptions(typed);
    await feed.policy.chooseDraftPick!(offered, typed);
    const after = drafted('UI-FEED', DEFENDER_GYM_TYPES[0]!);
    const doors = after.segments[0]!.routes[0]!.steps[0]!.options;
    await feed.policy.chooseDoor!(doors, after);
    await feed.policy.chooseRecruit!(offered, after);
    feed.record({
      decisions: [
        { kind: 'gymType', index: 0 },
        { kind: 'draft', index: 0 },
        { kind: 'door', index: 1 },
        { kind: 'recruit', index: 2 },
        { kind: 'party', edit: { kind: 'consume', id: 'potion', slot: 0 } },
      ],
    } as unknown as RunLog);

    expect(feed.entries().map((entry) => entry.text)).toEqual([
      DEFENDER_FEED_COPY.gymType(DEFENDER_GYM_TYPES[0]!),
      DEFENDER_FEED_COPY.draft(offered[0]!.species),
      DEFENDER_FEED_COPY.door(TRAINER_CLASS_NAMES[doors[1]!.trainerClass!]!),
      DEFENDER_FEED_COPY.recruit(offered[2]!.species),
      DEFENDER_FEED_COPY.consume('Potion', after.party[0]!.spec.species),
    ]);
    // A defender segment's heading has no leader to name.
    expect(feed.entries().every((entry) => entry.leader === '')).toBe(true);
  });
});

describe('the battle surfaces (D100, D103)', () => {
  const REVEAL = { ability: true, item: true, teamSize: true };
  const FOE: TeamSpec = [{ species: 'Rattata', ability: 'Run Away', moves: ['Tackle', 'Quick Attack'], level: 20 }];

  function scene(team: TeamSpec, badge: BattleBadge, intent?: Choice) {
    const session = createBattle({ teams: { p1: team, p2: FOE }, seed: 'UI-BADGE', badge });
    if (intent) session.revealFoeIntent(intent);
    const ui = buildBattleUiView(session.factsFor('p1'), REVEAL, abilityEffects);
    const built = createScene();
    built.update(ui, () => undefined);
    return { root: built.root, ui };
  }

  it('puts the flame and the next use\'s crit chance on the Fire badge\'s highlighted button only', () => {
    const team: TeamSpec = [{ species: 'Charmander', ability: 'Blaze', moves: ['Ember', 'Scratch', 'Growl', 'Smokescreen'], level: 20 }];
    const { root } = scene(team, { gymType: 'Fire', members: [{ highlight: 'ember', fifthMove: null }] });
    const buttons = [...root.querySelectorAll<HTMLElement>('.moves .move')];
    const flamed = buttons.filter((button) => button.querySelector('.move__badge--flame'));
    // The name's own text: the badge sits beside it, as the priority chevron does.
    expect(flamed.map((button) => button.querySelector('.move__name')?.firstChild?.textContent)).toEqual(['Ember']);
    // Stage 1 on the first use: Gen 9's 1/8, floored, as D100 writes it.
    expect(flamed[0]!.querySelector('.move__crit')?.textContent).toBe('12');
    expect(flamed[0]!.querySelector('[data-tip="badge:Fire"]')).not.toBeNull();
  });

  it('mounts the Flying badge\'s fifth move as a fifth battle button, marked with the wing', () => {
    const team: TeamSpec = [{ species: 'Pidgey', ability: 'Keen Eye', moves: ['Gust', 'Tackle', 'Sand Attack', 'Growl'], level: 20 }];
    const { root } = scene(team, { gymType: 'Flying', members: [{ highlight: null, fifthMove: 'Peck' }] });
    const buttons = [...root.querySelectorAll<HTMLElement>('.moves .move')];
    expect(buttons.length).toBe(5);
    const fifth = buttons.find((button) => button.dataset['badgeMove'] === 'true');
    expect(fifth?.querySelector('.move__name')?.firstChild?.textContent).toBe('Peck');
    expect(fifth?.querySelector('[data-tip="badge:Flying"]')).not.toBeNull();
    // The Speed cell carries the engine's number and the wing (D98, D100).
    expect(root.querySelector('[data-tip="badge:Flying"]:not(.move *)')).not.toBeNull();
  });

  it('shows the Psychic badge\'s revealed move beside the eye on the opposing panel', () => {
    const team: TeamSpec = [{ species: 'Abra', ability: 'Synchronize', moves: ['Confusion', 'Tackle'], level: 20 }];
    const { root, ui } = scene(team, { gymType: 'Psychic', members: [{ highlight: null, fifthMove: null }] }, { kind: 'move', slot: 2 });
    expect(ui.foeIntent).toMatchObject({ kind: 'move', move: 'Quick Attack' });
    const intent = root.querySelector<HTMLElement>('.panel__intent');
    expect(intent?.querySelector('[data-tip="badge:Psychic"]')).not.toBeNull();
    expect(intent?.querySelector('.move__name')?.textContent).toBe('Quick Attack');

    // And nothing at all without the badge (R4).
    const plain = scene(team, { gymType: 'Fire', members: [null] });
    expect(plain.root.querySelector('.panel__intent')?.childElementCount ?? 0).toBe(0);
  });
});

describe('the mode choice (D101)', () => {
  it('is two controls, one word each, attacker by default', () => {
    const bar = createSeedBar();
    const modes = [...bar.root.querySelectorAll<HTMLButtonElement>('.seedbar__mode')];
    expect(modes.map((button) => button.textContent)).toEqual([MODE_COPY.attacker, MODE_COPY.defender]);
    expect(bar.mode()).toBe('attacker');
    expect(modes.map((button) => button.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    modes[1]!.click();
    expect(bar.mode()).toBe('defender');
    expect(modes.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
  });
});
