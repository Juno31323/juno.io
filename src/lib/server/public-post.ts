import { marked } from 'marked';
import sanitize from 'sanitize-html';
import { parseBlogNumber, safeUrl, validSlug, type Entry, type EntryKind } from '../cms';
import { profile as brand } from '../../data/profile';

class PublicQueryError extends Error {
  constructor(readonly code: string | undefined, status: number) {
    super(`Public content lookup failed (${status}).`);
  }
}
async function queryPublic<T>(table: 'entries' | 'site_settings', params: Record<string, string>): Promise<T[]> {
  const project = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!project || !key) throw new Error('Public Supabase configuration is missing.');
  const url = new URL(`/rest/v1/${table}`, project);
  url.search = new URLSearchParams(params).toString();
  const response = await fetch(url, { headers: { apikey: key }, signal: AbortSignal.timeout(5000) });
  if (!response.ok) {
    const failure = await response.json().catch(() => ({}));
    throw new PublicQueryError(failure.code, response.status);
  }
  return await response.json() as T[];
}

export async function publicEntries(kinds: EntryKind[], options: { slug?: string; number?: number; limit?: number; featured?: boolean; body?: boolean } = {}) {
  const posts = kinds.length === 1 && kinds[0] === 'posts';
  const columns = 'id,kind,slug,title,summary,status,published_at,sort_order,featured,metadata' + (options.body ? ',body' : '');
  const params: Record<string, string> = {
    select: columns + (posts ? ',blog_number,blog_view_counts(total)' : ''),
    kind: kinds.length === 1 ? `eq.${kinds[0]}` : `in.(${kinds.join(',')})`,
    status: 'eq.published',
    published_at: `lte.${new Date().toISOString()}`,
    order: posts ? 'published_at.desc,id.asc' : 'sort_order.asc,id.asc',
  };
  if (options.slug) params.slug = `eq.${options.slug}`;
  if (options.number) params.blog_number = `eq.${options.number}`;
  if (options.featured) params.featured = 'eq.true';
  const getPage = async (paging: Record<string, string>) => {
    try {
      return await queryPublic<Entry>('entries', { ...params, ...paging });
    } catch (error) {
      // Keep existing slug links working until the database migration is installed.
      if (!(posts && error instanceof PublicQueryError && ['42703', 'PGRST200', 'PGRST204'].includes(error.code || ''))) throw error;
      if (options.number) return [];
      params.select = columns;
      return queryPublic<Entry>('entries', { ...params, ...paging });
    }
  };
  if (options.limit) return getPage({ limit: String(options.limit) });
  const entries: Entry[] = [];
  for (let offset = 0; ; offset += 500) {
    const page = await getPage({ limit: '500', offset: String(offset) });
    entries.push(...page);
    if (page.length < 500) return entries;
  }
}

export async function findPublicEntry(kind: EntryKind, slug: string | undefined) {
  if (!validSlug(slug)) return null;
  const [entry] = await publicEntries([kind], { slug, limit: 1, body: true });
  return entry ?? null;
}
export async function findPublicPost(address: string | undefined) {
  const number = parseBlogNumber(address);
  if (number !== null) {
    const [post] = await publicEntries(['posts'], { number, limit: 1, body: true });
    if (post) return post;
  }
  return findPublicEntry('posts', address);
}

export type LiveProfile = {
  name: string; school: string; major: string; intro: string;
  photo: string; heroPhoto: string; photoAlt: string; github: string; interests: string; researchSummary: string;
};
const profileRequests = new WeakMap<object, Promise<LiveProfile | null>>();
export function publicProfile(locals: object) {
  let request = profileRequests.get(locals);
  if (!request) {
    request = queryPublic<{ data: Partial<LiveProfile> }>('site_settings', { select: 'data', id: 'eq.profile', limit: '1' })
      .then(([row]) => {
        if (!row) return null;
        const p = row.data;
        const value = (key: keyof LiveProfile) => typeof p[key] === 'string' ? p[key] : '';
        return {
          name: value('name') || brand.name, school: value('school'), major: value('major'), intro: value('intro'),
          photo: safeUrl(p.photo), heroPhoto: safeUrl(p.heroPhoto), photoAlt: value('photoAlt'),
          github: safeUrl(p.github), interests: value('interests'), researchSummary: value('researchSummary'),
        };
      })
      .catch(() => null);
    profileRequests.set(locals, request);
  }
  return request;
}

export async function liveContent<T>(response: { readonly headers: Headers; status?: number }, load: () => Promise<T>) {
  response.headers.set('Cache-Control', 'no-store');
  try {
    return await load();
  } catch {
    response.status = 503;
    response.headers.set('Retry-After', '30');
    return null;
  }
}

export async function publicWorkDetail(response: { readonly headers: Headers; status?: number }, kind: 'projects' | 'research', slug?: string) {
  const result = await liveContent(response, async () => ({ entry: await findPublicEntry(kind, slug) }));
  if (result && !result.entry) response.status = 404;
  return result;
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
