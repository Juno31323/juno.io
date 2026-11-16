import { supabase } from '../lib/supabase';
import { type Entry, entryUrl, localUrl, dateLabel, safeUrl } from '../lib/cms';
import { markdown } from '../lib/markdown';
import { setupBlog, enhanceReader } from './blog-content';
import { workKeywords } from '../lib/work-keywords';
import { projectArt } from '../data/project-art';

const text = (tag: string, value: string, className = '') => {
  const el = document.createElement(tag); el.textContent = value; el.className = className; return el;
};
const visibleEntries = () => supabase!.from('entries').select('*').eq('status', 'published').lte('published_at', new Date().toISOString());
function keywords(entry: Entry) {
  const values = workKeywords(entry.metadata.listRole, entry.slug);
  if (!values.length) return null;
  const list = text('ul', '', 'keyword-list');
  list.setAttribute('aria-label', '기술');
  list.append(...values.map(value => text('li', value)));
  return list;
}
function featuredCard(entry: Entry, index: number) {
  const li = text('li', '', index === 0 ? 'feature-lead' : '');
  const link = document.createElement('a');
  link.className = 'feature-card';
  link.href = entryUrl(entry);
  const copy = text('div', '', 'feature-copy');
  const title = text('div', '', 'feature-title');
  const arrow = text('span', '↗');
  arrow.setAttribute('aria-hidden', 'true');
  title.append(text('h3', entry.title), arrow);
  copy.append(text('p', entry.metadata.category || '', 'feature-category'), title);
  if (entry.summary) copy.append(text('p', entry.summary, 'feature-summary'));
  const list = keywords(entry);
  if (list) copy.append(list);
  link.append(copy);
  const imageUrl = safeUrl(entry.metadata.cardImage);
  const legacyArt = projectArt[entry.slug as keyof typeof projectArt];
  const flow = document.querySelector<HTMLTemplateElement>('[data-firezone-flow]');
  if (imageUrl && imageUrl !== safeUrl(legacyArt?.src)) {
    const image = document.createElement('img');
    image.className = 'feature-asset';
    image.src = imageUrl;
    image.alt = entry.metadata.cardAlt || entry.title;
    image.loading = 'lazy';
    image.decoding = 'async';
    link.append(image);
  } else if (entry.kind === 'projects' && entry.slug === 'firezone' && flow) link.append(flow.content.cloneNode(true));
  li.append(link);
  return li;
}
function workRow(entry: Entry) {
  const li = document.createElement('li'); const a = document.createElement('a');
  a.className = 'work-row'; a.href = entryUrl(entry);
  const main = text('div', '', 'work-main'); main.append(text('h2', entry.title));
  if (entry.metadata.showSummary !== false && entry.summary) main.append(text('p', entry.summary));
  const list = keywords(entry); if (list) main.append(list);
  const meta = text('div', '', 'work-meta');
  [entry.metadata.category, entry.metadata.status, entry.metadata.period].filter(Boolean).forEach(value => meta.append(text('span', value)));
  const arrow = document.createElement('span'); arrow.className = 'work-arrow';
  arrow.innerHTML = '<svg class="arrow" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>';
  a.append(main, meta, arrow); li.append(a); return li;
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
  const detailKeywords = container.querySelector('[data-detail-keywords]');
  if (detailKeywords) {
    const tags = workKeywords(entry.metadata.listRole, entry.slug);
    detailKeywords.replaceChildren(...tags.map(value => text('li', value)));
    detailKeywords.toggleAttribute('hidden', !tags.length);
  }
  const links = container.querySelector('[data-work-links]');
  if (links && Array.isArray(entry.metadata.links)) {
    links.replaceChildren();
    for (const item of entry.metadata.links) {
      const url = safeUrl(item?.url);
      if (!url || typeof item?.label !== 'string' || !item.label.trim()) continue;
      const link = document.createElement('a');
      link.className = 'outline-link';
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = item.label;
      links.append(link);
    }
    links.toggleAttribute('hidden', links.childElementCount === 0);
  }
  const article = container.querySelector('.prose');
  if (article) for (const link of entry.metadata.links || []) {
    const url = safeUrl(link.url); if (!url) continue;
    const a = text('a', link.label, 'text-link') as HTMLAnchorElement; a.href = url; article.append(a);
  }
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
  if (kind === 'posts') { container.querySelector('[data-entry-date]')!.textContent = dateLabel(data.published_at); await enhanceReader(data, container); }
}

async function portfolio() {
  if (!supabase) return;
  const path = location.pathname.replace(import.meta.env.BASE_URL.replace(/\/$/, ''), '');
  const detail = document.querySelector<HTMLElement>('[data-work-id]');
  if (detail) {
    const { data, error } = await visibleEntries().eq('kind', detail.dataset.workKind!).eq('slug', detail.dataset.workId!).maybeSingle();
    if (!error && data) applyDetail(data);
    else if (!error) { document.querySelector('.detail-header')!.innerHTML = '<h1>공개된 기록이 없습니다.</h1>'; document.querySelectorAll('.work-article, .work-image, .work-feature').forEach(el => el.remove()); }
  }
  if (['/projects/', '/research/'].includes(path)) {
    let query = visibleEntries().order('sort_order');
    query = path === '/projects/' ? query.in('kind', ['projects', 'research']) : query.eq('kind', 'research');
    const { data, error } = await query;
    if (!error) {
      const list = document.querySelector('.work-list'); list?.replaceChildren(...(data || []).map(workRow));
      const count = document.querySelector('.list-topline span'); if (count) count.textContent = `총 ${data?.length || 0}개`;
      document.querySelector('.research-index .research-evidence')?.toggleAttribute('hidden', !data?.some(entry => entry.slug === 'university-notice-rag'));
    }
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
      const list = document.querySelector('[data-featured-works]');
      list?.replaceChildren(...(data || []).map(featuredCard));
      document.querySelector('[data-featured-empty]')?.toggleAttribute('hidden', Boolean(data?.length));
    }
  }
}

async function profile() {
  if (!supabase) return;
  const { data } = await supabase.from('site_settings').select('data').eq('id', 'profile').maybeSingle();
  if (!data) return;
  const p = data.data;
  for (const selector of ['.wordmark', '.footer-name', '#hero-title', '.aside-label']) { const el = document.querySelector(selector); if (el) el.textContent = p.name; }
  document.querySelectorAll('.hero-intro p, [data-profile-intro]').forEach(el => el.textContent = p.intro);
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

async function homePosts() {
  const list = document.querySelector('[data-home-posts]'), status = document.querySelector('[data-home-posts-status]');
  if (!list || !status) return;
  if (!supabase) { status.textContent = '아직 올린 글이 없습니다.'; return; }
  try {
    const { data, error } = await visibleEntries().eq('kind', 'posts').order('published_at', { ascending: false }).order('id').limit(3);
    if (error) throw error;
    list.replaceChildren(...(data || []).map((entry: Entry) => {
      const li = document.createElement('li'), a = document.createElement('a'), time = document.createElement('time');
      a.href = entryUrl(entry); time.dateTime = entry.published_at; time.textContent = dateLabel(entry.published_at);
      a.append(time, text('h3', entry.title));
      if (entry.summary) a.append(text('p', entry.summary, 'post-summary'));
      li.append(a); return li;
    }));
    status.textContent = data?.length ? '' : '아직 올린 글이 없습니다.'; status.toggleAttribute('hidden', Boolean(data?.length));
  } catch { status.textContent = '최근 글을 불러오지 못했습니다. 글 목록에서 다시 확인해 주세요.'; }
}
async function homeTimeline() {
  const list = document.querySelector('.dashboard-timeline-list'); if (!list || !supabase) return;
  const { data, error } = await visibleEntries().eq('kind', 'timeline').order('sort_order').limit(3);
  if (error) return;
  list.replaceChildren(...(data || []).map((entry: Entry) => {
    const li = document.createElement('li'), a = document.createElement('a'); a.href = localUrl('/timeline/');
    a.append(text('span', entry.metadata.period || '', 'note-date'), text('h3', entry.title), text('span', entry.metadata.category || '', 'note-category'));
    li.append(a); return li;
  }));
}
void Promise.allSettled([setupBlog(), entryPage(), portfolio(), profile(), homePosts(), homeTimeline()]);
