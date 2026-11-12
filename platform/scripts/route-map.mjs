import {readFile,writeFile} from 'node:fs/promises';
const fixture=JSON.parse(await readFile('platform/tests/fixtures/legacy-public.json','utf8'));
const routes={'/':'/u/juno/','/about/':'/u/juno/#about','/projects/':'/u/juno/#projects','/research/':'/u/juno/#research','/timeline/':'/u/juno/#timeline','/blog/':'/u/juno/blog/','/admin/':'/dashboard/'};
for(const entry of fixture.entries){const destination=entry.kind==='pages'?'/u/juno/#about':`/u/juno/${entry.kind==='projects'?'projects':entry.kind==='posts'?'blog':'records'}/${entry.slug}/`;routes[`/entry/?type=${entry.kind}&slug=${entry.slug}`]=destination;if(entry.kind==='projects'||entry.kind==='research')routes[`/${entry.kind}/${entry.slug}/`]=destination;}
await writeFile('platform/route-map.json',JSON.stringify({source:'Existing published portfolio and blog, read via public RLS',routes},null,2));
console.log(`Prepared ${Object.keys(routes).length} legacy route mappings.`);
