import { defineConfig } from 'astro/config';
import { readdir, readFile, writeFile } from 'node:fs/promises';

const base = (process.env.BASE_PATH || '').replace(/\/$/, '');
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
  outDir: process.env.BUILD_OUT_DIR || './dist',
  site: process.env.SITE_URL || 'https://juno31323.me',
  base: base || '/',
  integrations: [portablePaths],
  trailingSlash: 'always',
  devToolbar: { enabled: false },
});
