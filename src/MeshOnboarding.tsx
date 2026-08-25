import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export const MESH_ONBOARDING_STEPS = [
  "identity",
  "join",
  "permissions",
  "privacy",
  "start",
] as const;
export type MeshOnboardingStep = (typeof MESH_ONBOARDING_STEPS)[number];

export type MeshOnboardingStepDefinition = {
  title?: string;
  description?: ReactNode;
  content?: ReactNode;
  /** Set false until this step's app-owned inputs are valid/acknowledged. */
  complete?: boolean;
  nextLabel?: string;
};

export type MeshOnboardingController = {
  step: MeshOnboardingStep;
  stepIndex: number;
  canGoBack: boolean;
  canContinue: boolean;
  isFinalStep: boolean;
  goTo: (step: MeshOnboardingStep) => boolean;
  back: () => boolean;
  next: () => boolean;
};

export type UseMeshOnboardingOptions = {
  /** Controlled active step. */
  step?: MeshOnboardingStep;
  initialStep?: MeshOnboardingStep;
  /** Per-step validation/acknowledgement. Omitted steps are considered complete. */
  completed?: Partial<Record<MeshOnboardingStep, boolean>>;
  onStepChange?: (step: MeshOnboardingStep) => void;
};

export type MeshOnboardingProps = UseMeshOnboardingOptions & {
  title?: string;
  steps?: Partial<Record<MeshOnboardingStep, MeshOnboardingStepDefinition>>;
  onComplete?: () => void | Promise<void>;
  className?: string;
};

const DEFAULT_COPY: Record<
  MeshOnboardingStep,
  Required<Pick<MeshOnboardingStepDefinition, "title" | "description">>
> = {
  identity: {
    title: "Choose your identity",
    description: "Pick the name this session will show to the room.",
  },
  join: {
    title: "Join a room",
    description: "Use an invite or room code before collaborating.",
  },
  permissions: {
    title: "Review permissions",
    description:
      "Only enable capabilities the feature needs, from an intentional browser gesture.",
  },
  privacy: {
    title: "Privacy check",
    description:
      "Confirm what is shared with the room and what remains on this browser.",
  },
  start: {
    title: "Ready to start",
    description: "Review the setup, then enter the shared experience.",
  },
};

function stepIndex(step: MeshOnboardingStep): number {
  return MESH_ONBOARDING_STEPS.indexOf(step);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.matches("input, textarea, select, [contenteditable='true']");
}

/**
 * Headless progression state for the consistent identity → room → permission
 * → privacy → start journey. It only governs navigation; apps retain their
 * own form values and browser permission requests.
 */
export function useMeshOnboarding(
  options: UseMeshOnboardingOptions = {},
): MeshOnboardingController {
  const initial =
    options.initialStep && stepIndex(options.initialStep) >= 0
      ? options.initialStep
      : "identity";
  const [internalStep, setInternalStep] = useState<MeshOnboardingStep>(initial);
  const step =
    options.step && stepIndex(options.step) >= 0 ? options.step : internalStep;
  const currentIndex = stepIndex(step);
  const completed = options.completed ?? {};
  const canUseIndex = useCallback(
    (targetIndex: number) => {
      if (targetIndex < 0 || targetIndex >= MESH_ONBOARDING_STEPS.length)
        return false;
      // Do not let a progress marker skip over an incomplete prerequisite.
      return MESH_ONBOARDING_STEPS.slice(0, targetIndex).every(
        (candidate) => completed[candidate] !== false,
      );
    },
    [completed],
  );
  const goTo = useCallback(
    (nextStep: MeshOnboardingStep) => {
      const target = stepIndex(nextStep);
      if (!canUseIndex(target)) return false;
      if (options.step === undefined) setInternalStep(nextStep);
      if (nextStep !== step) options.onStepChange?.(nextStep);
      return true;
    },
    [canUseIndex, options, step],
  );
  const canContinue = completed[step] !== false;

  return useMemo(
    () => ({
      step,
      stepIndex: currentIndex,
      canGoBack: currentIndex > 0,
      canContinue,
      isFinalStep: currentIndex === MESH_ONBOARDING_STEPS.length - 1,
      goTo,
      back: () =>
        currentIndex > 0 && goTo(MESH_ONBOARDING_STEPS[currentIndex - 1]!),
      next: () =>
        canContinue &&
        currentIndex < MESH_ONBOARDING_STEPS.length - 1 &&
        goTo(MESH_ONBOARDING_STEPS[currentIndex + 1]!),
    }),
    [canContinue, currentIndex, goTo, step],
  );
}

/**
 * Accessible, mobile-friendly shell for a common mesh onboarding sequence.
 * It intentionally has no permission implementation or persistence of its
 * own: each app supplies content and marks steps incomplete until valid.
 */
export function MeshOnboarding({
  title = "Set up this shared space",
  steps,
  onComplete,
  className,
  ...controllerOptions
}: MeshOnboardingProps) {
  // Let a self-contained step declare its own prerequisite while preserving
  // an explicit `completed` map as the higher-priority app-owned override.
  const completed = useMemo<Partial<Record<MeshOnboardingStep, boolean>>>(
    () =>
      Object.fromEntries(
        MESH_ONBOARDING_STEPS.map((step) => [
          step,
          controllerOptions.completed?.[step] ?? steps?.[step]?.complete,
        ]),
      ) as Partial<Record<MeshOnboardingStep, boolean>>,
    [controllerOptions.completed, steps],
  );
  const onboardingOptions = useMemo<UseMeshOnboardingOptions>(
    () => ({
      step: controllerOptions.step,
      initialStep: controllerOptions.initialStep,
      completed,
      onStepChange: controllerOptions.onStepChange,
    }),
    [
      completed,
      controllerOptions.initialStep,
      controllerOptions.onStepChange,
      controllerOptions.step,
    ],
  );
  const controller = useMeshOnboarding(onboardingOptions);
  const headingId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLElement | null>(null);
  const previousStep = useRef(controller.step);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const definition = steps?.[controller.step] ?? {};
  const copy = DEFAULT_COPY[controller.step];
  const heading = definition.title ?? copy.title;
  const description = definition.description ?? copy.description;

  useEffect(() => {
    if (previousStep.current !== controller.step) {
      previousStep.current = controller.step;
      panelRef.current?.focus();
    }
  }, [controller.step]);

  const continueFlow = useCallback(async () => {
    if (!controller.canContinue || submitting) return;
    setError(null);
    if (!controller.isFinalStep) {
      controller.next();
      return;
    }
    if (!onComplete) return;
    try {
      setSubmitting(true);
      await onComplete();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Setup could not be completed. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [controller, onComplete, submitting]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      isEditableTarget(event.target)
    )
      return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      controller.back();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      if (controller.canContinue) controller.next();
    } else if (event.key === "Home") {
      event.preventDefault();
      controller.goTo("identity");
    } else if (event.key === "End" && controller.canContinue) {
      event.preventDefault();
      const finalIndex = MESH_ONBOARDING_STEPS.length - 1;
      if (
        MESH_ONBOARDING_STEPS.slice(0, finalIndex).every(
          (step) => completed[step] !== false,
        )
      ) {
        controller.goTo("start");
      }
    }
  };

  return (
    <section
      className={`mesh-onboarding ${className ?? ""}`.trim()}
      aria-labelledby={headingId}
      onKeyDown={onKeyDown}
      data-mesh-onboarding-step={controller.step}
    >
      <h1 id={headingId}>{title}</h1>
      <nav aria-label="Setup progress">
        <ol>
          {MESH_ONBOARDING_STEPS.map((step, index) => {
            const current = step === controller.step;
            const blocked = !MESH_ONBOARDING_STEPS.slice(0, index).every(
              (candidate) => completed[candidate] !== false,
            );
            return (
              <li key={step} aria-current={current ? "step" : undefined}>
                <button
                  type="button"
                  onClick={() => controller.goTo(step)}
                  disabled={blocked}
                  aria-label={`${index + 1}. ${steps?.[step]?.title ?? DEFAULT_COPY[step].title}${current ? ", current step" : ""}`}
                >
                  {index + 1}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      <section ref={panelRef} tabIndex={-1} aria-labelledby={descriptionId}>
        <h2 id={descriptionId}>{heading}</h2>
        <p>{description}</p>
        {definition.content}
      </section>
      {!controller.canContinue && (
        <p role="alert">Complete this step before continuing.</p>
      )}
      {error && <p role="alert">{error}</p>}
      <footer>
        <button
          type="button"
          onClick={() => controller.back()}
          disabled={!controller.canGoBack || submitting}
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => void continueFlow()}
          disabled={!controller.canContinue || submitting}
        >
          {submitting
            ? "Starting…"
            : controller.isFinalStep
              ? (definition.nextLabel ?? "Start")
              : (definition.nextLabel ?? "Continue")}
        </button>
      </footer>
    </section>
  );
}
