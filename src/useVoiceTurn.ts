import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceTurnStatus =
  "idle" | "thinking" | "speaking" | "complete" | "cancelled" | "error";
export type VoiceTurn = {
  role: "visitor" | "artifact";
  text: string;
  at: number;
};
export type VoiceTurnAdapter = {
  /** App-owned transport; keep model keys and provider policy server-side. */
  respond: (
    input: string,
    context: readonly VoiceTurn[],
    signal: AbortSignal,
  ) => Promise<string>;
  /** Optional client TTS integration, called only after a response is accepted. */
  speak?: (text: string, signal: AbortSignal) => Promise<void>;
};
export type VoiceTurnOptions = {
  adapter: VoiceTurnAdapter;
  maxTurns?: number;
  maxInputChars?: number;
  now?: () => number;
};
export type VoiceTurnApi = {
  status: VoiceTurnStatus;
  turns: readonly VoiceTurn[];
  response: string | null;
  error: Error | null;
  ask: (transcript: string) => Promise<boolean>;
  cancel: () => void;
  reset: () => void;
};

/**
 * Provider-neutral, abortable conversation-turn state machine. It has no
 * microphone, model key, analytics, or persistence; apps compose those parts
 * explicitly around this local session state.
 */
export function useVoiceTurn(options: VoiceTurnOptions): VoiceTurnApi {
  const {
    adapter,
    maxTurns = 12,
    maxInputChars = 1_200,
    now = Date.now,
  } = options;
  const [status, setStatus] = useState<VoiceTurnStatus>("idle");
  const [turns, setTurns] = useState<VoiceTurn[]>([]);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  const cancel = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    if (mounted.current) setStatus("cancelled");
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);

  const reset = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setTurns([]);
    setResponse(null);
    setError(null);
    setStatus("idle");
  }, []);

  const ask = useCallback(
    async (transcript: string): Promise<boolean> => {
      const input = transcript.trim();
      if (
        !input ||
        input.length > maxInputChars ||
        controller.current ||
        turns.length / 2 >= maxTurns
      )
        return false;
      const abort = new AbortController();
      controller.current = abort;
      const visitorTurn: VoiceTurn = {
        role: "visitor",
        text: input,
        at: now(),
      };
      const nextContext = [...turns, visitorTurn];
      setError(null);
      setResponse(null);
      setTurns(nextContext);
      setStatus("thinking");
      try {
        const text = (
          await adapter.respond(input, nextContext, abort.signal)
        ).trim();
        if (abort.signal.aborted || !text || text.length > 8_000) return false;
        const artifactTurn: VoiceTurn = { role: "artifact", text, at: now() };
        if (!mounted.current) return false;
        setTurns((current) => [...current, artifactTurn]);
        setResponse(text);
        if (adapter.speak) {
          setStatus("speaking");
          await adapter.speak(text, abort.signal);
          if (abort.signal.aborted || !mounted.current) return false;
        }
        setStatus("complete");
        return true;
      } catch (reason) {
        if (abort.signal.aborted) return false;
        if (mounted.current) {
          setError(
            reason instanceof Error
              ? reason
              : new Error("The artifact could not respond."),
          );
          setStatus("error");
        }
        return false;
      } finally {
        if (controller.current === abort) controller.current = null;
      }
    },
    [adapter, maxInputChars, maxTurns, now, turns],
  );

  return { status, turns, response, error, ask, cancel, reset };
}
