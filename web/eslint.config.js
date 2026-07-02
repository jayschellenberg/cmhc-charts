import js from '@eslint/js';
import globals from 'globals';

// Pragmatic flat config for a solo-maintained vanilla-JS app: the recommended
// rules (real-bug catchers — no-undef, no-dupe-keys, no-unreachable, …) as
// errors, unused vars as a warning, console allowed. Not a style enforcer.
export default [
  { ignores: ['dist/**', 'node_modules/**', '**/*.tmp.*'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'test/**/*.js', '*.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
];
