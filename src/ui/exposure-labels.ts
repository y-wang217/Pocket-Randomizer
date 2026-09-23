/**
 * The exposure labels. **Milestone M6.1, for design bible R7.**
 *
 * R7: *"The first time a glyph family appears for this player, a small label
 * renders beside it for that screen. The label returns once more on the third
 * exposure, then never."* M1.3 built the counter and nothing fed it; this is the
 * part that feeds it and renders.
 *
 * ## What counts as an exposure (D43)
 *
 * **A painted glyph.** A screen shown in Detailed or Simple draws a type's word
 * instead of its glyph, so it does not count toward that family, and a player
 * who switches to Pocket later still gets both labels. "Painted" is the same
 * test the coach marks use for an anchor: connected, under no `hidden`
 * ancestor, and `checkVisibility` where the browser has it.
 *
 * ## One pass per screen, again whenever the screen redraws
 *
 * `label` is called when a screen is shown, and again whenever its subtree
 * changes (`watch`). The battle screen redraws every turn and would otherwise
 * drop its labels after the first. Counting stays once per visit because the
 * store's `noteExposure` keeps the set of families already counted on the
 * current screen, so a second pass reads the count without moving it, and on
 * a first or third visit the redrawn glyphs are labelled again.
 *
 * ## Every glyph of the family, one label per group
 *
 * Section 7: *"On a first run every glyph on that screen carries its label."*
 * So every painted glyph of a due family gets its word. A group of marks that
 * make one fact (a band's five pips, the capability chevrons) gets one label
 * after the group, not one per pip.
 *
 * ## Presentation only
 *
 * The labels are `aria-hidden`: every glyph already carries its word as an
 * accessible name, so a screen reader would hear it twice. Nothing here
 * reaches `core/`, and nothing here reads a seed.
 */
import { GLYPH_FAMILIES, isGlyphFamily, type GlyphFamily } from '../data/glyphFamilies';
import { FAMILY_LABELS, GLYPH_LABELS } from '../data/glyphLabels';
import { el } from './dom';
import { noteExposure } from './settings';

/** The class every label carries, so a pass can tell its own output apart. */
export const EXPOSURE_LABEL_CLASS = 'exposure-label';

/** R7's two exposures. A count is the one after `noteExposure`'s increment. */
const DUE: ReadonlySet<number> = new Set([1, 3]);

/** Elements whose glyphs are one fact together, labelled once after the group. */
const GROUP = '.band, .chip--capability-band';

function painted(element: Element): boolean {
  if (!element.isConnected || element.closest('[hidden]') !== null) return false;
  const check = (element as { checkVisibility?: () => boolean }).checkVisibility;
  return typeof check === 'function' ? check.call(element) : true;
}

/** The word for one painted mark: its glyph's, else its family's, else the type's own name. */
function wordFor(mark: HTMLElement, family: GlyphFamily): string | null {
  const id = mark.dataset['glyph'];
  if (id) {
    if (GLYPH_LABELS[id]) return GLYPH_LABELS[id];
    // Type glyphs carry the type's name as their accessible name (`glyph.ts`).
    if (family === 'type') return mark.getAttribute('aria-label');
  }
  return (FAMILY_LABELS as Readonly<Record<string, string>>)[family] ?? null;
}

/** Where the label goes: after the group a mark belongs to, or after the mark. */
function hostOf(mark: HTMLElement): HTMLElement {
  return mark.closest<HTMLElement>(GROUP) ?? mark;
}

function labelAfter(host: HTMLElement, family: GlyphFamily, word: string): void {
  const next = host.nextElementSibling;
  if (next?.classList.contains(EXPOSURE_LABEL_CLASS)) return;
  const label = el('span', EXPOSURE_LABEL_CLASS);
  // Not `data-family`: a label is a word, not a mark, and anything that walks
  // the families (this pass, the family walk test) must not find it.
  label.dataset['exposureLabel'] = family;
  label.setAttribute('aria-hidden', 'true');
  label.textContent = word;
  host.after(label);
}

/**
 * Count every family painted under `root` for this visit to `screen`, and label
 * each one whose count is 1 or 3. Returns the families labelled, for a test.
 */
export function labelExposures(screen: string, root: ParentNode): GlyphFamily[] {
  const byFamily = new Map<GlyphFamily, HTMLElement[]>();
  for (const mark of root.querySelectorAll<HTMLElement>('[data-family]')) {
    const family = mark.dataset['family'];
    if (!isGlyphFamily(family) || !painted(mark)) continue;
    const marks = byFamily.get(family) ?? [];
    marks.push(mark);
    byFamily.set(family, marks);
  }

  const labelled: GlyphFamily[] = [];
  // Section 2's order, so the store is written in the same order every pass.
  for (const family of GLYPH_FAMILIES) {
    const marks = byFamily.get(family);
    if (!marks) continue;
    if (!DUE.has(noteExposure(family, screen))) continue;
    labelled.push(family);
    for (const mark of marks) {
      const word = wordFor(mark, family);
      if (word) labelAfter(hostOf(mark), family, word);
    }
  }
  return labelled;
}

/**
 * Re-run the pass whenever `root`'s subtree changes, batched to one pass per
 * microtask. `current` names the screen to count against at that moment, or
 * null to skip; it is read at pass time so a screen swap is never counted
 * under the previous name. Returns a stop function.
 */
export function watchExposures(root: HTMLElement, current: () => { screen: string; within: ParentNode } | null): () => void {
  let queued = false;
  const run = (): void => {
    queued = false;
    const target = current();
    if (target) labelExposures(target.screen, target.within);
  };
  const observer = new MutationObserver((records) => {
    /*
     * Two things put new glyphs in front of the player: nodes added, and a
     * `hidden` toggled, which is how the router shows a screen it drew while
     * another was up. A pass's own labels are additions too, so a batch that
     * only added labels is skipped, or every pass would schedule the next.
     */
    const relevant = records.some(
      (record) =>
        record.type === 'attributes' ||
        [...record.addedNodes].some((node) => !(node instanceof HTMLElement && node.classList.contains(EXPOSURE_LABEL_CLASS))),
    );
    if (!relevant || queued) return;
    queued = true;
    queueMicrotask(run);
  });
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  return () => observer.disconnect();
}
