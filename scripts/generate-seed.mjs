import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { parse } from 'yaml';

const entries = [];
const art = {
  firezone: ['/images/portfolio/firezone-art.webp', '소방구역을 표현한 지도와 소방차 일러스트'],
  printsafe: ['/images/portfolio/printsafe-art.webp', '여러 PDF 문서를 겹쳐 놓은 일러스트'],
  'university-notice-rag': ['/images/portfolio/rag-art.webp', '대학 공지 질의응답을 표현한 두 말풍선 일러스트'],
};
for (const kind of ['projects', 'research', 'timeline']) {
  for (const file of await readdir(`src/content/${kind}`)) {
    if (!file.endsWith('.md')) continue;
    const raw = await readFile(`src/content/${kind}/${file}`, 'utf8');
    const [, frontmatter, body] = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    const data = parse(frontmatter), slug = file.replace(/\.md$/, '');
    const { title, summary = '', order = 0, featured = false, ...metadata } = data;
    if (art[slug]) [metadata.cardImage, metadata.cardAlt] = art[slug];
    entries.push({ kind, slug, title, summary, body: body.trim(), status: 'published', published_at: '2026-11-09T00:00:00Z', sort_order: order, featured, metadata });
  }
}
const about = await readFile('src/pages/about.astro', 'utf8');
const body = about.split('<article class="prose">')[1].split('<div class="resource-links">')[0].trim();
entries.push({ kind: 'pages', slug: 'about', title: '저에 대해', summary: '민준호의 소개와 학습 기록.', body, status: 'published', published_at: '2026-11-09T00:00:00Z', sort_order: 0, featured: false, metadata: {} });
const profile = {
  name: '민준호', school: '안산대학교', major: '인공지능소프트웨어학과', intro: '백엔드와 앱을 만들고, 대학 공지 RAG를 연구합니다.', github: 'https://github.com/Juno31323',
  heroPhoto: '/images/portfolio/portrait.webp', photo: '/images/min-junho.jpg', photoAlt: '안경과 짙은색 티셔츠를 착용한 민준호의 프로필 사진',
  researchSummary: '49개 문항으로 OCR과 레이아웃에 따른 검색 성능을 비교했습니다.',
  interests: '### RAG·정보검색\nOCR · 하이브리드 검색 · 검색 평가\n\n### AI 시스템·MLOps\n운영·배포\n\n### 다음 공부\nSQLD · C · C++ · Rust',
};
const quote = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const sql = `-- Initial public content. Re-running preserves existing edits.\nbegin;\ninsert into public.entries (kind,slug,title,summary,body,status,published_at,sort_order,featured,metadata)\nselect kind,slug,title,summary,body,status,published_at,sort_order,featured,metadata from jsonb_to_recordset(${quote(entries)}) as x(kind text,slug text,title text,summary text,body text,status text,published_at timestamptz,sort_order integer,featured boolean,metadata jsonb) on conflict (kind,slug) do nothing;\ninsert into public.site_settings(id,data) values ('profile',${quote(profile)}) on conflict (id) do nothing;\ncommit;\n`;
await mkdir('supabase', { recursive: true }); await writeFile('supabase/seed.sql', sql);
await mkdir('artifacts', { recursive: true }); await writeFile('artifacts/seed-data.json', JSON.stringify({ entries, profile }, null, 2));
console.log(`Generated ${entries.length} public records and profile; no blog posts invented.`);
