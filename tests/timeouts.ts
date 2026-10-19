// Per-test timeout for tests that spawn node, bash or git subprocesses, or
// load the TypeScript compiler. Each spawned node process that imports
// `typescript` parses ~10 MB of JavaScript, so these tests can take 20 s or
// more on a heavily loaded host, past the 15 s default in vitest.config.ts.
// They take well under a second each on an idle machine.
export const SUBPROCESS_TEST_TIMEOUT_MS = 60_000;
