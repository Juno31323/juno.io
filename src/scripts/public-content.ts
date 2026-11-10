import { supabase } from '../lib/supabase';
import { type Entry, entryUrl, localUrl, dateLabel, safeUrl } from '../lib/cms';
import { markdown } from '../lib/markdown';

const text = (tag: string, value: string, className = '') => {
  const el = document.createElement(tag); el.textContent = value; el.className = className; return el;
};
const visibleEntries = () => supabase!.from('entries').select('*').eq('status', 'published').lte('published_at', new Date().toISOString());
function workRow(entry: Entry) {
  const li = document.createElement('li'); const a = document.createElement('a');
  a.className = 'work-row'; a.href = entryUrl(entry);
  const main = text('div', '', 'work-main'); main.append(text('h3', entry.title), text('p', entry.summary));
  const meta = text('div', '', 'work-meta');
  [entry.metadata.category, entry.metadata.listRole, entry.metadata.status].filter(Boolean).forEach(value => meta.append(text('span', value)));
  a.append(main, meta); li.append(a); return li;
}
function bodyInto(element: Element | null, value: string) { if (element) element.innerHTML = markdown(value); }
function applyDetail(entry: Entry, container: ParentNode = document) {
  const heading = container.querySelector('h1'); if (heading) heading.textContent = entry.title;
  const summary = container.querySelector('.detail-summary'); if (summary) summary.textContent = entry.summary;
  bodyInto(container.querySelector('.prose'), entry.body);
  document.title = `${entry.title} — 민준호`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', entry.summary || entry.title);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', document.title);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', entry.summary || entry.title);
  const dl = container.querySelector('.detail-meta');
  if (dl) {
    dl.replaceChildren();
    for (const [key, label] of [['category', '분야'], ['role', '맡은 일'], ['period', '기간'], ['status', '상태']]) {
      if (entry.metadata[key]) { const row = document.createElement('div'); row.append(text('dt', label), text('dd', entry.metadata[key])); dl.append(row); }
    }
  }
  const article = container.querySelector('.prose');
  if (article) for (const link of entry.metadata.links || []) {
    const url = safeUrl(link.url); if (!url) continue;
    const a = text('a', link.label, 'text-link') as HTMLAnchorElement; a.href = url; article.append(a);
  }
}

async function blog() {
  const list = document.querySelector('[data-blog-list]'); if (!list) return;
  const status = document.querySelector('[data-blog-status]')!;
  if (!supabase) { status.textContent = '블로그를 준비하고 있습니다.'; return; }
  const search = document.querySelector<HTMLInputElement>('#blog-search')!;
  const more = document.querySelector<HTMLButtonElement>('[data-blog-more]')!;
  let page = 0, busy = false, generation = 0;
  const load = async (reset = false) => {
    if (busy && !reset) return;
    if (reset) { page = 0; list.replaceChildren(); }
    const request = ++generation; busy = true; more.disabled = true; more.hidden = true;
    status.textContent = '글을 불러오는 중입니다.';
    let query = visibleEntries().eq('kind', 'posts').order('published_at', { ascending: false }).order('id').range(page * 10, page * 10 + 10);
    const term = search.value.trim().replace(/[%_\\]/g, '\\$&');
    if (term) query = query.ilike('title', `%${term}%`);
    const { data, error } = await query;
    if (request !== generation) return;
    busy = false; more.disabled = false;
    if (error) { status.textContent = '글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'; more.textContent = '다시 시도'; more.hidden = false; return; }
    const entries = (data || []) as Entry[];
    for (const entry of entries.slice(0, 10)) {
      const li = document.createElement('li'), a = document.createElement('a'); a.href = entryUrl(entry);
      a.append(text('time', dateLabel(entry.published_at)), text('h2', entry.title), text('p', entry.summary)); li.append(a); list.append(li);
    }
    status.textContent = !list.children.length ? (term ? '검색한 제목의 글이 없습니다.' : '아직 올린 글이 없습니다. 첫 기록을 준비하고 있습니다.') : '';
    more.textContent = '더 보기'; more.hidden = entries.length <= 10; page++;
  };
  let timer: ReturnType<typeof setTimeout>;
  search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => void load(true), 300); });
  more.addEventListener('click', () => void load()); await load();
}

async function entryPage() {
  const container = document.querySelector('[data-entry]'); if (!container) return;
  const status = container.querySelector('[data-entry-status]')!;
  const params = new URLSearchParams(location.search), kind = params.get('type') || 'posts', slug = params.get('slug');
  const back = container.querySelector<HTMLAnchorElement>('[data-entry-back]')!;
  const sections: Record<string, string> = { posts: '글', projects: '만든 것들', research: '연구와 발표', timeline: '전체 이력', pages: '저에 대해' };
  back.href = localUrl(kind === 'posts' ? '/blog/' : kind === 'pages' ? '/about/' : `/${kind}/`); back.textContent = `${sections[kind] || '글'} 목록으로`;
  if (!supabase) { container.querySelector('h1')!.textContent = '기록을 준비하고 있습니다.'; return; }
  const { data, error } = await visibleEntries().eq('kind', kind).eq('slug', slug || '').maybeSingle();
  if (error) { container.querySelector('h1')!.textContent = '기록을 불러오지 못했습니다.'; status.textContent = '잠시 후 이 페이지를 새로고침해 주세요.'; return; }
  if (!data) { container.querySelector('h1')!.textContent = '공개된 기록이 없습니다.'; status.textContent = '주소를 확인하거나 목록에서 다른 글을 골라 주세요.'; return; }
  applyDetail(data, container);
  if (kind === 'posts') container.querySelector('[data-entry-date]')!.textContent = dateLabel(data.published_at);
}

async function portfolio() {
  if (!supabase) return;
  const path = location.pathname.replace(import.meta.env.BASE_URL.replace(/\/$/, ''), '');
  const detail = document.querySelector<HTMLElement>('[data-work-id]');
  if (detail) {
    const { data, error } = await visibleEntries().eq('kind', detail.dataset.workKind!).eq('slug', detail.dataset.workId!).maybeSingle();
    if (!error && data) applyDetail(data);
    else if (!error) { document.querySelector('.detail-header')!.innerHTML = '<h1>공개된 기록이 없습니다.</h1>'; document.querySelector('.work-article')?.replaceChildren(); document.querySelector('.work-image')?.remove(); }
  }
  if (['/projects/', '/research/'].includes(path)) {
    let query = visibleEntries().order('sort_order');
    query = path === '/projects/' ? query.in('kind', ['projects', 'research']) : query.eq('kind', 'research');
    const { data, error } = await query;
    if (!error) { const list = document.querySelector('.work-list'); list?.replaceChildren(...(data || []).map(workRow)); const count = document.querySelector('.list-topline span'); if (count) count.textContent = `총 ${data?.length || 0}개`; }
  }
  if (path === '/about/') {
    const { data } = await visibleEntries().eq('kind', 'pages').eq('slug', 'about').maybeSingle();
    if (data) bodyInto(document.querySelector('.about-layout .prose'), data.body);
  }
  if (path === '/timeline/') {
    const { data, error } = await visibleEntries().eq('kind', 'timeline').order('sort_order');
    if (!error) {
      const list = document.querySelector('.timeline-list');
      list?.replaceChildren(...(data || []).map((entry: Entry) => {
        const li = document.createElement('li'), content = document.createElement('div');
        content.append(text('h2', entry.title), text('span', entry.metadata.category || '', 'work-category'));
        const prose = text('div', '', 'prose'); prose.innerHTML = markdown(entry.body); content.append(prose);
        li.append(text('span', entry.metadata.period || '', 'timeline-period'), content); return li;
      }));
    }
  }
  if (path === '/') {
    const { data, error } = await visibleEntries().in('kind', ['projects', 'research']).eq('featured', true).order('sort_order').limit(3);
    if (!error) {
      const list = document.querySelector('.home-work-list');
      list?.replaceChildren(...(data || []).map((entry: Entry, index: number) => {
        const li = workRow(entry), a = li.querySelector('a')!; a.classList.add('home-work');
        if (!index) a.classList.add('home-work-featured');
        const image = safeUrl(entry.metadata.cardImage);
        if (image) { const img = document.createElement('img'); img.src = image; img.alt = entry.metadata.cardAlt || entry.title; img.className = 'home-work-art'; a.prepend(img); }
        a.querySelector('.work-main')?.classList.add('home-work-copy'); a.querySelector('.work-meta')?.remove(); return li;
      }));
    }
  }
}

async function profile() {
  if (!supabase) return;
  const { data } = await supabase.from('site_settings').select('data').eq('id', 'profile').maybeSingle();
  if (!data) return;
  const p = data.data;
  for (const selector of ['.wordmark', '.footer-name', '#hero-title', '.aside-label']) { const el = document.querySelector(selector); if (el) el.textContent = p.name; }
  const intro = document.querySelector('.hero-intro p'); if (intro) intro.textContent = p.intro;
  for (const selector of ['.profile-school', '.site-footer > p', '.article-aside > p']) { const el = document.querySelector(selector); if (el) el.textContent = `${p.school} ${p.major}`; }
  for (const [selector, src] of [['.hero-portrait img', p.heroPhoto], ['.profile-photo', p.photo]]) {
    const image = document.querySelector<HTMLImageElement>(selector); const url = safeUrl(src);
    if (image && url) { image.src = url; image.alt = p.photoAlt || `${p.name} 프로필 사진`; }
  }
  const github = safeUrl(p.github);
  if (github) document.querySelectorAll<HTMLAnchorElement>('.hero-links .outline-link, .footer-links a[target]').forEach(a => a.href = github);
  if (p.interests) { const old = document.querySelector('.interests .interest-list'); if (old) { const content = text('div', '', 'interest-list prose'); content.innerHTML = markdown(p.interests); old.replaceWith(content); } }
  if (p.researchSummary) { const el = document.querySelector('.research-summary > p'); if (el) el.textContent = p.researchSummary; }
}

void Promise.allSettled([blog(), entryPage(), portfolio(), profile()]);
