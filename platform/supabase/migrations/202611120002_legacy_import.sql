begin;
-- Explicit owner, service-role only, idempotent. Never overwrite later platform edits.
create function public.pf_import_legacy(p_owner uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare settings jsonb; profile public.pf_profiles; migrated integer;
begin
  if to_regclass('public.site_settings') is null or to_regclass('public.entries') is null then raise exception 'LEGACY_TABLES_MISSING'; end if;
  select data into settings from public.site_settings where id='profile';
  if settings is null or not exists(select 1 from auth.users where id=p_owner) then raise exception 'OWNER_OR_PROFILE_MISSING'; end if;
  insert into public.pf_profiles(id,handle,name,intro,about,links,legacy,theme)
    values(p_owner,'juno',settings->>'name',coalesce(settings->>'intro',''),coalesce((select body from public.entries where kind='pages' and slug='about' and status='published' and published_at<=now()),''),
      jsonb_build_array(jsonb_build_object('label','GitHub','url',settings->>'github')),settings||'{"import_pending":true}'::jsonb,'{"accent":"blue","mode":"light","order":["projects","about","research","timeline","posts"],"hidden":[]}') on conflict(id) do nothing;
  select * into profile from public.pf_profiles where id=p_owner;
  insert into public.pf_projects(owner_id,slug,title,summary,body,role,period,featured,position,links,legacy,included,tech)
  select p_owner,slug,title,summary,body,coalesce(metadata->>'role',''),coalesce(metadata->>'period',''),featured,sort_order,
    coalesce(metadata->'links','[]'),metadata,status='published' and published_at<=now(),
    case when slug='firezone' then array['React Native','Expo','NestJS','Docker','Cloud Run'] when metadata->>'listRole' is not null then regexp_split_to_array(metadata->>'listRole','\s*·\s*') else '{}'::text[] end
  from public.entries where kind='projects' on conflict(owner_id,slug) do nothing;
  get diagnostics migrated=row_count;
  insert into public.pf_records(owner_id,kind,slug,title,summary,body,metadata,published,published_at,position)
    select p_owner,kind,slug,title,summary,body,metadata,status='published',published_at,sort_order from public.entries where kind<>'projects'
    on conflict(owner_id,kind,slug) do nothing;
  -- Keep unavailable until private media has been transferred and checked.
  insert into public.pf_publications(owner_id,handle,visibility,snapshot,version,published_at)
  select p_owner,profile.handle,'private',jsonb_build_object('profile',to_jsonb(profile)-'id'-'updated_at',
    'projects',coalesce((select jsonb_agg(to_jsonb(p)-'owner_id' order by p.position,p.id) from public.pf_projects p where owner_id=p_owner and included),'[]'::jsonb),
    'records',coalesce((select jsonb_agg(to_jsonb(r)-'owner_id' order by r.position,r.published_at desc) from public.pf_records r where owner_id=p_owner and published and published_at<=now()),'[]'::jsonb),'assets','[]'::jsonb),1,now()
  on conflict(owner_id) do nothing;
  return jsonb_build_object('handle',profile.handle,'projects_imported',migrated);
end $$;
revoke all on function public.pf_import_legacy(uuid) from public,anon,authenticated;
grant execute on function public.pf_import_legacy(uuid) to service_role;
create function public.pf_complete_import(p_owner uuid,p_version timestamptz) returns void language plpgsql security definer set search_path='' as $$
begin
  update public.pf_profiles set legacy=legacy-'import_pending' where id=p_owner and updated_at=p_version and legacy->>'import_pending'='true';
  if not found then raise exception 'IMPORT_NOT_PENDING_OR_CHANGED'; end if;
  update public.pf_publications set snapshot=public.pf_snapshot(p_owner),visibility='public',published_at=now() where owner_id=p_owner and version=1 and visibility='private';
  if not found then raise exception 'IMPORT_ALREADY_PUBLISHED'; end if;
end $$;
revoke all on function public.pf_complete_import(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.pf_complete_import(uuid,timestamptz) to service_role;
-- Existing single-owner deployments can migrate without hard-coding personal identifiers.
do $$ declare owner uuid; count_admins integer; begin
  if to_regclass('public.site_admins') is not null then
    select count(*),min(user_id::text)::uuid into count_admins,owner from public.site_admins;
    if count_admins=1 and exists(select 1 from public.site_settings where id='profile') then perform public.pf_import_legacy(owner); end if;
  end if;
end $$;
commit;
