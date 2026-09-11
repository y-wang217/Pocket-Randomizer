/**
 * Print the content hash of the working tree.
 *
 *   npm run content-hash
 *
 * The same computation the build embeds, run from the command line so a
 * handoff or a report can quote the hash without building. Prints the full
 * hash, its display form, and the files it covers with `--files`.
 */
import { contentHashOf, listContentFiles, shortContentHash } from '../build-config/content-hash';

const root = process.cwd();
const hash = contentHashOf(root);
console.log(`${hash}  (display ${shortContentHash(hash)})`);
if (process.argv.includes('--files')) {
  for (const file of listContentFiles(root)) console.log(`  ${file}`);
}
