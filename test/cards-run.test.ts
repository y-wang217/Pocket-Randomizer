/**
 * The card run (`docs/spec/gymrun-card-run-prompt.md`, `docs/generation.md`
 * 125r): its shape, its draws, its prices, its rewards, the engine's loadout,
 * and a whole run played headless.
 */
import { describe, expect, it } from 'vitest';

import { CARDS, DECKS, UPGRADE_OF } from '../src/cardData/cards';
import { ACTS, EVENTS, MARKET, RUN_RULES, TOWN_POOL } from '../src/cardData/cardrunTables';
import { ENCOUNTERS } from '../src/cardData/encounters';
import { UNITS } from '../src/cardData/units';
import { createBattle, layoutBattle } from '../src/core/cards/create';
import { guardBot } from '../src/core/cards/guard';
import { replay } from '../src/core/cards/log';
import { newLog } from '../src/core/cards/log';
import { select } from '../src/core/cards/plan';
import {
  CARD_RUN_VERSION,
  createRun,
  currentStop,
  eventOptionOpen,
  generateRun,
  replayRun,
  stepRun,
  upgradable,
  type CardRunState,
  type RunAction,
  type StopNode,
} from '../src/core/cards/cardrun';
import { playRunBot } from '../src/core/cards/cardrunBot';
import { step } from '../src/core/cards/step';
import type { BattleState } from '../src/core/cards/state';
import { viewOf } from '../src/core/cards/view';

/** Step or fail the test, naming the refusal. */
function go(s: CardRunState, action: RunAction): CardRunState {
  const result = stepRun(s, action);
  if (!result.ok) throw new Error(`${JSON.stringify(action)} refused: ${result.reason} ${result.battleReason ?? ''}`);
  return result.state;
}

/** Win the battle the run is on with the guard bot; returns the run after, and the battle's last state. */
function winBattle(s: CardRunState): { run: CardRunState; last: BattleState } {
  const bot = guardBot();
  let run = s;
  for (let i = 0; i < 2000; i++) {
    const battle = run.battle!.state;
    const action = bot(battle)!;
    const after = step(battle, action);
    run = go(run, { type: 'battle', action });
    if (run.screen.k !== 'battle' || run.battle?.encounter !== s.battle!.encounter) {
      if (!after.ok || after.state.phase !== 'won') throw new Error(`the battle did not end in a win: ${after.ok ? after.state.phase : after.reason}`);
      return { run, last: after.state };
    }
  }
  throw new Error('the battle did not end');
}

/** A run on its first stop, the first fight won. */
function atFirstStop(seed: string): CardRunState {
  const run = winBattle(createRun(seed)).run;
  expect(run.screen.k).toBe('route');
  return run;
}

describe('card run: shape and draws', () => {
  it('stitches three acts of fight, stop, fight, stop, boss, with a stop between acts and none after the last boss', () => {
    const nodes = generateRun('SHAPE');
    expect(nodes.map((n) => (n.kind === 'fight' ? (n.boss ? 'B' : 'F') : 'S')).join('')).toBe('FSFSBS' + 'FSFSBS' + 'FSFSB');
    const fights = nodes.filter((n) => n.kind === 'fight');
    // Every third fight is a boss.
    expect(fights.map((n) => n.kind === 'fight' && n.boss)).toEqual([false, false, true, false, false, true, false, false, true]);
    expect(fights.map((n) => n.kind === 'fight' && n.encounter)).toEqual(ACTS.flatMap((a) => [...a.fights, a.boss]));
    // The last boss is Siege, and its fall ends the run: no upgrade offered after it.
    const last = nodes.at(-1)!;
    expect(last.kind === 'fight' && [last.encounter, last.boosts.length]).toEqual(['siege', 0]);
  });

  it('uses every scenario the sandbox has, and every encounter it names exists', () => {
    const named = ACTS.flatMap((a) => [...a.fights, a.boss, ...a.townQuests, ...a.defenseQuests]);
    for (const id of named) expect(Object.hasOwn(ENCOUNTERS, id), id).toBe(true);
    for (const id of ['skirmish', 'test', 'staggered', 'turret-alley', 'wall-and-gun', 'the-pack', 'siege']) expect(named, id).toContain(id);
  });

  it('is a function of the seed: the same seed draws the same run, another seed another', () => {
    expect(generateRun('SAME')).toEqual(generateRun('SAME'));
    expect(JSON.stringify(generateRun('SAME'))).not.toBe(JSON.stringify(generateRun('OTHER')));
  });

  it('offers exactly three distinct options at every offer, and draws each from its pool', () => {
    for (const seed of ['O1', 'O2', 'O3', 'O4']) {
      for (const node of generateRun(seed)) {
        if (node.kind === 'fight') {
          if (node.boosts.length) expect(new Set(node.boosts.map((b) => `${b.unit}/${b.kind}`)).size).toBe(3);
          continue;
        }
        for (const offer of [node.town.offer, node.wild.offer, node.city.market.map((m) => m.card)]) {
          expect(offer).toHaveLength(RUN_RULES.offer);
          expect(new Set(offer).size).toBe(RUN_RULES.offer);
        }
        for (const card of [...node.town.offer, ...node.wild.offer, node.wild.card]) expect(TOWN_POOL).toContain(card);
        for (const { card, price } of node.city.market) expect(MARKET[card]).toBe(price);
        expect(Object.keys(MARKET)).toContain(node.wild.equipment);
      }
    }
  });

  it('pays enough in every Wild for one upgrade, and rolls a ? event in some Wilds and not others', () => {
    const stops = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'].flatMap((seed) => generateRun(seed).filter((n): n is StopNode => n.kind === 'stop'));
    for (const stop of stops) expect(stop.wild.supplies).toBeGreaterThanOrEqual(RUN_RULES.upgradePrice);
    expect(stops.some((s) => s.wild.event)).toBe(true);
    expect(stops.some((s) => !s.wild.event)).toBe(true);
  });

  it('draws nothing on a decision: whatever stop the player picks, every node is what generation drew', () => {
    const viaTown = go(atFirstStop('ISO'), { type: 'go', to: 'town' });
    const viaWild = go(atFirstStop('ISO'), { type: 'go', to: 'wild' });
    expect(viaTown.nodes).toEqual(generateRun('ISO'));
    expect(viaWild.nodes).toEqual(generateRun('ISO'));
  });
});

describe('card run: the battle loadout', () => {
  it('deals the loadout deck and boosts the units, and refuses a card it does not know', () => {
    const state = layoutBattle('test', 'LOAD', { cards: ['shoot+', 'ration', 'move'], units: { A: { slots: 1, hp: 2, baseShield: 1, mp: 1 } } })!;
    expect(Object.values(state.cards).map((c) => c.def)).toEqual(['shoot+', 'ration', 'move']);
    const a = state.units.find((u) => u.id === 'A')!;
    expect([a.maxHp, a.hp, a.baseShield, a.mp]).toEqual([UNITS.A.hp + 2, UNITS.A.hp + 2, UNITS.A.baseShield + 1, 1]);
    expect(viewOf(state).units.find((u) => u.id === 'A')!.slots).toBe(2);
    expect(layoutBattle('test', 'LOAD', { cards: ['no-such-card'] })).toBeNull();
  });

  it('lets a unit with an extra slot play one more card in a turn', () => {
    const deck = ['ration', 'flare', 'move', 'dig-in', 'attack'];
    const plain = createBattle('test', 'SLOT', { cards: deck });
    const boosted = createBattle('test', 'SLOT', { cards: deck, units: { A: { slots: 1 } } });
    if (!plain.ok || !boosted.ok) throw new Error('no battle');
    const play = (state: BattleState) => {
      const started = step(state, { type: 'start' });
      if (!started.ok) throw new Error('no start');
      const first = select(started.state, { type: 'select', card: 'c0', unit: 'A' });
      if (!first.ok) throw new Error(`first refused: ${first.reason}`);
      return select(first.state, { type: 'select', card: 'c1', unit: 'A' });
    };
    expect(play(plain.state)).toMatchObject({ ok: false, reason: 'noSlot' });
    expect(play(boosted.state).ok).toBe(true);
  });

  it('replays a battle log that carries a loadout', () => {
    const loadout = { cards: [...DECKS['puppeteer']!.cards, 'ration'], units: { C: { hp: 1 } } };
    const created = createBattle('test', 'LOG', loadout);
    if (!created.ok) throw new Error('no battle');
    const log = newLog('LOG', 'test', 'puppeteer', loadout);
    let state = created.state;
    const bot = guardBot();
    for (let i = 0; i < 40 && (state.phase === 'deploy' || state.phase === 'plan'); i++) {
      const action = bot(state)!;
      const result = step(state, action);
      if (!result.ok) throw new Error(result.reason);
      log.actions.push(action);
      state = result.state;
    }
    expect(replay(log).state).toEqual(state);
  });
});

describe('card run: stops and rewards', () => {
  it('pays supplies for a main fight and opens the first stop', () => {
    const run = atFirstStop('PAY');
    expect(run.supplies).toBe(RUN_RULES.supplies.start + RUN_RULES.supplies.fight);
    expect(run.stats.fights).toBe(1);
  });

  it('Town: a quest battle, then its supplies and one of three new cards', () => {
    let run = go(atFirstStop('TOWN'), { type: 'go', to: 'town' });
    const stop = currentStop(run)!;
    expect([run.screen.k, run.battle?.encounter]).toEqual(['battle', stop.town.quest.encounter]);
    const before = run.supplies;
    run = winBattle(run).run;
    expect(run.screen).toEqual({ k: 'cards', offer: stop.town.offer, source: 'town' });
    expect(run.supplies).toBe(before + stop.town.supplies);
    const deck = run.deck.length;
    run = go(run, { type: 'pick', index: 2 });
    expect(run.deck.at(-1)).toBe(stop.town.offer[2]);
    expect(run.deck).toHaveLength(deck + 1);
    // On to the next fight.
    expect([run.screen.k, run.battle?.encounter]).toEqual(['battle', ACTS[0]!.fights[1]]);
  });

  it('City defense quest: a battle, then a free upgrade of the card the player picks', () => {
    let run = go(go(atFirstStop('DEF'), { type: 'go', to: 'city' }), { type: 'defend' });
    expect(run.battle?.encounter).toBe(currentStop(run)!.city.defense.encounter);
    run = winBattle(run).run;
    expect(run.screen).toEqual({ k: 'upgrade', source: 'defense' });
    const supplies = run.supplies;
    const index = run.deck.indexOf('slash');
    run = go(run, { type: 'upgrade', index });
    expect(run.deck[index]).toBe('slash+');
    expect(run.supplies).toBe(supplies);
  });

  it('City market: a stated price is charged, or the item cannot be bought, and nothing changes', () => {
    let run = go(go(atFirstStop('MKT'), { type: 'go', to: 'city' }), { type: 'market' });
    const market = currentStop(run)!.city.market;
    run = { ...run, supplies: market[0]!.price };
    run = go(run, { type: 'buy', index: 0 });
    expect(run.supplies).toBe(0);
    expect(run.deck.at(-1)).toBe(market[0]!.card);
    const broke = stepRun(run, { type: 'buy', index: 1 });
    expect(broke).toMatchObject({ ok: false, reason: 'cannotPay' });
    expect(broke.state).toBe(run);
    expect(stepRun(run, { type: 'buy', index: 0 })).toMatchObject({ ok: false, reason: 'alreadyBought' });
    run = go(run, { type: 'leave' });
    expect(run.screen.k).toBe('battle');
  });

  it('Wild: its supplies are enough for the camp to upgrade a card', () => {
    let run = atFirstStop('WILD');
    run = { ...run, supplies: 0 };
    run = go(run, { type: 'go', to: 'wild' });
    expect(run.supplies).toBe(currentStop(run)!.wild.supplies);
    const index = upgradable(run)[0]!;
    run = go(run, { type: 'upgrade', index });
    expect(run.deck[index]).toBe(UPGRADE_OF[DECKS['puppeteer']!.cards[index]!]);
    expect(run.supplies).toBe(currentStop(run)!.wild.supplies - RUN_RULES.upgradePrice);
  });

  it('refuses the camp when the run cannot pay, and an upgrade of a card already upgraded', () => {
    const run = { ...atFirstStop('CAMP'), supplies: RUN_RULES.upgradePrice - 1 };
    expect(stepRun(run, { type: 'upgrade', index: 0 })).toMatchObject({ ok: false, reason: 'cannotPay' });
    const rich = go({ ...run, supplies: 99 }, { type: 'upgrade', index: 0 });
    expect(stepRun(rich, { type: 'upgrade', index: 0 })).toMatchObject({ ok: false, reason: 'notUpgradable' });
  });

  it('a ? event option with a price is closed when the run cannot pay it, and charged when taken', () => {
    const peddler = EVENTS['peddler']!.options[0]!;
    const run = atFirstStop('EVT');
    expect(eventOptionOpen({ ...run, supplies: peddler.price! - 1 }, peddler)).toEqual({ open: false, why: 'cannotPay' });
    expect(eventOptionOpen({ ...run, supplies: peddler.price! }, peddler)).toEqual({ open: true });
    // The shrine never takes the deck below its floor.
    const shrine = EVENTS['shrine']!.options[0]!;
    expect(eventOptionOpen({ ...run, deck: run.deck.slice(0, RUN_RULES.minDeck) }, shrine)).toEqual({ open: false, why: 'deckTooSmall' });
  });

  it('resolves every ? event option, on a Wild that rolled each event', () => {
    for (const [id, event] of Object.entries(EVENTS)) {
      event.options.forEach((option, index) => {
        const base = go(atFirstStop('EVTS'), { type: 'go', to: 'wild' });
        const stop = currentStop(base)!;
        // The event this Wild shows, swapped for the one under test; its drawn payloads stay.
        const run: CardRunState = { ...base, supplies: 10, nodes: base.nodes.map((n) => (n === base.nodes[base.at] ? { ...stop, wild: { ...stop.wild, event: id } } : n)) };
        const after = go(run, { type: 'event', option: index });
        if (option.price) expect(after.supplies).toBeLessThanOrEqual(10 - option.price);
        const kinds = option.effects.map((e) => e.k);
        if (kinds.includes('equipment')) expect(after.deck.at(-1)).toBe(stop.wild.equipment);
        if (kinds.includes('card')) expect(after.deck.at(-1)).toBe(stop.wild.card);
        if (kinds.includes('upgrade')) expect(after.screen).toEqual({ k: 'upgrade', source: 'smith' });
        if (kinds.includes('remove')) expect(after.screen).toEqual({ k: 'remove' });
        if (kinds.includes('fight')) expect([after.screen.k, after.battle?.encounter]).toEqual(['battle', stop.wild.ambush.encounter]);
      });
    }
  });

  it('removes a used piece of equipment from the deck for good, and keeps one never played', () => {
    // A deck whose first hand is all of it: the Ration is played round 1.
    const deck = ['ration', 'move', 'dig-in', 'attack', 'shoot', 'slash', 'dash', 'prep'];
    let run = createRun('EQUIP', deck);
    const bot = guardBot();
    const started = go(run, { type: 'battle', action: bot(run.battle!.state)! });
    run = started;
    while (run.battle?.state.phase === 'deploy') run = go(run, { type: 'battle', action: bot(run.battle.state)! });
    const ration = Object.values(run.battle!.state.cards).find((c) => c.def === 'ration')!.iid;
    // This seed deals the Ration in the first hand; round 1 plays it alone.
    expect(run.battle!.state.piles.hand).toContain(ration);
    run = go(run, { type: 'battle', action: { type: 'select', card: ration, unit: 'A' } });
    run = go(run, { type: 'battle', action: { type: 'commit' } });
    const { run: after, last } = winBattle(run);
    expect(last.piles.spent).toContain(ration);
    expect(after.deck).toEqual(deck.slice(1));
    // One never drawn stays: EQ2 does not deal it in the first hand, and the bot is left to play.
    const kept = winBattle(createRun('EQ2', deck));
    const iid = Object.values(kept.last.cards).find((c) => c.def === 'ration')!.iid;
    expect(kept.run.deck.includes('ration')).toBe(!kept.last.piles.spent.includes(iid));
  });

  it('a fallen boss offers one upgrade per unit; the pick lasts the rest of the run', () => {
    let run = createRun('BOSS');
    let guard = 0;
    while (!(run.screen.k === 'boost') && guard++ < 50) {
      if (run.screen.k === 'battle') run = winBattle(run).run;
      else if (run.screen.k === 'route') run = go(run, { type: 'go', to: 'wild' });
      else if (run.screen.k === 'wild') run = currentStop(run)!.wild.event ? go(run, { type: 'event', option: EVENTS[currentStop(run)!.wild.event!]!.options.findIndex((o) => !o.effects.some((e) => e.k === 'fight') && eventOptionOpen(run, o).open) }) : go(run, { type: 'leave' });
      else if (run.screen.k === 'upgrade') run = go(run, { type: 'upgrade', index: upgradable(run)[0]! });
      else if (run.screen.k === 'remove') run = go(run, { type: 'remove', index: 0 });
      else if (run.screen.k === 'cards') run = go(run, { type: 'pick', index: 0 });
      else throw new Error(`unexpected screen ${run.screen.k}`);
    }
    expect(run.screen.k).toBe('boost');
    if (run.screen.k !== 'boost') return;
    expect(run.screen.offers.map((o) => o.unit)).toEqual(['A', 'B', 'C']);
    const offer = run.screen.offers[0]!;
    run = go(run, { type: 'pick', index: 0 });
    expect(run.boosts.A[offer.kind]).toBe(offer.n);
    // The next battle carries it.
    run = go(run, { type: 'go', to: 'wild' });
    while (run.screen.k !== 'battle') run = run.screen.k === 'wild' && !currentStop(run)!.wild.event ? go(run, { type: 'leave' }) : go(run, { type: 'event', option: EVENTS[currentStop(run)!.wild.event!]!.options.length - 1 });
    expect(run.battle!.loadout.units?.A?.[offer.kind]).toBe(offer.n);
  });
});

describe('card run: the whole run, headless', () => {
  it('plays a run to its end under Node, and its log replays to the same state', () => {
    const { state, actions } = playRunBot(createRun('HEADLESS'));
    expect(state.screen.k).toBe('over');
    expect(replayRun({ version: CARD_RUN_VERSION, seed: 'HEADLESS', actions })).toEqual(state);
  });

  it('refuses a run log from another version, naming both values', () => {
    expect(() => replayRun({ version: 'cardrun-0.0.1', seed: 'X', actions: [] })).toThrow(/cardrun-0\.0\.1.*cardrun-0\.1\.0/);
  });

  it('refuses anything malformed without throwing, and nothing once the run is over', () => {
    const run = createRun('BAD');
    for (const action of [null, 7, {}, { type: 'go', to: 'moon' }, { type: 'pick', index: -1 }, { type: 'battle', action: { type: 'commit' } }]) {
      const result = stepRun(run, action);
      expect(result.ok).toBe(false);
      expect(result.state).toBe(run);
    }
    const over: CardRunState = { ...run, screen: { k: 'over', won: false } };
    expect(stepRun(over, { type: 'leave' })).toMatchObject({ ok: false, reason: 'runOver' });
  });

  it('keeps every card it can hand out known to the engine, and every upgrade one step up', () => {
    for (const id of [...TOWN_POOL, ...Object.keys(MARKET)]) expect(Object.hasOwn(CARDS, id), id).toBe(true);
    for (const [base, next] of Object.entries(UPGRADE_OF)) {
      expect(CARDS[next]!.owner).toBe(CARDS[base]!.owner);
      expect(UPGRADE_OF[next]).toBeUndefined();
    }
    for (const id of Object.keys(MARKET)) expect([CARDS[id]!.equipment, CARDS[id]!.uses, UPGRADE_OF[id]]).toEqual([true, 1, undefined]);
  });
});
