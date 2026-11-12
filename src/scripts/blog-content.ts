import { supabase } from '../lib/supabase';
import { type Entry, entryUrl, localUrl, dateLabel } from '../lib/cms';
import { tagsOf, seriesOf, coverOf, readTime } from '../lib/blog';

const text = (tag: string, value: string, className = '') => { const el = document.createElement(tag); el.textContent = value; el.className = className; return el; };
async function catalog(): Promise<Entry[]> {
  const entries: Entry[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase!.from('entries').select('id,kind,slug,title,summary,published_at,status,metadata').eq('kind', 'posts').eq('status', 'published').lte('published_at', new Date().toISOString()).order('published_at', { ascending: false }).order('id').range(offset, offset + 499);
    if (error) throw error; entries.push(...data as Entry[]); if (data.length < 500) return entries;
  }
}
export async function setupBlog() {
  const list = document.querySelector<HTMLElement>('[data-blog-list]'); if (!list) return;
  const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
  const status = $('[data-blog-status]'), more = $<HTMLButtonElement>('[data-blog-more]'), search = $<HTMLInputElement>('#blog-search'), series = $<HTMLSelectElement>('#blog-series'), sort = $<HTMLSelectElement>('#blog-sort');
  let entries: Entry[] = [], activeTag = '', view = 'posts', limit = 12, loaded = false;
  const readState = () => { const params = new URLSearchParams(location.search); search.value = (params.get('q') || '').slice(0, 100); activeTag = params.get('tag') || ''; series.value = params.get('series') || ''; sort.value = params.get('sort') === 'oldest' ? 'oldest' : 'latest'; view = params.get('view') === 'series' ? 'series' : 'posts'; };
  const writeState = () => {
    const url = new URL(location.href); for (const key of ['q', 'tag', 'series', 'sort', 'view']) url.searchParams.delete(key);
    for (const [key, value] of [['q', search.value.trim()], ['tag', activeTag], ['series', series.value], ['sort', sort.value === 'oldest' ? 'oldest' : ''], ['view', view === 'series' ? 'series' : '']]) if (value) url.searchParams.set(key, value);
    history.replaceState(null, '', url);
  };
  function render() {
    more.textContent = '더 보기'; more.hidden = true;
    const term = search.value.trim().toLocaleLowerCase();
    const filtered = entries.filter(entry => (!activeTag || tagsOf(entry).includes(activeTag)) && (!series.value || seriesOf(entry) === series.value) && (!term || [entry.title, entry.summary, ...tagsOf(entry)].join(' ').toLocaleLowerCase().includes(term)));
    if (sort.value === 'oldest') filtered.reverse();
    $('[data-blog-count]').textContent = `${filtered.length}개의 글`;
    document.querySelectorAll<HTMLButtonElement>('[data-blog-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.blogView === view)));
    document.querySelectorAll<HTMLButtonElement>('[data-tag]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.tag === activeTag)));
    list!.hidden = view !== 'posts'; $('[data-blog-series-list]').hidden = view !== 'series';
    status.textContent = !filtered.length ? (term ? '검색 결과가 없습니다.' : entries.length ? '선택한 조건의 글이 없습니다.' : '아직 올린 글이 없습니다. 첫 기록을 준비하고 있습니다.') : '';
    list!.replaceChildren(...filtered.slice(0, limit).map(entry => {
      const li = document.createElement('li'), a = document.createElement('a'), content = text('div', '', 'post-card-copy'); a.href = entryUrl(entry);
      const cover = coverOf(entry); if (cover) { const img = document.createElement('img'); img.src = cover; img.alt = typeof entry.metadata.coverAlt === 'string' ? entry.metadata.coverAlt : entry.title; img.loading = 'lazy'; img.width = 480; img.height = 270; a.append(img); }
      const time = document.createElement('time'); time.dateTime = entry.published_at; time.textContent = dateLabel(entry.published_at);
      const meta = text('div', '', 'post-card-meta'); meta.append(time, text('span', readTime(entry)));
      content.append(meta, text('h2', entry.title)); if (entry.summary) content.append(text('p', entry.summary));
      const tags = text('div', '', 'tag-list'); tagsOf(entry).forEach(tag => tags.append(text('span', tag, 'tag'))); content.append(tags);
      const seriesName = seriesOf(entry); if (seriesName) content.append(text('span', seriesName, 'post-series'));
      a.append(content); li.append(a); return li;
    }));
    if (view === 'posts') more.hidden = filtered.length <= limit;
    else {
      const groups = new Map<string, Entry[]>(); filtered.forEach(entry => { const name = seriesOf(entry); if (name) groups.set(name, [...groups.get(name) || [], entry]); });
      $('[data-blog-series-list]').replaceChildren(...[...groups].map(([name, posts]) => {
        const li = document.createElement('li'), button = document.createElement('button'); button.type = 'button';
        button.append(text('span', `${posts.length}개의 글`, 'cms-help'), text('h2', name), text('p', posts[0].title));
        button.addEventListener('click', () => { series.value = name; view = 'posts'; change(); }); li.append(button); return li;
      }));
      if (filtered.length && !groups.size) status.textContent = '아직 묶어 둔 시리즈가 없습니다. 모든 글에서 읽어 보세요.';
    }
  }
  function change() { if (!loaded) return; limit = 12; writeState(); render(); }
  let timer: ReturnType<typeof setTimeout>;
  search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(change, 200); });
  series.addEventListener('change', () => { view = 'posts'; change(); }); sort.addEventListener('change', change);
  document.querySelectorAll<HTMLButtonElement>('[data-blog-view]').forEach(button => button.addEventListener('click', () => { view = button.dataset.blogView!; change(); }));
  $('[data-blog-reset]').addEventListener('click', () => { search.value = ''; series.value = ''; sort.value = 'latest'; activeTag = ''; change(); });
  window.addEventListener('popstate', () => { readState(); limit = 12; if (loaded) render(); });
  async function load() {
    if (!supabase) { status.textContent = '블로그를 준비하고 있습니다.'; return; }
    more.hidden = true; status.textContent = '글을 불러오는 중입니다.';
    try {
      entries = await catalog(); loaded = true;
      const names = [...new Set(entries.map(seriesOf).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
      series.replaceChildren(new Option('전체 시리즈', ''), ...names.map(name => new Option(name, name)));
      const counts = new Map<string, number>(); entries.forEach(entry => tagsOf(entry).forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1)));
      const button = (tag: string, count: number) => { const el = document.createElement('button'); el.type = 'button'; el.dataset.tag = tag; el.textContent = `${tag || '전체'} · ${count}`; el.addEventListener('click', () => { activeTag = tag; change(); }); return el; };
      $('[data-blog-tags]').replaceChildren(button('', entries.length), ...[...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko')).map(([tag, count]) => button(tag, count)));
      readState(); render();
    } catch { loaded = false; status.textContent = '글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'; more.textContent = '다시 시도'; more.hidden = false; }
  }
  more.addEventListener('click', () => { if (!loaded) void load(); else { limit += 12; render(); } }); await load();
}

export async function enhanceReader(entry: Entry, container: Element) {
  const $ = <T extends HTMLElement>(selector: string) => container.querySelector<T>(selector)!;
  const body = $('[data-entry-body]'), toc = $('[data-entry-toc]'), sidebar = $('.reader-sidebar');
  $('[data-reading-time]').textContent = readTime(entry);
  const tags = $('[data-entry-tags]');
  tags.replaceChildren(...tagsOf(entry).map(tag => { const a = text('a', tag, 'tag') as HTMLAnchorElement; a.href = `${localUrl('/blog/')}?tag=${encodeURIComponent(tag)}`; return a; }));
  const name = seriesOf(entry), label = $('[data-entry-series-label]');
  if (name) { const a = text('a', name, 'series-label') as HTMLAnchorElement; a.href = `${localUrl('/blog/')}?series=${encodeURIComponent(name)}`; label.append(a); }
  const cover = $<HTMLImageElement>('[data-entry-cover]'), url = coverOf(entry); if (url) { cover.src = url; cover.alt = entry.metadata.coverAlt || entry.title; cover.hidden = false; }
  const headings = Array.from(body.querySelectorAll<HTMLHeadingElement>('h2, h3'));
  headings.forEach((heading, index) => {
    heading.id = `section-${index + 1}`; heading.tabIndex = -1;
    const a = document.createElement('a'); a.href = `#${heading.id}`; a.textContent = heading.textContent; a.dataset.level = heading.tagName;
    a.addEventListener('click', () => { requestAnimationFrame(() => heading.focus({ preventScroll: true })); }); toc.append(a);
  });
  sidebar.hidden = !headings.length && !name; $('.reader-toc').hidden = !headings.length;
  if (location.hash) { const target = headings.find(h => `#${h.id}` === location.hash); target?.scrollIntoView(); }
  let observer: IntersectionObserver | undefined;
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(records => { const visible = records.find(r => r.isIntersecting); if (!visible) return; toc.querySelectorAll('a').forEach(a => { if (a.hash === `#${visible.target.id}`) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); }); }, { rootMargin: '-10% 0px -65% 0px' });
    headings.forEach(h => observer!.observe(h)); window.addEventListener('pagehide', () => observer?.disconnect(), { once: true });
  }
  const feedback = $('[data-entry-status]');
  async function copy(value: string, button: HTMLButtonElement, success: string) {
    try { await navigator.clipboard.writeText(value); button.textContent = success; feedback.textContent = success; }
    catch { feedback.textContent = '복사하지 못했습니다. 텍스트나 주소를 직접 선택해 복사해 주세요.'; }
  }
  body.querySelectorAll('pre').forEach(pre => {
    const code = pre.querySelector('code'); if (!code) return;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'copy-code'; button.textContent = '코드 복사'; button.addEventListener('click', () => void copy(code.textContent || '', button, '복사됨')); pre.append(button);
  });
  const copyLink = $<HTMLButtonElement>('[data-copy-link]'); copyLink.hidden = false; copyLink.addEventListener('click', () => void copy(location.href, copyLink, '링크 복사됨'));
  try {
    const posts = await catalog(), related = name ? posts.filter(post => seriesOf(post) === name).reverse() : [...posts].reverse(), index = related.findIndex(post => post.id === entry.id);
    if (name && related.length) {
      sidebar.hidden = false; $('[data-series-panel]').hidden = false; $('[data-series-title]').textContent = name;
      $('[data-series-posts]').replaceChildren(...related.map(post => { const li = document.createElement('li'), a = document.createElement('a'); a.href = entryUrl(post); a.textContent = post.title; if (post.id === entry.id) a.setAttribute('aria-current', 'page'); li.append(a); return li; }));
    }
    const nav = $('[data-post-navigation]');
    for (const [post, label] of [[related[index - 1], '이전 글'], [related[index + 1], '다음 글']] as const) if (index >= 0 && post) { const a = document.createElement('a'); a.href = entryUrl(post); a.append(text('span', label, 'cms-help'), text('strong', post.title)); nav.append(a); }
    nav.hidden = !nav.children.length;
  } catch { /* The article remains readable if navigation cannot load. */ }
}
