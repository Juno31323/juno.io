import assert from 'node:assert/strict';

// Run after `VERCEL=1 npm run build`. All data is local test data; no writes or live requests.
let version = 1;
let offline = false;
let installed = true;
process.env.BLOG_VIEW_WRITE_KEY = 'a'.repeat(64);
const views = new Set();
const seed = [
  ['projects', 'firezone', true],
  ['research', 'university-notice-rag', true],
  ['timeline', 'recent-event', false],
  ['pages', 'about', false],
  ['posts', 'test-post', false],
  ['posts', 'draft-post', false, 'draft'],
  ['projects', 'archived-project', true, 'archived'],
  ['posts', 'scheduled-post', false, 'published', '2999-01-01T00:00:00Z'],
];
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input);
  assert.ok(url.pathname.startsWith('/rest/v1/'), 'The rendering test must only use mocked Data API calls');
  if (offline) return new Response(null, { status: 503 });
  if (url.pathname.endsWith('/rpc/register_blog_view')) {
    assert.equal(init.method, 'POST');
    const { p_number, p_visitor, p_key } = JSON.parse(init.body);
    assert.equal(p_key, process.env.BLOG_VIEW_WRITE_KEY);
    assert.match(p_visitor, /^[0-9a-f]{64}$/);
    if (p_number !== 1) return Response.json(null);
    views.add(p_visitor);
    return Response.json(views.size);
  }
  if (url.pathname.endsWith('/site_settings')) return Response.json([{ data: {
    name: '최신 프로필', school: '최신 학교', intro: `현재 소개 ${version}`, major: '최신 학과',
  } }]);
  const params = url.searchParams;
  if (!installed && params.get('select').includes('blog_number')) return Response.json({ code: 'PGRST200' }, { status: 400 });
  assert.equal(params.get('status'), 'eq.published');
  const asOf = params.get('published_at').slice(4);
  const selectedKinds = params.get('kind').replace(/^(eq\.|in\.\()|\)$/g, '').split(',');
  const data = seed.map(([kind, slug, featured, status = 'published', published_at = '2020-01-01T00:00:00Z'], i) => ({
    id: String(i), kind, slug, featured, status, published_at, metadata: { tags: ['Astro'], role: '테스트 작업', category: '테스트', period: '2026' },
    blog_number: installed ? slug === 'test-post' ? 1 : slug === 'scheduled-post' ? 2 : null : null,
    blog_view_counts: slug === 'test-post' ? { total: views.size } : null,
    title: `현재 제목 ${slug} ${version}`, summary: `현재 요약 ${slug} ${version}`,
    body: `## 변경된 본문\n\n현재 본문 ${slug} ${version}`, sort_order: i,
  })).filter(row => selectedKinds.includes(row.kind) && row.status === 'published' &&
    new Date(row.published_at) <= new Date(asOf) && (!params.has('slug') || params.get('slug') === `eq.${row.slug}`) &&
    (!params.has('featured') || row.featured) && (!params.has('blog_number') || params.get('blog_number') === `eq.${row.blog_number}`));
  const offset = Number(params.get('offset') || 0);
  return Response.json(data.slice(offset, offset + Number(params.get('limit') || 500)));
};

const { default: bundle } = await import('../.vercel/output/functions/_render.func/.vercel/output/server/entry.mjs');
const request = (path, init) => bundle.fetch(new Request(`https://juno31323.me${path}`, init));
const check = async (path, visible) => {
  const res = await request(path);
  assert.equal(res.status, 200, path);
  assert.match(res.headers.get('cache-control'), /no-store/);
  const html = await res.text();
  for (const value of visible) assert.ok(html.includes(value), `${path} must render ${value} in the first HTML`);
  assert.doesNotMatch(html, /현재 제목 (draft-post|archived-project|scheduled-post)|글을 불러오는 중입니다/);
};
await check('/', ['현재 소개 1', '현재 제목 firezone 1', '현재 제목 recent-event 1', '현재 제목 test-post 1']);
await check('/projects/', ['현재 제목 firezone 1']);
await check('/projects/firezone/', ['현재 본문 firezone 1']);
await check('/research/', ['현재 제목 university-notice-rag 1']);
await check('/research/university-notice-rag/', ['현재 본문 university-notice-rag 1']);
await check('/about/', ['현재 소개 1', '현재 본문 about 1']);
await check('/timeline/', ['현재 본문 recent-event 1']);
await check('/blog/?tag=Astro', ['현재 제목 test-post 1', '/blog/1/', '조회 0회']);
await check('/blog/1/', ['현재 본문 test-post 1', 'data-view-count']);
for (const path of ['/entry/?type=posts&slug=test-post', '/blog/test-post/']) {
  const redirect = await request(path);
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('location'), '/blog/1/');
}
for (const path of ['/blog/draft-post/', '/blog/2/', '/projects/archived-project/']) assert.equal((await request(path)).status, 404, path);
const viewRequest = (cookie = '', origin = 'https://juno31323.me') => request('/api/blog/1/view/', { method: 'POST', headers: { Origin: origin, Cookie: cookie } });
assert.equal((await viewRequest('', 'https://example.test')).status, 403);
const firstView = await viewRequest();
assert.equal(firstView.status, 200);
assert.deepEqual(await firstView.json(), { count: 1 });
const cookie = firstView.headers.get('set-cookie');
assert.match(cookie, /HttpOnly/i);
assert.match(cookie, /Secure/i);
assert.deepEqual(await (await viewRequest(cookie.split(';')[0])).json(), { count: 1 });
assert.deepEqual(await (await viewRequest()).json(), { count: 2 });
await check('/blog/', ['조회 2회']);
assert.doesNotMatch(await (await request('/blog/1/')).text(), /분 읽기/);

version = 2;
await check('/', ['현재 소개 2', '현재 제목 firezone 2']);
await check('/projects/firezone/', ['현재 본문 firezone 2']);
installed = false;
await check('/blog/test-post/', ['현재 본문 test-post 2']);
assert.equal((await request('/blog/1/')).status, 404);
installed = true;
offline = true;
const failure = await request('/');
assert.equal(failure.status, 503);
assert.doesNotMatch(await failure.text(), /현재 소개|class="feature-card"/);
console.log('PASS: current HTML on nine public routes, immediate edits, visibility rules, legacy URLs and no stale fallback on failure.');
