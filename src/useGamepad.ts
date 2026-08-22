import { useEffect, useState } from "react";
export type GamepadState = { supported: boolean; connected: boolean; id: string | null; axes: number[]; pressed: boolean[] };
/** Read-only polling snapshot of the first connected gamepad; no input is shared automatically. */
export function useGamepad(): GamepadState {
  const supported = typeof navigator !== "undefined" && typeof navigator.getGamepads === "function";
  const [state, setState] = useState<GamepadState>({ supported, connected: false, id: null, axes: [], pressed: [] });
  useEffect(() => { if (!supported) return; let frame = 0; const poll = () => { const pad = Array.from(navigator.getGamepads()).find(Boolean); setState({ supported: true, connected: Boolean(pad), id: pad?.id ?? null, axes: pad ? [...pad.axes] : [], pressed: pad ? pad.buttons.map((button) => button.pressed) : [] }); frame = requestAnimationFrame(poll); }; poll(); return () => cancelAnimationFrame(frame); }, [supported]);
  return state;
}
