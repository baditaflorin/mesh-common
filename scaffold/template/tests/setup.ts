import "@testing-library/jest-dom/vitest";

// Vite injects these at build time; provide test-time defaults so files that
// import config.ts work in unit tests.
(globalThis as Record<string, unknown>).__APP_VERSION__ ??= "0.0.0-test";
(globalThis as Record<string, unknown>).__GIT_COMMIT__ ??= "test";
