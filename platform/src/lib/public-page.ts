import type { APIContext } from 'astro';
import type { Snapshot } from './model';
export async function publicPage(context: APIContext) {
  const handle=context.params.handle||'', token=context.params.token||'', path=context.params.path||'';
  let snapshot: Snapshot|null=null, visibility='', status=404;
  if (context.locals.db) {
    const {data,error}=await context.locals.db.rpc('pf_read',{p_handle:handle,p_token:token});
    if(error) status=503; else if(data) { snapshot=data.snapshot;visibility=data.visibility;status=200; }
  } else status=503;
  const [kind,slug]=path.split('/').filter(Boolean);
  const detail=snapshot&&(kind==='projects'?snapshot.projects.find(p=>p.slug===slug):slug?snapshot.records.find(r=>r.slug===slug&&(kind!=='blog'||r.kind==='posts')):null);
  const shared=visibility==='link';
  const title=shared?'공유된 포트폴리오':snapshot?detail?`${detail.title} — ${snapshot.profile.name}`:`${snapshot.profile.name}의 포트폴리오`:'페이지를 열 수 없습니다';
  const description=shared?'공유받은 링크에서 포트폴리오를 확인하세요.':snapshot?detail?.summary||snapshot.profile.intro:'비공개이거나 공유가 중단된 페이지입니다.';
  const photo=snapshot?.profile.photo_id;
  const image=shared?'/platform/og.png':photo?`/media/${photo}/?handle=${handle}`:'/platform/og.png';
  return {snapshot,status,title,description,image,noindex:shared||!snapshot,base:token?`/s/${handle}/${token}/`:`/u/${handle}/`,token,path};
}
