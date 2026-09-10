/**
 * The chip. Stage V2.
 *
 * One component for every small label the UI wears: a type, a tier, a band,
 * a status, a stat stage, a capability requirement and the band the run
 * reads at for it, a move category, an effectiveness marker, and the plain
 * neutral badges (lead, item, ability, volatile, relic). One recipe in the
 * stylesheet, keyed off `.chip`: a faint fill, a hairline outline drawn as an
 * inset shadow so it costs no layout, the label in the display face.
 *
 * **Type chips are the only coloured chips.** They set `--chip` to their type
 * token; everything else is the neutral cream. A tier is a word, a band is a
 * number, a status is three letters, and none of them is a colour. That is
 * the rule the plan states, and it is what makes the one accent possible.
 *
 * Every variant keeps the class it had before this stage (`type type--fire`,
 * `tier tier--hard`, `band band--3`, `badge badge--status`, and so on), so
 * the stylesheet's per-slot metrics, the smoke script's selectors and the
 * existing tests are untouched. What changed is that no screen builds one by
 * hand any more; `test/chip.test.ts` scans for that.
 */
import { el } from './dom';

export type ChipVariant =
  | 'type'
  | 'tier'
  | 'band'
  | 'status'
  | 'stage'
  | 'capability'
  | 'capability-band'
  | 'category'
  | 'effect'
  | 'flag'
  | 'neutral';

export interface ChipOptions {
  /** A `data-tip` key, when the chip opens a tooltip. */
  tip?: string;
  /** Extra classes a slot needs (a legacy badge modifier, say). */
  extra?: string;
}

function build(variant: ChipVariant, legacy: string, text: string, options: ChipOptions = {}): HTMLElement {
  const node = el('span', `chip chip--${variant} ${legacy}${options.extra ? ` ${options.extra}` : ''}`.trim());
  node.textContent = text;
  if (options.tip) node.dataset['tip'] = options.tip;
  return node;
}

/** A type. The one coloured chip; `type--<name>` carries the hue. */
export function typeChip(type: string, options: ChipOptions = {}): HTMLElement {
  return build('type', `type type--${type.toLowerCase()}`, type, options);
}

/** A tier, as its word. No colour: a tier that were a colour would be a verdict. */
export function tierChip(tier: string): HTMLElement {
  return build('tier', `tier tier--${tier}`, tier.toUpperCase());
}

/** A move's base-power band, `BAND n`, with its tooltip. */
export function bandChip(band: number): HTMLElement {
  return build('band', `band band--${band}`, `BAND ${band}`, { tip: `band:${band}` });
}

/** A status condition. `data-status` names it; the label is what is shown. */
export function statusChip(id: string, label: string = id.toUpperCase(), options: ChipOptions = {}): HTMLElement {
  const node = build('status', 'badge badge--status', label, options);
  node.dataset['status'] = id;
  return node;
}

/** A stat stage, `+2` or `-1`. For the battle panel to adopt in V5. */
export function stageChip(stage: number): HTMLElement {
  const sign = stage > 0 ? '+' : '';
  return build('stage', `badge badge--${stage > 0 ? 'up' : 'down'}`, `${sign}${stage}`);
}

/** The capability a node requires, on the node's gate line. */
export function capabilityChip(text: string): HTMLElement {
  return build('capability', 'node__gate-need', text);
}

/** The band the run reads at for that capability, beside it. */
export function capabilityBandChip(text: string): HTMLElement {
  return build('capability-band', 'node__gate-band', text);
}

/** A move category, `PHYS`, `SPEC`, `STAT`. */
export function categoryChip(category: string, label: string, options: ChipOptions = {}): HTMLElement {
  const node = build('category', `badge badge--category badge--cat-${category.toLowerCase()}`, label, options);
  node.tabIndex = 0;
  node.setAttribute('role', 'button');
  return node;
}

/** The live effectiveness marker on a battle move button. */
export function effectChip(label: string, band: string): HTMLElement {
  const node = build('effect', 'badge badge--effect', label);
  node.dataset['band'] = band;
  return node;
}

/**
 * One post-resolution flag word. Release C item 3.
 *
 * **Every flag is the same chip.** No `--chip`, no size modifier, no weight
 * modifier and no per-kind variant class beyond the `data-flag` hook, which
 * exists so a test can find one and carries no style. `SUPER EFFECTIVE` and
 * `NOT VERY EFFECTIVE` are the same kind of fact and must look it — the moment
 * one of them is bigger or brighter, the row has stopped reporting and started
 * recommending, and the accent belongs to `.primary-action` alone.
 *
 * Deliberately **not** `effectChip`. That one is the pre-selection forecast on
 * a move button; this is a truth about a turn that already resolved. They are
 * different systems, neither derives from the other, and sharing a class here
 * would be the first step to somebody deriving one from the other.
 */
export function flagChip(kind: string, text: string, options: ChipOptions = {}): HTMLElement {
  const node = build('flag', 'badge badge--flag', text, options);
  node.dataset['flag'] = kind;
  return node;
}

/** A plain neutral badge: lead, item, ability, volatile, relic. */
export function neutralChip(text: string, modifier: string, options: ChipOptions = {}): HTMLElement {
  return build('neutral', `badge badge--${modifier}`, text, options);
}
