---
title: fleetPersona — integration recipe for a mesh-* app
status: reference
date: 2026-05-19
---

# Integrating `fleetPersona` into a mesh-* app

5 lines of code in the typical case. Add more for the settings panel and avatar.

## 1. Bare minimum — read the user's name

```tsx
import { useFleetPersona } from "@baditaflorin/mesh-common";

function NameField({ appName }: { appName: string }) {
  const { persona, setNickname, suggestion } = useFleetPersona({ appName });
  return (
    <input
      value={persona.nickname}
      onChange={(e) => setNickname(e.target.value)}
      placeholder={suggestion?.persona.nickname || "Your name"}
    />
  );
}
```

- L0 wins if this app already has a name.
- Otherwise the input is pre-filled (`placeholder`) with the same-origin fleet name (L1).
- If `serviceUrl` is set and mode is `remote-fleet`, a fleet name fetched from the service appears within 2 s, with no blocking.

## 2. Add the avatar

```tsx
import { FleetAvatar } from "@baditaflorin/mesh-common";

<FleetAvatar appName={appName} size={48} />
```

The avatar is deterministic on the persona's `avatarSeed` (which is stable across renames) — so users get a consistent face across every Codex app on this browser.

## 3. Add the settings panel

Drop it into `SettingsDrawer`'s children:

```tsx
<SettingsDrawer config={cfg} open={open} onClose={...} roomId={room} onRoomChange={...}>
  <FleetIdentityPanel
    appName={cfg.storagePrefix}
    serviceUrl="https://name.codex.<your-domain>"
  />
</SettingsDrawer>
```

The panel covers: nickname + full name, avatar variant + palette + custom seed, sync mode (off / local / cross-domain), handoff URL generation, and a "Forget me everywhere" kill switch.

## 4. Use the formal name (when an app wants the long form)

```tsx
const { persona, label } = useFleetPersona({ appName });
const longForm = persona.name || persona.nickname || "Friend";
// or for the common case:
const display = label;   // nickname || name
```

Apps choose which to render. The primitive captures both.

## 5. Cross-origin handoff

Generate from one origin:

```ts
const url = fp.buildHandoffUrl("https://codex.your-other-domain.com");
// Show as a QR or share link; user opens it on the other origin.
```

On the other origin, the hook **auto-consumes** the `#fp=…` fragment on mount and stores `anonId` + `writeToken` + L1 persona. The next render shows the imported nickname. The hash is wiped from the URL.

You can also wire QR rendering directly:

```tsx
import { PersonalQR } from "@baditaflorin/mesh-common";
<PersonalQR url={url} size={200} />
```

## 6. Where things are stored

| Key                                       | Tier | Shared? | Notes                                              |
|-------------------------------------------|------|---------|----------------------------------------------------|
| `mesh-fleet:v1:local:<appName>`           | L0   | per-app | Wins over everything else. JSON-encoded `FleetPersona`. |
| `mesh-fleet:v1:fleet`                     | L1   | shared  | Same-origin fleet persona. Free on GH Pages.       |
| `mesh-fleet:v1:anonId`                    | L2   | shared  | 128-bit hex. Created lazily on first publish.      |
| `mesh-fleet:v1:writeToken`                | L2   | shared  | 128-bit hex. Never exposed to app code.            |
| `mesh-fleet:v1:mode:<appName>`            | both | per-app | `off` / `local-fleet` / `remote-fleet`.            |

## 7. Failure modes (all silent)

- localStorage unavailable (Safari private mode) → primitive returns defaults; UI works.
- Service unreachable → fetch resolves to `null` after 2 s; L0/L1 keep working.
- Service returns 5xx → swallowed; persona stays at L0/L1 value.
- Handoff fragment malformed → returns `null`; nothing imported.
- User flips mode to `off` → L1 and L2 are ignored on next render.

Nothing this primitive does will ever block your UI or surface an error toast.

## 8. Security checklist for app authors

- Never use the persona for authn/authz. Apps that gate features on a nickname are broken by design.
- Escape `persona.nickname` / `persona.name` on render. The primitive sanitises on the way in/out but defence-in-depth.
- Don't log the `writeToken`. The primitive never returns it to app code; if you start reading it directly, stop.
- Treat `buildHandoffUrl()` output as a password — it carries the writeToken in the fragment. Show it for one user gesture, then drop the reference.
- If your app is a kiosk / public terminal, set `defaultMode: "off"` so users start fresh.

## 9. Fleet rollout

1. Bump `mesh-common` to ≥ 0.9.0 in each `mesh-*` app's `package.json` (already `file:../mesh-common`).
2. Replace ad-hoc nickname inputs with `useFleetPersona` (~5 LoC per app).
3. Add `<FleetIdentityPanel>` to the settings drawer (~3 LoC per app).
4. Run `npm run fmt && npm run smoke` per app (`mesh-across` script handles the loop).
5. Commit built `docs/` (per the local-only-build workflow).
