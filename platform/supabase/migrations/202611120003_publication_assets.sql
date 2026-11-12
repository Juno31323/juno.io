begin;
-- Retain only media actually referenced by this publication, including imported
-- journal/research covers. Removing a project must also revoke its old cover.
create or replace function public.pf_snapshot(p_owner uuid) returns jsonb language sql stable security definer set search_path='' as $$
with profile as (select * from public.pf_profiles where id=p_owner),
projects as (select * from public.pf_projects where owner_id=p_owner and included),
records as (select * from public.pf_records where owner_id=p_owner and published and published_at<=now()),
assets as (
 select a.id,a.alt from public.pf_assets a,profile p where a.owner_id=p_owner and (
  a.id=p.photo_id or exists(select 1 from projects project where a.id=any(project.image_ids))
  or exists(select 1 from jsonb_each_text(coalesce(p.legacy->'assetMap','{}')) item where item.value=a.id::text and (
    strpos(p.about,item.key)>0
    or exists(select 1 from projects project where strpos(concat_ws(' ',project.body,project.problem,project.contribution,project.approach,project.result),item.key)>0)
    or exists(select 1 from records record where strpos(record.body,item.key)>0 or record.metadata->>'coverImage'=item.key or record.metadata->>'cardImage'=item.key)
  ))
 )
)
select jsonb_build_object(
 'profile',jsonb_set(to_jsonb(p)-'id'-'updated_at','{legacy,assetMap}',coalesce((select jsonb_object_agg(item.key,item.value) from jsonb_each_text(coalesce(p.legacy->'assetMap','{}')) item where exists(select 1 from assets a where a.id::text=item.value)),'{}'::jsonb)),
 'projects',coalesce((select jsonb_agg(to_jsonb(project)-'owner_id' order by project.position,project.id) from projects project),'[]'::jsonb),
 'records',coalesce((select jsonb_agg(to_jsonb(record)-'owner_id' order by record.position,record.published_at desc,record.id) from records record),'[]'::jsonb),
 'assets',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'alt',a.alt)) from assets a),'[]'::jsonb)
) from profile p;
$$;
revoke all on function public.pf_snapshot(uuid) from public,anon,authenticated;
commit;
