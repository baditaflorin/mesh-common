import { useState, type ReactElement } from "react";
import { FleetAvatar } from "./FleetAvatar";
import { useFleetPersona } from "./useFleetPersona";
import {
  DEFAULT_FLEET_PERSONA_SERVICE_URL,
  isValidPersonaField,
  type FleetSyncMode,
} from "./fleetPersona";

/**
 * Drop-in settings UI for the fleet persona. Designed to be inserted as
 * `<SettingsDrawer>`'s `children`:
 *
 *   <SettingsDrawer config={cfg} ...>
 *     <FleetIdentityPanel appName={cfg.storagePrefix} serviceUrl={SERVICE_URL} />
 *   </SettingsDrawer>
 *
 * Three sync modes, name + nickname both editable, avatar variant + palette
 * toggle, handoff URL to another origin, "forget me everywhere" kill switch.
 */
export type FleetIdentityPanelProps = {
  appName: string;
  /**
   * Cross-origin sync service. Defaults to the fleet's canonical
   * persona service. Pass `null` to disable L2 (no remote sync option
   * shown). Pass your own URL to hit a staging instance.
   */
  serviceUrl?: string | null;
  /** Optionally render the avatar preview at a different size. */
  avatarSize?: number;
  /** Set false to drop the handoff URL block (e.g. for kiosks). */
  showHandoff?: boolean;
};

export function FleetIdentityPanel({
  appName,
  serviceUrl,
  avatarSize = 64,
  showHandoff = true,
}: FleetIdentityPanelProps): ReactElement {
  const effectiveServiceUrl =
    serviceUrl === null ? undefined : serviceUrl ?? DEFAULT_FLEET_PERSONA_SERVICE_URL;
  const fp = useFleetPersona({ appName, serviceUrl: effectiveServiceUrl });
  const [targetOrigin, setTargetOrigin] = useState<string>("");
  const [handoff, setHandoff] = useState<string>("");

  const nicknameInvalid = !isValidPersonaField(fp.persona.nickname);
  const nameInvalid = !isValidPersonaField(fp.persona.name);

  return (
    <section className="mesh-fleet-identity">
      <h3>Your identity across apps</h3>
      <p className="mesh-settings-help">
        Type once, every Codex app on this browser uses the same nickname and avatar.
        Strict ASCII, max 32 chars, never sent anywhere unless you turn on cross-domain sync.
      </p>

      <div className="mesh-fleet-identity-row">
        <FleetAvatar appName={appName} size={avatarSize} />
        <div className="mesh-fleet-identity-fields">
          <label>
            <span>Nickname</span>
            <input
              value={fp.persona.nickname}
              onChange={(e) => fp.setNickname(e.target.value)}
              placeholder={fp.suggestion?.persona.nickname || "florin"}
              aria-invalid={nicknameInvalid || undefined}
              maxLength={32}
            />
          </label>
          <label>
            <span>Full name (optional)</span>
            <input
              value={fp.persona.name}
              onChange={(e) => fp.setName(e.target.value)}
              placeholder={fp.suggestion?.persona.name || ""}
              aria-invalid={nameInvalid || undefined}
              maxLength={32}
            />
          </label>
        </div>
      </div>

      <fieldset className="mesh-fleet-identity-avatar">
        <legend>Avatar</legend>
        <label>
          <input
            type="radio"
            name="mesh-fleet-variant"
            checked={fp.persona.avatarVariant === "beam"}
            onChange={() => fp.setAvatar({ variant: "beam" })}
          />{" "}
          beam
        </label>
        <label>
          <input
            type="radio"
            name="mesh-fleet-variant"
            checked={fp.persona.avatarVariant === "grid"}
            onChange={() => fp.setAvatar({ variant: "grid" })}
          />{" "}
          grid
        </label>
        <label>
          <span>Palette</span>
          <select
            value={fp.persona.paletteIndex ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              fp.setAvatar({ paletteIndex: v === "" ? undefined : Number(v) });
            }}
          >
            <option value="">auto (from seed)</option>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <option key={i} value={i}>
                palette {i}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Custom seed</span>
          <input
            value={fp.persona.avatarSeed}
            onChange={(e) => fp.setAvatar({ seed: e.target.value })}
            placeholder="optional"
            maxLength={64}
          />
        </label>
      </fieldset>

      <fieldset className="mesh-fleet-identity-mode">
        <legend>Sync</legend>
        <label>
          <input
            type="radio"
            name="mesh-fleet-mode"
            value="off"
            checked={fp.mode === "off"}
            onChange={() => fp.setMode("off" as FleetSyncMode)}
          />{" "}
          Off — this app uses only its local persona
        </label>
        <label>
          <input
            type="radio"
            name="mesh-fleet-mode"
            value="local-fleet"
            checked={fp.mode === "local-fleet"}
            onChange={() => fp.setMode("local-fleet" as FleetSyncMode)}
          />{" "}
          Same-browser — share with other Codex apps on this origin
        </label>
        <label className={effectiveServiceUrl ? "" : "mesh-fleet-identity-mode--disabled"}>
          <input
            type="radio"
            name="mesh-fleet-mode"
            value="remote-fleet"
            checked={fp.mode === "remote-fleet"}
            disabled={!effectiveServiceUrl}
            onChange={() => fp.setMode("remote-fleet" as FleetSyncMode)}
          />{" "}
          Cross-domain — also sync to your other devices/domains{!effectiveServiceUrl ? " (service not configured)" : ""}
        </label>
      </fieldset>

      {showHandoff && (
        <fieldset className="mesh-fleet-identity-handoff">
          <legend>Carry this identity to another origin</legend>
          <p className="mesh-settings-help">
            Browsers don't share storage across domains. Paste the target origin (e.g. <code>https://codex.example.com</code>),
            generate a one-shot URL, and open it on that origin to import your fleet persona there.
            The URL contains your write-token — treat it like a password.
          </p>
          <label>
            <span>Target origin</span>
            <input
              value={targetOrigin}
              onChange={(e) => setTargetOrigin(e.target.value)}
              placeholder="https://your-other-domain.example.com"
            />
          </label>
          <div className="mesh-settings-actions">
            <button
              type="button"
              onClick={() => {
                if (!/^https?:\/\//.test(targetOrigin)) return;
                setHandoff(fp.buildHandoffUrl(targetOrigin));
              }}
            >
              Generate handoff URL
            </button>
            {handoff ? (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(handoff);
                }}
              >
                Copy
              </button>
            ) : null}
          </div>
          {handoff ? (
            <pre className="mesh-fleet-identity-handoff-url" aria-label="Handoff URL">
              {handoff}
            </pre>
          ) : null}
        </fieldset>
      )}

      <div className="mesh-settings-actions">
        <button type="button" onClick={fp.forgetLocal}>
          Reset persona for this app
        </button>
        <button
          type="button"
          onClick={() => {
            void fp.forgetEverywhere();
          }}
        >
          Forget me everywhere
        </button>
      </div>

      <p className="mesh-settings-help">
        Source of current persona: <code>{fp.source}</code>
        {fp.hasRemoteCredentials ? " · remote credentials present" : " · local only"}
        {fp.loading ? " · fetching…" : ""}
      </p>
    </section>
  );
}
