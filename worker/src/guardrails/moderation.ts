import type { Env } from '../types';
import { getDmemzAdmin } from '../lib/supabaseAdmin';
import { checkPrompt, type DynamicTerm } from './blocklist';

let dynamicTermsCache: { terms: DynamicTerm[]; loadedAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

async function loadDynamicTerms(env: Env): Promise<DynamicTerm[]> {
  if (dynamicTermsCache && Date.now() - dynamicTermsCache.loadedAt < CACHE_TTL_MS) {
    return dynamicTermsCache.terms;
  }
  const dmemz = getDmemzAdmin(env);
  const { data, error } = await dmemz.from('blocklist_terms').select('category, pattern, match_type');
  const terms: DynamicTerm[] =
    error || !data
      ? []
      : data.map((row) => ({
          category: row.category as DynamicTerm['category'],
          pattern: row.pattern as string,
          matchType: row.match_type as DynamicTerm['matchType'],
        }));
  dynamicTermsCache = { terms, loadedAt: Date.now() };
  return terms;
}

export interface ModerationDecision {
  approved: boolean;
  hits: { category: string; pattern: string }[];
}

// Runs on every user-authored prompt field (persona free text, custom
// background prompt, outfit prompt) before it's sent to fal.ai for
// anything. Always writes to moderation_log, blocked or not, so the
// full history is auditable.
export async function moderateText(
  env: Env,
  params: { userId: string; subjectId?: string; text: string }
): Promise<ModerationDecision> {
  const dynamicTerms = await loadDynamicTerms(env);
  const result = checkPrompt(params.text, dynamicTerms);

  const dmemz = getDmemzAdmin(env);
  await dmemz.from('moderation_log').insert({
    user_id: params.userId,
    subject_type: 'prompt',
    subject_id: params.subjectId ?? null,
    input_excerpt: params.text.slice(0, 500),
    outcome: result.blocked ? 'blocked' : 'approved',
    rule: result.hits.map((h) => h.category).join(',') || null,
  });

  return { approved: !result.blocked, hits: result.hits };
}

// Media moderation runs after generation, before an asset is written
// to R2 (or before it's flipped to a visible status, if the provider
// already wrote it). Phases 3 (stills) and 5 (video) call this once
// there's actual media to check; the interface is fixed here in
// Phase 1 so the guardrail contract doesn't shift later.
export async function moderateMedia(
  env: Env,
  params: { userId: string; subjectType: 'still' | 'video'; subjectId: string; mediaUrl: string }
): Promise<ModerationDecision> {
  // TODO(Phase 3/5): call an image/video moderation provider (e.g. a
  // fal.ai moderation model) on `mediaUrl` and reject on a hit,
  // before the caller writes the asset to R2 or marks it 'ready'.
  const dmemz = getDmemzAdmin(env);
  await dmemz.from('moderation_log').insert({
    user_id: params.userId,
    subject_type: params.subjectType,
    subject_id: params.subjectId,
    input_excerpt: params.mediaUrl,
    outcome: 'approved',
    rule: 'media_moderation_not_yet_implemented',
  });
  return { approved: true, hits: [] };
}
