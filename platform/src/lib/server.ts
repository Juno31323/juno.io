import type { APIContext } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
export const settings = () => ({ url: process.env.SUPABASE_URL!, key: process.env.SUPABASE_PUBLISHABLE_KEY!, secret: process.env.SUPABASE_SERVICE_ROLE_KEY });
export function requestClient(context: APIContext) {
  const env = settings(); if (!env.url || !env.key) return null;
  return createServerClient(env.url, env.key, { cookieOptions: { name: 'pf-auth', httpOnly: true, sameSite: 'lax', secure: context.url.protocol === 'https:', path: '/' }, cookies: {
    getAll: () => parseCookieHeader(context.request.headers.get('cookie') || '').map(c => ({ name: c.name, value: c.value || '' })),
    setAll: cookies => { for (const { name, value, options } of cookies) context.cookies.set(name, value, { ...options, httpOnly: true, sameSite: 'lax', secure: context.url.protocol === 'https:', path: '/' }); },
  } });
}
export function storageAdmin() { const env = settings(); if (!env.secret) throw new Error('STORAGE_SERVER_KEY_MISSING'); return createClient(env.url, env.secret, { auth: { persistSession: false, autoRefreshToken: false } }); }
export async function ownerData(db: NonNullable<ReturnType<typeof requestClient>>, id: string) {
  const [profile, projects, records, assets, publication] = await Promise.all([
    db.from('pf_profiles').select('*').eq('id', id).maybeSingle(), db.from('pf_projects').select('*').eq('owner_id', id).order('position').order('id'),
    db.from('pf_records').select('*').eq('owner_id', id).order('position').order('published_at', { ascending: false }), db.from('pf_assets').select('id,alt').eq('owner_id', id), db.from('pf_publications').select('visibility,version,published_at,handle').eq('owner_id', id).maybeSingle(),
  ]);
  const error = [profile, projects, records, assets, publication].find(r => r.error)?.error; if (error) throw error;
  return { profile: profile.data, projects: projects.data || [], records: records.data || [], assets: assets.data || [], publication: publication.data };
}
