import { useCallback, useEffect, useRef, useState } from "react";

export type MeshPermissionState = PermissionState | "unknown" | "unsupported";
export type PermissionRequest = () => Promise<PermissionState | boolean | void>;

export type PermissionApi = {
  supported: boolean;
  state: MeshPermissionState;
  error: Error | null;
  /** Re-query the browser without prompting. */
  refresh: () => Promise<MeshPermissionState>;
  /** Invoke the app-provided, gesture-bound permission request then refresh. */
  request: () => Promise<boolean>;
};

function asError(reason: unknown, fallback: string): Error {
  return reason instanceof Error
    ? reason
    : new Error(typeof reason === "string" ? reason : fallback);
}

/**
 * Observe a browser permission and bridge its user-gesture-only request flow.
 *
 * The Permissions API can inspect a grant but cannot generically prompt. Pass
 * a `request` callback that invokes the relevant browser API from a button
 * click (for example `getUserMedia` for camera/microphone). This hook never
 * prompts on mount and never claims a grant that the browser did not report.
 */
export function usePermission(
  name: PermissionName,
  requestPermission?: PermissionRequest,
): PermissionApi {
  const querySupported =
    typeof navigator !== "undefined" &&
    typeof navigator.permissions?.query === "function";
  const canRequest = Boolean(requestPermission);
  // Safari and many embedded browsers deliberately omit `navigator.permissions`
  // for motion/camera, while the gesture-bound capability request still works.
  // Reporting that as unsupported would hide the only useful Enable button.
  const supported = querySupported || canRequest;
  const [state, setState] = useState<MeshPermissionState>(
    supported ? "unknown" : "unsupported",
  );
  const [error, setError] = useState<Error | null>(null);
  const statusRef = useRef<PermissionStatus | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async (): Promise<MeshPermissionState> => {
    if (!querySupported) {
      // A capability-specific request callback is still a supported fallback
      // even though this browser cannot report its permission state.
      if (canRequest) {
        if (mounted.current) setState("unknown");
        return "unknown";
      }
      if (mounted.current) setState("unsupported");
      return "unsupported";
    }
    try {
      const status = await navigator.permissions.query({
        name,
      } as PermissionDescriptor);
      statusRef.current = status;
      status.onchange = () => {
        if (mounted.current) setState(status.state);
      };
      if (mounted.current) {
        setState(status.state);
        setError(null);
      }
      return status.state;
    } catch (reason) {
      if (mounted.current) {
        setState("unknown");
        setError(asError(reason, "Permission status could not be read"));
      }
      return "unknown";
    }
  }, [canRequest, name, querySupported]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
      if (statusRef.current) statusRef.current.onchange = null;
      statusRef.current = null;
    };
  }, [refresh]);

  const request = useCallback(async () => {
    if (!requestPermission) {
      if (mounted.current)
        setError(new Error("No permission request callback was provided"));
      return false;
    }
    try {
      setError(null);
      const result = await requestPermission();
      const observed = await refresh();
      if (result === "denied" || observed === "denied") return false;
      if (result === "granted" || result === true || observed === "granted") {
        // A browser may expose Permissions API yet reject this particular
        // descriptor (notably Safari camera/motion). A successful explicit
        // request is then the strongest truthful signal we have.
        if (mounted.current) {
          if (observed !== "granted") setState("granted");
          setError(null);
        }
        return true;
      }
      return false;
    } catch (reason) {
      if (mounted.current)
        setError(asError(reason, "Permission request failed"));
      return false;
    }
  }, [refresh, requestPermission]);

  return { supported, state, error, refresh, request };
}
