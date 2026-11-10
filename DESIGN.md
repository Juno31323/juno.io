---
name: "민준호 개인 포트폴리오"
description: "사진과 작업이 함께 보이는 개인 포트폴리오"
colors:
  paper: "#ffffff"
  ink: "#1d244d"
  accent: "#515db8"
  accent-hover: "#3e499c"
  muted: "#606781"
  line: "#dee1ef"
  surface: "#f5f6fc"
  lavender: "#eeedfc"
  rose: "#fbedf5"
  pink: "#efa5c6"
  portrait-mat: "#e8e8fc"
typography:
  display:
    fontFamily: '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
    fontSize: "clamp(2.75rem, 3.9vw, 3.625rem)"
    fontWeight: 820
    lineHeight: 1.25
    letterSpacing: "-0.03em"
  headline:
    fontFamily: '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
    fontSize: "clamp(2rem, 3.3vw, 3.125rem)"
    fontWeight: 820
    lineHeight: 1.3
    letterSpacing: "-0.03em"
  title:
    fontSize: "1.625rem"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "-0.03em"
  body:
    fontFamily: '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  meta:
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.75
rounded:
  focus: "4px"
  media: "12px"
  row: "16px"
  pill: "999px"
spacing:
  gutter: "clamp(20px, 3.23vw, 52px)"
  control-y: "11px"
  control-x: "28px"
  control-gap: "24px"
  section: "72px"
  section-mobile: "44px"
  row-y: "30px"
  row-x: "16px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "11px 28px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "11px 28px"
  text-link:
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    padding: "10px 0"
  work-row:
    textColor: "{colors.ink}"
    rounded: "{rounded.row}"
    padding: "30px 16px"
  work-row-hover:
    backgroundColor: "{colors.surface}"
  marked-heading:
    textColor: "{colors.ink}"
---

# Design System: 민준호 개인 포트폴리오

## Overview

**Creative North Star: "사진과 작업이 함께 보이는 개인 포트폴리오"**

실제 인물 사진과 프로젝트 설명용 일러스트를 함께 사용하는 밝은 한국어 포트폴리오다. 흰 여백, 짙은 남색 제목, 파란 링크가 읽는 순서를 정리한다. 옅은 라벤더와 분홍 영역, 분홍 밑줄이 정보 사이에 부드러운 구분을 만든다.

짧고 직접적인 한국어를 유지한다. 사용자가 제공한 사진과 실제 작업 내용을 중심에 두며, 프로젝트 일러스트는 설명용 이미지로 취급한다. 이 문서는 구현된 공통 시각 언어를 기록한다. 홈의 구성과 방문 순서는 `.impeccable/surfaces/src-pages-index-astro.md`에 둔다.

**Key Characteristics:**

- 실제 프로필 사진과 준비된 WebP 프로젝트 일러스트.
- Pretendard Variable의 굵은 한글 제목과 편안한 본문 간격.
- 흰 바탕 위 라벤더 작업 영역과 연분홍 연구 영역.
- 흐르는 외곽선, 타원형 밑줄, 둥근 링크 버튼.
- 얇은 구분선과 최소한의 반응형 움직임.

## Colors

차분한 남색 글자와 푸른 보라색 링크를, 밝은 라벤더·분홍 배경 위에 배치한다. 정확한 값은 frontmatter가 기준이며 CSS의 동명 custom property와 대응한다.

### Primary

- **파란 보라색 (`accent`)**: 주요 이동 버튼, 텍스트 링크, 현재 탐색 위치, 포커스 외곽선.
- **짙은 파란 보라색 (`accent-hover`)**: 주요 버튼 hover와 작업 제목의 반응 상태.

### Secondary

- **옅은 라벤더 (`lavender`)**: 작업 영역의 기본 색. 실제 SVG는 가까운 라벤더 값 사이의 미세한 색 변화를 사용한다.
- **연분홍 (`rose`)**: 연구 안내 영역. SVG의 옅은 분홍·라벤더 변화로 넓은 면을 부드럽게 나눈다.
- **분홍 (`pink`)**: 제목 아래 짧은 타원형 표시와 현재 탐색 위치의 밑줄.
- **사진 매트 라벤더 (`portrait-mat`)**: 소개 페이지 사진의 배경과 패딩.

### Neutral

- **흰 바탕 (`paper`)**: 페이지와 주요 버튼 글자.
- **짙은 남색 (`ink`)**: 제목과 기본 글자.
- **회청색 (`muted`)**: 설명, 날짜, 부가 정보.
- **옅은 회청색 선 (`line`)**: 헤더·푸터, 목록, 연구 수치, 읽기 페이지의 구분선.
- **희미한 푸른 흰색 (`surface`)**: 작업 목록 hover와 표 머리글.

## Typography

제목과 본문 모두 로컬 `/fonts/PretendardVariable.woff2`를 사용한다. 가변 굵기 범위는 (45–920), 로딩은 `swap`이다. 별도의 영문 디스플레이체나 외부 폰트 요청은 없다.

- **Display**: 이름에 쓰는 굵고 좁은 자간의 제목. 모바일에서는 (2.875rem), 가장 좁은 화면에서는 (2.5rem)이다.
- **Headline**: 작업 영역 제목. 모바일에서는 (1.875rem)이다. 일반 페이지 제목은 별도로 `clamp(2.75rem, 5vw, 4.25rem)`, 굵기 (800), 행간 (1.3)을 쓴다.
- **Title**: 작업 목록과 읽기 페이지의 소제목. 홈의 작은 절 제목은 같은 크기에 기본 제목 굵기 (720), 모바일 크기 (1.375rem)를 쓴다.
- **Body**: 기본 본문은 frontmatter의 body 역할이다. 긴 글은 행간 (1.9), 모바일 (1.85), 자간 (-.01em), 최대 너비 (710px)다.
- **Label / Meta**: 부가 링크와 날짜·학교·작업 정보. 연구 수치는 (1.25rem), 굵기 (650), tabular numerals를 사용한다.

한글은 `word-break: keep-all`을 기본으로 하고 긴 문자열은 줄바꿈을 허용한다. 제목은 균형 잡힌 줄바꿈을 사용한다. 영문 대문자 장식 문구를 추가하지 않는다.

## Layout

공통 컨테이너는 최대 너비 (1536px), 양옆 여백은 frontmatter의 `gutter`다. 헤더는 최소 높이 (76px), 모바일 (72px)이며 얇은 아래 선으로 본문과 구분한다. 콘텐츠는 기본적으로 왼쪽 정렬한다.

홈의 첫 영역은 소개와 작업의 두 열 (`.41fr 1fr`)이며 중간 화면에서는 (`.43fr 1fr`)이다. 하단 연구 요약과 관심 목록도 두 열 (`1.5fr 1fr`)이다. 공통 절 간격은 `section`, 모바일은 `section-mobile`을 따른다. 읽기 페이지는 안내와 본문의 두 열 (`1fr 2fr`, 간격 70px), 작업 상세는 최대 너비 (840px)의 단일 읽기 열이다.

- **1100px 이하**: 작업 이미지와 행 간격, 버튼 크기, 연구 안내의 좌우 패딩을 줄인다. 읽기 페이지의 열 간격은 (40px)이다.
- **760px 이하**: 좌우 여백은 (20px), 홈과 읽기 페이지는 한 열이다. 소개의 사진은 텍스트 오른쪽 (132px), 두 링크는 아래에 놓인다. 작업 영역은 모바일 전용 외곽선 SVG를 사용한다. 대표 작업은 그림 다음 제목 순서로 쌓이며 일반 작업은 작은 그림·설명·화살표의 행을 유지한다. 연구 안내는 제목과 링크 다음 설명을 배치한다.
- **360px 이하**: 사진을 (104px)로 줄이고 버튼 간격을 조정한다.
- **1700px 이상**: 홈 작업 영역의 오른쪽 확장을 없애 공통 컨테이너에 맞춘다.

작업·연구 목록은 얇은 선과 넉넉한 세로 간격으로 읽는다. 태그 묶음이나 카드 격자로 기존 목록을 바꾸는 것은 이 구현의 공통 패턴에 포함되지 않는다.

## Elevation & Depth

기본 표면은 평평하다. 그림자 대신 흰 여백, 옅은 배경 면, 구분선이 깊이와 그룹을 만든다. 프로젝트 그림 자체에 포함된 명암은 이미지의 일부다. 실제 UI 그림자는 홈 작업 그림 hover의 `drop-shadow(0 8px 6px #6671b51a)` 하나이며, 그림을 위로 (3px) 이동한다.

움직임은 이동 대상을 알려 주는 작은 반응이다. 작업 화살표는 hover에서 오른쪽 (4px), (350ms)로 이동하고 그림은 (500ms) 동안 반응한다. 공통 easing은 `cubic-bezier(.16, 1, .3, 1)`이다. 버튼과 일반 작업 행의 색 변화는 (200ms)다. `prefers-reduced-motion: reduce`에서는 스크롤·전환·애니메이션을 모두 정지한다.

## Shapes

주요 이동 버튼은 pill 형태다. 작업 행과 읽기 페이지 사진은 부드러운 사각 모서리, 제목 표시는 살짝 기울어진 타원이다. 초점 외곽선은 작은 모서리 곡률을 쓴다. 세부 값은 frontmatter의 `rounded`에 둔다.

작업 영역은 `/images/portfolio/work-field.svg`, 모바일은 `work-field-mobile.svg`의 흐르는 외곽선을 사용한다. 연구 영역은 `research-field.svg`의 얕고 불균일한 윗선을 사용한다. 이들은 단순한 배경 SVG이며 인물·프로젝트 그림은 별도의 WebP다. 큰 배경 면을 균일한 둥근 사각형으로 단순화하지 않는다.

## Components

### Buttons

짧은 이동 문구와 가는 SVG 화살표를 담는 둥근 링크다. 기본 높이는 최소 (52px), 글자 굵기 (600), 행간 (1.5), 내부 간격 (24px)이다. 주요 버튼은 accent 바탕과 흰 글자, 보조 버튼은 투명 바탕과 얇은 회보라색 선을 쓴다. 주요 버튼 active는 `#303d86`, 보조 버튼 hover는 `#ffffff99`와 accent-hover 글자다.

홈 소개의 링크는 데스크톱에서 최소 높이 (58px), 중간·모바일에서 (48px)이다. 연구 안내 링크는 데스크톱 (58px), 모바일 (44px)이다.

### Text links

작은 accent 글자와 간단한 화살표로 읽기 이동을 제공한다. 최소 높이 (44px), 글자와 화살표 간격 (12px), hover는 밑줄이다. 본문 속 링크는 기본부터 밑줄을 표시한다.

### Navigation

이름과 네 개의 한국어 링크가 헤더의 양끝에 놓인다. 링크는 최소 높이 (44px), 굵기 (600)다. hover와 현재 페이지는 accent, 현재 페이지 아래에는 분홍 선을 표시한다.

모바일 메뉴는 텍스트와 두 선으로 된 버튼이다. 열면 두 열의 링크가 나타나고 `aria-expanded`와 버튼 문구가 함께 바뀐다. Escape, 바깥 클릭, 링크 선택, 메뉴 밖으로 포커스 이동 시 닫힌다. JavaScript가 없을 때는 링크가 그대로 보인다.

### Work rows

일반 목록은 제목·설명, 부가 정보, 화살표를 한 행에 둔다. 위아래 얇은 선을 유지하고 hover는 surface 배경과 accent 제목으로 반응한다. 모바일에서는 부가 정보를 제목 아래로 옮긴다.

홈은 설명용 WebP 그림을 함께 쓴다. Firezone 대표 그림은 크게, PrintSafe와 Chat2B-AU는 작은 그림을 쓴다. 그림의 의미를 설명하는 alt를 유지하며 실제 앱 화면으로 부르지 않는다.

### Marked headings

제목 아래 pink 타원을 짧게 놓는다. 기본 너비는 제목의 (66%), 높이 (9px), 기울기 (-3deg), 모바일 높이 (7px)다. 이름의 표시는 너비 (70%)다. 현재 페이지 밑줄과는 별개인 장식이며 텍스트를 대체하지 않는다.

### Research results

용어와 수치를 definition list의 두 끝에 배치한다. 각 행은 위아래 선, 세로 패딩 (12px), 간격 (20px)을 쓴다. 값은 tabular numerals와 굵은 글자로 정렬한다. 수치의 의미와 단위를 함께 유지한다.

### Keyboard focus

모든 포커스 가능한 요소는 accent 외곽선 (3px), 바깥 간격 (5px)을 사용한다. 본문으로 건너뛰기 링크는 포커스 시 화면 상단에 나타난다. 모바일 탐색 버튼과 주요 링크는 최소 터치 높이 (44px)를 확보한다.

## Do's and Don'ts

### Do:

- **Do** 실제 프로필 사진과 프로젝트 설명용 일러스트를 구분해 사용한다.
- **Do** 짧은 한국어 제목과 설명, Pretendard의 공통 글꼴 체계를 유지한다.
- **Do** 얇은 선, 밝은 면, 넉넉한 간격으로 목록과 읽기 흐름을 정리한다.
- **Do** 키보드 포커스, 모바일 메뉴의 상태 문구, reduced motion 동작을 유지한다.

### Don't:

- **Don't** 설명용 프로젝트 일러스트를 실제 제품 스크린샷으로 소개한다.
- **Don't** 흐르는 작업 영역과 얕은 연구 영역을 같은 둥근 사각형으로 대체한다.
- **Don't** 실제 작업이나 연구 수치의 의미를 시각적 강조를 위해 바꾼다.
- **Don't** 짧은 한국어 소개 대신 큰 영문 직함이나 상투적인 자기 홍보를 추가한다.
