import {createClient} from '@supabase/supabase-js';
import {Client} from 'pg';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {migrateMedia} from './migrate-media.mjs';
export async function importExample(owner){
  const target=process.env.SUPABASE_URL;
  if(!/^http:\/\/(127\.0\.0\.1|localhost):/.test(target||''))throw new Error('Example import is restricted to the isolated local project.');
  const dbUrl=process.env.LOCAL_DB_URL||'postgresql://postgres:postgres@127.0.0.1:54322/postgres';if(!['127.0.0.1','localhost'].includes(new URL(dbUrl).hostname))throw new Error('The SQL connection must also be local.');
  const sql=new Client({connectionString:dbUrl});
  await sql.connect();
  try{const existing=await sql.query("select to_regclass('public.entries') present");if(!existing.rows[0].present)await sql.query(await readFile('supabase/migrations/202611100001_cms.sql','utf8'));}
  finally{await sql.end();}
  const source=createClient(process.env.LEGACY_SUPABASE_URL||'https://iqghiamzcjxnzrkgcvlb.supabase.co',process.env.LEGACY_PUBLISHABLE_KEY||'sb_publishable_irnwmGtJskT2ljOSDXnmMg_YSJ8JUw4',{auth:{persistSession:false,autoRefreshToken:false}});
  const admin=createClient(target,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  let profile,entries;
  if(process.env.PLATFORM_TEST_FIXTURE==='1'){const fixture=JSON.parse(await readFile('platform/tests/fixtures/legacy-public.json','utf8'));profile={data:fixture.profile};entries=fixture.entries;}
  else{const result=await source.from('site_settings').select('data').eq('id','profile').single();if(result.error)throw result.error;profile=result.data;entries=[];for(let offset=0;;offset+=500){const {data,error}=await source.from('entries').select('*').eq('status','published').lte('published_at',new Date().toISOString()).order('id').range(offset,offset+499);if(error)throw error;entries.push(...data);if(data.length<500)break;}}
  if(process.env.UPDATE_PLATFORM_FIXTURES==='1'){await mkdir('platform/tests/fixtures',{recursive:true});await writeFile('platform/tests/fixtures/legacy-public.json',JSON.stringify({profile:profile.data,entries},null,2));}
  let result=await admin.from('site_settings').upsert({id:'profile',data:profile.data});if(result.error)throw result.error;
  if(entries.length){result=await admin.from('entries').upsert(entries);if(result.error)throw result.error;}
  result=await admin.rpc('pf_import_legacy',{p_owner:owner});if(result.error)throw result.error;
  const media=await migrateMedia(admin,owner,{localSource:true});
  return {entries,profile:profile.data,...result.data,...media};
}
