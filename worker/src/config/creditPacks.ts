export interface CreditPack {
  id: string;
  label: string;
  credits: number;
  priceId: string;
  priceLabel: string;
}

// priceId values are live one-time Prices from the shared Stripe
// account (thejudgy.com). Pack sizes/pricing are still illustrative,
// though -- worth tuning alongside CREDIT_COSTS once you have real
// fal.ai per-call costs; update the Price in Stripe (Prices can't be
// edited in place, only archived + replaced) and swap the id here.
export const CREDIT_PACKS: CreditPack[] = [
  { id: 'starter', label: 'Starter', credits: 500, priceId: 'price_1U9y60LhVu7TgJgMx42fS66e', priceLabel: '$9' },
  { id: 'creator', label: 'Creator', credits: 2000, priceId: 'price_1U9y9cLhVu7TgJgMCPHdND10', priceLabel: '$29' },
  { id: 'studio', label: 'Studio', credits: 6000, priceId: 'price_1U9yB2LhVu7TgJgM3oAvOEHn', priceLabel: '$79' },
];

export function getCreditPack(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}
