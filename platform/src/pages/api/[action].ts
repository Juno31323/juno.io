import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { external, themeOf, uuid } from '../../lib/model';
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
async function limitedForm(request: Request) {
  const reader = request.body?.getReader(); if (!reader) throw new Error('EMPTY_FORM');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 5600000) { await reader.cancel(); throw new Error('TOO_LARGE'); } chunks.push(value); }
  return new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData();
}
export const POST: APIRoute = async context => {
  if (context.request.headers.get('origin') !== context.url.origin) return json({ error: '다른 사이트에서 보낸 요청은 처리할 수 없습니다.' }, 403);
  const db = context.locals.db; if (!db) return json({ error: '서버의 Supabase 연결 설정을 확인해 주세요.' }, 503);
  try {
    const form = await limitedForm(context.request), action = context.params.action;
    const string = (name: string, max = 1000) => { const value = String(form.get(name) || '').trim(); if (value.length > max) throw new Error('FIELD_TOO_LONG'); return value; };
    const links = () => {
      const value = string('links', 8000).split('\n').filter(line => line.trim()).map(line => { const index = line.indexOf('|'), label = line.slice(0, index).trim(), url = external(line.slice(index + 1).trim()); if (index < 1 || label.length > 80 || !url) throw new Error('INVALID_LINK'); return { label, url }; });
      if (value.length > 8) throw new Error('INVALID_LINK'); return value;
    };
    if (action === 'login' || action === 'signup') {
      const email = string('email', 254), password = String(form.get('password') || '');
      if (!email || password.length < 8 || password.length > 128) return json({ error: '이메일과 8–128자 비밀번호를 입력해 주세요.' }, 400);
      const result = action === 'login' ? await db.auth.signInWithPassword({ email, password }) : await db.auth.signUp({ email, password, options: { emailRedirectTo: `${context.url.origin}/auth/callback/` } });
      if (result.error) return json({ error: action === 'login' ? '로그인하지 못했습니다. 이메일과 비밀번호를 확인해 주세요.' : '가입하지 못했습니다. 이메일 형식과 비밀번호를 확인하거나 잠시 후 다시 시도해 주세요.' }, 400);
      return json(result.data.session ? { redirect: '/dashboard/', message: '로그인했습니다.' } : { message: '확인 메일을 보냈습니다. 메일의 링크를 열어 가입을 마쳐 주세요.' });
    }
    const user = context.locals.user; if (!user) return json({ error: '로그인이 필요합니다. 입력한 내용을 보관한 뒤 다시 로그인해 주세요.' }, 401);
    if (action === 'logout') { const { error } = await db.auth.signOut({ scope: 'local' }); if (error) throw error; return json({ redirect: '/login/' }); }
    if (action === 'onboard') {
      const handle = string('handle', 30), name = string('name', 80), intro = string('intro', 400);
      if (!name || !/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(handle)) return json({ error: '이름과 3–30자의 영문 소문자·숫자·하이픈 아이디를 입력해 주세요. 아이디 양 끝에는 영문·숫자를 사용합니다.' }, 400);
      const { error } = await db.from('pf_profiles').insert({ id: user.id, name, intro, handle }); if (error) throw error;
      return json({ redirect: '/dashboard/', message: '내 페이지를 만들었습니다. 아직 비공개입니다.' });
    }
    const { data: profile, error: profileError } = await db.from('pf_profiles').select('*').eq('id', user.id).maybeSingle();
    if (profileError) throw profileError; if (!profile) return json({ error: '먼저 내 페이지의 이름과 아이디를 정해 주세요.', redirect: '/dashboard/' }, 400);
    if (action === 'profile' || action === 'theme') {
      const payload = action === 'theme' ? { theme: themeOf(JSON.parse(string('theme', 8000))) } : { name: string('name', 80), intro: string('intro', 400), about: string('about', 20000), links: links(), photo_id: string('photo_id', 36) || null };
      if ('name' in payload && !payload.name) throw new Error('NAME_REQUIRED');
      if ('photo_id' in payload && payload.photo_id) { if (!uuid(payload.photo_id)) throw new Error('ASSET_NOT_OWNED'); const { data } = await db.from('pf_assets').select('id').eq('id', payload.photo_id).eq('owner_id', user.id).maybeSingle(); if (!data) throw new Error('ASSET_NOT_OWNED'); }
      const { data, error } = await db.from('pf_profiles').update(payload).eq('id', user.id).eq('updated_at', string('version', 100)).select('updated_at').maybeSingle();
      if (error) throw error; if (!data) throw new Error('VERSION_CONFLICT');
      return json({ message: '저장했습니다. 게시 전까지는 나에게만 보입니다.', profileVersion: data.updated_at, preview: true });
    }
    if (action === 'project') {
      const id = string('id', 36), tech = [...new Set(string('tech', 600).split(',').map(t => t.trim()).filter(Boolean))];
      const image_ids = string('image_ids', 400).split(',').filter(Boolean);
      if (tech.length > 12 || tech.some(t => t.length > 40) || image_ids.length > 8 || image_ids.some(i => !uuid(i))) throw new Error('INVALID_PROJECT');
      const payload: Record<string, unknown> = { owner_id: user.id, title: string('title', 200), summary: string('summary', 1000), role: string('role', 200), period: string('period', 120), tech, image_ids, links: links(), included: form.get('included') === 'on', featured: form.get('featured') === 'on', discoverable: form.get('discoverable') === 'on' };
      for (const key of ['problem','contribution','approach','result','body']) payload[key] = string(key, key === 'body' ? 200000 : 10000);
      if (!payload.title || (id && !uuid(id))) throw new Error('INVALID_PROJECT');
      if (image_ids.length) { const { data, error } = await db.from('pf_assets').select('id').eq('owner_id', user.id).in('id', image_ids); if (error || data.length !== image_ids.length) throw new Error('ASSET_NOT_OWNED'); }
      if (!id) payload.slug = string('slug', 100) || `project-${randomUUID().slice(0, 8)}`;
      const query = id ? db.from('pf_projects').update(payload).eq('id', id).eq('owner_id', user.id).eq('updated_at', string('version', 100)) : db.from('pf_projects').insert(payload);
      const { data, error } = await query.select().maybeSingle(); if (error) throw error; if (!data) throw new Error('VERSION_CONFLICT');
      return json({ message: '작업을 저장했습니다. 게시하면 포트폴리오에 반영됩니다.', version: data.updated_at, id: data.id, redirect: id ? undefined : `/dashboard/projects/${data.id}/`, preview: true });
    }
    if (action === 'delete-project') {
      const id = string('id', 36); if (!uuid(id)) throw new Error('INVALID_PROJECT');
      const { error } = await db.from('pf_projects').delete().eq('id', id).eq('owner_id', user.id); if (error) throw error;
      return json({ redirect: '/dashboard/projects/', message: '삭제했습니다. 게시하면 외부 페이지에서도 제외됩니다.' });
    }
    if (action === 'order') {
      const ids = string('ids', 12000).split(','); if (ids.some(id => !uuid(id))) throw new Error('INVALID_PROJECT');
      const { error } = await db.rpc('pf_reorder', { p_ids: ids }); if (error) throw error; return json({ message: '순서를 저장했습니다. 게시하면 반영됩니다.', preview: true });
    }
    if (action === 'publish' || action === 'visibility') {
      const visibility = string('visibility', 10); if (!['private','link','public'].includes(visibility)) throw new Error('NOT_ALLOWED');
      const { data, error } = await db.rpc(action === 'publish' ? 'pf_publish' : 'pf_visibility', { p_visibility: visibility, ...(action === 'publish' ? { p_version: string('version', 100) } : {}) }); if (error) throw error;
      return json({ message: visibility === 'private' ? '비공개로 전환했습니다. 이전 공유 링크도 회수됐습니다.' : action === 'publish' ? '현재 내용으로 게시했습니다.' : '공개 상태를 변경했습니다. 이전 링크 공개 주소는 회수됐습니다.', visibility, shareUrl: data.token ? `${context.url.origin}/s/${profile.handle}/${data.token}/` : visibility === 'public' ? `${context.url.origin}/u/${profile.handle}/` : null, published: true });
    }
    if (action === 'upload') {
      const file = form.get('file'), alt = string('alt', 300);
      if (!(file instanceof File) || !alt || file.size < 1 || file.size > 5242880) throw new Error('INVALID_IMAGE');
      const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' }, extension = extensions[file.type]; if (!extension) throw new Error('INVALID_IMAGE');
      const bytes = Buffer.from(await file.arrayBuffer());
      const magic = file.type === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 : file.type === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : file.type === 'image/webp' ? bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP' : bytes.toString('ascii',4,8)==='ftyp' && ['avif','avis'].includes(bytes.toString('ascii',8,12));
      if (!magic) throw new Error('INVALID_IMAGE');
      const id = randomUUID(), path = `${user.id}/${id}.${extension}`;
      const { error: uploadError } = await db.storage.from('portfolio-private').upload(path, bytes, { contentType: file.type, upsert: false }); if (uploadError) throw uploadError;
      const { error } = await db.from('pf_assets').insert({ id, owner_id: user.id, path, mime: file.type, alt, size: file.size }); if (error) throw error;
      return json({ message: '이미지를 올렸습니다. 프로필이나 프로젝트에 저장한 뒤 게시해 주세요.', asset: { id, alt }, url: `/media/${id}/?handle=${profile.handle}` });
    }
    return json({ error: '지원하지 않는 요청입니다.' }, 404);
  } catch (error: any) {
    const message = String(error?.message || ''), code = error?.code;
    const feedback = message.includes('VERSION_CONFLICT') ? '다른 창에서 수정되었습니다. 입력한 내용을 복사해 두고 새로고침해 주세요.' : code === '23505' ? '이미 사용 중인 아이디 또는 주소입니다.' : code === '23514' ? '예약된 아이디이거나 입력 형식이 맞지 않습니다.' : message === 'INVALID_LINK' ? '링크는 한 줄에 하나씩 “이름 | https://주소”로 입력해 주세요. 최대 8개입니다.' : message.includes('ASSET_NOT_OWNED') ? '본인 계정으로 올린 이미지를 선택해 주세요.' : message === 'INVALID_IMAGE' ? '설명과 5MB 이하의 JPG·PNG·WebP·AVIF 이미지를 선택해 주세요.' : message === 'TOO_LARGE' ? '전송할 파일이 너무 큽니다.' : message.includes('PUBLISH_FIRST') ? '먼저 현재 내용을 게시해 주세요.' : '저장하지 못했습니다. 입력한 내용은 남아 있습니다. 연결과 입력 항목을 확인해 주세요.';
    return json({ error: feedback }, message.includes('VERSION_CONFLICT') || code === '23505' ? 409 : 400);
  }
};
