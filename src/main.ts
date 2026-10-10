/**
 * The deployed page: the card run, and nothing else
 * (`docs/spec/gymrun-card-run-prompt.md`). GYMRUN itself is `gymrun.html`,
 * whose entry is `gymrun-main.ts`; nothing here links to it.
 */
import { mountCardRun } from './ui/cardrun/shell';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing #app root element');
mountCardRun(root);
