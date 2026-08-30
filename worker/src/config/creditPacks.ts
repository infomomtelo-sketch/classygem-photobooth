export interface CreditPack {
  id: string;
  label: string;
  credits: number;
  priceId: string;
  priceLabel: string;
}

// Illustrative pack sizes/pricing -- tune alongside CREDIT_COSTS once
// you have real fal.ai per-call costs. priceId must be a one-time
// Stripe Price (Dashboard: Products -> Add product -> One time),
// pasted in here; the placeholders below will fail Checkout creation
// until replaced with real price_... ids from your Stripe account.
export const CREDIT_PACKS: CreditPack[] = [
  { id: 'starter', label: 'Starter', credits: 500, priceId: 'price_1U9y60LhVu7TgJgMx42fS66e', priceLabel: '$9' },
  { id: 'creator', label: 'Creator', credits: 2000, priceId: 'price_REPLACE_ME_CREATOR', priceLabel: '$29' },
  { id: 'studio', label: 'Studio', credits: 6000, priceId: 'price_REPLACE_ME_STUDIO', priceLabel: '$79' },
];

export function getCreditPack(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}
