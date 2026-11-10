begin;

create table public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.site_admins enable row level security;
revoke all on public.site_admins from anon, authenticated;

create function public.is_site_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.site_admins where user_id = (select auth.uid())); $$;
revoke all on function public.is_site_admin() from public;
grant execute on function public.is_site_admin() to anon, authenticated;

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('posts','projects','research','timeline','pages')),
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,99}$'),
  title text not null check (length(title) between 1 and 200),
  summary text not null default '' check (length(summary) <= 1000),
  body text not null default '' check (length(body) <= 200000),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz not null default now(),
  sort_order integer not null default 0,
  featured boolean not null default false,
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, slug)
);
create index entries_public_listing on public.entries(kind, status, published_at desc);
alter table public.entries enable row level security;
grant select on public.entries to anon;
grant select, insert, update, delete on public.entries to authenticated;
create policy "Read published entries" on public.entries for select to anon, authenticated
  using (status = 'published' and published_at <= now());
create policy "Administrators manage entries" on public.entries for all to authenticated
  using ((select public.is_site_admin())) with check ((select public.is_site_admin()));

create table public.site_settings (
  id text primary key check (id = 'profile'),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
grant select on public.site_settings to anon;
grant select, insert, update on public.site_settings to authenticated;
create policy "Read public profile" on public.site_settings for select to anon, authenticated using (true);
create policy "Administrators manage profile" on public.site_settings for all to authenticated
  using ((select public.is_site_admin())) with check ((select public.is_site_admin()));

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end; $$;
create trigger entries_updated before update on public.entries for each row execute function public.touch_updated_at();
create trigger settings_updated before update on public.site_settings for each row execute function public.touch_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-images', 'site-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif']);
create policy "Administrators upload images" on storage.objects for insert to authenticated
  with check (bucket_id = 'site-images' and (select public.is_site_admin()));
create policy "Administrators read image records" on storage.objects for select to authenticated
  using (bucket_id = 'site-images' and (select public.is_site_admin()));
-- No storage overwrite/delete from the app: old article image URLs remain valid.
commit;
