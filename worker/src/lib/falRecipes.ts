import { FAL_MODELS } from '../config/falModels';

export const FAL_FACE_MODEL = FAL_MODELS.faceCandidates;
export const FAL_LORA_MODEL = FAL_MODELS.loraTraining;

export interface FaceCandidatesInput {
  prompt: string;
  negative_prompt: string;
  num_images: number;
  image_size: string;
}

// num_images: 8 matches the spec's "8 candidate faces" -- confirm
// your fal.ai plan/model actually allows a batch this size in one
// call; if not, split this into parallel single-image submits.
export function buildFaceCandidatesInput(prompt: string, negativePrompt: string): FaceCandidatesInput {
  return {
    prompt,
    negative_prompt: negativePrompt,
    num_images: 8,
    image_size: 'portrait_4_3',
  };
}

export interface FaceCandidatesResult {
  images: { url: string; content_type?: string }[];
}

export interface LoraTrainingInput {
  images_data_url: string[];
}

// Single-image training, per the spec ("train a FLUX LoRA on the
// chosen face"). Param name is best-effort for
// fal-ai/flux-lora-fast-training -- verify against fal.ai's docs.
export function buildLoraTrainingInput(imageUrl: string): LoraTrainingInput {
  return { images_data_url: [imageUrl] };
}

export interface LoraTrainingResult {
  diffusers_lora_file?: { url: string };
  [key: string]: unknown;
}

export function extractLoraWeightsUrl(result: LoraTrainingResult): string | null {
  return result.diffusers_lora_file?.url ?? null;
}
