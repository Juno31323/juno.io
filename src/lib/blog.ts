import { type Entry, safeUrl } from './cms';

export function tagsOf(entry: Entry): string[] {
  return Array.isArray(entry.metadata.tags) ? [...new Set(entry.metadata.tags.filter((tag: unknown): tag is string => typeof tag === 'string' && tag.trim().length > 0).map((tag: string) => tag.trim().slice(0, 24)))].slice(0, 8) as string[] : [];
}
export const seriesOf = (entry: Entry): string => typeof entry.metadata.series === 'string' ? entry.metadata.series.trim().slice(0, 80) : '';
export const coverOf = (entry: Entry) => safeUrl(entry.metadata.coverImage);
export const readingMinutes = (body: string) => Math.max(1, Math.ceil(body.replace(/<[^>]*>|[#*`>\[\]()-]/g, '').length / 500));
export function readTime(entry: Entry) {
  const stored = Number(entry.metadata.readingMinutes);
  const minutes = Number.isFinite(stored) && stored > 0 ? Math.min(400, Math.ceil(stored)) : typeof entry.body === 'string' ? readingMinutes(entry.body) : 0;
  return minutes ? `약 ${minutes}분 읽기` : '';
}
