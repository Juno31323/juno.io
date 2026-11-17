-- Run only on a disposable database after the two CMS migrations.
begin;
insert into blog_private.view_key(key_hash)
values (sha256(convert_to(repeat('a', 64), 'UTF8')));
insert into public.entries(kind, slug, title, status, published_at) values
  ('posts', 'numbering-draft', 'Draft', 'draft', '2025-01-01T00:00:00Z'),
  ('posts', 'numbering-second', 'Second', 'published', '2025-01-02T00:00:00Z'),
  ('posts', 'numbering-future', 'Scheduled', 'published', '2999-01-01T00:00:00Z');
update public.entries set status = 'published' where slug = 'numbering-draft';
update public.entries set blog_number = 999, title = 'Edited' where slug = 'numbering-second';

do $$
begin
  if (select blog_number from public.entries where slug = 'numbering-existing') is distinct from 1
    or (select blog_number from public.entries where slug = 'numbering-second') is distinct from 2
    or (select blog_number from public.entries where slug = 'numbering-future') is distinct from 3
    or (select blog_number from public.entries where slug = 'numbering-draft') is distinct from 4
  then raise exception 'Numbering or immutability failed'; end if;
end;
$$;

set local role anon;
do $$
begin
  begin
    perform public.register_blog_view(1, repeat('b',64), repeat('f',64));
    raise exception 'Invalid writer key was accepted';
  exception when insufficient_privilege then null;
  end;
  if public.register_blog_view(1, repeat('b',64), repeat('a',64)) is distinct from 1
    or public.register_blog_view(1, repeat('b',64), repeat('a',64)) is distinct from 1
    or public.register_blog_view(1, repeat('c',64), repeat('a',64)) is distinct from 2
    or public.register_blog_view(2, repeat('b',64), repeat('a',64)) is distinct from 1
    or public.register_blog_view(3, repeat('b',64), repeat('a',64)) is not null
  then raise exception 'View deduplication, isolation or visibility failed'; end if;
  if (select sum(total) from public.blog_view_counts) <> 3 then raise exception 'Public counts not readable'; end if;
  if has_schema_privilege('blog_private', 'USAGE') or has_table_privilege('public.blog_view_counts', 'UPDATE')
  then raise exception 'Tracking internals or writes are accessible'; end if;
end;
$$;
reset role;
update public.entries set status = 'archived' where slug = 'numbering-existing';
set local role anon;
do $$
begin
  if public.register_blog_view(1, repeat('d',64), repeat('a',64)) is not null
    or (select count(*) from public.blog_view_counts) <> 1
  then raise exception 'Archived post still counts or exposes totals'; end if;
end;
$$;
rollback;
