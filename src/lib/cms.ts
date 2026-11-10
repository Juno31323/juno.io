export type EntryKind = 'posts' | 'projects' | 'research' | 'timeline' | 'pages';
export interface Entry {
  id?: string;
  kind: EntryKind;
  slug: string;
  title: string;
  summary: string;
  body: string;
  status: 'draft' | 'published' | 'archived';
  published_at: string;
  sort_order: number;
  featured: boolean;
  metadata: Record<string, any>;
  updated_at?: string;
}
export const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const localUrl = (path: string) => `${base}/${path.replace(/^\//, '')}`;
export function safeUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return base && value.startsWith(base + '/') ? value : localUrl(value);
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
const existingRoutes = new Set(['projects/firezone', 'projects/printsafe', 'projects/runningapp-lift', 'projects/ecommerce-lms', 'projects/shared-auth-api', 'research/university-notice-rag']);
export const entryUrl = (entry: Pick<Entry, 'kind' | 'slug'>) => existingRoutes.has(`${entry.kind}/${entry.slug}`) ? localUrl(`/${entry.kind}/${entry.slug}/`) : localUrl(`/entry/?type=${entry.kind}&slug=${encodeURIComponent(entry.slug)}`);
export const dateLabel = (value: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value));
