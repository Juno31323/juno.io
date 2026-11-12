import {mkdir,readFile,writeFile} from 'node:fs/promises';
const value=process.env.PLATFORM_MIGRATION_TARGET;if(!value)throw new Error('Set PLATFORM_MIGRATION_TARGET to the verified new platform origin.');
const target=new URL(value);if(target.pathname!=='/'||target.search||target.hash||target.username||target.password||!(target.protocol==='https:'||target.protocol==='http:'&&['localhost','127.0.0.1'].includes(target.hostname)))throw new Error('Expected an HTTPS origin without a path.');
const {routes}=JSON.parse(await readFile('platform/route-map.json','utf8'));
const escape=value=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
for(const [from,to]of Object.entries({...routes,'/entry/':'/u/juno/blog/'})){
 if(from.includes('?'))continue;const directory=`dist-redirects${from}`;await mkdir(directory,{recursive:true});const destination=new URL(to,target).href;
 const script=from==='/entry/'?`const p=new URLSearchParams(location.search),k=p.get('type')||'posts',s=p.get('slug')||'';let path='/u/juno/blog/';if(['posts','projects','research','timeline','pages'].includes(k)&&/^[a-z0-9][a-z0-9-]{0,99}$/.test(s))path=k==='pages'?'/u/juno/#about':'/u/juno/'+(k==='posts'?'blog':k==='projects'?'projects':'records')+'/'+s+'/';location.replace(new URL(path,${JSON.stringify(target.origin)}).href);`:`location.replace(${JSON.stringify(destination)});`;
 await writeFile(directory+'index.html',`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>페이지가 이동했습니다</title><link rel="canonical" href="${escape(destination)}"><body><p>새 포트폴리오로 이동했습니다.</p><a href="${escape(destination)}">새 페이지 열기</a><script>${script}</script></body></html>`);
}
console.log('Prepared dist-redirects/. Upload only this directory after verifying the new platform. No original personal image files are included.');
await writeFile('dist-redirects/CNAME',(await readFile('public/CNAME','utf8')).trim()+'\n');
