import { getCollection, type CollectionEntry } from 'astro:content';
import { localUrl, safeUrl, type Entry } from './cms';

export type Work = CollectionEntry<'projects'> | CollectionEntry<'research'>;
export async function getWorks() {
  const [projects, research] = await Promise.all([getCollection('projects'), getCollection('research')]);
  return [...projects, ...research].sort((a, b) => a.data.order - b.data.order);
}
export type WorkCard = Pick<Work, 'collection' | 'id' | 'data'> & { cardImage?: string; cardAlt?: string };
export function liveWork(entry: Entry): WorkCard {
  const meta = entry.metadata;
  const field = (key: string) => typeof meta[key] === 'string' ? meta[key] as string : undefined;
  const image = safeUrl(meta.image?.src);
  return {
    collection: entry.kind === 'research' ? 'research' : 'projects', id: entry.slug,
    cardImage: safeUrl(meta.cardImage), cardAlt: field('cardAlt'),
    data: {
      title: entry.title, summary: entry.summary, order: entry.sort_order, featured: entry.featured,
      category: field('category') || '', role: field('role') || '', listRole: field('listRole'),
      period: field('period'), status: field('status'), showSummary: meta.showSummary !== false,
      image: image ? { src: image, alt: meta.image.alt || entry.title } : undefined,
      links: Array.isArray(meta.links) ? meta.links.flatMap(link => {
        const url = safeUrl(link?.url);
        return url && typeof link?.label === 'string' && link.label.trim() ? [{ label: link.label, url }] : [];
      }) : [],
    },
  };
}
export const workHref = (work: WorkCard) => localUrl(`/${work.collection}/${work.id}/`);
