-- Run in SQL Editor after schema, seed and administrator registration.
-- All probe records are rolled back; no existing content is changed.
begin;
select set_config('test.admin_uid', (select user_id::text from public.site_admins limit 1), true);
insert into public.entries(kind,slug,title,status,published_at) values
 ('posts','rls-probe-public','RLS probe','published',now()-interval '1 hour'),
 ('posts','rls-probe-draft','RLS probe','draft',now()-interval '1 hour'),
 ('posts','rls-probe-future','RLS probe','published',now()+interval '1 day');
set local role anon;
do $$ begin
 if (select count(*) from public.entries where slug like 'rls-probe-%') <> 1 then raise exception 'Anonymous draft/future visibility failure'; end if;
 if public.is_site_admin() then raise exception 'Anonymous administrator failure'; end if;
 begin
   insert into public.entries(kind,slug,title) values ('posts','rls-probe-anon-write','RLS probe');
   raise exception 'Anonymous write unexpectedly allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.entries where slug like 'rls-probe-%') <> 1 then raise exception 'Non-admin draft visibility failure'; end if;
 if public.is_site_admin() then raise exception 'Non-admin privilege escalation'; end if;
 begin
   insert into public.entries(kind,slug,title) values ('posts','rls-probe-user-write','RLS probe');
   raise exception 'Non-admin write unexpectedly allowed';
 exception when insufficient_privilege then null; end;
 begin
   insert into public.site_admins(user_id) values ('11111111-1111-4111-8111-111111111111');
   raise exception 'Self-promotion unexpectedly allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.admin_uid'),'role','authenticated')::text,true);
select set_config('request.jwt.claim.sub',current_setting('test.admin_uid'),true);
set local role authenticated;
do $$ begin
 if not public.is_site_admin() then raise exception 'Registered admin not authorized'; end if;
 if (select count(*) from public.entries where slug like 'rls-probe-%') <> 3 then raise exception 'Admin draft visibility failure'; end if;
 insert into public.entries(kind,slug,title,status) values ('posts','rls-probe-admin-write','RLS probe','draft');
 update public.entries set body='roundtrip verified' where slug='rls-probe-admin-write';
 if not exists(select 1 from public.entries where slug='rls-probe-admin-write' and body='roundtrip verified') then raise exception 'Admin write failed'; end if;
end $$;
reset role;
rollback;
select 'PASS: anonymous/non-admin isolation, draft/future privacy, self-promotion blocked, admin write roundtrip; probes rolled back' as result;
