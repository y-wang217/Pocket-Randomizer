/**
 * Stage 5.0/0 spike. Throwaway: writes spike/map-data.json from `previewRun`
 * for five seeds so the static map page has real node data to draw. Not wired
 * into the app, not imported by anything under src/.
 *
 * Run: npx vite-node spike/gen-map-data.ts
 */
import { writeFileSync } from 'node:fs';

import { CONTENT_HASH } from '../src/core/contentHash';
import { previewRun } from '../src/core/preview';
import { localeById } from '../src/data/locales';

// Five seeds, each shown at a different segment so the page covers the whole
// step curve (4-5 at segment 0, 6-7 at segment 7).
const CASES = [
  { seed: 'SPIKE-0001', segment: 0 },
  { seed: 'SPIKE-0002', segment: 2 },
  { seed: 'SPIKE-0003', segment: 4 },
  { seed: 'SPIKE-0004', segment: 6 },
  { seed: 'SPIKE-0005', segment: 7 },
];

const out = CASES.map(({ seed, segment: segmentIndex }) => {
  const preview = previewRun(seed, CONTENT_HASH);
  const segment = preview.segments[segmentIndex];
  if (!segment) throw new Error(`no segment ${segmentIndex}`);
  // The longest offered route, so the fit question is asked of the worst case.
  const route = [...segment.routes].sort((a, b) => b.steps.length - a.steps.length)[0];
  if (!route) throw new Error('no route');
  const locale = localeById(route.locale);
  return {
    seed,
    segment: segmentIndex,
    locale: route.locale,
    localeName: locale?.name ?? route.locale,
    leader: segment.leader,
    gymType: segment.type,
    gymTeamSize: segment.gym.encounter?.team.length ?? 0,
    steps: route.steps.map((step) =>
      step.options.map((node) => ({
        id: node.id,
        kind: node.kind,
        tier: node.tier,
        requires: node.event?.requires ?? null,
      })),
    ),
    gym: { id: segment.gym.id, kind: 'gym', tier: null, requires: null },
  };
});

writeFileSync(new URL('./map-data.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(out.map((c) => `${c.seed} seg${c.segment} ${c.locale} steps=${c.steps.length} widths=${c.steps.map((s) => s.length).join('')}`).join('\n'));
