import { Hono } from 'hono';
import { z } from 'zod';
import type Stripe from 'stripe';
import type { Env, Variables } from '../types';
import { requireAuth } from '../middleware/auth';
import { getNwlhsAdmin } from '../lib/supabaseAdmin';
import { CREDIT_PACKS, getCreditPack } from '../config/creditPacks';
import { getStripeClient, getStripeCryptoProvider } from '../lib/stripeClient';

export const billingRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

billingRoute.get('/credit-packs', (c) =>
  c.json({ creditPacks: CREDIT_PACKS.map(({ id, label, credits, priceLabel }) => ({ id, label, credits, priceLabel })) })
);

const checkoutSchema = z.object({ packId: z.string() });

billingRoute.post('/billing/checkout', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);

  const pack = getCreditPack(parsed.data.packId);
  if (!pack) return c.json({ error: 'Unknown credit pack' }, 400);

  const stripe = getStripeClient(c.env);
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: pack.priceId, quantity: 1 }],
      success_url: `${c.env.APP_ORIGIN}/?checkout=success`,
      cancel_url: `${c.env.APP_ORIGIN}/?checkout=cancelled`,
      client_reference_id: user.id,
      metadata: { user_id: user.id, pack_id: pack.id, credits: String(pack.credits) },
    });
    if (!session.url) throw new Error('Stripe did not return a checkout URL');
    return c.json({ checkoutUrl: session.url });
  } catch (err) {
    return c.json({ error: 'Failed to start checkout', detail: String(err) }, 502);
  }
});

// Not behind requireAuth -- Stripe calls this server-to-server with
// no user session. Authenticity comes entirely from the signature
// check below, which needs the exact raw request body, so this must
// run before any body-parsing middleware would consume it (none does
// in this app, but worth keeping in mind if that ever changes).
billingRoute.post('/billing/webhook', async (c) => {
  const signature = c.req.header('stripe-signature');
  if (!signature) return c.json({ error: 'Missing stripe-signature header' }, 400);

  const rawBody = await c.req.text();
  const stripe = getStripeClient(c.env);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      c.env.STRIPE_WEBHOOK_SECRET,
      undefined,
      getStripeCryptoProvider()
    );
  } catch (err) {
    return c.json({ error: `Webhook signature verification failed: ${String(err)}` }, 400);
  }

  // checkout.session.completed fires immediately for card payments;
  // async_payment_succeeded fires later for delayed methods (e.g.
  // bank transfers) where completed fires first with an unpaid
  // status. Both carry the same session shape, gated by payment_status
  // so a not-yet-paid async session doesn't grant credits early.
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status === 'paid') {
      await grantCreditsForSession(c.env, event.id, session);
    }
  }

  return c.json({ received: true });
});

async function grantCreditsForSession(env: Env, eventId: string, session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.user_id;
  const credits = Number(session.metadata?.credits);
  if (!userId || !credits || Number.isNaN(credits)) return;

  const nwlhs = getNwlhsAdmin(env);
  const { error: insertError } = await nwlhs.from('stripe_events').insert({ id: eventId });
  if (insertError) {
    // A unique-constraint violation means this event was already
    // processed -- Stripe retries webhooks, so this is expected and
    // must not re-credit. Any other error is swallowed rather than
    // thrown: failing loudly here would return non-2xx and make
    // Stripe retry indefinitely on what might be a transient issue.
    return;
  }

  await nwlhs.rpc('grant_credits', {
    p_user_id: userId,
    p_amount: credits,
    p_reason: 'purchase',
    p_reference_id: session.id,
  });
}
