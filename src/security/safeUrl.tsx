import { safeText } from "./safeText";
import type { ReactNode } from "react";

/**
 * Scheme allowlist + tabnabbing-safe `<a>` rendering. Rejects
 * `javascript:`/`data:`/`vbscript:` and any other scheme not on the list.
 *
 *   const safe = safeUrl(userProvidedUrl);
 *   <SafeLink href={userUrl}>open</SafeLink>
 */

const DEFAULT_SCHEMES = new Set(["http:", "https:", "mailto:", "mesh:", "tel:"]);

export type SafeUrlOptions = {
  /** Allowed URL schemes. Default: http, https, mailto, mesh, tel. */
  allowSchemes?: Iterable<string>;
  /** Maximum URL length. Defaults to 8 KB (RFC sanity). */
  maxLength?: number;
};

/**
 * Validate + normalize a URL. Returns the URL string if safe, `null` if not.
 * Never throws.
 */
export function safeUrl(input: unknown, opts: SafeUrlOptions = {}): string | null {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const maxLen = opts.maxLength ?? 8192;
  if (raw.length > maxLen) return null;
  const allowed = new Set<string>(opts.allowSchemes ?? DEFAULT_SCHEMES);
  try {
    const u = new URL(raw, typeof window !== "undefined" ? window.location.href : undefined);
    if (!allowed.has(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export type SafeLinkProps = {
  href: unknown;
  children?: ReactNode;
  className?: string;
  /** Show this when the URL is rejected. Default: render plain text. */
  fallback?: ReactNode;
  /** Override target. External links default to `_blank` with safe rel. */
  target?: "_self" | "_blank";
  /** Allow opener access (default false — adds rel=noopener noreferrer). */
  unsafeAllowOpener?: boolean;
} & SafeUrlOptions;

export function SafeLink({
  href,
  children,
  className,
  fallback,
  target,
  unsafeAllowOpener,
  ...urlOpts
}: SafeLinkProps) {
  const safe = safeUrl(href, urlOpts);
  if (!safe) {
    return <>{fallback ?? safeText(href, { maxLength: 80 })}</>;
  }
  const isExternal = /^https?:/.test(safe);
  const finalTarget = target ?? (isExternal ? "_blank" : undefined);
  const rel = unsafeAllowOpener ? undefined : "noopener noreferrer";
  return (
    <a href={safe} className={className} target={finalTarget} rel={rel}>
      {children ?? safe}
    </a>
  );
}
