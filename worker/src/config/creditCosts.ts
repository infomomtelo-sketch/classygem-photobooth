// Placeholder costs -- tune against real fal.ai per-call pricing once
// you have production numbers. Kept in one place so adjusting them
// never touches route logic.
export const CREDIT_COSTS = {
  face_candidates: 10,
  lora_training: 200,
  still_generation: 15,
  upscale: 10,
  video_generation: 150,
} as const;
