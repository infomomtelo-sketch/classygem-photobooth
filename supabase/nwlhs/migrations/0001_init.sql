-- nwlhs: Supabase Auth (built-in) + credits ledger.
-- Auth accounts live in the built-in auth.users table; this
-- migration only adds the credits layer on top of it.

create table public.credit_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null, -- positive = credit, negative = debit
  reason text not null, -- 'face_candidates' | 'lora_training' | 'still_generation' | 'upscale' | 'video_generation' | 'purchase' | 'refund' | ...
  reference_id text, -- dmemz job/asset id this transaction is tied to
  created_at timestamptz not null default now()
);

create index credit_transactions_user_id_idx on public.credit_transactions (user_id, created_at desc);

alter table public.credit_balances enable row level security;
alter table public.credit_transactions enable row level security;

create policy "read own balance" on public.credit_balances
  for select using (auth.uid() = user_id);

create policy "read own transactions" on public.credit_transactions
  for select using (auth.uid() = user_id);

-- No write policies for anon/authenticated on purpose: all balance
-- changes happen through deduct_credits/grant_credits below, called
-- by the Worker's service-role client, which enforces guardrails and
-- job success/failure before touching credits.

create or replace function public.deduct_credits(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_reference_id text default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  update public.credit_balances
    set balance = balance - p_amount, updated_at = now()
    where user_id = p_user_id and balance >= p_amount
    returning balance into v_balance;

  if v_balance is null then
    raise exception 'insufficient_credits';
  end if;

  insert into public.credit_transactions (user_id, amount, reason, reference_id)
    values (p_user_id, -p_amount, p_reason, p_reference_id);

  return v_balance;
end;
$$;

create or replace function public.grant_credits(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_reference_id text default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  insert into public.credit_balances (user_id, balance)
    values (p_user_id, p_amount)
    on conflict (user_id) do update
      set balance = public.credit_balances.balance + p_amount, updated_at = now()
    returning balance into v_balance;

  insert into public.credit_transactions (user_id, amount, reason, reference_id)
    values (p_user_id, p_amount, p_reason, p_reference_id);

  return v_balance;
end;
$$;

-- Every new auth user gets a zeroed credit_balances row so reads
-- never have to special-case "no row yet".
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.credit_balances (user_id, balance)
  values (new.id, 0)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
