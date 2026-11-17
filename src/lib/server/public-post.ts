import { marked } from 'marked';
import sanitize from 'sanitize-html';
import { safeUrl, validSlug, type Entry } from '../cms';

export async function findPublicPost(slug: string | undefined): Promise<Entry | null> {
  if (!validSlug(slug)) return null;
  const project = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!project || !key) throw new Error('Public Supabase configuration is missing.');
  const url = new URL('/rest/v1/entries', project);
  url.search = new URLSearchParams({
    select: 'id,kind,slug,title,summary,body,status,published_at,sort_order,featured,metadata',
    kind: 'eq.posts',
    slug: `eq.${slug}`,
    status: 'eq.published',
    published_at: `lte.${new Date().toISOString()}`,
    limit: '1',
  }).toString();
  const response = await fetch(url, { headers: { apikey: key }, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Public post lookup failed.');
  const [entry] = await response.json() as Entry[];
  return entry || null;
}

export function renderPost(source: string) {
  return sanitize(marked.parse(source, { async: false, gfm: true }), {
    allowedTags: ['p', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'strong', 'em', 'del', 'blockquote', 'pre', 'code', 'a', 'img', 'br', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'dl', 'dt', 'dd', 'div', 'span', 'details', 'summary', 'kbd', 'sup', 'sub'],
    allowedAttributes: { a: ['href', 'rel'], img: ['src', 'alt', 'loading', 'decoding'], code: ['class'], ol: ['start'], th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'] },
    allowedSchemes: ['http', 'https'],
    allowProtocolRelative: false,
    exclusiveFilter: frame => frame.tag === 'img' && !frame.attribs.src,
    transformTags: {
      h1: 'h2',
      a: (_tag, attrs) => ({ tagName: 'a', attribs: { href: attrs.href?.startsWith('#') ? attrs.href : safeUrl(attrs.href), rel: 'noopener noreferrer' } }),
      img: (_tag, attrs) => ({ tagName: 'img', attribs: { src: safeUrl(attrs.src), alt: attrs.alt || '본문 이미지', loading: 'lazy', decoding: 'async' } }),
    },
  });
}
