import type { PersonaRow } from '../types';

export function buildPersonaPrompt(persona: PersonaRow): string {
  const parts = [
    `portrait of a person, age ${persona.age_range}`,
    persona.hair ? `${persona.hair.toLowerCase()} hair` : null,
    persona.build ? `${persona.build.toLowerCase()} build` : null,
    persona.skin_tone ? `${persona.skin_tone.toLowerCase()} skin tone` : null,
    persona.style_vibe ? `${persona.style_vibe.toLowerCase()} style` : null,
    persona.free_text?.trim() || null,
    'professional fashion photography, studio lighting, sharp focus, high detail',
  ].filter((part): part is string => Boolean(part));
  return parts.join(', ');
}

export function buildStillPrompt(persona: PersonaRow, backgroundFragment: string, outfitPrompt: string): string {
  const parts = [
    buildPersonaPrompt(persona),
    `wearing ${outfitPrompt}`,
    backgroundFragment,
    'full body fashion photo, editorial photography, high detail, max resolution',
  ];
  return parts.join(', ');
}
