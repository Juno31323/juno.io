import { type Entry, type EntryKind, safeUrl } from '../lib/cms';
import { readingMinutes } from '../lib/blog';
import { markdown } from '../lib/markdown';

type Draft = { savedAt: string; version?: string; values: Record<string, string | boolean> };
const commands = [
  { id: 'heading', label: '소제목', hint: 'H2', before: '## ', sample: '소제목', after: '' },
  { id: 'bold', label: '굵게', hint: 'Ctrl+B', before: '**', sample: '강조할 내용', after: '**' },
  { id: 'italic', label: '기울임', hint: 'Ctrl+I', before: '*', sample: '기울일 내용', after: '*' },
  { id: 'quote', label: '인용', hint: '>', before: '> ', sample: '인용할 내용', after: '' },
  { id: 'list', label: '목록', hint: '−', before: '- ', sample: '항목', after: '\n- ' },
  { id: 'code', label: '코드 블록', hint: '```', before: '```text\n', sample: '코드', after: '\n```' },
  { id: 'link', label: '링크', hint: '↗', before: '[', sample: '링크 이름', after: '](https://example.com)' },
  { id: 'table', label: '표', hint: '2 × 2', before: '', sample: '| 항목 | 내용 |\n| --- | --- |\n|  |  |', after: '\n' },
  { id: 'divider', label: '구분선', hint: '—', before: '\n---\n', sample: '', after: '' },
];

export function createWriter(form: HTMLFormElement, changed: () => void, message: (text: string, error?: boolean) => void, restoreVersion: (version?: string) => void) {
  const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement;
  const body = $<HTMLTextAreaElement>('#entry-body');
  let mode = 'edit', owner = '', entry: Entry | null = null, kind: EntryKind = 'posts', timer: ReturnType<typeof setTimeout> | undefined, slashStart = -1;
  const prefix = () => `juno-writer:v1:${owner}:`;
  const key = (isNew = false) => `${prefix()}${kind}:${isNew ? 'new' : entry?.id || 'new'}`;
  const read = (draftKey: string): Draft | null => { try { const value = JSON.parse(localStorage.getItem(draftKey) || 'null'); return value && typeof value.values === 'object' && typeof value.savedAt === 'string' ? value : null; } catch { return null; } };
  const fields = () => Array.from(form.elements).filter((el): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement => (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) && Boolean(el.name));
  function persist() {
    clearTimeout(timer); if (!owner) return;
    const values = Object.fromEntries(fields().map(el => [el.name, el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : el.value]));
    try {
      localStorage.setItem(key(), JSON.stringify({ savedAt: new Date().toISOString(), version: entry?.updated_at, values }));
      $('#local-save-status').textContent = '이 기기에 임시 보관됨';
    } catch { $('#local-save-status').textContent = '기기 보관 불가 · 저장 버튼을 눌러 주세요'; }
  }
  function refresh() {
    $('#writing-count').textContent = `${body.value.length.toLocaleString('ko-KR')}자 · 약 ${readingMinutes(body.value)}분`;
    if (mode !== 'edit') $('#body-preview').innerHTML = markdown(body.value) || '<p class="cms-help">작성한 내용이 여기에 표시됩니다.</p>';
    const tags = [...new Set(field('tags').value.split(',').map(t => t.trim()).filter(Boolean))].slice(0, 8);
    $('#editor-tags').replaceChildren(...tags.map(tag => { const span = document.createElement('span'); span.className = 'tag'; span.textContent = tag; return span; }));
    const cover = $<HTMLImageElement>('#cover-preview'), url = safeUrl(field('coverImage').value);
    cover.hidden = !url; if (url && cover.getAttribute('src') !== url) cover.src = url; if (!url) cover.removeAttribute('src'); cover.alt = field('coverAlt').value || '커버 미리보기';
    const status = field('status').value;
    $('#save-entry').textContent = status === 'draft' ? '초안 저장' : status === 'archived' ? '보관하기' : new Date(field('published_at').value) > new Date() ? '예약 발행' : entry?.status === 'published' ? '변경 저장' : '공개로 저장';
  }
  function editChanged() { changed(); refresh(); clearTimeout(timer); timer = setTimeout(persist, 400); }
  function setMode(next: string) {
    mode = next; $('#writing-canvas').dataset.mode = mode; $('#body-label').hidden = mode === 'preview'; $('#body-preview').hidden = mode === 'edit';
    for (const [id, value] of [['edit', 'edit'], ['split', 'split'], ['preview', 'preview']]) $(`#${id}-tab`).setAttribute('aria-pressed', String(mode === value));
    $('.format-toolbar').hidden = mode === 'preview'; hideSlash(); refresh();
  }
  function hideSlash() { $('#slash-menu').hidden = true; body.setAttribute('aria-expanded', 'false'); slashStart = -1; }
  function apply(id: string, fromSlash = false) {
    const command = commands.find(c => c.id === id); if (!command) return;
    if (mode === 'preview') setMode('edit');
    const start = fromSlash && slashStart >= 0 ? slashStart : body.selectionStart, end = body.selectionEnd;
    const selected = fromSlash ? '' : body.value.slice(start, end);
    const needsLine = ['heading', 'quote', 'list', 'code', 'table', 'divider'].includes(id) && start > 0 && body.value[start - 1] !== '\n';
    const before = (needsLine ? '\n' : '') + command.before, content = selected || command.sample;
    body.setRangeText(before + content + command.after, start, end, 'end');
    body.setSelectionRange(start + before.length, start + before.length + content.length); hideSlash(); body.focus(); editChanged();
  }
  function checkSlash() {
    if (body.selectionStart !== body.selectionEnd) { hideSlash(); return; }
    const lineStart = body.value.lastIndexOf('\n', body.selectionStart - 1) + 1;
    const line = body.value.slice(lineStart, body.selectionStart);
    if (!/^\/[\p{L}\d -]*$/u.test(line)) { hideSlash(); return; }
    slashStart = lineStart; const query = line.slice(1).toLowerCase(), menu = $('#slash-menu');
    const matches = commands.filter(c => `${c.label} ${c.id}`.toLowerCase().includes(query));
    menu.replaceChildren(...matches.map(c => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = `${c.label}  ${c.hint}`;
      button.addEventListener('click', () => apply(c.id, true)); return button;
    }));
    menu.hidden = !matches.length; body.setAttribute('aria-expanded', String(matches.length > 0));
    if (matches.length) {
      const mirror = document.createElement('div'), marker = document.createElement('span'), style = getComputedStyle(body);
      Object.assign(mirror.style, { position: 'fixed', left: '-10000px', top: '0', visibility: 'hidden', width: `${body.clientWidth}px`, boxSizing: 'border-box', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', font: style.font, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing, padding: style.padding });
      mirror.textContent = body.value.slice(0, body.selectionStart); marker.textContent = '|'; mirror.append(marker); document.body.append(mirror);
      const caret = marker.offsetTop - body.scrollTop, height = Math.min(280, menu.scrollHeight), below = caret + parseFloat(style.lineHeight) + 8;
      menu.style.top = `${body.getBoundingClientRect().top + below + height > innerHeight && caret > height ? caret - height - 8 : Math.max(0, below)}px`;
      mirror.remove();
    }
  }
  for (const id of ['edit', 'split', 'preview']) $(`#${id}-tab`).addEventListener('click', () => setMode(id));
  document.querySelectorAll<HTMLButtonElement>('[data-format]').forEach(button => button.addEventListener('click', () => apply(button.dataset.format!)));
  body.addEventListener('input', checkSlash);
  body.addEventListener('click', hideSlash);
  body.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'Escape') hideSlash();
    if (event.key === 'ArrowDown' && !$('#slash-menu').hidden) { event.preventDefault(); $('#slash-menu button')?.focus(); }
    if ((event.ctrlKey || event.metaKey) && ['b', 'i'].includes(event.key.toLowerCase())) { event.preventDefault(); apply(event.key.toLowerCase() === 'b' ? 'bold' : 'italic'); }
  });
  $('#slash-menu').addEventListener('keydown', event => {
    const buttons = Array.from($('#slash-menu').querySelectorAll('button')), index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') { hideSlash(); body.focus(); }
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus(); }
  });
  document.addEventListener('click', event => { if (!(event.target instanceof Node) || (!$('#slash-menu').contains(event.target) && event.target !== body)) hideSlash(); });
  form.addEventListener('input', editChanged);
  form.addEventListener('change', refresh);
  form.addEventListener('invalid', event => { if ($('#publish-settings').contains(event.target as Node)) $<HTMLDetailsElement>('#publish-settings').open = true; }, true);
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && !$('#workspace').hidden && $('#profile-panel').hidden) { event.preventDefault(); form.requestSubmit(); }
    if (event.key === 'Escape' && document.body.classList.contains('writer-focus')) toggleFocus();
  });
  const toggleFocus = () => { const on = document.body.classList.toggle('writer-focus'); $('#focus-writing').setAttribute('aria-pressed', String(on)); $('#focus-writing').textContent = on ? '집중 모드 나가기' : '집중 모드'; };
  const leaveFocus = () => { document.body.classList.remove('writer-focus'); $('#focus-writing').setAttribute('aria-pressed', 'false'); $('#focus-writing').textContent = '집중 모드'; };
  $('#focus-writing').addEventListener('click', toggleFocus);
  $('#publish-entry').addEventListener('click', () => { $<HTMLDetailsElement>('#publish-settings').open = true; field('status').focus(); });
  $<HTMLSelectElement>('#writing-template').addEventListener('change', event => {
    const select = event.target as HTMLSelectElement;
    const templates: Record<string, string> = { note: '## 배운 것\n\n\n## 적용해 보기\n\n\n## 참고\n', trouble: '## 문제\n\n\n## 원인\n\n\n## 해결\n\n\n## 확인\n', review: '## 만든 것\n\n\n## 선택과 이유\n\n\n## 아쉬운 점\n\n\n## 다음에 할 일\n' };
    if (templates[select.value] && (!body.value.trim() || confirm('현재 본문을 선택한 글 틀로 바꿀까요?'))) { body.value = templates[select.value]; setMode('edit'); editChanged(); body.focus(); }
    select.value = '';
  });
  $('#restore-draft').addEventListener('click', () => {
    const draft = read(key()); if (!draft) return;
    for (const el of fields()) { const value = draft.values[el.name]; if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = value === true; else if (typeof value === 'string') el.value = value; }
    restoreVersion(draft.version); $('#draft-recovery').hidden = true; setMode('edit'); editChanged(); message('기기 사본을 복구했습니다. 내용을 확인한 뒤 저장해 주세요.');
  });
  $('#discard-draft').addEventListener('click', () => { try { localStorage.removeItem(key()); $('#draft-recovery').hidden = true; } catch { message('기기 사본을 지우지 못했습니다.', true); } });
  $('#export-markdown').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([body.value], { type: 'text/markdown;charset=utf-8' })), a = document.createElement('a'); a.href = url; a.download = `${field('slug').value || 'untitled'}.md`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $<HTMLInputElement>('#import-markdown').addEventListener('change', async event => {
    const input = event.target as HTMLInputElement, file = input.files?.[0]; if (!file) return;
    const importKey = key();
    try {
      if (file.size > 800000) throw new Error();
      const value = await file.text(); if (value.length > 200000) throw new Error();
      if (importKey !== key() || !owner) return;
      if (body.value && !confirm('현재 본문을 Markdown 파일 내용으로 바꿀까요?')) return;
      body.value = value; setMode('edit'); editChanged(); message('본문을 가져왔습니다. 확인한 뒤 저장해 주세요.');
    } catch { message('200,000자 이하의 Markdown 파일을 선택해 주세요.', true); }
    finally { input.value = ''; }
  });
  window.addEventListener('beforeunload', () => { if (timer) persist(); });
  return {
    setOwner(id: string) { const different = Boolean(owner && owner !== id); if (different) { clearTimeout(timer); timer = undefined; } owner = id; return different; },
    open(next: Entry | null, nextKind: EntryKind, entries: Entry[]) {
      clearTimeout(timer); timer = undefined; entry = next; kind = nextKind;
      $('#post-writing-fields').hidden = kind !== 'posts'; $('#post-publish-fields').hidden = kind !== 'posts';
      $('#local-save-status').textContent = ''; hideSlash(); setMode('edit');
      const draft = owner ? read(key()) : null; $('#draft-recovery').hidden = !draft;
      $('#recovery-message').textContent = draft ? `${new Date(draft.savedAt).toLocaleString('ko-KR')} 기기 사본이 있습니다.${draft.version !== entry?.updated_at ? ' 서버 내용과 다를 수 있습니다. 복구 후 저장 시 충돌을 확인합니다.' : ''}` : '';
      $('#recover-new').hidden = !owner || !read(key(true)) || !entry;
      $('#series-suggestions').replaceChildren(...[...new Set(entries.map(e => e.metadata.series).filter(s => typeof s === 'string' && s))].map(series => { const option = document.createElement('option'); option.value = series; return option; }));
    },
    changed: editChanged,
    leaveFocus,
    saved() { clearTimeout(timer); timer = undefined; try { localStorage.removeItem(key()); } catch { /* The server save still succeeded. */ } $('#draft-recovery').hidden = true; $('#local-save-status').textContent = ''; },
    logout() { clearTimeout(timer); timer = undefined; try { Object.keys(localStorage).filter(k => k.startsWith(prefix())).forEach(k => localStorage.removeItem(k)); } catch { /* Storage may be unavailable. */ } owner = ''; leaveFocus(); },
  };
}
