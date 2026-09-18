/**
 * The drawer's party, and the window in which `live` is behind the run.
 *
 * ## The reported failure
 *
 * Two screenshots, one second apart. On the TM screen — "TM: Air Slash, who
 * learns it?" — the three recipient cards read Sobble, Spiritomb, **Anorith**:
 * the party the player had just made by releasing their Mantyke to take the
 * Anorith the node offered. The PARTY button in the same header, tapped
 * immediately after, opened on Sobble, Spiritomb, **Mantyke**.
 *
 * Both readouts were drawn from the same run at the same moment, and they
 * disagreed about who was in the party.
 *
 * ## Why
 *
 * `core/run.ts` applies a capture in `resolveNode`, at the *end* of the node,
 * and it asks the node's move questions before that — against
 * `partyAfterAcquisition`, which is `state.party` with the decision already
 * folded in. So between the capture and the end of the node there is a window
 * in which the run has been told about a party it has not adopted yet: the
 * recipient screen is handed the new one, and `ui/app.ts`'s `live` — replaced
 * only by `onState`, which fires at the bottom of the node loop — still holds
 * the old one. The drawer read `live.party` and printed the released member.
 *
 * This is the failure `ui/party-layout.ts` names in its header, arrived at from
 * the party's side rather than the bag's: a read-only surface contradicting a
 * decision the player has already made. The drawer exists to remove it, and the
 * standing rule in `ui/drawer.ts` — every decision surface exposes *current*
 * party state — is not satisfied by a surface that exposes a previous one.
 *
 * ## What is asserted, and where
 *
 * The wiring lives inside `mountApp`'s closure: `live`, the override and the
 * drawer's getter are three locals that never leave it, and there is no seam a
 * unit test can reach between them. So the first block asserts on the source,
 * the way `test/boundaries.test.ts` asserts that the human policy asks every
 * question it claims to. The second block tests the half that *is* pure — what
 * an unspent item plan does to a party a capture shortened — against the real
 * `applyAcquisition`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { applyAcquisition, type AcquisitionOffer } from '../src/core/acquisition';
import { createParty } from '../src/core/party';
import { itemLayoutOf } from '../src/ui/party-layout';
import type { ItemPlan, PokemonSpec } from '../src/core/types';

const ROOT = new URL('..', import.meta.url).pathname;

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

const APP = stripComments(readFileSync(join(ROOT, 'src/ui/app.ts'), 'utf8'));

/** The body of a `key: (…) => …` entry in the human policy, up to the next key. */
function policyEntry(key: string): string {
  const at = APP.indexOf(`${key}:`);
  expect(at, `app.ts has no ${key} entry`).toBeGreaterThanOrEqual(0);
  const rest = APP.slice(at + key.length);
  const next = rest.search(/\n {6}\w[\w]*:/);
  return next === -1 ? rest : rest.slice(0, next);
}

describe('the drawer reads the party the run has been told about', () => {
  it('prefers the fight in progress over any fold of run state', () => {
    /*
     * Mid-fight there is no run state to fold — the damage is in the sim — so
     * the drawer reads the session `onBattle` handed over, folded onto the
     * party that fight was *sent* with. Anything else on that screen is the
     * party as the node was entered with, which is what the drawer's own
     * "as the fight has left it" was contradicting on 137 of 217 turns.
     */
    const getter = /readDrawer = \(\) => \{[\s\S]*?\n {4}\};/.exec(APP)?.[0] ?? '';
    expect(getter, 'could not find readDrawer in app.ts').not.toEqual('');
    expect(getter, 'the in-battle drawer is not reading the live fight').toContain('liveBattle');
    expect(getter, 'the live fight is not folded onto the party it was sent with').toMatch(
      /liveBattle[\s\S]*applyBattleState\(fight\.sent/,
    );
  });

  it('stops reading the fight once its screen is gone', () => {
    /*
     * The session outlives its screen — `releaseBattle` runs when the *next*
     * fight starts — so between the outro and the end of the node the ended
     * session is still in hand. Reading it on the result or capture screen
     * would answer with the battle's members while the projection had already
     * folded in the Pokemon the player caught: the reported defect, reintroduced
     * by the fix for it. The gate is the screen, not whether a session exists.
     */
    const getter = /readDrawer = \(\) => \{[\s\S]*?\n {4}\};/.exec(APP)?.[0] ?? '';
    expect(getter, 'could not find readDrawer in app.ts').not.toEqual('');
    expect(getter, 'the ended fight is still a drawer source off the battle screen').toMatch(
      /router\.current\(\) === 'battle' \? liveBattle : null/,
    );
  });

  it('hands the session back when the fight is released', () => {
    /*
     * Or the next screen would draw the previous fight. `releaseBattle` already
     * detaches the screen and cancels the outro for the same reason.
     */
    const release = /const releaseBattle = \(\): void => \{[\s\S]*?\n {4}\};/.exec(APP)?.[0] ?? '';
    expect(release, 'could not find releaseBattle in app.ts').not.toEqual('');
    expect(release, 'a released fight stays readable by the drawer').toContain('liveBattle = null');
  });

  it('takes the mid-node truth from the projection hook, not from its own fold', () => {
    /*
     * `core/run.ts` computes it. Folding battle state in `ui/` would be a
     * second reading of what a node did, and the first divergence between the
     * two would be invisible — the same argument `partyAfterAcquisition` makes
     * about a capture.
     */
    const handler = /const onProjection = \(projection: RunProjection\): void => \{[\s\S]*?\n {4}\};/.exec(APP)?.[0] ?? '';
    expect(handler, 'app.ts no longer listens for the projection').not.toEqual('');
    expect(handler).toContain('decidedParty = projection.party');
    expect(handler).toContain('decidedRelics = projection.relics');
    // And it must be handed to playRun, or the handler is decoration.
    expect(APP, 'the projection handler is never registered').toMatch(/onState,\s*onBattle,\s*onProjection/);
  });

  it('shows the relics the player has taken, not the ones the run has folded', () => {
    const getter = /readDrawer = \(\) => \{[\s\S]*?\n {4}\};/.exec(APP)?.[0] ?? '';
    expect(getter, 'a relic taken this node is still missing from the drawer').toContain(
      'decidedRelics ?? state.relics',
    );
  });

  it('does not draw its party straight off the lagging run state', () => {
    /*
     * The defect in one line. `readDrawer` used to be `party: state.party`,
     * and `state` there is `live` — the snapshot `onState` last left, which
     * inside a node is the party as it was *before* the node's capture.
     *
     * The check is that the getter resolves its party through the override
     * before falling back, rather than that it names any particular local: a
     * rewrite that renames `decidedParty` still has to go through something,
     * and a rewrite that goes straight to `state.party` is the bug again.
     */
    const getter = /readDrawer = \(\) => \{[\s\S]*?\n {4}\};/.exec(APP)?.[0] ?? '';
    expect(getter, 'could not find readDrawer in app.ts').not.toEqual('');
    expect(getter, 'the drawer is reading the lagging party again').toContain(
      'decidedParty ?? state.party',
    );
    expect(
      getter.replace('decidedParty ?? state.party', ''),
      'the drawer still has a second, unguarded read of the lagging party',
    ).not.toContain('state.party');
  });

  it('gives the override back the moment the run catches up', () => {
    /*
     * `onState` is that moment and the only one: it is where `live` is
     * replaced with the state `resolveNode` produced, capture folded in. An
     * override outliving it would be a stand-in for a party that is now simply
     * readable, and the next node's reorder or release would not reach it.
     */
    const onState = /const onState = \(state: RunState\): void => \{[\s\S]*?\n {4}\};/.exec(APP)?.[0] ?? '';
    expect(onState, 'could not find onState in app.ts').not.toEqual('');
    expect(onState, 'the override is never cleared, so it can outlive its node').toContain(
      'decidedParty = null',
    );
    expect(onState, 'the relic override outlives its node').toContain('decidedRelics = null');
  });

  it('drops a pending item plan when a capture releases a member', () => {
    /*
     * The second half, and the same rule the party screen's own release
     * states: a plan names *slots*, and a release changes which Pokemon a slot
     * is. `showParty`'s `onRelease` drops the plan for that reason; a capture
     * that releases is the other of the two paths that can shorten a party,
     * and it was carrying the plan across.
     */
    expect(
      policyEntry('chooseAcquisition'),
      'a releasing capture carries the plan across the slots it shifted',
    ).toContain("decision.kind === 'release'");
    expect(policyEntry('chooseAcquisition')).toContain('pendingPlan = null');
  });
});

describe('what an unspent plan would have done to the shortened party', () => {
  /** Three members, the middle one holding the item the plan is about. */
  function partyOf() {
    const party = createParty([
      { species: 'Sobble', ability: 'Torrent', moves: ['Water Gun'], level: 14 },
      { species: 'Spiritomb', ability: 'Pressure', moves: ['Shadow Ball'], level: 14 },
      { species: 'Mantyke', ability: 'Swift Swim', moves: ['Bubble Beam'], level: 14 },
    ]);
    return party.map((member, slot) => (slot === 2 ? { ...member, item: 'leftovers' as const } : member));
  }

  const OFFER: AcquisitionOffer = {
    nodeId: 'n1',
    source: 'encounter',
    spec: { species: 'Anorith', ability: 'Battle Armor', moves: ['Fury Cutter'], level: 14 } as PokemonSpec,
  };

  it('would hand the released member\'s item to whoever the slot became', () => {
    /*
     * Not a behaviour to keep — a demonstration of the one being prevented.
     *
     * `applyAcquisition` removes the released slot and *appends* the newcomer,
     * so the plan's "slot 2 holds the Leftovers" survives as a sentence and
     * stops being true: slot 2 is now the Anorith that just arrived. Holding
     * the plan across the capture is a silent mis-assignment with no error to
     * notice, which is why `chooseAcquisition` drops it.
     */
    const party = partyOf();
    const plan: ItemPlan = { assignments: [{ slot: 2, item: 'leftovers' }], discards: [], teaches: [], discardTms: [] };
    const after = applyAcquisition(party, OFFER, { kind: 'release', slot: 2 }, 1, party.length).party;

    expect(after.map((member) => member.spec.species)).toEqual(['Sobble', 'Spiritomb', 'Anorith']);
    expect(itemLayoutOf(after, plan)).toEqual([null, null, 'leftovers']);
  });

  it('reads the layout off run state once the plan is dropped', () => {
    /*
     * Which is the arrangement that is actually true. The released member's
     * item went to the backpack with it (`applyAcquisition` frees it), so the
     * shortened party holds nothing, and the drawer says so rather than
     * pointing at a Pokemon that never received it.
     */
    const party = partyOf();
    const released = applyAcquisition(party, OFFER, { kind: 'release', slot: 2 }, 1, party.length);

    expect(released.freed).toContain('leftovers');
    expect(itemLayoutOf(released.party, null)).toEqual([null, null, null]);
  });
});
