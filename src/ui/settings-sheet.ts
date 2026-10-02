/**
 * The Settings screen, opened by the shell nav's Settings tab. **Stage 5.0/1.**
 *
 * It holds what the party drawer used to carry below the party: the battle
 * speed picker (the density picker beside it was deleted with the modes), plus
 * the tutorial replay the header row also offers. A screen in the shell's
 * sense (bible section 5, Shell nav): it fills the frame under the nav, and
 * writes display settings and nothing else, so it may open over any decision
 * without touching it.
 */
import { BATTLE_SPEED_COPY, BATTLE_SPEED_HEADING, SETTINGS_COPY } from './copy/screens';
import { el } from './dom';
import { createOverlay, type Overlay } from './overlay';
import { BATTLE_SPEEDS, getBattleSpeed, onSettingsChange, setBattleSpeed } from './settings';

export interface SettingsSheet {
  overlay: Overlay;
  /** Fires when the player asks for the tutorial again. */
  onReplayTutorial(listener: () => void): void;
}

export function createSettingsSheet(): SettingsSheet {
  const overlay = createOverlay({ block: 'settings-sheet', label: SETTINGS_COPY.label, title: SETTINGS_COPY.title });
  const replay = document.createElement('button');
  replay.type = 'button';
  replay.className = 'button button--small settings-sheet__replay';
  replay.textContent = SETTINGS_COPY.tutorial;
  const listeners: (() => void)[] = [];
  replay.addEventListener('click', () => {
    for (const listener of listeners) listener();
  });
  overlay.body.append(createBattleSpeedPicker(), replay);
  return {
    overlay,
    onReplayTutorial(listener) {
      listeners.push(listener);
    },
  };
}

/**
 * The battle speed picker. **The battle animation run, Branch 1.**
 *
 * It is a control rather than a second guess at one number. Release C's 500ms
 * was the prompt's default and its comment said it was waiting on a playtest;
 * the playtest said the beats were too fast to see. `data/displayTuning.ts`
 * answers that with 900, and this answers the fact that "too fast" is a
 * judgement rather than a measurement.
 *
 * Writes the setting and nothing else, like both neighbours. The root property
 * is written by the shell's own subscription in `app.ts`, which re-applies
 * `applyMotion` when this moves.
 */
function createBattleSpeedPicker(): HTMLElement {
  return createPicker({
    heading: BATTLE_SPEED_HEADING,
    block: 'battle-speed',
    attribute: 'battleSpeed',
    options: BATTLE_SPEEDS.map((speed) => ({ value: speed, ...BATTLE_SPEED_COPY[speed] })),
    read: getBattleSpeed,
    write: setBattleSpeed,
  });
}

/**
 * One picker, three settings. **Extracted when the second one arrived**, rather
 * than copied — two hand-written pickers is two places for the pressed state,
 * the repaint subscription or the aria wiring to drift, and the drift would be
 * invisible until a screen reader user met the one that was forgotten.
 *
 * `block` is the class prefix and `attribute` the dataset key the choices
 * carry. **Both stay per-picker on purpose.** The first build shared
 * `density__choice` between them, and the density picker's test (deleted with the picker at 5.0/1), which
 * queries that class and reads `dataset.density` off what it finds — started
 * seeing five buttons and two nulls. A suite that names one picker must keep
 * finding one picker.
 */
export function createPicker<T extends string>(spec: {
  heading: string;
  block: string;
  attribute: string;
  options: readonly { value: T; name: string; description: string }[];
  read: () => T;
  write: (value: T) => void;
}): HTMLElement {
  const root = el('div', `picker ${spec.block}`);
  const heading = el('h3', 'drawer__section');
  heading.textContent = spec.heading;
  const list = el('div', `picker__options ${spec.block}__options`);
  const choices = spec.options.map((option) => {
    const row = el('div', `picker__option ${spec.block}__option`);
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.className = `button button--small picker__choice ${spec.block}__choice`;
    choice.dataset[spec.attribute] = option.value;
    choice.textContent = option.name;
    choice.addEventListener('click', () => spec.write(option.value));
    const description = el('span', `picker__desc ${spec.block}__desc`);
    description.textContent = option.description;
    row.append(choice, description);
    list.append(row);
    return choice;
  });
  const paint = (): void => {
    const current = spec.read();
    for (const choice of choices) {
      choice.setAttribute('aria-pressed', String(choice.dataset[spec.attribute] === current));
    }
  };
  onSettingsChange(paint);
  paint();
  root.append(heading, list);
  return root;
}
