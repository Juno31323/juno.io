import { getCollection, type CollectionEntry } from 'astro:content';

export type Work = CollectionEntry<'projects'> | CollectionEntry<'research'>;
export async function getWorks() {
  const [projects, research] = await Promise.all([getCollection('projects'), getCollection('research')]);
  return [...projects, ...research].sort((a, b) => a.data.order - b.data.order);
}
export const workHref = (work: Work) => `/${work.collection}/${work.id}/`;
