import type { Env } from '../types';

export async function serveMediaObject(env: Env, r2Key: string): Promise<Response> {
  const object = await env.MEDIA_BUCKET.get(r2Key);
  if (!object) {
    return new Response(JSON.stringify({ error: 'Media not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=3300',
    },
  });
}
