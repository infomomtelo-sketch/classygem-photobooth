// Model slugs on fal.ai's catalog -- verify these against your
// fal.ai dashboard before relying on them. Input schemas in
// worker/src/lib/falRecipes.ts are best-effort and may need
// adjusting to match the exact version you're pinned to.
export const FAL_MODELS = {
  faceCandidates: 'fal-ai/flux/dev',
  loraTraining: 'fal-ai/flux-lora-fast-training',
  stillsWithLora: 'fal-ai/flux-lora',
  upscaler: 'fal-ai/clarity-upscaler',
} as const;
