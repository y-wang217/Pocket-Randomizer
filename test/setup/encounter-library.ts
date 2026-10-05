/**
 * Installs the encounter library's route tables before every test file.
 * **Stage 6.0 checkpoint 9.** The same import every Node entry makes; the app
 * makes it dynamically. `test/encounter-registry.test.ts` proves the throw
 * without it by resetting the module cache.
 */
import '../../src/data/encounters/full';
