/**
 * A lightweight, DOM-level UX contract for mesh app tests. It does not add a
 * CI workflow or dictate visual design; applications call it from their own
 * Vitest/Playwright checks to keep shell, lifecycle, and a11y basics present.
 */

export type MeshAppLifecycleState =
  "loading" | "joining" | "connected" | "offline" | "error";

export type MeshUxViolationCode =
  | "missing-app-shell"
  | "missing-page-heading"
  | "missing-room-lifecycle"
  | "missing-lifecycle-coverage"
  | "missing-live-feedback"
  | "missing-empty-state"
  | "missing-mobile-safe-area-declaration"
  | "missing-reduced-motion-declaration"
  | "unnamed-control"
  | "image-without-alt"
  | "unlabelled-dialog";

export type MeshUxViolation = {
  code: MeshUxViolationCode;
  message: string;
  selector?: string;
};

export type MeshUxContractOptions = {
  /** The rendered application root, typically Testing Library's `container`. */
  root: ParentNode;
  /** Require one state marker for the rendered room lifecycle. */
  requiresRoomLifecycle?: boolean;
  /** Require a live-region/status channel for async feedback. */
  requiresLiveFeedback?: boolean;
  /** Require a semantic empty-state marker (`data-mesh-empty-state` or role=status). */
  requiresEmptyState?: boolean;
  /** Explicit test declaration; computed CSS cannot reliably reveal env() safe areas. */
  supportsMobileSafeArea?: boolean;
  /** Explicit test declaration; use it alongside a visual/reduced-motion test. */
  supportsReducedMotion?: boolean;
  /** State variants exercised by the app's own test suite. */
  lifecycleCoverage?: Partial<Record<MeshAppLifecycleState, boolean>>;
};

export type MeshUxContractResult = {
  valid: boolean;
  violations: MeshUxViolation[];
  /** Current marker in the rendered root, if provided. */
  lifecycleState: MeshAppLifecycleState | null;
};

const LIFECYCLE_STATES: readonly MeshAppLifecycleState[] = [
  "loading",
  "joining",
  "connected",
  "offline",
  "error",
];

function asElement(root: ParentNode): Element | null {
  return root.nodeType === 1 ? (root as Element) : null;
}

function matchesOrFind(root: ParentNode, selector: string): Element | null {
  const own = asElement(root);
  return own?.matches(selector) ? own : root.querySelector(selector);
}

function allMatches(root: ParentNode, selector: string): Element[] {
  const own = asElement(root);
  const descendants = Array.from(root.querySelectorAll(selector));
  return own?.matches(selector) ? [own, ...descendants] : descendants;
}

function selectorFor(element: Element): string {
  const testId = element.getAttribute("data-testid");
  if (testId) return `[data-testid="${testId}"]`;
  const id = element.getAttribute("id");
  if (id) return `#${id}`;
  return element.tagName.toLowerCase();
}

function escapeSelectorId(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  // Older WebViews may lack CSS.escape. The harness must not throw on an
  // app-provided id merely because it is not selector-safe.
  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function hasAccessibleName(element: Element, root: ParentNode): boolean {
  if (element.getAttribute("aria-label")?.trim()) return true;
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy?.trim()) {
    const ids = labelledBy.trim().split(/\s+/);
    if (
      ids.some((id) =>
        root.querySelector(`#${escapeSelectorId(id)}`)?.textContent?.trim(),
      )
    )
      return true;
  }
  if (element.textContent?.trim()) return true;
  const id = element.getAttribute("id");
  if (
    id &&
    root
      .querySelector(`label[for="${escapeSelectorId(id)}"]`)
      ?.textContent?.trim()
  )
    return true;
  if (element.closest("label")?.textContent?.trim()) return true;
  return Boolean(element.getAttribute("title")?.trim());
}

function lifecycleFrom(root: ParentNode): MeshAppLifecycleState | null {
  const marked = matchesOrFind(root, "[data-mesh-room-state]");
  const raw = marked?.getAttribute("data-mesh-room-state") ?? null;
  return LIFECYCLE_STATES.includes(raw as MeshAppLifecycleState)
    ? (raw as MeshAppLifecycleState)
    : null;
}

/** Evaluate a rendered app without throwing, so test suites can snapshot/report all gaps at once. */
export function evaluateMeshUxContract(
  options: MeshUxContractOptions,
): MeshUxContractResult {
  const violations: MeshUxViolation[] = [];
  const add = (
    code: MeshUxViolationCode,
    message: string,
    selector?: string,
  ) => {
    violations.push({ code, message, selector });
  };
  const { root } = options;
  const lifecycleState = lifecycleFrom(root);

  if (
    !matchesOrFind(root, "main[data-mesh-app-shell], [data-mesh-app-shell]")
  ) {
    add(
      "missing-app-shell",
      "Add a <main data-mesh-app-shell> around the app's primary experience.",
    );
  }
  if (!matchesOrFind(root, "h1")) {
    add(
      "missing-page-heading",
      "Expose one visible or screen-reader page heading (<h1>).",
    );
  }
  if (options.requiresRoomLifecycle && !lifecycleState) {
    add(
      "missing-room-lifecycle",
      "Mark the rendered room state with data-mesh-room-state.",
    );
  }
  if (options.lifecycleCoverage) {
    const missing = LIFECYCLE_STATES.filter(
      (state) => options.lifecycleCoverage?.[state] !== true,
    );
    if (missing.length) {
      add(
        "missing-lifecycle-coverage",
        `Exercise lifecycle states in app tests: ${missing.join(", ")}.`,
      );
    }
  }
  if (
    options.requiresLiveFeedback &&
    !matchesOrFind(root, "[role='status'], [role='alert'], [aria-live]")
  ) {
    add(
      "missing-live-feedback",
      "Add a polite status or alert live region for async room/permission feedback.",
    );
  }
  if (
    options.requiresEmptyState &&
    !matchesOrFind(root, "[data-mesh-empty-state], [role='status']")
  ) {
    add(
      "missing-empty-state",
      "Render an empty-state marker or semantic status for an empty collection.",
    );
  }
  if (options.supportsMobileSafeArea === false) {
    add(
      "missing-mobile-safe-area-declaration",
      "Declare and test mobile safe-area handling for fixed/bottom UI.",
    );
  }
  if (options.supportsReducedMotion === false) {
    add(
      "missing-reduced-motion-declaration",
      "Declare and test a reduced-motion path for animated UI.",
    );
  }

  allMatches(
    root,
    "button, a[href], input:not([type='hidden']), select, textarea",
  ).forEach((control) => {
    if (!hasAccessibleName(control, root)) {
      add(
        "unnamed-control",
        "Interactive controls need a visible label or accessible name.",
        selectorFor(control),
      );
    }
  });
  allMatches(root, "img").forEach((image) => {
    if (!image.hasAttribute("alt")) {
      add(
        "image-without-alt",
        "Images need an alt attribute (empty is valid for decorative images).",
        selectorFor(image),
      );
    }
  });
  allMatches(root, "[role='dialog'], [role='alertdialog']").forEach(
    (dialog) => {
      if (!hasAccessibleName(dialog, root)) {
        add(
          "unlabelled-dialog",
          "Dialogs need aria-label or aria-labelledby text.",
          selectorFor(dialog),
        );
      }
    },
  );

  return { valid: violations.length === 0, violations, lifecycleState };
}

export class MeshUxContractError extends Error {
  readonly result: MeshUxContractResult;

  constructor(result: MeshUxContractResult) {
    super(
      `Mesh UX contract failed:\n${result.violations.map((violation) => `- ${violation.code}: ${violation.message}`).join("\n")}`,
    );
    this.name = "MeshUxContractError";
    this.result = result;
  }
}

/** Throw a useful aggregate error when a fleet app misses the UX contract. */
export function assertMeshUxContract(
  options: MeshUxContractOptions,
): MeshUxContractResult {
  const result = evaluateMeshUxContract(options);
  if (!result.valid) throw new MeshUxContractError(result);
  return result;
}
