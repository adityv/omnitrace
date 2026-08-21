module.exports = {
  env: {
    es2022: true,
    node: true
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'commonjs'
  },
  ignorePatterns: [
    'node_modules/',
    '*.tgz',
    'OmniTrace_Codebase.md',
    'FINAL_AUDIT.md',
    'audit_findings.md'
  ],
  rules: {
    'no-console': 'off',
    'no-process-exit': 'off',
    'no-await-in-loop': 'off',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
  }
};
