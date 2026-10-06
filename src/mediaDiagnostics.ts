import { useEffect, useState } from "react";

export type MediaDiagnosticsSnapshot = {
  sampledAt: number;
  roundTripMs: number | null;
  inboundKbps: number | null;
  outboundKbps: number | null;
  packetsLost: number;
  jitterMs: number | null;
};

type StatsLike = {
  type?: string;
  id?: string;
  kind?: string;
  mediaType?: string;
  bytesReceived?: number;
  bytesSent?: number;
  packetsLost?: number;
  jitter?: number;
  currentRoundTripTime?: number;
  selectedCandidatePairId?: string;
  nominated?: boolean;
  state?: string;
  selected?: boolean;
};

export type MediaDiagnosticsOptions = {
  /** Poll interval in milliseconds. Values below 500 are clamped. Default: 2000. */
  intervalMs?: number;
};

export type MediaDiagnosticsState = {
  snapshot: MediaDiagnosticsSnapshot | null;
  supported: boolean;
  error: Error | null;
};

/** Polls a transport-owned peer connection; it never creates or closes it. */
export function useMediaDiagnostics(
  connection: RTCPeerConnection | null,
  options: MediaDiagnosticsOptions = {},
): MediaDiagnosticsState {
  const intervalMs = Math.max(500, options.intervalMs ?? 2000);
  const supported = typeof connection?.getStats === "function";
  const [snapshot, setSnapshot] = useState<MediaDiagnosticsSnapshot | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setSnapshot(null);
    setError(null);
    if (!connection || typeof connection.getStats !== "function") return;
    let disposed = false;
    let previous: { at: number; inbound: number; outbound: number } | null = null;
    const sample = async () => {
      try {
        const report = await connection.getStats();
        if (disposed) return;
        const sampledAt = Date.now();
        const next = summarizeMediaStats(report.values(), previous, sampledAt);
        const totals = [...report.values()].reduce(
          (sum, row) => {
            const stat = row as unknown as StatsLike;
            if (stat.type === "inbound-rtp" && stat.kind !== "data") sum.inbound += stat.bytesReceived ?? 0;
            if (stat.type === "outbound-rtp" && stat.kind !== "data") sum.outbound += stat.bytesSent ?? 0;
            return sum;
          },
          { inbound: 0, outbound: 0 },
        );
        previous = { at: sampledAt, ...totals };
        setSnapshot(next);
        setError(null);
      } catch (cause) {
        if (!disposed) setError(cause instanceof Error ? cause : new Error("WebRTC stats are unavailable."));
      }
    };
    void sample();
    const timer = setInterval(() => void sample(), intervalMs);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [connection, intervalMs]);

  return { snapshot, supported, error };
}

/** Summarizes the browser's WebRTC stats without exposing raw candidate details. */
export function summarizeMediaStats(
  report: Iterable<StatsLike>,
  previous: { at: number; inbound: number; outbound: number } | null = null,
  sampledAt = Date.now(),
): MediaDiagnosticsSnapshot {
  let inbound = 0;
  let outbound = 0;
  let packetsLost = 0;
  let jitter: number | null = null;
  let roundTrip: number | null = null;
  let selectedPair: string | undefined;
  const rows = [...report];
  for (const row of rows) {
    if (row.type === "transport" && row.selectedCandidatePairId) {
      selectedPair = row.selectedCandidatePairId;
    }
  }
  for (const row of rows) {
    if (row.type === "inbound-rtp" && row.kind !== "data") {
      inbound += row.bytesReceived ?? 0;
      packetsLost += Math.max(0, row.packetsLost ?? 0);
      if (typeof row.jitter === "number") jitter = Math.max(jitter ?? 0, row.jitter);
    }
    if (row.type === "outbound-rtp" && row.kind !== "data") {
      outbound += row.bytesSent ?? 0;
    }
    const isChosenPair =
      row.type === "candidate-pair" &&
      (selectedPair
        ? row.id === selectedPair
        : row.selected === true || (row.nominated === true && row.state === "succeeded"));
    if (isChosenPair && typeof row.currentRoundTripTime === "number") {
      roundTrip = Math.round(row.currentRoundTripTime * 1000);
    }
  }
  const elapsedSeconds = previous ? (sampledAt - previous.at) / 1000 : 0;
  return {
    sampledAt,
    roundTripMs: roundTrip,
    inboundKbps:
      previous && elapsedSeconds > 0
        ? Math.max(0, ((inbound - previous.inbound) * 8) / elapsedSeconds / 1000)
        : null,
    outboundKbps:
      previous && elapsedSeconds > 0
        ? Math.max(0, ((outbound - previous.outbound) * 8) / elapsedSeconds / 1000)
        : null,
    packetsLost,
    jitterMs: jitter === null ? null : Math.round(jitter * 1000),
  };
}
