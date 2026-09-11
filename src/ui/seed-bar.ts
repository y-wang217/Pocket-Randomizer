/**
 * The seed, displayed and editable at run start.
 *
 * A tester who can type a seed and get the identical run back is the cheapest
 * bug-reporting tool this project will ever have, which is why it is in the UI
 * rather than behind a debug flag.
 *
 * ## The versioned form, since the `contentHash` release
 *
 * The bar shows `GYMRUN-<hash>-<seed>` (`core/seedString.ts`) and copies it
 * on a tap, so what is shared carries the balance version it was made on. On
 * submit the text is parsed rather than taken as-is:
 *
 *   - a bare seed starts a run on it, exactly as it always has;
 *   - a versioned seed with this build's hash starts the same run;
 *   - a versioned seed with **another** build's hash is refused before a run
 *     starts, with the wording in `data/seedCopy.ts`, and the bare seed is
 *     left in the box so a second Start begins a fresh run on it. That is the
 *     paste-time check the seeds document asks for: the player learns the seed
 *     will not reproduce *before* committing to it, not at replay.
 *
 * Extracted from `app.ts` so the parse-and-refuse can be tested in jsdom
 * without mounting the whole shell.
 */
import { CONTENT_HASH } from '../core/contentHash';
import { formatSeedString, parseSeedString, type ParsedSeed } from '../core/seedString';
import { foreignSeedMessage, SEED_COPY } from '../data/seedCopy';
import { el } from './scene';

export interface SeedBar {
  root: HTMLElement;
  /** Show the run's seed, in the versioned form. */
  setSeed(seed: string): void;
  setResumable(resumable: boolean): void;
  /** A parsed submission that may start a run: `bare` or `match`. Never `foreign`. */
  onSubmit(handler: (seed: string) => void): void;
  onReroll(handler: () => void): void;
  onResume(handler: () => void): void;
  /** Show the foreign-seed refusal for a seed that arrived some other way, such as the URL. */
  refuse(parsed: Extract<ParsedSeed, { kind: 'foreign' }>): void;
}

export function createSeedBar(): SeedBar {
  const root = el('form', 'seedbar');
  const label = el('label', 'seedbar__label');
  label.textContent = 'Seed';

  const input = document.createElement('input');
  input.className = 'seedbar__input';
  input.type = 'text';
  input.spellcheck = false;
  input.autocomplete = 'off';
  input.setAttribute('aria-label', 'Run seed');
  label.setAttribute('for', (input.id = 'seed-input'));

  const apply = document.createElement('button');
  apply.type = 'submit';
  apply.className = 'button';
  apply.textContent = 'Start run';

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'button seedbar__copy';
  copy.textContent = SEED_COPY.copy;

  const reroll = document.createElement('button');
  reroll.type = 'button';
  reroll.className = 'button';
  reroll.textContent = 'New seed';

  const resume = document.createElement('button');
  resume.type = 'button';
  resume.className = 'button';
  resume.textContent = 'Resume saved run';
  resume.hidden = true;

  /** The refusal, hidden until a foreign seed is submitted or arrives. */
  const notice = el('p', 'seedbar__notice');
  notice.setAttribute('role', 'alert');
  notice.hidden = true;

  root.append(label, input, apply, copy, reroll, resume, notice);

  const clearNotice = (): void => {
    notice.textContent = '';
    notice.hidden = true;
  };
  input.addEventListener('input', clearNotice);

  const refuse = (parsed: Extract<ParsedSeed, { kind: 'foreign' }>): void => {
    notice.textContent = foreignSeedMessage(parsed.hash, parsed.expected);
    notice.hidden = false;
    // The bare seed stays, so the next Start is a fresh run on it and the
    // player does not have to retype the part that still works.
    input.value = parsed.seed;
  };

  copy.addEventListener('click', () => {
    // Best effort, with a visible fallback: `navigator.clipboard` is absent
    // on insecure origins and rejects when the page is not focused.
    const done = (ok: boolean): void => {
      copy.textContent = ok ? SEED_COPY.copied : SEED_COPY.copyFailed;
      copy.dataset['copied'] = ok ? 'true' : 'false';
      setTimeout(() => {
        copy.textContent = SEED_COPY.copy;
        delete copy.dataset['copied'];
      }, 1500);
    };
    const clipboard = globalThis.navigator?.clipboard;
    if (!clipboard) {
      input.select();
      done(false);
      return;
    }
    clipboard.writeText(input.value).then(
      () => done(true),
      () => {
        input.select();
        done(false);
      },
    );
  });

  return {
    root,
    setSeed: (seed) => {
      input.value = formatSeedString(seed, CONTENT_HASH);
      clearNotice();
    },
    setResumable: (resumable) => {
      resume.hidden = !resumable;
    },
    onSubmit: (handler) =>
      root.addEventListener('submit', (event) => {
        event.preventDefault();
        const parsed = parseSeedString(input.value);
        if (parsed.kind === 'foreign') {
          refuse(parsed);
          return;
        }
        clearNotice();
        handler(parsed.seed);
      }),
    onReroll: (handler) => reroll.addEventListener('click', () => handler()),
    onResume: (handler) => resume.addEventListener('click', () => handler()),
    refuse,
  };
}
