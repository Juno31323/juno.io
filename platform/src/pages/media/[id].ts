import type { APIRoute } from 'astro';
import { uuid } from '../../lib/model';
import { storageAdmin } from '../../lib/server';
export const GET: APIRoute = async context => {
  const unavailable = () => new Response('이미지를 열 수 없습니다.', { status: 404, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  if (!context.locals.db || !uuid(context.params.id || '')) return unavailable();
  const { data, error } = await context.locals.db.rpc('pf_media', { p_id: context.params.id, p_handle: (context.url.searchParams.get('handle') || '').slice(0,30), p_token: (context.url.searchParams.get('token') || '').slice(0,64) });
  if (error || !data) return unavailable();
  try { const { data: image, error: downloadError } = await storageAdmin().storage.from('portfolio-private').download(data.path); if (downloadError || !image) return unavailable(); return new Response(image, { headers: { 'Content-Type': data.mime, 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' } }); }
  catch { return new Response('이미지 서버 설정을 확인해 주세요.', { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
};
