import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const baseURL = (process.env.PREVIEW_URL || 'http://127.0.0.1:4333').replace(/\/$/, '');
const seed = JSON.parse(await readFile('artifacts/seed-data.json', 'utf8'));
const channel = process.env.BROWSER_CHANNEL || (process.platform === 'win32' && existsSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe') ? 'msedge' : undefined);
const browser = await chromium.launch({ headless: true, channel });
const results = [];
await mkdir('artifacts/cms', { recursive: true });
const now = new Date().toISOString();
const user = { id: 'b6a31a5b-1b74-410e-8337-53dcf693f72b', email: 'owner@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: now };
const post = { id: 'p1', kind: 'posts', slug: 'first-post', title: '첫 번째 기록', summary: '개발 메모.', body: '## 메모\n\n본문입니다.\n\n### 확인\n\n```js\nconst result = 1;\n```\n\n<img src=x onerror="window.xss=1"><script>window.xss=1</script>\n\n[위험 링크](javascript:alert(1))', status: 'published', published_at: now, sort_order: 0, featured: false, metadata: { tags: ['Python', '회고'], series: '개발 기록', coverImage: '/images/portfolio/rag-art.webp', coverAlt: '문서 검색 일러스트' }, updated_at: now };
let rows = [...seed.entries.map((entry, i) => ({ ...entry, id: `seed-${i}`, updated_at: now })), post];
let profile = { id: 'profile', data: seed.profile, updated_at: now };
let admin = true, conflict = false, failSave = false, failRead = false;
const writes = [];

async function mock(context) {
  await context.route('https://*.supabase.co/**', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data), headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'content-range', 'content-range': '0-99/100' } });
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
    if (url.pathname.includes('/auth/v1/token')) return json({ access_token: 'mock-session', refresh_token: 'mock-refresh', expires_in: 3600, token_type: 'bearer', user });
    if (url.pathname.includes('/auth/v1/user')) return json(user);
    if (url.pathname.includes('/auth/v1/logout')) return json({});
    if (url.pathname.endsWith('/rpc/is_site_admin')) return json(admin);
    if (url.pathname.includes('/storage/v1/object/')) return method === 'GET' ? route.fulfill({ contentType: 'image/webp', body: await readFile('public/images/portfolio/rag-art.webp') }) : json({ Key: 'site-images/test.webp' });
    const single = request.headers().accept?.includes('object+json');
    if (url.pathname.endsWith('/site_settings')) {
      if (method === 'PATCH') { profile = { ...profile, ...request.postDataJSON(), updated_at: new Date().toISOString() }; writes.push(profile); return json(single ? profile : [profile]); }
      return json(single ? profile : [profile]);
    }
    if (url.pathname.endsWith('/entries')) {
      if (method === 'POST' || method === 'PATCH') {
        if (failSave) return json({ code: '42501', message: 'denied' }, 403);
        if (conflict) return json(single ? null : []);
        const entry = { ...request.postDataJSON(), id: method === 'POST' ? `post-${writes.length}` : (url.searchParams.get('id') || '').replace('eq.', ''), updated_at: new Date().toISOString() };
        rows = rows.filter(row => row.id !== entry.id); rows.push(entry); writes.push(entry); return json(single ? entry : [entry]);
      }
      if (failRead) return json({ message: 'unavailable' }, 503);
      let data = [...rows];
      for (const [key, value] of url.searchParams) {
        if (value.startsWith('eq.')) data = data.filter(row => String(row[key]) === value.slice(3));
        if (value.startsWith('lte.')) data = data.filter(row => new Date(row[key]) <= new Date(value.slice(4)));
        if (value.startsWith('in.')) data = data.filter(row => value.slice(3).replace(/[()]/g, '').split(',').includes(row[key]));
        if (value.startsWith('ilike.')) data = data.filter(row => row[key].toLowerCase().includes(value.slice(6).replaceAll('%', '').toLowerCase()));
      }
      const orders = (url.searchParams.get('order') || '').split(',').filter(Boolean);
      data.sort((a, b) => { for (const order of orders) { const [key, direction] = order.split('.'); const difference = typeof a[key] === 'number' ? a[key] - b[key] : String(a[key]).localeCompare(String(b[key])); if (difference) return direction === 'desc' ? -difference : difference; } return 0; });
      const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 1000);
      data = data.slice(offset, offset + limit); return json(single ? data[0] || null : data);
    }
    return json({});
  });
}
try {
  const context = await browser.newContext(); await mock(context);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    for (const route of ['/', '/blog/', '/entry/?type=posts&slug=first-post', '/admin/']) {
      await page.goto(baseURL + route, { waitUntil: 'networkidle' });
      assert.equal(await page.locator('h1').count(), 1);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width} ${route}: overflow`);
      await page.screenshot({ path: `artifacts/cms/${route === '/' ? 'dashboard' : route.startsWith('/entry') ? 'reader' : route.split('/')[1]}-${width}.png`, fullPage: true });
    }
  }
  rows.push({ ...post, id: 'draft', slug: 'draft-post', title: '비공개 초안', status: 'draft' }, { ...post, id: 'future', slug: 'future-post', title: '미래 예약 글', published_at: '2999-01-01T00:00:00Z' });
  await page.goto(baseURL + '/', { waitUntil: 'networkidle' });
  assert.deepEqual(await page.locator('[data-home-posts] h3').allTextContents(), [post.title], 'Dashboard shows only currently published posts');
  assert.equal(await page.locator('.dashboard-timeline-list > li').count(), 3);
  await page.goto(baseURL + '/entry/?type=posts&slug=first-post', { waitUntil: 'networkidle' });
  assert.equal(await page.locator('h1').textContent(), post.title);
  assert.equal(await page.evaluate(() => window.xss), undefined);
  assert.equal(await page.locator('article script, article [onerror], article a[href^="javascript:"]').count(), 0);
  assert.equal(await page.locator('[data-entry-toc] a').count(), 2);
  await page.locator('[data-entry-toc] a').last().click(); assert.match(page.url(), /#section-2$/);
  await page.locator('.copy-code').click(); assert.equal((await page.evaluate(() => navigator.clipboard.readText())).replaceAll('\r\n', '\n'), 'const result = 1;\n');
  assert.equal(await page.locator('[data-series-posts] [aria-current=page]').textContent(), post.title);
  assert.equal(await page.locator('[data-entry-cover]').getAttribute('alt'), post.metadata.coverAlt);
  await page.goto(baseURL + '/entry/?type=posts&slug=missing', { waitUntil: 'networkidle' });
  assert.match(await page.locator('h1').innerText(), /공개된 기록이 없습니다/);
  await page.goto(baseURL + '/blog/', { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.blog-list h2').count(), 1);
  await page.locator('#blog-search').fill('없는 제목'); await page.waitForTimeout(400);
  await page.getByText('검색 결과가 없습니다.').first().waitFor();
  for (let i = 0; i < 14; i++) rows.push({ ...post, id: `catalog-${i}`, slug: `catalog-${i}`, title: `페이지 ${i}`, summary: '검색할 요약', metadata: { tags: ['Astro'], series: '블로그 만들기' } });
  await page.goto(baseURL + '/blog/', { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.blog-list h2').count(), 12); await page.locator('[data-blog-more]').click(); assert.equal(await page.locator('.blog-list h2').count(), 15);
  await page.getByRole('button', { name: 'Python · 1', exact: true }).click(); assert.equal(await page.locator('.blog-list h2').count(), 1); assert.match(page.url(), /tag=Python/);
  await page.reload({ waitUntil: 'networkidle' }); assert.equal(await page.locator('[data-tag=Python]').getAttribute('aria-pressed'), 'true');
  await page.locator('[data-blog-reset]').click(); await page.locator('#blog-search').fill('검색할 요약'); await page.waitForTimeout(300); assert.equal(await page.locator('[data-blog-count]').innerText(), '14개의 글');
  await page.locator('[data-blog-reset]').click(); await page.getByRole('button', { name: '시리즈', exact: true }).click(); assert.equal(await page.locator('.series-list > li').count(), 2);
  await page.getByRole('button', { name: /블로그 만들기/ }).click(); assert.equal(await page.locator('#blog-series').inputValue(), '블로그 만들기');
  rows = rows.filter(row => !row.id.startsWith('catalog-'));
  failRead = true; await page.goto(baseURL + '/blog/', { waitUntil: 'networkidle' }); await page.getByRole('button', { name: '다시 시도', exact: true }).waitFor(); failRead = false; await page.getByRole('button', { name: '다시 시도', exact: true }).click(); await page.locator('.blog-list h2').waitFor();
  await page.goto(baseURL + '/admin/', { waitUntil: 'networkidle' });
  await page.getByLabel('이메일', { exact: true }).fill(user.email); await page.getByLabel('비밀번호', { exact: true }).fill('mock-password');
  await page.getByRole('button', { name: '로그인', exact: true }).click(); await page.locator('#workspace').waitFor({ state: 'visible' });
  await page.locator('#new-entry').click(); await page.locator('[name=title]').fill('직접 남긴 글');
  await page.locator('[name=body]').fill('/'); await page.locator('[name=body]').press('ArrowDown'); await page.keyboard.press('Enter'); assert.equal(await page.locator('[name=body]').inputValue(), '## 소제목');
  await page.locator('[name=body]').fill('## 오늘\n\n내가 적은 내용.'); await page.locator('[name=tags]').fill('개발, Astro');
  await page.locator('#split-tab').click(); await page.locator('[name=body]').fill('## 오늘\n\n내가 적은 내용. 실시간.'); assert.match(await page.locator('#body-preview').innerText(), /실시간/);
  await page.locator('#edit-tab').click(); await page.locator('#local-save-status').getByText('이 기기에 임시 보관됨').waitFor();
  const beforeRecovery = writes.length; await page.reload({ waitUntil: 'networkidle' }); await page.locator('#recover-new').click(); await page.locator('#restore-draft').click();
  assert.equal(await page.locator('[name=title]').inputValue(), '직접 남긴 글'); assert.match(await page.locator('[name=body]').inputValue(), /실시간/); assert.equal(writes.length, beforeRecovery, 'Recovery must not publish or write to Supabase');
  await page.locator('#publish-entry').click(); await page.locator('[name=slug]').fill('my-note'); await page.locator('[name=series]').fill('블로그 만들기'); await page.locator('[name=coverImage]').fill('/images/portfolio/rag-art.webp'); await page.locator('[name=coverAlt]').fill('문서 검색 일러스트');
  await page.locator('.image-tools > summary').click();
  await page.locator('#import-markdown').setInputFiles({ name: 'note.md', mimeType: 'text/markdown', buffer: Buffer.from('## 오늘\n\n내가 적은 내용. 실시간.') }); await page.getByText('본문을 가져왔습니다. 확인한 뒤 저장해 주세요.', { exact: true }).first().waitFor();
  const downloaded = page.waitForEvent('download'); await page.locator('#export-markdown').click(); assert.equal((await downloaded).suggestedFilename(), 'my-note.md');
  await page.locator('#image-upload').setInputFiles('public/images/portfolio/rag-art.webp'); await page.locator('#image-alt').fill('커버 업로드 검증'); await page.locator('#image-target').selectOption('cover'); await page.locator('#upload-image').click(); await page.getByText('커버 이미지를 골랐습니다. 글도 저장해 주세요.', { exact: true }).first().waitFor(); assert.match(await page.locator('[name=coverImage]').inputValue(), /\/storage\/v1\/object\/public\/site-images\//);
  await page.locator('[name=coverImage]').fill('/images/portfolio/rag-art.webp'); await page.locator('[name=coverAlt]').fill('문서 검색 일러스트');
  await page.locator('#preview-tab').click(); assert.match(await page.locator('#body-preview').innerText(), /내가 적은 내용/);
  await page.locator('#edit-tab').click(); await page.locator('#save-entry').click(); await page.getByText('초안으로 저장했습니다.', { exact: true }).first().waitFor();
  assert.equal(writes.at(-1).status, 'draft');
  assert.deepEqual(writes.at(-1).metadata.tags, ['개발', 'Astro']); assert.equal(writes.at(-1).metadata.series, '블로그 만들기');
  assert.equal(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('juno-writer:')).length), 0);
  await page.locator('[name=status]').selectOption('published'); await page.locator('#save-entry').click(); await page.getByText('저장했습니다. 사이트에서 바로 확인할 수 있습니다.', { exact: true }).first().waitFor();
  assert.equal(writes.at(-1).status, 'published');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'save-entry');
  conflict = true; await page.locator('[name=body]').fill('충돌 시 지킬 내용'); await page.locator('#save-entry').click(); await page.getByText(/다른 창에서 수정된 내용/).first().waitFor(); assert.equal(await page.locator('[name=body]').inputValue(), '충돌 시 지킬 내용'); conflict = false;
  failSave = true; await page.locator('#save-entry').click(); await page.getByText(/입력한 내용은 남아 있습니다/).first().waitFor(); assert.equal(await page.locator('[name=body]').inputValue(), '충돌 시 지킬 내용'); assert.match(await page.locator('#editor-feedback').innerText(), /저장하지 못했습니다/); assert.equal(await page.evaluate(() => document.activeElement?.id), 'save-entry'); failSave = false;
  await page.locator('#save-entry').click(); await page.getByText('저장했습니다. 사이트에서 바로 확인할 수 있습니다.', { exact: true }).first().waitFor();
  await page.locator('[name=status]').selectOption('archived'); await page.locator('#save-entry').click(); await page.getByText('보관했습니다. 방문자에게 표시되지 않습니다.', { exact: true }).first().waitFor(); assert.equal(writes.at(-1).status, 'archived');
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 960 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.locator('#save-entry').focus();
    await page.screenshot({ path: `artifacts/cms/editor-${width}.png`, fullPage: true });
    await page.locator('#save-entry').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `artifacts/cms/editor-actions-${width}.png` });
  }
  await page.locator('#admin-filter').selectOption('archived'); assert.equal(await page.locator('#admin-entries button').count(), 1);
  await page.locator('#focus-writing').click(); assert.equal(await page.locator('.site-header').isVisible(), false); await page.keyboard.press('Escape'); assert.equal(await page.locator('#focus-writing').getAttribute('aria-pressed'), 'false');
  await page.locator('#content-kind').selectOption('profile'); await page.locator('#profile-panel').waitFor({ state: 'visible' });
  await page.locator('#profile-form [name=intro]').fill('수정한 한 줄 소개'); await page.locator('#profile-form button[type=submit]').click(); await page.getByText('프로필을 저장했습니다.', { exact: true }).first().waitFor();
  assert.equal(profile.data.intro, '수정한 한 줄 소개');
  await page.locator('#logout').click(); await page.locator('#login-panel').waitFor({ state: 'visible' });
  admin = false; await page.getByLabel('이메일', { exact: true }).fill(user.email); await page.getByLabel('비밀번호', { exact: true }).fill('mock-password'); await page.getByRole('button', { name: '로그인', exact: true }).click(); await page.getByText(/관리자 권한이 없습니다/).first().waitFor(); assert.equal(await page.locator('#workspace').isVisible(), false);
  assert.deepEqual(errors, []);
  results.push('Responsive blog, reader and admin at 390/768/1440px', 'Markdown XSS sanitization', 'TOC anchors, code clipboard and series navigation', 'Search, tag/series URL filters, pagination and retry', 'Admin sign-in and non-admin denial', 'Slash formatting and live split preview', 'Account-scoped local draft recovery without server writes', 'Markdown import/export and cover upload', 'Tags, series and cover persistence', 'Draft/save/publish/archive and status filter', 'Focus mode and Escape', 'Retained input after save failure/conflict', 'Profile save and logout');
  await writeFile('artifacts/cms/results.json', JSON.stringify({ mode: 'mocked Supabase API — no production writes', checks: results, writes: writes.length }, null, 2)); console.log(JSON.stringify({ passed: results, writes: writes.length }, null, 2));
} finally { await browser.close(); }
