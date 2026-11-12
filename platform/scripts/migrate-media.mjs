import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {marked} from 'marked';
export async function migrateMedia(admin,owner,{localSource=false}={}){
  const check=result=>{if(result.error)throw result.error;return result.data;};
  let profile=check(await admin.from('pf_profiles').select('*').eq('id',owner).single());
  if(!profile.legacy?.import_pending)return {alreadyComplete:true};
  const projects=check(await admin.from('pf_projects').select('*').eq('owner_id',owner));
  const records=check(await admin.from('pf_records').select('*').eq('owner_id',owner));
  const images=new Map();const add=(url,alt)=>{if(typeof url==='string'&&url)images.set(url,alt||'기존 첨부 이미지');};
  add(profile.legacy.heroPhoto,profile.legacy.photoAlt);add(profile.legacy.photo,profile.legacy.photoAlt);
  for(const project of projects)add(project.legacy?.cardImage,project.legacy?.cardAlt||project.title);
  for(const record of records){add(record.metadata?.coverImage,record.metadata?.coverAlt||record.title);add(record.metadata?.cardImage,record.metadata?.cardAlt||record.title);}
  for(const item of [profile.about,...projects.map(p=>p.body),...records.map(r=>r.body)]){
    marked.walkTokens(marked.lexer(item||''),token=>{if(token.type==='image')add(token.href,token.text);});
    for(const match of(item||'').matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi))add(match[1],match[0].match(/\balt=["']([^"']*)/i)?.[1]);
  }
  const map={...profile.legacy.assetMap};
  const updateProfile=async payload=>{const next=check(await admin.from('pf_profiles').update(payload).eq('id',owner).eq('updated_at',profile.updated_at).select().maybeSingle());if(!next)throw new Error('Profile changed during import; resume after reviewing edits.');profile=next;};
  for(const [source,alt]of images){
    if(map[source])continue;
    const url=new URL(source,'https://juno31323.me');
    if(!['juno31323.me','iqghiamzcjxnzrkgcvlb.supabase.co'].includes(url.hostname)||url.protocol!=='https:')throw new Error(`Unapproved legacy image host: ${url.hostname}`);
    let bytes,mime;
    const extension=url.pathname.split('.').pop()?.toLowerCase();mime={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',avif:'image/avif'}[extension];
    if(localSource&&url.hostname==='juno31323.me'&&url.pathname.startsWith('/images/')){
      const root=resolve('public/images'),file=resolve('public',`.${decodeURIComponent(url.pathname)}`);
      if(!file.startsWith(root+'/')&&!file.startsWith(root+'\\'))throw new Error('Image outside public images');bytes=await readFile(file);
    }else{const response=await fetch(url);if(!response.ok)throw new Error(`Legacy image failed: ${response.status}`);mime=(response.headers.get('content-type')||mime||'').split(';')[0];bytes=Buffer.from(await response.arrayBuffer());}
    const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif'}[mime];if(!ext||bytes.length>5242880||!bytes.length)throw new Error('Unsupported or oversized legacy image');
    const id=randomUUID(),path=`${owner}/${id}.${ext}`;
    check(await admin.storage.from('portfolio-private').upload(path,bytes,{contentType:mime,upsert:false}));
    check(await admin.from('pf_assets').insert({id,owner_id:owner,path,mime,size:bytes.length,alt:String(alt).slice(0,300)||'기존 첨부 이미지'}));
    map[source]=id;await updateProfile({legacy:{...profile.legacy,assetMap:map}});
  }
  for(const project of projects){const id=map[project.legacy?.cardImage];if(id&&!project.image_ids.length){const result=check(await admin.from('pf_projects').update({image_ids:[id]}).eq('id',project.id).eq('owner_id',owner).eq('updated_at',project.updated_at).select().maybeSingle());if(!result)throw new Error('Project changed during import.');}}
  await updateProfile({photo_id:profile.photo_id||map[profile.legacy.heroPhoto]||map[profile.legacy.photo]||null,legacy:{...profile.legacy,assetMap:map}});
  check(await admin.rpc('pf_complete_import',{p_owner:owner,p_version:profile.updated_at}));
  return {images:Object.keys(map).length};
}
if(resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){
  process.loadEnvFile('platform/.env');
  const owner=process.argv[2];if(!/^[0-9a-f-]{36}$/i.test(owner||''))throw new Error('Provide the source owner UUID as an argument.');
  const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  console.log(await migrateMedia(admin,owner,{localSource:/^http:\/\/(127\.0\.0\.1|localhost):/.test(process.env.SUPABASE_URL)}));
}
