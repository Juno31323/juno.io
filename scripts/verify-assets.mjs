import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

const root = resolve(process.env.BUILD_OUT_DIR || 'dist');
const prefix = (process.env.BASE_PATH || '').replace(/\/$/, '');
const origin = 'https://build.invalid';
let references = 0;
async function check(value, source) {
  if (!value || value.startsWith('#') || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) return;
  const sourceUrl = new URL(`${prefix}/${source.replaceAll('\\', '/')}`, origin);
  const path = decodeURIComponent(new URL(value.replaceAll('&amp;', '&'), sourceUrl).pathname);
  assert.ok(!prefix || path.startsWith(prefix + '/'), `${source}: path outside base: ${value}`);
  const target = resolve(root, '.' + path.slice(prefix.length));
  assert.ok(target.startsWith(root + sep) || target === root, `${source}: path outside output: ${value}`);
  let file;
  try { file = await stat(target); } catch { assert.fail(`${source}: missing local resource ${value}`); }
  if (file.isDirectory()) await stat(resolve(target, 'index.html'));
  references++;
}
async function walk(directory, relative = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = relative + entry.name;
    if (entry.isDirectory()) await walk(resolve(directory, entry.name), name + '/');
    else if (/\.(html|css)$/.test(name)) {
      const source = await readFile(resolve(directory, entry.name), 'utf8');
      const pattern = name.endsWith('.html') ? /(?:href|src)=["']([^"']+)["']/g : /url\(\s*["']?([^"')\s]+)["']?\s*\)/g;
      for (const match of source.matchAll(pattern)) await check(match[1], name);
    }
  }
}
await walk(root);
assert.ok(references > 0, 'No built resource references checked');
console.log(`PASS: ${references} local HTML/CSS resource and link paths resolve (base: ${prefix || '/'}).`);
