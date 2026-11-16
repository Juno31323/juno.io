---
name: Juno.io Editorial Minimalist
colors:
  canvas-warm: "#FAF9F6"
  surface-raised: "#FFFFFF"
  surface-low: "#F4F3F1"
  ink-primary: "#19212F"
  ink-secondary: "#4B5565"
  primary: "#465ED0"
  accent-hover: "#374CB8"
  accent-soft: "#EDF0FF"
  border-subtle: "#E5E7EB"
  border-hairline: "#EEEEEC"
typography:
  display-desktop:
    fontFamily: Pretendard Variable
    fontSize: 60px
    lineHeight: 1.13
    fontWeight: 780
    letterSpacing: -0.04em
  display-mobile:
    fontFamily: Pretendard Variable
    fontSize: 40px
    lineHeight: 1.13
    fontWeight: 780
    letterSpacing: -0.04em
  body-md:
    fontFamily: Pretendard Variable
    fontSize: 16px
    lineHeight: 1.75
  label-sm:
    fontFamily: Pretendard Variable
    fontSize: 12px
    fontWeight: 680
rounded:
  control: 4px
  panel: 8px
spacing:
  content-width: 1140px
  touch-size: 44px
  margin-mobile: 20px
  margin-desktop: 64px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface-raised}"
    rounded: "{rounded.control}"
    height: "{spacing.touch-size}"
  project-card:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.panel}"
  page:
    backgroundColor: "{colors.canvas-warm}"
    textColor: "{colors.ink-primary}"
  keyword-hover:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.ink-primary}"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.surface-raised}"
  flow-panel:
    backgroundColor: "{colors.surface-low}"
    textColor: "{colors.ink-secondary}"
  card-divider:
    backgroundColor: "{colors.border-subtle}"
    height: 1px
  navigation-divider:
    backgroundColor: "{colors.border-hairline}"
    height: 1px
---

## Overview

민준호 개인 포트폴리오와 글을 위한 편집형 디자인. Google Stitch의 Editorial Minimalist 내보내기에서 홈 데스크톱 `_8`, 모바일 `_4`, 프로젝트 `_3` 및 `firezone`, 연구·소개·이력·글 시안을 참고했다. 구현 대상은 저장소 루트의 Astro 사이트다.

## Colors

따뜻한 흰색을 바탕으로 사용한다. 카드는 흰색과 1px 경계선, 제목은 짙은 잉크색, 주요 링크와 선택 상태는 파란색으로 구분한다.

## Typography

Stitch 시안의 글자 위계를 유지하되 한글과 영문 모두 기존 자체 호스팅 Pretendard Variable을 사용한다. 작은 라벨은 날짜·카테고리·기술 구분에만 사용한다.

## Layout

최대 너비 1140px 안에서 헤더·본문·푸터의 좌우 시작점을 맞춘다. 데스크톱은 64px 상단 탐색, 모바일은 열고 닫는 두 열 메뉴를 사용한다. 홈은 이름·사진, 연결된 키워드 세 개, 넓은 대표 작업과 두 개의 보조 작업, 연구·최근 글, 이력 순서다. 작은 화면에서는 프로젝트와 글을 한 열로 배치한다.

## Elevation & Depth

패널은 그림자 대신 배경 면과 가는 선으로 구분한다. 마우스를 올리면 카드 경계와 제목 색이 바뀐다. Taste에서 적용한 움직임은 짧은 첫 화면 등장과 버튼 반응이며 움직임 감소 설정을 존중한다.

## Shapes

컨트롤과 태그는 4px, 카드와 기사 컨테이너는 8px. 버튼과 메뉴의 터치 높이는 44px 이상으로 유지한다.

## Components

- 키워드 탐색: 백엔드 → 인증 API, 앱 개발 → Firezone, RAG 연구 → 홈 연구 노트.
- Firezone: 공개 프로젝트에 문서화된 공공데이터, NestJS API, Expo 앱을 도식으로 배치한다.
- 연구 비교: Recall@5 67.35% / 89.80%와 레이아웃 표현의 추가 이점 미확인 조건을 함께 표시한다.
- 글: 목록은 읽는 순서대로 쌓고 기존 검색·태그·시리즈·정렬 및 관리자 편집을 유지한다.

## Do's and Don'ts

- 실제 사진·작업·연구 결과·공개 글을 사용한다. 시안의 예시 제목, 가짜 앱 화면, 통계, 연락처를 가져오지 않는다.
- 정적 콘텐츠와 Supabase에서 갱신되는 콘텐츠는 같은 카드 구조를 사용한다. 기존 URL과 작성 기능을 유지한다.
- 긴 소개는 별도 페이지에 두고 홈에는 이름과 한 문장, 기술 키워드부터 제공한다.
