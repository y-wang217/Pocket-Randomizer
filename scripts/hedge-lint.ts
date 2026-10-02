/**
 * The hedge-word lint. **Milestone M0.3.**
 *
 *   npx vite-node scripts/hedge-lint.ts
 *
 * Design bible section 8: *"Never a hedge word (risky, safe, strong, weak,
 * good, bad, worth) on any surface."* This reads the explanation tables and the
 * coach marks and exits non-zero on any whole-word match. The words are data,
 * in `src/data/forbiddenWords.ts`, with the reasoning for what is on the list.
 *
 * ## Why a script and not an eslint rule
 *
 * The question is about the *contents of a string literal*, and the files it
 * asks about are four data tables. An eslint rule would have to walk every AST
 * in the repo to find them, and would then be disableable inline — which
 * `CLAUDE.md` already calls out as the reason the `core/` boundary is asserted
 * by a test and not only by lint. This is a test's question, so
 * `test/hedge-lint.test.ts` asks it under `npm test`, and `npm run check`
 * mounts the script as its own leg so a failure names the word and the line
 * rather than arriving inside a suite summary.
 *
 * ## What it reads
 *
 * `LINTED_COPY_GLOBS`: `src/data/*Info.ts` and `src/data/tutorial.ts`. Those
 * are the tables that hold sentences a player reads on demand.
 *
 * **String literals only, never comments.** The first cut read whole files and
 * returned 31 hits, of which three were real: the rest were the doc comments
 * that exist to explain why hedge words are banned, including the one this
 * item had just written above the Toxic rename. Section 8's rule is about what
 * renders on a surface, and a comment is not a surface. A lint that cannot
 * tell the difference makes the prose documenting a rule illegal under it.
 *
 * Literals are found with TypeScript's own parser rather than by stripping
 * comments with a regex, because the distinction between a `//` inside a
 * string and a comment is exactly what a regex gets wrong, and `typescript` is
 * already a dependency.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

import { FORBIDDEN_WORDS, LINTED_COPY_GLOBS, hedgeWordsIn } from '../src/data/forbiddenWords';

export interface Hit {
  file: string;
  line: number;
  word: string;
  text: string;
}

/** Expand the globs. They are deliberately simple: a directory and a suffix. */
export function lintedFiles(root: string = process.cwd()): string[] {
  const out = new Set<string>();
  for (const glob of LINTED_COPY_GLOBS) {
    const slash = glob.lastIndexOf('/');
    const dir = glob.slice(0, slash);
    const leaf = glob.slice(slash + 1);
    if (!leaf.includes('*')) {
      out.add(join(root, glob));
      continue;
    }
    const suffix = leaf.replace('*', '');
    for (const entry of readdirSync(join(root, dir)).sort()) {
      if (entry.endsWith(suffix)) out.add(join(root, dir, entry));
    }
  }
  return [...out].sort();
}

/**
 * Every string literal in a source file, with the line it starts on.
 *
 * Template literals are included: a status entry could perfectly well be built
 * with one, and a rule that stopped at `'...'` would be a rule about quoting
 * style. Only the *text* of a template is read, not its `${...}` expressions,
 * which is what `ts.TemplateLiteral`'s `text` properties already give.
 */
export function stringLiteralsOf(source: string, fileName: string): { line: number; text: string }[] {
  const tree = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const out: { line: number; text: string }[] = [];
  const push = (node: ts.Node, text: string): void => {
    const { line } = tree.getLineAndCharacterOfPosition(node.getStart(tree));
    out.push({ line: line + 1, text });
  };
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) push(node, node.text);
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) push(node, node.text);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return out;
}

/** Every hedge word in every linted file's copy, with the line it is on. */
export function hedgeHits(root: string = process.cwd()): Hit[] {
  const hits: Hit[] = [];
  for (const file of lintedFiles(root)) {
    const source = readFileSync(file, 'utf8');
    for (const { line, text } of stringLiteralsOf(source, file)) {
      for (const word of hedgeWordsIn(text)) {
        hits.push({ file: file.slice(root.length + 1), line, word, text: text.trim() });
      }
    }
  }
  return hits;
}

function main(): number {
  const hits = hedgeHits();
  const files = lintedFiles().length;
  if (!hits.length) {
    console.log(`hedge-lint: clean. ${files} files, ${FORBIDDEN_WORDS.length} words.`);
    return 0;
  }
  console.log(`hedge-lint: ${hits.length} hit${hits.length === 1 ? '' : 's'} in ${files} files.\n`);
  for (const hit of hits) {
    console.log(`  ${hit.file}:${hit.line}  "${hit.word}"`);
    console.log(`    ${hit.text.length > 110 ? `${hit.text.slice(0, 110)}...` : hit.text}`);
  }
  console.log('\nDesign bible section 8: state outcomes, not advice. Rewrite the line.');
  console.log('The words are src/data/forbiddenWords.ts, with the rule for what belongs on it.');
  return 1;
}

/*
 * Run on import, except under the test runner.
 *
 * **Neither of the two usual entry-point checks works here.** `vite-node` does
 * not put the script it was handed into `process.argv` at all — argv is
 * `[node, .bin/vite-node]` and then the flags, so `argv[1]` names the runner
 * and no element names this file. A guard written either way reads false, the
 * lint exits zero having done nothing, and the leg that is supposed to hold
 * section 8 passes because it never ran. That is how this line got its comment.
 *
 * `VITEST` is set by the runner and by nothing else here, so the check is
 * "unless a test is importing me". `test/hedge-lint.test.ts` imports
 * `hedgeHits` and asks the same question in-process.
 */
if (!process.env['VITEST']) process.exit(main());
