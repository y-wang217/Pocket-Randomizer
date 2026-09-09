/**
 * The architecture rules, enforced as a test rather than only as lint.
 *
 * ESLint enforces the same two rules (see eslint.config.js), but lint is easy
 * to disable inline and easy to skip in CI. These are load-bearing: `core/`
 * importing `ui/` would make headless battles impossible, and one stray
 * `Math.random()` would make a seed meaningless. Both deserve to fail the test
 * suite, not just the linter.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('..', import.meta.url).pathname;
const CORE = join(ROOT, 'src/core');
const SRC = join(ROOT, 'src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

const coreFiles = walk(CORE);
const srcFiles = walk(SRC);

/**
 * Source with block and line comments removed.
 *
 * Enough of a stripper for the checks that use it: it is a regex, so a `//`
 * inside a string literal would take the rest of that line with it. There are
 * none in the files checked, and a false *negative* on one line is a cheap
 * failure mode for checks whose job is to catch a whole import.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

describe('core/ boundaries', () => {
  it('has files to check', () => {
    expect(coreFiles.length).toBeGreaterThan(3);
  });

  it('never imports from ui/', () => {
    const offenders = coreFiles.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /\bfrom\s+['"][^'"]*\bui\/[^'"]*['"]/.test(source) || /\bimport\s*\(\s*['"][^'"]*\bui\/[^'"]*['"]/.test(source);
    });
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([]);
  });

  it('never references Math.random', () => {
    const offenders = srcFiles.filter((file) => /Math\s*\.\s*random/.test(readFileSync(file, 'utf8')));
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([]);
  });

  it('touches no DOM global', () => {
    /*
     * Code only. **The comments have to come out first**, and Stage 4.6b is
     * what proved it: a sentence ending "...out of one flat window." matched
     * `window\s*\.` and reported `core/randomizer.ts` as reaching for the DOM.
     *
     * A boundary test that fires on prose is a boundary test people learn to
     * work around by rewording, which is exactly the wrong lesson — the rule is
     * about what a file *does*.
     */
    const dom = /\b(document|window|localStorage|navigator|HTMLElement)\b\s*\./;
    const offenders = coreFiles.filter((file) => dom.test(stripComments(readFileSync(file, 'utf8'))));
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([]);
  });

  it('confines @pkmn/sim to the adapter', () => {
    // Everything above driver.ts speaks core/types.ts. If a second file starts
    // importing the sim, the adapter has stopped being an adapter.
    const allowed = new Set(['src/core/battle/driver.ts', 'src/core/battle/format.ts']);
    const offenders = srcFiles
      .filter((file) => /from\s+['"]@pkmn\/sim['"]/.test(readFileSync(file, 'utf8')))
      .map((f) => relative(ROOT, f))
      .filter((f) => !allowed.has(f));
    expect(offenders).toEqual([]);
  });
});

/**
 * The Stage 4.5 rule: the battle UI reads one projection and nothing else.
 *
 * This is the seam the stage was most likely to rot, and it would have rotted
 * silently. The battle screen already has a `RunState` within reach, the
 * opponent's `PokemonSpec` is a field on it, and three lines would have put an
 * ability on screen — coupling a pixel to a run-state field, showing the player
 * information they have not been shown, and **passing every other test in this
 * suite**, because nothing else asserts on where a screen got a number from.
 *
 * So it is asserted the same way the no-`core`-to-`ui` rule is: crudely, over
 * the source, in a place that fails CI.
 */
describe('the battle UI boundary', () => {
  /** The files that draw a battle. `battle-log.ts` renders protocol, not state. */
  const BATTLE_UI = ['src/ui/scene.ts', 'src/ui/screens/battle.ts', 'src/ui/battle-log.ts'];

  function sourceOf(relative: string): string {
    return readFileSync(join(ROOT, relative), 'utf8');
  }

  it('names files that exist', () => {
    for (const file of BATTLE_UI) expect(sourceOf(file).length).toBeGreaterThan(0);
  });

  it('imports nothing from core/run', () => {
    const offenders = BATTLE_UI.filter((file) => /from\s+['"][^'"]*core\/run['"]/.test(sourceOf(file)));
    expect(offenders).toEqual([]);
  });

  /**
   * The scene is the strictest of the three, because it is the one that draws
   * the Pokemon. Its whole vocabulary is the projection plus `core/types.ts`:
   * anything else under `core/` would be a second source of truth about the
   * turn it is rendering.
   */
  it('draws the field from the projection alone', () => {
    /*
     * `core/battle/effectiveness` joined the list in Stage 4.5.2, and it is not
     * a widening of the rule.
     *
     * It is the leaf `view.ts` itself delegates to — the projection's own
     * vocabulary, split out of it so the four effectiveness bands could be unit
     * tested without building a battle. The scene reads only the band *names*
     * from it (`EFFECTIVENESS_LABELS`); the answer still arrives on the
     * projection, and the scene still computes none of it.
     */
    /*
     * `core/hpCopy` joined in Stage 4.5.2 for the same reason
     * `core/battle/effectiveness` did: it is vocabulary, not data. The scene
     * reads the *wording* of an HP readout from it and the numbers from the
     * projection, which is the split item G asks for — one file to change a
     * string, and no screen deciding what a number means.
     */
    const allowed = new Set([
      'core/battle/view',
      'core/battle/effectiveness',
      'core/battle/stats',
      'core/hpCopy',
      'core/types',
    ]);
    const imports = [...sourceOf('src/ui/scene.ts').matchAll(/from\s+['"]([^'"]+)['"]/g)]
      .map((match) => match[1] ?? '')
      .filter((path) => path.includes('core/'))
      .map((path) => path.replace(/^(?:\.\.\/)+/, ''));

    expect(imports.length).toBeGreaterThan(0);
    expect(imports.filter((path) => !allowed.has(path))).toEqual([]);
  });

  /**
   * And the run's own vocabulary never appears in the *code*, imported or not.
   *
   * A type-only import would satisfy the check above and still be exactly what
   * the rule exists to stop, so the identifiers themselves are banned — but
   * from the code rather than from the whole file. Both of these files explain
   * the rule in a header comment, and a check that forbade naming the thing it
   * forbids would force the explanation out of the file that needs it most.
   * (`Math.random` above is the other way round on purpose: that rule's value
   * is that it cannot be talked past, so there the prose gives way.)
   *
   * Comment stripping is a regex, so a `//` inside a string literal would take
   * the rest of that line with it. There are none in either file, and a false
   * *negative* on one line is a cheap failure mode for a check whose job is to
   * catch a whole import.
   */
  it('never mentions run state or a raw spec', () => {
    const banned = /\b(RunState|PokemonSpec|PokemonState|NodeResult|segments\[)\b/;
    const offenders = ['src/ui/scene.ts', 'src/ui/screens/battle.ts'].filter((file) =>
      banned.test(stripComments(sourceOf(file))),
    );
    expect(offenders).toEqual([]);
  });

  /**
   * Tooltip text lives in `data/`, never inline in a component.
   *
   * The tooltip layer is a lookup and a positioner. A sentence describing a
   * mechanic, written in the file that renders it, is a sentence that drifts
   * from the mechanic — so the layer may name data modules and the adapter, and
   * may not carry prose of its own.
   */
  it('keeps tooltip content out of the component', () => {
    const source = sourceOf('src/ui/tooltips.ts');

    /*
     * Look for prose *written into the DOM*, not for long strings generally.
     *
     * The first cut scanned every string literal in the file after stripping
     * comments, which was regex-parsing TypeScript: an apostrophe inside a
     * comment opened a quote that ran on through the next forty lines of code.
     * The rule is narrower than that and so is the check — a description is a
     * sentence assigned to `textContent`, and everything legitimately assigned
     * there here comes out of a `data/` module or the dex.
     */
    const rendered = [...source.matchAll(/textContent\s*=\s*(['"`])((?:(?!\1).){12,})\1/g)].map(
      (match) => match[2] ?? '',
    );
    expect(rendered).toEqual([]);

    // And the four sources it *does* read from are all outside this file.
    for (const source_ of ['statusInfo', 'abilityText', 'itemById', 'typeChart']) {
      expect(source, `tooltips.ts should read ${source_} from elsewhere`).toContain(source_);
    }
  });

  /**
   * **Every `RunPolicy` question the app implements must reach a screen.**
   *
   * This rule is here because breaking it is silent. `chooseMoveToReplace`
   * shipped wired to `defaultMoveReplacement` — the heuristic the scripted
   * baseline answers with — so `playRun` asked the question, the run log
   * recorded an answer, every test passed, and the player was simply never
   * shown the choice. Nothing in the suite could tell the difference between
   * "the human picked slot 2" and "the app picked slot 2 for them", because
   * from `core/`'s side there is no difference at all.
   *
   * So the check is on the shape of the answer rather than on its value: a
   * decision the human policy resolves without parking on a `Pending` is a
   * decision the human never made. `battle` is the exception and is listed as
   * one — it parks on `movePick`, which the battle screen submits into.
   */
  /**
   * **Every player-facing HP string comes from `core/hpCopy.ts`.** Item G.
   *
   * The rule is that wording is a one-file change, and the way that rule dies
   * is one screen formatting `${hp} / ${maxHp}` inline because it is three
   * characters shorter than an import. The check is crude on purpose — a regex
   * for the shape of the template, over the screens — because the failure it
   * catches is a copy of the format, not a call to a wrong function.
   */
  it('keeps HP wording in one file', () => {
    const screens = walk(join(ROOT, 'src/ui')).map((file) => relative(ROOT, file));
    const inline = /`\$\{[^`]*\}\s*\/\s*\$\{[^`]*\}\s*HP/;

    const offenders = screens.filter((file) => inline.test(stripComments(sourceOf(file))));
    expect(offenders, 'format HP through core/hpCopy.ts instead').toEqual([]);
  });

  it('asks the player every question the human policy claims to ask', () => {
    const source = sourceOf('src/ui/app.ts');

    // The block from `chooseStarter` to the end of the policy literal.
    const policy = /chooseStarter:[\s\S]*?\n {4}\};/.exec(source)?.[0] ?? '';
    expect(policy, 'could not find the human RunPolicy in app.ts').not.toEqual('');

    const asked = [
      'chooseStarter',
      // Stage 4.6a. It shipped for one checkpoint answered with `async () => 0`
      // — a legal, replayable run that walked the first region offered, with
      // the player never shown the choice — which is precisely the failure this
      // test exists for. It goes in the list with the screen.
      'chooseLocale',
      'chooseNode',
      'chooseReward',
      'chooseShopPurchases',
      'chooseEventOption',
      'chooseMoveRecipient',
      'chooseMoveToReplace',
      'chooseAcquisition',
      'battle',
    ];

    /*
     * Each entry is sliced at the *next* entry's key before it is searched, so
     * a question cannot pass by borrowing the `.wait()` of the one below it.
     * That is the whole failure mode: the broken version sat directly above
     * `chooseAcquisition`, which does park on a pending.
     */
    const starts = asked.map((question) => ({ question, at: policy.indexOf(`${question}:`) }));
    for (const [index, entry] of starts.entries()) {
      expect(entry.at, `app.ts has no ${entry.question} entry`).toBeGreaterThanOrEqual(0);
      const ends = starts
        .slice(index + 1)
        .map((next) => next.at)
        .filter((at) => at > entry.at);
      const body = policy.slice(entry.at, ends.length > 0 ? Math.min(...ends) : policy.length);
      expect(body, `app.ts answers ${entry.question} without asking the player`).toContain('.wait()');
    }
  });
});
