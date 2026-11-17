import { type Entry, safeUrl } from './cms';

export function tagsOf(entry: Entry): string[] {
  return Array.isArray(entry.metadata.tags) ? [...new Set(entry.metadata.tags.filter((tag: unknown): tag is string => typeof tag === 'string' && tag.trim().length > 0).map((tag: string) => tag.trim().slice(0, 24)))].slice(0, 8) as string[] : [];
}
export const seriesOf = (entry: Pick<Entry, 'metadata'>): string => typeof entry.metadata.series === 'string' ? entry.metadata.series.trim().slice(0, 80) : '';
export const coverOf = (entry: Entry) => safeUrl(entry.metadata.coverImage);
