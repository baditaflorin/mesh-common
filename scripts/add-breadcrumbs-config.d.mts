// Types for add-breadcrumbs-config.mjs, so tests that import the codemod
// type-check under `tsc --noEmit`.

/** `nextText` is set when status is "add"; `reason` otherwise. */
export type BreadcrumbConfigPlan = {
  status: "add" | "already" | "skip";
  nextText?: string;
  reason?: string;
};

export function planBreadcrumbConfig(
  sourceText: string,
  fileName?: string,
): BreadcrumbConfigPlan;

export function findConfigPath(appDirectory: string): string;

export function migrateBreadcrumbConfig(
  appDirectory: string,
  options?: { write?: boolean; check?: boolean },
): BreadcrumbConfigPlan & { configPath: string };
