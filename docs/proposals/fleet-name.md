---
title: fleetPersona — cross-app display-identity primitive
status: shipped (mesh-common 0.9.0 + mesh-persona-service)
author: florin
date: 2026-05-19
---

# fleetPersona

> **Shipped surface (2026-05-19).** This document was a proposal. The implementation
> landed as `fleetPersona` (rather than `fleetName`) so that name **and** nickname
> **and** avatar all live in one primitive. The Go service ships as
> `~/Documents/Codex/2026-05-08/mesh-persona-service/`. The sections below have
> been updated to reflect the actual shape; the design discussion is intact for
> archaeology.

## What shipped

### Client (`mesh-common`)

| Export | Purpose |
|---|---|
| `useFleetPersona({ appName, serviceUrl? })` | Per-app hook. Returns `{ persona, source, label, avatarSeed, setNickname, setName, setAvatar, setPersona, forgetLocal, forgetEverywhere, mode, setMode, buildHandoffUrl, importHandoff }`. |
| `FleetAvatar` | Drop-in avatar for the current persona — wraps `PeerAvatar`, seed is the persona's avatarSeed (stable across renames). |
| `FleetIdentityPanel` | Drop-in settings UI: nickname + name fields, avatar variant/palette/seed, sync mode radio, handoff URL generator, "Forget me everywhere" button. |
| Low-level helpers | `readLocalPersona`, `writeFleetLocalPersona`, `ensureAnonId`, `fetchRemotePersona`, `publishRemotePersona`, `deleteRemotePersona`, `buildHandoffUrl`, `consumeHandoffFromHash`, `sanitizePersona`, `isValidPersonaField`, `resolvePersonaSync`. |

Type: `FleetPersona = { nickname, name, avatarSeed, avatarVariant: "beam"|"grid", paletteIndex? }`.

Sync mode (`FleetSyncMode`): `"off" | "local-fleet" | "remote-fleet"`. Default `local-fleet`.

### Service (`mesh-persona-service`)

Go binary, SQLite, argon2id write-token hashing, in-memory rate-limit, daily-rotated IP-hash salt, systemd-hardened unit, Caddyfile snippet, install script, hourly backup script, end-to-end smoke checklist.

### Test coverage

- 39 vitest tests in `mesh-common` (`tests/fleetPersona.test.ts` + `tests/useFleetPersona.test.tsx`).
- Go unit + handler tests for store, validation, rate-limit, CORS, read-only, oversized body.
- `testing/smoke.sh` validates the full lifecycle against a running server.



A new `mesh-common` primitive that lets a browser carry one display name across every Codex/mesh app the user touches. Local-first, fleet-wide opt-in, server is purely additive.

> Naming note: `mesh-common` already exports `identity` (Ed25519 keypair, per-peer crypto identity inside a single room). This proposal is **not** that. It is the human-facing **display name** layer, persisted in the browser, optionally synced across origins. To avoid collision I propose the module name `fleetName` (or `fleetPersona` if we want room to grow into avatar/color).

---

## 1. Problem

A user types "florin" into `mesh-applause`. They open `mesh-vibe-check` in a new tab five minutes later — the name input is empty. They type "florin" again. They open `mesh-applause` on `codex.florin.dev` (custom domain mirror) — empty again.

We want: **type once, every fleet app in this browser pre-fills with the same name**. Editable. Never blocks UX. Survives the service being down. Survives the service being hacked.

## 2. Two-layer architecture

```
┌─────────────────────────────────────────────────────────────┐
│  L0 — local           : per-app localStorage key            │
│                         (status quo, every app has this)    │
├─────────────────────────────────────────────────────────────┤
│  L1 — fleet-local     : shared-origin localStorage          │
│                         FREE on GH Pages (one origin: ...   │
│                         baditaflorin.github.io). Sync = 0ms │
├─────────────────────────────────────────────────────────────┤
│  L2 — fleet-remote    : tiny HTTP service on Hetzner.       │
│                         Spans custom domains, opt-in.       │
│                         Async, may fail silently, never     │
│                         blocks the L0/L1 path.              │
└─────────────────────────────────────────────────────────────┘
```

**Key insight**: every GH-Pages-hosted Codex app shares the origin `baditaflorin.github.io`. localStorage is already shared. L1 needs zero server. L2 only exists to bridge across origins (custom domains, mirrors, second devices).

### Resolution order on app load

1. `L0.get()` — if set, that wins. The user explicitly chose it for this app; never override.
2. else `L1.get()` — same-origin fleet name. Pre-fill input, mark as `source: 'fleet-local'`.
3. else `L2.fetch()` — async, populates input later (only if user hasn't typed). `source: 'fleet-remote'`.
4. else — empty, user types fresh.

L1 and L2 are **suggestions**. The user can always overwrite, and the override sticks in L0. When the user *confirms or changes* a name, the value propagates *down* the stack: write L0, write L1 (same-origin), fire-and-forget L2 (if enabled).

## 3. GH Pages: does L1 actually work?

**Yes, and we should verify with a one-shot test:**

```js
// Run in console on https://baditaflorin.github.io/mesh-applause/
localStorage.setItem('mesh-common.fleetName.v1', JSON.stringify({ name: 'florin', ts: Date.now() }));
// Then navigate to https://baditaflorin.github.io/mesh-vibe-check/ in the same tab
JSON.parse(localStorage.getItem('mesh-common.fleetName.v1')); // → { name: 'florin', ts: ... }
```

This must pass before we ship L1. Caveat: this only works for apps served under `baditaflorin.github.io/*`. Anything on a custom apex (e.g. `codex.florin.dev/applause`) is a different origin and needs L2.

## 4. The service (L2)

### API surface (deliberately minimal)

```
GET    /v1/name/:anonId          → { name, updatedAt }
PUT    /v1/name/:anonId          → { name, writeToken }       → 204
DELETE /v1/name/:anonId          → { writeToken }             → 204
GET    /v1/health                → { ok, ver, ts }
```

That is the entire surface. No accounts, no email, no OAuth, no sessions, no cookies.

### Data model

```sql
CREATE TABLE names (
  anon_id          TEXT PRIMARY KEY,     -- 128-bit random hex, client-generated
  write_token_hash TEXT NOT NULL,        -- argon2id of client-generated 128-bit secret
  name             TEXT NOT NULL,        -- 1..32 chars, [a-zA-Z0-9_\- ]
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE rate_buckets (
  bucket   TEXT PRIMARY KEY,             -- "ip:1.2.3.4:read:2026051911" — hour bucket
  count    INTEGER NOT NULL
);
```

That is the entire schema. SQLite on a single Hetzner VPS. Backed up hourly via `sqlite3 .backup`.

### What the server **does not** store

- No IP addresses (only short-lived salted hashes in rate buckets).
- No User-Agent strings, no fingerprints.
- No mapping of `anon_id` → origin, app, or referrer.
- No logs beyond the standard Caddy access log (which we rotate at 7 days).

### Tech stack

- **Language**: Go (single static binary; you're fluent; aligns with the `go-fleet-*` family on the box).
- **HTTP**: stdlib `net/http`, ~150 LoC.
- **DB**: `mattn/go-sqlite3` or `modernc.org/sqlite`.
- **TLS**: Caddy in front, auto-HTTPS.
- **Process**: systemd unit `mesh-name.service`, `Restart=always`.
- **DNS**: a new `A` record `name.codex.<your-domain>` via Hetzner Cloud API (per the existing reference memory).
- **Backups**: hourly snapshot to `~/backups/mesh-name/`, rsync to a second host nightly.

Total: ~300 LoC of Go + ~10 lines of Caddy + ~15 lines of systemd. Cheap to read, cheap to audit.

## 5. Security model

Because every fleet app calls this service, a compromise touches every app. So we minimize what's worth stealing.

### Threat model

| Threat                                  | Impact                                          | Mitigation                                                                                                  |
|-----------------------------------------|-------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| Server compromise                       | Attacker reads all names                        | Names are display strings, not secrets. Worst case: weird names appear. No PII, no credentials.             |
| Server compromise → rewrite names       | Phishing / impersonation in apps                | Hourly backups; one-command restore. Names are advisory; apps display them, don't auth on them.             |
| `anon_id` leak                          | Attacker learns *one* user's display name       | Display names are non-secret by design. We will document this explicitly in the opt-in copy.                |
| `anon_id` + `writeToken` leak           | Attacker can rewrite that user's name           | `writeToken` lives only in browser localStorage; never sent to apps, only to the service over HTTPS.        |
| Enumeration                             | Bulk dump of all names                          | `anon_id` is 128-bit random — not enumerable. Read rate-limit: 60/min/IP.                                   |
| Stored XSS via name field               | Other apps render `<script>` from name          | Server rejects anything not matching `^[a-zA-Z0-9_\- ]{1,32}$`. Apps already HTML-escape. Belt + braces.    |
| DoS                                     | Service down → graceful degradation             | Rate limits per IP and per anon_id. Client fails silently after 2s timeout. L0/L1 keep working.             |
| Tracking by service operator (you)      | You could correlate which apps a user opens     | We never store *which* app called — only `(anon_id, name)`. App identity is not part of the request.        |
| CSRF / CORS abuse                       | Malicious page writes to user's anon_id         | Write requires the `writeToken`, which is only in the legitimate browser's localStorage. CORS = `*` is OK.  |
| Supply-chain on the Go binary           | Backdoored build                                | Build reproducibly from source on the box (no `go install`-from-internet). Pin module versions in `go.sum`. |

### Why the writeToken model is enough

- Reads are public-by-design (return only `{name, updatedAt}`).
- Writes require `writeToken`, generated client-side at L2 enrollment, hashed with argon2id on the server.
- Token never leaves the browser except in HTTPS PUT/DELETE bodies to `name.codex.*`.
- No app code ever sees the token: `fleetName` exports `publishToFleet(name)` — the token is held *inside* the primitive's closure / module-private state.

### Opt-out / kill switch

- User can hit a "Forget me everywhere" link in settings → `DELETE /v1/name/:anonId` + wipe local `anonId` + `writeToken`. From that moment, this browser is back to L1-only behavior.
- We can ship a server-side kill switch: env var `READ_ONLY=true` → all writes return 503, reads still work.

## 6. Cross-origin handoff (the "I'm on a new domain" case)

**The browser cannot ambient-share an `anon_id` across origins.** That's a feature, not a bug. So when the user wants their fleet name to follow them to a new origin (e.g. their custom domain), they must explicitly hand off.

### Mechanism: signed handoff URL fragment

In any app where the user is L2-enrolled, settings shows a button:

> **Carry this name to another domain** → generates `https://<that-domain>/#fn=<anonId>.<writeToken>.<sig>`

The fragment is **never** sent to any server (fragment stays client-side). On the new origin, `useFleetName` checks `window.location.hash` once, captures, stores, then wipes the fragment.

Alternative form factors, same payload:

- **QR**: app generates a QR of the same URL. Scan via phone camera → opens new origin → handoff completes. Reuses the existing `PersonalQR` / `QRExchange` primitives in `mesh-common`.
- **Copy-paste link**: same URL in a text box for email/Signal handoff to your other device.

The handoff is one-shot and **user-initiated**. There is no silent cross-origin tracking.

## 7. Opt-in UX

Per your decision: **auto-suggest in name field, no prompt, silent**.

```tsx
const { name, source, setName } = useFleetName({ appName: 'mesh-applause' });

<input
  value={name ?? ''}
  onChange={(e) => setName(e.target.value)}
  placeholder={source === 'fleet-local' ? `Continue as "${name}"?` : 'Your name'}
/>
```

If the suggestion came from L1 or L2 but the user types something else, the override wins and propagates back down. If the user wants the suggestion, they just hit Enter / submit — the value gets confirmed and propagated.

### Settings (per app)

A new section in `SettingsDrawer`:

```
─ Fleet name ─────────────────────────────────────
  ◉ Off                — this app uses only its local name
  ◯ Same-browser sync  — share with other Codex apps in this browser (default)
  ◯ Cross-domain sync  — also sync to your other devices/domains [opt-in]

  [ Carry this name to another domain ]    [ Forget me everywhere ]
```

The middle tier (L1) is the *default* because it's free, local, zero-network. The top tier (L2) is opt-in — that's where consent is meaningful, because that's where bytes leave the device.

### "Restarts can ignore it"

The setting persists per-app in L0 storage. A user who picked **Off** in `mesh-applause` will never see fleet suggestions there, even after a reload or a fleet-wide name change.

## 8. Client primitive shape (TypeScript)

```ts
// mesh-common/src/fleetName.ts

export type FleetNameSource = 'local' | 'fleet-local' | 'fleet-remote' | null;

export interface FleetNameApi {
  name: string | null;
  source: FleetNameSource;
  setName: (name: string) => void;          // writes L0; propagates to L1 + L2 by mode
  forgetEverywhere: () => Promise<void>;    // DELETE L2 + wipe local anonId/token
  generateHandoffUrl: (origin: string) => string;
  importHandoffFromHash: () => boolean;     // call once on app boot
  mode: 'off' | 'local-fleet' | 'remote-fleet';
  setMode: (m: 'off' | 'local-fleet' | 'remote-fleet') => void;
}

export interface FleetNameOptions {
  appName: string;                          // L0 namespace key
  serviceUrl?: string;                      // e.g. 'https://name.codex.example.com'
  charset?: RegExp;                         // default: /^[a-zA-Z0-9_\- ]{1,32}$/
  fetchTimeoutMs?: number;                  // default: 2000
}

export function useFleetName(opts: FleetNameOptions): FleetNameApi;
```

### Storage keys

| Key                                          | Tier | Scope                                                          |
|----------------------------------------------|------|----------------------------------------------------------------|
| `mesh-common.fleetName.v1.local.<appName>`   | L0   | This app only.                                                 |
| `mesh-common.fleetName.v1.fleet`             | L1   | Shared across all same-origin Codex apps.                      |
| `mesh-common.fleetName.v1.anonId`            | L2   | Random 128-bit hex. Wiped by "forget".                         |
| `mesh-common.fleetName.v1.writeToken`        | L2   | Random 128-bit hex. Never exposed outside the primitive.       |
| `mesh-common.fleetName.v1.mode.<appName>`    | both | `'off' \| 'local-fleet' \| 'remote-fleet'`. Default `local-fleet`. |

Versioning the keys (`v1`) lets us migrate without nuking existing names.

### Graceful degradation rules (hard-coded)

- L2 fetch always wrapped in `Promise.race([fetch, timeout(2000ms)])`.
- L2 errors → swallowed, logged at `debug` only.
- L2 write → fire-and-forget; the UI never awaits it.
- Network offline → no retries, no queues, no toasts. Next page load tries again.

## 9. Extension points (designed for, not built)

- **More than name**: schema is `(anon_id, name)` today; one column add to store `avatar_seed`, `color`, `locale`. Server returns one blob, clients pick what they want.
- **Multiple identities per browser**: introduce `anon_id_v2 = (group, id)` so a user can have a "work" name and a "play" name.
- **Verifiable claims**: pair with the existing Ed25519 `identity` primitive — sign the (anon_id, name) pair, peers can verify the name belongs to that key. Optional, off by default.
- **Federation**: same wire protocol could be implemented by anyone else hosting `mesh-common`-style apps. Clients accept a *list* of service URLs and merge results, last-write-wins by `updatedAt`.

## 10. Deployment plan

**Phase 0 — verify the GH Pages premise (1 hour, no code)**

- [ ] Open the localStorage test in §3 in two GH-Pages-hosted fleet apps in the same browser session.
- [ ] Confirm shared origin really gives shared storage. If it doesn't (e.g. partitioned storage in Safari ITP mode), document the actual scope and rescope L1.

**Phase 1 — L0+L1 in `mesh-common` (1–2 days)**

- [ ] `src/fleetName.ts` + `useFleetName` hook + vitest unit tests.
- [ ] Wire into `SettingsDrawer` (settings panel + "forget" button).
- [ ] Update `MeshShell` so any app using the shell gets fleet suggestions free.
- [ ] Roll into one canary app (`mesh-applause`?) first; confirm UX.
- [ ] Roll across the fleet via your existing `mesh-across` script.

**Phase 2 — L2 service (2–3 days)**

- [ ] Go service in `~/Documents/Codex/2026-05-08/mesh-name-service/` (new repo, parallel to `go-fleet-*`).
- [ ] Local dev: `make run` boots SQLite on `:8080`.
- [ ] Hetzner: provision DNS via Hetzner Cloud API (per existing reference memory), deploy systemd unit + Caddyfile, smoke-test `/v1/health`.
- [ ] Add `serviceUrl` option to `useFleetName`; ship behind the "Cross-domain sync" mode (opt-in).

**Phase 3 — handoff UX (1 day)**

- [ ] Reuse `PersonalQR` for the URL → QR.
- [ ] "Carry this name to another domain" button generates link.
- [ ] `useIncomingScanLink` already exists in `mesh-common`; adapt it (or write a sibling `useFleetNameHandoff`) to consume `#fn=...`.

**Phase 4 — fleet rollout**

- [ ] Bump `mesh-common` minor version.
- [ ] Use `mesh-across` to update all `mesh-*` apps to the new version + run `npm run fmt && npm run smoke` (per the workflow conventions memory).
- [ ] Local-only build per the "no GitHub Actions" memory — commit the built `docs/` to bypass the Actions billing lock.

## 11. Testing plan

### Unit (vitest, in `mesh-common`)

- L0 round-trip on fresh storage.
- L0 wins over L1 wins over L2.
- L2 timeout → `source` stays `'fleet-local'`, no throw.
- Charset rejection.
- `mode === 'off'` → never reads L1 or L2.
- Handoff URL → parse round-trip; hash is wiped after import.

### Integration

- Spin up the Go service in a Docker container in CI… **wait — per the local-only build memory, no CI.** So: a `make integration` target that boots the service locally and runs vitest against it.

### Manual E2E checklist (printable, runs once per release)

- [ ] On GH Pages: set name in `mesh-applause`, open `mesh-vibe-check` → pre-filled.
- [ ] Open same browser at `codex.<your-domain>/applause` (different origin) → empty.
- [ ] Enable L2 in both, generate handoff QR from `mesh-applause`, scan it → name appears at the new origin.
- [ ] Stop the service (`systemctl stop mesh-name`); reload an app → still works with last L1 value, no error UI.
- [ ] Toggle "Off" in `mesh-vibe-check` → its name input goes blank and stays blank across reloads.
- [ ] Click "Forget me everywhere" → service `GET /v1/name/:id` returns 404, local `anonId` is gone.

### Smoke (continuous, on the box)

- `/v1/health` probed every 5 min by a cron on the same box (writes a one-line log).
- SQLite size watch: alert if > 100 MB (way past expected).

## 12. Decisions still on the table

1. **Module name**: `fleetName` vs `fleetPersona` vs `displayName`. Recommend `fleetName` — narrowest, easiest to extend later by adding sibling modules (`fleetAvatar`, `fleetColor`) rather than ballooning one.
2. **Default mode**: I recommend `local-fleet` (L1 on by default, L2 opt-in). Free, no consent burden, no bytes leaving the device.
3. **Service domain**: pick now so the doc is concrete — suggest `name.codex.<your-domain>`. If undecided, leave as a TODO and the primitive ships with `serviceUrl` undefined (= L0+L1 only).
4. **Argon2id parameters**: defaults from `golang.org/x/crypto/argon2` are fine for write-token verification on this tiny scale; revisit only if write QPS climbs past ~10/sec.

## 13. What this is *not*

- Not authentication. Apps must never gate features on a fleet name.
- Not a profile. There is no email, no avatar upload, no bio.
- Not cross-user. Each `anon_id` is one browser. Two browsers = two anon_ids unless the user handoffs.
- Not synchronous. The L2 fetch is always best-effort, always racing a 2s timeout.
- Not a replacement for the existing `identity` module — that's per-room crypto; this is per-browser display string. Both can coexist, and §9 outlines how they'd compose.

---

## TL;DR

- **L1 is the win.** Same-origin localStorage on `baditaflorin.github.io` solves 90% of the problem with zero server.
- **L2 is small, optional, and replaceable.** ~300 LoC Go, one SQLite file, on the box you already run. Never blocks the UI.
- **Security is bounded by design**: the only thing the service stores is display names. Compromise = inconvenience, not breach.
- **Opt-in respects user agency**: silent suggestion is the only ambient behavior; anything that leaves the browser requires an explicit settings toggle.
- **Cross-origin needs a user gesture** — bookmarklet/QR/link handoff. No ambient tracking, ever.
