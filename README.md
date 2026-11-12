# 민준호의 포트폴리오 · 블로그

Astro + TypeScript + Supabase. 관리자 화면에서 글과 포트폴리오 내용을 수정합니다.

- `/admin/`: 이메일·비밀번호 로그인, 글·프로젝트·연구·이력·소개·프로필 관리
- `/blog/`: 공개 글, 제목 검색, 더 보기
- Supabase Auth / Postgres / Storage, 관리자만 쓰기 가능한 RLS
- 초안·예약 발행·보관, Markdown 미리보기, 이미지 업로드, JSON 백업
- GitHub Pages 자동 배포: [Juno31323/juno.io](https://github.com/Juno31323/juno.io)

일상적인 글 작성은 GitHub를 수정하거나 재배포할 필요가 없습니다. 자세한 사용법은 [운영 가이드](OPERATIONS.md)를 보세요.

## 로컬 실행

Node.js 24를 권장합니다. 최소 버전은 22.23.4입니다.

```sh
npm ci
cp .env.example .env
# .env에 Project URL과 Publishable key 입력
npm run dev
```

Windows에서는 `Copy-Item .env.example .env`를 사용합니다. 프로젝트 전용 Node 24도 개발 의존성으로 설치되므로 `npm run` 스크립트는 해당 런타임을 사용합니다.

```sh
npm run build
npm run preview
npm run test:browser
npm run test:cms
```

검증 스크립트의 `PREVIEW_URL`로 미리보기 주소를 바꿀 수 있습니다. 브라우저가 없으면 `npx playwright install chromium`을 실행하세요. CMS UI 검증은 모의 API를 사용하므로 운영 DB에 테스트 글을 쓰지 않습니다.

## 처음 연결할 때

1. Supabase SQL Editor에서 `supabase/migrations/202611100001_cms.sql`을 한 번 실행합니다.
2. `supabase/seed.sql`로 기존 공개 내용을 가져옵니다. 기존 수정 내용은 덮어쓰지 않습니다.
3. Authentication → Users에서 관리자용 계정을 생성합니다.
4. 계정의 UID를 `insert into public.site_admins(user_id) values ('사용자-UUID');`로 등록합니다.
5. `supabase/tests/rls.sql`을 실행하면 익명·일반 사용자·관리자의 권한을 검사하고 검증 데이터를 롤백합니다.

`/admin/setup/`에서도 SQL을 확인할 수 있습니다. 브라우저에는 Publishable key만 사용합니다. secret/service_role 키는 넣지 않습니다. 관리자 목록은 브라우저에서 수정할 수 없습니다.

## GitHub Pages

저장소 Settings → Pages → Source를 **GitHub Actions**로 지정합니다. main에 코드를 올리면 `.github/workflows/deploy.yml`이 빌드·배포합니다.

사이트 주소는 `https://juno31323.me/`입니다. 커스텀 도메인은 저장소 이름이 붙지 않는 루트 경로를 사용하므로 워크플로는 `SITE_URL=https://juno31323.me`, `BASE_PATH=/`로 빌드합니다. `public/CNAME`에도 같은 도메인을 기록합니다. 빌드 후 `npm run verify:assets`가 HTML·CSS의 로컬 리소스 경로를 검사합니다. GitHub 기본 프로젝트 주소로 돌아갈 때만 `BASE_PATH=/juno.io`로 바꾸고 커스텀 도메인 설정을 해제하세요. Supabase 프로젝트를 바꾸면 저장소 Variables의 `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY`도 바꿉니다. 현재 워크플로에는 이 사이트의 공개용 연결 정보가 기본값으로 들어 있습니다.

## 파일

| 위치 | 용도 |
| --- | --- |
| `src/pages/admin/`, `src/scripts/admin.ts` | 관리자 화면 |
| `src/scripts/public-content.ts` | Supabase 공개 콘텐츠 조회 |
| `src/lib/markdown.ts` | Markdown 렌더링·HTML 정제 |
| `supabase/` | 테이블·권한·공개 초기 내용·권한 테스트 |
| `src/content/`, `src/data/` | 기존 포트폴리오의 정적 초기 내용 |
| `src/styles/`, `DESIGN.md` | 화면 스타일과 기존 디자인 체계 |
| `public/images/`, `public/fonts/` | 공개 이미지·Pretendard와 라이선스 |

Supabase 연결 후에는 관리 화면에서 수정한 DB 내용이 우선합니다. 로컬 Markdown 수정은 DB에 자동 반영되지 않습니다. 초기 내용 재생성은 `npm run seed:generate`입니다.

GitHub Pages는 정적 호스팅이므로 새 기록은 `/entry/?type=posts&slug=...`에서 브라우저가 불러옵니다. 개별 글의 서버 렌더링·검색 색인·OG 카드·RSS는 제공하지 않습니다. Supabase 장애 시 기존 포트폴리오의 정적 초기 내용은 표시되며, 블로그에는 조회 실패 안내가 표시됩니다. 기존 정적 페이지의 내용까지 완전히 없애려면 해당 소스도 수정해 재배포해야 합니다.
