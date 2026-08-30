// Structured pick-list values for the model designer form. Served to
// the frontend via GET /options so the option set only lives here.
// Wording is easy to tune -- these aren't referenced by id anywhere.

export const AGE_RANGES = ['25-29', '30-34', '35-39', '40-45'] as const;
export const HAIR_OPTIONS = ['Black', 'Brunette', 'Blonde', 'Red', 'Silver/Gray'] as const;
export const BUILD_OPTIONS = ['Slim', 'Athletic', 'Curvy', 'Tall & Lean', 'Plus-size'] as const;
export const SKIN_TONE_OPTIONS = ['Fair', 'Light', 'Medium', 'Tan', 'Deep'] as const;
export const STYLE_VIBE_OPTIONS = ['Minimalist', 'Editorial', 'Streetwear', 'Glam', 'Bohemian', 'Classic'] as const;

export const PERSONA_OPTIONS = {
  ageRanges: AGE_RANGES,
  hair: HAIR_OPTIONS,
  build: BUILD_OPTIONS,
  skinTone: SKIN_TONE_OPTIONS,
  styleVibe: STYLE_VIBE_OPTIONS,
};
