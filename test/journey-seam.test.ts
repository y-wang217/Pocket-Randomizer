/**
 * The journey's seams. **The map calm-down and journey vignettes patch,
 * bible Rev 31, D113**, its test 7: *"Every map commit and node completion
 * passes through the one transition seam, so no screen can skip its vignette
 * by accident."*
 *
 * Read off the source of `ui/app.ts`, as `test/boundaries.test.ts` reads
 * imports, because the claim is about the shape of the code: there is one
 * place a beat is played from, one place the map is shown from a question,
 * and every answer that commits to a node goes through `enterNode`. A new
 * question that showed the map itself, or answered a node without the beat,
 * fails here rather than in a playtest.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const APP = readFileSync(join(process.cwd(), 'src/ui/app.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

/** The body of a policy method, from its name to the next method at its depth. */
function method(name: string): string {
  const start = APP.indexOf(`      ${name}: (`);
  expect(start, name).toBeGreaterThan(-1);
  const next = APP.slice(start + 1).search(/\n {6}[a-zA-Z]+: \(/);
  return APP.slice(start, next === -1 ? undefined : start + 1 + next);
}

describe('every beat plays through one seam (test 7)', () => {
  it('plays a vignette from one place only', () => {
    expect(APP.match(/journey\.play\(/g)).toHaveLength(1);
    const beat = APP.indexOf('const beat = ');
    const play = APP.indexOf('journey.play(');
    expect(beat).toBeGreaterThan(-1);
    expect(play).toBeGreaterThan(beat);
    // The one call is the body of `beat`: nothing between them ends a statement.
    expect(APP.slice(beat, play)).not.toContain(';');
  });

  it('shows the map from a question only through arriveAtMap', () => {
    const shown = [...APP.matchAll(/showScreen\('map'\)/g)].map((match) => match.index!);
    const seam = APP.indexOf('const arriveAtMap = ');
    const end = APP.indexOf('};', seam);
    for (const at of shown) {
      const inSeam = at > seam && at < end;
      const fromParty = APP.slice(Math.max(0, at - 400), at).includes('leavePartyForMap');
      expect(inSeam || fromParty, `showScreen('map') at ${at}`).toBe(true);
    }
  });

  it('answers every map pick through the map seam and the commit seam', () => {
    for (const name of ['chooseNode', 'chooseDoor']) {
      const body = method(name);
      expect(body, name).toContain('arriveAtMap()');
      expect(body, name).toMatch(/enterNode\(options\[index\], index\)/);
      expect(body, name).not.toContain("showScreen('map')");
    }
  });

  it("answers the gym's entry through the commit seam", () => {
    expect(method('chooseLead')).toMatch(/enterNode\(live\?\.segments\[live\.currentSegment\]\?\.gym, lead\)/);
  });

  it("arms the return beat on a region's first map", () => {
    expect(method('chooseLocale')).toContain('returnDue = true');
  });

  it('lets rest end without the return beat, and every other kind arm it', () => {
    expect(APP).toContain("returnDue = node.kind !== 'rest';");
  });
});
