import { createHmac, randomBytes } from 'node:crypto';
import type { APIRoute } from 'astro';
import { localUrl, parseBlogNumber } from '../lib/cms';

const cookie = 'juno_blog_visitor';
const digestPattern = /^[0-9a-f]{64}$/;
const noStore = { 'Cache-Control': 'no-store' };

export const POST: APIRoute = async ({ params, request, url, site, cookies }) => {
  const number = parseBlogNumber(params.number);
  if (number === null) return new Response(null, { status: 404, headers: noStore });
  if (request.headers.get('Origin') !== url.origin || (!import.meta.env.DEV && site && url.hostname !== site.hostname)) {
    return new Response(null, { status: 403, headers: noStore });
  }
  const key = process.env.BLOG_VIEW_WRITE_KEY?.trim();
  const project = import.meta.env.PUBLIC_SUPABASE_URL;
  const publishableKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key || !digestPattern.test(key) || !project || !publishableKey) return new Response(null, { status: 503, headers: noStore });

  const saved = cookies.get(cookie)?.value;
  const visitor = saved && digestPattern.test(saved) ? saved : randomBytes(32).toString('hex');
  const digest = createHmac('sha256', key).update(`${number}:${visitor}`).digest('hex');
  try {
    const result = await fetch(new URL('/rest/v1/rpc/register_blog_view', project), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: publishableKey },
      body: JSON.stringify({ p_number: number, p_visitor: digest, p_key: key }),
      signal: AbortSignal.timeout(5000),
    });
    if (!result.ok) return new Response(null, { status: 503, headers: noStore });
    const count = await result.json();
    if (count === null) return new Response(null, { status: 404, headers: noStore });
    if (!Number.isSafeInteger(count) || count < 0) return new Response(null, { status: 503, headers: noStore });
    cookies.set(cookie, visitor, {
      httpOnly: true, secure: url.protocol === 'https:', sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 400, path: localUrl('/api/blog/'),
    });
    return Response.json({ count }, { headers: noStore });
  } catch {
    return new Response(null, { status: 503, headers: noStore });
  }
};
