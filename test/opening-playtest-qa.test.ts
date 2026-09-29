/**
 * @vitest-environment jsdom
 *
 * The opening playtest QA, 2026-09-29. **One regression per finding fixed.**
 *
 * Filed at `docs/spec/gymrun-patch-opening-playtest-qa.md`. Each case pins the
 * fact the tester saw contradicted, not the markup that carried it.
 */
import { describe, expect, it } from 'vitest';

import { applyAcquisition, joinLevelFor, joiningSpec } from '../src/core/acquisition';
import { createParty } from '../src/core/party';
import { createRun } from '../src/core/run';
import type { PokemonSpec } from '../src/core/types';
import { renderCaptureOffer } from '../src/ui/screens/acquisition';
import { renderRewardCard } from '../src/ui/screens/reward';

const LILEEP: PokemonSpec = { species: 'Lileep', ability: 'Suction Cups', moves: ['Absorb'], level: 10 };

describe('QA-003: the coins card', () => {
  it('reads the balance the caller hands it, not the pre-payout state', () => {
    const state = { ...createRun('QA-003'), currency: 0 };
    const card = renderRewardCard({ kind: 'currency', amount: 35 }, state, () => undefined, { carrying: 13 });
    expect(card.textContent).toContain('13');
    expect(card.querySelector('.reward__note')?.textContent).not.toMatch(/\b0\b/);
  });
});

describe('QA-004: the restore card', () => {
  it('does not call a partial restore full', () => {
    const state = createRun('QA-004');
    const partial = renderRewardCard({ kind: 'heal', fraction: 0.85 }, state, () => undefined);
    expect(partial.textContent).toContain('85%');
    expect(partial.textContent).not.toMatch(/full/i);
    const full = renderRewardCard({ kind: 'heal', fraction: 1 }, state, () => undefined);
    expect(full.textContent).toMatch(/full/i);
  });
});

describe('the recruitment level', () => {
  it('the card draws the level the fold builds the member at', () => {
    const segment = 0;
    const offer = { nodeId: 's0-1-0', source: 'encounter' as const, spec: LILEEP };
    const joined = applyAcquisition(createParty([{ ...LILEEP, species: 'Skrelp', ability: 'Shed Skin' }]), offer, { kind: 'accept' }, segment, 3).party.at(-1)!;
    expect(joiningSpec(LILEEP, segment).level).toBe(joinLevelFor(segment));
    expect(joined.spec.level).toBe(joinLevelFor(segment));

    const card = renderCaptureOffer(offer, createParty([LILEEP]), () => undefined, 3, segment);
    const level = card.querySelector('.party__member--offered .panel__level')?.textContent ?? '';
    expect(level).toContain(String(joinLevelFor(segment)));
    expect(card.textContent).toContain(`${joined.maxHp} / ${joined.maxHp}`);
    expect(card.querySelector('.result__heading')?.textContent).toContain(`Lv${joinLevelFor(segment)}`);
  });
});
