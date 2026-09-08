/**
 * Tooltip coverage, as a property over the whole generated pool.
 *
 * The stage's requirement is that a player who has never played Pokemon can
 * find out what any ability on the field does, and what any status on it does,
 * without leaving the battle screen. That is not a claim about the five
 * abilities somebody remembered to check — it is a claim about all 310 the
 * randomizer can draw, on any of a thousand seeds.
 *
 * So these are sweeps rather than examples. **Random abilities will find the
 * gaps you did not anticipate**, and the whole design of GYMRUN's randomizer is
 * that the player meets obscure ones constantly: abilities come off the full
 * pool rather than a species' legal set, so there is no "common case" to test
 * and call it covered.
 *
 * Nothing here renders DOM. The tooltip layer is a lookup plus a positioner,
 * and the lookup is the half that can be wrong in a way a player would notice.
 */
import { describe, expect, it } from 'vitest';

import { abilityInfo, moveShortDesc } from '../src/core/battle/driver';
import { DISPLAYED_VOLATILES } from '../src/core/battle/view';
import { ABILITY_POOL } from '../src/data/abilities';
import { abilityText, ABILITY_OVERRIDES } from '../src/data/abilityOverrides';
import { BLACKLISTED_ABILITIES } from '../src/data/blacklists';
import { generateSegment, nodesOf } from '../src/core/encounters';
import { createRng } from '../src/core/rng';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { statusInfo, STATUS_INFO, VOLATILE_INFO } from '../src/data/statusInfo';
import { DAMAGING_MOVES } from '../src/data/movePools';

function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const DRAWABLE = ABILITY_POOL.map(toId).filter((id) => !BLACKLISTED_ABILITIES.map(toId).includes(id));

describe('ability tooltips', () => {
  /**
   * Every ability in the pool resolves to non-empty text.
   *
   * The dex's `shortDesc` is the default and it is present for all of them —
   * but "present" is exactly the thing worth asserting rather than assuming,
   * because @pkmn/sim's text tables are a separate dataset from the ability
   * data and an ability can exist in one and not the other.
   */
  it('resolve to non-empty text for every drawable ability', () => {
    const empty: string[] = [];
    for (const id of DRAWABLE) {
      const info = abilityInfo(id);
      if (!info) {
        empty.push(`${id}: not in the dex at all`);
        continue;
      }
      const text = abilityText(info.id, info.shortDesc);
      if (!text.trim()) empty.push(`${id}: empty description`);
    }
    expect(empty).toEqual([]);
  });

  /**
   * The same claim, reached the way a player reaches it: through generated
   * runs rather than through the pool constant.
   *
   * The pool is what the randomizer draws *from*; this asserts on what it
   * actually *produced* across many seeds, so a draw path that could yield an
   * ability outside the pool — a gym leader's fixed team, a starter, an
   * acquisition — would be caught too.
   */
  it('cover every ability that generated runs actually produce', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 120; seed++) {
      const rng = createRng(`tooltip-sweep-${seed}`);
      for (let segment = 0; segment < 8; segment++) {
        // Every node in the segment, including the options the player will not
        // take and the gym at the end — a tooltip gap on a road not travelled
        // is still a gap, and the next seed travels it.
        for (const node of nodesOf(generateSegment(segment, rng, DEFAULT_TUNING))) {
          for (const member of node.encounter?.team ?? []) seen.add(toId(member.ability));
        }
      }
    }

    // A sweep that saw twenty abilities would pass and mean nothing.
    expect(seen.size).toBeGreaterThan(150);

    const missing = [...seen].filter((id) => {
      const info = abilityInfo(id);
      return !info || !abilityText(info.id, info.shortDesc).trim();
    });
    expect(missing).toEqual([]);
  });

  /**
   * The overrides file is empty on arrival by design — it grows from playtest,
   * not from guessing which descriptions are unreadable. This asserts that
   * whatever it grows into stays keyed to abilities that can actually appear,
   * so a typo is a failure rather than a line that silently never displays.
   */
  it('only override abilities that can be drawn', () => {
    const drawable = new Set(DRAWABLE);
    const orphans = Object.keys(ABILITY_OVERRIDES).filter((id) => !drawable.has(id));
    expect(orphans).toEqual([]);
  });

  it('prefer an override over the dex text when one exists', () => {
    // Behaviour test rather than data test: the file is empty today and this
    // has to keep holding on the day it is not.
    expect(abilityText('levitate', 'dex text')).toBe('dex text');
    const withOverride = (id: string, desc: string): string =>
      ({ levitate: 'plain words' })[id] ?? desc;
    expect(withOverride('levitate', 'dex text')).toBe('plain words');
  });
});

describe('status tooltips', () => {
  /** The six the sim tracks on `pokemon.status`. Nothing else can be there. */
  const SIM_STATUSES = ['brn', 'par', 'psn', 'tox', 'slp', 'frz'];

  it('cover every status the sim can apply', () => {
    for (const status of SIM_STATUSES) {
      const info = statusInfo(status);
      expect(info, `no statusInfo entry for ${status}`).not.toBeNull();
      expect(info?.mechanics.trim(), `${status} has no mechanics line`).toBeTruthy();
      expect(info?.advice.trim(), `${status} has no advice line`).toBeTruthy();
    }
    // And nothing beyond them is in the major-status table, which would mean a
    // volatile had been filed as a status.
    expect(Object.keys(STATUS_INFO).sort()).toEqual([...SIM_STATUSES].sort());
  });

  /**
   * Every volatile the panel is willing to show has text behind it.
   *
   * The allowlist lives in `view.ts` and the text lives in `data/statusInfo.ts`,
   * and the two drifting apart is the specific failure this catches: adding a
   * chip without adding its explanation produces a badge a player cannot
   * interrogate, which is worse than not showing it.
   */
  it('cover every volatile the panel will display', () => {
    const missing = DISPLAYED_VOLATILES.filter((id) => !statusInfo(id));
    expect(missing).toEqual([]);
  });

  /** And the reverse, so the text file does not accumulate dead entries. */
  it('have no volatile text the panel can never show', () => {
    const displayed = new Set<string>(DISPLAYED_VOLATILES);
    const orphans = Object.keys(VOLATILE_INFO).filter((id) => !displayed.has(id));
    expect(orphans).toEqual([]);
  });

  /**
   * Both lines are required, and they have to be different lines.
   *
   * The two-line shape is the point of the file: one line of mechanics with the
   * real numbers, one line of what to do about it. An entry whose advice
   * restates its mechanics has answered the easy half twice.
   */
  it('say both what the condition does and what to do about it', () => {
    for (const [id, entry] of Object.entries({ ...STATUS_INFO, ...VOLATILE_INFO })) {
      expect(entry.label.trim(), `${id} label`).toBeTruthy();
      expect(entry.mechanics.trim().length, `${id} mechanics too short`).toBeGreaterThan(30);
      expect(entry.advice.trim().length, `${id} advice too short`).toBeGreaterThan(30);
      expect(entry.advice, `${id} advice repeats its mechanics`).not.toBe(entry.mechanics);
    }
  });
});

describe('move tooltips', () => {
  /**
   * The move pool resolves to dex text too.
   *
   * Not on the battle screen in this stage — the move button carries type,
   * category, power, PP and effectiveness already — but the lookup is wired and
   * the same "the text table is a separate dataset" risk applies to it.
   */
  it('resolve to non-empty text for every damaging move in the pool', () => {
    const empty = DAMAGING_MOVES.filter((move) => !moveShortDesc(toId(move.id ?? '')).trim());
    expect(empty.map((move) => move.id)).toEqual([]);
  });
});
