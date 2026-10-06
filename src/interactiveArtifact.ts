import { z } from "zod";

const artifactId = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9-]{1,79}$/i, "Use a 2–80 character artifact id.");
const boundedText = (maximum: number) => z.string().trim().min(1).max(maximum);

export const InteractiveArtifactSchema = z
  .object({
    version: z.literal(1),
    id: artifactId,
    title: boundedText(120),
    locale: z.string().trim().min(2).max(35).default("en"),
    summary: boundedText(1_500),
    persona: z.object({
      name: boundedText(120),
      voice: z.object({
        language: z.string().trim().min(2).max(35),
        preferredVoice: z.string().trim().max(120).optional(),
        rate: z.number().finite().min(0.5).max(2).optional(),
        pitch: z.number().finite().min(0).max(2).optional(),
      }),
      tone: z.array(boundedText(80)).min(1).max(8),
      systemContext: boundedText(8_000),
      boundaries: z.array(boundedText(500)).max(24).default([]),
    }),
    knowledge: z.array(boundedText(2_000)).max(80).default([]),
    targets: z
      .array(
        z.object({
          kind: z.enum(["qr", "marker", "reference"]),
          value: boundedText(512),
        }),
      )
      .min(1)
      .max(24),
    assets: z
      .object({
        imageUrl: z.string().url().optional(),
        overlayUrl: z.string().url().optional(),
      })
      .default({}),
  })
  .strict();

/** A versioned, public-only manifest for an interactive artwork or installation. */
export type InteractiveArtifact = z.infer<typeof InteractiveArtifactSchema>;

/**
 * Validates a static, curator-owned manifest. It deliberately has no model
 * key, visitor identifier, or persisted conversation: applications inject
 * their own server-side conversation adapter.
 */
export function defineInteractiveArtifact(input: unknown): InteractiveArtifact {
  return InteractiveArtifactSchema.parse(input);
}

/** Non-throwing variant for manifest loaders and authoring previews. */
export function parseInteractiveArtifact(
  input: unknown,
):
  | { artifact: InteractiveArtifact; error: null }
  | { artifact: null; error: z.ZodError } {
  const result = InteractiveArtifactSchema.safeParse(input);
  return result.success
    ? { artifact: result.data, error: null }
    : { artifact: null, error: result.error };
}
