import type { Env } from '../types';
import { getNwlhsAdmin } from './supabaseAdmin';

export async function getBalance(env: Env, userId: string): Promise<number> {
  const nwlhs = getNwlhsAdmin(env);
  const { data, error } = await nwlhs.from('credit_balances').select('balance').eq('user_id', userId).single();
  if (error || !data) return 0;
  return data.balance as number;
}

export interface CreditMoveParams {
  userId: string;
  amount: number;
  reason: string;
  referenceId?: string;
}

// Atomic, race-safe debit via the `deduct_credits` Postgres function
// (supabase/nwlhs/migrations/0001_init.sql) -- never subtract with a
// read-then-write from application code, since two concurrent
// requests could both read the same balance and double-spend it.
export async function spendCredits(env: Env, params: CreditMoveParams): Promise<{ ok: boolean; balance: number }> {
  const nwlhs = getNwlhsAdmin(env);
  const { data, error } = await nwlhs.rpc('deduct_credits', {
    p_user_id: params.userId,
    p_amount: params.amount,
    p_reason: params.reason,
    p_reference_id: params.referenceId ?? null,
  });
  if (error) {
    return { ok: false, balance: await getBalance(env, params.userId) };
  }
  return { ok: true, balance: data as number };
}

// Used to reverse a spend when a generation job fails after credits
// were already deducted (e.g. fal.ai request errors out).
export async function refundCredits(env: Env, params: CreditMoveParams): Promise<number> {
  const nwlhs = getNwlhsAdmin(env);
  const { data } = await nwlhs.rpc('grant_credits', {
    p_user_id: params.userId,
    p_amount: params.amount,
    p_reason: params.reason,
    p_reference_id: params.referenceId ?? null,
  });
  return data as number;
}
