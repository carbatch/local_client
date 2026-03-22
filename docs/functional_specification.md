# Carbatch - 기능 명세서 및 API 명세서

## 1. 프로젝트 개요

Carbatch는 사용자가 입력한 여러 프롬프트를 일괄 처리하여 이미지를 생성하는 풀스택 어플리케이션입니다.

- **FE**: Next.js 기반 프론트엔드. 인증, 요금제 선택, 프롬프트 관리, 이미지 표시, 다운로드를 담당합니다.
- **BE**: FastAPI + Stable Diffusion 1.5 기반 백엔드. 인증, 이미지 추론, 이미지 스타일 분석, 번역을 담당합니다.
- **스토리지**: 서버 DB 없음. 모든 데이터는 클라이언트 측 localStorage(메타데이터) + IndexedDB(이미지)에 영속 저장됩니다.

---

## 2. 앱 진입 흐름

```
접속
 └─ 로그인 여부 확인 (userAtom / localStorage)
      ├─ 미로그인 → AuthPage (로그인/회원가입)
      └─ 로그인됨
           └─ 요금제 선택 여부 확인 (planAtom / localStorage)
                ├─ 미선택 → PlanPage (요금제 선택)
                └─ 선택됨 → 메인 앱
```

---

## 3. 주요 기능 명세

### 3.1. 인증 (AuthPage)

- 로그인 / 회원가입 탭 전환 UI
- **회원가입**: `username(2~20자)`, `email`, `password(6자+)`, `비밀번호 확인`
- **로그인**: `email`, `password`
- 성공 시 `userAtom`에 `{ token, userId, username, email }` 저장 → localStorage 영속
- 서버 응답 에러(`detail`)가 배열(Pydantic 422)이면 `msg` 필드를 join해서 표시

### 3.2. 요금제 선택 (PlanPage)

| 플랜 | 가격 | 주요 기능 |
| :--- | :--- | :--- |
| 일반 (free) | 무료 | 이미지 브라우저(IndexedDB) 저장, 로컬 HuggingFace AI |
| 프로 (pro) | 월 ₩XX,XXX | 서버 스토리지 저장(최대 40GB), 서버 AI 모델 |
| 비즈니스 (business) | 월 ₩XXX,XXX | 프로 포함, 서버 스토리지(최대 100GB), 우선 처리 큐 |

- 버튼 클릭 시 `planAtom`에 저장 → localStorage 영속
- **서버 스토리지 용량 제한은 현재 미구현** (UI에만 표시)
- 결제 로직 미구현, 버튼만 누르면 진입 가능

### 3.3. 페이지(채팅) 관리

- 좌측 패널에서 페이지(채팅) 목록을 관리합니다.
- **새 채팅 생성**: `+ 새 채팅 생성` 버튼으로 빈 페이지를 생성합니다.
- **페이지 제목**: 첫 번째 프롬프트 텍스트 앞 30자로 자동 설정됩니다.
- **페이지 삭제**: 호버 시 나타나는 휴지통 버튼으로 삭제합니다. localStorage 및 IndexedDB에서 해당 페이지의 모든 데이터가 함께 삭제됩니다.
- **마지막 페이지 복원**: 앱 진입 시 `lastPageId`를 localStorage에서 읽어 마지막으로 보던 페이지를 자동 복원합니다.

### 3.4. 스타일 텍스트 + 이미지 스타일 추출 (LeftPanel)

- 좌측 패널 하단 텍스트 영역에 스타일 프롬프트를 직접 입력합니다.
- **이미지로 추출** 버튼: 이미지 파일 업로드 시 `POST /analyze-image` 호출 → Florence-2 모델이 이미지 스타일을 분석하여 스타일 textarea에 자동 입력합니다.
  - 업로드 중 썸네일 프리뷰 + 스피너 표시
  - X 버튼으로 프리뷰 제거 가능
- 입력된 스타일은 생성 요청 시 원본 프롬프트 뒤에 쉼표로 이어붙여 최종 프롬프트를 구성합니다.
  - 예: `"boy portrait, cinematic lighting, film grain"`
- 스타일 텍스트는 선택 사항입니다.

### 3.5. 생성 설정 (LeftPanel)

| 설정 | 옵션 | 기본값 |
| :--- | :--- | :--- |
| 생성 모델 | `sd15` (고품질/느림), `sd15-lcm` (미구현, sd15로 폴백) | `sd15` |
| 이미지 비율 | `1024x1024` (1:1), `1792x1024` (16:9), `1024x1792` (9:16) | `1024x1024` |
| 프롬프트당 이미지 수 | 1, 2, 3, 4 | 2 |
| 자동 ZIP 다운로드 | 켜기/끄기 토글 | 끄기 |

> BE 실제 추론 해상도: `1024x1024→512x512`, `1792x1024→768x512`, `1024x1792→512x768`

### 3.6. 자동화 처리 (Automation Loop)

- **시작**: `자동화 시작` 버튼 → `pending` 또는 `error` 상태인 프롬프트를 일괄 처리합니다.
- **동시성**: 최대 3개의 프롬프트를 동시에 요청합니다 (`CONCURRENCY = 3`).
- **흐름**:
  1. 프롬프트 상태를 `running`으로 변경 → BE `/generate` 요청 (Bearer 토큰 포함)
  2. BE에서 한글 감지 시 자동 영어 번역 후 SD에 전달
  3. 성공 시 이미지를 IndexedDB에 저장, 상태를 `done`으로 변경
  4. 실패 시 상태를 `error`로 변경하고 다음 프롬프트로 진행
- **중지**: `자동화 중지` 버튼 → `abortFlag` 세팅, 현재 진행 항목 완료 후 중단
- **완료 후 자동 ZIP**: 자동 다운로드 옵션 ON 시 완료된 이미지들을 자동 ZIP 다운로드

### 3.7. 프롬프트 파싱 및 배치 로드 (Setup Pane / Canvas Pane)

- **규칙**: `숫자(1~3자리) + 공백 + 프롬프트 텍스트` 형식, 줄바꿈 구분
  ```
  001 Close up portrait of a boy
  002 Wide shot of a landscape
  ```
- 파싱된 각 항목은 개별 `PromptItem`으로 분리되어 `pending` 상태로 등록됩니다.
- 파싱 직후 자동화가 자동 시작됩니다 (이미 실행 중이 아닌 경우).
- Canvas Pane 하단 `+` 버튼으로 `.txt` 파일 업로드도 가능합니다.

### 3.8. 캔버스 (Canvas Pane)

- **단일 프롬프트 전송**: 하단 입력창에 텍스트 입력 후 전송 → 즉시 이미지 생성 시작
- **스켈레톤 애니메이션**: 생성 중인 슬롯은 shimmer 애니메이션으로 표시
- **이미지 단건 재시도**: 특정 이미지 슬롯만 선택적 재시도 (이미지 인덱스 단위)
- **개별 이미지 다운로드**: 완료된 이미지 카드에서 개별 다운로드
- **이미지 클립보드 복사**: 완료된 이미지 카드에서 클립보드 복사 (HTTPS 환경에서만 동작)
- **전체 ZIP 다운로드**: 현재 페이지의 완료된 이미지 전체를 ZIP으로 다운로드
  - 파일명 규칙: `{순서(3자리)}_{이미지번호}.png` (예: `001_1.png`, `001_2.png`)
  - ZIP 파일명: `carbatch-{페이지제목}.zip`

### 3.9. 로그 기록 (Logs Pane)

- `info`, `success`, `warn`, `error` 4가지 레벨로 색상 구분 출력
- 각 로그에 `HH:MM:SS` 형식 타임스탬프 기록

### 3.10. 스토리지 관리 (StorageModal)

- TopBar 하드드라이브 버튼으로 모달 열기
- **페이지별 이미지 삭제**: 특정 페이지 이미지만 IndexedDB 삭제 (프롬프트 텍스트 유지)
- **전체 이미지 삭제**: 전체 페이지 이미지 일괄 삭제
- **전체 데이터 초기화**: 모든 페이지/프롬프트/이미지 삭제 후 초기 상태 리셋

### 3.11. TopBar

- BE 연결 상태 표시: `checking` / `ok` / `model-loading` / `offline` (5초 폴링)
- 배치 진행 진행률 바 (`doneCount / promptsCount`)
- 로그인 유저명 + 요금제 뱃지 표시
- 로그아웃 버튼: `POST /auth/logout` 호출 후 `userAtom` 초기화

---

## 4. 상태 관리 (Jotai Atoms)

| Atom | 타입 | 저장소 | 설명 |
| :--- | :--- | :--- | :--- |
| `userAtom` | `User \| null` | localStorage `carbatch_user` | 로그인 유저 정보 (token 포함) |
| `planAtom` | `Plan \| null` | localStorage `carbatch_plan` | 선택된 요금제 |
| `apiKeyAtom` | `string` | localStorage `carbatch_apikey` | (미사용, 레거시) |

```ts
interface User {
  token: string;    // Bearer 토큰 (BE 요청 헤더에 사용)
  userId: string;
  username: string;
  email: string;
}

type Plan = 'free' | 'pro' | 'business';
```

---

## 5. 데이터 영속성 전략

| 데이터 종류 | 저장소 | 키 규칙 |
| :--- | :--- | :--- |
| 로그인 유저 정보 | localStorage (Jotai) | `carbatch_user` |
| 요금제 | localStorage (Jotai) | `carbatch_plan` |
| 페이지 목록 (제목, 생성일) | localStorage | `carbatch_pages` |
| 프롬프트 텍스트 목록 | localStorage | `carbatch_prompts_{pageId}` |
| 마지막 열람 페이지 ID | localStorage | `lastPageId` |
| 이미지 (base64 PNG) | IndexedDB | `carbatch_images` DB, `images` store |

- 앱 재진입 시 localStorage에서 페이지/프롬프트를 복원, IndexedDB에서 이미지를 비동기 로드하여 `done` 상태로 복원합니다.
- 이미지를 제외한 상태(`status`)는 재진입 시 항상 `pending`으로 초기화됩니다.

---

## 6. API 명세서

### 6.1. 환경 변수 (FE)

| 변수명 | 기본값 | 설명 |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_BE_URL` | `http://localhost:8000` | BE 서버 주소 |

### 6.2. 공통 인증

인증이 필요한 엔드포인트는 모두 `Authorization: Bearer <token>` 헤더를 포함합니다.

### 6.3. 인증 API (토큰 불필요)

#### `POST /auth/register`

```json
// 요청
{ "username": "홍길동", "email": "a@b.com", "password": "123456" }

// 응답 200
{ "token": "abc...", "user_id": "a1b2c3d4", "username": "홍길동", "email": "a@b.com" }

// 오류 409: 이미 사용 중인 이메일
// 오류 422: Pydantic 유효성 검사 실패 (detail이 배열)
```

#### `POST /auth/login`

```json
// 요청
{ "email": "a@b.com", "password": "123456" }

// 응답 200 (register와 동일)
// 오류 401: 이메일 또는 비밀번호 불일치
```

#### `POST /auth/logout`

- 헤더: `Authorization: Bearer <token>`
- 응답: `{ "ok": true }`

### 6.4. 헬스 체크 (`GET /health`)

- Timeout: 5초 (FE 폴링 주기: 5초, 상태가 `ok`가 되면 폴링 중단)

```json
{
  "status": "ok",
  "model_loaded": true,
  "model_id": "runwayml/stable-diffusion-v1-5",
  "device": "cuda"
}
```

### 6.5. 이미지 생성 (`POST /generate`) — 인증 필요

**Request**

| Field | Type | 설명 | 기본값 |
| :--- | :--- | :--- | :--- |
| `model` | string | `sd15` \| `sd15-lcm` (lcm은 sd15로 폴백) | `sd15` |
| `prompt` | string | 프롬프트 (한글이면 BE에서 자동 번역) | 필수 |
| `negative_prompt` | string | 네거티브 프롬프트 | `"blurry, low quality..."` |
| `count` | number | 생성할 이미지 수 (1~8) | 1 |
| `width` | number | 너비 px (256~1024) | 512 |
| `height` | number | 높이 px (256~1024) | 512 |
| `num_inference_steps` | number | 추론 스텝 (1~100) | 20 |
| `guidance_scale` | float | 가이던스 스케일 (1.0~20.0) | 7.5 |

**Response 200**

```json
{
  "success": true,
  "images": ["data:image/png;base64,...", null],
  "error": null
}
```

**Response 503** — 모델 로딩 중

```json
{ "detail": "모델 로딩 중입니다. /health 에서 model_loaded 가 true가 될 때까지 대기하세요." }
```

### 6.6. 이미지 스타일 분석 (`POST /analyze-image`) — 인증 필요

**Request**

```json
{ "image": "data:image/png;base64,..." }
```

**Response 200**

```json
{ "style_prompt": "soft natural lighting, warm golden tones, shallow depth of field..." }
```

> BE 내부적으로 `microsoft/Florence-2-base` 모델을 사용합니다. 첫 호출 시 ~460MB 다운로드 후 lazy load됩니다.

---

## 7. 알려진 제약 및 주의사항

- **SD 모델 로드 시간**: 서버 최초 실행 시 ~4GB 다운로드. `/health`의 `model_loaded: true` 확인 후 요청하세요.
- **Florence-2 로드 시간**: `/analyze-image` 첫 호출 시 ~460MB 다운로드. 이후 메모리에 유지됩니다.
- **한글 프롬프트**: FE에서 한글 입력 시 BE가 자동으로 영어로 번역 후 SD에 전달합니다 (deep-translator / GoogleTranslator).
- **`sd15-lcm`**: UI에 선택 옵션이 있으나 BE에서 sd15로 폴백됩니다. LCM은 향후 구현 예정입니다.
- **동시성**: FE는 최대 3개 동시 요청, BE는 `max_workers=1`로 순차 처리합니다.
- **CORS**: BE는 현재 모든 출처를 허용합니다. 프로덕션 배포 시 `allow_origins` 제한 필요합니다.
- **토큰 만료**: 현재 토큰 만료 로직 없음. 서버 재시작 후 `tokens.json`에서 토큰을 복원합니다.
- **서버 스토리지**: Pro/Business 요금제의 서버 스토리지 기능은 미구현입니다. 현재 모든 플랜이 IndexedDB를 사용합니다.