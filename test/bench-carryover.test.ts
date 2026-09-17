/**
 * The bench belongs to the fight it was drawn for.
 *
 * @vitest-environment jsdom
 *
 * ## The defect these are here for
 *
 * A playtest report, 2026-09-17: *"on a new seed, party is not reset. screenshot
 * shows a dead horsea when i'm on a new seed"*. The party was reset. `createRun`
 * builds one with `party: []` and `chooseStarter` puts exactly one member in it,
 * and nothing in `core/` had carried anything across a run. What had not been
 * reset was a `<div>`.
 *
 * `renderBench` has two empty cases and they were the wrong way round. When the
 * view carries no switches at all — between turns, and once the battle has
 * ended, both gated on `awaiting` in `battle/driver.ts` — the panel is supposed
 * to keep its last render, disabled, so it does not collapse out from under the
 * player mid-fight. When the view *is* asking and the filtered bench is still
 * empty, the side is a party of one and the panel has nothing to say. The first
 * case returned without disabling, the second disabled without clearing, and
 * each carried the other's comment.
 *
 * The second half is the one a player can see. A run whose party is just the
 * starter never clears the heading, and the scene is built once in
 * `createScene`, which `screens/battle.ts` calls once, which `app.ts` calls once
 * for the life of the page. "The last render" was bounded by neither the battle
 * nor the run, so a new seed opened on a Pokemon it had never owned and kept it
 * for the whole fight.
 *
 * ## Why these are jsdom tests
 *
 * Every assertion is about which elements exist and which are disabled. Whether
 * an empty bench takes vertical space is a computed-style question and
 * `.bench:empty { display: none }` answers it in `test/visual-v5.test.ts`.
 *
 * **The first test asserts at the seam rather than at the function**, for the
 * reason `test/battle-outro.test.ts` gives about its own last case: clearing the
 * bench inside `renderBench` proves nothing if the next fight never redraws it,
 * and a test that only drives `scene.update` passes either way.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { createBattle, type BattleSession } from '../src/core/battle/driver';
import { buildBattleUiView, type BattleUiView } from '../src/core/battle/view';
import type { NodeSpec } from '../src/core/encounters';
import type { Choice, TeamSpec } from '../src/core/types';
import { abilityEffects } from '../src/data/abilityEffects';
import { createScene, type Scene } from '../src/ui/scene';
import { createBattleScreen } from '../src/ui/screens/battle';
import { resetSettings } from '../src/ui/settings';

/** The run that came before: a starter and the Pokemon it picked up. */
const PARTY_OF_TWO: TeamSpec = [
  { species: 'Chingling', ability: 'Levitate', moves: ['Confusion'], level: 7 },
  { species: 'Horsea', ability: 'Swift Swim', moves: ['Bubble'], level: 7 },
];
/** The new seed: one starter and nothing behind it. */
const PARTY_OF_ONE: TeamSpec = [PARTY_OF_TWO[0]!];
const FOE: TeamSpec = [{ species: 'Yamper', ability: 'Ball Fetch', moves: ['Tackle'], level: 4 }];

const REVEAL = { ability: true, item: true, teamSize: true };

beforeEach(() => {
  resetSettings();
});

function nodeFor(seed: string): NodeSpec {
  return {
    id: 's1-1-0',
    kind: 'wild',
    tier: 'normal',
    label: 'A fight',
    encounter: { team: FOE, opponent: 'A wild Pokemon', simSeed: seed as never },
    rewards: [],
  } as unknown as NodeSpec;
}

function sessionFor(player: TeamSpec, seed: string): BattleSession {
  return createBattle({ teams: { p1: player, p2: FOE }, seed });
}

function viewFor(session: BattleSession): BattleUiView {
  return buildBattleUiView(session.factsFor('p1'), REVEAL, abilityEffects);
}

/**
 * Run a battle to its end, answering every request with the first move and
 * taking the first legal body on a forced switch.
 */
function playOut(session: BattleSession): BattleSession {
  const choice: Choice = { kind: 'move', slot: 1 };
  for (let turn = 0; turn < 60 && !session.viewFor('p1').ended; turn++) {
    for (const side of ['p1', 'p2'] as const) {
      const view = session.viewFor(side);
      if (!view.awaitingChoice) continue;
      const forced = view.switches.find((member) => member.usable);
      session.submit(side, view.forceSwitch && forced ? { kind: 'switch', slot: forced.slot } : choice);
    }
  }
  return session;
}

/** Every bench row currently on screen, by the species it names. */
function benchSpecies(root: ParentNode): string[] {
  return [...root.querySelectorAll('.bench__member .bench__name')].map((node) => node.textContent ?? '');
}

describe('a new fight does not inherit the last one', () => {
  /**
   * The report, reproduced end to end: two fights on one screen, the second
   * with a party of one, and the first fight's bench must not survive into it.
   */
  it('clears a previous party from the switch panel when the next fight has a bench of none', () => {
    const screen = createBattleScreen();
    document.body.replaceChildren(screen.root);

    const first = sessionFor(PARTY_OF_TWO, 'BENCH-CARRY-1');
    const detachFirst = screen.attach(first, nodeFor('BENCH-CARRY-1'), REVEAL, () => {});
    expect(benchSpecies(screen.root)).toEqual(['Horsea']);
    detachFirst();

    // A different run entirely: a fresh seed, a fresh session, one Pokemon.
    const second = sessionFor(PARTY_OF_ONE, 'BENCH-CARRY-2');
    const detachSecond = screen.attach(second, nodeFor('BENCH-CARRY-2'), REVEAL, () => {});
    expect(benchSpecies(screen.root)).toEqual([]);
    // And nothing at all under the heading, so `.bench:empty` can hide it.
    expect(screen.root.querySelector('.bench')?.children.length).toBe(0);
    detachSecond();
  });

  /**
   * The hole `renderBench` alone does not close, and the reason `attach` clears
   * the panels rather than trusting the next draw to.
   *
   * A view that is not being asked for a choice carries no switches, and that
   * is the case where the panel is *supposed* to keep what it has. An **ended**
   * session is such a view — `battle/driver.ts` gates `switches` on `awaiting`
   * and a finished battle awaits nothing — so a screen attached to one draws no
   * bench of its own and would show the previous fight's until something else
   * replaced it. `attach` clears the board the way it already clears the log,
   * the strip and the history sheet, and that is what makes it empty here.
   */
  it('clears the panels even when the incoming view would keep the last render', () => {
    const screen = createBattleScreen();
    document.body.replaceChildren(screen.root);

    const first = sessionFor(PARTY_OF_TWO, 'BENCH-CARRY-3');
    screen.attach(first, nodeFor('BENCH-CARRY-3'), REVEAL, () => {})();
    expect(benchSpecies(screen.root)).toEqual(['Horsea']);

    const finished = playOut(sessionFor(PARTY_OF_ONE, 'BENCH-CARRY-4'));
    expect(finished.viewFor('p1').ended).toBe(true);
    expect(viewFor(finished).switches).toEqual([]);

    screen.attach(finished, nodeFor('BENCH-CARRY-4'), REVEAL, () => {})();
    expect(benchSpecies(screen.root)).toEqual([]);
    expect(screen.root.querySelectorAll('.moves button')).toHaveLength(0);
  });
});

describe('the two empty benches', () => {
  function sceneWithBench(): Scene {
    const scene = createScene();
    scene.update(viewFor(sessionFor(PARTY_OF_TWO, 'BENCH-EMPTY-1')), () => {});
    expect(benchSpecies(scene.root)).toEqual(['Horsea']);
    return scene;
  }

  /**
   * Asking with nothing to offer. The side is one Pokemon and it is on the
   * field, so the panel says nothing — which means an empty container, because
   * that is what the stylesheet hides.
   */
  it('empties the panel when the side is being asked and has only its active', () => {
    const scene = sceneWithBench();
    const alone = viewFor(sessionFor(PARTY_OF_ONE, 'BENCH-EMPTY-2'));
    expect(alone.awaitingChoice).toBe(true);
    expect(alone.switches).toHaveLength(1);
    expect(alone.switches[0]?.block).toBe('active');

    scene.update(alone, () => {});
    expect(scene.root.querySelector('.bench')?.children.length).toBe(0);
  });

  /**
   * Not asking at all. Between turns and after the battle ends the view carries
   * no switches, and the panel holds what it had rather than collapsing — the
   * rule this patch kept, and the half that was already behaving.
   */
  it('keeps the last render, disabled, when the view carries no switches', () => {
    const scene = sceneWithBench();
    const between = { ...viewFor(sessionFor(PARTY_OF_TWO, 'BENCH-EMPTY-3')), switches: [] };

    scene.update(between as BattleUiView, () => {});
    expect(benchSpecies(scene.root)).toEqual(['Horsea']);
    const rows = [...scene.root.querySelectorAll<HTMLButtonElement>('.bench button')];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.disabled).toBe(true);
  });

  /** And `reset()` takes both panels, which is what `attach` calls it for. */
  it('takes the moves column and the bench together on reset', () => {
    const scene = sceneWithBench();
    expect(scene.root.querySelectorAll('.moves button').length).toBeGreaterThan(0);

    scene.reset();
    expect(scene.root.querySelector('.bench')?.children.length).toBe(0);
    expect(scene.root.querySelectorAll('.moves button')).toHaveLength(0);
    // The forced marker is a fact about a bench that exists.
    expect(scene.root.querySelector<HTMLElement>('.bench')?.dataset['forced']).toBeUndefined();
  });
});

/**
 * A guard against the fix being read as "clear the bench whenever it is empty".
 * A fainted member is still a member and still a row, disabled with its reason
 * on it, which is the rule `renderBenchMember` and `BLOCK_LABELS` exist for.
 */
describe('a fainted member is not an empty bench', () => {
  it('keeps a knocked-out reserve on the panel, disabled and labelled', () => {
    /*
     * A foe that one-shots either body, so the lead falls, the forced switch
     * puts Horsea out, and the fight is still going with a corpse on the bench
     * — the exact board the playtest screenshot showed, arrived at honestly.
     */
    const session = createBattle({
      teams: { p1: PARTY_OF_TWO, p2: [{ species: 'Tyranitar', ability: 'Sand Stream', moves: ['Crunch'], level: 50 }] },
      seed: 'BENCH-FAINT-1',
    });
    const choice: Choice = { kind: 'move', slot: 1 };
    for (let turn = 0; turn < 20 && !session.viewFor('p1').ended; turn++) {
      const mine = session.viewFor('p1');
      if (mine.awaitingChoice && !mine.forceSwitch && mine.switches.some((m) => m.block === 'fainted')) break;
      for (const side of ['p1', 'p2'] as const) {
        const view = session.viewFor(side);
        if (!view.awaitingChoice) continue;
        const forced = view.switches.find((member) => member.usable);
        session.submit(side, view.forceSwitch && forced ? { kind: 'switch', slot: forced.slot } : choice);
      }
    }

    const view = viewFor(session);
    expect(view.switches.filter((member) => member.block === 'fainted')).toHaveLength(1);

    const scene = createScene();
    scene.update(view, () => {});
    const rows = [...scene.root.querySelectorAll<HTMLButtonElement>('.bench__member')];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain('Chingling');
    expect(rows[0]?.textContent).toContain('Fainted');
    expect(rows[0]?.disabled).toBe(true);
  });
});
