/**
 * Shared ESLint flat config for every mesh-* app and mesh-common itself.
 *
 * Usage in an app:
 *
 *   // eslint.config.js
 *   import meshCommon from "@baditaflorin/mesh-common/eslint";
 *   export default meshCommon();
 *
 *   // With local overrides:
 *   import meshCommon from "@baditaflorin/mesh-common/eslint";
 *   export default [
 *     ...meshCommon(),
 *     { rules: { "no-console": "warn" } },
 *   ];
 *
 * Required peer deps (in the consuming app's devDependencies):
 *   eslint, typescript-eslint, eslint-plugin-react-hooks, eslint-config-prettier
 *
 * That's four packages — every one is a real linter, not a transitive surprise.
 */

/** @returns {import("eslint").Linter.Config[]} */
export default function meshCommonEslint(opts = {}) {
  // Lazy-require so consumers without the peer deps installed get a clearer
  // error than "module not found in some plugin you didn't know about".
  const tseslint = requirePeer("typescript-eslint");
  const reactHooks = requirePeer("eslint-plugin-react-hooks");
  const prettier = requirePeer("eslint-config-prettier");

  const ignores = [
    "docs/**",
    "dist/**",
    "node_modules/**",
    "playwright-report/**",
    "test-results/**",
    ...(opts.ignores ?? []),
  ];

  return [
    { ignores },

    // TypeScript baseline (recommended + type-checked-lite via projectService)
    ...tseslint.configs.recommended,

    // React Hooks rules — flat config plugin entry
    {
      files: ["**/*.{ts,tsx,jsx}"],
      plugins: { "react-hooks": reactHooks },
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },

    // mesh-* house style
    {
      files: ["**/*.{ts,tsx}"],
      rules: {
        // We rely on TS to catch real errors; soften a few stylistic rules
        // that fight with our deliberate `as unknown as` boundary casts.
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/no-unused-vars": [
          "warn",
          { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
        ],
        "@typescript-eslint/no-empty-object-type": "off",
        "no-console": ["warn", { allow: ["warn", "error"] }],
        eqeqeq: ["error", "always", { null: "ignore" }],
        "prefer-const": "error",
      },
    },

    // Tests can be looser
    {
      files: ["tests/**/*.{ts,tsx}", "**/*.test.{ts,tsx}"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "no-console": "off",
      },
    },

    // Disable rules that conflict with prettier. MUST be last.
    prettier,

    // App-level extra rules from caller
    ...(opts.extra ?? []),
  ];
}

function requirePeer(name) {
  try {
    // Use dynamic import for ESM; createRequire for CJS fallback in mixed envs.
    // eslint.config.js itself is loaded by eslint as ESM, so import.meta works.
    // We expose a sync require because flat config expects sync plugin objects.
    return require(name);
  } catch (err) {
    throw new Error(
      `[@baditaflorin/mesh-common/eslint] missing peer dependency "${name}". ` +
        `Run: npm i -D ${name}`,
    );
  }
}

// Make `require` available even from ESM. Node 22 supports module.createRequire,
// and Vite/Vitest both run this file via Node, not the bundler.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
