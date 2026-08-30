-- Idempotency ledger for the Stripe webhook: Stripe retries webhook
-- delivery on anything but a 2xx response, so the handler must be
-- safe to receive the same event twice without double-crediting.
-- Inserting the event id first (unique constraint) and only granting
-- credits if that insert succeeds is the dedup gate.
create table public.stripe_events (
  id text primary key,
  created_at timestamptz not null default now()
);

alter table public.stripe_events enable row level security;
-- No policies granted: only the Worker's service-role client (used
-- exclusively by the Stripe webhook handler) ever touches this table.
