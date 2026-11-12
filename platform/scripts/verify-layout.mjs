import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,channel:process.platform==='win32'?'msedge':undefined});
await mkdir('artifacts/platform',{recursive:true});
try{for(const width of [390,768,1440]){const page=await browser.newPage({viewport:{width,height:960}});for(const path of ['/','/login/','/signup/','/explore/']){const response=await page.goto('http://127.0.0.1:4400'+path,{waitUntil:'networkidle'});assert.equal(response.status(),200);assert.equal(await page.locator('h1').count(),1);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width} ${path} overflow`);await page.screenshot({path:`artifacts/platform/${path==='/'?'landing':path.split('/')[1]}-${width}.png`,fullPage:true});}await page.close();}console.log('PASS: unauthenticated platform routes × 3 widths.');}finally{await browser.close();}
