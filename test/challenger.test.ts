/**
 * The boss is a challenger. **Stage 6.0, checkpoint 6.**
 *
 * @vitest-environment jsdom
 *
 * What the node reads, what the segment carries, and what the screens no
 * longer show. The challenger has no type (ruling 3), so no surface may show
 * one for it: the pre-gym heading, the map heading and rail, and the locale
 * rail each read the class and the name and carry no type chip. The lead
 * question is unchanged and still logs, which is why `RUN_LOG_VERSION` holds.
 */
import { describe, expect, it } from 'vitest';

import { encounterById } from '../src/data/encounters';
import { GYMS, gymForSegment } from '../src/data/gyms';
import { createRun, RUN_LOG_VERSION } from '../src/core/run';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { createPreGymScreen } from '../src/ui/screens/pre-gym';
import { createLocaleSelect } from '../src/ui/screens/locale-select';
import { renderHeading, renderRail } from '../src/ui/screens/run-map';

const ROLES = new Set(['rival', 'gym', 'elite']);
const TITLED = new Set(['Red', 'Blue', 'Green', 'Leaf', 'Trace', 'Hau']);

describe('the segment', () => {
  it('names a challenger by class and name, with the kind word in front, for every segment of three seeds', () => {
    for (const seed of ['CHALLENGER-A', 'CHALLENGER-B', 'CHALLENGER-C']) {
      const run = createRun(seed, DEFAULT_TUNING);
      expect(run.segments).toHaveLength(8);
      run.segments.forEach((segment, index) => {
        const source = segment.gym.encounter!.source!;
        const record = encounterById(source.id)!;
        expect(ROLES.has(record.role) || TITLED.has(record.trainer.name), `${source.id} is a ${record.role}`).toBe(true);
        expect(segment.leader).toBe(record.trainer.name);
        const opponent = segment.gym.encounter!.opponent;
        expect(opponent).toBe(record.trainer.name === record.trainer.class ? record.trainer.class : `${record.trainer.class} ${record.trainer.name}`);
        expect(segment.gym.label).toBe(`Challenger ${opponent}`);
        expect(segment.gymDefinition).toEqual(GYMS[index]);
        expect(segment.gymDefinition).not.toHaveProperty('type');
      });
      // The same seed, the same eight.
      expect(createRun(seed, DEFAULT_TUNING).segments.map((s) => s.gymEncounter.id)).toEqual(run.segments.map((s) => s.gymEncounter.id));
    }
  });

  it('casts more than one role across the eight slots of a seed, somewhere in twenty', () => {
    const roles = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      for (const segment of createRun(`CAST-${seed}`, DEFAULT_TUNING).segments) {
        roles.add(encounterById(segment.gymEncounter.id)!.role);
      }
    }
    expect(roles.size).toBeGreaterThan(1);
  });

  it('keeps the lead question on the log schema it had', () => {
    // A logged decision neither added nor removed: the challenger changes the
    // opponent, not the questions.
    expect(RUN_LOG_VERSION).toBe('gymrun-run-23/gymrun-0.3.0');
  });
});

describe('the screens', () => {
  const run = createRun('CHALLENGER-UI', DEFAULT_TUNING);
  const segment = run.segments[0]!;
  const opponent = segment.gym.encounter!.opponent;

  it('read the challenger on the pre-gym heading and carry no type chip', () => {
    const screen = createPreGymScreen();
    document.body.replaceChildren(screen.root);
    screen.render(
      { gym: gymForSegment(0), leader: segment.leader, challenger: opponent, segment: 0, party: run.party, holding: run.party.map(() => null), tuning: DEFAULT_TUNING },
      { onLead: () => undefined, onManageParty: () => undefined },
    );
    expect(screen.root.querySelector('.screen__title')?.textContent).toBe(opponent);
    expect(screen.root.querySelector('.pre-gym__type')).toBeNull();
    expect(screen.root.querySelector('.pre-gym .type')).toBeNull();
  });

  it('read the challenger on the map heading and the rail with no type chip', () => {
    const heading = el(renderHeading(run, segment));
    expect(heading.querySelector('.screen__title')?.textContent).toBe(`Challenger 1 of 8 — ${opponent}`);
    expect(heading.querySelector('.type')).toBeNull();
    const rail = el(renderRail(run));
    const items = [...rail.querySelectorAll('.rail__gym')];
    expect(items).toHaveLength(8);
    items.forEach((item, index) => {
      expect(item.querySelector('.rail__label')?.textContent).toBe(run.segments[index]!.leader);
      expect(item.querySelector('.type')).toBeNull();
    });
  });

  it('read the challenger on the locale rail with no type chip', () => {
    const screen = createLocaleSelect();
    document.body.replaceChildren(screen.root);
    screen.render(
      {
        options: segment.localeOffer,
        segment: 0,
        gym: gymForSegment(0),
        leader: segment.leader,
        challenger: opponent,
        party: run.party,
      },
      () => undefined,
    );
    expect(screen.root.querySelector('.locale__gym-leader')?.textContent).toBe(opponent);
    expect(screen.root.querySelector('.locale__gym-type')).toBeNull();
    expect(screen.root.querySelector('.locale__gym .type')).toBeNull();
  });
});

function el(children: HTMLElement[]): HTMLElement {
  const root = document.createElement('div');
  root.append(...children);
  return root;
}
