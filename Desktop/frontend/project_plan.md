# WEBTOON.AI - AI 웹툰 창작 플랫폼

## 1. 프로젝트 설명

**제품 포지셔닝:** AI가 창작의 보조 도구로서 인간 작가의 의도와 감정을 유지하며 웹툰 제작을 돕는 협업 플랫폼  
**핵심 가치:** AI가 이전 컷의 컨텍스트(캐릭터 감정, 포즈, 의상/소품)를 기억하며 일관된 웹툰 컷을 생성 — 단독 AI가 아닌 인간+AI 협업으로 높은 품질 달성  
**타겟 유저:** 웹툰 작가, 스토리보드 제작자, 1인 콘텐츠 창작자

---

## 2. 페이지 구조

- `/` — 메인 에디터 (캔버스 + 모든 패널 통합)
- `/projects` — 프로젝트 목록
- `/landing` — 서비스 소개 랜딩 페이지 (추후)

---

## 3. 핵심 기능 목록

### Phase 1: 에디터 UI 구조 (현재)
- [x] 5-패널 에디터 레이아웃 (Header / Left / Canvas / Layers / Timeline)
- [x] 레이어 시스템 (배경/캐릭터/대사/효과 레이어)
- [x] 캔버스 위 객체 선택 → 드래그 이동 / 리사이즈 / 회전 / 반전
- [x] AI 프롬프트 입력창 + 이전 컷 컨텍스트 표시
- [x] 프롬프트 프리셋 (감정, 동작, 구도 키워드)
- [x] 캐릭터/배경 라이브러리 (태그 필터 + 그리드)
- [x] 하단 타임라인 (에피소드 탭 + 컷 썸네일)

### Phase 2: 컷 일관성 AI 로직
- [ ] 이전 컷 이미지 기준 ControlNet 방식 일관성 유지
- [ ] 캐릭터 레퍼런스 고정 (Character Consistency 설정)
- [ ] 감정/포즈 변경 시 의상·소품 유지 알고리즘
- [ ] AI 생성 히스토리 + 버전 비교

### Phase 3: 프로젝트 관리 & 저장
- [ ] Supabase 연동 — 프로젝트/에피소드/컷 저장
- [ ] 사용자 인증 (로그인/회원가입)
- [ ] 프로젝트 목록 페이지
- [ ] 웹툰 내보내기 (PDF, 이미지 zip)

### Phase 4: 협업 & 배포
- [ ] 멀티 유저 코멘트
- [ ] 공유 링크 / 뷰어 모드
- [ ] 퍼블리시 (연재 플랫폼 연동 검토)

---

## 4. 데이터 모델 설계 (Phase 3에서 Supabase 적용)

### projects
| 필드 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| title | text | 프로젝트 제목 |
| user_id | uuid | 작가 ID |
| created_at | timestamp | 생성일 |

### episodes
| 필드 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| project_id | uuid | FK |
| title | text | 에피소드 제목 |
| order | int | 순서 |

### cuts
| 필드 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| episode_id | uuid | FK |
| order | int | 컷 순서 |
| prompt | text | 사용 프롬프트 |
| image_url | text | 생성 이미지 URL |
| layers | jsonb | 레이어 상태 |
| objects | jsonb | 캔버스 객체 배열 |

### characters
| 필드 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| project_id | uuid | FK |
| name | text | 캐릭터 이름 |
| reference_url | text | 레퍼런스 이미지 |
| tags | text[] | 태그 배열 |

---

## 5. 백엔드 / 서드파티 연동 계획
- **Supabase:** Phase 3에서 DB·Auth·Storage 연동
- **AI Image API:** Stable Diffusion API 또는 ComfyUI 연동 (Phase 2)
- **Stripe:** 유료 플랜 결제 (Phase 4)

---

## 6. 개발 단계 계획

### Phase 1: 에디터 UI 구조 ✅ 진행 중
- 목표: 5-패널 에디터 레이아웃 + 캔버스 인터랙션 + 레이어 시스템
- 산출물: 사용 가능한 에디터 UI (목 데이터 기반)

### Phase 2: AI 프롬프트 & 일관성 로직
- 목표: 이전 컷 컨텍스트 기반 AI 이미지 생성 연동
- 산출물: 실제 AI 생성 동작 + 일관성 컨트롤

### Phase 3: 프로젝트 저장 & 사용자 인증
- 목표: Supabase DB 연동으로 프로젝트/컷 저장
- 산출물: 로그인 후 작업 저장/불러오기

### Phase 4: 내보내기 & 배포 기능
- 목표: 완성된 웹툰 에피소드 내보내기
- 산출물: PDF/ZIP 내보내기, 공유 링크
