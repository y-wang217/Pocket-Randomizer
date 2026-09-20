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
import { abilityInfo, describeMove, typeChart } from '../core/battle/driver';
import { abilityText } from '../data/abilityOverrides';
import { CAPABILITY_LABELS } from '../data/eventCopy';
import { gymForSegment } from '../data/gyms';
import { relicById } from '../data/relics';
import { DEFAULT_TUNING } from '../data/tuning';
import { DEFAULT_DISPLAY_TUNING, type DisplayTuning } from '../data/displayTuning';
import { moveExplanationRows } from './move-explanation';
import { moveCardData } from './move-detail';
import { bandInfo, BAND_MULTIHIT_NOTE } from '../data/bandInfo';
import { FLAG_BLURBS, flagWord } from '../data/flagWords';
import type { FlagKind } from '../core/battle/flags';
import { categoryInfo } from '../data/categoryInfo';
import { itemById } from '../data/items';
import { statInfo } from '../data/statInfo';
import { stageRowValue } from '../data/statStages';
import { MOVE_TAG_BY_ID, type MoveTagId } from '../data/moveTags';
import { MOVE_FACT_INFO } from '../data/moveFactInfo';
import { moveFactsOf, type MoveFactId } from '../core/moveFacts';
import {
  ARCHETYPES,
  ARCHETYPE_CAVEAT,
  ARCHETYPE_DISPLAY,
  ARCHETYPE_INTRO,
} from '../data/archetypes';
import { statusInfo, STATUS_PERSISTENCE_NOTE } from '../data/statusInfo';
import { TIER_INFO } from '../data/tierInfo';
import { capabilityTypes, type Capability } from '../data/capabilities';
import type { Tier } from '../core/types';
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
  /**
   * A member card's HP readout, on its bar. Density modes patch, Part 4: in
   * Pocket the card's HP line is off screen and the bar carries the number,
   * the same way a stat row's label carries its value.
   */
  | 'hp'
  | 'band'
  /** A move tag on a card face. Stage 4.7, Part 6b. */
  | 'movetag'
  /**
   * A post-resolution flag word on the battle strip. Release C item 3.
   *
   * Keyed by the flag *kind* rather than by the word shown, because the word
   * folds in a detail — `Paralysed`, `Oran Berry`, `Priority +1` — and the
   * question a player taps a chip for is what the category claims, not what
   * this instance of it said.
   */
  | 'flag'
  /**
   * The six-label stat shorthand. Stage 4.7, Part 7.
   *
   * The one tip with no id of its own: every chip raises the same panel,
   * because what a player taps a label for is *what the labels are* rather than
   * what that one means. `archetype:all` is the trigger every chip carries.
   */
  | 'archetype'
  /**
   * A move, explained, from a battle button. **Density modes patch; open item
   * 9 (R8) closed.** The same rows `ui/move-explanation.ts` builds for a card's
   * expander, in this layer because a tap on a battle button spends a turn and
   * a badge tap is the one tap the board already stops. Keyed by move id.
   */
  | 'move'
  /**
   * A gym leader's blurb, from the map's and the pre-gym screen's title.
   * Density modes patch: Pocket hides the flavour line and the title says it.
   * Keyed by segment index; the words are `data/gyms.ts`'s.
   */
  | 'gym'
  /**
   * How many members a listed threat type reaches. Density modes patch: Pocket
   * hides the count beside the chip and the chip says it. The sentence rides
   * on the trigger (`data-detail`), written by `core/typeMatchup.ts`, because
   * it is a fact about this party and this render rather than a table entry.
   */
  | 'threat'
  /**
   * A relic's description. Density modes patch: the party screen's relic rows
   * fold in Pocket and the drawer prints relics as chips, so the words in
   * `data/relics.ts` need a tap to reach them. Keyed by relic id.
   */
  | 'relic'
  /**
   * The whole stat-stage set for one side, folded into one marker. **Patch
   * 4.8.0.3, item 1.**
   *
   * Pocket has no width for a multiplier and a ladder per stage, and the
   * density ruling is that no mode removes a fact — so the facts move behind
   * one tap rather than off the screen. There is no id to look up: the set is
   * this turn's, so it rides on the trigger as `data-detail`, the same way a
   * threat count does. `stages:active` is the trigger every marker carries.
   */
  | 'stages'
  /**
   * One icon on a move card's fact strip. **Patch 4.8.0.3, item 2.**
   *
   * The strip trades words for glyphs to buy vertical space, and this is what
   * makes that trade honest: every icon is a trigger and the panel names the
   * field in words. An icon nobody can decode is worse than the row it
   * replaced. Keyed by `MoveFactId`; the words are `data/moveFactInfo.ts`'s,
   * which takes eight of the nine straight from `data/moveTags.ts` so the
   * strip and the explanation cannot drift into two descriptions of one fact.
   */
  | 'movefact'
  /**
   * A move's base power, from the number itself. **Milestone M1.2.**
   *
   * Section 3 gives base power an inspect entry — "same, plus per-hit power
   * for multi-hit moves" — and until M1.2 the largest number on the card was
   * the one thing on it that answered nothing. Keyed by move id.
   */
  | 'power'
  /**
   * A move's PP, from the counter. **Milestone M1.2.**
   *
   * Section 3: "max and remaining". The counter shows one or both depending on
   * the surface, so the pair rides on the trigger as `data-value` rather than
   * being looked up: it is a fact about this render.
   */
  | 'pp'
  /**
   * The capture card's two coverage rows. **Milestone M1.2.**
   *
   * Section 3: "the full before and after sets". The sets are this capture's,
   * so they ride on the trigger as `data-detail`. Discrepancy D5 ruled that
   * coverage is *not* a tenth glyph family and carries permanent signs rather
   * than an exposure label, so this panel is the only place the rows are named
   * in words.
   */
  | 'coverage'
  /**
   * What a map node's capability requirement asks for. **Milestone M1.2.**
   *
   * Section 3: "capability name, what satisfies it". The name is
   * `data/eventCopy.ts`'s and the types are `data/capabilities.ts`'s, so the
   * panel is a lookup and writes nothing of its own.
   */
  | 'capability'
  /**
   * A map node's tier. **Milestone M1.2.**
   *
   * Section 3: "tier definition", and `data/tierInfo.ts` is where those three
   * sentences already live.
   */
  | 'tier';

const KINDS = [
  'type',
  'status',
  'volatile',
  'ability',
  'item',
  'category',
  'stat',
  'hp',
  'band',
  'movetag',
  /**
   * **`flag` was missing from this list until M1.2, and that was a live bug.**
   *
   * Release C item 3 built the flag strip, gave every flag word a `data-tip`
   * and wrote `renderFlag` to answer it — and never added the kind here.
   * `render` refuses any kind this array does not carry, before it reaches the
   * switch, so every post-resolution flag on the battle screen was a trigger
   * that opened nothing: focusable, `aria-expanded`, and silent.
   *
   * Nothing caught it because the union, the switch and this list were three
   * places saying the same thing and only two of them were checked. The guard
   * below makes the third a compile error.
   */
  'flag',
  'archetype',
  'move',
  'gym',
  'threat',
  'relic',
  'stages',
  'movefact',
  'power',
  'pp',
  'coverage',
  'capability',
  'tier',
] as const satisfies readonly TipKind[];

/**
 * A kind in the union with no entry in `KINDS` is a dead trigger.
 *
 * `render`'s switch is exhaustive because TypeScript makes it so; this makes
 * the allowlist exhaustive the same way. If a kind is added to `TipKind` and
 * not to `KINDS`, the conditional resolves to `false`, the assignment fails,
 * and the build stops — rather than shipping an element that opens nothing.
 */
const ALL_KINDS_LISTED: Exclude<TipKind, (typeof KINDS)[number]> extends never ? true : false = true;
void ALL_KINDS_LISTED;

export interface TooltipLayer {
  root: HTMLElement;
  /** Detach the delegated listeners. */
  destroy(): void;
}

/**
 * Mount the layer on a container. Every `[data-tip]` inside it becomes a
 * trigger, now and for anything rendered into it later.
 */
export function createTooltips(host: HTMLElement, tuning: DisplayTuning = DEFAULT_DISPLAY_TUNING): TooltipLayer {
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
    const body = render(tip, trigger);
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

  /*
   * ---------------------------------------------------------------------
   * The gesture. **Milestone M1.2, design bible R5.**
   *
   * R5: *"Long press on any card, chip, glyph, badge or pip opens its full
   * explanation. Release closes. Tap still selects."*
   *
   * **What this replaced, and why the replacement is not a regression.**
   * Until M1.2 a tap on a badge opened its panel and stopped the event, which
   * meant a badge sitting inside a move button was a hole in that button: the
   * player aiming at the button and catching the type chip got an explanation
   * instead of a turn. That was safe and it was also the rule inverted — the
   * explanation was the easy gesture and the decision was the one you could
   * miss.
   *
   * Now the press opens and the tap selects, so the button is a button
   * everywhere on its face and the explanation is deliberate. The three
   * `suppress` flags below are what keep those two from ever firing together.
   * ---------------------------------------------------------------------
   */

  /** The hold in flight, if any. */
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  /** Where the finger went down, so a scroll can cancel the hold. */
  let holdFrom: { x: number; y: number } | null = null;
  /**
   * When the press began, by the *event's* clock rather than the timer's.
   *
   * A blocked main thread delays dispatch but not generation: a tap the
   * browser made 5ms apart still reports 5ms apart in `timeStamp`, however
   * late JS gets to see it. That is what tells a real hold from a fast tap
   * that arrived after a long stall, and it is the difference between
   * inspecting and losing the player's turn. See `onClick`.
   */
  let holdDownAt = 0;
  /** True once a hold has opened a panel, so the release knows to close it. */
  let openedByHold = false;
  /**
   * True from the moment a hold opens until the click it produces is eaten.
   *
   * A long press still emits `click` on release, and that click would submit
   * the move the player was only inspecting. This is the flag that stops it,
   * and it is the mechanism behind R5's enforcement test.
   */
  let suppressClick = false;

  /** Beyond this many pixels the press is a scroll, not a hold. */
  const HOLD_SLOP = 10;

  function cancelHold(): void {
    if (holdTimer !== null) clearTimeout(holdTimer);
    holdTimer = null;
    holdFrom = null;
  }

  const onPointerDown = (event: PointerEvent): void => {
    cancelHold();
    const trigger = triggerFor(event.target);
    if (!trigger) return;
    holdFrom = { x: event.clientX, y: event.clientY };
    holdDownAt = event.timeStamp;
    holdTimer = setTimeout(() => {
      holdTimer = null;
      openedByHold = true;
      suppressClick = true;
      open(trigger, false);
    }, tuning.inspectHoldMs);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (holdTimer === null || !holdFrom) return;
    // A finger that has travelled is scrolling the page, and a panel that
    // opened mid-scroll would be the accidental open R5's disconfirmer is
    // about.
    if (Math.abs(event.clientX - holdFrom.x) > HOLD_SLOP || Math.abs(event.clientY - holdFrom.y) > HOLD_SLOP) {
      cancelHold();
    }
  };

  /** R5's "release closes", and the only thing that ends a held panel. */
  const onPointerUp = (): void => {
    cancelHold();
    if (!openedByHold) return;
    openedByHold = false;
    close();
  };

  const onPointerCancel = (): void => {
    cancelHold();
    if (!openedByHold) return;
    openedByHold = false;
    close();
  };

  /*
   * The click a long press leaves behind.
   *
   * This listener exists to eat exactly that one click and to dismiss a
   * keyboard-opened panel. **It never opens anything**, because opening on
   * click is what R5 replaced.
   */
  const onClick = (event: MouseEvent): void => {
    if (suppressClick) {
      suppressClick = false;
      /*
       * **Only eat a click the player actually held for.**
       *
       * The timer fires on the main thread, so a stall long enough to delay a
       * `pointerup` lets it fire for a press the browser generated in five
       * milliseconds — and eating *that* click costs the player the turn they
       * chose, silently, on exactly the slow frame where they are least likely
       * to forgive it. `timeStamp` is set when the browser makes the event,
       * not when JS receives it, so this measures the press and not the jank.
       *
       * Under the threshold the panel that just opened is closed again and the
       * click goes through: the player tapped, and a tap selects.
       */
      if (event.timeStamp - holdDownAt >= tuning.inspectHoldMs) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      openedByHold = false;
      close();
      return;
    }
    // A tap elsewhere dismisses a panel the keyboard opened. Clicks inside the
    // panel are exempt so a wheel can be read without closing under the finger.
    if (!(event.target instanceof Node) || !root.contains(event.target)) {
      if (openFor && !transient) close();
    }
  };

  /**
   * A long press is the platform's own gesture for "select text" or "show the
   * context menu", and both would land on top of the panel.
   */
  const onContextMenu = (event: MouseEvent): void => {
    if (triggerFor(event.target)) event.preventDefault();
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

  host.addEventListener('pointerdown', onPointerDown, true);
  host.addEventListener('pointermove', onPointerMove, true);
  host.addEventListener('pointerup', onPointerUp, true);
  host.addEventListener('pointercancel', onPointerCancel, true);
  host.addEventListener('contextmenu', onContextMenu, true);
  host.addEventListener('click', onClick, true);
  host.addEventListener('keydown', onKeyDown, true);
  host.addEventListener('mouseover', onOver);
  host.addEventListener('mouseout', onOut);
  host.append(root);

  return {
    root,
    destroy() {
      cancelHold();
      host.removeEventListener('pointerdown', onPointerDown, true);
      host.removeEventListener('pointermove', onPointerMove, true);
      host.removeEventListener('pointerup', onPointerUp, true);
      host.removeEventListener('pointercancel', onPointerCancel, true);
      host.removeEventListener('contextmenu', onContextMenu, true);
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

/**
 * The panel for one trigger.
 *
 * `trigger` is passed for the two tips whose fact lives on the element rather
 * than in a table — a stat label carries its value, a threat chip its count —
 * because both are facts about *this* render. Every other tip is a lookup by
 * id and ignores it.
 */
function render(tip: string, trigger?: HTMLElement): HTMLElement | null {
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
      return renderStat(id, trigger?.dataset['value']);
    case 'hp':
      return renderHp(trigger?.dataset['value']);
    case 'band':
      return renderBand(id);
    case 'movetag':
      return renderMoveTag(id);
    case 'flag':
      return renderFlag(id);
    case 'archetype':
      return renderArchetypes();
    case 'move':
      return renderMoveRows(id);
    case 'gym':
      return renderGym(id);
    case 'threat':
      return renderThreat(id, trigger?.dataset['detail']);
    case 'relic':
      return renderRelic(id);
    case 'stages':
      return renderStages(trigger?.dataset['detail']);
    case 'movefact':
      return renderMoveFact(id);
    case 'power':
      return renderPower(id);
    case 'pp':
      return renderPp(trigger?.dataset['value']);
    case 'coverage':
      return renderCoverage(trigger?.dataset['detail']);
    case 'capability':
      return renderCapability(id);
    case 'tier':
      return renderTier(id);
  }
}

/**
 * A move's base power, and what a multi-hit move's number actually means.
 *
 * **Milestone M1.2, section 3's base-power row.** The largest number on the
 * card was the one thing on it that answered nothing when held.
 *
 * Nothing here is written copy: the number is `describeMove`'s, the multi-hit
 * sentence is `data/bandInfo.ts`'s, and the category line is
 * `data/categoryInfo.ts`'s. R5 allows those three and this uses only those.
 */
function renderPower(id: string): HTMLElement | null {
  const move = describeMove(id);
  if (!move) return null;
  if (move.category === 'Status') {
    const body = panel('No base power');
    const category = categoryInfo('status');
    if (category) body.append(line(category.mechanics, 'tip__text'));
    return body;
  }
  const body = panel(`${move.basePower} base power`);
  const category = categoryInfo(move.category.toLowerCase());
  if (category) body.append(line(category.mechanics, 'tip__text'));
  // The one case where the number on the face is not the number a turn deals.
  if (moveFactsOf(move).some((fact) => fact.id === 'multiHit')) {
    body.append(line(BAND_MULTIHIT_NOTE, 'tip__note'));
  }
  return body;
}

/**
 * PP, as remaining against max. **Milestone M1.2, section 3's PP row.**
 *
 * The value rides on the trigger because the surfaces disagree about which
 * halves they show — a reward card has no remaining PP to print, a battle
 * button has both — and section 3 says inspect shows "max and remaining"
 * wherever it is opened.
 */
function renderPp(value?: string): HTMLElement | null {
  if (!value) return null;
  const [remaining, max] = value.split('/');
  if (!max) return null;
  /*
   * The title is the whole panel, and that is deliberate.
   *
   * Section 3 says inspect shows "max and remaining", and "PP 12 of 24" is
   * both. A sentence under it explaining what PP is would be copy written into
   * a screen, which R5 forbids and R12 would make an amendment rather than a
   * patch. If a playtest says the counter needs words, that is the amendment.
   */
  return panel(`PP ${remaining} of ${max}`);
}

/**
 * The coverage rows on a capture card. **Milestone M1.2, and D5's ruling.**
 *
 * The sets ride on the trigger, written by the screen that computed them,
 * because they are a fact about this capture rather than a table entry — the
 * same shape a threat count and a stat-stage set already use.
 *
 * `data-detail` is two lines, `+` then `-`, each a tab-separated type list.
 * Either may be empty, and an empty row renders nothing, which is section 3's
 * default for this attribute.
 */
function renderCoverage(detail?: string): HTMLElement | null {
  if (!detail) return null;
  const body = panel('Coverage');
  for (const entry of detail.split('\n')) {
    const sign = entry.slice(0, 1);
    const types = entry.slice(1).split('\t').filter(Boolean);
    if (!types.length) continue;
    body.append(row(sign === '+' ? 'Gains' : 'Loses', types, ''));
  }
  if (body.childElementCount <= 1) return null;
  return body;
}

/**
 * A capability gate: its name, and what satisfies it.
 *
 * **Milestone M1.2, section 3's capability row.** Both halves are lookups —
 * the name from `data/eventCopy.ts`, the types from `data/capabilities.ts` —
 * so the map card can stop carrying "Requires you have the relic" in prose,
 * which is nine of the words the census found on a surface budgeted at zero.
 */
function renderCapability(id: string): HTMLElement | null {
  const label = CAPABILITY_LABELS[id as Capability];
  if (!label) return null;
  const body = panel(label);
  const types = capabilityTypes(id as Capability);
  if (types.length) body.append(row('Satisfied by', types, ''));
  return body;
}

/** A map node's tier, in the three sentences `data/tierInfo.ts` already holds. */
function renderTier(id: string): HTMLElement | null {
  const text = TIER_INFO[id as Tier];
  if (!text) return null;
  const body = panel(id.slice(0, 1).toUpperCase() + id.slice(1));
  body.append(line(text, 'tip__text'));
  return body;
}

/** One fact strip icon, in words. The label is the title, the blurb the body. */
function renderMoveFact(id: string): HTMLElement | null {
  const info = MOVE_FACT_INFO[id as MoveFactId];
  if (!info) return null;
  const body = panel(info.label);
  const text = el('p', 'tip__text');
  text.textContent = info.blurb;
  body.append(text);
  return body;
}

/**
 * The folded stat-stage set, unfolded.
 *
 * One row per changed stage: the stat, the multiplier it applies, and the
 * stage itself. The stage is spelled out here where the inline chip leaves it
 * to the ladder, because a panel that has already cost a tap has room for it
 * and because `+2` is the form a player will meet in every other Pokemon
 * document they ever read.
 *
 * Composed from `data-detail` rather than from the projection: this layer is
 * delegated and stateless, and the trigger is the only thing that knows which
 * turn it was rendered on.
 */
function renderStages(detail?: string): HTMLElement | null {
  const rows = (detail ?? '').split('\n').filter((row) => row.length > 0);
  if (rows.length === 0) return null;
  const body = panel('Stat stages', 'tip__body--rows');
  const list = el('div', 'tip__rows');
  for (const row of rows) {
    const [stat = '', multiplier = '', stage = ''] = row.split('\t');
    const line = el('div', 'tip__row');
    const label = el('span', 'tip__row-label');
    label.textContent = stat;
    const value = el('span', 'tip__row-value');
    value.textContent = stageRowValue(multiplier, stage);
    line.append(label, value);
    list.append(line);
  }
  body.append(list);
  return body;
}

/**
 * A move's explanation rows, as the card expander prints them.
 *
 * `moveCardData` derives the same tag set the expander is handed, uncapped,
 * so the panel a battle button opens and the panel a card opens are one
 * list from one function; `DEFAULT_TUNING` only reaches the face cap, which
 * the full set does not read.
 */
function renderMoveRows(id: string): HTMLElement | null {
  const move = describeMove(id);
  if (!move) return null;
  const body = panel(move.name, 'tip__body--rows');
  const list = el('div', 'tip__rows');
  for (const row of moveExplanationRows(move, moveCardData(move, DEFAULT_TUNING).allTags)) {
    const line = el('div', 'tip__row');
    const label = el('span', 'tip__row-label');
    label.textContent = row.label;
    const value = el('span', 'tip__row-value');
    value.textContent = row.value;
    line.append(label, value);
    list.append(line);
  }
  body.append(list);
  return body;
}

/** The leader's blurb, from `data/gyms.ts`, keyed by segment. */
function renderGym(id: string): HTMLElement | null {
  const segment = Number(id);
  if (!Number.isInteger(segment) || segment < 0) return null;
  const gym = gymForSegment(segment);
  const body = panel(gym.leader);
  body.append(line(gym.blurb, 'tip__text'));
  return body;
}

/** The count a threat chip hides in Pocket, carried on the chip. */
function renderThreat(type: string, detail: string | undefined): HTMLElement | null {
  if (!detail) return null;
  const body = panel(type);
  body.append(line(detail, 'tip__text'));
  return body;
}

/**
 * A relic's description and what it grants, from `data/relics.ts` and the
 * capability labels in `data/eventCopy.ts`. The grant is here because the
 * party screen's relic rows fold to the name in Pocket and the drawer never
 * printed it: one tap reaches both facts wherever a relic is tapped.
 */
function renderRelic(id: string): HTMLElement | null {
  const relic = relicById(id as Parameters<typeof relicById>[0]);
  if (!relic) return null;
  const body = panel(relic.name);
  body.append(line(relic.playerDescription, 'tip__text'));
  body.append(line(CAPABILITY_LABELS[relic.grants], 'tip__note'));
  return body;
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
 * What one flag word claims.
 *
 * `data/flagWords.ts`'s sentence, like every other tip here — the layer is a
 * lookup and a positioner and carries no prose of its own, which
 * `test/boundaries.test.ts` checks.
 */
function renderFlag(id: string): HTMLElement | null {
  const blurb = FLAG_BLURBS[id as FlagKind];
  if (!blurb) return null;
  const body = panel(flagWord(id as FlagKind, null));
  body.append(line(blurb, 'tip__text'));
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
function renderStat(id: string, value?: string): HTMLElement | null {
  const info = statInfo(id);
  if (!info) return null;
  // The value, when the trigger carries one: in Pocket the row is a bar and
  // this is where the number is. In the title, beside the name it belongs to,
  // so no sentence is written here. Density modes patch.
  const body = panel(value ? `${info.abbreviation} ${value} — ${info.label}` : `${info.abbreviation} — ${info.label}`);
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

/**
 * The HP line a member card carries, from the bar's `data-value`: the same
 * string the card's own text shows, so a tap says exactly what Detailed
 * prints. Nothing is composed here. Density modes patch, Part 4.
 */
function renderHp(value?: string): HTMLElement | null {
  if (!value) return null;
  const body = panel(statInfo('hp')?.label ?? value);
  body.append(line(value, 'tip__text'));
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
