/** Lightweight class combiner for the presentation primitives. */
export function meshClassNames(
  ...values: Array<string | undefined | false>
): string {
  return values.filter(Boolean).join(" ");
}

/** Keeps visible peer/device counts honest when a caller passes bad input. */
export function meshNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}
