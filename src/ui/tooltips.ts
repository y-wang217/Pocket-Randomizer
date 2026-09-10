/**
 * The tooltip layer: one panel, one delegated listener, tap to open.
 *
 * ## Tap first, hover second, and the order is the whole design
 *
 * Stage 5 is the mobile responsive pass. A hover-only tooltip layer would be
 * rebuilt in three weeks, because hover does not exist on a phone and there is
 * no amount of CSS that makes it exist. So the interaction is defined the other
 * way round: **tap or click opens, tap outside or Escape dismisses, and hover
 * is a desktop enhancement layered on top of a thing that already works
 * without it.** That constraint is the reason this stage runs before Stage 5
 * rather than after.
 *
 * The practical consequence is that every trigger is a real focusable control
 * with `role="button"`, not a `title` attribute and a `:hover` rule. That also
 * makes the whole layer keyboard-reachable, which a hover implementation could
 * not have been.
 *
 * ## One listener, not one per badge
 *
 * Triggers are marked with `data-tip="kind:id"` and a single delegated listener
 * on the app root resolves them. The battle scene re-renders its move buttons
 * every turn, so per-element listeners would mean attaching and detaching a few
 * dozen of them per turn and leaking any that were missed. Delegation means the
 * scene writes an attribute and knows nothing about tooltips at all.
 *
 * ## Content lives in data/
 *
 * Nothing in this file is a description. Ability text comes from the dex via
 * the adapter (with `data/abilityOverrides.ts` layered on), status text from
 * `data/statusInfo.ts`, item text from `data/items.ts`, and the type wheel is
 * generated from the dex type chart. A string describing a mechanic that lives
 * in a component is a string that drifts from the mechanic.
 */
import { abilityInfo, typeChart } from '../core/battle/driver';
import { abilityText } from '../data/abilityOverrides';
import { bandInfo, BAND_MULTIHIT_NOTE } from '../data/bandInfo';
import { categoryInfo } from '../data/categoryInfo';
import { itemById } from '../data/items';
import { statInfo } from '../data/statInfo';
import { MOVE_TAG_BY_ID, type MoveTagId } from '../data/moveTags';
import {
  ARCHETYPES,
  ARCHETYPE_CAVEAT,
  ARCHETYPE_DISPLAY,
  ARCHETYPE_INTRO,
} from '../data/archetypes';
import { statusInfo, STATUS_PERSISTENCE_NOTE } from '../data/statusInfo';
import { typeChip } from './chip';
import { el } from './scene';

/** What a `data-tip` attribute can name. */
type TipKind =
  | 'type'
  | 'status'
  | 'volatile'
  | 'ability'
  | 'item'
  | 'category'
  | 'stat'
  | 'band'
  /** A move tag on a card face. Stage 4.7, Part 6b. */
  | 'movetag'
  /**
   * The tags a narrow card face had no room for, as one panel.
   *
   * The id is a comma-separated list of tag ids rather than one, because the
   * question the `+2` chip is asked is "which two", and a panel that named the
   * vocabulary instead of this move's own tags would answer a different one.
   */
  | 'movetags'
  /**
   * The six-label stat shorthand. Stage 4.7, Part 7.
   *
   * The one tip with no id of its own: every chip raises the same panel,
   * because what a player taps a label for is *what the labels are* rather than
   * what that one means. `archetype:all` is the trigger every chip carries.
   */
  | 'archetype';

const KINDS: readonly TipKind[] = [
  'type',
  'status',
  'volatile',
  'ability',
  'item',
  'category',
  'stat',
  'band',
  'movetag',
  'movetags',
  'archetype',
];

export interface TooltipLayer {
  root: HTMLElement;
  /**
   * Dismiss whatever is open, if anything.
   *
   * For the router to call on navigation. `ui/drawer.ts` is closed the same way
   * and for the same reason: a panel left open across a screen change is an
   * overlay over a decision the player has already made, and this one is worse
   * than the drawer because it also eats the first tap on the new screen.
   */
  close(): void;
  /** Detach the delegated listeners. */
  destroy(): void;
}

/**
 * Mount the layer on a container. Every `[data-tip]` inside it becomes a
 * trigger, now and for anything rendered into it later.
 */
export function createTooltips(host: HTMLElement): TooltipLayer {
  const root = el('div', 'tip');
  root.hidden = true;
  // A tooltip is supplementary content the reader chose to open, not an alert:
  // `polite` announces it without interrupting whatever is being read.
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-live', 'polite');

  let openFor: HTMLElement | null = null;
  /** True when the panel was opened by hover, so leaving should close it. */
  let transient = false;

  function close(): void {
    if (!openFor) return;
    openFor.removeAttribute('aria-expanded');
    openFor = null;
    transient = false;
    root.hidden = true;
    root.replaceChildren();
  }

  function open(trigger: HTMLElement, byHover: boolean): void {
    const tip = trigger.dataset['tip'];
    if (!tip) return;
    const body = render(tip);
    if (!body) return;

    if (openFor && openFor !== trigger) openFor.removeAttribute('aria-expanded');
    openFor = trigger;
    transient = byHover;
    trigger.setAttribute('aria-expanded', 'true');

    root.replaceChildren(body);
    root.hidden = false;
    position(root, trigger);
  }

  function triggerFor(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof Element)) return null;
    return target.closest<HTMLElement>('[data-tip]');
  }

  const onClick = (event: MouseEvent): void => {
    const trigger = triggerFor(event.target);
    if (!trigger) {
      // A tap anywhere else dismisses. Clicks inside the panel are exempt so a
      // wheel can be read without it closing under the reader's finger.
      if (!(event.target instanceof Node) || !root.contains(event.target)) close();
      return;
    }
    // Toggle: a second tap on the same badge closes it, which is the only
    // dismissal a touch user will reliably find.
    if (openFor === trigger && !transient) {
      close();
      return;
    }
    /*
     * A move button is also a trigger's ancestor. Opening a tooltip must not
     * also submit the turn, so a tap that lands on a badge stops there — but
     * only when it landed on the badge itself, not on the button around it.
     */
    event.preventDefault();
    event.stopPropagation();
    open(trigger, false);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const trigger = triggerFor(event.target);
    if (!trigger) return;
    event.preventDefault();
    event.stopPropagation();
    if (openFor === trigger && !transient) close();
    else open(trigger, false);
  };

  // Hover, strictly as an enhancement. It never opens over a panel the reader
  // opened deliberately, and it never leaves one behind.
  const onOver = (event: MouseEvent): void => {
    const trigger = triggerFor(event.target);
    if (!trigger || (openFor && !transient)) return;
    open(trigger, true);
  };

  const onOut = (event: MouseEvent): void => {
    if (!transient) return;
    const trigger = triggerFor(event.target);
    if (trigger && trigger === openFor) close();
  };

  host.addEventListener('click', onClick, true);
  host.addEventListener('keydown', onKeyDown, true);
  host.addEventListener('mouseover', onOver);
  host.addEventListener('mouseout', onOut);
  host.append(root);

  return {
    root,
    close,
    destroy() {
      host.removeEventListener('click', onClick, true);
      host.removeEventListener('keydown', onKeyDown, true);
      host.removeEventListener('mouseover', onOver);
      host.removeEventListener('mouseout', onOut);
      root.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

function render(tip: string): HTMLElement | null {
  const separator = tip.indexOf(':');
  if (separator < 0) return null;
  const kind = tip.slice(0, separator) as TipKind;
  const id = tip.slice(separator + 1);
  if (!KINDS.includes(kind) || !id) return null;

  switch (kind) {
    case 'type':
      return renderTypeWheel(id);
    case 'status':
    case 'volatile':
      return renderStatus(id);
    case 'ability':
      return renderAbility(id);
    case 'item':
      return renderItem(id);
    case 'category':
      return renderCategory(id);
    case 'stat':
      return renderStat(id);
    case 'band':
      return renderBand(id);
    case 'movetag':
      return renderMoveTag(id);
    case 'movetags':
      return renderMoveTags(id);
    case 'archetype':
      return renderArchetypes();
  }
}

/**
 * What one move tag claims.
 *
 * The words are `data/moveTags.ts`'s, like every other tip in this file — the
 * layer is a lookup and a positioner and carries no prose of its own, which
 * `test/boundaries.test.ts` checks.
 */
function renderMoveTag(id: string): HTMLElement | null {
  const tag = MOVE_TAG_BY_ID[id as MoveTagId];
  if (!tag) return null;
  const body = panel(tag.long);
  body.append(line(tag.blurb, 'tip__text'));
  return body;
}

/**
 * Several tags in one panel: what a narrow face folded behind its `+N` chip.
 *
 * Same words as `renderMoveTag`, same source, listed. An id that no longer
 * names a tag is dropped rather than rendered blank, and a list that resolves
 * to nothing renders no panel at all.
 */
function renderMoveTags(ids: string): HTMLElement | null {
  const tags = ids
    .split(',')
    .map((id) => MOVE_TAG_BY_ID[id as MoveTagId])
    .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag));
  const first = tags[0];
  if (!first) return null;

  const body = panel(first.long);
  body.append(line(first.blurb, 'tip__text'));
  for (const tag of tags.slice(1)) {
    body.append(line(tag.long, 'tip__title'), line(tag.blurb, 'tip__text'));
  }
  return body;
}

/**
 * The whole archetype vocabulary, with the caveat that has to travel with it.
 *
 * All six rather than the one tapped, because the question a player has when
 * they tap a label is what the *set* is: one label in isolation says nothing
 * about whether there is a sixth or a sixtieth.
 *
 * **The caveat is not optional and is why this is a panel rather than a
 * sentence.** Under full move randomization a physical attacker can be holding
 * four special moves. The label describes the stat block, never the moveset,
 * and the player meets that in the first hour.
 */
function renderArchetypes(): HTMLElement {
  const body = panel('Stat shapes');
  body.append(line(ARCHETYPE_INTRO, 'tip__text'));
  const list = el('ul', 'tip__list');
  for (const label of ARCHETYPES) {
    const display = ARCHETYPE_DISPLAY[label];
    const row = el('li', 'tip__row');
    const name = el('span', 'tip__row-label');
    name.textContent = display.long;
    const blurb = el('span', 'tip__row-value');
    blurb.textContent = display.blurb;
    row.append(name, blurb);
    list.append(row);
  }
  body.append(list, line(ARCHETYPE_CAVEAT, 'tip__note'));
  return body;
}

function panel(title: string, className = ''): HTMLElement {
  const body = el('div', `tip__body ${className}`.trim());
  const heading = el('h3', 'tip__title');
  heading.textContent = title;
  body.append(heading);
  return body;
}

function line(text: string, className: string): HTMLElement {
  const paragraph = el('p', className);
  paragraph.textContent = text;
  return paragraph;
}

function renderAbility(id: string): HTMLElement | null {
  const info = abilityInfo(id);
  if (!info) return null;
  const body = panel(info.name);
  // `abilityText` is where data/abilityOverrides.ts gets its say. Empty today,
  // so this is the dex's own description for every ability in the pool.
  body.append(line(abilityText(info.id, info.shortDesc), 'tip__text'));
  return body;
}

function renderItem(id: string): HTMLElement | null {
  const item = itemById(id);
  if (!item) return null;
  const body = panel(item.name);
  body.append(line(item.blurb, 'tip__text'));
  return body;
}

/**
 * The move category, which is the one tooltip aimed squarely at someone who has
 * never played Pokemon.
 *
 * `PHYS` is enough to compare four buttons and not enough to learn from, and
 * the definition of done for this stage is a player who can find out what a
 * category *is* without leaving the battle screen.
 */
function renderCategory(id: string): HTMLElement | null {
  const info = categoryInfo(id);
  if (!info) return null;
  const body = panel(info.label);
  body.append(line(info.mechanics, 'tip__text'));
  body.append(line(info.advice, 'tip__advice'));
  return body;
}

/**
 * A stat abbreviation, explained where it is printed.
 *
 * **The Part 5 requirement is that this is answerable without leaving the
 * screen**, which is why it is a tooltip on the label rather than a help page:
 * the question "what is SpA" arrives while looking at a number, and an answer
 * that costs a navigation is an answer nobody reads.
 *
 * `pairsWith` is rendered as a note rather than folded into the sentence,
 * because it is the fact that makes the six numbers parse as three pairs. It is
 * also the closest this file comes to advice, and it stays on the safe side of
 * Part 4 by naming a term in the damage formula rather than a course of action.
 */
function renderStat(id: string): HTMLElement | null {
  const info = statInfo(id);
  if (!info) return null;
  const body = panel(`${info.abbreviation} — ${info.label}`);
  body.append(line(info.mechanics, 'tip__text'));
  if (info.pairsWith) {
    body.append(line(`Resolved against the defender's ${info.pairsWith}.`, 'tip__note'));
  }
  return body;
}

/**
 * A move's base-power band. **Stage 4.6b.**
 *
 * Reads like every other tooltip here: what the thing is, in one line, from
 * `data/`. The multi-hit note is appended unconditionally rather than only for
 * a multi-hit move, because the tooltip is attached to the *band*, not to a
 * particular move — and it is the one place the badge and the base power on the
 * same card can disagree.
 */
function renderBand(id: string): HTMLElement | null {
  const info = bandInfo(Number(id));
  if (!info) return null;
  const body = panel(`${info.label} — ${info.range}`);
  body.append(line(info.text, 'tip__text'));
  body.append(line(BAND_MULTIHIT_NOTE, 'tip__note'));
  return body;
}

function renderStatus(id: string): HTMLElement | null {
  const info = statusInfo(id);
  if (!info) return null;
  const body = panel(info.label);
  body.append(line(info.mechanics, 'tip__text'));
  // The advice line is what earns the tooltip. "1/16 per turn" is a fact; "keep
  // attacking specially" is the decision it implies.
  body.append(line(info.advice, 'tip__advice'));
  body.append(line(STATUS_PERSISTENCE_NOTE, 'tip__note'));
  return body;
}

/**
 * The type reference wheel, reachable from any type badge on the screen.
 *
 * Both directions, because both are decisions the player is making at the same
 * moment: what this type *does* to things is the move they are about to pick,
 * and what it *takes* is whether they survive the reply.
 *
 * Generated from the dex chart rather than written out. A hand-written table is
 * a table that drifts from the engine resolving damage beside it, and the whole
 * argument for showing effectiveness at all is that the number on the button is
 * the number the turn will use.
 */
function renderTypeWheel(type: string): HTMLElement | null {
  const entry = typeChart().find((row) => row.type.toLowerCase() === type.toLowerCase());
  if (!entry) return null;

  const body = panel(`${entry.type} type`, 'tip__body--wheel');

  const attacking = el('div', 'wheel__half');
  attacking.append(sectionHeading('Attacking'));
  attacking.append(
    row('Super effective', entry.strongAgainst, 'super'),
    row('Resisted by', entry.weakAgainst, 'resisted'),
    row('No effect on', entry.noEffectAgainst, 'immune'),
  );

  const defending = el('div', 'wheel__half');
  defending.append(sectionHeading('Defending'));
  defending.append(
    row('Weak to', entry.weakTo, 'super'),
    row('Resists', entry.resists, 'resisted'),
    row('Immune to', entry.immuneTo, 'immune'),
  );

  body.append(attacking, defending);
  return body;
}

function sectionHeading(text: string): HTMLElement {
  const heading = el('h4', 'wheel__heading');
  heading.textContent = text;
  return heading;
}

/**
 * One line of the wheel. Empty rows are still rendered, with a dash.
 *
 * Dropping them would make the two halves different heights and, worse, would
 * make "Steel is immune to nothing" and "we forgot to compute this" look the
 * same. A dash is an answer.
 */
function row(label: string, types: readonly string[], band: string): HTMLElement {
  const line = el('div', 'wheel__row');
  line.dataset['band'] = band;

  const name = el('span', 'wheel__label');
  name.textContent = label;
  line.append(name);

  const list = el('span', 'wheel__types');
  if (types.length === 0) {
    const none = el('span', 'wheel__none');
    none.textContent = '—';
    list.append(none);
  } else {
    for (const type of types) list.append(typeChip(type));
  }
  line.append(list);
  return line;
}

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

/**
 * Put the panel near its trigger without letting it leave the viewport.
 *
 * Fixed positioning against the trigger's client rect, flipped above when there
 * is no room below and clamped horizontally. Deliberately arithmetic rather
 * than a popover library: this is the whole of the requirement, and Stage 5's
 * responsive pass will want to change the rule rather than configure someone
 * else's.
 */
function position(panel: HTMLElement, trigger: HTMLElement): void {
  const margin = 8;
  const anchor = trigger.getBoundingClientRect();

  // Measured after the content is in, so the flip decision uses the real size.
  panel.style.left = '0px';
  panel.style.top = '0px';
  const box = panel.getBoundingClientRect();

  const spaceBelow = window.innerHeight - anchor.bottom;
  const above = spaceBelow < box.height + margin && anchor.top > box.height + margin;
  const top = above ? anchor.top - box.height - margin : anchor.bottom + margin;

  const maxLeft = window.innerWidth - box.width - margin;
  const left = Math.max(margin, Math.min(anchor.left, maxLeft));

  panel.style.left = `${left}px`;
  panel.style.top = `${Math.max(margin, top)}px`;
}
