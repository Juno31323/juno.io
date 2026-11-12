import {chromium} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import {readdir,readFile,writeFile} from 'node:fs/promises';
process.loadEnvFile('platform/.env');const base=process.env.PLATFORM_TEST_URL||'http://127.0.0.1:4400';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local verification only');
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}}),{data,error}=await db.rpc('pf_read',{p_handle:'juno',p_token:''});if(error)throw error;
const s=data.snapshot,routes=['/','/u/juno/','/u/juno/blog/',...s.projects.map(p=>`/u/juno/projects/${p.slug}/`),...s.records.map(r=>`/u/juno/${r.kind==='posts'?'blog':'records'}/${r.slug}/`)];
const browser=await chromium.launch({headless:true,channel:process.platform==='win32'?'msedge':undefined}),failures=[],errors=[];
try{const page=await browser.newPage({viewport:{width:1440,height:960}});page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(new URL(r.url()).origin===new URL(base).origin&&r.status()>=400)failures.push({url:r.url(),status:r.status()});});
for(const route of routes){const response=await page.goto(base+route,{waitUntil:'networkidle'});assert.equal(response.status(),200,route);await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(Array.from(document.querySelectorAll('img[src]')).map(image=>image.decode().catch(()=>{})));});assert.equal(await page.locator('h1').count(),1,route);assert.equal(await page.locator('img[src]').evaluateAll(images=>images.filter(image=>!image.complete||!image.naturalWidth||!image.alt).length),0,`${route} images`);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route);assert.ok(await page.evaluate(()=>document.fonts.check('16px Pretendard')),route);assert.equal(await page.locator('[src^="/juno.io/"],[href^="/juno.io/"]').count(),0,route);}
for(const name of await readdir('platform/dist/client/_astro'))if(name.endsWith('.js'))assert.ok(!(await readFile('platform/dist/client/_astro/'+name,'utf8')).includes(process.env.SUPABASE_SERVICE_ROLE_KEY),'Server key must not be in browser JavaScript');
assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);await writeFile('artifacts/platform/resources.json',JSON.stringify({base,routes,failedResources:failures,pageErrors:errors},null,2));console.log(`PASS: ${routes.length} compiled SSR routes, fonts, CSS/JS/images, stale prefix check and no server key in client bundles.`);
}finally{await browser.close();}
