---
title: Chat2B-AU
summary: 대학 공지 RAG 챗봇과 OCR·레이아웃 구조화에 따른 검색 성능 연구.
category: RAG · 정보검색
role: 백엔드 · 검색 · OCR 처리 · 실험 평가
listRole: Spring Boot · pgvector · Python
period: 2026.05–08
order: 3
featured: true
status: KICS 추계학술발표회 채택 통보 · 포스터 제작
links:
  - label: GitHub
    url: https://github.com/Juno31323/Chat2B-AU
---
## 대학 공지 질의응답
입학 정보를 찾을 때 기존 FAQ나 챗봇에서 구체적인 답을 얻기 어려워, 대학 공지를 근거로 답하는 시스템을 만들었습니다. 2026년 4월부터 준비했고, 주요 개발·실험은 5~8월에 진행했습니다.

## 구현
- Spring Boot 질의응답 API
- PostgreSQL·pgvector 기반 저장·벡터 검색
- BM25 키워드 검색과 벡터 검색 결합
- 검색 근거가 부족할 때 답변 제한
- 첨부 문서 OCR·레이아웃 처리·색인 구성
- Python 조건별 실험·검색 및 답변 결과 평가

Java, Spring Boot, PostgreSQL, Supabase, pgvector, Python, OpenAI API, Gemini Embedding API를 사용했습니다.

## 논문
**시각적 문서 기반 RAG에서 OCR 및 레이아웃 구조화에 따른 검색 성능 분석**

민준호 제1저자 · 정민영 교신저자

OCR로 검색 가능한 정보를 늘리는 효과와, 같은 정보를 레이아웃에 따라 배열하는 효과를 분리해 비교했습니다.

## 데이터
| 항목 | 구성 |
| --- | --- |
| 기준 데이터 | 2026년 5월 텍스트 공지 55건 · 390청크 |
| OCR 처리 | CLOVA OCR V2로 공지–첨부 연결 192건 중 164건 처리 |
| 확보한 OCR 정보 | 고유 공지 100건 |
| OCR 추가 조건 | 공지 155건 |
| 평가 문항 | 49개 |

## 비교 조건
| 조건 | 구성 |
| --- | --- |
| C1 | 텍스트 전용 |
| C2 | OCR 원본 순서 |
| C3 | 경계 상자 기반 그룹화·청크 재구성 |
| C4P | 같은 OCR 필드·청크 배정, 원본 순서 |
| C4L | 같은 OCR 필드·청크 배정, 행 단위 정렬 |

BM25와 Gemini 임베딩 검색을 RRF로 결합했습니다. Recall@k·MRR@5·nDCG@5를 비교하고 McNemar 검정, Holm 보정, 대응표본 부트스트랩을 적용했습니다.

## 결과
| 검색 지표 | 텍스트 전용 | OCR 추가 |
| --- | --- | --- |
| 정답 공지가 색인에 포함된 문항 | 33/49 | 46/49 |
| Recall@5 | 67.35% | 89.80% |

Recall@5의 Holm 보정 p값은 0.0088입니다. 위 수치는 **검색 지표**이며 답변 정확도를 뜻하지 않습니다.

같은 OCR 필드·청크 배정으로 비교한 C4P·C4L에서는, 시험한 규칙 기반 레이아웃 표현의 추가 검색 이점을 확인하지 못했습니다.

## 발표·원고
- KICS 추계학술발표회 채택 통보 · 포스터 제작
- J-KICS 확장 원고 준비

