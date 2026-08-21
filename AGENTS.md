# mesh-common operating guide

`mesh-common` is the shared TypeScript/React runtime and scaffold for the
`baditaflorin/mesh-*` family of browser-local, WebRTC/Yjs applications. A
change here can affect every service, so prefer additive, tested primitives
and ship each change through a PR into `main`.

## Repository map

- `src/` — public runtime, hooks, security helpers, shared React chrome, and
  styles. Every public primitive must be exported from `src/index.ts`.
- `testing/` and `tests/` — mock-room fixtures and contract/integration tests.
- `scaffold/template/` — baseline for new sibling `mesh-*` application repos.
  Keep it aligned with required shared shell, privacy, test, and Pages setup.
- `scaffold/create-mesh-app.sh` — creates a sibling application using the
  template; new app logic normally lives in `src/Feature.tsx` in that repo.
- `scripts/` — fleet utilities including demo recording and catalog generation.
- `docs/demos/` — generated static catalog. Do not hand-edit
  `docs/demos/index.html`; update `scripts/build-demo-dashboard.mjs`, then
  regenerate it.
- `scenarios/` — demo-recording definitions for existing app repos.

## Service lifecycle

1. Choose a scoped service or primitive from the roadmap issues:
   [#18](https://github.com/baditaflorin/mesh-common/issues/18) for candidate
   services and [#19](https://github.com/baditaflorin/mesh-common/issues/19)
   for shared primitives.
2. For a new service, create a sibling `mesh-*` repository from the scaffold.
   Use a descriptive public GitHub repository and the conventional `main`
   branch. Do not reuse app state or credentials across services.
3. Build locally, run the app's unit/smoke checks, commit explicit paths, push,
   and enable GitHub Pages from `main` `/docs`.
4. Add a scenario and recorded `demo.gif`/`preview.png` to the catalog only
   after the deployed app works. Regenerate the mesh-common catalog.
5. Open a non-draft PR for mesh-common changes, verify tests and any configured
   Woodpecker pipeline, merge, then verify the merge commit on `origin/main`.
   Work is not complete until it is merged and the relevant deployment is live.

## Runtime and security boundaries

- Apps are rootless: browser-local storage plus direct peer coordination via
  Yjs/y-webrtc. Do not introduce a backend unless the service explicitly needs
  one and its data ownership is documented.
- The default signaling endpoint is `wss://turn.0docker.com/ws`; TURN
  credentials come from `https://turn.0docker.com/credentials`. Overrides are
  per-app `localStorage` settings. Never print, commit, or hard-code secret
  credentials.
- Keep endpoint validation in `src/iceConfig.ts`; configuration changes must
  not silently leave users with a broken room or expired TURN cache.
- Use typed CRDT contracts, signed writes, room seals, rate limits, and safe
  rendering primitives where the feature needs them. Validate untrusted peer
  data at the framework edge.

## Change rules

- Before changing a primitive, search `src/index.ts`, `tests/`, and existing
  scenarios for an equivalent. Prefer extending an existing headless primitive
  over copying app-specific logic.
- New public exports require contract tests and matching updates to `README.md`
  and `CHANGELOG.md` in the same PR.
- Accessibility is a shared concern: use the Radix-backed UI primitives for
  dialogs, preserve keyboard operation, provide labels/live feedback, and do
  not add bespoke focus-less overlays.
- Keep app-specific visual design in app repos; keep generic capability,
  synchronization, security, and chrome logic here.
- Generated artifacts must be reproducible. Run the generator instead of
  manually editing its output.

## Verification and publishing

- Baseline for this repo: `npm test`, `npx tsc --noEmit`, and any relevant
  generator command (for example `node scripts/build-demo-dashboard.mjs`).
- Use root `.woodpecker.yml` for repository CI. Do not add GitHub Actions.
  If a repository has no Woodpecker configuration, report that explicitly;
  do not claim a server-side CI pass.
- Inspect a dirty worktree first and stage only known paths. Never use
  `git add -A`, `git add .`, or destructive resets.
- For GitHub changes: create a feature branch, open a PR, inspect merge/check
  state, merge only when allowed, then fetch and verify the merge commit on
  `origin/main`.

## Parallel work

Subagents may independently audit the fleet, propose primitives, or build an
isolated new service. Avoid concurrent edits to `mesh-common` source, the
catalog generator, or generated catalog output. Coordinate ownership before
making shared-repository changes.
