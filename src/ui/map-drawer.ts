/**
 * The run map, from anywhere. The other half of a rule already written down.
 *
 * ## The rule this finishes
 *
 * `ui/drawer.ts` carries the standing rule, and `docs/generation.md` §12 is
 * where future screens inherit it: **any screen that asks the player for a
 * decision must expose current party state without leaving the decision.**
 *
 * The party drawer built one half of that. This is the other half, and the
 * argument is word for word the same one. A player on the shop screen deciding
 * whether to spend 40 coins cannot see whether a rest is two steps ahead. A
 * player in a battle picking a move cannot see whether the next step offers a
 * rest or another fight. **That information is hidden by no rule** — the map
 * screen shows all of it, kinds and tiers and event gates, for every step of
 * the committed route — it is merely unreachable from the screen where the
 * decision is being made. Which is exactly the failure the party drawer exists
 * to remove, applied to the other readout.
 *
 * ## It cannot reveal more than the map screen, by construction
 *
 * `CLAUDE.md` bars verdicts, rankings, and effectiveness against content the
 * player has not reached. This file satisfies that without making a single new
 * judgement call, because it does not render anything: it calls `renderRail`,
 * `renderHeading` and `renderChain` out of `ui/screens/run-map.ts`, which are
 * the map screen's own functions.
 *
 * A second implementation would have been a second place for the reveal rules
 * to drift, and the drift would have been invisible until somebody compared
 * the two surfaces side by side. Sharing the functions means the question
 * cannot arise.
 *
 * ## It is a readout, not a second path to a decision
 *
 * `renderChain` is called **with no `onChoose`**. That is not a stylistic
 * choice — `renderNode` attaches a click handler only when one is passed, and
 * renders a div rather than a button when one is not, so every node in here is
 * structurally unpressable. `CLAUDE.md`'s Rewards rule says every node
 * completion routes through the single result screen and there is never a
 * second path by which a node completes; an overlay that could pick would be
 * that second path.
 *
 * It inherits the party drawer's other three properties for the same reason
 * that one has them, and `test/map-drawer.test.ts` asserts all four per
 * surface rather than once:
 *
 *   - Opening it never advances run state.
 *   - Opening it never submits a decision.
 *   - Opening it consumes no RNG.
 *   - Nothing inside it is a control.
 *
 * ## What it deliberately leaves out
 *
 * **The party block and the wallet.** The map *screen* carries both, and this
 * overlay does not. The party drawer is one tap away in the same bar and
 * already shows the party, its items and its HP; printing them here too would
 * be two readouts of one fact, which is two places for it to drift.
 *
 * **The settings pickers.** They live on the surface reachable from every
 * screen of a run, and that is the party drawer.
 *
 * **Tutorial marks.** The map screen's own marks already teach the chain, the
 * node kinds, the tier badge and the event gate. A second set of marks over
 * the same content is a second thing to keep in agreement with the first, for
 * no fact the player has not already been shown.
 */
import type { RunState } from '../core/run';
import { createOverlay } from './overlay';
import { el } from './dom';
import { renderChain, renderHeading, renderRail } from './screens/run-map';

export interface MapDrawer {
  /** The overlay itself, mounted once at the app root and toggled. */
  root: HTMLElement;
  /** A trigger button, built fresh per call. See `trigger` below. */
  trigger(): HTMLButtonElement;
  /**
   * Show the run as it currently stands.
   *
   * Takes `RunState` rather than a prepared view, because unlike the party
   * drawer there is nothing to prepare: the three renderers read the state
   * themselves. `opener` is the button that was pressed, so focus goes back
   * there on close.
   */
  open(state: RunState, opener?: HTMLElement | null): void;
  close(): void;
  isOpen(): boolean;
}

export function createMapDrawer(): MapDrawer {
  const overlay = createOverlay({ block: 'map-drawer', label: 'The run map', title: 'The run' });

  const rail = el('ol', 'rail map-drawer__rail');
  const heading = el('div', 'map__heading map-drawer__heading');
  const chain = el('ol', 'chain map-drawer__chain');

  // The same three class names the map screen uses, so the stylesheet's rail,
  // heading and chain rules apply here without a second set of metrics. The
  // `map-drawer__` half is the hook for the few places the overlay differs.
  overlay.body.append(rail, heading, chain);

  return {
    root: overlay.root,

    /**
     * A trigger, built fresh per call, mirroring `drawer.ts`.
     *
     * It carries `drawer__trigger` as well as its own class so it is visibly
     * the same control as the Party button beside it — the brief asks for a
     * mimic, and two buttons in one bar that do the same kind of thing should
     * not look like two kinds of thing.
     *
     * `data-map-trigger` is its own test hook, separate from the party
     * drawer's `data-drawer-trigger`, which `test/party-drawer.test.ts` counts
     * per surface. Sharing one attribute would have made that count wrong on
     * every screen.
     */
    trigger() {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button button--small drawer__trigger map-drawer__trigger';
      button.textContent = 'Map';
      button.setAttribute('aria-haspopup', 'dialog');
      button.dataset['mapTrigger'] = 'true';
      return button;
    },

    open(state, opener) {
      const segment = state.segments[state.currentSegment];
      if (!segment) return;

      rail.replaceChildren(...renderRail(state));
      heading.replaceChildren(...renderHeading(state, segment));
      // No `onChoose`. See the header: this is what makes it a readout.
      chain.replaceChildren(...renderChain(state, segment));

      overlay.open(opener);
    },

    close: () => overlay.close(),
    isOpen: () => overlay.isOpen(),
  };
}
