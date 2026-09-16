import { config } from '@repo/eslint-config/base';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...config,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: ['@babel/preset-typescript'],
          parserOpts: { plugins: [['decorators', { decoratorsBeforeExport: true }], 'typescript'] },
        },
      },
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
];
