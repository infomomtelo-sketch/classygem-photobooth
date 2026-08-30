import type { Context } from 'hono';
import type { Env, Variables } from '../types';
import { signMediaToken } from './signedMedia';

type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

export type MediaKind = 'candidates' | 'stills' | 'upscales' | 'videos';

// Resource ids are namespaced by kind ("stills:<uuid>") so a token
// minted for one table can't be replayed against another route, even
// though collisions across these UUID-keyed tables are already
// vanishingly unlikely.
export async function mintMediaUrl(c: AppContext, kind: MediaKind, id: string): Promise<string> {
  const { token } = await signMediaToken(c.env.MEDIA_SIGNING_SECRET, `${kind}:${id}`);
  return `${c.env.PUBLIC_MEDIA_BASE_URL}/media/${kind}/${id}?token=${token}`;
}
