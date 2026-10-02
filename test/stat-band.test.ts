/**
 * The band a stat bar is measured against. **Stage 5.1, bible Rev 21, D88**
 * (`docs/spec/gymrun-stage5.1-band-bars-and-starter-fit.md`).
 *
 * The band is the lowest and highest value a stat takes at a level across the
 * species the randomizer may field there. These pin what that means: it is
 * read off the pool and the formula and never drawn, it agrees with the
 * engine's own numbers at its two ends, and the author's worked example holds.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';

import { describeSpecCard, statBandAt } from '../src/core/battle/driver';
import { DISPLAY_STATS } from '../src/core/battle/stats';
import { createRun } from '../src/core/run';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { bandFraction, statBlock } from '../src/ui/stat-block';

describe('statBandAt', () => {
  it('puts the level 15 HP band at Diglett to Wobbuffet', () => {
    const band = statBandAt(15);
    expect(band.hp).toEqual({ min: 32, max: 86 });
  });

  it("draws the author's example, a level 15 Munchlax, high in its HP band", () => {
    const munchlax = describeSpecCard({ species: 'Munchlax', ability: 'Thick Fat', moves: ['Tackle'], level: 15 });
    const fraction = bandFraction(munchlax.maxHp, statBandAt(15).hp);
    expect(fraction).toBeGreaterThan(0.65);
  });

  it('contains every starter it would scale, at the starter level', () => {
    for (const seed of ['BAND-A', 'BAND-B', 'BAND-C', 'GYMRUN-715122-DNCFGVFU']) {
      for (const spec of createRun(seed, DEFAULT_TUNING).starterOptions) {
        const card = describeSpecCard(spec);
        const band = statBandAt(card.level);
        const values = { ...card.baseStatsAtLevel, hp: card.maxHp };
        for (const stat of DISPLAY_STATS) {
          expect(values[stat], `${card.species} ${stat}`).toBeGreaterThanOrEqual(band[stat].min);
          expect(values[stat], `${card.species} ${stat}`).toBeLessThanOrEqual(band[stat].max);
        }
      }
    }
  });

  it('widens as the level rises, and is the same object on a second ask', () => {
    for (const stat of DISPLAY_STATS) {
      expect(statBandAt(50)[stat].max).toBeGreaterThan(statBandAt(15)[stat].max);
      expect(statBandAt(50)[stat].min).toBeGreaterThanOrEqual(statBandAt(15)[stat].min);
    }
    expect(statBandAt(15)).toBe(statBandAt(15));
  });
});

describe('bandFraction', () => {
  it('is 0 at the floor, 1 at the ceiling, and clamped outside them', () => {
    const range = { min: 20, max: 60 };
    expect(bandFraction(20, range)).toBe(0);
    expect(bandFraction(60, range)).toBe(1);
    expect(bandFraction(40, range)).toBe(0.5);
    expect(bandFraction(10, range)).toBe(0);
    expect(bandFraction(90, range)).toBe(1);
  });
});

describe('the stat block', () => {
  it('draws a bar beside each number when it knows the level, and none without one', () => {
    const values = { hp: 52, atk: 21, def: 21, spa: 26, spd: 26, spe: 29 };
    const banded = statBlock(values, { level: 15 });
    expect(banded.querySelectorAll('.stat__bar-fill')).toHaveLength(6);
    expect(banded.querySelectorAll('.stat__value')).toHaveLength(6);
    const hp = banded.querySelector<HTMLElement>('.stat[data-row="hp"] .stat__bar-fill')!;
    expect(hp.style.width).toBe(`${Math.round(bandFraction(52, statBandAt(15).hp) * 1000) / 10}%`);
    expect(statBlock(values).querySelectorAll('.stat__bar')).toHaveLength(0);
  });

  it('colours no bar by how full it is: one class at every fraction (C1)', () => {
    const block = statBlock({ hp: 86, atk: 11, def: 40, spa: 30, spd: 30, spe: 48 }, { level: 15 });
    const classes = new Set([...block.querySelectorAll('.stat__bar-fill')].map((fill) => fill.className));
    expect([...classes]).toEqual(['stat__bar-fill']);
  });
});
