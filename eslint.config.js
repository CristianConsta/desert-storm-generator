const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none' }],
      'no-useless-assignment': 'off',
    },
  },
  {
    files: ['app.js', 'firebase-module.js', 'js/app-init.js', 'js/core/i18n.js'],
    rules: {
      'no-undef': 'off',
      'no-inner-declarations': 'off',
    },
  },
  {
    files: [
      'js/features/buildings/coordinate-picker-controller.js',
      'js/features/generator/download-controller.js',
    ],
    languageOptions: {
      globals: {
        DSThemeColors: 'readonly',
        XLSX: 'readonly',
      },
    },
  },
  {
    files: ['**/*.mjs', 'js/**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];
