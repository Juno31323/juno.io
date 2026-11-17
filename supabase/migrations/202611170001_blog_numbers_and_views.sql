begin;

alter table public.entries add column blog_number integer unique
  check (blog_number is null or (kind = 'posts' and blog_number > 0));

-- Preserve chronological order for existing posts. Drafts receive a number when first published.
with numbered as (
  select id, row_number() over (order by published_at, created_at, id)::integer as number
  from public.entries where kind = 'posts' and status = 'published'
)
update public.entries as entry set blog_number = numbered.number
from numbered where entry.id = numbered.id;

create schema blog_private;
revoke all on schema blog_private from public, anon, authenticated;
create table blog_private.counter (
  singleton boolean primary key default true check (singleton),
  last_number integer not null
);
insert into blog_private.counter(last_number) select coalesce(max(blog_number), 0) from public.entries;

create function blog_private.assign_number() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.blog_number := old.blog_number;
    if old.blog_number is not null and new.kind <> 'posts' then
      raise exception 'A numbered post cannot change entry type';
    end if;
  else
    new.blog_number := null;
  end if;
  if new.kind = 'posts' and new.status = 'published' and new.blog_number is null then
    update blog_private.counter set last_number = last_number + 1 where singleton
      returning last_number into new.blog_number;
  end if;
  return new;
end;
$$;
revoke all on function blog_private.assign_number() from public, anon, authenticated;
create trigger assign_blog_number before insert or update on public.entries
for each row execute function blog_private.assign_number();

create table blog_private.view_key (
  singleton boolean primary key default true check (singleton),
  key_hash bytea not null check (octet_length(key_hash) = 32)
);
create table blog_private.post_visitors (
  entry_id uuid not null references public.entries(id) on delete cascade,
  visitor_hash bytea not null check (octet_length(visitor_hash) = 32),
  primary key (entry_id, visitor_hash)
);
create table public.blog_view_counts (
  entry_id uuid primary key references public.entries(id) on delete cascade,
  total integer not null default 0 check (total >= 0)
);
alter table public.blog_view_counts enable row level security;
revoke all on public.blog_view_counts from public, anon, authenticated;
grant select on public.blog_view_counts to anon, authenticated;
create policy "Read counts for current public posts" on public.blog_view_counts
for select to anon, authenticated using (
  exists (select 1 from public.entries as entry
    where entry.id = blog_view_counts.entry_id and entry.kind = 'posts' and entry.status = 'published' and entry.published_at <= now())
);

create function public.register_blog_view(p_number integer, p_visitor text, p_key text)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  post_id uuid;
  post_views integer;
begin
  if p_key is null or p_key !~ '^[0-9a-f]{64}$' or not exists (
    select 1 from blog_private.view_key
    where singleton and key_hash = pg_catalog.sha256(pg_catalog.convert_to(p_key, 'UTF8'))
  ) then
    raise insufficient_privilege using message = 'Blog view writer is not authorized';
  end if;
  if p_visitor is null or p_visitor !~ '^[0-9a-f]{64}$' then
    raise invalid_parameter_value using message = 'Invalid visitor digest';
  end if;
  select id into post_id from public.entries
    where blog_number = p_number and kind = 'posts' and status = 'published' and published_at <= now()
    for share;
  if post_id is null then return null; end if;

  insert into blog_private.post_visitors(entry_id, visitor_hash)
    values (post_id, pg_catalog.decode(p_visitor, 'hex')) on conflict do nothing;
  if found then
    insert into public.blog_view_counts as counts(entry_id, total) values (post_id, 1)
      on conflict (entry_id) do update set total = counts.total + 1
      returning total into post_views;
  else
    select total into post_views from public.blog_view_counts where entry_id = post_id;
  end if;
  return coalesce(post_views, 0);
end;
$$;
revoke all on function public.register_blog_view(integer, text, text) from public, anon, authenticated;
grant execute on function public.register_blog_view(integer, text, text) to anon;

notify pgrst, 'reload schema';
commit;
