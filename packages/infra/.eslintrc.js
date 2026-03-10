module.exports = {
  extends: ['../../configs/.eslintrc.base.js'],
  overrides: [
    {
      // bin/ entry points must use relative imports since ts-node does not resolve baseUrl aliases
      files: ['bin/**/*.ts'],
      rules: {
        'no-restricted-imports': 'off',
      },
    },
  ],
};
