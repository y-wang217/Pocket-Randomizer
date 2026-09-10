/**
 * The architecture rules, enforced as a test rather than only as lint.
 *
 * ESLint enforces the same two rules (see eslint.config.js), but lint is easy
 * to disable inline and easy to skip in CI. These are load-bearing: `core/`
 * importing `ui/` would make headless battles impossible, and one stray
 * `Math.random()` would make a seed meaningless. Both deserve to fail the test
 * suite, not just the linter.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('..', import.meta.url).pathname;
const CORE = join(ROOT, 'src/core');
const SRC = join(ROOT, 'src');

function walk(dir: string, extensions: readonly string[] = ['.ts']): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full, extensions);
    return extensions.some((extension) => full.endsWith(extension)) ? [full] : [];
  });
}

const coreFiles = walk(CORE);
const srcFiles = walk(SRC);

/**
 * Every directory the unseeded-generator ban covers, and every extension.
 *
 * `src/` alone was the original scope and it was wrong in two directions at
 * once. `scripts/measure-bundle.mjs` called `Math.random()` from Stage 2 until
 * Release 0.5 and neither mechanism saw it: this test walked `src/`, and the
 * ESLint rule matched TypeScript files only, so a `.mjs` file under `scripts/`
 * fell through both. A ban two mechanisms agree to skip is worse than no ban,
 * because the second mechanism reads as the backstop for the first.
 *
 * Build tooling is in scope for the same reason game code is. A probe filename
 * drawn from the platform generator makes two bundle measurements two different
 * builds, which is the same class of failure as an unreproducible run.
 */
const SEEDED_ROOTS = ['src', 'scripts', 'build-config'] as const;
const SEEDED_EXTENSIONS = ['.ts', '.mjs', '.js'] as const;
const seededFiles = SEEDED_ROOTS.map((dir) => ({
  dir,
  files: walk(join(ROOT, dir), SEEDED_EXTENSIONS),
}));

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

  it('walks every directory the RNG ban covers', () => {
    // Or the assertion below passes because a root globbed to nothing, which is
    // exactly how `scripts/` went unchecked for eight stages.
    for (const { dir, files } of seededFiles) {
      expect(files.length, `${dir}/ matched no files`).toBeGreaterThan(0);
    }
  });

  /**
   * **Every stream a shipped draw comes off has a key.** Release 0.5.
   *
   * The seeds design asks for the unkeyed stream API to be deleted outright so
   * that nobody reaches for it. That deletion is still owed and has its own
   * release: five test files read the unkeyed root, two of them precisely to
   * prove a key cannot collide with it, so removing the API is a question about
   * the test suite rather than a cleanup.
   *
   * This asserts the half that does not have to wait. A key is what makes a
   * draw's position independent of everything drawn before it, so a stream
   * handed anywhere without one is a draw with a global position — which is the
   * property 4.6a removed and the only thing the deletion was protecting.
   *
   * The check is textual because the type system cannot express it: a root and
   * its sub-streams share an interface by design, so `rng.map` and
   * `rng.map.at(k)` are equally well typed and equally passable. It matches the
   * *stream access* rather than the draw, because the first version of this
   * check looked for `.pick(` next to `.map` and missed both real callers —
   * `formatSeed(createRng(m).map)` and `battleStreamFor` below draw inside a
   * function, one line away from the access that fed them.
   */
  it('opens every stream in src/ through a key', () => {
    /*
     * `driver.ts` is the one exception and it is listed rather than excused.
     *
     * `battleStreamFor` backs `createBattle`'s `simSeed` fallback. No shipped
     * path reaches it — `run.ts` always passes `node.encounter.simSeed`, which
     * `encounters.ts` draws through `nodeKey`, so the fallback exists for
     * callers that start a battle with no generated node behind it, meaning the
     * Stage 0 fixtures and the determinism tests. Porting it would move every
     * one of those battles, which is a test-suite change and not a cleanup, so
     * it goes to the release that owns the deletion.
     *
     * Listed as one entry, asserted as one entry: an allowlist nobody counts is
     * how the next caller joins it.
     */
    const ALLOWED = new Set(['src/core/battle/driver.ts']);

    // An rng-shaped receiver, so `result.battle` and `specs.map(...)` are not
    // stream accesses. Both spellings the codebase uses are covered.
    const ACCESS = /(?:\brng|createRng\s*\([^)]*\))\s*\.\s*(map|rewards|battle|randomizer|policy)\b(?!\s*\.\s*at\s*\()/;

    const offenders: string[] = [];
    for (const file of srcFiles) {
      const name = relative(ROOT, file);
      stripComments(readFileSync(file, 'utf8'))
        .split('\n')
        .forEach((line, index) => {
          if (ACCESS.test(line) && !ALLOWED.has(name)) offenders.push(`${name}:${index + 1}`);
        });
    }

    expect(offenders, 'open the stream with .at(key) from core/streamKeys.ts').toEqual([]);
    expect(ALLOWED.size, 'the unkeyed exception list may shrink, never grow').toBe(1);
  });

  it('never references Math.random', () => {
    const offenders = seededFiles
      .flatMap(({ files }) => files)
      .filter((file) => /Math\s*\.\s*random/.test(readFileSync(file, 'utf8')));
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

  /**
   * `core/capabilities.ts` reaches no dex, at any depth.
   *
   * The general rule above already forbids it importing `@pkmn/sim` directly,
   * and that is not the check this needs. The dex is one hop away through
   * ordinary, reasonable-looking code: `core/coverage.ts` imports
   * `battle/driver.ts` for the type chart, so a capability function that
   * borrowed one helper from coverage would pull the whole sim in behind it and
   * pass every other test in this file.
   *
   * That would matter because it would work. `latent` resolves off a type
   * table, deliberately and not for want of a learnset — the argument is in
   * `data/capabilityTypes.ts` — and the way that decision gets quietly undone
   * is not somebody rewriting it, it is somebody importing a convenience that
   * makes a dex query possible again. So the check is transitive.
   */
  it('keeps core/capabilities.ts free of the dex at any depth', () => {
    const reached = new Set<string>();

    const visit = (file: string): void => {
      if (reached.has(file) || !file.startsWith(SRC)) return;
      reached.add(file);
      const source = stripComments(readFileSync(file, 'utf8'));
      for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        const specifier = match[1] ?? '';
        if (!specifier.startsWith('.')) continue;
        const base = join(file, '..', specifier);
        const candidate = [base, `${base}.ts`, join(base, 'index.ts')].find(
          (path) => path.endsWith('.ts') && existsSync(path),
        );
        if (candidate) visit(candidate);
      }
    };

    visit(join(CORE, 'capabilities.ts'));
    expect(reached.size).toBeGreaterThan(1);

    const offenders = [...reached]
      .filter((file) => /from\s+['"]@pkmn\//.test(stripComments(readFileSync(file, 'utf8'))))
      .map((file) => relative(ROOT, file));
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

  /**
   * **No screen renders a verdict about which option is better.** Part 4.
   *
   * The UI presents attributes. It does not recommend, rank, score, or mark one
   * option as superior to another it is offering alongside it. The rule has one
   * exception, live type effectiveness against the Pokemon currently on the
   * field, and that is a fact about the present board rather than a forecast
   * about a choice — it carries no vocabulary this check looks for.
   *
   * The check is over *string literals with the comments stripped*, not over
   * the raw file, and that direction is deliberate and opposite to the
   * `Math.random` rule above. That one bans the words too, because its value is
   * that it cannot be talked past. This one must not: `screens/reward.ts` and
   * `screens/starter-select.ts` carry header comments explaining the rule by
   * quoting the copy it forbids, and a check that fired on those would push the
   * explanation out of the two files that most need it. What ships to a player
   * is the string, so the string is what is checked.
   *
   * Release 0.5 added this after `run-map.ts` was found rendering "The best
   * rewards in the game" on the map screen — the single pixel Stage 3 built the
   * whole risk gradient on — where it had sat since Stage 3 with nothing in the
   * suite able to see it.
   */
  it('renders no verdict about an option the player is choosing', () => {
    const VERDICT =
      /\b(best|better|worse|worst|strongest|weakest|superior|inferior|optimal|ideal|recommend\w*|you should)\b/i;

    const offenders: string[] = [];
    for (const file of walk(join(ROOT, 'src/ui'))) {
      const code = stripComments(readFileSync(file, 'utf8'));
      code.split('\n').forEach((line, index) => {
        for (const literal of line.match(/'[^']*'|"[^"]*"|`[^`]*`/g) ?? []) {
          if (VERDICT.test(literal)) {
            offenders.push(`${relative(ROOT, file)}:${index + 1} ${literal}`);
          }
        }
      });
    }

    expect(offenders, 'state the attribute, not a judgement about it').toEqual([]);
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

/**
 * **Every repo path a live document names resolves.** Release 0.5.
 *
 * Every stage prompt opens by naming documents to read, and for several stages
 * those documents were not in the repo, so the instruction silently did
 * nothing and sessions worked from memory of a design they could not check.
 * Release 0 put the documents in. This is what keeps them findable: a path that
 * stops resolving is a reader sent nowhere, and nothing else in the suite can
 * see it happen.
 *
 * ## Why `docs/spec/` is excluded
 *
 * Nine paths named inside archived prompts do not resolve — they are bare
 * filenames for documents that now live in `docs/spec/`, plus one prompt that
 * was never recovered. Every one of them is frozen: protocol 4 in
 * `docs/spec/README.md` says a prompt is a record of what was asked and is not
 * edited to match what exists.
 *
 * So this check cannot cover them, and widening it to try is how it ends up
 * deleted. A test that fails on an archive nobody may edit gets removed, and
 * the live half of the invariant goes with it. The nine are handled where they
 * can be: a resolution table in `docs/spec/README.md`, which makes the archive
 * navigable without touching a frozen document.
 *
 * The rule that stays enforceable, and is: **anything the repo may edit, the
 * repo keeps true.**
 */
describe('documentation paths', () => {
  /*
   * Live, repo-authored documents. `docs/spec/` is deliberately absent; see
   * above before adding it.
   */
  const LIVE_DOCS = [
    'README.md',
    'CLAUDE.md',
    ...readdirSync(join(ROOT, 'docs'))
      .filter((entry) => entry.endsWith('.md'))
      .map((entry) => `docs/${entry}`),
  ];

  /*
   * A repo path is a backticked token that looks like one: it names a directory
   * this project has, or carries an extension this project uses. Prose in
   * backticks (`RunState`, `elite`, `npm run sim`) is not a path and is not
   * checked, which is the difference between a link check and a spell check.
   */
  const ROOTS = ['src/', 'core/', 'ui/', 'data/', 'docs/', 'test/', 'scripts/', 'build-config/'];
  const EXTENSIONS = ['.ts', '.mjs', '.js', '.md', '.json', '.css', '.html'];

  function looksLikePath(token: string): boolean {
    if (/\s/.test(token)) return false;
    return ROOTS.some((root) => token.startsWith(root)) || EXTENSIONS.some((ext) => token.endsWith(ext));
  }

  /**
   * Five spellings resolve, and every one of them is house convention.
   *
   * Accepting all five is not laxness. Each is used consistently across the
   * documents and each is unambiguous, and a check that failed on one would be
   * enforcing a naming rule nobody agreed to under cover of a link check —
   * which is how a useful test earns a reputation for noise and stops being
   * run.
   *
   *   - From the repo root: `src/core/run.ts`, `docs/balance.md`.
   *   - Relative to the linking document: `generation.md` inside `docs/`.
   *   - The `src/` shorthand: `core/rng.ts`, `data/tuning.ts`.
   *   - Without the extension: `core/run`, the way an import writes it.
   *   - A bare filename, **if exactly one file in the repo has that name**:
   *     `view.ts` inside a section about `core/battle/`. Uniqueness is what
   *     makes it a reference rather than a guess, and it is checked rather than
   *     assumed — a basename shared by two files stops resolving here, which is
   *     the correct answer for a reader who would have to guess too.
   *
   * What none of them can be is absent. A token that resolves under no spelling
   * is a reader sent nowhere, which is the whole point.
   */
  const byBasename = new Map<string, number>();
  for (const file of [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'test')), ...walk(join(ROOT, 'docs'), ['.md'])]) {
    const base = file.slice(file.lastIndexOf('/') + 1);
    byBasename.set(base, (byBasename.get(base) ?? 0) + 1);
  }

  function resolves(token: string, fromDir: string): boolean {
    const bases = [join(ROOT, token), join(fromDir, token), join(ROOT, 'src', token)];
    if (bases.some((base) => existsSync(base) || existsSync(`${base}.ts`))) return true;
    return !token.includes('/') && byBasename.get(token) === 1;
  }

  it('names live documents that exist', () => {
    expect(LIVE_DOCS.length).toBeGreaterThan(5);
    for (const doc of LIVE_DOCS) expect(existsSync(join(ROOT, doc)), `${doc} is missing`).toBe(true);
  });

  /**
   * Paths named to say a file does **not** exist.
   *
   * Three documents describe a file in order to record that it was not built,
   * or no longer is. A road not taken, a deleted test, and a table the same
   * paragraph says is not being built — each is prose about an absence, and an
   * absence is exactly what this check otherwise reports as a defect.
   *
   * They are listed rather than pattern-matched, because "is this sentence
   * saying the file exists" is not something a regex decides. Listed, and the
   * size asserted: an exception nobody counts is how the next stale path joins
   * it and stops being visible.
   */
  const NAMED_AS_ABSENT = new Set([
    // architecture.md: the dex helpers went into driver.ts instead of here.
    'core/battle/dex.ts',
    // engine-notes.md: existed briefly, deleted when capabilities became relics.
    'test/nonstandard-moves.test.ts',
    // generation.md: the same paragraph says it is not being built.
    'hmLearnsets.ts',
  ]);

  it('resolves every repo path they name', () => {
    const broken: string[] = [];

    for (const doc of LIVE_DOCS) {
      const from = join(ROOT, doc, '..');
      readFileSync(join(ROOT, doc), 'utf8')
        .split('\n')
        .forEach((line, index) => {
          for (const match of line.matchAll(/`([^`\n]+)`/g)) {
            const token = (match[1] ?? '').replace(/[.,;:)]+$/, '');
            if (NAMED_AS_ABSENT.has(token)) continue;
            if (looksLikePath(token) && !resolves(token, from)) {
              broken.push(`${doc}:${index + 1} ${token}`);
            }
          }
        });
    }

    expect(broken, 'a named path that does not resolve sends the reader nowhere').toEqual([]);
    expect(NAMED_AS_ABSENT.size, 'the absent-path list may shrink, never grow').toBe(3);
  });

  /**
   * Markdown links too, which are the half a reader actually clicks.
   *
   * Relative to the linking document rather than the repo root, and anchors and
   * external URLs are skipped — the first is not a file and the second is not
   * this repo's problem.
   */
  it('resolves every relative markdown link they make', () => {
    const broken: string[] = [];

    for (const doc of LIVE_DOCS) {
      const from = join(ROOT, doc, '..');
      readFileSync(join(ROOT, doc), 'utf8')
        .split('\n')
        .forEach((line, index) => {
          for (const match of line.matchAll(/\]\(([^)\s]+)\)/g)) {
            const target = (match[1] ?? '').split('#')[0] ?? '';
            if (target === '' || /^[a-z]+:/i.test(target)) continue;
            if (!existsSync(join(from, target))) broken.push(`${doc}:${index + 1} ${target}`);
          }
        });
    }

    expect(broken, 'a broken link is a reader sent nowhere').toEqual([]);
  });
});
