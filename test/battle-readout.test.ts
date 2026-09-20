/**
 * The battle readout: stage multipliers, the move fact strip, band pips.
 * **Patch 4.8.0.3.**
 *
 * @vitest-environment jsdom
 *
 * Three presentation changes with one thing in common: each replaces a form
 * only a Pokemon player could read with the same fact in a form anyone can.
 * `+2` became `2.0x`, a row of words became a strip of decodable icons, and
 * `BAND 3` became three of four pips.
 *
 * **What each test is actually holding.** The risk in a change like this is not
 * that the new thing fails to render — it is that the new thing renders a
 * *plausible* number that is not the one the battle applies. So nothing below
 * compares against a literal: the multipliers are asserted against
 * `core/battle/stats.applyStage`, which is the transcription of the engine's
 * own `Pokemon#getStat`, and the strip is asserted against what `describeMove`
 * returns for that move rather than against a list written here.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import { describeMove } from '../src/core/battle/driver';
import { moveFactsOf, MOVE_FACT_IDS, type MoveFactId } from '../src/core/moveFacts';
import { BOOST_TABLE, MAX_STAGE, applyStage } from '../src/core/battle/stats';
import {
  ACCURACY_STAGE_TABLE,
  MAIN_STAGE_TABLE,
  formatStageMultiplier,
  stageMultiplier,
} from '../src/data/statStages';
import { MOVE_FACT_COLUMN, MOVE_FACT_INFO } from '../src/data/moveFactInfo';
import { DEFAULT_DISPLAY_TUNING } from '../src/data/displayTuning';
import { BAND_INFO, BAND_PIPS } from '../src/data/bandInfo';
import { bandChip, stageChip } from '../src/ui/chip';
import { moveFactStrip } from '../src/ui/scene';
import { createTooltips } from '../src/ui/tooltips';

const STAGES = Array.from({ length: MAX_STAGE * 2 + 1 }, (_, i) => i - MAX_STAGE);

describe('stat stages render as the multiplier the mechanics apply', () => {
  /**
   * Required test 1, and the form it is required in: **against the table, not
   * against a hardcoded string.**
   *
   * A test that said `expect(formatStageMultiplier(-1)).toBe('0.7x')` would
   * pass just as happily if the display table and the engine table disagreed,
   * because it only knows one of them. This one drives a real stat through
   * `applyStage` — the transcription of `Pokemon#getStat`, floor and all — and
   * checks the displayed multiplier lands on the number the engine produced.
   *
   * The base is 200 rather than a small number because `applyStage` floors,
   * and a floor on a small base is a large relative error that would make the
   * comparison meaningless rather than strict. At 200 the floor is under the
   * one-decimal resolution the display rounds to.
   */
  it('matches the applied mechanics across the whole range', () => {
    const base = 200;
    for (const stage of STAGES) {
      const applied = applyStage(base, stage) / base;
      expect(stageMultiplier(stage), `stage ${stage}`).toBeCloseTo(applied, 2);
      expect(formatStageMultiplier(stage), `stage ${stage}`).toBe(`${applied.toFixed(1)}x`);
    }
  });

  /** The display table is the engine's table. If it drifts, this is the failure. */
  it('carries the engine table entry for entry', () => {
    expect(MAIN_STAGE_TABLE).toEqual(BOOST_TABLE);
  });

  /**
   * The specific claim the patch makes about the shape of the mechanic: a drop
   * divides rather than mirroring. A single drop is 0.7x, not 0.5x.
   */
  it('drops by division, so -1 is 0.7x and not 0.5x', () => {
    expect(formatStageMultiplier(-1)).toBe('0.7x');
    expect(formatStageMultiplier(1)).toBe('1.5x');
  });

  /**
   * Required test 2, first half: accuracy and evasion are on their own ladder,
   * and `+1` means a different number there than it does on Attack.
   */
  it('puts accuracy and evasion on their own table', () => {
    expect(ACCURACY_STAGE_TABLE[1]).toBeCloseTo(4 / 3, 5);
    expect(formatStageMultiplier(1, 'accuracy')).toBe('1.3x');
    expect(formatStageMultiplier(-1, 'accuracy')).toBe('0.8x');
    expect(formatStageMultiplier(1, 'accuracy')).not.toBe(formatStageMultiplier(1));
  });

  /** Clamped where the engine clamps, so no display can outrun the table. */
  it('clamps past the ends of the ladder', () => {
    expect(stageMultiplier(99)).toBe(stageMultiplier(MAX_STAGE));
    expect(stageMultiplier(-99)).toBe(stageMultiplier(-MAX_STAGE));
  });

  /**
   * Required test 3. A zero stage renders nothing — there is no chip at all,
   * rather than a `1.0x` row saying that nothing has happened yet.
   *
   * Asserted at the caller's level, because that is where the filter lives:
   * `scene.ts` skips a zero stage, and the panel row hides itself when the
   * result is empty. The chip itself is never handed one.
   */
  it('renders nothing at all for a zero stage', () => {
    const panel = document.createElement('div');
    const stages = [0, 0, 0, 0, 0].filter((stage) => stage !== 0);
    for (const stage of stages) panel.append(stageChip(stage, 'Atk'));
    expect(panel.querySelectorAll('.badge--stage')).toHaveLength(0);
    expect(panel.textContent).toBe('');
  });

  /**
   * The ladder is the stage integer, in the element that costs no width.
   *
   * Lit segments count the stage, the unlit ones stay drawn because the range
   * is half of what is being shown, and the signed number is on the label so a
   * screen reader gets a number rather than a count of divs.
   */
  it('draws the stage as a ladder and keeps the integer on the label', () => {
    const chip = stageChip(2, 'Atk');
    expect(chip.textContent).toContain('2.0x');
    expect(chip.querySelectorAll('.stage-ladder__seg')).toHaveLength(MAX_STAGE);
    expect(chip.querySelectorAll('.stage-ladder__seg[data-on="true"]')).toHaveLength(2);
    expect(chip.querySelector('.stage-ladder')?.getAttribute('aria-label')).toContain('+2');

    const dropped = stageChip(-3, 'Spe');
    expect(dropped.querySelectorAll('.stage-ladder__seg[data-on="true"]')).toHaveLength(3);
    expect(dropped.querySelector('.stage-ladder')?.classList.contains('stage-ladder--down')).toBe(true);
  });
});

describe('the move fact strip', () => {
  /**
   * Required test 4. **A sweep, and every case is a different absence.**
   *
   * The sweep is chosen so each move is the negative of another: a never-miss
   * move has no accuracy where every other move does, a status move has no
   * accuracy *and* no contact, a priority move carries a bracket where the
   * others carry none. A test on one move would prove the strip renders; this
   * proves it renders what the move has and stops.
   *
   * Every expectation is derived from `describeMove` rather than written out,
   * so the sweep cannot pass by rendering a plausible strip.
   */
  const SWEEP = [
    'Swift', // never-misses: accuracy is `true`
    'Quick Attack', // priority, contact
    'Rock Blast', // multi-hit
    'Double-Edge', // recoil, contact
    'Solar Beam', // charge
    'Hyper Beam', // recharge
    'Giga Drain', // drain
    'Thunderbolt', // a secondary with a chance
    'Swords Dance', // pure status: no accuracy, no contact, nothing
  ];

  it('renders exactly the fields describeMove returns, and nothing for the rest', () => {
    for (const name of SWEEP) {
      const move = describeMove(name);
      expect(move, name).not.toBeNull();
      const facts = moveFactsOf(move!);
      const strip = moveFactStrip(facts);

      if (facts.length === 0) {
        expect(strip, `${name}: no facts must mean no strip`).toBeNull();
        continue;
      }

      const drawn = [...strip!.querySelectorAll<HTMLElement>('.badge--fact')];
      /*
       * **Every field, in column order.** The strip draws a fixed grid since
       * the playtest patch: a field's column is its identity, so the DOM order
       * is the column order rather than `MOVE_FACT_IDS` order — contact sits in
       * column 2 and is therefore drawn second, not last. The set is what this
       * assertion is about, and it is unchanged: nothing is dropped and nothing
       * is invented.
       */
      expect([...drawn.map((chip) => chip.dataset['fact'])].sort(), name).toEqual(
        facts.map((fact) => fact.id).sort(),
      );
      expect(drawn.map((chip) => chip.dataset['fact']), `${name}: column order`).toEqual(
        [...facts].sort((a, b) => MOVE_FACT_COLUMN[a.id] - MOVE_FACT_COLUMN[b.id]).map((fact) => fact.id),
      );
      // Each chip in the cell its column names, so the accuracy on one button
      // is directly above the accuracy on the next.
      for (const chip of drawn) {
        const column = chip.parentElement?.dataset['column'];
        expect(column, `${name}: ${chip.dataset['fact']} is in a fact cell`).toBe(
          String(MOVE_FACT_COLUMN[chip.dataset['fact'] as MoveFactId]),
        );
      }

      for (const chip of drawn) {
        const fact = facts.find((candidate) => candidate.id === chip.dataset['fact'])!;
        // The number, when there is one, and no element for one when there is
        // not. No empty slots, no greyed placeholders.
        expect(chip.querySelector('.move__fact-value')?.textContent ?? '', `${name}: ${fact.id}`).toBe(fact.value);
        // Decodable: every icon is a trigger on the one tooltip layer, and the
        // panel it raises names the field in words.
        expect(chip.dataset['tip'], `${name}: ${fact.id}`).toBe(`movefact:${fact.id}`);
        expect(chip.getAttribute('aria-label'), `${name}: ${fact.id}`).toContain(
          MOVE_FACT_INFO[fact.id].label,
        );
      }
    }
  });

  /** The specific absences the sweep exists for, named so a failure says which. */
  it('omits accuracy for a never-miss move and everything for a bare status move', () => {
    const ids = (name: string): MoveFactId[] => moveFactsOf(describeMove(name)!).map((fact) => fact.id);
    expect(ids('Swift')).not.toContain('accuracy');
    expect(ids('Thunderbolt')).toContain('accuracy');
    expect(ids('Swords Dance')).toEqual([]);
    expect(ids('Quick Attack')).toContain('priority');
    expect(ids('Rock Blast')).toContain('multiHit');
    expect(ids('Double-Edge')).toContain('recoil');
    expect(ids('Giga Drain')).toContain('drain');
    expect(ids('Thunderbolt')).toContain('secondary');
  });

  /**
   * Charge is a flag, because `chargeTurns` is derived from the sim's `charge`
   * flag and is therefore always 1. Rendering "1 turn" would be printing a
   * number the field does not measure.
   */
  it('renders flag-derived fields as flags, with no number', () => {
    const charge = moveFactsOf(describeMove('Solar Beam')!).find((fact) => fact.id === 'charge');
    expect(charge?.value).toBe('');
    const contact = moveFactsOf(describeMove('Quick Attack')!).find((fact) => fact.id === 'contact');
    expect(contact?.value).toBe('');
  });

  /** Contact and sound come out of `flags[]`; no named field was added for them. */
  it('reads contact out of flags rather than a named field', () => {
    const move = describeMove('Quick Attack')!;
    expect(move.flags).toContain('contact');
    expect('contact' in move).toBe(false);
  });

  /** Strip order is fixed, so the icons can be glanced at rather than read. */
  it('renders in one fixed order regardless of the move', () => {
    for (const name of SWEEP) {
      const ids = moveFactsOf(describeMove(name)!).map((fact) => fact.id);
      const positions = ids.map((id) => MOVE_FACT_IDS.indexOf(id));
      expect([...positions].sort((a, b) => a - b), name).toEqual(positions);
    }
  });

  /** Every id the strip can draw has words behind it. An undecodable icon is the failure. */
  it('gives every icon a label and a blurb', () => {
    for (const id of MOVE_FACT_IDS) {
      const info = MOVE_FACT_INFO[id];
      expect(info.icon.length, id).toBeGreaterThan(0);
      expect(info.label.length, id).toBeGreaterThan(0);
      expect(info.blurb.length, id).toBeGreaterThan(0);
    }
  });
});

describe('the band badge is a meter', () => {
  /**
   * Required test 5's other half — the per-surface sweep lives in
   * `test/band-badge.test.ts`, which already walks eight surfaces and now
   * counts pips. This is the component itself.
   */
  it('fills one pip per band, out of the table size', () => {
    expect(BAND_PIPS).toBe(Object.keys(BAND_INFO).length);
    for (const band of Object.keys(BAND_INFO).map(Number)) {
      const chip = bandChip(band);
      expect(chip.querySelectorAll('.band__pip'), `band ${band}`).toHaveLength(BAND_PIPS);
      expect(chip.querySelectorAll('.band__pip[data-on="true"]'), `band ${band}`).toHaveLength(band);
      // The number stays available through the tooltip it already had.
      expect(chip.dataset['tip'], `band ${band}`).toBe(`band:${band}`);
      expect(chip.getAttribute('aria-label'), `band ${band}`).toContain(String(band));
    }
  });
});

describe('one tooltip layer, and Pocket keeps every fact within one tap', () => {
  /**
   * Required test 6. **Exactly one tooltip mechanism after this patch.**
   *
   * The patch adds two trigger kinds — `stages:` for the collapsed stage
   * marker and `movefact:` for a strip icon — and both are keys on the layer
   * that already existed. A second mechanism would look like a second module
   * mounting its own listeners, so that is what is counted: one `createTooltips`
   * definition, one call site that mounts it.
   */
  it('mounts one layer, and the new kinds are keys on it', () => {
    const files = sources(join(process.cwd(), 'src/ui'));
    const defines = files.filter(([, text]) => text.includes('export function createTooltips'));
    expect(defines.map(([path]) => path)).toEqual(['tooltips.ts']);

    // Two hosts, one layer. `app.ts` mounts it on the running game and
    // `gallery.ts` on the surface gallery, which are the two entry points this
    // repo has; a third *module* mounting one would be a second mechanism, a
    // second entry point mounting the same one is not.
    const mounts = files.filter(([path, text]) => path !== 'tooltips.ts' && text.includes('createTooltips('));
    expect(mounts.map(([path]) => path).sort()).toEqual(['app.ts', 'gallery.ts']);

    const layer = files.find(([path]) => path === 'tooltips.ts')![1];
    for (const kind of ['stages', 'movefact']) {
      expect(layer, `${kind} must be a kind on the one layer`).toContain(`'${kind}',`);
    }
  });

  /**
   * Required test 7. **Pocket removes no fact.**
   *
   * Detailed and Simple print a chip per non-zero stage. Pocket has no width
   * for a multiplier and a ladder per stage, so it prints one marker and the
   * set is behind one tap — and this drives that tap through the real layer,
   * rather than asserting that a string was written into an attribute.
   *
   * The stylesheet half is asserted too: a rule that hid the chips without
   * showing the marker would pass every DOM assertion here and lose the facts
   * on the one mode that needs them most.
   */
  /*
   * **The gesture changed under this test, and the substance did not.**
   * M1.2 made inspect a long press, per design bible R5, so the tap this test
   * used to perform now selects rather than opens. What it asserts — that every
   * fact the inline chips carried is in the panel — is unchanged.
   */
  it('opens the whole stage set from the collapsed marker on a long press', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    // Hold of zero, so the press resolves on the next macrotask instead of
    // making the suite wait out a real 450ms.
    const layer = createTooltips(host, { ...DEFAULT_DISPLAY_TUNING, inspectHoldMs: 0 });

    const marker = document.createElement('span');
    marker.dataset['tip'] = 'stages:active';
    marker.dataset['detail'] = ['Atk\t2.0x\t+2', 'Spe\t0.7x\t-1', 'Eva\t1.3x\t+1'].join('\n');
    host.append(marker);

    marker.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const text = layer.root.textContent ?? '';
    // Every fact the inline chips would have carried, in the panel one tap
    // away: the stat, the multiplier and the stage.
    for (const fragment of ['Atk', '2.0x', '(+2)', 'Spe', '0.7x', '(-1)', 'Eva', '1.3x', '(+1)']) {
      expect(text, fragment).toContain(fragment);
    }

    layer.destroy();
    host.remove();
  });

  it('swaps the chips for the marker in Pocket rather than hiding both', () => {
    const css = readFileSync(join(process.cwd(), 'src/ui/styles.css'), 'utf8');
    expect(css).toContain(':root[data-density="pocket"] .panel__stages .badge--stage { display: none; }');
    expect(css).toContain(':root[data-density="pocket"] .panel__stages .badge--stages { display: inline-flex; }');
  });
});

/** Every `.ts` under a directory, as `[relative path, text]`. */
function sources(root: string): [string, string][] {
  const out: [string, string][] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.ts')) out.push([relative(root, full), readFileSync(full, 'utf8')]);
    }
  };
  walk(root);
  return out;
}
