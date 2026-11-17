# 개인 포트폴리오 Vercel 운영

운영 주소는 `https://juno31323.me`다. Vercel의 `juno-io` 프로젝트는 GitHub의 `Juno31323/juno.io` 저장소에 연결되어 있으며, `main`에 푸시하면 사이트 코드가 배포된다. 관리자 화면에서 글을 발행할 때는 재배포할 필요가 없다.

Vercel 프로젝트의 루트는 저장소의 최상위 폴더다. Astro 프레임워크, Node.js 24, 빌드 명령 `npm run build`를 사용한다. `platform/`은 별도 앱이므로 배포 대상에 넣지 않는다.

Vercel은 시스템 변수 `VERCEL=1`로 확인한다. 홈·프로젝트·연구·이력·소개·블로그와 이전 `/entry/`는 요청 시 현재 Supabase 공개 데이터로 HTML을 만들어 보낸다. 조회가 실패해도 저장소의 이전 콘텐츠로 대체하지 않는다. 기존 GitHub Pages 빌드에는 서버 어댑터를 적용하지 않는다.

Vercel 프로젝트의 Production과 Preview 환경에 다음 값을 설정한다.

| 환경 변수 | 값 |
| --- | --- |
| `PUBLIC_SUPABASE_URL` | 기존 Supabase 프로젝트 URL |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 기존 공개용 키 |
| `SITE_URL` | `https://juno31323.me` (생략 가능, 기본값 동일) |

서버는 공개용 키와 Supabase 읽기 정책으로 현재 공개된 글만 조회한다. 초안, 보관 글, 아직 공개 시각이 되지 않은 글은 404다. 저장소나 배포에 서비스 역할 키를 추가하지 않는다.

## 초기 이전

1. GitHub 저장소 `Juno31323/juno.io`를 연결한 뒤 먼저 Vercel 기본 도메인에서 확인한다. 실제 공개 글의 새 주소가 200으로 열리고 기존 `/entry/?type=posts&slug=…` 주소가 새 주소로 308 이동하는지 확인한다.
2. 관리자 페이지의 로그인 화면과 글 목록을 확인한다. 실제 발행을 시험할 때는 공개해도 되는 글을 사용한다. 도메인이 바뀌면 브라우저에 저장된 로그인 상태는 도메인 간에 공유되지 않는다.
3. Vercel에서 `juno31323.me`와 `www.juno31323.me`를 등록한다. 한 쪽을 기본 도메인으로 정하고 다른 쪽은 기본 도메인으로 리디렉션한다.
4. 가비아 DNS에서 **Vercel 프로젝트에 표시되는 값**으로 웹 서비스의 A/CNAME 레코드를 변경한다. 메일 등 다른 레코드는 유지한다. DNS와 HTTPS가 정상화되면 운영 주소에서 새 글 경로, 기존 공유 링크, 관리자 화면을 다시 확인한다.
5. 전환 동안 기존 Pages를 유지한다. 전환을 되돌릴 때는 가비아의 이전 A 값 네 개(`185.199.108.153`부터 `185.199.111.153`)와 `www`의 CNAME `juno31323.github.io`를 복원한다. 도메인과 운영이 안정된 후 Pages의 정리 여부를 결정한다.

발행할 때 주소 이름에는 `hello-juno`처럼 짧은 영문 이름을 쓸 수 있다. 기존 글의 주소 이름은 공유 링크를 보존하기 위해 유지한다.

## 로컬에서 서버 경로 확인

Node.js 24 및 기존 로컬 `.env` 설정 기준:

```powershell
$env:PORTFOLIO_SSR='1'
npm run dev
```

일반 정적 빌드로 돌아오려면 `Remove-Item Env:PORTFOLIO_SSR`를 실행한다.
