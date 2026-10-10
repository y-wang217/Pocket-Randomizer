/**
 * The card run's screens (`docs/spec/gymrun-card-run-prompt.md`): what the
 * deployed page shows. A title, then the run: a progress strip of every
 * fight and stop, the team, and the one decision the run is waiting on.
 * Battles open the battle screen (`cardbattle/sandbox.ts`) in its run mode,
 * over this one.
 *
 * The screen holds no rules. Every tap is a `RunAction`; `stepRun` answers
 * with the next state. A refused action changes nothing and says why.
 *
 * The run's log, its seed and every decision, is saved after each action, so
 * a reload resumes it by replay. Storage is a convenience: when it is out of
 * reach the run still plays, it just does not survive a reload.
 *
 * Outside the design bible, like the battle it wraps
 * (`docs/spec/gymrun-card-battle-engine-rulings.md`).
 */
import './cardrun.css';

import { CARDS, UPGRADE_OF } from '../../cardData/cards';
import { RUN_COPY } from '../../cardData/cardrunCopy';
import { ACTS, EVENTS } from '../../cardData/cardrunTables';
import { nameOf, setCardLanguage } from '../../cardData/copy';
import { ENCOUNTERS } from '../../cardData/encounters';
import { ENEMIES } from '../../cardData/enemies';
import { UNITS } from '../../cardData/units';
import { CLASS_SLOTS } from '../../cardData/classes';
import {
  campOpen,
  campPrice,
  createRun,
  currentNode,
  currentStop,
  eventOptionOpen,
  newRunLog,
  progressOf,
  replayRun,
  stepRun,
  upgradable,
  type CardRunState,
  type RunAction,
  type RunLog,
} from '../../core/cards/cardrun';
import type { UnitDefId } from '../../core/cards/defs';
import { newLog } from '../../core/cards/log';
import { newSeed } from '../seed';
import { effectLines, openSandbox, tutorialSeen } from '../cardbattle/sandbox';
import { loadCardPrefs } from '../cardbattle/prefs';

const SAVE_KEY = 'gymrun.cardrun.v1';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function btn(className: string, label: string, onTap: () => void): HTMLButtonElement {
  const node = el('button', `cr-btn ${className}`.trim(), label);
  node.type = 'button';
  node.addEventListener('click', onTap);
  return node;
}

function loadSave(): RunLog | null {
  try {
    const raw = globalThis.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const log = JSON.parse(raw) as RunLog;
    return log && typeof log.seed === 'string' && Array.isArray(log.actions) ? log : null;
  } catch {
    return null;
  }
}

function writeSave(log: RunLog | null): void {
  try {
    if (log) globalThis.localStorage.setItem(SAVE_KEY, JSON.stringify(log));
    else globalThis.localStorage.removeItem(SAVE_KEY);
  } catch {
    // A convenience only: the run plays on without it.
  }
}

export interface CardRunShell {
  root: HTMLElement;
}

export function mountCardRun(host: HTMLElement): CardRunShell {
  setCardLanguage(loadCardPrefs().language);
  const root = el('div', 'cr');
  host.append(root);

  let run: CardRunState | null = null;
  let log: RunLog | null = null;
  /** An overlay inside the shell: the deck list, or the camp's card picker. */
  let overlay: 'deck' | 'camp' | null = null;
  let message = '';
  /** The battle screen, while one is open. */
  let battleOpen = false;
  /** The player left the battle screen for the run's; cleared by the next decision. */
  let steppedOut = false;

  function act(action: RunAction): boolean {
    if (!run || !log) return false;
    const result = stepRun(run, action);
    if (!result.ok) {
      message = RUN_COPY.refusal[result.reason];
      render();
      return false;
    }
    run = result.state;
    log.actions.push(action);
    writeSave(log);
    message = '';
    overlay = null;
    steppedOut = false;
    if (!battleOpen) render();
    return true;
  }

  function begin(seed: string): void {
    run = createRun(seed);
    log = newRunLog(seed);
    writeSave(log);
    overlay = null;
    render();
  }

  function resume(saved: RunLog): void {
    try {
      run = replayRun(saved);
      log = saved;
      render();
    } catch {
      // A save from another build does not replay: it is dropped, loudly, never reinterpreted.
      writeSave(null);
      message = 'The saved run is from another version and cannot be resumed.';
      run = null;
      log = null;
      render();
    }
  }

  /** The battle screen over the shell, on the battle the run stands on. */
  function openBattle(): void {
    if (!run?.battle || battleOpen) return;
    const battle = run.battle;
    const battleLog = newLog(battle.seed, battle.encounter, battle.state.deckId, battle.loadout);
    battleLog.actions = [...battle.actions];
    battleOpen = true;
    openSandbox(globalThis.document.body, {
      run: { state: battle.state, log: battleLog, onAction: (action) => act({ type: 'battle', action }) },
      onExit: () => {
        battleOpen = false;
        // Stepped out mid-battle: show the run, and open the battle again only on a tap.
        // A battle that began as this one ended is a new one, and opens at once.
        steppedOut = run?.screen.k === 'battle' && run.battle?.seed === battle.seed;
        render();
      },
    });
  }

  // ------------------------------------------------------------------ render

  function render(): void {
    root.replaceChildren();
    if (!run) return renderTitle();
    root.append(renderHeader(run), renderStrip(run), renderTeam(run));
    const main = el('main', 'cr-main');
    if (message) main.append(el('div', 'cr-message', message));
    main.append(renderScreen(run));
    root.append(main, renderFooter(run));
    if (overlay) root.append(renderOverlay(run, overlay));
  }

  function renderTitle(): void {
    const panel = el('div', 'cr-title');
    panel.append(el('h1', 'cr-title-name', RUN_COPY.title), el('p', 'cr-title-tag', RUN_COPY.tagline));
    const saved = loadSave();
    if (saved) panel.append(btn('cr-btn--primary', RUN_COPY.continueRun, () => resume(saved)));
    // The tutorial leads on a first visit, before any run, and steps back once seen or skipped.
    const first = !saved && !tutorialSeen();
    const tutorial = btn(first ? 'cr-btn--primary' : 'cr-btn--quiet', RUN_COPY.tutorial, () =>
      openSandbox(globalThis.document.body, { tutorial: true, afterTutorial: 'exit', onExit: () => render() }),
    );
    if (first) panel.append(tutorial);
    panel.append(btn(saved || first ? '' : 'cr-btn--primary', RUN_COPY.newRun, () => begin(newSeed())));
    if (!first) panel.append(tutorial);
    panel.append(btn('cr-btn--quiet', RUN_COPY.sandbox, () => openSandbox(globalThis.document.body, {})));
    if (message) panel.append(el('div', 'cr-message', message));
    root.append(panel);
  }

  function renderHeader(s: CardRunState): HTMLElement {
    const header = el('header', 'cr-header');
    const p = progressOf(s);
    const where = el('div', 'cr-where');
    where.append(el('span', 'cr-act', RUN_COPY.act(p.act, p.acts)), el('span', 'cr-seed', RUN_COPY.seed(s.seed)));
    const supplies = el('div', 'cr-supplies');
    supplies.append(el('span', 'cr-supplies-icon', '◆'), el('span', 'cr-supplies-n', String(s.supplies)));
    supplies.setAttribute('aria-label', RUN_COPY.suppliesN(s.supplies));
    header.append(where, supplies, btn('cr-btn--small', RUN_COPY.deck(s.deck.length), () => {
      overlay = 'deck';
      render();
    }));
    return header;
  }

  /** Every node of the run in a row, by act: a fight, a stop, a boss; done, here, or ahead. */
  function renderStrip(s: CardRunState): HTMLElement {
    const strip = el('ol', 'cr-strip');
    s.nodes.forEach((node, index) => {
      const item = el('li', 'cr-node');
      const kind = node.kind === 'stop' ? 'stop' : node.boss ? 'boss' : 'fight';
      item.dataset['kind'] = kind;
      item.dataset['state'] = index < s.at ? 'done' : index === s.at ? 'here' : 'ahead';
      if (index > 0 && node.act !== s.nodes[index - 1]!.act) item.dataset['act'] = 'start';
      item.textContent = kind === 'stop' ? '·' : kind === 'boss' ? '☠' : '⚔';
      const label = node.kind === 'fight' ? nameOf(ENCOUNTERS[node.encounter]!.name) : RUN_COPY.node.stop;
      item.title = label;
      item.setAttribute('aria-label', `${RUN_COPY.node[kind]}: ${label}${index === s.at ? `, ${RUN_COPY.node.here}` : index < s.at ? `, ${RUN_COPY.node.done}` : ''}`);
      strip.append(item);
    });
    return strip;
  }

  function renderTeam(s: CardRunState): HTMLElement {
    const team = el('section', 'cr-team');
    team.setAttribute('aria-label', RUN_COPY.team);
    for (const id of ['A', 'B', 'C'] as UnitDefId[]) {
      const def = UNITS[id];
      const boost = s.boosts[id];
      const unit = el('div', 'cr-unit');
      unit.dataset['owner'] = id;
      unit.append(el('div', 'cr-unit-name', `${id} ${nameOf(def.name)}`));
      const stats = el('div', 'cr-unit-stats');
      const stat = (text: string, boosted: boolean): void => {
        const node = el('span', 'cr-unit-stat', text);
        if (boosted) node.dataset['boosted'] = 'true';
        stats.append(node);
      };
      stat(RUN_COPY.hp(def.hp + (boost.hp ?? 0)), !!boost.hp);
      stat(RUN_COPY.base(def.baseShield + (boost.baseShield ?? 0)), !!boost.baseShield);
      stat(RUN_COPY.slots(CLASS_SLOTS[def.class] + (boost.slots ?? 0)), !!boost.slots);
      if (boost.mp) stat(RUN_COPY.mp(boost.mp), true);
      unit.append(stats);
      team.append(unit);
    }
    return team;
  }

  function renderFooter(s: CardRunState): HTMLElement {
    const footer = el('footer', 'cr-footer');
    if (campOpen(s)) {
      const { price, payable } = campPrice(s);
      const none = upgradable(s).length === 0;
      const camp = btn('', none ? RUN_COPY.camp.none : payable ? RUN_COPY.camp.upgrade(price) : RUN_COPY.camp.cannotPay(price), () => {
        overlay = 'camp';
        render();
      });
      camp.disabled = !payable;
      footer.append(camp);
    }
    if (s.screen.k === 'over') footer.append(btn('cr-btn--primary', RUN_COPY.newRun, () => begin(newSeed())));
    else
      footer.append(
        btn('cr-btn--quiet', RUN_COPY.abandon, () => {
          if (!globalThis.confirm(RUN_COPY.abandonConfirm)) return;
          writeSave(null);
          run = null;
          log = null;
          render();
        }),
      );
    return footer;
  }

  // ------------------------------------------------------------------ screens

  function heading(text: string, sub?: string): HTMLElement {
    const box = el('div', 'cr-heading');
    box.append(el('h2', 'cr-heading-text', text));
    if (sub) box.append(el('p', 'cr-heading-sub', sub));
    return box;
  }

  function renderScreen(s: CardRunState): HTMLElement {
    const screen = s.screen;
    const box = el('section', 'cr-screen');
    box.dataset['screen'] = screen.k;
    const stop = currentStop(s);
    switch (screen.k) {
      case 'battle': {
        const node = currentNode(s);
        const encounter = ENCOUNTERS[s.battle!.encounter]!;
        box.append(heading(RUN_COPY.battle.kind[screen.kind], nameOf(encounter.name)), enemyLine(encounter.id));
        if (node?.kind === 'fight' && node.boss) box.append(el('p', 'cr-note', nameOf(encounter.blurb)));
        box.append(btn('cr-btn--primary', RUN_COPY.battle.resume, () => openBattle()));
        // Straight into the battle, unless the player has just stepped out of it.
        if (!battleOpen && !steppedOut) queueMicrotask(() => openBattle());
        break;
      }
      case 'route': {
        box.append(heading(RUN_COPY.route.heading, nextFightLine(s)));
        const choices = el('div', 'cr-choices');
        choices.append(
          choice('city', RUN_COPY.route.city, RUN_COPY.route.cityWhat, [
            `${RUN_COPY.city.market}: ${stop!.city.market.map((m) => `${nameOf(CARDS[m.card]!.name)} ${m.price}`).join(', ')}`,
            `${RUN_COPY.city.defend}: ${nameOf(ENCOUNTERS[stop!.city.defense.encounter]!.name)}`,
          ]),
          choice('town', RUN_COPY.route.town, RUN_COPY.route.townWhat, [
            `${RUN_COPY.route.quest(nameOf(ENCOUNTERS[stop!.town.quest.encounter]!.name))} · ${enemyNames(stop!.town.quest.encounter)}`,
            `${RUN_COPY.route.reward}: ${RUN_COPY.plusSupplies(stop!.town.supplies)}, ${RUN_COPY.route.pickOne} ${stop!.town.offer.map((c) => nameOf(CARDS[c]!.name)).join(' / ')}`,
          ]),
          choice('wild', RUN_COPY.route.wild, RUN_COPY.route.wildWhat, [RUN_COPY.plusSupplies(stop!.wild.supplies), RUN_COPY.route.maybeEvent]),
        );
        box.append(choices);
        break;
      }
      case 'city': {
        box.append(heading(RUN_COPY.city.heading));
        const choices = el('div', 'cr-choices');
        const market = el('button', 'cr-choice');
        market.type = 'button';
        market.dataset['kind'] = 'city';
        market.append(el('span', 'cr-choice-name', RUN_COPY.city.market), el('span', 'cr-choice-what', RUN_COPY.city.marketWhat));
        market.addEventListener('click', () => act({ type: 'market' }));
        const defend = el('button', 'cr-choice');
        defend.type = 'button';
        defend.dataset['kind'] = 'city';
        const quest = stop!.city.defense.encounter;
        defend.append(
          el('span', 'cr-choice-name', RUN_COPY.city.defend),
          el('span', 'cr-choice-what', RUN_COPY.city.defendWhat(nameOf(ENCOUNTERS[quest]!.name))),
          el('span', 'cr-choice-line', enemyNames(quest)),
        );
        defend.addEventListener('click', () => act({ type: 'defend' }));
        choices.append(market, defend);
        box.append(choices);
        break;
      }
      case 'market': {
        box.append(heading(RUN_COPY.market.heading, RUN_COPY.city.marketWhat));
        const row = el('div', 'cr-cards');
        stop!.city.market.forEach((item, index) => {
          const bought = screen.bought.includes(index);
          const cardNode = cardTile(item.card);
          const buy = btn('cr-btn--small', bought ? RUN_COPY.market.bought : RUN_COPY.market.buy(item.price), () => act({ type: 'buy', index }));
          buy.disabled = bought || s.supplies < item.price;
          if (!bought && s.supplies < item.price) buy.title = RUN_COPY.market.cannotPay;
          cardNode.append(buy);
          if (!bought && s.supplies < item.price) cardNode.append(el('span', 'cr-why', RUN_COPY.market.cannotPay));
          row.append(cardNode);
        });
        box.append(row, btn('cr-btn--primary', RUN_COPY.market.leave, () => act({ type: 'leave' })));
        break;
      }
      case 'cards': {
        box.append(heading(RUN_COPY.cards.heading, screen.source === 'town' ? RUN_COPY.cards.town : RUN_COPY.cards.ambush));
        const row = el('div', 'cr-cards');
        screen.offer.forEach((card, index) => {
          const node = cardTile(card);
          node.append(btn('cr-btn--small cr-btn--primary', RUN_COPY.cards.take, () => act({ type: 'pick', index })));
          row.append(node);
        });
        box.append(row);
        break;
      }
      case 'upgrade':
        box.append(heading(RUN_COPY.upgrade.heading, screen.source === 'defense' ? RUN_COPY.upgrade.defense : RUN_COPY.upgrade.smith));
        box.append(upgradeList(s, (index) => act({ type: 'upgrade', index })));
        break;
      case 'remove': {
        box.append(heading(RUN_COPY.remove.heading, RUN_COPY.remove.what));
        const list = el('div', 'cr-deck');
        s.deck.forEach((card, index) => {
          const node = cardTile(card);
          node.classList.add('cr-card--tap');
          node.tabIndex = 0;
          node.setAttribute('role', 'button');
          node.addEventListener('click', () => act({ type: 'remove', index }));
          list.append(node);
        });
        box.append(list);
        break;
      }
      case 'wild': {
        const event = stop!.wild.event ? EVENTS[stop!.wild.event]! : null;
        box.append(heading(RUN_COPY.wild.heading, RUN_COPY.wild.gained(screen.gained)));
        if (!event) {
          box.append(el('p', 'cr-note', RUN_COPY.wild.quiet), btn('cr-btn--primary', RUN_COPY.wild.leave, () => act({ type: 'leave' })));
          break;
        }
        const card = el('div', 'cr-event');
        card.append(el('h3', 'cr-event-name', `? ${event.name}`), el('p', 'cr-event-text', event.text));
        // What an option hands over is shown on it: the drawn card or equipment, the fight and its loot.
        event.options.forEach((option, index) => {
          const gate = eventOptionOpen(s, option);
          const extra: string[] = [];
          for (const e of option.effects) {
            if (e.k === 'equipment') extra.push(nameOf(CARDS[stop!.wild.equipment]!.name));
            if (e.k === 'card') extra.push(nameOf(CARDS[stop!.wild.card]!.name));
            if (e.k === 'fight') extra.push(`${enemyNames(stop!.wild.ambush.encounter)} · ${RUN_COPY.route.pickOne} ${stop!.wild.offer.map((c) => nameOf(CARDS[c]!.name)).join(' / ')}`);
          }
          const label = `${option.label}${option.price !== undefined ? ` · ${option.price} ${RUN_COPY.supplies.toLowerCase()}` : ''}${extra.length ? `: ${extra.join(', ')}` : ''}`;
          const node = btn('cr-btn--option', label, () => act({ type: 'event', option: index }));
          node.disabled = !gate.open;
          card.append(node);
          if (!gate.open) card.append(el('span', 'cr-why', RUN_COPY.wild.why[gate.why!]));
        });
        box.append(card);
        break;
      }
      case 'boost': {
        box.append(heading(RUN_COPY.boost.heading, RUN_COPY.boost.what));
        const choices = el('div', 'cr-choices');
        screen.offers.forEach((offer, index) => {
          const node = el('button', 'cr-choice');
          node.type = 'button';
          node.dataset['owner'] = offer.unit;
          node.append(el('span', 'cr-choice-name', `${offer.unit} ${nameOf(UNITS[offer.unit].name)}`), el('span', 'cr-choice-what', RUN_COPY.boost.kind[offer.kind](offer.n)));
          node.addEventListener('click', () => act({ type: 'pick', index }));
          choices.append(node);
        });
        box.append(choices);
        break;
      }
      case 'over': {
        const node = currentNode(s);
        box.append(heading(screen.won ? RUN_COPY.over.won : RUN_COPY.over.lost, RUN_COPY.over.stats(s.stats.fights, s.stats.bosses, s.stats.quests, s.stats.upgrades)));
        if (!screen.won && s.battle) box.append(el('p', 'cr-note', RUN_COPY.over.reached(`${nameOf(ENCOUNTERS[s.battle.encounter]!.name)}${node ? ` · ${RUN_COPY.act(node.act + 1, ACTS.length)}` : ''}`)));
        box.append(btn('', RUN_COPY.copyLog, () => {
          globalThis.navigator?.clipboard?.writeText(JSON.stringify(log)).then(() => {
            message = RUN_COPY.copied;
            render();
          }, () => undefined);
        }));
        break;
      }
    }
    return box;
  }

  function choice(kind: 'city' | 'town' | 'wild', name: string, what: string, lines: string[]): HTMLElement {
    const node = el('button', 'cr-choice');
    node.type = 'button';
    node.dataset['kind'] = kind;
    node.append(el('span', 'cr-choice-name', name), el('span', 'cr-choice-what', what));
    for (const line of lines) node.append(el('span', 'cr-choice-line', line));
    node.addEventListener('click', () => act({ type: 'go', to: kind }));
    return node;
  }

  function enemyNames(encounterId: string): string {
    const encounter = ENCOUNTERS[encounterId]!;
    const all = [encounter.enemies, ...(encounter.waves ?? [])].flat();
    const counts = new Map<string, number>();
    for (const { def } of all) counts.set(def, (counts.get(def) ?? 0) + 1);
    return [...counts].map(([def, n]) => `${n > 1 ? `${n}× ` : ''}${nameOf(ENEMIES[def as keyof typeof ENEMIES].name)}`).join(', ');
  }

  function enemyLine(encounterId: string): HTMLElement {
    return el('p', 'cr-note', enemyNames(encounterId));
  }

  function nextFightLine(s: CardRunState): string {
    const next = s.nodes.slice(s.at + 1).find((n) => n.kind === 'fight');
    return next?.kind === 'fight' ? RUN_COPY.route.next(`${nameOf(ENCOUNTERS[next.encounter]!.name)} · ${enemyNames(next.encounter)}`) : '';
  }

  /** A card as the run's screens show it: owner, name, cost and what it does. */
  function cardTile(id: string): HTMLElement {
    const def = CARDS[id]!;
    const node = el('div', 'cr-card');
    node.dataset['owner'] = def.owner;
    if (def.equipment) node.dataset['equipment'] = 'true';
    const top = el('div', 'cr-card-top');
    top.append(el('span', 'cr-card-cost', String(def.cost)), el('span', 'cr-card-name', nameOf(def.name)));
    node.append(top);
    node.append(el('div', 'cr-card-owner', def.equipment ? RUN_COPY.owner.equipment : def.owner === 'neutral' ? RUN_COPY.owner.neutral : `${def.owner} ${nameOf(UNITS[def.owner].name)}`));
    for (const line of effectLines(def.effects)) node.append(el('div', 'cr-card-line', line));
    return node;
  }

  /** Every card that can take an upgrade, each showing what it becomes. */
  function upgradeList(s: CardRunState, onPick: (index: number) => void): HTMLElement {
    const list = el('div', 'cr-deck');
    for (const index of upgradable(s)) {
      const id = s.deck[index]!;
      const pair = el('button', 'cr-upgrade');
      pair.type = 'button';
      pair.append(cardTile(id), el('span', 'cr-upgrade-arrow', '→'), cardTile(UPGRADE_OF[id]!));
      pair.setAttribute('aria-label', `${nameOf(CARDS[id]!.name)} ${RUN_COPY.upgrade.becomes} ${nameOf(CARDS[UPGRADE_OF[id]!]!.name)}`);
      pair.addEventListener('click', () => onPick(index));
      list.append(pair);
    }
    return list;
  }

  function renderOverlay(s: CardRunState, kind: 'deck' | 'camp'): HTMLElement {
    const shade = el('div', 'cr-overlay');
    const panel = el('div', 'cr-overlay-panel');
    if (kind === 'deck') {
      panel.append(heading(RUN_COPY.deck(s.deck.length)));
      const list = el('div', 'cr-deck');
      for (const id of s.deck) list.append(cardTile(id));
      panel.append(list);
    } else {
      panel.append(heading(RUN_COPY.camp.heading, `${RUN_COPY.camp.pick} · ${RUN_COPY.suppliesN(campPrice(s).price)}`));
      panel.append(upgradeList(s, (index) => act({ type: 'upgrade', index })));
    }
    panel.append(btn('cr-btn--primary', kind === 'deck' ? RUN_COPY.close : RUN_COPY.cancel, () => {
      overlay = null;
      render();
    }));
    shade.append(panel);
    shade.addEventListener('click', (event) => {
      if (event.target !== shade) return;
      overlay = null;
      render();
    });
    return shade;
  }

  render();
  return { root };
}
