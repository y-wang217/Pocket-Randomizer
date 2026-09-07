import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Two rules here are load-bearing architecture, not style:
 *   - core/ may never import from ui/ (keeps the sim playable headless)
 *   - Math.random() is banned repo-wide (all randomness comes from core/rng.ts)
 * test/boundaries.test.ts asserts the same two things so a lint-free CI run
 * cannot be the only thing standing between us and a violation.
 */
const noMathRandom = {
  selector: "MemberExpression[object.name='Math'][property.name='random']",
  message: 'Math.random() is banned. Draw from a named stream on core/rng.ts instead.',
};

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'stats/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', noMathRandom],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/ui', '**/ui/**', '*/ui/*'], message: 'core/ must not import from ui/. The battle has to run headless.' },
          ],
        },
      ],
    },
  },
  {
    // The sim adapter is the one place allowed to touch @pkmn/sim.
    files: ['src/**/*.ts', 'test/**/*.ts'],
    ignores: ['src/core/battle/driver.ts', 'src/core/battle/format.ts', 'test/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [{ name: '@pkmn/sim', message: 'Only core/battle/driver.ts and core/battle/format.ts may import @pkmn/sim.' }] },
      ],
    },
  },
);
