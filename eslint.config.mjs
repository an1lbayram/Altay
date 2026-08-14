import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**'],
  },
  js.configs.recommended,
  // Browser app source: ES modules loaded natively via <script type="module">.
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Silently-swallowed catch blocks (e.g. best-effort localStorage writes, a cancelled
      // navigator.share()) are a deliberate pattern in this codebase, not an oversight.
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  // Hand-written service worker: its own global scope (self, caches, clients), not a module.
  {
    files: ['public/sw.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: { ...globals.serviceworker },
    },
  },
  // Node-side config files and scripts.
  {
    files: ['*.config.js', 'vite.config.js', 'playwright.config.js', 'playwright.api.config.js', 'eslint.config.mjs', 'scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    files: ['postcss.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },
  // Playwright specs: Node test runner code, but callbacks passed to page.evaluate() run in
  // the browser — so both global sets are allowed here rather than flagging false no-undefs.
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
  },
];
