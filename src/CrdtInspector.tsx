import { useEffect, useMemo, useState, type CSSProperties, type ReactElement } from "react";
import * as Y from "yjs";
import type { YRoom } from "./useYRoom";

/**
 * Dev-only overlay for staring at a Y.Doc. Gated on `?inspect=1` (or the
 * `enabled` prop). Shows:
 *
 *   - top-level shared types (maps, arrays, text)
 *   - per-type size + (for maps) a folded key list
 *   - update bytes/sec rolling counter
 *   - peer count + your peerId
 *
 * Drop into MeshShell or App.tsx; renders nothing when disabled. Keep this
 * out of production paths (don't unconditionally include it) — it observes
 * every Y.Doc update, which is non-zero overhead.
 *
 *   <CrdtInspector room={room} />        // auto-gates on ?inspect=1
 *   <CrdtInspector room={room} enabled /> // force-on
 */

export type CrdtInspectorProps = {
  room: YRoom | null;
  /** Force-on (skips ?inspect=1 check). */
  enabled?: boolean;
  /** Stop refreshing the panel after each update — useful for screenshots. */
  paused?: boolean;
};

function queryParamSet(name: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).has(name);
  } catch {
    return false;
  }
}

function describeShared(value: unknown): { kind: string; size: number; preview: string } {
  if (value instanceof Y.Map) {
    const keys = Array.from(value.keys());
    return { kind: "Y.Map", size: keys.length, preview: keys.slice(0, 6).join(", ") };
  }
  if (value instanceof Y.Array) {
    return { kind: "Y.Array", size: value.length, preview: `len ${value.length}` };
  }
  if (value instanceof Y.Text) {
    return { kind: "Y.Text", size: value.length, preview: value.toString().slice(0, 40) };
  }
  if (value instanceof Y.XmlFragment) {
    return { kind: "Y.XmlFragment", size: value.length, preview: "" };
  }
  return { kind: typeof value, size: 0, preview: String(value) };
}

export function CrdtInspector({ room, enabled, paused }: CrdtInspectorProps): ReactElement | null {
  const active = enabled ?? queryParamSet("inspect");
  const [, setTick] = useState(0);
  const [bytesPerSec, setBytesPerSec] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!active || !room || paused) return;
    let bytesInWindow = 0;
    let windowStart = Date.now();

    const refresh = () => setTick((t) => t + 1);
    const onUpdate = (update: Uint8Array) => {
      bytesInWindow += update.byteLength;
      const now = Date.now();
      if (now - windowStart >= 1000) {
        setBytesPerSec(Math.round((bytesInWindow * 1000) / (now - windowStart)));
        bytesInWindow = 0;
        windowStart = now;
      }
      refresh();
    };
    room.doc.on("update", onUpdate);
    const heartbeat = setInterval(refresh, 1000);
    return () => {
      room.doc.off("update", onUpdate);
      clearInterval(heartbeat);
    };
  }, [active, room, paused]);

  const sharedTypes = useMemo(() => {
    if (!active || !room) return [] as Array<{ name: string; kind: string; size: number; preview: string }>;
    const out: Array<{ name: string; kind: string; size: number; preview: string }> = [];
    // Y.Doc.share is an internal Map<string, AbstractType<any>> — readable for dev tools.
    const share = (room.doc as unknown as { share: Map<string, unknown> }).share;
    for (const [name, val] of share.entries()) {
      const d = describeShared(val);
      out.push({ name, ...d });
    }
    out.sort((a, b) => (a.name < b.name ? -1 : 1));
    return out;
  }, [active, room]);

  if (!active) return null;

  const panelStyle: CSSProperties = {
    position: "fixed",
    bottom: 12,
    right: 12,
    background: "rgba(20, 22, 28, 0.94)",
    color: "#f0f0f0",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 11,
    lineHeight: 1.45,
    padding: collapsed ? "6px 10px" : "8px 12px 10px",
    borderRadius: 6,
    border: "1px solid #444",
    minWidth: collapsed ? "auto" : 240,
    maxWidth: 360,
    zIndex: 99_999,
    boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
  };

  if (collapsed) {
    return (
      <button type="button" style={{ ...panelStyle, cursor: "pointer" }} onClick={() => setCollapsed(false)}>
        Y · {bytesPerSec} B/s
      </button>
    );
  }

  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <strong>CRDT inspector</strong>
        <button
          type="button"
          style={{ background: "transparent", color: "#bbb", border: "none", cursor: "pointer", fontSize: 13 }}
          onClick={() => setCollapsed(true)}
          aria-label="collapse"
        >
          —
        </button>
      </div>
      <div>peers: {room ? room.peerCount : "—"}</div>
      <div>me: <code>{room?.peerId.slice(0, 8) ?? "—"}</code></div>
      <div>updates: {bytesPerSec} B/s</div>
      <hr style={{ borderColor: "#333", margin: "6px 0" }} />
      {sharedTypes.length === 0 ? (
        <div style={{ opacity: 0.6 }}>(no shared types yet)</div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {sharedTypes.map((s) => (
            <li key={s.name} style={{ padding: "1px 0" }}>
              <span style={{ color: "#7fbfff" }}>{s.kind}</span>{" "}
              <strong>{s.name}</strong> · {s.size}
              {s.preview && <div style={{ opacity: 0.7, fontSize: 10, marginLeft: 8 }}>{s.preview}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
