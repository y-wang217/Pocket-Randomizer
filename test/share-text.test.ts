/**
 * The shareable result, as text. **Stage 4.8, item 6.**
 *
 * The result screen is the artifact of a run, and this is the artifact leaving the
 * device: one tap puts a plain-text version on the clipboard. No image, no canvas,
 * no share sheet — text is the whole feature.
 *
 * `shareText` is pure, which is the only reason this file can exist: the format is
 * asserted here rather than by pasting into a chat client and squinting.
 *
 * ## What the assertions are really protecting
 *
 * The destination is Discord or a message thread, and **that decides the format**.
 * Every check below traces back to one of three constraints: it must not assume a
 * monospace font, it must be short enough to read without scrolling, and it must not
 * leak anything the result screen would not also say.
 */
import { describe, expect, it } from 'vitest';

import type { DeathRecord } from '../src/core/graveyard';
import { scoreRun } from '../src/core/scoring';
import { createRun } from '../src/core/run';
import { formatSeedString } from '../src/core/seedString';
import { deathLine, GRAVE_LIMIT, seedLine, shareText, type ShareView } from '../src/ui/copy/share';

const death = (over: Partial<DeathRecord> = {}): DeathRecord => ({
  nickname: 'Bramble',
  species: 'Weepinbell',
  level: 31,
  segment: 4,
  nodeKind: 'gym',
  nodeId: 's4-gym',
  bySpecies: 'Arcanine',
  byMove: 'Flare Blitz',
  indirect: null,
  ...over,
});

const view = (over: Partial<ShareView> = {}): ShareView => ({
  seed: 'SMOKE24',
  outcome: 'defeat',
  gymsCleared: 4,
  gymTotal: 8,
  score: scoreRun(createRun('SHARE-A')),
  party: [{ species: 'Charmander', level: 40 }],
  deaths: [],
  relics: [],
  locales: [],
  ...over,
});

describe('the seed is rendered in one place', () => {
  it('is the versioned seed string', () => {
    // The `contentHash` release put the versioned form here and nowhere else
    // — which is the whole reason this function exists.
    expect(seedLine('SMOKE24')).toBe(`Seed ${formatSeedString('SMOKE24')}`);
    expect(seedLine('SMOKE24')).toMatch(/^Seed GYMRUN-[0-9a-f]{6}-SMOKE24$/);
  });

  it('is the only thing in the text that names the seed', () => {
    const text = shareText(view({ seed: 'UNIQUESEED' }));
    const hits = text.split('UNIQUESEED').length - 1;
    expect(hits, 'the seed is printed more than once').toBe(1);
  });
});

describe('a death line', () => {
  it('states the facts and nothing about them', () => {
    expect(deathLine(death())).toBe('Weepinbell, Lv31, fell at Gym 5 to Arcanine, Flare Blitz.');
  });

  it('says where it fell when it was not a gym', () => {
    expect(deathLine(death({ nodeKind: 'wild', segment: 0 }))).toContain('in region 1');
  });

  it('names an indirect cause when no move landed', () => {
    const line = deathLine(death({ byMove: null, bySpecies: null, indirect: 'psn' }));
    expect(line).toContain('to psn');
  });

  it('says nothing about a cause it does not know', () => {
    const line = deathLine(death({ byMove: null, bySpecies: null, indirect: null }));
    expect(line).toBe('Weepinbell, Lv31, fell at Gym 5.');
  });

  it('omits a level it could not read rather than printing one', () => {
    expect(deathLine(death({ level: null }))).toBe(
      'Weepinbell, fell at Gym 5 to Arcanine, Flare Blitz.',
    );
  });

  it('carries no commentary, no counterfactual and no verdict', () => {
    const FORBIDDEN = /unlucky|should|could have|sadly|alas|rip|tragic|mistake|better|worse/i;
    for (const record of [death(), death({ level: null }), death({ byMove: null, indirect: 'brn' })]) {
      expect(deathLine(record)).not.toMatch(FORBIDDEN);
    }
  });
});

describe('the whole artifact', () => {
  it('leads with the outcome, the gyms and the score', () => {
    const text = shareText(view({ outcome: 'victory', gymsCleared: 8 }));
    const lines = text.split('\n');
    expect(lines[0]).toBe('GYMRUN — cleared');
    expect(lines[1]).toContain('8 of 8 gyms');
    expect(lines[2]).toBe(`Seed ${formatSeedString('SMOKE24')}`);
  });

  it('says "fell" on a defeat rather than dressing it up', () => {
    expect(shareText(view()).split('\n')[0]).toBe('GYMRUN — fell');
  });

  it('assumes no monospace font: no padding, no box drawing, no tabs', () => {
    /*
     * The constraint the whole format follows from. A chat client renders this in a
     * proportional font, so any alignment done with spaces or rules becomes a ragged
     * mess — structure has to come from line breaks and short labels instead.
     */
    const text = shareText(
      view({
        deaths: [death(), death({ nickname: 'Pebble', species: 'Onix' })],
        relics: ['Ironbound Gauntlet'],
        locales: ['The Marsh', 'The Cave'],
        party: [
          { species: 'Charmander', level: 40 },
          { species: 'Pidgeotto', level: 40 },
        ],
      }),
    );
    expect(text).not.toMatch(/\t/);
    expect(text, 'box drawing characters').not.toMatch(/[│┌┐└┘─┬┴├┤╔╗╚╝║═]/);
    expect(text, 'two or more spaces used to align a column').not.toMatch(/\S {2,}\S/);
  });

  it('caps the graveyard so a long run does not become a wall', () => {
    const many = Array.from({ length: GRAVE_LIMIT + 5 }, (_unused, i) =>
      death({ nickname: `Mon${i}` }),
    );
    const text = shareText(view({ deaths: many }));

    const rows = text.split('\n').filter((line) => line.startsWith('· ') && line.includes('fell'));
    expect(rows).toHaveLength(GRAVE_LIMIT);
    expect(text).toContain(`and 5 more.`);
    // The count in the heading is the true total, not the shown one.
    expect(text).toContain(`Fell in battle (${GRAVE_LIMIT + 5})`);
  });

  it('skips a zero-scoring component here, though the screen still shows it', () => {
    /*
     * The one place the two readouts deliberately differ. "Turns taken 0" is a
     * column the result screen keeps so a later pass can read history out of it, and
     * noise in a chat message.
     */
    const score = scoreRun(createRun('SHARE-ZERO'));
    const text = shareText(view({ score }));
    expect(text).not.toContain('Turns taken');
  });

  it('omits every section a run has nothing for', () => {
    const text = shareText(view({ party: [], deaths: [], relics: [], locales: [] }));
    expect(text).not.toContain('Party');
    expect(text).not.toContain('Fell in battle');
    expect(text).not.toContain('Relics');
    expect(text).not.toContain('Route');
  });

  it('ends in exactly one newline, so a paste has no ragged tail', () => {
    for (const v of [view(), view({ relics: ['A'] }), view({ deaths: [death()] })]) {
      const text = shareText(v);
      expect(text.endsWith('\n')).toBe(true);
      expect(text.endsWith('\n\n')).toBe(false);
    }
  });

  it('stays short enough to read without scrolling in a chat client', () => {
    // A full run: six party members, the grave cap, relics and eight locales.
    const text = shareText(
      view({
        gymsCleared: 8,
        outcome: 'victory',
        party: Array.from({ length: 6 }, () => ({
          species: 'Pidgeotto',
          level: 60,
        })),
        deaths: Array.from({ length: 12 }, (_u, i) => death({ nickname: `Mon${i}` })),
        relics: ['Ironbound Gauntlet', 'Tidecaller Shell'],
        locales: ['Marsh', 'Cave', 'Shore', 'Forest', 'Ruins', 'Badlands', 'Summit', 'City'],
      }),
    );
    const lines = text.split('\n').filter((line) => line.length > 0);
    expect(lines.length, `${lines.length} lines is a wall in a chat client`).toBeLessThanOrEqual(30);
  });

  it('is pure: the same view shares the same text', () => {
    const v = view({ deaths: [death()], relics: ['A'], locales: ['Marsh'] });
    const first = shareText(v);
    for (let i = 0; i < 4; i++) expect(shareText(v)).toBe(first);
  });
});
