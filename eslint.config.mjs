import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*'],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
  {
    files: ['**/*.rules'],
    plugins: firebaseRulesPlugin.configs['flat/recommended'].plugins,
    languageOptions: firebaseRulesPlugin.configs['flat/recommended'].languageOptions,
    rules: firebaseRulesPlugin.configs['flat/recommended'].rules,
  },
];
