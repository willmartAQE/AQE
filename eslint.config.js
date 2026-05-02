// eslint.config.js
export default [
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        document:  "readonly",
        window:    "readonly",
        MutationObserver: "readonly",
      },
    },
    rules: {
      "no-unused-vars":  "warn",
      "no-undef":        "error",
      "no-redeclare":    "error",
    },
  },
];
