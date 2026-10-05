/**
 * The whole library, installed. **Checkpoint 9, the bundle seam.**
 *
 * Importing this module installs the route tables into the registry in
 * `index.ts`. Every Node entry that generates a run imports it statically
 * (the sim, the baseline, the scanners, the test setup); the app imports it
 * dynamically in `ui/app.ts` and awaits it before its first run, which is
 * what puts four fifths of the library in a chunk of its own. Nothing under
 * `src/core/` imports it, and nothing under `src/ui/` does statically:
 * `test/encounter-registry.test.ts` holds both.
 */
import { installRouteTables } from './index';
import { ROUTE_TABLES } from './routes';

installRouteTables(ROUTE_TABLES);
