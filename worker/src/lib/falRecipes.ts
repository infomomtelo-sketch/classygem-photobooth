import { FAL_MODELS } from '../config/falModels';

export const FAL_FACE_MODEL = FAL_MODELS.faceCandidates;
export const FAL_LORA_MODEL = FAL_MODELS.loraTraining;
export const FAL_STILLS_MODEL = FAL_MODELS.stillsWithLora;
export const FAL_UPSCALE_MODEL = FAL_MODELS.upscaler;
export const FAL_VIDEO_MODEL = FAL_MODELS.imageToVideo;

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

export interface AnimateInput {
  prompt: string;
  image_url: string;
  duration: string;
  aspect_ratio: string;
}

// Kling's fal.ai image-to-video endpoints commonly take duration as a
// string ("5" | "10") -- verify current field names (and whether
// aspect_ratio is even accepted alongside a fixed input image)
// against fal.ai's docs for the exact Kling version you're pinned to.
export function buildAnimateInput(prompt: string, imageUrl: string): AnimateInput {
  return {
    prompt,
    image_url: imageUrl,
    duration: '5',
    aspect_ratio: '9:16',
  };
}

export interface AnimateResult {
  video?: { url: string; content_type?: string };
  [key: string]: unknown;
}

export function extractVideoUrl(result: AnimateResult): { url: string; contentType?: string } | null {
  if (!result.video?.url) return null;
  return { url: result.video.url, contentType: result.video.content_type };
}
