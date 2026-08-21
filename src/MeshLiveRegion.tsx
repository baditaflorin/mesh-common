import { useEffect, useState } from "react";
export function MeshLiveRegion({ message, politeness = "polite", delayMs = 80 }: { message: string; politeness?: "polite" | "assertive"; delayMs?: number }) {
  const [announced, setAnnounced] = useState("");
  useEffect(() => { const id = setTimeout(() => setAnnounced(message), delayMs); return () => clearTimeout(id); }, [message, delayMs]);
  return <span className="mesh-live-region" aria-live={politeness} aria-atomic="true">{announced}</span>;
}
