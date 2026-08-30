import Stripe from 'stripe';
import type { Env } from '../types';

// Deliberately not pinning `apiVersion` -- the installed stripe-node
// version's TypeScript types only accept its own bundled literal
// value, which isn't knowable in advance here. Once you've settled on
// a version, consider pinning it explicitly (see Stripe's docs) for
// long-term stability against future account-default changes; the
// SDK's bundled default is fine to start with.
export function getStripeClient(env: Env): Stripe {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

// Webhook signature verification needs a crypto provider that works
// in the Workers runtime (no Node crypto module available).
export function getStripeCryptoProvider() {
  return Stripe.createSubtleCryptoProvider();
}
