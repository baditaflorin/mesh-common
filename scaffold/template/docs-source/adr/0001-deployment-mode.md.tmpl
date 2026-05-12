# 0001 — Deployment mode: Mode A (Pure GitHub Pages)

- **Status**: accepted
- **Date**: 2026-05-13

## Context

This app is a peer-to-peer mesh; the only "backend" needed is signaling + TURN, both already self-hosted (see README). All app state lives in browsers via Yjs CRDT. No auth, no DB.

## Decision

Ship as **Mode A** — pure client-side GitHub Pages app served from `docs/`.

- Build output committed to `docs/`, not produced by a GitHub Actions workflow (the account-wide Actions billing lock makes A the only feasible mode anyway).
- All runtime dependencies (signaling, TURN) are overridable via the in-app settings drawer.

## Consequences

- ✅ Zero runtime cost, no servers to operate beyond the shared WebRTC stack.
- ✅ Reproducible: `docs/` is checked in and `git log -- docs/` shows the deploy history.
- ❌ No server-side validation; assume any peer can send arbitrary CRDT updates.
- ❌ No persistence beyond connected peers (acceptable — this is by design).

## Alternatives considered

- **Mode B (Pages + pre-built data)**: rejected — there is no offline data to bake in.
- **Mode C (Docker backend)**: rejected — no functionality requires authoritative state. The self-hosted signaling/TURN already exists as shared infra across all mesh-* apps.
