import { supabase } from '../lib/supabase';
import { type Entry, type EntryKind, entryUrl, safeUrl } from '../lib/cms';
import { readingMinutes, tagsOf, seriesOf } from '../lib/blog';
import { createWriter } from './writer';

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const login = $<HTMLFormElement>('#login-form'), form = $<HTMLFormElement>('#entry-form'), profileForm = $<HTMLFormElement>('#profile-form');
const kinds = $<HTMLSelectElement>('#content-kind');
const input = (name: string) => form.elements.namedItem(name) as HTMLInputElement;
let entries: Entry[] = [], current: Entry | null = null, kind: EntryKind = 'posts', dirty = false, saving = false;
let profileVersion: string | null = null;
const say = (message: string, error = false) => {
  const el = $('#admin-status'); el.textContent = message; el.dataset.error = String(error);
  const local = $('#profile-panel').hidden ? $('#editor-feedback') : $('#profile-feedback');
  local.textContent = message; local.dataset.error = String(error);
};
const localDate = (value: string) => { const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const canLeave = () => !dirty || window.confirm('저장하지 않은 내용이 있습니다. 이 화면을 나갈까요?');
const writer = createWriter(form, () => dirty = true, say, version => { if (current) current.updated_at = version; });
window.addEventListener('beforeunload', event => { if (dirty) event.preventDefault(); });
form.addEventListener('input', () => dirty = true);
profileForm.addEventListener('input', () => dirty = true);

function showLogin() { writer.leaveFocus(); $('#login-panel').hidden = false; $('#workspace').hidden = true; $('#logout').hidden = true; }
function openEntry(entry: Entry | null) {
  $('#editor-feedback').textContent = '';
  current = entry; form.reset();
  for (const name of ['title', 'slug', 'summary', 'body', 'status', 'sort_order']) input(name).value = String(entry?.[name as keyof Entry] ?? (name === 'status' ? 'draft' : name === 'sort_order' ? '0' : ''));
  input('published_at').value = localDate(entry?.published_at || new Date().toISOString());
  input('slug').readOnly = Boolean(entry?.id);
  if (!entry) input('slug').value = `post-${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}`;
  input('tags').value = entry ? tagsOf(entry).join(', ') : '';
  input('series').value = entry ? seriesOf(entry) : '';
  for (const name of ['coverImage', 'coverAlt']) input(name).value = typeof entry?.metadata[name] === 'string' ? entry.metadata[name] : '';
  for (const name of ['category', 'period', 'role', 'cardImage', 'cardAlt']) input(name).value = entry?.metadata[name] || '';
  input('work_status').value = entry?.metadata.status || '';
  input('featured').checked = Boolean(entry?.featured);
  input('links').value = (entry?.metadata.links || []).map((link: any) => `${link.label} | ${link.url}`).join('\n');
  $('#work-fields').hidden = ['posts', 'pages'].includes(kind);
  $('#editor-title').textContent = entry ? entry.title : kind === 'posts' ? '새 글' : '새 기록';
  const view = $<HTMLAnchorElement>('#view-entry'); view.hidden = !entry || entry.status !== 'published'; if (entry) view.href = entryUrl(entry);
  $('#saved-at').textContent = entry?.updated_at ? `최근 저장 ${new Date(entry.updated_at).toLocaleString('ko-KR')}` : '';
  dirty = false; writer.open(entry, kind, entries); renderList();
}
function renderList() {
  const query = $<HTMLInputElement>('#admin-search').value.toLowerCase();
  const list = $('#admin-entries'); list.replaceChildren();
  const filter = $<HTMLSelectElement>('#admin-filter').value;
  const state = (entry: Entry) => entry.status === 'published' && new Date(entry.published_at) > new Date() ? 'scheduled' : entry.status;
  const filtered = entries.filter(entry => entry.title.toLowerCase().includes(query) && (filter === 'all' || filter === state(entry)));
  $('#entry-count').textContent = `${filtered.length}개 · 보관한 기록 포함`;
  for (const entry of filtered) {
    const li = document.createElement('li'), button = document.createElement('button'), title = document.createElement('strong'), status = document.createElement('span');
    title.textContent = entry.title; status.textContent = entry.status === 'published' ? new Date(entry.published_at) > new Date() ? '예약' : '공개' : entry.status === 'draft' ? '초안' : '보관';
    button.type = 'button'; button.setAttribute('aria-current', String(entry.id === current?.id)); button.append(title, status);
    button.addEventListener('click', () => { if (!saving && canLeave()) openEntry(entry); }); li.append(button); list.append(li);
  }
}
async function allEntries(filter?: EntryKind) {
  const rows: Entry[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = supabase!.from('entries').select('*').order('sort_order').order('id').range(offset, offset + 499);
    if (filter) query = query.eq('kind', filter);
    const { data, error } = await query; if (error) throw error;
    rows.push(...data); if (data.length < 500) break;
  }
  return rows;
}
async function loadList() {
  say('목록을 불러오는 중입니다.');
  try { entries = await allEntries(kind); if (kind === 'posts') entries.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))); openEntry(entries[0] || null); say(entries.length ? '' : '첫 기록을 작성해 보세요.'); }
  catch { say('목록을 불러오지 못했습니다. DB 설정과 연결 상태를 확인하고 다시 로그인해 주세요.', true); }
}
async function loadProfile() {
  const { data, error } = await supabase!.from('site_settings').select('*').eq('id', 'profile').maybeSingle();
  if (error || !data) { say('프로필을 불러오지 못했습니다. 초기 데이터 SQL을 적용했는지 확인해 주세요.', true); return; }
  for (const field of Array.from(profileForm.elements)) if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.value = data.data[field.name] || '';
  profileVersion = data.updated_at; dirty = false; say('');
}
kinds.addEventListener('change', async () => {
  if (saving || !canLeave()) { kinds.value = $('#profile-panel').hidden ? kind : 'profile'; return; }
  dirty = false; const isProfile = kinds.value === 'profile';
  $('#entry-workspace').hidden = isProfile; $('#profile-panel').hidden = !isProfile; $('#new-entry').hidden = isProfile || kinds.value === 'pages';
  if (isProfile) await loadProfile(); else { kind = kinds.value as EntryKind; await loadList(); }
});
$('#new-entry').addEventListener('click', () => { if (!saving && canLeave()) openEntry(null); });
$('#recover-new').addEventListener('click', () => { if (!saving && canLeave()) openEntry(null); });
$('#admin-search').addEventListener('input', renderList);
$('#admin-filter').addEventListener('change', renderList);

async function enterWorkspace() {
  if (!supabase) return;
  const { data, error } = await supabase.rpc('is_site_admin');
  if (error || !data) { showLogin(); $('#logout').hidden = false; say('관리자 권한이 없습니다. Supabase에서 관리자 계정을 등록해 주세요.', true); return; }
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) { showLogin(); return; }
  if (writer.setOwner(session.session.user.id)) { dirty = false; current = null; form.reset(); profileForm.reset(); }
  $('#login-panel').hidden = true; $('#workspace').hidden = false; $('#logout').hidden = false;
  if (dirty) { say('다시 로그인했습니다. 작성 중인 내용을 저장해 주세요.'); return; }
  await loadList();
}
login.addEventListener('submit', async event => {
  event.preventDefault(); if (!supabase) return;
  const button = login.querySelector('button')!; button.disabled = true; say('로그인하는 중입니다.');
  try {
    const data = new FormData(login);
    const { error } = await supabase.auth.signInWithPassword({ email: String(data.get('email')).trim(), password: String(data.get('password')) });
    if (error) { say('로그인하지 못했습니다. 이메일과 비밀번호를 확인해 주세요.', true); return; }
    login.reset(); await enterWorkspace();
  } catch { say('서버에 연결하지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.', true); }
  finally { button.disabled = false; }
});
$('#logout').addEventListener('click', async () => {
  if (saving || !canLeave()) return;
  const { error } = await supabase!.auth.signOut();
  if (error) { say('로그아웃하지 못했습니다. 다시 시도해 주세요.', true); return; }
  writer.logout(); dirty = false; current = null; entries = []; form.reset(); profileForm.reset(); $('#admin-entries').replaceChildren(); showLogin(); say('로그아웃했습니다.');
});

form.addEventListener('submit', async event => {
  event.preventDefault(); if (saving || !supabase) return;
  if (input('body').value.length > 200000) { say('본문은 200,000자까지 저장할 수 있습니다.', true); return; }
  const links: {label: string; url: string}[] = [];
  for (const line of input('links').value.split('\n').filter(line => line.trim())) {
    const split = line.indexOf('|'), label = line.slice(0, split).trim(), url = line.slice(split + 1).trim();
    if (split < 1 || !safeUrl(url)) { say('관련 링크를 “이름 | https://주소” 형식으로 입력해 주세요.', true); return; } links.push({ label, url });
  }
  if (input('cardImage').value && !safeUrl(input('cardImage').value)) { say('목록 이미지 URL을 확인해 주세요.', true); return; }
  if (kind === 'posts' && input('coverImage').value && !safeUrl(input('coverImage').value)) { $<HTMLDetailsElement>('#publish-settings').open = true; say('커버 이미지 URL을 확인해 주세요.', true); return; }
  if (kind === 'posts' && input('coverImage').value && !input('coverAlt').value.trim()) { $<HTMLDetailsElement>('#publish-settings').open = true; say('커버 이미지 설명을 입력해 주세요.', true); input('coverAlt').focus(); return; }
  const tags = [...new Set(input('tags').value.split(',').map(tag => tag.trim()).filter(Boolean))];
  if (kind === 'posts' && (tags.length > 8 || tags.some(tag => tag.length > 24))) { say('태그는 최대 8개, 각각 24자까지 입력해 주세요.', true); input('tags').focus(); return; }
  const payload: Entry = {
    kind, slug: input('slug').value, title: input('title').value.trim(), summary: input('summary').value.trim(), body: input('body').value,
    status: input('status').value as Entry['status'], published_at: new Date(input('published_at').value).toISOString(),
    sort_order: Number(input('sort_order').value), featured: input('featured').checked,
    metadata: { ...current?.metadata, category: input('category').value, period: input('period').value, role: input('role').value, status: input('work_status').value, cardImage: input('cardImage').value, cardAlt: input('cardAlt').value, links,
      ...(kind === 'posts' ? { tags, series: input('series').value.trim(), coverImage: input('coverImage').value.trim(), coverAlt: input('coverAlt').value.trim(), readingMinutes: readingMinutes(input('body').value) } : {}),
    },
  };
  if (!payload.title) { say('제목을 입력해 주세요.', true); return; }
  saving = true; form.inert = true; $<HTMLButtonElement>('#save-entry').disabled = true; say('저장하는 중입니다.');
  try {
    const query = current?.id ? supabase.from('entries').update(payload).eq('id', current.id).eq('updated_at', current.updated_at!) : supabase.from('entries').insert(payload);
    const { data, error } = await query.select().maybeSingle();
    if (error) { say(error.code === '23505' ? '같은 주소 이름이 있습니다. 다른 이름을 입력해 주세요.' : '저장하지 못했습니다. 입력한 내용은 남아 있습니다. 연결과 관리자 권한을 확인해 주세요.', true); return; }
    if (!data) { say('다른 창에서 수정된 내용이 있습니다. 이 본문을 복사해 두고 새로고침한 뒤 다시 저장해 주세요.', true); return; }
    const index = entries.findIndex(entry => entry.id === data.id); if (index < 0) entries.unshift(data); else entries[index] = data;
    writer.saved(); openEntry(data); say(payload.status === 'published' ? new Date(payload.published_at) > new Date() ? '예약했습니다. 발행 시각부터 공개됩니다.' : '저장했습니다. 사이트에서 바로 확인할 수 있습니다.' : payload.status === 'draft' ? '초안으로 저장했습니다.' : '보관했습니다. 방문자에게 표시되지 않습니다.');
  } catch { say('연결이 끊겨 저장하지 못했습니다. 입력한 내용은 남아 있습니다. 다시 저장해 주세요.', true); }
  finally { saving = false; form.inert = false; const button = $<HTMLButtonElement>('#save-entry'); button.disabled = false; button.focus({ preventScroll: true }); }
});

$('#upload-image').addEventListener('click', async () => {
  if (saving || !supabase) return;
  const file = $<HTMLInputElement>('#image-upload').files?.[0], alt = $<HTMLInputElement>('#image-alt').value.trim();
  if (!file || !alt) { say('이미지와 이미지 설명을 함께 선택해 주세요.', true); return; }
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || file.size > 5242880) { say('JPG·PNG·WebP·AVIF 파일을 5MB 이하로 선택해 주세요.', true); return; }
  const button = $<HTMLButtonElement>('#upload-image'); button.disabled = true; form.inert = true; saving = true; say('이미지를 올리는 중입니다.');
  try {
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' }[file.type];
    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from('site-images').upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from('site-images').getPublicUrl(path);
    const isCover = kind === 'posts' && $<HTMLSelectElement>('#image-target').value === 'cover';
    if (isCover) { input('coverImage').value = data.publicUrl; input('coverAlt').value = alt; $<HTMLDetailsElement>('#publish-settings').open = true; }
    else { const area = $<HTMLTextAreaElement>('#entry-body'); area.setRangeText(`\n![${alt.replace(/[\[\]\\\n]/g, '')}](${data.publicUrl})\n`, area.selectionStart, area.selectionEnd, 'end'); }
    writer.changed(); say(isCover ? '커버 이미지를 골랐습니다. 글도 저장해 주세요.' : '본문에 이미지를 넣었습니다. 글도 저장해 주세요.');
  } catch { say('이미지를 올리지 못했습니다. 저장소 설정과 관리자 권한을 확인하고 다시 시도해 주세요.', true); }
  finally { saving = false; form.inert = false; button.disabled = false; button.focus({ preventScroll: true }); }
});

profileForm.addEventListener('submit', async event => {
  event.preventDefault(); if (saving || !supabase) return;
  const data = Object.fromEntries(new FormData(profileForm));
  if (['github', 'heroPhoto', 'photo'].some(key => !safeUrl(data[key]))) { say('프로필의 링크와 사진 URL을 확인해 주세요.', true); return; }
  const button = profileForm.querySelector('button')!; button.disabled = true; profileForm.inert = true; saving = true;
  try {
    const { data: result, error } = await supabase.from('site_settings').update({ data }).eq('id', 'profile').eq('updated_at', profileVersion!).select().maybeSingle();
    if (error || !result) { say('저장하지 못했거나 다른 창에서 수정되었습니다. 내용을 복사해 두고 새로고침한 뒤 다시 시도해 주세요.', true); return; }
    dirty = false; profileVersion = result.updated_at; say('프로필을 저장했습니다.');
  } catch { say('서버에 연결하지 못했습니다. 입력한 내용을 유지했으니 다시 저장해 주세요.', true); }
  finally { button.disabled = false; profileForm.inert = false; saving = false; button.focus({ preventScroll: true }); }
});

$('#export-data').addEventListener('click', async () => {
  if (!supabase) return; say('백업 파일을 만드는 중입니다.');
  try {
    const entries = await allEntries(); const { data: profile, error } = await supabase.from('site_settings').select('*'); if (error) throw error;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ exported_at: new Date().toISOString(), entries, profile }, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `juno-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); say('백업 파일을 내려받았습니다. 이미지는 Supabase Storage에서 별도로 보관해 주세요.');
  } catch { say('백업을 만들지 못했습니다. 다시 시도해 주세요.', true); }
});

if (!supabase) { showLogin(); say('Supabase 연결 정보가 없습니다. 운영 가이드의 환경 변수 설정을 확인해 주세요.', true); login.querySelector('button')!.disabled = true; }
else {
  supabase.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') { showLogin(); say('로그인이 만료되었습니다. 다시 로그인해 주세요. 작성 중인 내용은 이 창에 남아 있습니다.', true); } });
  void supabase.auth.getSession().then(async ({ data }) => { if (data.session) await enterWorkspace(); else { showLogin(); say(''); } }).catch(() => { showLogin(); say('로그인 상태를 확인하지 못했습니다. 다시 로그인해 주세요.', true); });
}
