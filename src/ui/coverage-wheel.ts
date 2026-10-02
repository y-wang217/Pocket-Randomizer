/**
 * The coverage wheel: eighteen spokes, one per type in the chart's order,
 * the ones the party's damaging moves reach filled. Read from
 * `offensiveCoverage` and nothing else. No score, no count, no colour that
 * says whether eleven of eighteen is good.
 *
 * **Its own module since the Team screen's *Coverage* view (bible Rev 22,
 * D93) became its second call site.** It was the summary's private function;
 * two copies of one readout is how the two would drift.
 */
import { WHEEL_TYPES } from '../core/battle/driver';
import { offensiveCoverage } from '../core/coverage';
import type { PokemonState } from '../core/types';
import { el } from './dom';

export function coverageWheel(party: readonly PokemonState[]): HTMLElement {
  const covered = new Set(offensiveCoverage(party));
  const size = 120;
  const centre = size / 2;
  const spokes = WHEEL_TYPES.map((type, index) => {
    const angle = (index / WHEEL_TYPES.length) * Math.PI * 2 - Math.PI / 2;
    const x = centre + Math.cos(angle) * (centre - 14);
    const y = centre + Math.sin(angle) * (centre - 14);
    const hit = covered.has(type);
    return (
      `<line x1="${centre}" y1="${centre}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="coverage__spoke${hit ? ' coverage__spoke--covered' : ''}" data-type="${type}"/>` +
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${hit ? 4 : 2}" class="coverage__tip${hit ? ' coverage__tip--covered' : ''}" data-type="${type}"><title>${type}${hit ? '' : ' (not reached)'}</title></circle>`
    );
  });
  const wheel = el('div', 'coverage__wheel');
  wheel.innerHTML = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Types the party's moves reach">${spokes.join('')}</svg>`;
  const legend = el('p', 'coverage__legend');
  legend.textContent = covered.size === 0 ? 'No damaging moves.' : `Reaches ${[...covered].join(', ')}.`;
  const box = el('div', 'coverage__box');
  box.append(wheel, legend);
  return box;
}
