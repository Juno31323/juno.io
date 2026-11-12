begin;
create extension if not exists pgcrypto with schema extensions;

create table public.pf_assets (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  path text not null unique, mime text not null check(mime in ('image/jpeg','image/png','image/webp','image/avif')),
  alt text not null check(length(alt) between 1 and 300), size integer not null check(size between 1 and 5242880), created_at timestamptz not null default now(),
  check(split_part(path,'/',1) = owner_id::text)
);
create table public.pf_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique check(handle ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$' and handle not in ('admin','api','auth','dashboard','explore','login','signup','settings','preview','share','media','projects','blog','research','timeline','about','support','www','new','null')),
  name text not null check(length(name) between 1 and 80), intro text not null default '' check(length(intro)<=400),
  about text not null default '' check(length(about)<=20000), photo_id uuid references public.pf_assets(id),
  links jsonb not null default '[]' check(jsonb_typeof(links)='array' and jsonb_array_length(links)<=8),
  theme jsonb not null default '{"accent":"blue","mode":"light","order":["projects","about","research","timeline","posts"],"hidden":["research","timeline","posts"]}' check(jsonb_typeof(theme)='object' and length(theme::text)<8000),
  legacy jsonb not null default '{}' check(jsonb_typeof(legacy)='object'), updated_at timestamptz not null default now()
);
create table public.pf_projects (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.pf_profiles(id) on delete cascade,
  slug text not null check(slug ~ '^[a-z0-9][a-z0-9-]{0,99}$'), title text not null check(length(title) between 1 and 200),
  summary text not null default '' check(length(summary)<=1000), problem text not null default '' check(length(problem)<=10000),
  role text not null default '' check(length(role)<=200), contribution text not null default '' check(length(contribution)<=10000),
  approach text not null default '' check(length(approach)<=10000), result text not null default '' check(length(result)<=10000),
  body text not null default '' check(length(body)<=200000), tech text[] not null default '{}' check(cardinality(tech)<=12),
  period text not null default '' check(length(period)<=120), links jsonb not null default '[]' check(jsonb_typeof(links)='array' and jsonb_array_length(links)<=8),
  image_ids uuid[] not null default '{}' check(cardinality(image_ids)<=8), included boolean not null default true,
  discoverable boolean not null default false, featured boolean not null default false, position integer not null default 0,
  legacy jsonb not null default '{}', updated_at timestamptz not null default now(), unique(owner_id,slug)
);
create table public.pf_records (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.pf_profiles(id) on delete cascade,
  kind text not null check(kind in ('posts','research','timeline','pages')), slug text not null, title text not null, summary text not null default '',
  body text not null default '', metadata jsonb not null default '{}', published boolean not null default false,
  published_at timestamptz not null default now(), position integer not null default 0, unique(owner_id,kind,slug)
);
create table public.pf_publications (
  owner_id uuid primary key references public.pf_profiles(id) on delete cascade, handle text not null unique,
  visibility text not null default 'private' check(visibility in ('private','link','public')),
  snapshot jsonb not null default '{}', link_hash text, version integer not null default 0, published_at timestamptz
);
create index pf_projects_owner on public.pf_projects(owner_id,position);
create index pf_assets_owner on public.pf_assets(owner_id);
create index pf_records_owner on public.pf_records(owner_id,kind);
create index pf_publications_visible on public.pf_publications(visibility);

create function public.pf_touch() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_table_name='pf_profiles' then if new.handle<>old.handle then raise exception 'HANDLE_IMMUTABLE'; end if; end if;
  new.updated_at=clock_timestamp(); return new;
end $$;
create trigger pf_profile_touch before update on public.pf_profiles for each row execute function public.pf_touch();
create trigger pf_project_touch before update on public.pf_projects for each row execute function public.pf_touch();

alter table public.pf_profiles enable row level security;
alter table public.pf_projects enable row level security;
alter table public.pf_records enable row level security;
alter table public.pf_assets enable row level security;
alter table public.pf_publications enable row level security;
revoke all on public.pf_profiles,public.pf_projects,public.pf_records,public.pf_assets,public.pf_publications from anon,authenticated;
grant select,insert,update on public.pf_profiles to authenticated;
grant select,insert,update,delete on public.pf_projects to authenticated;
grant select,insert,update,delete on public.pf_records to authenticated;
grant select,insert on public.pf_assets to authenticated;
grant select on public.pf_publications to authenticated;
grant all on public.pf_profiles,public.pf_projects,public.pf_records,public.pf_assets,public.pf_publications to service_role;
create policy pf_own_profile on public.pf_profiles for all to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy pf_own_projects on public.pf_projects for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy pf_own_records on public.pf_records for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy pf_own_assets on public.pf_assets for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy pf_own_publication on public.pf_publications for select to authenticated using(owner_id=(select auth.uid()));

-- Private helper, never an exposed way to select another owner's draft.
create function public.pf_snapshot(p_owner uuid) returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object('profile',to_jsonb(profile)-'id'-'updated_at',
  'projects',coalesce((select jsonb_agg(to_jsonb(p)-'owner_id' order by p.position,p.id) from public.pf_projects p where p.owner_id=p_owner and p.included),'[]'::jsonb),
  'records',coalesce((select jsonb_agg(to_jsonb(r)-'owner_id' order by r.position,r.published_at desc,r.id) from public.pf_records r where r.owner_id=p_owner and r.published and r.published_at<=now()),'[]'::jsonb),
  'assets',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'alt',a.alt)) from public.pf_assets a where a.owner_id=p_owner and (a.id=profile.photo_id
    or exists(select 1 from public.pf_projects p where p.owner_id=p_owner and p.included and a.id=any(p.image_ids))
    or exists(select 1 from jsonb_each_text(coalesce(profile.legacy->'assetMap','{}')) item where item.value=a.id::text and (
      strpos(profile.about,item.key)>0 or exists(select 1 from public.pf_projects body_project where body_project.owner_id=p_owner and body_project.included and strpos(body_project.body,item.key)>0)
      or exists(select 1 from public.pf_records body_record where body_record.owner_id=p_owner and body_record.published and body_record.published_at<=now() and strpos(body_record.body,item.key)>0))))),'[]'::jsonb))
from public.pf_profiles profile where profile.id=p_owner;
$$;
revoke all on function public.pf_snapshot(uuid) from public,anon,authenticated;
-- Only this transaction constructs external snapshots. Draft tables are never public.
create function public.pf_publish(p_visibility text, p_version timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare profile public.pf_profiles; data jsonb; token text; hashed text; old_hash text;
begin
  if auth.uid() is null or p_visibility not in ('private','link','public') then raise exception 'NOT_ALLOWED'; end if;
  select * into profile from public.pf_profiles where id=auth.uid() for update;
  if not found then raise exception 'PROFILE_REQUIRED'; end if;
  if profile.updated_at<>p_version then raise exception 'VERSION_CONFLICT'; end if;
  if exists(select 1 from public.pf_projects p,unnest(p.image_ids) x where p.owner_id=auth.uid() and p.included and not exists(select 1 from public.pf_assets a where a.id=x and a.owner_id=auth.uid()))
    or (profile.photo_id is not null and not exists(select 1 from public.pf_assets where id=profile.photo_id and owner_id=auth.uid())) then raise exception 'ASSET_NOT_OWNED'; end if;
  data=public.pf_snapshot(auth.uid());
  select link_hash into old_hash from public.pf_publications where owner_id=auth.uid() and visibility='link';
  if p_visibility='link' then
    hashed=old_hash;
    if hashed is null then token=encode(extensions.gen_random_bytes(32),'hex'); hashed=encode(extensions.digest(token,'sha256'),'hex'); end if;
  end if;
  insert into public.pf_publications(owner_id,handle,visibility,snapshot,link_hash,version,published_at)
    values(auth.uid(),profile.handle,p_visibility,data,hashed,1,now())
    on conflict(owner_id) do update set visibility=excluded.visibility,snapshot=excluded.snapshot,link_hash=excluded.link_hash,version=public.pf_publications.version+1,published_at=now();
  return jsonb_build_object('token',token,'handle',profile.handle,'visibility',p_visibility);
end $$;

create function public.pf_visibility(p_visibility text) returns jsonb language plpgsql security definer set search_path='' as $$
declare token text;
begin
  if auth.uid() is null or p_visibility not in ('private','link','public') then raise exception 'NOT_ALLOWED'; end if;
  if p_visibility='link' then token=encode(extensions.gen_random_bytes(32),'hex'); end if;
  update public.pf_publications set visibility=p_visibility,link_hash=case when token is null then null else encode(extensions.digest(token,'sha256'),'hex') end where owner_id=auth.uid();
  if not found then raise exception 'PUBLISH_FIRST'; end if;
  return jsonb_build_object('token',token);
end $$;

create function public.pf_read(p_handle text,p_token text default '') returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object('snapshot',snapshot,'visibility',visibility,'published_at',published_at,'version',version) from public.pf_publications
where handle=p_handle and version>0 and (visibility='public' or (visibility='link' and length(p_token)=64 and link_hash=encode(extensions.digest(p_token,'sha256'),'hex')));
$$;

create function public.pf_media(p_id uuid,p_handle text,p_token text default '') returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object('path',a.path,'mime',a.mime) from public.pf_assets a where a.id=p_id and (
a.owner_id=auth.uid() or exists(select 1 from public.pf_publications p where p.handle=p_handle and p.owner_id=a.owner_id
and (p.visibility='public' or (p.visibility='link' and length(p_token)=64 and p.link_hash=encode(extensions.digest(p_token,'sha256'),'hex')))
and p.snapshot->'assets' @> jsonb_build_array(jsonb_build_object('id',a.id))));
$$;

create function public.pf_search(p_query text default '',p_tech text default '',p_role text default '',p_page integer default 0) returns jsonb
language sql stable security definer set search_path='' as $$
select coalesce(jsonb_agg(item),'[]'::jsonb) from (
select jsonb_build_object('project',project,'handle',p.handle,'name',p.snapshot->'profile'->>'name') item
from public.pf_publications p cross join lateral jsonb_array_elements(p.snapshot->'projects') project
where p.visibility='public' and (project->>'discoverable')::boolean=true
and (p_query='' or strpos(lower(concat_ws(' ',project->>'title',project->>'summary',project->>'problem',project->>'role',project->>'tech')),lower(left(p_query,100)))>0)
and (p_tech='' or exists(select 1 from jsonb_array_elements_text(project->'tech') t where lower(t)=lower(left(p_tech,40))))
and (p_role='' or strpos(lower(project->>'role'),lower(left(p_role,100)))>0)
order by p.published_at desc,project->>'id' limit 13 offset greatest(0,least(p_page,10000))*12
) matches;
$$;
create function public.pf_explore_project(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object('project',project,'handle',p.handle,'name',p.snapshot->'profile'->>'name')
from public.pf_publications p cross join lateral jsonb_array_elements(p.snapshot->'projects') project
where p.visibility='public' and (project->>'discoverable')::boolean=true and project->>'id'=p_id::text limit 1;
$$;
create function public.pf_facets() returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object('tech',coalesce(jsonb_agg(distinct tech order by tech),'[]'::jsonb))
from public.pf_publications p cross join lateral jsonb_array_elements(p.snapshot->'projects') project
cross join lateral jsonb_array_elements_text(project->'tech') tech where p.visibility='public' and (project->>'discoverable')::boolean=true;
$$;
create function public.pf_reorder(p_ids uuid[]) returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or cardinality(p_ids)<>(select count(*) from public.pf_projects where owner_id=auth.uid())
    or cardinality(p_ids)<>(select count(distinct id) from unnest(p_ids) id)
    or exists(select 1 from unnest(p_ids) requested(id) where not exists(select 1 from public.pf_projects p where p.id=requested.id and p.owner_id=auth.uid())) then raise exception 'NOT_ALLOWED'; end if;
  update public.pf_projects p set position=ordered.position from (select id,ordinality::integer position from unnest(p_ids) with ordinality as item(id,ordinality)) ordered where p.id=ordered.id and p.owner_id=auth.uid();
end $$;
revoke all on function public.pf_reorder(uuid[]) from public;
grant execute on function public.pf_reorder(uuid[]) to authenticated;

revoke all on function public.pf_touch(),public.pf_publish(text,timestamptz),public.pf_visibility(text),public.pf_read(text,text),public.pf_media(uuid,text,text),public.pf_search(text,text,text,integer),public.pf_explore_project(uuid),public.pf_facets() from public;
grant execute on function public.pf_publish(text,timestamptz),public.pf_visibility(text) to authenticated;
grant execute on function public.pf_read(text,text),public.pf_media(uuid,text,text),public.pf_search(text,text,text,integer),public.pf_explore_project(uuid),public.pf_facets() to anon,authenticated,service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('portfolio-private','portfolio-private',false,5242880,array['image/jpeg','image/png','image/webp','image/avif']) on conflict(id) do nothing;
create policy pf_upload_own on storage.objects for insert to authenticated with check(bucket_id='portfolio-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy pf_read_own on storage.objects for select to authenticated using(bucket_id='portfolio-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- No anonymous read, overwrite or delete policy. Public/shared bytes pass through /media/.
commit;
