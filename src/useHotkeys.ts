import { useEffect, useRef } from "react";

export type HotkeyHandler = (e: KeyboardEvent) => void;

/**
 * Map of key-combo → handler. Combos are case-insensitive and modifier-order
 * independent: `"space"`, `"enter"`, `"esc"`, `"a"`, `"ctrl+k"`, `"shift+?"`,
 * `"meta+enter"`. Aliases: `cmd`/`command`→meta, `option`→alt, `return`→enter,
 * `del`→delete, arrow keys → `up`/`down`/`left`/`right`.
 */
export type HotkeyMap = Record<string, HotkeyHandler>;

export type HotkeysOptions = {
  /** Turn the bindings off without unmounting. Default `true`. */
  enabled?: boolean;
  /** Don't fire while focus is in an input/textarea/select/contenteditable. Default `true`. */
  ignoreInputs?: boolean;
  /** Event target. Default `window`. */
  target?: Window | HTMLElement | null;
  /** `preventDefault()` on a matched key. Default `true`. */
  preventDefault?: boolean;
};

const KEY_ALIASES: Record<string, string> = {
  " ": "space",
  spacebar: "space",
  esc: "escape",
  del: "delete",
  return: "enter",
  arrowup: "up",
  arrowdown: "down",
  arrowleft: "left",
  arrowright: "right",
};

function comboFromEvent(e: KeyboardEvent): string {
  let k = (e.key || "").toLowerCase();
  k = KEY_ALIASES[k] ?? k;
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("ctrl");
  if (e.metaKey) parts.push("meta");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey && k !== "shift") parts.push("shift");
  parts.push(k);
  return parts.join("+");
}

function normalizeBinding(binding: string): string {
  const mods = new Set<string>();
  let base = "";
  for (const raw of binding.toLowerCase().split("+")) {
    const p = raw.trim();
    if (!p) continue;
    if (p === "ctrl" || p === "control") mods.add("ctrl");
    else if (p === "meta" || p === "cmd" || p === "command") mods.add("meta");
    else if (p === "alt" || p === "option") mods.add("alt");
    else if (p === "shift") mods.add("shift");
    else base = KEY_ALIASES[p] ?? p;
  }
  const ordered = ["ctrl", "meta", "alt", "shift"].filter((m) => mods.has(m));
  ordered.push(base);
  return ordered.join("+");
}

function isEditable(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  if (!node || typeof node.tagName !== "string") return false;
  const tag = node.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  return node.isContentEditable === true;
}

/**
 * Bind global (window-level) keyboard shortcuts with normalized combos, so an
 * app doesn't hand-roll its own `addEventListener("keydown")` + combo parsing.
 *
 *   useHotkeys({
 *     space: () => buzz(),
 *     "ctrl+enter": () => send(),
 *     escape: () => close(),
 *   });
 *
 * The handler map is read live, so passing a fresh object literal each render
 * does not re-subscribe. By default it skips events originating in form fields
 * so a spacebar shortcut never eats a space the user is typing — which is also
 * why this is NOT a fit for input-scoped `onKeyDown` Enter-to-submit handlers;
 * leave those on the element. No mesh-* app ships global shortcuts today, so
 * this is currently a forward-looking primitive.
 */
export function useHotkeys(map: HotkeyMap, options?: HotkeysOptions): void {
  const mapRef = useRef(map);
  mapRef.current = map;

  const enabled = options?.enabled ?? true;
  const ignoreInputs = options?.ignoreInputs ?? true;
  const preventDefault = options?.preventDefault ?? true;
  const target = options?.target;

  useEffect(() => {
    if (!enabled) return;
    const tgt: Window | HTMLElement | null =
      target ?? (typeof window !== "undefined" ? window : null);
    if (!tgt) return;

    const onKey = (ev: Event): void => {
      const e = ev as KeyboardEvent;
      if (ignoreInputs && isEditable(e.target)) return;
      const combo = comboFromEvent(e);
      const table = mapRef.current;
      for (const binding of Object.keys(table)) {
        if (normalizeBinding(binding) === combo) {
          if (preventDefault) e.preventDefault();
          table[binding]!(e);
          return;
        }
      }
    };

    tgt.addEventListener("keydown", onKey);
    return () => tgt.removeEventListener("keydown", onKey);
  }, [enabled, ignoreInputs, preventDefault, target]);
}
