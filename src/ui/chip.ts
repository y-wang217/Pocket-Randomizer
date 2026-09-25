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
import { categoryGlyphId, glyphNode, markFamily, typeGlyphId } from './theme/glyph';
import { BAND_PIPS } from '../data/bandInfo';
import {
  MAX_STAGE,
  formatStage,
  formatStageMultiplier,
  type StageKind,
} from '../data/statStages';

export type ChipVariant =
  | 'type'
  | 'tier'
  | 'reward-tier'
  | 'band'
  | 'status'
  | 'stage'
  | 'capability'
  | 'capability-band'
  | 'node'
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

/**
 * The word form of a chip whose glyph now carries the fact. **M2.1.**
 *
 * Section 2 makes the type chip *"18 glyphs inside a coloured chip"* and the
 * category chip a fist, a ring or a wave. R2 forbids the type name and the
 * category word at rest, and R3 forbids rendering either fact twice. So the
 * glyph is the encoding and the word is a second form of the same fact, kept
 * only because D16 ruled Detailed and Simple keep their labelled face until
 * M6.4 decides whether they survive at all.
 *
 * The stylesheet is what chooses: Pocket renders the glyph alone, the other
 * two render the word. Density has always been a stylesheet change here rather
 * than a re-render, and this keeps it one — the DOM carries both forms and no
 * screen re-renders when the mode changes.
 */
function wordForm(text: string): HTMLElement {
  const word = el('span', 'chip__word');
  word.textContent = text;
  return word;
}

/** A type. The one coloured chip; `type--<name>` carries the hue. */
export function typeChip(type: string, options: ChipOptions = {}): HTMLElement {
  const node = build('type', `type type--${type.toLowerCase()}`, '', options);
  /*
   * The glyph carries the accessible name, not the chip and not the word.
   *
   * Once Pocket hides the word the mark is the only thing naming the type, so
   * it is the one glyph on the card that is not `aria-hidden`. Labelling the
   * chip instead would announce the type twice in the modes that still render
   * the word.
   */
  const mark = glyphNode(typeGlyphId(type), { label: type });
  if (mark) node.append(mark);
  node.append(wordForm(type));
  return node;
}

/**
 * A type chip **on a Pokemon**, which opens the type wheel.
 *
 * Chip-audit patch, 2026-09-17, question 2. This supersedes the 2026-09-10
 * ruling for Pokemon type badges and for those only.
 *
 * ## Why this is a second function and not an option on the first
 *
 * That ruling — "keep the wheel, drop the trigger from the two Pokemon panel
 * type badges" — had been applied to every type chip in the app rather than to
 * the two it named, so the wheel was reachable from a battle move card and
 * from nowhere else. The audit that found that also found why the wide version
 * survived: nine screens take `typeChip` through one wrapper and pass it
 * straight to `.map`, so there was no site at which a Pokemon's type and a gym
 * leader's type could be told apart.
 *
 * This is that site. A Pokemon's types open the wheel; a gym leader's type, a
 * locale's types, a threat entry's type and the type an item boosts do not,
 * because those are the screens where "what beats this" is a forecast about
 * content the player has not reached and `CLAUDE.md` forbids it. The split is
 * a call-site decision, so it is spelled as two functions rather than a flag
 * somebody can pass the wrong way round.
 *
 * **Safe under `.map`.** One parameter, so `types.map(monTypeChip)` cannot
 * hand it an index as a second argument. That is not hypothetical care: every
 * caller is exactly that expression.
 */
export function monTypeChip(type: string): HTMLElement {
  const chip = typeChip(type, { tip: `type:${type}` });
  chip.tabIndex = 0;
  chip.setAttribute('role', 'button');
  return chip;
}

/**
 * A Pokemon's ability, as a chip that opens its explanation.
 *
 * Chip-audit patch, 2026-09-17, question 2. Before it the ability was a real
 * chip on the result summary and the battle panel, a bare `<span>` carrying a
 * `data-tip` on the party card and the acquire panel, plain text inside a
 * concatenated string on starter select, and absent on the learn-move, item
 * target, evolution and locale surfaces.
 *
 * The middle case is the one that justifies a shared builder. A `<span>` with
 * `data-tip` and no `tabIndex` opens under a mouse or a finger and cannot be
 * reached by a keyboard at all — `ui/tooltips.ts` binds `keydown` for Enter and
 * Space, and an element that never takes focus never receives either. So the
 * trigger looked present in the source and was absent for a keyboard reader,
 * which is the failure mode a hand-rolled chip has every time.
 *
 * `extra` is for a slot that already has metrics keyed off its own class —
 * `.party__ability` is positioned and is hidden on a collapsed Pocket card —
 * and those rules are kept rather than restyled.
 */
export function abilityChip(name: string, abilityId: string, extra?: string): HTMLElement {
  const chip = neutralChip(name, 'ability', { tip: `ability:${abilityId}`, ...(extra ? { extra } : {}) });
  chip.tabIndex = 0;
  chip.setAttribute('role', 'button');
  return chip;
}

/** A tier, as its word. No colour: a tier that were a colour would be a verdict. */
export function tierChip(tier: string): HTMLElement {
  return build('tier', `tier tier--${tier}`, tier.toUpperCase());
}

/**
 * A move's base-power band, as a meter. **Patch 4.8.0.3, item 3.**
 *
 * It read `BAND 3`, which is a word plus a number naming a bracket the player
 * has to have been told about. Four pips with three filled says the same thing
 * and says it as a quantity: this move is in the third of four power brackets,
 * and there is one above it.
 *
 * **The number has not gone, it has moved behind the tap** — `data-tip` is
 * unchanged, the words are `data/bandInfo.ts`'s and the panel names the band.
 * Same resolution too: the band still arrives already computed by `bandOfMove`
 * through `moveBandChip`, at both of its call sites, and nothing here decides
 * which bracket a move is in.
 *
 * The pips are not a colour and not a rating. A filled pip is one bracket of
 * base power, the same fact `BAND 3` stated; nothing about the meter says a
 * higher band is a better pick, which is the editorial rule that kept the
 * badge a number rather than a bar in the first place. The meter is legible
 * *as a count*, which the word never was.
 */
export function bandChip(band: number): HTMLElement {
  const node = build('band', `band band--${band}`, '', { tip: `band:${band}` });
  node.setAttribute('role', 'img');
  node.setAttribute('aria-label', `Band ${band} of ${BAND_PIPS}`);
  /*
   * **The pips are the sheet's pips. Milestone M6.1, D41.** They were CSS boxes
   * drawn here, so the band family never reported itself and its exposure
   * label could never fire. M1.1 had already redrawn the pair as a filled and
   * an outlined circle, because two boxes differing only in tone separated by
   * 0.063 at 16px against a floor of 0.12; this mounts that pair. The chip's
   * `aria-label` names the band, so each pip stays `aria-hidden`.
   */
  for (let i = 0; i < BAND_PIPS; i++) {
    const pip = glyphNode(i < band ? 'band-pip-on' : 'band-pip-off', { extra: 'band__pip' }) ?? el('span', 'band__pip');
    if (i < band) pip.dataset['on'] = 'true';
    pip.setAttribute('aria-hidden', 'true');
    node.append(pip);
  }
  return node;
}

/**
 * A node's tier, as a meter. **Milestone M5.2, section 3's Tier row.**
 *
 * Section 3: *"Tier (map node) | Tier pips, reward-tier pips | None | Tier
 * definition."* `NORMAL` and `HARD` were words naming a bracket the player has
 * to have been told about; three pips filled to the tier say the same thing as
 * a quantity, which is the band meter's argument one family up and the reason
 * R2 deletes a label but keeps a count.
 *
 * **Only one strip, and that is R3 rather than a shortcut.** Section 3 asks for
 * tier pips *and* reward-tier pips. In this tree the reward tier is a pure
 * function of the node tier — `data/tierInfo.ts` says normal pays its own band,
 * hard one up, elite two up — so a second strip would render one attribute
 * twice on one surface, which is exactly what R3 forbids. What a tier pays is
 * on inspect, in the tier definition, where section 3's own last column puts
 * it. Recorded in `docs/generation.md` §67.
 *
 * Not a rating. A filled pip is one step of difficulty, the same fact `HARD`
 * stated; nothing here says a higher tier is a better route, which is the
 * editorial rule C1 binds every map surface with.
 */
export function tierPips(tier: string): HTMLElement {
  const step = TIER_STEPS.indexOf(tier) + 1;
  /*
   * `tier-pips`, not `tier`. **`.tier` is still the reward screen's text
   * chip** — `offerBadge` draws `GYM` and `ELITE` through `tierChip`, and that
   * rule sets `display: inline-block` with padding, so a meter wearing the
   * same class renders as an empty box. Found the direct way, on the map.
   */
  const node = build('tier', `tier-pips tier-pips--${tier}`, '', { tip: `tier:${tier}` });
  node.setAttribute('role', 'img');
  node.setAttribute('aria-label', `Tier ${step} of ${TIER_STEPS.length}`);
  for (let i = 0; i < TIER_STEPS.length; i++) {
    const pip = el('span', 'tier-pips__pip');
    if (i < step) pip.dataset['on'] = 'true';
    pip.setAttribute('aria-hidden', 'true');
    node.append(pip);
  }
  return node;
}

/** The tier ladder, lowest first. The order the pips count in. */
const TIER_STEPS: readonly string[] = ['normal', 'hard', 'elite'];

/**
 * Which tiers an event option can pay, as a span of pips. **Milestone M5.6.**
 *
 * Section 3's Tier row has asked for *"reward-tier pips"* since Rev 1 and
 * nothing rendered them: the event screen printed `Reward: T0 to T2`, which is
 * a label, a ladder position and a range written out, on the one surface where
 * every word is already spoken for. Four pips, one per outcome tier, with the
 * ones this option draws from filled.
 *
 * **A span, not a fill-to-step, and that is the whole difference from
 * `tierPips`.** A node's tier is a position on a ladder, so its meter fills
 * from the bottom. An option's reward is a *range* — Gamble reaches from `T0`
 * to `T2` and Attune from `T2` to `T3` — and a meter filled from the bottom
 * would say those two overlap everywhere they do not. Where the range is one
 * tier the span is one pip, which reads as the narrow thing it is.
 *
 * Not a rating, on the same footing as the tier label it replaces: it names
 * which pool the outcome draws from, which is an attribute of the button. The
 * carve-out is `docs/generation.md` section 14 and it is unchanged by drawing
 * the same fact without words.
 */
export function rewardTierPips(low: string, high: string, label: string): HTMLElement {
  const first = REWARD_TIER_STEPS.indexOf(low);
  const last = REWARD_TIER_STEPS.indexOf(high);
  const node = build('reward-tier', `reward-tier-pips reward-tier-pips--${low}-${high}`, '', {
    tip: `reward-tier:${low}-${high}`,
  });
  node.setAttribute('role', 'img');
  node.setAttribute('aria-label', label);
  for (const [index, tier] of REWARD_TIER_STEPS.entries()) {
    const pip = el('span', `tier-pips__pip reward-tier-pips__pip reward-tier-pips__pip--${tier}`);
    if (index >= first && index <= last) pip.dataset['on'] = 'true';
    pip.setAttribute('aria-hidden', 'true');
    node.append(pip);
  }
  return node;
}

/** T0 to T3, lowest first. The order the reward pips are laid out in. */
const REWARD_TIER_STEPS: readonly string[] = ['T0', 'T1', 'T2', 'T3'];

/**
 * The capability a gated node asks for, as its glyph. **M5.2, D37.**
 *
 * Section 3 has specified a *"capability glyph plus band chevron"* on this row
 * since Rev 1 and section 2's roster did not carry the family until D37; what
 * shipped in the meantime was `Requires Cut`, two words for a fact with a
 * mark. The name and what satisfies it are the inspect column, reached by the
 * same `capability:` tip the chip carried.
 */
export function capabilityGlyph(capability: string, label: string): HTMLElement {
  const node = build('capability', 'node__gate-need', '', { tip: `capability:${capability}` });
  const mark = glyphNode(`capability-${capability}`, { label });
  if (mark) node.append(mark);
  node.setAttribute('role', 'img');
  node.setAttribute('aria-label', label);
  return node;
}

/**
 * The kind of a node, as its mark. **Patch 4.10.1, D46.**
 *
 * One builder for the two surfaces that carry the kind, the map node card and
 * the battle screen header, because R1 forbids the same attribute encoded two
 * ways: the head the player routed toward is the head the fight is under. The
 * size is the one thing the surfaces differ on, 24 on the card where the mark
 * is the face and 16 on the header where it sits beside text, and section 5
 * carries both numbers.
 *
 * The word is the glyph's accessible name and R7's exposure label, and nothing
 * else: `KIND_LABELS` went with the build. The hint behind the mark is the
 * `node:` tip, fed by `KIND_HINTS`, which is the copy the detail line printed
 * for an untiered node and the tutorial paraphrased.
 */
export function nodeKindGlyph(kind: string, label: string, size: 24 | 16): HTMLElement {
  const node = build('node', 'node__kind', '', { tip: `node:${kind}` });
  const mark = glyphNode(`node-${kind}`, { label, size });
  if (mark) node.append(mark);
  node.setAttribute('role', 'img');
  node.setAttribute('aria-label', label);
  return node;
}

/**
 * Where the run stands against that capability, as the band chevron. **M5.2.**
 *
 * Three states — none, latent, known — drawn as two chevrons with none, one or
 * both filled. That is the band meter's pattern rather than three more
 * silhouettes inside one family, and it keeps the reading a *count*: how much
 * of the way there this run is.
 */
export function capabilityBandChevron(band: string, label: string): HTMLElement {
  const filled = CAPABILITY_BAND_STEPS.indexOf(band);
  const node = build('capability-band', 'node__gate-band', '', { tip: `capability-band:${band}` });
  node.setAttribute('role', 'img');
  node.setAttribute('aria-label', label);
  for (let i = 0; i < CAPABILITY_BAND_STEPS.length - 1; i++) {
    const mark = glyphNode(i < filled ? 'capability-band-on' : 'capability-band-off', { label });
    if (mark) {
      mark.setAttribute('aria-hidden', 'true');
      node.append(mark);
    }
  }
  return node;
}

/** none, latent, known: the ladder the chevrons count along. */
const CAPABILITY_BAND_STEPS: readonly string[] = ['none', 'latent', 'known'];

/** A status condition. `data-status` names it; the label is what is shown. */
export function statusChip(id: string, label: string = id.toUpperCase(), options: ChipOptions = {}): HTMLElement {
  const node = build('status', 'badge badge--status', label, options);
  node.dataset['status'] = id;
  /*
   * **The lettering is the sheet's. Milestone M6.1, D41.** Section 2 makes the
   * status family lettering, so the six major conditions are glyphs in the
   * sheet whose art is their three letters. Mounting that glyph in place of
   * the same letters is what lets the family report itself. A volatile has no
   * sheet entry (D19 put it in the family without drawing it) and a chip whose
   * caller asked for other letters keeps them, so both are marked instead.
   */
  const mark = glyphNode(`status-${id}`);
  if (mark && mark.textContent === label) node.replaceChildren(mark);
  else markFamily(node, 'status');
  return node;
}

/**
 * A stat stage, as the multiplier it applies plus a ladder. **Patch 4.8.0.3.**
 *
 * It used to print the stage integer — `Atk +2`, `Spe -1` — which is a number
 * only a Pokemon player can read. It now prints `Atk 2.0x` and draws where the
 * stage sits in its range beside it. Same fact, one form anyone can read and
 * one form that shows how much room is left.
 *
 * **The stage integer has not been dropped, it has changed element.** The
 * ladder *is* the stage: two of six segments filled is `+2`, and the signed
 * number rides on the ladder's `aria-label` so a screen reader gets it as a
 * number rather than as a count of divs. Printing both as text would spend
 * width saying one thing twice, on the row with the least width in the game.
 *
 * `label` names the stat the stage is on, and it is optional for the same
 * reason it always was: a summary row already sits beside the stat it belongs
 * to, and the battle panel's row is a mixed handful of chips where a bare
 * multiplier would not say 2.0x of what.
 *
 * `kind` picks the ladder. Accuracy and evasion are on a different one and
 * `+1` means a different number on each — see `data/statStages.ts`.
 *
 * A zero stage has no chip. The caller filters, because the callers differ on
 * what they are iterating and a component that returned null for the common
 * case would push the same `if` into every one of them.
 */
export function stageChip(stage: number, label?: string, kind: StageKind = 'main'): HTMLElement {
  const multiplier = formatStageMultiplier(stage, kind);
  const node = build(
    'stage',
    `badge badge--${stage > 0 ? 'up' : 'down'}`,
    label ? `${label} ${multiplier}` : multiplier,
  );
  node.append(stageLadder(stage, kind));
  return node;
}

/**
 * The ladder: `MAX_STAGE` segments, `|stage|` of them filled, direction on the
 * element.
 *
 * Segments rather than a width percentage, because the quantity being drawn is
 * a count — there are exactly thirteen positions a stage can hold — and a bar
 * that could land between two of them would be drawing a precision the
 * mechanic does not have.
 *
 * `aria-hidden` on the segments and the signed stage on the container: the
 * shape is decoration, the number it encodes is not.
 */
function stageLadder(stage: number, kind: StageKind): HTMLElement {
  const filled = Math.min(MAX_STAGE, Math.abs(stage));
  const ladder = el('span', `stage-ladder stage-ladder--${stage > 0 ? 'up' : 'down'}`);
  ladder.dataset['stage'] = String(stage);
  ladder.setAttribute('role', 'img');
  ladder.setAttribute(
    'aria-label',
    `stage ${formatStage(stage)} of ${MAX_STAGE}, ${formatStageMultiplier(stage, kind)}`,
  );
  for (let i = 0; i < MAX_STAGE; i++) {
    const segment = el('span', 'stage-ladder__seg');
    if (i < filled) segment.dataset['on'] = 'true';
    segment.setAttribute('aria-hidden', 'true');
    ladder.append(segment);
  }
  return ladder;
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
  const node = build('category', `badge badge--category badge--cat-${category.toLowerCase()}`, '', options);
  const mark = glyphNode(categoryGlyphId(category), { label: category });
  if (mark) node.append(mark);
  node.append(wordForm(label));
  node.tabIndex = 0;
  node.setAttribute('role', 'button');
  return node;
}

/** The live effectiveness marker on a battle move button. */
export function effectChip(label: string, band: string): HTMLElement {
  const node = build('effect', 'badge badge--effect', label);
  node.dataset['band'] = band;
  // The forecast's numeral reports its family (M6.1, D41). Section 2 draws the
  // family as an edge and a numeral rather than a glyph, so it is marked.
  markFamily(node, 'effectiveness');
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
