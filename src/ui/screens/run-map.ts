/**
 * The run map: where you are in the run, where you are in the segment, and what
 * the run has cost so far.
 *
 * Three decisions worth naming.
 *
 * **The whole eight-gym rail is on screen, always.** Stage 1 had one segment and
 * a step chain was the entire map. Eight segments without a rail is a game where
 * the player cannot tell whether they are doing well — "Volta's Gym" means
 * nothing on its own, and "gym 3 of 8, five to go" means everything. The rail
 * also names each leader's type from the start, because a run is planned around
 * type matchups and hiding them would make planning guesswork rather than
 * knowledge.
 *
 * **Upcoming steps are shown.** The map reveals node *kinds* for every step, not
 * just the current one. It never reveals contents — what a wild node contains is
 * unknown until you enter it — so this is not a spoiler, it is the difference
 * between a choice and a coin flip: taking a fight now is a different decision
 * when you can see a rest two steps ahead.
 *
 * **The party panel is always on screen.** HP and PP are the resources a run
 * spends, and a rest node is only a real option if the cost of skipping it is
 * visible at the moment you skip it. From Stage 4 it is a *party* panel rather
 * than one Pokemon: every member, the lead marked, held items shown, and a way
 * into the party screen — because the lead decides who walks into the node you
 * are about to choose, which makes it a decision that belongs next to the map.
 *
 * **Stage 3: every offered fight shows its tier and what it pays, before you
 * commit.** This is the most important pixel in the game. A tier that the
 * player discovers only after walking into it is not a risk they took, it is a
 * thing that happened to them — and the whole stage is the claim that the step
 * between two nodes is a decision. So a current node carries three things: the
 * tier, the exact coin payout (which is a pure function of kind, tier and
 * segment, so it can be shown without spoiling anything), and a one-line read
 * on what the reward pool behind it is like.
 *
 * What it deliberately does *not* show is the three cards themselves. They were
 * drawn when the map was built and could be displayed — but a step where you
 * can read both futures in full is an optimisation problem, not a decision.
 * Tier and payout is the amount of information that leaves a judgement to make.
 */
import type { NodeSpec, Segment } from '../../core/encounters';
import { heldItem } from '../../core/items';
import { FAINTED, hpState } from '../../core/hpCopy';
import { hpFraction } from '../../core/party';
import type { NodeVisit, RunState } from '../../core/run';
import { gymsCleared, localeOf, partyCapacity, stepsOf } from '../../core/run';
import { localeById } from '../../data/locales';
import { resolveCapability, type CapabilityContext } from '../../core/capabilities';
// The two label tables the event screen prints too, from one file (4.8.0.2).
import { BAND_LABELS, CAPABILITY_LABELS, RARITY_LABELS } from '../../data/eventCopy';
import { nodePayout } from '../../core/economy';
import type { PokemonState } from '../../core/types';
import { GYMS, gymForSegment } from '../../data/gyms';
import { GLYPH_LABELS } from '../../data/glyphLabels';
import { AI_TIER_LABEL, aiTierFor } from '../../data/ai';
import { createBar } from '../bar';
import { prose, type Prose } from '../dom';
import { KIND_HINTS } from '../copy/screens';
import { capabilityBandChevron, capabilityGlyph, neutralChip, nodeKindGlyph, statusChip, tierPips } from '../chip';
import { hpTip } from '../member-card';
import { el, levelAria, levelText } from '../scene';
import { typeChip } from './starter-select';

/**
 * The kind's word, for the mark's accessible name and nothing on the face.
 * **Patch 4.10.1, D46.** `KIND_LABELS` lived here from Stage 3 to 4.10.1 and
 * was the label line; the mark is the label line now, and the word is what a
 * screen reader and R7's exposure label say for it. Read from the glyph
 * label table so the two cannot drift.
 */
const kindWord = (kind: NodeSpec['kind']): string => GLYPH_LABELS[`node-${kind}`] ?? kind;

/**
 * The leader's name, for a gym node's face. The node's own `label` is
 * `"<Leader>'s Gym"`, which the run log and the share text read and which
 * `core/` keeps; on the face the mark says gym, so the suffix would be R3's
 * double render. The name comes from the gym table, not from trimming the
 * string.
 */
const gymLeaderName = (segment: number): string => gymForSegment(segment).leader;

export interface RunMap {
  root: HTMLElement;
  /** Redraw from state. `onChoose` fires with the index of a current option. */
  /**
   * Draw the map. `onChoose` picks a node; `onManage` opens the party screen.
   *
   * Two callbacks rather than one because they are different *kinds* of thing:
   * a node pick is a run decision that `playRun` is waiting on, and managing the
   * party is not a decision at all — it edits state between them. Collapsing
   * them into one handler would hide that difference from the one file that has
   * to keep it straight.
   */
  render(state: RunState, onChoose: (index: number) => void, onManage: () => void): void;
}

/**
 * Bring the step the player is standing on into view.
 *
 * **The map's decision point is the only thing on this screen that is
 * urgent**, and on a phone it sits below the gym rail, the segment heading and
 * the whole party panel — measured at y=688 of an 844px viewport with a party
 * of one, and further down with three. Reclaiming the setup chrome (see the
 * phone rules in `styles.css`) buys most of that back; this covers the rest,
 * and covers a long segment on any viewport.
 *
 * `block: 'center'` rather than `'start'`: the steps on either side are what
 * make the current one read as a position in a sequence rather than as a list
 * that happens to begin here.
 *
 * Guarded on the method existing because jsdom does not implement it, and a
 * screen that threw in a test environment would be a screen nobody could test.
 * `prefers-reduced-motion` is honoured through `scroll-behavior` in the
 * stylesheet, which already covers `.chain`.
 */
function scrollToCurrentStep(chain: HTMLElement): void {
  const current = chain.querySelector('.step--current');
  if (current instanceof HTMLElement && typeof current.scrollIntoView === 'function') {
    current.scrollIntoView({ block: 'center', inline: 'nearest' });
  }
}

export function createRunMap(): RunMap {
  const root = el('section', 'screen screen--map');

  const rail = el('ol', 'rail');

  const heading = el('div', 'map__heading');

  const chain = el('ol', 'chain');
  chain.dataset['tutorial'] = 'chain';
  const party = el('div', 'party');

  /*
   * Collapsed, and in a grid area of its own **below the chain**.
   *
   * The first version put it inside the party block, on the reasoning that the
   * party block comes after `chain` in the DOM and therefore could not push the
   * node cards down. `npm run smoke` measured that reasoning and it was wrong:
   * at 390x844 the map's grid reorders to `rail heading party chain`, so on the
   * one viewport Item F cares about the party block is *above* the cards.
   * Opening the readout moved the decision point from y=683 to y=741 — still on
   * screen, and still 58px of the thing the phone pass spent a stage
   * reclaiming.
   *
   * So it gets an area, and the area is last on a phone and under the party
   * column on a desktop. Now no open state can reach the cards at all, which is
   * a stronger guarantee than shipping it closed and hoping.
   *
   * It is created once and moved rather than rebuilt, so a player who opens it
   * finds it still open after the map redraws — which it does on every node,
   * every rest and every flip of the Detail toggle.
   */

  root.append(rail, heading, chain, party);

  return {
    root,
    render(state, onChoose, onManage) {
      const segment = state.segments[state.currentSegment];
      if (!segment) return;

      rail.replaceChildren(...renderRail(state));
      heading.replaceChildren(...renderHeading(state, segment));

      const locale = localeOf(state);
      if (locale) {
        // The ghosted watermark behind the chain. Stage V1. Text only, no
        // layout, no interaction: the stylesheet draws it. It stays on the
        // screen rather than moving into `renderHeading`, because it is this
        // screen's own background treatment and not part of the readout — the
        // map overlay shares the heading and wants no watermark.
        root.dataset['watermark'] = localeById(locale).name;
      } else {
        delete root.dataset['watermark'];
      }

      chain.replaceChildren(...renderChain(state, segment, onChoose));
      scrollToCurrentStep(chain);
      // Coins live next to the party, with the other resources a run spends.
      // A shop node saying "from 55" is only a decision if this is on screen.
      /*
       * The party HUD, which is now a *party* rather than one Pokemon.
       *
       * The button to open the party screen lives here rather than in a menu,
       * because reordering is how the battle lead is set and the lead only
       * matters at the moment you are choosing which node to walk into. Putting
       * it anywhere else would make it a setting instead of a decision.
       */
      /*
       * **The members go in their own grid. Stage 4.8, items 1 and 3.**
       *
       * Item 1 took the roster from three to six, and six of these cards stacked
       * was 697px of a 844px phone — the party HUD alone pushed the one row the
       * player can act on off the bottom of the screen. A wrapper to grid against
       * is the smaller half of the fix; the card itself is the larger, below.
       */
      const members = el('div', 'party__members');
      members.replaceChildren(...state.party.map((member, index) => renderMember(member, index)));
      party.replaceChildren(
        renderWallet(state),
        renderPartyHeader(state.party.length, state, onManage),
        members,
      );
    },
  };
}

/**
 * The eight-gym rail.
 *
 * Cleared gyms are marked from `gymsCleared` rather than from the segment index,
 * because those are different numbers the moment a run ends at a gym: you are
 * *at* segment 3 having cleared 2.
 */
/**
 * The segment heading: which gym, who leads it, what type, how big, how far.
 *
 * **Extracted when the map overlay arrived, and exported rather than copied.**
 * `ui/map-drawer.ts` shows the same readout from every decision surface, and
 * the one thing that must never differ between the two is *what they reveal*.
 * `CLAUDE.md` bars verdicts, rankings and effectiveness against content the
 * player has not reached; a second implementation would be a second place for
 * those rules to drift, and the drift would be invisible until someone
 * compared the two screens side by side.
 *
 * Sharing the function makes the overlay unable to reveal a fact this screen
 * does not — by construction, not by care.
 *
 * The watermark is deliberately **not** here. It is the screen's own background
 * treatment, it writes to the screen's root, and the overlay wants none of it.
 */
export function renderHeading(state: RunState, segment: Segment): HTMLElement[] {
  const gym = segment.gymDefinition;
  const team = segment.gym.encounter?.team.length ?? 1;

  const title = el('h2', 'screen__title');
  title.textContent = `Gym ${state.currentSegment + 1} of ${state.segments.length} — ${gym.leader}`;
  // The leader's blurb, on tap. Pocket hides the flavour line under the
  // heading and the title says it instead (`ui/tooltips.ts`, `gym:`).
  title.dataset['tip'] = `gym:${state.currentSegment}`;
  title.tabIndex = 0;
  title.setAttribute('role', 'button');

  const subtitle = el('p', 'screen__blurb');
  subtitle.replaceChildren(
    typeChip(gym.type),
    // The gym's team size is public and the level band is not. Size changes
    // how the fight is *approached* — a solo Pokemon against three has to
    // budget PP — so hiding it would hide the decision rather than create one.
    document.createTextNode(` · ${team} Pokemon · ${stepsOf(state).length} steps before the gym`),
  );

  const blurb = el('p', 'map__blurb');
  blurb.textContent = gym.blurb;

  /*
   * The region the segment is being walked through, above the step chain.
   *
   * A heading rather than a badge on every node, because the locale is a
   * property of the *whole* route: repeating it on each card would be printing
   * one fact five times, and the phone pass spent a stage reclaiming vertical
   * space. Its four types are here for the same reason they are on the select
   * screen — they are what the region actually means for what you will meet.
   */
  const region = el('p', 'map__region');
  const locale = localeOf(state);
  region.hidden = !locale;
  if (locale) {
    const definition = localeById(locale);
    const label = el('span', 'map__region-name');
    label.textContent = definition.name;
    region.replaceChildren(label, ...definition.types.map(typeChip));
  }

  return [title, subtitle, blurb, region];
}

/**
 * The eight-gym rail. Exported for the map overlay, for `renderHeading`'s
 * reason: one implementation, so one set of facts.
 */
export function renderRail(state: RunState): HTMLElement[] {
  const cleared = gymsCleared(state);

  return GYMS.map((gym, index) => {
    const phase = index < cleared ? 'done' : index === state.currentSegment ? 'current' : 'upcoming';
    const item = el('li', `rail__gym rail__gym--${phase}`);

    const number = el('span', 'rail__number');
    number.textContent = phase === 'done' ? '✓' : String(index + 1);

    const label = el('span', 'rail__label');
    label.textContent = gym.leader;

    item.append(number, label, typeChip(gym.type));
    item.title = `${gym.leader} — ${gym.type}. ${gym.blurb}`;
    return item;
  });
}

/**
 * The step chain. Exported for the map overlay, and `onChoose` is **optional**
 * so that overlay can render it as a readout.
 *
 * Omitting the callback is what makes the overlay safe rather than merely
 * careful: `renderNode` below already computes `const interactive =
 * Boolean(onChoose)` and only attaches a click handler when one was passed, so
 * a chain drawn without it is divs rather than buttons all the way down. The
 * map screen stays the single path by which a node is chosen — `CLAUDE.md`'s
 * Rewards rule — because there is structurally no other control to press.
 */
export function renderChain(
  state: RunState,
  segment: Segment,
  onChoose?: (index: number) => void,
): HTMLElement[] {
  // The route the player committed to, which is empty until they pick a locale.
  const steps = stepsOf(state);
  // Only this segment's visits. History is the whole run now, so filtering by
  // segment is what keeps step 1 of segment 4 from reading step 1 of segment 1's
  // result — the bug the Stage 1 version would have had the moment there were
  // two segments.
  const visits = state.history.filter(
    (visit) => visit.segment === state.currentSegment && visit.node.kind !== 'gym',
  );

  /*
   * **The steps already taken are one line, not one row each. Stage 4.8, item 3.**
   *
   * This is the map redesign that item 3's UI checkpoint exists for, and the reason
   * it is not a cosmetic pass. Before it, every taken step rendered a full card, so
   * the *current* step — the only row the player can act on — was pushed further
   * down the page the deeper into a segment they got. On a 390x844 phone it ended
   * 25px below the fold at 4-5 steps a segment, which is the `xfail` this closes;
   * at item 3's 6-7 steps it would have been far worse, and it would have got worse
   * again with every future length.
   *
   * Collapsing the past into one summary row **bounds the decision's position
   * regardless of how long a segment is**, which is the property the longest row of
   * the curve needs and the flat version could never have. What is lost is the
   * per-step card for nodes the player has already resolved; what that card showed
   * is in the run summary, in full, where a finished node belongs.
   *
   * The route is still the route: one line saying how far in, then the choice, then
   * what is ahead. "Where am I, what's next" is what a map owes a player, and a
   * history of cards nobody can click is not part of it.
   */
  const taken = steps.filter((step) => visits[step.index] !== undefined);
  const rows: HTMLElement[] = [];
  if (taken.length > 0) rows.push(renderTakenSummary(taken.length, steps.length));

  for (const step of steps) {
    if (visits[step.index] !== undefined) continue;
    if (step.index === state.position && !state.outcome) {
      rows.push(renderStep(step.index, step.options, 'current', segment.index, state, undefined, onChoose));
      continue;
    }
    rows.push(renderStep(step.index, step.options, 'upcoming', segment.index, state));
  }

  const gymVisit = state.history.find(
    (visit) => visit.segment === state.currentSegment && visit.node.kind === 'gym',
  );
  const gymPhase = gymVisit ? 'done' : state.position >= steps.length ? 'current' : 'upcoming';
  rows.push(renderStep(steps.length, [segment.gym], gymPhase, segment.index, state, gymVisit));
  return rows;
}

/**
 * The steps behind, as one line. **Stage 4.8, item 3.**
 *
 * An attribute and nothing else: how many of this segment's steps are done. It
 * carries the `step--done` class so the one smoke check that counts done rows still
 * finds the past represented, and so the stylesheet's existing `done` treatment
 * applies without a new rule.
 *
 * Deliberately not a list of what was taken. That is the run summary's job and it
 * does it better, with the result of each node attached; repeating it here would
 * cost the decision the space it just reclaimed.
 */
function renderTakenSummary(taken: number, total: number): HTMLElement {
  const row = el('li', 'step step--done step--taken');
  const marker = el('span', 'step__marker');
  marker.textContent = '·';
  const label = el('span', 'step__taken-label');
  label.textContent = taken === 1 ? `1 of ${total} steps taken` : `${taken} of ${total} steps taken`;
  row.append(marker, label);
  return row;
}

type Phase = 'done' | 'current' | 'upcoming';

function renderStep(
  index: number,
  options: readonly NodeSpec[],
  phase: Phase,
  segment: number,
  run: CapabilityContext,
  visit?: NodeVisit,
  onChoose?: (index: number) => void,
): HTMLElement {
  const row = el('li', `step step--${phase}`);

  const marker = el('span', 'step__marker');
  marker.textContent = String(index + 1);

  const nodes = el('div', 'step__nodes');
  // The tutorial's anchors sit on the current step only: the decision, not the context.
  if (phase === 'current') nodes.dataset['tutorial'] = 'options';
  nodes.append(
    ...options.map((node, option) =>
      renderNode(node, phase, segment, run, visit, onChoose ? () => onChoose(option) : undefined),
    ),
  );

  row.append(marker, nodes);
  return row;
}

function renderNode(
  node: NodeSpec,
  phase: Phase,
  segment: number,
  run: CapabilityContext,
  visit?: NodeVisit,
  onChoose?: () => void,
): HTMLElement {
  const interactive = Boolean(onChoose);
  const element = interactive ? document.createElement('button') : el('div', '');
  if (element instanceof HTMLButtonElement) element.type = 'button';
  element.className = `node node--${node.kind} node--${phase}${node.tier ? ` node--tier-${node.tier}` : ''}`;

  const label = el('span', 'node__label');
  if (phase === 'current') label.dataset['tutorial'] = 'kinds';
  /*
   * **The kind is a mark. Patch 4.10.1, D46.**
   *
   * A head, a bush, a tent, a badge, a bag or a question mark, at 24, where
   * the word stood from Stage 3 to 4.10.1. The gym is still named beside its
   * mark, and the rest are a kind and nothing more, because naming them would
   * reveal what a node contains before the player has chosen it. A gym's team
   * size is named too — see the heading.
   */
  label.append(nodeKindGlyph(node.kind, kindWord(node.kind), 24));
  if (node.kind === 'gym') {
    const size = node.encounter?.team.length ?? 0;
    label.append(document.createTextNode(`${gymLeaderName(segment)}${size > 1 ? ` · ${size} Pokemon` : ''}`));
  }

  /*
   * The tier, beneath the mark, on every step the player can still see. Not
   * only the current one: taking a fight now is a different decision when you
   * can see an elite two steps ahead. **Beneath since 4.10.1**: it shared the
   * label line with the kind word, and the prompt's one instruction about it
   * was *"the tier levels can remain as labels beneath"*, so the pips have a
   * row of their own under the mark. A slot moved inside one component, on
   * both of its call sites, which is what R1 permits.
   *
   * **Through `tierChip` directly since the R19 close-out.** It came through
   * `tierBadge` in `screens/reward.ts`, which was the reward screen re-exporting
   * a chip the map needed — and when the reward screen's badge stopped being a
   * tier (a gym page prints `GYM`, see `OfferBadge`) the shared name stopped
   * describing either caller. This one badges `node.tier`, which really is a
   * tier and really is nullable, so it says so.
   */
  if (node.tier) {
    /*
     * **Pips, not the word. Milestone M5.2, section 3's Tier row.**
     *
     * `NORMAL` and `HARD` were two words naming a bracket; three pips filled
     * to the tier say the same thing as a count. `tierPips` carries the same
     * `tier:` tip the chip did, so the definition from `data/tierInfo.ts` —
     * including what the tier *pays*, which is why there is no second strip
     * (R3) — is one press away exactly as section 3's last column says.
     */
    const badge = tierPips(node.tier);
    if (phase === 'current') badge.dataset['tutorial'] = 'tier';
    const tier = el('span', 'node__tier');
    tier.append(badge);
    element.append(label, tier);
  } else {
    element.append(label);
  }

  const detail = el('span', 'node__detail');
  if (visit?.result) {
    // Past nodes name what was fought. That is information the player already
    // has, and it turns the chain into a record of the run rather than a
    // progress bar.
    const turns = `${visit.result.turns} turn${visit.result.turns === 1 ? '' : 's'}`;
    detail.textContent = node.encounter ? `${node.encounter.opponent} · ${turns}` : turns;
  } else if (visit) {
    detail.textContent = 'restored';
  } else if (phase === 'current') {
    /*
     * The trade, spelled out before the click.
     *
     * The coin payout is exact rather than a range, because it *is* exact — a
     * pure function of kind, tier and segment, computed by the same
     * `nodePayout` that pays it out. Showing a number the player can plan
     * against costs nothing in surprise and buys the whole decision.
     */
    const payout = nodePayout(node, segment);
    // Numbers as text, prose in both of its forms (density modes patch): the
    // tier sentence from `data/tierInfo.ts` and the kind's hint from
    // `ui/copy/screens.ts`, separated by the same middle dot as before.
    const parts: (string | Prose)[] = [];
    if (payout > 0) parts.push(`${payout} coins`);
    /*
     * Who is across the field, on a fight node. **The AI tiers patch.**
     *
     * An attribute, not a verdict: the words name the opponent the way the
     * kind names the node, and none of them says whether the fight is a good
     * idea. This is the first thing on this card that describes how a fight
     * will *play* rather than what it pays, and it is here for the reason the
     * tier badge is — a risk gradient the player cannot see before the click
     * is not a decision.
     */
    if (node.encounter) {
      const tier = aiTierFor(node.kind, node.tier, segment);
      // **One word in every density, and the sentence deliberately not here.**
      // `AI_TIER_DETAIL` is what the opponent does, and it is worth reading —
      // but it wraps this card to a second line, and the map's vertical budget
      // is a gate that V5 spent three decisions to meet. The sentence lives on
      // the battle panel, where the fight it describes is.
      parts.push(AI_TIER_LABEL[tier]);
    }
    /*
     * **The tier sentence is gone from the face. M5.2.**
     *
     * Section 3's Tier row puts the tier *definition* in the inspect column,
     * and `TIER_INFO` is that definition — "What the segment fields, at its own
     * level and band. Pays a move in its own band." It was the longest thing on
     * this card and it is a sentence at rest, which R2 forbids on a card. The
     * pips carry the fact and the `tier:` tip carries the sentence.
     *
     * An untiered node keeps its kind hint: it has no pips to read the fact
     * off, and M5.2 does not name it.
     */
    if (!node.tier) parts.push(KIND_HINTS[node.kind]);
    if (node.kind === 'shop' && node.shop) {
      const cheapest = Math.min(...node.shop.items.map((item) => item.price));
      parts.push(`${node.shop.items.length} on the shelf, from ${cheapest}`);
    }
    detail.replaceChildren(
      ...parts.flatMap((part, index) => [
        ...(index > 0 ? [document.createTextNode(' · ')] : []),
        typeof part === 'string' ? document.createTextNode(part) : prose(part),
      ]),
    );
  } else {
    detail.textContent = '';
  }

  element.append(detail);

  /*
   * The requirement, and the band the run reads at for it.
   *
   * **Shown on every phase, not only the current step**, for the same reason
   * the tier badge is: routing toward an event two steps ahead is only a plan
   * if you can see what it asks for. What is *not* shown is the payout — the
   * player learns that the gate exists and where they stand against it, and
   * finds out what it was worth by walking into it.
   *
   * Two attributes and no verdict. "Requires Cut — your run: latent" is a
   * pair of facts; "you should route here" would be the screen deciding.
   */
  if (node.event) {
    const band = resolveCapability(run, node.event.requires);
    const gate = el('span', `node__gate node__gate--${band}`);
    if (phase === 'current') gate.dataset['tutorial'] = 'gate';
    /*
     * **Rarity joins the pair, because it now changes the payout.**
     *
     * The map already showed the requirement and the run's standing against it.
     * Rarity is the third fact of the same kind: it scales which tier a Gamble
     * or an Attune lands on, so a player routing toward one question mark
     * rather than another deserves to know which one they are routing toward.
     *
     * A third attribute, not a verdict. "Rare" says which distribution this
     * node draws on; it does not say the node is worth the detour, and the
     * screen still never orders two nodes against each other.
     */
    /*
     * **Section 3's capability row, mounted by M1.2.** The chip said what the
     * gate asks for and nothing said what satisfies it, so a player who did
     * not already know which types carry Surf had no way to find out from the
     * screen that was gating them on it. The panel is two lookups — the name
     * from `data/eventCopy.ts`, the types from `data/capabilities.ts` — and it
     * writes nothing of its own.
     */
    /*
     * **The glyph and the chevron, where three word chips used to be.
     * Milestone M5.2, discrepancy D37.**
     *
     * Section 3 has asked for *"capability glyph plus band chevron (none,
     * latent, known)"* on this row since Rev 1; section 2's roster did not
     * carry the family, so what shipped was `Requires Cut`, `Latent` and a
     * rarity word — six words for three facts that all have marks now.
     *
     * **Rarity goes to inspect**, ruled with D37. It is a third attribute of
     * the same gate and it has no row in section 3, so it rides the
     * capability panel rather than spending a word on every gated node on the
     * map. The fact is not dropped: C2 is satisfied by the press, which is
     * where the tier definition beside it already lives.
     *
     * Still two attributes and no verdict. A glyph and a part-filled chevron
     * say what the gate asks and how far this run is from it; neither says the
     * node is worth the detour.
     */
    const requirement = capabilityGlyph(node.event.requires, CAPABILITY_LABELS[node.event.requires]);
    requirement.dataset['detail'] = RARITY_LABELS[node.event.rarity];
    gate.append(requirement, capabilityBandChevron(band, BAND_LABELS[band]));
    element.append(gate);
  }

  if (onChoose) element.addEventListener('click', onChoose);
  return element;
}

function renderWallet(state: RunState): HTMLElement {
  const card = el('div', 'party__wallet');
  const label = el('span', 'party__wallet-label');
  label.textContent = 'Coins';
  const value = el('span', 'party__wallet-value');
  value.textContent = String(state.currency);
  card.append(label, value);
  return card;
}

/**
 * The party's own heading, with the way into the party screen.
 *
 * **Reads the run's live slots. Stage 4.8, item 1.** A constant here would show
 * `3 / 3` to a player who has just been granted a fourth slot.
 *
 * The *next* unlock is not stated here yet, deliberately: item 1 asks for "Party
 * slots: 4. Next slot at Gym 6." on the map or the result screen, and that is a
 * new sentence on a screen rather than a call site reading the right number. The
 * patch's own order of work puts all UI in step 7, so `nextSlotUnlock` ships in
 * `data/partyTuning.ts` with its tests and nothing renders it until then.
 */
function renderPartyHeader(size: number, state: RunState, onManage: () => void): HTMLElement {
  const row = el('div', 'party__header');
  const label = el('span', 'party__wallet-label');
  label.textContent = `Party ${size} / ${partyCapacity(state)}`;
  const manage = document.createElement('button');
  manage.type = 'button';
  manage.className = 'button button--small';
  manage.textContent = 'Manage';
  manage.addEventListener('click', () => onManage());
  row.append(label, manage);
  return row;
}

/**
 * One party member, as the **map** shows them.
 *
 * **Stage 4.8, items 1 and 3: this card lost its moveset and its ability.**
 *
 * It carried four move rows with PP and the ability name, which at three members
 * was a 291px panel and at item 1's six was 697px — more than three quarters of a
 * 390x844 phone, above the chain, pushing the current step's cards off the bottom
 * of the screen. That is the `xfail` item 3's UI checkpoint had to close, and no
 * amount of work on the chain below could have closed it while the HUD above was
 * growing with the roster.
 *
 * What stays is what a *routing* screen owes the player: who is in the party, who
 * leads, how hurt they are, what they are holding, what is wrong with them. PP and
 * abilities are a different question — "can this Pokemon still fight" rather than
 * "which road do I take" — and both are one tap away in the party drawer, which is
 * reachable from this screen and every other, and on the party screen itself.
 *
 * The alternative was keeping the detail and scrolling the map, which trades a
 * decision the player can see for one they have to go looking for.
 */
function renderMember(member: PokemonState, index: number): HTMLElement {
  const card = el('div', 'party__member');
  // The lead is marked on the map, not only on the party screen: it is the
  // Pokemon that walks into whichever node you are about to pick.
  if (index === 0) card.classList.add('party__member--lead');
  if (member.fainted) card.classList.add('party__member--fainted');

  const header = el('div', 'panel__header');
  const name = el('span', 'panel__name');
  name.textContent = member.spec.species;
  const level = el('span', 'panel__level');
  level.textContent = levelText(member.spec.level);
  level.setAttribute('aria-label', levelAria(member.spec.level));
  header.append(name, level);

  /*
   * The `Lead` chip stays on this rail, and M3.2 took it off and put it back.
   *
   * On a party card the chip is the slot number said twice — `isLead` is
   * `index === 0` and the card draws `slotNumber` — so R3 deletes it there.
   * **This rail draws no slot number**, so the chip is the only channel and
   * deleting it needs a replacement rather than nothing.
   *
   * Adding the number was that replacement and it cost a line: the rail's
   * header wrapped from two to three at 390 wide, which moved the map's
   * `decisionTop` 23.5px down the screen and failed the height baseline on
   * every guarded mode. A decision point pushed down the phone is a worse
   * trade than one word on one card, so the word stays.
   *
   * The rail is a sixth hand-rolled party row, which is the section 5 defect
   * D20 is about; folding it into the component would give it the slot number
   * for free. That is M5.2's, which owns this screen.
   */
  if (index === 0) header.append(neutralChip('Lead', 'lead'));


  const bar = createBar();
  bar.set(hpFraction(member));
  const track = bar.root;

  const meta = el('div', 'panel__meta');
  const hp = el('span', 'panel__hp-text');
  hp.textContent = member.fainted ? FAINTED : hpState(member.hp, member.maxHp);
  if (member.fainted) hp.dataset['fainted'] = 'true';
  hpTip(track, hp.textContent);
  meta.append(hp);
  // What they are holding, because Stage 4 lets the player choose who holds
  // what and a targeting decision you cannot audit is one you cannot learn from.
  const item = heldItem(member);
  if (item) meta.append(neutralChip(item.name, 'item'));
  if (member.status) meta.append(statusChip(member.status));

  card.append(header, track, meta);
  return card;
}
