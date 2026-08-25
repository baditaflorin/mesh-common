import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { meshAccentText } from "../MeshConfig";

export type MeshThemeMode = "light" | "dark" | "system";
export type MeshResolvedTheme = Exclude<MeshThemeMode, "system">;

/**
 * Semantic tokens rather than component-specific colours. Apps can override a
 * small set of meanings without making dialogs, forms, and status chrome use
 * unrelated palettes.
 */
export type MeshThemeTokens = {
  canvas: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  accentText: string;
  success: string;
  warning: string;
  danger: string;
  focusRing: string;
  shadow: string;
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  spaceXs: string;
  spaceSm: string;
  spaceMd: string;
  spaceLg: string;
  fontSans: string;
};

export const meshLightThemeTokens: Readonly<MeshThemeTokens> = {
  canvas: "#f7f8fb",
  surface: "#ffffff",
  surfaceRaised: "#ffffff",
  text: "#172033",
  textMuted: "#5f6b7d",
  border: "#d9e0ea",
  accent: "#2563eb",
  accentText: "#ffffff",
  success: "#15803d",
  warning: "#b45309",
  danger: "#b91c1c",
  focusRing: "#2563eb",
  shadow: "0 12px 32px rgb(23 32 51 / 14%)",
  radiusSm: "0.5rem",
  radiusMd: "0.75rem",
  radiusLg: "1.125rem",
  spaceXs: "0.25rem",
  spaceSm: "0.5rem",
  spaceMd: "1rem",
  spaceLg: "1.5rem",
  fontSans:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

export const meshDarkThemeTokens: Readonly<MeshThemeTokens> = {
  canvas: "#10151f",
  surface: "#18202d",
  surfaceRaised: "#202b3b",
  text: "#f4f7fb",
  textMuted: "#a9b5c7",
  border: "#344155",
  accent: "#7aa2ff",
  accentText: "#0e1726",
  success: "#5bd68a",
  warning: "#f5b85a",
  danger: "#ff8a8a",
  focusRing: "#a9c1ff",
  shadow: "0 16px 38px rgb(0 0 0 / 36%)",
  radiusSm: "0.5rem",
  radiusMd: "0.75rem",
  radiusLg: "1.125rem",
  spaceXs: "0.25rem",
  spaceSm: "0.5rem",
  spaceMd: "1rem",
  spaceLg: "1.5rem",
  fontSans:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

export type MeshThemeContextValue = {
  /** Requested mode; `system` follows the user's OS preference. */
  mode: MeshThemeMode;
  /** Actual palette currently in use. */
  resolvedTheme: MeshResolvedTheme;
  /** Switches the requested mode (controlled providers call onModeChange). */
  setMode: (mode: MeshThemeMode) => void;
  /** A convenience toggle between light and dark. */
  toggleTheme: () => void;
  /** Fully-resolved semantic token set. */
  tokens: Readonly<MeshThemeTokens>;
};

const MeshThemeContext = createContext<MeshThemeContextValue | null>(null);

function getSystemTheme(): MeshResolvedTheme {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(
  mode: MeshThemeMode,
  systemTheme: MeshResolvedTheme,
): MeshResolvedTheme {
  return mode === "system" ? systemTheme : mode;
}

function kebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** Converts a token set to CSS custom properties such as `--mesh-surface`. */
export function meshThemeVariables(
  tokens: Readonly<MeshThemeTokens>,
): CSSProperties {
  return Object.fromEntries(
    Object.entries(tokens).map(([name, value]) => [
      `--mesh-${kebabCase(name)}`,
      value,
    ]),
  ) as CSSProperties;
}

export type MeshThemeProviderProps = {
  children: ReactNode;
  /** Controlled requested mode. */
  mode?: MeshThemeMode;
  /** Initial requested mode for an uncontrolled provider. */
  defaultMode?: MeshThemeMode;
  onModeChange?: (mode: MeshThemeMode) => void;
  /** Partial semantic overrides applied on top of the resolved palette. */
  tokens?: Partial<MeshThemeTokens>;
  className?: string;
  /**
   * Mirrors the data attribute and variables to `<html>`, including Radix
   * portals. Set false for an intentionally scoped/nested preview.
   */
  applyToDocument?: boolean;
};

/**
 * Provides one light/dark/system source of truth and semantic CSS variables.
 * It is deliberately independent from an app's accent configuration: an app
 * may pass `{ accent: config.accentHex }` while retaining the common palette.
 */
export function MeshThemeProvider({
  children,
  mode,
  defaultMode = "system",
  onModeChange,
  tokens: tokenOverrides,
  className,
  applyToDocument = true,
}: MeshThemeProviderProps) {
  const [uncontrolledMode, setUncontrolledMode] =
    useState<MeshThemeMode>(defaultMode);
  const [systemTheme, setSystemTheme] =
    useState<MeshResolvedTheme>(getSystemTheme);
  const requestedMode = mode ?? uncontrolledMode;
  const resolvedTheme = resolveTheme(requestedMode, systemTheme);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    )
      return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemTheme(query.matches ? "dark" : "light");
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  const tokens = useMemo<Readonly<MeshThemeTokens>>(() => {
    const base =
      resolvedTheme === "dark" ? meshDarkThemeTokens : meshLightThemeTokens;
    const merged = { ...base, ...tokenOverrides };
    // App configs commonly supply only an accent. Derive a readable foreground
    // automatically unless a caller deliberately provides its own verified
    // accentText token.
    if (tokenOverrides?.accent && tokenOverrides.accentText === undefined) {
      merged.accentText = meshAccentText(
        tokenOverrides.accent,
        base.accentText,
      );
    }
    return merged;
  }, [resolvedTheme, tokenOverrides]);
  const variables = useMemo(() => meshThemeVariables(tokens), [tokens]);

  const setMode = useCallback(
    (nextMode: MeshThemeMode) => {
      if (mode === undefined) setUncontrolledMode(nextMode);
      onModeChange?.(nextMode);
    },
    [mode, onModeChange],
  );
  const toggleTheme = useCallback(() => {
    setMode(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setMode]);

  const value = useMemo<MeshThemeContextValue>(
    () => ({
      mode: requestedMode,
      resolvedTheme,
      setMode,
      toggleTheme,
      tokens,
    }),
    [requestedMode, resolvedTheme, setMode, toggleTheme, tokens],
  );

  useEffect(() => {
    if (!applyToDocument || typeof document === "undefined") return;
    const root = document.documentElement;
    const oldTheme = root.getAttribute("data-mesh-theme");
    const oldColorScheme = root.style.colorScheme;
    const oldVariables = Object.keys(tokens).map((name) => {
      const variable = `--mesh-${kebabCase(name)}`;
      return [variable, root.style.getPropertyValue(variable)] as const;
    });

    root.setAttribute("data-mesh-theme", resolvedTheme);
    root.style.colorScheme = resolvedTheme;
    for (const [name, token] of Object.entries(tokens)) {
      root.style.setProperty(`--mesh-${kebabCase(name)}`, token);
    }

    return () => {
      if (oldTheme === null) root.removeAttribute("data-mesh-theme");
      else root.setAttribute("data-mesh-theme", oldTheme);
      root.style.colorScheme = oldColorScheme;
      for (const [variable, oldValue] of oldVariables) {
        if (oldValue) root.style.setProperty(variable, oldValue);
        else root.style.removeProperty(variable);
      }
    };
  }, [applyToDocument, resolvedTheme, tokens]);

  return (
    <MeshThemeContext.Provider value={value}>
      <div
        className={`mesh-theme mesh-theme--${resolvedTheme} ${className ?? ""}`}
        data-mesh-theme={resolvedTheme}
        style={{ ...variables, colorScheme: resolvedTheme }}
      >
        {children}
      </div>
    </MeshThemeContext.Provider>
  );
}

/** Returns the nearest theme provider, or throws when the app forgot one. */
export function useMeshTheme(): MeshThemeContextValue {
  const context = useContext(MeshThemeContext);
  if (!context)
    throw new Error("useMeshTheme must be used inside MeshThemeProvider");
  return context;
}

/** Useful for primitives which work both inside and outside themed app chrome. */
export function useOptionalMeshTheme(): MeshThemeContextValue | null {
  return useContext(MeshThemeContext);
}
