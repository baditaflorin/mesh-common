import { useEffect, useRef, useState, type ReactNode } from "react";
import { MeshLiveRegion } from "./MeshLiveRegion";
import type {
  ScheduledCueController,
  ScheduledCueState,
} from "./useScheduledCue";
import type { SharedTimer, SharedTimerStatus } from "./useSharedTimer";

/** Format a non-negative millisecond duration as m:ss or h:mm:ss. */
export function formatMeshDuration(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "—";
  const totalSeconds = Math.max(0, Math.ceil(value / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const minuteAndSecond = `${minutes.toString().padStart(hours > 0 ? 2 : 1, "0")}:${seconds.toString().padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${minuteAndSecond}` : minuteAndSecond;
}

export type MeshCountdownProps = {
  /** Result from `useSharedTimer`, or null while a room is loading. */
  timer: Pick<
    SharedTimer,
    "state" | "durationMs" | "elapsedMs" | "remainingMs"
  > | null;
  label?: string;
  className?: string;
  /**
   * Announces lifecycle transitions (start, pause, finish), never every visual
   * tick. Defaults to false so a timer cannot monopolize a screen reader.
   */
  announce?: boolean;
};

function timerMessage(timer: MeshCountdownProps["timer"]): string {
  if (!timer) return "Timer unavailable";
  const value = timer.remainingMs ?? timer.elapsedMs;
  switch (timer.state) {
    case "finished":
      return "Timer finished";
    case "paused":
      return `Timer paused at ${formatMeshDuration(value)}`;
    case "running":
      return `${timer.remainingMs === null ? "Elapsed" : "Remaining"} ${formatMeshDuration(value)}`;
    default:
      return `Timer ready: ${formatMeshDuration(value)}`;
  }
}

/**
 * Accessible display for a shared countdown or stopwatch. It only derives
 * presentation from `useSharedTimer`; it never writes ticking state itself.
 */
export function MeshCountdown({
  timer,
  label = "Shared timer",
  className,
  announce = false,
}: MeshCountdownProps) {
  const value = timer ? (timer.remainingMs ?? timer.elapsedMs) : null;
  const state: SharedTimerStatus | "unavailable" =
    timer?.state ?? "unavailable";
  const previousState = useRef(state);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const changed = previousState.current !== state;
    previousState.current = state;
    if (!announce) {
      setAnnouncement("");
      return;
    }
    if (changed) setAnnouncement(`${label}: ${timerMessage(timer)}`);
  }, [announce, label, state, timer]);

  return (
    <>
      <output
        className={`mesh-countdown ${className ?? ""}`.trim()}
        data-mesh-timer-state={state}
        aria-label={`${label}: ${timerMessage(timer)}`}
        aria-live="off"
      >
        <span className="mesh-countdown-label">{label}</span>
        <strong className="mesh-countdown-value">
          {formatMeshDuration(value)}
        </strong>
        <span className="mesh-countdown-state">
          {timer?.state ?? "unavailable"}
        </span>
      </output>
      {announce ? <MeshLiveRegion message={announcement} /> : null}
    </>
  );
}

export type MeshCueBannerProps<T> = {
  /** Result from `useScheduledCue`, or null while a room is loading. */
  controller: Pick<
    ScheduledCueController<T>,
    "cue" | "state" | "remainingMs" | "latenessMs" | "cancel" | "clear"
  > | null;
  title?: string;
  className?: string;
  renderPayload?: (payload: T) => ReactNode;
  /** Hide the default lifecycle action buttons. Defaults to false. */
  quietActions?: boolean;
};

export function meshCueMessage(
  state: ScheduledCueState | "unavailable",
  remainingMs: number | null,
  latenessMs: number | null,
): string {
  switch (state) {
    case "scheduled":
      return `Cue in ${formatMeshDuration(remainingMs)}`;
    case "due":
      return latenessMs && latenessMs > 0
        ? `Cue is live (${formatMeshDuration(latenessMs)} late)`
        : "Cue is live now";
    case "expired":
      return `Cue expired${latenessMs ? ` ${formatMeshDuration(latenessMs)} ago` : ""}`;
    case "cancelled":
      return "Cue cancelled";
    case "idle":
      return "No cue scheduled";
    default:
      return "Cue unavailable";
  }
}

/**
 * Lifecycle-aware cue presentation. `expired` means the cue is stale and is
 * never framed as an action the user should still perform; `due` surfaces
 * lateness so rehearsal and timing diagnostics stay honest.
 */
export function MeshCueBanner<T>({
  controller,
  title = "Shared cue",
  className,
  renderPayload,
  quietActions = false,
}: MeshCueBannerProps<T>) {
  const state: ScheduledCueState | "unavailable" =
    controller?.state ?? "unavailable";
  const message = meshCueMessage(
    state,
    controller?.remainingMs ?? null,
    controller?.latenessMs ?? null,
  );
  const shouldAlert = state === "due" || state === "expired";
  const terminal = state === "cancelled" || state === "expired";
  const cueId = controller?.cue?.id ?? null;
  const previousCue = useRef(`${state}:${cueId ?? ""}`);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const nextCue = `${state}:${cueId ?? ""}`;
    const changed = previousCue.current !== nextCue;
    previousCue.current = nextCue;
    if (changed) setAnnouncement(`${title}: ${message}`);
  }, [cueId, message, state, title]);

  return (
    <>
      <section
        className={`mesh-cue-banner mesh-cue-banner-${state} ${className ?? ""}`.trim()}
        data-mesh-cue-state={state}
        aria-label={title}
      >
        <strong>{title}</strong>
        <p>{message}</p>
        {controller?.cue && renderPayload && (
          <div className="mesh-cue-banner-payload">
            {renderPayload(controller.cue.payload)}
          </div>
        )}
        {!quietActions && controller && state === "scheduled" && (
          <button type="button" onClick={() => controller.cancel()}>
            Cancel cue
          </button>
        )}
        {!quietActions && controller && terminal && (
          <button type="button" onClick={() => controller.clear()}>
            Clear cue
          </button>
        )}
      </section>
      <MeshLiveRegion
        message={announcement}
        politeness={shouldAlert ? "assertive" : "polite"}
      />
    </>
  );
}
