/**
 * Seed strings carry their content hash, and a foreign one is caught before a
 * run starts.
 *
 *   - Display: `GYMRUN-<six hex>-<seed>`, from this build's hash.
 *   - Round trip: what is displayed parses back to the same seed and the same
 *     run, byte for byte in the log.
 *   - Bare: a seed with no prefix is exactly what it always was.
 *   - Foreign: another build's hash is classified as such, with both hashes
 *     available for the message, and the bare seed handed back for a fresh run.
 *   - `previewRun` refuses a foreign hash by the same classification, accepts
 *     the full hash or the display form, and draws the map `createRun` draws.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { CONTENT_HASH, shortContentHash } from '../src/core/contentHash';
import { ForeignContentHashError, previewRun } from '../src/core/preview';
import { createRng } from '../src/core/rng';
import { createRun, playRun, scriptedRunPolicy } from '../src/core/run';
import { formatSeedString, matchesContentHash, parseSeedString } from '../src/core/seedString';
import { foreignSeedMessage, SEED_COPY } from '../src/data/seedCopy';

const SHORT = shortContentHash();
/** A hash that is certainly not this build's: the display form with every character rotated. */
const OTHER = SHORT.replace(/[0-9a-f]/g, (c) => ((parseInt(c, 16) + 1) % 16).toString(16));

describe('the display form', () => {
  it('is GYMRUN, the first six of the hash, and the normalised seed', () => {
    expect(formatSeedString('smoke24')).toBe(`GYMRUN-${SHORT}-SMOKE24`);
    expect(formatSeedString('  seed-a ')).toBe(`GYMRUN-${SHORT}-SEED-A`);
    expect(SHORT).toMatch(/^[0-9a-f]{6}$/);
    expect(CONTENT_HASH.startsWith(SHORT)).toBe(true);
  });

  it('takes an explicit hash, so a preview page can render another build\'s form', () => {
    expect(formatSeedString('X', 'abcdef0123456789')).toBe('GYMRUN-abcdef-X');
  });
});

describe('the paste-time parse', () => {
  it('round-trips the display form to the same seed', () => {
    expect(parseSeedString(formatSeedString('SMOKE24'))).toEqual({ kind: 'match', seed: 'SMOKE24', hash: SHORT });
  });

  it('forgives case and whitespace, the way the seed box always has', () => {
    expect(parseSeedString(`  gymrun-${SHORT.toUpperCase()}-smoke24\n`)).toEqual({
      kind: 'match',
      seed: 'SMOKE24',
      hash: SHORT,
    });
  });

  it('reads a bare seed exactly as before', () => {
    expect(parseSeedString('SMOKE24')).toEqual({ kind: 'bare', seed: 'SMOKE24' });
    expect(parseSeedString(' abc ')).toEqual({ kind: 'bare', seed: 'ABC' });
    expect(parseSeedString('GYMRUN-notahash-X')).toEqual({ kind: 'bare', seed: 'GYMRUN-NOTAHASH-X' });
  });

  it('classifies another build\'s hash as foreign and hands back the bare seed', () => {
    expect(parseSeedString(`GYMRUN-${OTHER}-SMOKE24`)).toEqual({
      kind: 'foreign',
      seed: 'SMOKE24',
      hash: OTHER,
      expected: SHORT,
    });
  });

  it('has copy in data/ that names both hashes', () => {
    const message = foreignSeedMessage(OTHER, SHORT);
    expect(message).toContain(OTHER);
    expect(message).toContain(SHORT);
    expect(message).toMatch(/different balance version/);
    expect(message).toMatch(/will not reproduce/);
    expect(SEED_COPY.foreign).toContain('{theirs}');
    expect(SEED_COPY.foreign).toContain('{ours}');
  });

  it('matches the full hash and the display form, and nothing shorter', () => {
    expect(matchesContentHash(CONTENT_HASH)).toBe(true);
    expect(matchesContentHash(SHORT)).toBe(true);
    expect(matchesContentHash(SHORT.toUpperCase())).toBe(true);
    expect(matchesContentHash(SHORT.slice(0, 5))).toBe(false);
    expect(matchesContentHash(OTHER)).toBe(false);
    expect(matchesContentHash('')).toBe(false);
  });
});

describe('the run behind the string', () => {
  it('is the identical run, log for log, whether started from the bare seed or the pasted string', async () => {
    const pasted = parseSeedString(formatSeedString('SEED-A'));
    expect(pasted.kind).toBe('match');
    const fromBare = await playRun('SEED-A', scriptedRunPolicy(greedyAiPolicy));
    const fromPasted = await playRun(pasted.seed, scriptedRunPolicy(greedyAiPolicy));
    expect(JSON.stringify(fromPasted.log)).toBe(JSON.stringify(fromBare.log));
    expect(fromPasted.outcome).toBe(fromBare.outcome);
  });

  it('consumes no RNG to format or parse', () => {
    const rng = createRng('NO-DRAWS');
    formatSeedString('NO-DRAWS');
    parseSeedString(`GYMRUN-${OTHER}-NO-DRAWS`);
    expect(rng.map.totalDraws + rng.battle.totalDraws + rng.randomizer.totalDraws).toBe(0);
  });
});

describe('previewRun', () => {
  it('takes (seed, contentHash) and draws the map createRun draws, with no battle', () => {
    const preview = previewRun('PREVIEW-1', CONTENT_HASH);
    const run = createRun('PREVIEW-1');
    expect(preview.seed).toBe('PREVIEW-1');
    expect(preview.contentHash).toBe(CONTENT_HASH);
    expect(preview.segments).toEqual(run.segments);
    expect(preview.starterOptions).toEqual(run.starterOptions);
    expect(preview.segments).toHaveLength(8);
    // Every segment carries its locale offer and a route per offered locale,
    // which is what "the whole topology without playing it" means.
    for (const segment of preview.segments) {
      expect(segment.localeOffer.length).toBeGreaterThan(0);
      expect(segment.routes.length).toBe(segment.localeOffer.length);
    }
  });

  it('accepts the display form of the hash', () => {
    expect(previewRun('PREVIEW-2', SHORT).segments).toEqual(createRun('PREVIEW-2').segments);
  });

  it('refuses a foreign hash the way the seed bar does, naming both', () => {
    expect(() => previewRun('PREVIEW-3', OTHER)).toThrow(ForeignContentHashError);
    expect(() => previewRun('PREVIEW-3', OTHER)).toThrow(new RegExp(OTHER));
    expect(() => previewRun('PREVIEW-3', OTHER)).toThrow(new RegExp(SHORT));
    // And the seed bar's classification agrees, which is the point of sharing it.
    expect(parseSeedString(`GYMRUN-${OTHER}-PREVIEW-3`).kind).toBe('foreign');
  });
});
