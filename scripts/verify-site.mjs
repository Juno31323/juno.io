import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';

const base = (process.env.PREVIEW_URL || 'https://juno31323.me').replace(/\/$/, '');
const browser = await chromium.launch({ headless: true, channel: process.platform === 'win32' && existsSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe') ? 'msedge' : undefined });
const errors = [], failedResources = [], results = [];
await mkdir('artifacts/domain', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && new URL(response.url()).origin === new URL(base).origin) failedResources.push({ url: response.url(), status: response.status() }); });
  for (const route of ['/', '/about/', '/projects/', '/research/', '/timeline/', '/blog/', '/admin/']) {
    const response = await page.goto(base + route, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200, route);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('h1').count(), 1, `${route}: heading`);
    assert.ok(await page.evaluate(() => document.fonts.check('16px "Pretendard Variable"')), `${route}: font`);
    assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).color), 'rgb(29, 36, 77)', `${route}: stylesheet`);
    assert.equal(await page.locator('img').evaluateAll(images => images.filter(img => !img.complete || !img.naturalWidth || !img.alt).length), 0, `${route}: images`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${route}: overflow`);
    assert.equal(await page.locator('[src^="/juno.io/"], [href^="/juno.io/"]').count(), 0, `${route}: stale project prefix`);
    results.push({ route, title: await page.title() });
  }
  assert.ok(await page.locator('#login-panel').isVisible(), 'Admin JS checks session and shows login');
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'artifacts/domain/home-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 960 });
  await page.reload({ waitUntil: 'networkidle' });
  const menu = page.locator('.menu-toggle'); await menu.click();
  assert.equal(await menu.getAttribute('aria-expanded'), 'true', 'Mobile JS menu opens');
  await menu.click();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: 'artifacts/domain/home-mobile.png', fullPage: true });
  assert.deepEqual(errors, []); assert.deepEqual(failedResources, []);
  await writeFile('artifacts/domain/results.json', JSON.stringify({ base, results, errors, failedResources }, null, 2));
  console.log(`PASS: ${base} — 7 routes, CSS/JS/fonts/images, admin initialization and mobile menu; no failed local resources.`);
} finally { await browser.close(); }
