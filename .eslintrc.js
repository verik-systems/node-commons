module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: "./tsconfig.lint.json",
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier",
  ],
  plugins: ["unused-imports", "@typescript-eslint", "@typescript-eslint/eslint-plugin", "prettier"],
  env: {
    node: true,
  },
  globals: {
    Reflect: true,
  },
  rules: {
    "new-cap": "off",
    "prettier/prettier": [
      "error",
      {
        endOfLine: "auto",
        semi: false,
        printWidth: 120,
      },
    ],
    "@typescript-eslint/no-unused-vars": "off",
    "unused-imports/no-unused-imports": "error",
    "unused-imports/no-unused-vars": [
      "warn",
      {
        vars: "all",
        varsIgnorePattern: "^_",
        args: "after-used",
        argsIgnorePattern: "^_",
      },
    ],
    "@typescript-eslint/interface-name-prefix": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-explicit-any": "off",
  },
  overrides: [
    {
      files: ["test/**/*.ts"],
      env: {
        mocha: true,
      },
      rules: {
        "@typescript-eslint/explicit-function-return-type": "off",
        "no-unused-expressions": "off",
        "no-magic-numbers": "off",
        "@typescript-eslint/unbound-method": "off",
      },
    },
  ],
}
