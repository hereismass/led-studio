import eslint from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/target/**',
      'apps/desktop/src-tauri/gen/**',
    ],
  },
  {
    ...eslint.configs.recommended,
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { globals: globals.node },
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-refresh/only-export-components': [
        'error',
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ['apps/desktop/src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/app/**',
                '**/features/**',
                '**/platform/**',
                '**/workspace/**',
              ],
              message:
                'Shared desktop code cannot depend on higher-level modules.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/desktop/src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/app/**', '**/platform/tauri/**', '**/workspace/**'],
              message:
                'Features may use shared code and platform-neutral packages, not app, workspace, or Tauri implementations.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'apps/desktop/src/app/session/**/*.{ts,tsx}',
      'apps/desktop/src/workspace/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/platform/tauri/**'],
              message:
                'Session and workspace code must depend on platform ports, not concrete Tauri adapters.',
            },
          ],
        },
      ],
    },
  },
);
