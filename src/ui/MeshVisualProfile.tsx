import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import type { MeshVisualProfileName } from "../MeshConfig";
import { meshThemeVariables, type MeshThemeTokens } from "./MeshThemeProvider";

/**
 * Re-export the canonical application visual-profile union for UI-only
 * consumers. The source of truth remains `MeshConfig`.
 */
export type { MeshVisualProfileName as MeshVisualProfile } from "../MeshConfig";

/**
 * Named, intentionally small art-direction starting points for Mesh apps.
 *
 * A profile only supplies semantic CSS variables. It does not add layout,
 * decorative elements, document-level state, or interaction; existing apps
 * remain unchanged until they explicitly mount `MeshVisualProfileProvider`.
 */
export const MESH_VISUAL_PROFILES = [
  "utility",
  "play",
  "studio",
  "gather",
  "field",
] as const satisfies readonly MeshVisualProfileName[];

export type MeshVisualProfileDefinition = Readonly<{
  /** Fully-resolved semantic tokens, compatible with MeshThemeProvider. */
  tokens: Readonly<MeshThemeTokens>;
}>;

const fontSans =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const sharedGeometry = {
  radiusSm: "0.5rem",
  radiusMd: "0.875rem",
  radiusLg: "1.25rem",
  spaceXs: "0.25rem",
  spaceSm: "0.5rem",
  spaceMd: "1rem",
  spaceLg: "1.5rem",
  fontSans,
} as const;

/**
 * Profile definitions are data, rather than a global theme switch. This lets
 * a later app shell, catalog, or feature opt in without changing legacy
 * rendering or nesting another context provider.
 */
export const meshVisualProfiles = {
  utility: {
    tokens: {
      ...sharedGeometry,
      canvas: "#10151d",
      surface: "#171d26",
      surfaceRaised: "#202936",
      text: "#f1f5f9",
      textMuted: "#9aa7b9",
      border: "#344254",
      accent: "#7ea5ff",
      accentText: "#0c1118",
      success: "#65c997",
      warning: "#e6b65f",
      danger: "#f08c99",
      focusRing: "#b8caff",
      shadow: "0 18px 44px rgb(0 0 0 / 32%)",
    },
  },
  play: {
    tokens: {
      ...sharedGeometry,
      canvas: "#0f1220",
      surface: "#181d31",
      surfaceRaised: "#212843",
      text: "#f7f4ed",
      textMuted: "#b5bdd2",
      border: "#38415e",
      accent: "#f5b942",
      accentText: "#24180a",
      success: "#65d99c",
      warning: "#f5b942",
      danger: "#ff8989",
      focusRing: "#ffe2a1",
      shadow: "0 18px 44px rgb(0 0 0 / 38%)",
    },
  },
  studio: {
    tokens: {
      ...sharedGeometry,
      canvas: "#15111b",
      surface: "#211829",
      surfaceRaised: "#2b2036",
      text: "#faf4e9",
      textMuted: "#c8bacd",
      border: "#4b3b57",
      accent: "#d8b4fe",
      accentText: "#251633",
      success: "#7cddb0",
      warning: "#f2bf67",
      danger: "#ff969d",
      focusRing: "#e7d1ff",
      shadow: "0 20px 50px rgb(0 0 0 / 42%)",
    },
  },
  gather: {
    tokens: {
      ...sharedGeometry,
      canvas: "#071b25",
      surface: "#0d2a35",
      surfaceRaised: "#143541",
      text: "#f3fbfa",
      textMuted: "#afc8c8",
      border: "#31545d",
      accent: "#92f0e2",
      accentText: "#06232a",
      success: "#8be8c4",
      warning: "#ffd183",
      danger: "#ff9b9b",
      focusRing: "#baf9f0",
      shadow: "0 18px 44px rgb(0 12 17 / 40%)",
    },
  },
  field: {
    tokens: {
      ...sharedGeometry,
      canvas: "#15170e",
      surface: "#202116",
      surfaceRaised: "#292c1d",
      text: "#f6f1dc",
      textMuted: "#bdb9a1",
      border: "#4c5038",
      accent: "#e6bd52",
      accentText: "#251d08",
      success: "#92d7a1",
      warning: "#f0c86c",
      danger: "#ff9d8d",
      focusRing: "#ffe3a2",
      shadow: "0 18px 44px rgb(0 0 0 / 38%)",
    },
  },
} as const satisfies Readonly<
  Record<MeshVisualProfileName, MeshVisualProfileDefinition>
>;

/** Returns true for the stable profile names accepted by this primitive. */
export function isMeshVisualProfile(
  value: unknown,
): value is MeshVisualProfileName {
  return (
    typeof value === "string" &&
    (MESH_VISUAL_PROFILES as readonly string[]).includes(value)
  );
}

/** Returns the immutable semantic tokens for one visual profile. */
export function getMeshVisualProfileTokens(
  profile: MeshVisualProfileName,
): Readonly<MeshThemeTokens> {
  return meshVisualProfiles[profile].tokens;
}

/**
 * Converts a visual profile into scoped CSS custom properties such as
 * `--mesh-canvas` and `--mesh-accent`. It is useful to hosts that already own
 * their wrapper element and do not need the companion provider component.
 */
export function meshVisualProfileVariables(
  profile: MeshVisualProfileName,
): CSSProperties {
  return meshThemeVariables(getMeshVisualProfileTokens(profile));
}

export type MeshVisualProfileProviderProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "style"
> & {
  profile: MeshVisualProfileName;
  children: ReactNode;
  /** Explicit caller styles win over profile variables. */
  style?: CSSProperties;
};

/**
 * An opt-in, scoped variable provider for future app shells and features.
 *
 * It has no role, interaction, or built-in visual treatment. The wrapper is a
 * plain `div` so it remains semantically neutral while giving descendants a
 * stable `data-mesh-visual-profile` hook for later CSS.
 */
export function MeshVisualProfileProvider({
  profile,
  children,
  className,
  style,
  ...props
}: MeshVisualProfileProviderProps) {
  const classes = [
    "mesh-visual-profile",
    `mesh-visual-profile--${profile}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      {...props}
      className={classes}
      data-mesh-visual-profile={profile}
      style={{ ...meshVisualProfileVariables(profile), ...style }}
    >
      {children}
    </div>
  );
}
