import { defineConfig } from 'astro/config';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import vercel from '@astrojs/vercel';
import node from '@astrojs/node';

const base = (process.env.BASE_PATH || '').replace(/\/$/, '');
const vercelBuild = process.env.VERCEL === '1';
const localServer = process.env.PORTFOLIO_SSR === '1';
const server = vercelBuild || localServer;
const livePages = new Set([
  'index', 'about', 'timeline', 'blog/index', 'projects/index', 'projects/[slug]', 'research/index', 'research/[slug]',
].map(page => `src/pages/${page}.astro`));
const portfolioRoutes = {
  name: 'portfolio-public-routes',
  hooks: {
    'astro:route:setup': ({ route }) => {
      if (server && livePages.has(route.component)) route.prerender = false;
    },
    'astro:config:setup': ({ injectRoute }) => {
      injectRoute({ pattern: '/entry', entrypoint: new URL('./src/routes/entry.astro', import.meta.url), prerender: !server });
      if (server) {
        injectRoute({ pattern: '/blog/[slug]', entrypoint: new URL('./src/routes/blog-post.astro', import.meta.url), prerender: false });
        injectRoute({ pattern: '/api/blog/[number]/view', entrypoint: new URL('./src/routes/blog-view.ts', import.meta.url), prerender: false });
      }
    },
  },
};
// Existing Markdown and public assets use root paths. Keep project Pages URLs portable.
const portablePaths = {
  name: 'portable-public-paths',
  hooks: { 'astro:build:done': async ({ dir }) => {
    if (!base) return;
    async function walk(folder) {
      for (const item of await readdir(folder, { withFileTypes: true })) {
        const path = new URL(item.name + (item.isDirectory() ? '/' : ''), folder);
        if (item.isDirectory()) await walk(path);
        else if (/\.(html|css)$/.test(item.name)) {
          let text = await readFile(path, 'utf8');
          text = text.replace(/((?:href|src)=['"])(\/(?!\/)[^'"]*)/g, (all, start, value) => value === base || value.startsWith(base + '/') ? all : start + base + value);
          text = text.replace(/(url\(['"]?)(\/(?!\/)[^)'"\s]*)/g, (all, start, value) => value.startsWith(base + '/') ? all : start + base + value);
          await writeFile(path, text);
        }
      }
    }
    await walk(dir);
  } },
};

export default defineConfig({
  output: 'static',
  adapter: vercelBuild ? vercel() : localServer ? node({ mode: 'standalone' }) : undefined,
  outDir: process.env.BUILD_OUT_DIR || './dist',
  site: process.env.SITE_URL || 'https://juno31323.me',
  base: base || '/',
  integrations: [portfolioRoutes, portablePaths],
  vite: {
    define: { 'import.meta.env.PUBLIC_BLOG_CLEAN_URLS': JSON.stringify(server ? 'true' : 'false') },
    // Bundle the HTML sanitizer with its ESM parser instead of relying on require(ESM) in Vercel's loader.
    ssr: { noExternal: vercelBuild ? [
      /^(?:sanitize-html|htmlparser2|escape-string-regexp|is-plain-object|launder|parse-srcset|postcss|domelementtype|domhandler|domutils|dom-serializer|entities|dayjs|nanoid|picocolors|source-map-js)(?:\/|$)/,
    ] : [] },
  },
  trailingSlash: 'always',
  devToolbar: { enabled: false },
});
