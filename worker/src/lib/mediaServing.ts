import type { Env } from '../types';

export async function serveMediaObject(
  env: Env,
  r2Key: string,
  opts: { contentDisposition?: string } = {}
): Promise<Response> {
  const object = await env.MEDIA_BUCKET.get(r2Key);
  if (!object) {
    return new Response(JSON.stringify({ error: 'Media not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const headers: Record<string, string> = {
    'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
    'Cache-Control': 'private, max-age=3300',
  };
  if (opts.contentDisposition) headers['Content-Disposition'] = opts.contentDisposition;
  return new Response(object.body, { headers });
}
