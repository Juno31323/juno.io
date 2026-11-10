import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const workSchema = z.object({
  title: z.string(),
  summary: z.string(),
  category: z.string(),
  role: z.string(),
  order: z.number(),
  featured: z.boolean().default(false),
  showSummary: z.boolean().default(true),
  listRole: z.string().optional(),
  status: z.string().optional(),
  period: z.string().optional(),
  image: z.object({ src: z.string(), alt: z.string() }).optional(),
  links: z.array(z.object({ label: z.string(), url: z.url() })).default([]),
});

export const collections = {
  projects: defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/content/projects' }), schema: workSchema }),
  research: defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/content/research' }), schema: workSchema }),
  timeline: defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/timeline' }),
    schema: z.object({ title: z.string(), period: z.string(), category: z.string(), order: z.number() }),
  }),
};
