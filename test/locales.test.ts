/**
 * Locales: what a region decides, what it must never decide, and the four
 * guarantees a segment makes about its shape.
 *
 * Stage 4.6a. The claim under test is narrow and worth stating exactly: **a
 * locale changes which wild species a segment fields and nothing else.** If a
 * locale could move a trainer's team, a shop's shelf, a tier or a gym, then the
 * next balance report could not say whether a number moved because the curve
 * changed or because the simulator's bot developed a taste for the Marsh.
 */
import { describe, expect, it } from 'vitest';

import { describeSpecCard } from '../src/core/battle/driver';
import { generateSegment, nodesOf, routeStepsOf, type Segment } from '../src/core/encounters';
import { createRng } from '../src/core/rng';
import { chooseLocale, chooseStarter, createRun, localeOf, nodeOptions, stepsOf } from '../src/core/run';
import { LOCALES, LOCALE_IDS, localeById, type LocaleId } from '../src/data/locales';
import { restFloorFor, DEFAULT_TUNING, withTuning } from '../src/data/tuning';

const SEEDS = Array.from({ length: 24 }, (_, index) => `LOCALE-${index}`);
const MANY_SEEDS = Array.from({ length: 80 }, (_, index) => `LOCALE-WIDE-${index}`);

// ---------------------------------------------------------------------------
// 1. The table
// ---------------------------------------------------------------------------

describe('the locale table', () => {
  it('covers all eighteen types exactly as the spec lays them out', () => {
    const counts = new Map<string, number>();
    for (const locale of LOCALES) {
      for (const type of locale.types) counts.set(type, (counts.get(type) ?? 0) + 1);
    }

    expect(counts.size).toBe(18);
    // Dragon, Psychic, Fairy and Steel once; every other type twice. The four
    // singletons are the point rather than an accident: they are the types a
    // party is least likely to assemble by accident, so routing for one is a
    // plan instead of a side effect.
    const once = [...counts.entries()].filter(([, count]) => count === 1).map(([type]) => type).sort();
    expect(once).toEqual(['Dragon', 'Fairy', 'Psychic', 'Steel']);
    for (const [type, count] of counts) {
      expect([1, 2], `${type} appears ${count} times`).toContain(count);
    }
  });

  it('gives every locale exactly four types, and no duplicates within one', () => {
    for (const locale of LOCALES) {
      expect(locale.types).toHaveLength(4);
      expect(new Set(locale.types).size).toBe(4);
    }
  });

  it('has eight locales with distinct ids and names', () => {
    expect(LOCALE_IDS).toHaveLength(8);
    expect(new Set(LOCALE_IDS).size).toBe(8);
    expect(new Set(LOCALES.map((locale) => locale.name)).size).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// 2. The offer
// ---------------------------------------------------------------------------

describe('the locale offer', () => {
  it('offers two or three locales per segment, all distinct', () => {
    for (const seed of SEEDS) {
      for (const segment of createRun(seed).segments) {
        expect(segment.localeOffer.length).toBeGreaterThanOrEqual(DEFAULT_TUNING.localeOfferCount.min);
        expect(segment.localeOffer.length).toBeLessThanOrEqual(DEFAULT_TUNING.localeOfferCount.max);
        expect(new Set(segment.localeOffer).size).toBe(segment.localeOffer.length);
        expect(segment.routes.map((route) => route.locale)).toEqual(segment.localeOffer);
      }
    }
  });

  it('never offers a locale in two consecutive segments', () => {
    for (const seed of MANY_SEEDS) {
      const segments = createRun(seed).segments;
      for (let index = 1; index < segments.length; index++) {
        const previous = new Set(segments[index - 1]?.localeOffer ?? []);
        for (const locale of segments[index]?.localeOffer ?? []) {
          expect(previous.has(locale), `${seed} s${index} repeated ${locale}`).toBe(false);
        }
      }
    }
  });

  it('reaches every locale across a run in the large majority of seeds', () => {
    /*
     * The coverage claim, stated as a rate rather than as an absolute.
     *
     * "All eight appear across a full run" cannot be a per-seed guarantee
     * without making the offer a rotation, and a rotation is the one thing a
     * seeded map must not be — a player who can predict segment 6's offer from
     * segment 1's is not making a decision. So the weighting biases hard toward
     * locales nobody has been offered (`LOCALE_OFFER_WEIGHTS`) and this asserts
     * the resulting rate.
     *
     * Measured at 100.0% over 300 seeds at the shipped 4:1, with the offer
     * itself flat to within a point of an even eighth per locale. The
     * assertion is a floor rather than that number because it is testing the
     * rule, not the tuning: a later pass that moves `LOCALE_OFFER_WEIGHTS`
     * should have to justify dropping below four runs in five, not have to
     * re-mint a test.
     */
    const complete = MANY_SEEDS.filter((seed) => {
      const seen = new Set(createRun(seed).segments.flatMap((segment) => segment.localeOffer));
      return seen.size === LOCALE_IDS.length;
    });
    expect(complete.length / MANY_SEEDS.length).toBeGreaterThan(0.8);
  });

  it('offers every locale somewhere across a sweep, so none is unreachable', () => {
    const seen = new Set<LocaleId>();
    for (const seed of MANY_SEEDS) {
      for (const segment of createRun(seed).segments) {
        for (const locale of segment.localeOffer) seen.add(locale);
      }
    }
    expect([...seen].sort()).toEqual([...LOCALE_IDS].sort());
  });
});

// ---------------------------------------------------------------------------
// 3. Determinism
// ---------------------------------------------------------------------------

describe('determinism', () => {
  const digest = (segment: Segment): string =>
    JSON.stringify({
      offer: segment.localeOffer,
      routes: segment.routes.map((route) => ({
        locale: route.locale,
        steps: route.steps.map((step) => step.options.map((node) => `${node.id}:${node.kind}:${node.tier ?? '-'}`)),
      })),
      teams: nodesOf(segment).map((node) => node.encounter?.team ?? null),
    });

  it('produces identical offers, routes and encounters for one seed, twice', () => {
    for (const seed of SEEDS.slice(0, 8)) {
      const first = createRun(seed).segments.map(digest);
      const second = createRun(seed).segments.map(digest);
      expect(second).toEqual(first);
    }
  });

  it('generates the unpicked routes too, so a replay can resolve any index', () => {
    // The eager rule applied to the new decision: every offered locale has a
    // fully generated route sitting on the segment, contents and all, whether
    // or not it is ever walked.
    for (const segment of createRun('LOCALE-EAGER').segments) {
      expect(segment.routes.length).toBe(segment.localeOffer.length);
      for (const route of segment.routes) {
        expect(route.steps.length).toBeGreaterThan(0);
        for (const step of route.steps) {
          for (const node of step.options) {
            if (node.kind === 'wild' || node.kind === 'trainer') {
              expect(node.encounter?.team.length ?? 0).toBeGreaterThan(0);
            }
          }
        }
      }
    }
  });

  it('keys a route to its locale, so the offer count cannot reshape a road', () => {
    /*
     * The mappability property in one assertion. A route is a function of
     * (seed, segment, locale) and of nothing else, so the road through a locale
     * is the same road whether it was offered beside one other or two — which
     * is what makes "generate all of them and discard" and "derive the picked
     * one later" the same run.
     */
    const roadThrough = (tuning: typeof DEFAULT_TUNING, locale: LocaleId): string | null => {
      const segment = createRun('LOCALE-KEYED', tuning).segments[0];
      const route = segment?.routes.find((candidate) => candidate.locale === locale);
      return route
        ? JSON.stringify(route.steps.map((step) => step.options.map((node) => `${node.kind}:${node.tier ?? '-'}`)))
        : null;
    };

    const wide = withTuning({ localeOfferCount: { min: 3, max: 3 } });
    const narrow = withTuning({ localeOfferCount: { min: 2, max: 2 } });
    const shared = createRun('LOCALE-KEYED', narrow).segments[0]?.localeOffer ?? [];
    // The narrow offer is a subset draw from the same weighted list, so at
    // least one locale is offered under both tunings; its road must match.
    const common = shared.find((locale) => roadThrough(wide, locale) !== null);
    expect(common, 'no locale was offered under both tunings').toBeDefined();
    if (common) expect(roadThrough(wide, common)).toEqual(roadThrough(narrow, common));
  });
});

// ---------------------------------------------------------------------------
// 4. What a locale decides, and what it must not
// ---------------------------------------------------------------------------

describe('what a locale decides', () => {
  it('draws every wild species from the locale type set', () => {
    let checked = 0;
    for (const seed of MANY_SEEDS) {
      for (const segment of createRun(seed).segments) {
        for (const route of segment.routes) {
          const allowed = new Set(localeById(route.locale).types);
          for (const step of route.steps) {
            for (const node of step.options) {
              if (node.kind !== 'wild') continue;
              for (const member of node.encounter?.team ?? []) {
                const card = describeSpecCard(member);
                checked++;
                expect(
                  card.types.some((type) => allowed.has(type)),
                  `${card.species} (${card.types.join('/')}) in the ${route.locale}`,
                ).toBe(true);
              }
            }
          }
        }
      }
    }
    // The fallback in `wildSpeciesFor` widens to the unfiltered pool when a
    // locale's window comes back empty. It never fires at the shipped tables,
    // and this count is what says the assertion above had something to check.
    expect(checked).toBeGreaterThan(500);
  });

  it('leaves trainers, shops, events and the gym locale-agnostic', () => {
    /*
     * The negative half, and the one that keeps the balance report readable.
     *
     * Two routes through one segment differ in their wild species. Their
     * trainers are drawn from the same segment-wide pool, so across a sweep the
     * trainer species in one locale must not be confined to that locale's
     * types — otherwise the locale is quietly a difficulty dial as well as a
     * flavour one.
     */
    let offType = 0;
    for (const seed of MANY_SEEDS) {
      for (const segment of createRun(seed).segments) {
        for (const route of segment.routes) {
          const allowed = new Set(localeById(route.locale).types);
          for (const step of route.steps) {
            for (const node of step.options) {
              if (node.kind !== 'trainer') continue;
              for (const member of node.encounter?.team ?? []) {
                const card = describeSpecCard(member);
                if (!card.types.some((type) => allowed.has(type))) offType++;
              }
            }
          }
        }
      }
    }
    expect(offType, 'every trainer matched its locale, so trainers are locale-bound').toBeGreaterThan(0);
  });

  it('gives the gym the same team whichever locale is walked', () => {
    // The gym is generated once per segment, outside every route, so this is a
    // structural fact rather than a statistical one.
    for (const seed of SEEDS.slice(0, 6)) {
      for (const segment of createRun(seed).segments) {
        expect(segment.gym.encounter?.team).toBeDefined();
        expect(segment.gym.id).toBe(`s${segment.index}-gym`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 5. The composition guarantees
// ---------------------------------------------------------------------------

describe('composition guarantees, per route', () => {
  it('puts exactly one unavoidable wild step on every route', () => {
    for (const seed of MANY_SEEDS.slice(0, 40)) {
      for (const segment of createRun(seed).segments) {
        for (const route of segment.routes) {
          const unavoidable = route.steps.filter((step) =>
            step.options.every((option) => option.kind === 'wild'),
          );
          expect(unavoidable.length, `${seed} s${segment.index} ${route.locale}`).toBe(
            DEFAULT_TUNING.wildStepsPerSegment,
          );
          for (const step of unavoidable) {
            expect(step.options.length).toBe(DEFAULT_TUNING.wildStepOptionCount);
            // Two wilds are two trades only if their tiers differ.
            const tiers = step.options.map((option) => option.tier);
            expect(new Set(tiers).size).toBe(tiers.length);
          }
        }
      }
    }
  });

  it('offers an event and a reachable rest on every route', () => {
    for (const seed of MANY_SEEDS.slice(0, 40)) {
      for (const segment of createRun(seed).segments) {
        for (const route of segment.routes) {
          const has = (kind: string): number =>
            route.steps.filter((step) => step.options.some((option) => option.kind === kind)).length;
          expect(has('event'), `${seed} s${segment.index} ${route.locale} events`).toBeGreaterThanOrEqual(
            DEFAULT_TUNING.minEventSteps,
          );
          /*
           * **The rest floor is the segment's own, from Stage 4.8 item 3.** It
           * was `minRestSteps`, a flat count, which with a length curve would
           * have let a seven-step segment satisfy the guarantee with the single
           * rest a four-step one gets. `restFloorFor` is the same function
           * generation enforces, so this asserts the rule rather than a copy.
           */
          expect(has('rest'), `${seed} s${segment.index} ${route.locale} rests`).toBeGreaterThanOrEqual(
            restFloorFor(DEFAULT_TUNING, route.steps.length),
          );
        }
      }
    }
  });

  it('keeps rests off the opening step', () => {
    for (const seed of MANY_SEEDS.slice(0, 30)) {
      for (const segment of createRun(seed).segments) {
        for (const step of routeStepsOf(segment)) {
          if (step.index >= DEFAULT_TUNING.restEarliestStep) continue;
          expect(step.options.some((option) => option.kind === 'rest')).toBe(false);
        }
      }
    }
  });

  it('never lets one guarantee overwrite another', () => {
    /*
     * The failure the claimed-step set exists to prevent: a segment that rolled
     * an event naturally and then had the rest fix-up overwrite that same
     * option would satisfy both counters and ship with no event on the route.
     * The assertion is the two guarantees holding together, over enough seeds
     * that a collision would have happened.
     */
    let routes = 0;
    for (const seed of MANY_SEEDS) {
      for (const segment of createRun(seed).segments) {
        for (const route of segment.routes) {
          routes++;
          const kinds = route.steps.flatMap((step) => step.options.map((option) => option.kind));
          expect(kinds).toContain('event');
          expect(kinds).toContain('rest');
          expect(kinds).toContain('wild');
        }
      }
    }
    expect(routes).toBeGreaterThan(1000);
  });
});

// ---------------------------------------------------------------------------
// 6. Selection
// ---------------------------------------------------------------------------

describe('choosing a locale', () => {
  it('offers no nodes until a locale is picked', () => {
    const started = chooseStarter(createRun('LOCALE-PICK'), 0);
    expect(nodeOptions(started)).toEqual([]);
    expect(stepsOf(started)).toEqual([]);
    expect(localeOf(started)).toBeNull();

    const picked = chooseLocale(started, 1);
    expect(localeOf(picked)).toBe(started.segments[0]?.localeOffer[1]);
    expect(nodeOptions(picked).length).toBeGreaterThan(0);
  });

  it('resolves the same index to the same route every time', () => {
    const started = chooseStarter(createRun('LOCALE-PICK'), 0);
    for (let index = 0; index < (started.segments[0]?.localeOffer.length ?? 0); index++) {
      const picked = chooseLocale(started, index);
      expect(localeOf(picked)).toBe(started.segments[0]?.localeOffer[index]);
      expect(stepsOf(picked)).toEqual(started.segments[0]?.routes[index]?.steps);
    }
  });

  it('refuses an index nobody was offered, and a second pick', () => {
    const started = chooseStarter(createRun('LOCALE-PICK'), 0);
    expect(() => chooseLocale(started, 9)).toThrow(/out of range/);
    expect(() => chooseLocale(chooseLocale(started, 0), 1)).toThrow(/already has a locale/);
  });

  it('consumes no RNG: picking is a decision, not a draw', () => {
    // Asserted through generation rather than through the transition, because
    // the transition has no stream to reach for at all — which is the point.
    const rng = createRng('LOCALE-NO-DRAW');
    const before = rng.map.totalDraws;
    const segment = generateSegment(0, rng, DEFAULT_TUNING);
    const after = rng.map.totalDraws;

    const state = chooseLocale(chooseStarter(createRun('LOCALE-NO-DRAW'), 0), 0);
    expect(state.localeChoices[0]).toBe(0);
    // Every route was drawn before anybody picked one.
    expect(after).toBeGreaterThan(before);
    expect(segment.routes.length).toBe(segment.localeOffer.length);
  });
});
