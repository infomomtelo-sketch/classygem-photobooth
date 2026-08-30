import { FAL_MODELS } from '../config/falModels';

export const FAL_FACE_MODEL = FAL_MODELS.faceCandidates;
export const FAL_LORA_MODEL = FAL_MODELS.loraTraining;
export const FAL_STILLS_MODEL = FAL_MODELS.stillsWithLora;
export const FAL_UPSCALE_MODEL = FAL_MODELS.upscaler;

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

export interface StillsInput {
  prompt: string;
  negative_prompt: string;
  loras: { path: string; scale: number }[];
  num_images: number;
  image_size: { width: number; height: number };
}

// 1080x1920 (9:16) -- matches the vertical video output from Phase 4
// and is the resolution worth rendering before the upscale step, per
// the spec ("render 4 stills at max resolution"). `loras` is what
// keeps the face consistent with the locked identity.
export function buildStillsInput(prompt: string, negativePrompt: string, loraUrl: string): StillsInput {
  return {
    prompt,
    negative_prompt: negativePrompt,
    loras: [{ path: loraUrl, scale: 1 }],
    num_images: 4,
    image_size: { width: 1080, height: 1920 },
  };
}

export interface StillsResult {
  images: { url: string; content_type?: string }[];
}

export interface UpscaleInput {
  image_url: string;
}

export function buildUpscaleInput(imageUrl: string): UpscaleInput {
  return { image_url: imageUrl };
}

export interface UpscaleResult {
  image?: { url: string; content_type?: string };
  [key: string]: unknown;
}

export function extractUpscaledImage(result: UpscaleResult): { url: string; contentType?: string } | null {
  if (!result.image?.url) return null;
  return { url: result.image.url, contentType: result.image.content_type };
}
