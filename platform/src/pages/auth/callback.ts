import type { APIRoute } from 'astro';
export const GET: APIRoute = async context => {
  const code = context.url.searchParams.get('code');
  if (code && context.locals.db) { const { error } = await context.locals.db.auth.exchangeCodeForSession(code); if (!error) return context.redirect('/dashboard/', 303); }
  return context.redirect('/login/?confirmation=failed', 303);
};
