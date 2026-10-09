/**
 * Replay a card battle log headless and print the playtest readout.
 *
 *   npm run cards:replay -- <log.json>
 *
 * The file is what the sandbox's Copy Log button puts on the clipboard: a
 * `BattleLog` as JSON. A log from another card engine version, or one that no
 * longer replays, is refused with the reason (`src/core/cards/log.ts`).
 */
import { readFileSync } from 'node:fs';

import { formatReadout, type BattleLog, summarize } from '../src/core/cards/log';

const file = process.argv.slice(2).find((arg) => arg !== '--');
if (!file) {
  console.error('usage: npm run cards:replay -- <log.json>');
  process.exit(2);
}
try {
  const log = JSON.parse(readFileSync(file, 'utf8')) as BattleLog;
  console.log(formatReadout(summarize(log)));
} catch (error) {
  console.error(`cards:replay: ${(error as Error).message}`);
  process.exit(1);
}
