// Every prompt sent to fal.ai for a persona (face candidates, stills,
// upscale input, video motion) must be run through this first. It's
// the second half of "all personas render as adults" -- the first
// half is the age_range structured option plus the blocklist's minor
// pattern checks in moderateText.
export function buildSafePrompt(rawPrompt: string): { prompt: string; negativePrompt: string } {
  const adultQualifier = 'adult, aged 25 to 45, fully clothed unless outfit specified';
  return {
    prompt: `${rawPrompt}, ${adultQualifier}`,
    negativePrompt: 'child, minor, underage, teenager, nudity, nsfw, explicit',
  };
}
