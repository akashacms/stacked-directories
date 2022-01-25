module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: [
      '@typescript-eslint',
    ],
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
    ],
    rules: {
      "@typescript-eslint/no-this-alias": [
        "error",
        {
          "allowDestructuring": false, // Disallow `const { props, state } = this`; true by default
          "allowedNames": [ "self", "that" ] // Allow `const self | that = this`; `[]` by default
        }
      ]
    }
};
