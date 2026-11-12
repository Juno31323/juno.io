import { defineMiddleware } from 'astro:middleware';
import { requestClient } from './lib/server';
export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.db = requestClient(context); context.locals.user = null;
  if (context.locals.db && context.request.headers.get('cookie')?.includes('pf-auth')) {
    const { data } = await context.locals.db.auth.getUser(); context.locals.user = data.user;
  }
  if ((context.url.pathname.startsWith('/dashboard/') || context.url.pathname.startsWith('/preview/')) && !context.locals.user) return context.redirect('/login/', 303);
  const response = await next();
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Referrer-Policy', 'no-referrer'); response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  if (context.url.pathname.startsWith('/s/') || context.url.pathname.startsWith('/dashboard/') || context.url.pathname.startsWith('/media/')) response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return response;
});
