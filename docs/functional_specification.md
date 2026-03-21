# Carbatch - 기능 명세서 및 API 명세서

## 1. 프로젝트 개요

Carbatch는 사용자가 입력한 여러 프롬프트를 일괄 처리하여 이미지를 생성하는 풀스택 어플리케이션입니다.

- **FE**: Next.js 기반 프론트엔드. 프롬프트 관리, 이미지 표시, 다운로드를 담당합니다.
- **BE**: FastAPI + Stable Diffusion 1.5 기반 백엔드. 실제 이미지 추론을 담당합니다.
- **스토리지**: 서버 DB 없음. 모든 데이터는 클라이언트 측 localStorage(메타데이터) + IndexedDB(이미지)에 영속 저장됩니다. 새로고침 후에도 데이터가 유지됩니다.

---

## 2. 주요 기능 명세 (Functional Specifications)

### 2.1. 페이지(채팅) 관리

- 좌측 패널에서 페이지(채팅) 목록을 관리합니다.
- **새 채팅 생성**: `+ 새 채팅 생성` 버튼으로 빈 페이지를 생성합니다.
- **페이지 제목**: 첫 번째 프롬프트 텍스트 앞 30자로 자동 설정됩니다.
- **페이지 삭제**: 호버 시 나타나는 휴지통 버튼으로 삭제합니다. localStorage 및 IndexedDB에서 해당 페이지의 모든 데이터가 함께 삭제됩니다.
- **마지막 페이지 복원**: 앱 진입 시 `lastPageId`를 localStorage에서 읽어 마지막으로 보던 페이지를 자동 복원합니다.

### 2.2. 프롬프트 파싱 및 배치 로드 (Setup Pane / Canvas Pane)

- **규칙**: `숫자(1~3자리) + 공백 + 프롬프트 텍스트` 형식으로 줄바꿈 구분.
  ```
  001 Close up portrait of a boy
  002 Wide shot of a landscape
  ```
- 파싱된 각 항목은 개별 `PromptItem`으로 분리되어 `pending` 상태로 등록됩니다.
- 파싱 직후 자동화가 시작됩니다 (자동화가 이미 실행 중이 아닌 경우).
- 파싱 결과가 0개이면 `false`를 반환하고 사용자에게 경고합니다.

### 2.3. 스타일 텍스트 (LeftPanel)

- 좌측 패널 하단 텍스트 영역에 스타일 프롬프트를 직접 입력합니다.
- 입력된 스타일은 생성 요청 시 원본 프롬프트 뒤에 쉼표로 이어붙여 최종 프롬프트를 구성합니다.
  - 예: `"boy portrait, cinematic lighting, film grain"`
- 스타일 텍스트는 선택 사항입니다. 비어 있으면 원본 프롬프트만 사용합니다.

### 2.4. 생성 설정 (LeftPanel)

| 설정 | 옵션 | 기본값 |
| :--- | :--- | :--- |
| 생성 모델 | `sd15` (고품질/느림), `sd15-lcm` (빠른 생성) | `sd15` |
| 이미지 비율 | `1024x1024` (1:1), `1792x1024` (16:9), `1024x1792` (9:16) | `1024x1024` |
| 프롬프트당 이미지 수 | 1, 2, 3, 4 | 2 |
| 자동 ZIP 다운로드 | 켜기/끄기 토글 | 끄기 |

> BE 실제 추론 해상도: SD 1.5 특성상 `1024x1024→512x512`, `1792x1024→768x512`, `1024x1792→512x768`으로 변환됩니다.

### 2.5. 자동화 처리 (Automation Loop)

- **시작**: `자동화 시작` 버튼을 누르면 `pending` 또는 `error` 상태인 프롬프트를 일괄 처리합니다.
- **동시성**: 최대 3개의 프롬프트를 동시에 요청합니다 (`CONCURRENCY = 3`).
- **흐름**:
  1. 프롬프트 상태를 `running`으로 변경 → BE에 이미지 생성 요청
  2. 성공 시 이미지를 IndexedDB에 저장, 상태를 `done`으로 변경
  3. 실패 시 상태를 `error`로 변경하고 다음 프롬프트로 진행 (중지 버튼을 누르지 않는 한 중단 없음)
- **중지**: `자동화 중지` 버튼을 누르면 `abortFlag`가 세팅되어 현재 진행 중인 항목 완료 후 다음 항목부터 중단됩니다.
- **완료 후 자동 ZIP**: 자동 다운로드 옵션이 켜진 상태에서 모든 항목이 처리되면 완료된 이미지들을 자동으로 ZIP으로 다운로드합니다.

### 2.6. 로그 기록 (Logs Pane)

- `info`, `success`, `warn`, `error` 4가지 레벨로 라벨링하여 색상 구분 출력합니다.
- 각 로그에 `HH:MM:SS` 형식의 타임스탬프가 기록됩니다.

### 2.7. 캔버스 (Canvas Pane)

- **단일 프롬프트 전송**: 하단 입력창에 텍스트를 입력하고 전송하면 즉시 이미지 생성을 시작합니다.
- **배치 파일 파싱**: 캔버스 내 업로드 영역에 텍스트 파일을 드래그&드롭하거나 클릭하여 배치 프롬프트를 로드할 수 있습니다.
- **스켈레톤 애니메이션**: 생성 중인 슬롯은 shimmer 애니메이션으로 표시됩니다.
- **이미지 단건 재시도**: 특정 이미지 슬롯만 선택적으로 재시도할 수 있습니다 (프롬프트 전체 재시도가 아닌 이미지 인덱스 단위).
- **개별 이미지 다운로드**: 완료된 이미지 카드에서 개별 다운로드가 가능합니다.
- **전체 ZIP 다운로드**: 현재 페이지의 완료된 이미지 전체를 ZIP으로 다운로드합니다.
  - 파일명 규칙: `{순서(3자리)}_{이미지번호}.png` (예: `001_1.png`, `001_2.png`, `002_1.png`)
  - ZIP 파일명: `carbatch-{페이지제목}.zip`

### 2.8. 스토리지 관리 (StorageModal)

- TopBar의 스토리지 버튼으로 모달을 열어 관리합니다.
- **페이지별 이미지 삭제**: 특정 페이지의 이미지만 IndexedDB에서 삭제 (프롬프트 텍스트는 유지).
- **전체 이미지 삭제**: 전체 페이지의 이미지를 IndexedDB에서 일괄 삭제.
- **전체 데이터 초기화**: 모든 페이지, 프롬프트, 이미지를 삭제하고 초기 상태로 리셋.

---

## 3. 데이터 영속성 전략

| 데이터 종류 | 저장소 | 키 규칙 |
| :--- | :--- | :--- |
| 페이지 목록 (제목, 생성일) | localStorage | `carbatch_pages` |
| 프롬프트 텍스트 목록 | localStorage | `carbatch_prompts_{pageId}` |
| 마지막 열람 페이지 ID | localStorage | `lastPageId` |
| 이미지 (base64 PNG) | IndexedDB | `carbatch_images` DB, `images` store |

- 앱 재진입 시 localStorage에서 페이지/프롬프트를 복원하고, IndexedDB에서 이미지를 비동기 로드하여 `done` 상태로 복원합니다.
- 이미지를 제외한 상태(`status`)는 재진입 시 항상 `pending`으로 초기화됩니다.

---

## 4. API 명세서

### 4.1. 환경 변수

| 변수명 | 기본값 | 설명 |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_BE_URL` | `http://localhost:8000` | BE 서버 주소 |

### 4.2. 헬스 체크

- **Endpoint**: `GET /health`
- **Timeout**: 5초

**Response (200 OK)**
```json
{
  "status": "ok",
  "model_loaded": true,
  "model_id": "runwayml/stable-diffusion-v1-5",
  "device": "cuda"
}
```

### 4.3. 이미지 생성

- **Endpoint**: `POST /generate`
- **Content-Type**: `application/json`

**Request Body**

| Field | Type | 설명 | 기본값 |
| :--- | :--- | :--- | :--- |
| `model` | string | 생성 모델 (`sd15`, `sd15-lcm`) | `sd15` |
| `prompt` | string | 이미지 생성 프롬프트 (스타일 포함) | 필수 |
| `count` | number | 생성할 이미지 수 (1~8) | 1 |
| `width` | number | 이미지 너비 px (256~1024) | 512 |
| `height` | number | 이미지 높이 px (256~1024) | 512 |

```json
{
  "model": "sd15",
  "prompt": "Close up portrait of a boy, cinematic lighting",
  "count": 2,
  "width": 512,
  "height": 512
}
```

**Response (200 OK)**

| Field | Type | 설명 |
| :--- | :--- | :--- |
| `success` | boolean | 하나 이상의 이미지가 생성되었는지 여부 |
| `images` | (string \| null)[] | base64 PNG data URI 배열. 개별 실패 슬롯은 `null` |
| `error` | string \| null | 전체 실패 시 에러 메시지 |

```json
{
  "success": true,
  "images": [
    "data:image/png;base64,iVBORw0KGgoAAAANS...",
    "data:image/png;base64,iVBORw0KGgoAAAANS..."
  ],
  "error": null
}
```

**Response (503)** — 모델 로딩 중

```json
{
  "detail": "모델 로딩 중입니다. /health 에서 model_loaded 가 true가 될 때까지 대기하세요."
}
```

**Response (4xx / 5xx)**

```json
{
  "detail": "에러 메시지"
}
```

---

## 5. 알려진 제약 및 주의사항

- **모델 로드 시간**: BE 서버 최초 실행 시 SD 1.5 모델(~4GB)을 다운로드/로드하는 데 수십 초~수 분이 소요됩니다. `/health`의 `model_loaded: true` 확인 후 요청하세요.
- **`sd15-lcm` 모델**: FE UI에 선택 옵션이 있으나 현재 BE에서 `model` 필드를 무시하고 SD 1.5만 사용합니다. LCM 지원은 향후 구현 예정입니다.
- **동시성 vs BE 순차 처리**: FE는 최대 3개 동시 요청을 보내지만, BE는 `ThreadPoolExecutor(max_workers=1)`로 순차 처리합니다. 동시 요청은 BE 큐에서 대기합니다.
- **CORS**: BE는 현재 모든 출처를 허용합니다. 프로덕션 배포 시 `allow_origins`를 제한해야 합니다.