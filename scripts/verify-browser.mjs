import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const baseURL = process.env.PREVIEW_URL || 'http://127.0.0.1:4321';
const widths = [390, 768, 1440];
const projectRoutes = (await readdir('src/content/projects')).filter(file => file.endsWith('.md')).map(file => `/projects/${file.slice(0, -3)}/`);
const researchRoutes = (await readdir('src/content/research')).filter(file => file.endsWith('.md')).map(file => `/research/${file.slice(0, -3)}/`);
const routes = ['/', '/about/', '/projects/', '/research/', '/timeline/', ...projectRoutes, ...researchRoutes];
const screenshotRoutes = new Set(['/', '/about/', '/timeline/', ...projectRoutes, ...researchRoutes]);
const output = 'artifacts';
await mkdir(output, { recursive: true });
const channel = process.env.BROWSER_CHANNEL || (process.platform === 'win32' && existsSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe') ? 'msedge' : undefined);
const browser = await chromium.launch({ headless: true, channel });
const results = [];
const internalLinks = new Set();
const titles = new Map();

try {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 960 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    for (const route of routes) {
      const response = await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
      assert.equal(response?.status(), 200, `${route}: HTTP 200`);
      await page.evaluate(() => document.fonts.ready);
      const brokenImages = await page.locator('img').evaluateAll(elements => elements.filter(element => !element.complete || !element.naturalWidth || !element.alt).map(element => element.src));
      assert.deepEqual(brokenImages, [], `${route}: images load with alt text`);
      if (route === '/') {
        assert.equal(await page.locator('.hero-portrait img[src="/images/portfolio/portrait.webp"]').count(), 1, 'Home: prepared user portrait appears once');
        assert.equal(await page.locator('.home-work-art').count(), 3, 'Each featured work has its illustration');
        assert.deepEqual(await page.locator('.home-work').evaluateAll(elements => elements.map(element => element.getAttribute('href'))), ['/projects/firezone/', '/projects/printsafe/', '/research/university-notice-rag/']);
      }
      if (route === '/about/') assert.equal(await page.locator('img[src="/images/min-junho.jpg"]').count(), 1, 'About: original user portrait appears once');
      assert.equal(await page.locator('h1').count(), 1, `${route}: single h1`);
      assert.equal(await page.locator('html').getAttribute('lang'), 'ko');
      assert.ok((await page.locator('meta[name="description"]').getAttribute('content'))?.length);
      const title = await page.title();
      if (width === widths[0]) titles.set(route, title);
      const overflow = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
      assert.ok(overflow.document <= width + 1 && overflow.body <= width + 1, `${route} ${width}px: horizontal overflow ${JSON.stringify(overflow)}`);
      const clipped = await page.locator('h1, h2, h3, .work-main p, .hero-intro p, .prose p').evaluateAll(elements => elements.filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.width && (rect.left < -1 || rect.right > window.innerWidth + 1 || element.scrollWidth > element.clientWidth + 1);
      }).map(element => element.textContent));
      assert.deepEqual(clipped, [], `${route} ${width}px: clipped content`);
      const smallTargets = await page.locator('.text-link, .outline-link, .footer-links a, .back-link').evaluateAll(elements => elements.filter(element => element.getBoundingClientRect().height < 43.5).map(element => ({ text: element.textContent, height: element.getBoundingClientRect().height })));
      assert.deepEqual(smallTargets, [], `${route} ${width}px: navigation hit targets`);
      if (route === '/') {
        assert.equal(await page.locator('.hero-links .button-link').getAttribute('href'), '/projects/', 'Work is the primary action');
        assert.equal(await page.locator('.work-row').count(), 3, 'Home has three selected works');
        assert.equal(await page.locator('#selected-work h2').innerText(), '만든 것들');
        assert.equal(await page.locator('.footer-links a[href="https://github.com/Juno31323"]').count(), 1, 'Provided public GitHub link');
        const geometry = await page.evaluate(() => ({ width: window.innerWidth, firstWorkY: document.querySelector('.work-row').getBoundingClientRect().top, heroHeight: document.querySelector('.hero').getBoundingClientRect().height, fontLoaded: document.fonts.check('16px "Pretendard Variable"') }));
        assert.equal(geometry.fontLoaded, true, 'Self-hosted font is loaded');
        if (width === 390) assert.ok(geometry.firstWorkY < 1050, 'Mobile work appears sooner than the previous 1348px');
        results.push({ homepageGeometry: geometry });
      }
      const hrefs = await page.locator('a').evaluateAll(elements => elements.map(element => element.getAttribute('href')));
      const pageText = await page.locator('body').innerText();
      for (const removedText of ['학교생활 앱', '카카오톡 메시지 자동화', '학원 NAS', 'PartyFork', '마인크래프트', 'AI FESTA']) {
        assert.equal(pageText.includes(removedText), false, `Removed content: ${removedText}`);
      }
      if (route === '/timeline/') {
        assert.ok(pageText.includes('정보처리기능사 필기 합격') && pageText.includes('실기 준비 중'));
        assert.equal(pageText.includes('정보처리기능사 취득'), false);
        const university = page.locator('.timeline-list > li').filter({ has: page.getByRole('heading', { name: '안산대학교 인공지능소프트웨어학과', exact: true }) });
        assert.ok((await university.innerText()).includes('2026년 학과 학생회 참여'), 'Student council is under university');
        assert.equal(await page.getByRole('heading', { name: '학과 학생회', exact: true }).count(), 0);
        const cleaning = page.locator('.timeline-list > li').filter({ has: page.getByRole('heading', { name: 'AI 데이터 정제 활동', exact: true }) });
        assert.ok((await cleaning.innerText()).includes('엘비에스테크'));
      }
      if (route === '/research/university-notice-rag/') {
        assert.ok(pageText.includes('67.35%') && pageText.includes('89.80%') && pageText.includes('검색 지표'));
        assert.ok(pageText.includes('추가 검색 이점을 확인하지 못했습니다'));
      }
      for (const href of hrefs) {
        assert.ok(href && href !== '#', `${route}: no placeholder links`);
        if (href.startsWith('/')) internalLinks.add(href);
        if (href.startsWith('#')) assert.equal(await page.locator(`[id="${href.slice(1)}"]`).count(), 1, `${route}: existing anchor ${href}`);
      }
      if (screenshotRoutes.has(route)) {
        const slug = route === '/' ? 'home' : route.split('/').filter(Boolean).join('-');
        await page.screenshot({ path: `${output}/${slug}-${width}.png`, fullPage: true });
        if (route === '/' && width === 1440) await page.screenshot({ path: `${output}/home-preview.png` });
      }
      results.push({ route, width, status: 'passed', title, ...overflow });
    }

    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.skip-link').evaluate(element => element === document.activeElement), true, 'Keyboard skip link is first');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#main').evaluate(element => element === document.activeElement), true, 'Skip link focuses main');

    if (width <= 760) {
      const menu = page.locator('.menu-toggle');
      const nav = page.getByRole('navigation', { name: '주 메뉴' });
      assert.equal(await nav.isVisible(), false);
      await menu.click();
      assert.equal(await nav.isVisible(), true);
      assert.equal(await menu.getAttribute('aria-expanded'), 'true');
      await page.keyboard.press('Escape');
      assert.equal(await nav.isVisible(), false);
      assert.equal(await menu.evaluate(element => element === document.activeElement), true);
      await page.keyboard.press('Enter');
      await page.keyboard.press('Tab');
      assert.equal(await nav.getByRole('link', { name: '한눈에 보기', exact: true }).evaluate(element => element === document.activeElement), true);
      await page.keyboard.press('Escape');
      await menu.click();
      await page.getByRole('button', { name: '메뉴 닫기' }).click();
      assert.equal(await nav.isVisible(), false);
      await menu.click();
      await page.locator('h1').click();
      assert.equal(await nav.isVisible(), false, 'Outside click closes menu');
      await menu.click();
      await nav.getByRole('link', { name: '만든 것들', exact: true }).click();
      await page.waitForURL('**/projects/');
      assert.equal(await page.getByRole('navigation', { name: '주 메뉴' }).isVisible(), false);
      results.push({ width, mobileMenu: 'click, close, Escape, keyboard, outside click, navigation passed' });
    } else {
      assert.equal(await page.locator('.menu-toggle').isVisible(), false);
      assert.equal(await page.getByRole('navigation', { name: '주 메뉴' }).isVisible(), true);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.work-row').first().evaluate(element => getComputedStyle(element).transitionDuration), '0s');
    assert.deepEqual(errors, [], `${width}px: browser errors`);
    await page.close();
  }

  assert.equal(new Set(titles.values()).size, routes.length, 'Every page has a unique title');
  const compPage = await browser.newPage({ viewport: { width: 1487, height: 1058 }, deviceScaleFactor: 1 });
  await compPage.goto(baseURL, { waitUntil: 'networkidle' });
  await compPage.evaluate(() => document.fonts.ready);
  await compPage.screenshot({ path: `${output}/home-comp-viewport.png` });
  await compPage.close();
  const page = await browser.newPage();
  for (const href of internalLinks) {
    const response = await page.request.get(`${baseURL}${href}`);
    assert.equal(response.status(), 200, `Internal link: ${href}`);
  }
  for (const route of ['/projects/campus-app/', '/projects/kakaotalk-automation/', '/projects/academy-documents/', '/projects/partyfork/']) {
    assert.equal((await page.request.get(`${baseURL}${route}`)).status(), 404, `Removed project route: ${route}`);
  }
  const missing = await page.goto(`${baseURL}/does-not-exist/`);
  assert.equal(missing?.status(), 404);
  assert.ok((await page.locator('h1').textContent()).includes('찾을 수 없습니다'));
  await page.close();

  const noJS = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const noJSPage = await noJS.newPage();
  await noJSPage.goto(baseURL);
  assert.equal(await noJSPage.getByRole('navigation', { name: '주 메뉴' }).isVisible(), true);
  await noJSPage.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '만든 것들', exact: true }).click();
  assert.ok(noJSPage.url().endsWith('/projects/'));
  results.push({ javaScriptDisabled: 'Navigation and static content passed', internalLinks: internalLinks.size, notFound: 'HTTP 404 + custom page passed', uniquePageTitles: titles.size });
  await noJS.close();
  await writeFile(`${output}/browser-results.json`, JSON.stringify(results, null, 2));
  console.log(`PASS: ${routes.length} pages × ${widths.length} widths, ${internalLinks.size} internal links, mobile menu, keyboard, reduced motion, no-JS navigation, custom 404.`);
  console.log(`Screenshots and results: ${output}/`);
} finally {
  await browser.close();
}
