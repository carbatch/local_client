# Batch Image Studio - 기능 명세서 및 API 명세서

## 1. 프로젝트 개요
Batch Image Studio는 사용자가 입력한 여러 프롬프트를 일괄적으로 처리하여 이미지를 생성하는 프론트엔드 어플리케이션입니다. Next.js 기반으로 구축되었으며, 모의(Mock) 호출 대신 외부 백엔드 API와 비동기 통신(Fetch)을 통해 이미지를 실제로 생성하고 화면에 표시하도록 설계되었습니다. 백엔드 코드는 포함되어 있지 않으며 프론트엔드 단독 어플리케이션입니다.

## 2. 주요 기능 명세 (Functional Specifications)

### 2.1. 프롬프트 파싱 및 설정 (Setup Pane)
*   **요구사항**: 사용자가 특정 규칙(예: `001 프롬프트 내용`)에 따라 입력한 텍스트를 파싱하여 개별 프롬프트 작업으로 분리해야 합니다.
*   **기능 상세**:
    *   입력 텍스트를 줄바꿈 단위로 읽어, 번호와 텍스트를 분리.
    *   2장 단위로 이미지를 생성할 수 있도록 각 ID에 2개의 슬롯을 할당.
    *   파싱 에러 시 사용자에게 경고 메시지 노출.

### 2.2. 이미지 스타일 추출 및 필수 확인
*   **요구사항**: 사용자가 레퍼런스 이미지를 업로드하면 Vision API (또는 유사 백엔드)가 이를 분석해 텍스트 형태의 스타일 프롬프트를 자동 추출합니다.
*   **기능 상세**:
    *   `LeftPanel`에 "레퍼런스 이미지 업로드" 커스텀 파일 인풋 적용.
    *   업로드된 이미지는 Base64/DataURL로 클라이언트 메모리에 캐싱되어 화면(미리보기)에 보여집니다.
    *   로딩("분석 중...") 스피너 노출. 추출된 텍스트는 스타일 Textarea에 덮어 쓰여집니다.
    *   **스타일 옵션**: 사용자가 직접 텍스트를 입력하거나 이미지를 업로드해 자동 추출하지 않아도, 기존 프롬프트만으로 자동화 시작 및 생성 기능을 정상 작동할 수 있습니다 (옵션값).

### 2.3. 자동화 처리 (Automation Loop)
*   **요구사항**: 파싱된 여러 개의 프롬프트를 백엔드 API에 순차적으로 요청하여 이미지 1장씩을 자동 생성합니다.
*   **기능 상세**:
    *   전역 스타일(Image Style)을 추가 적용하여 최종 프롬프트 문자열 생성.
    *   자동화 중간에 '중지(■)' 버튼을 눌러 작업을 즉각 중단(Abort)할 수 있습니다.
    *   각 프롬프트는 딜레이 없이 비동기 작업으로 순차적으로 실행. (단, 메인 스레드 멈춤 방지를 위해 0.5초의 최소 유예 시간만 갖습니다).
    *   API 서버 실패나 에러가 발생해도 중단 버튼을 누르지 않았다면 에러 상태 기록 후 다음 프롬프트로 넘어갑니다.

### 2.4. 로그 기록 (Logs Pane)
*   **요구사항**: 자동화 실행 상태 및 개별 결과에 대한 타임스탬프 로그를 남깁니다.
*   **기능 상세**:
    *   `info`, `success`, `warn`, `error` 4가지 상태로 라벨링하여 텍스트 및 색상 출력.
    *   프롬프트 고유 아이디(ID)와 발생 시간을 명확히 기록.

### 2.5. 캔버스, 단일 개별 요청 및 ZIP 다운로드 (Canvas Pane)
*   **요구사항**: 생성 현황을 16:9 비율의 넓은 카드 뷰로 보여주고 각 프롬프트 단위 생성 및 일괄 자동 다운로드를 지원합니다.
*   **기능 상세**:
    *   단일 텍스트 창을 이용하여 즉석에서 프롬프트 생성 요청 가능.
    *   1프롬프트 당 1개의 이미지를 생성하도록 고정하며, 이미지 렌더링 영역을 가로로 넓게 보이도록 CSS(`aspect-[16/9]`) 업데이트 완료.
    *   에러 발생 항목에 대해 '재시도' 액션 버튼 지원.
    *   백엔드 API 호출로 이미지 생성 중일 경우 스켈레톤(Shimmer) 애니메이션 렌더링, 완료되면 반환된 이미지 URL 표시.
    *   **개별 이미지 다운로드**: 생성에 성공한 카드의 경우 '복사' 버튼 옆에 '다운로드' 버튼이 나타나 이미지를 단건으로 내 PC에 즉시 저장할 수 있습니다.
    *   **전체 이미지 ZIP 다운로드**: `LeftPanel` 내 버튼을 통해 지금까지 생성된 모든 이미지를 하나의 `.zip` 파일로 묶어서 다운로드하는 오프라인 아카이빙 기능.
    *   **자동 ZIP 다운로드 예약**: 자동화 시작 전에 켜두면, 자동화 스케쥴러에 있는 모든 프롬프트가 실행 완료(성공 또는 실패 전량 처리)됐을 때 사용자가 누르지 않아도 **자동으로 브라우저에서 다운로드 로직이 1번 트리거** 됩니다. 폴더 명칭은 프롬프트의 ID가 지정됩니다 (예: `001/image.png`).
    *   **새 채팅 (결과 유지 안 함)**: **"새 채팅 (결과 유지, 새 프롬프트)"** 버튼을 누르면 기존 화면에 남아있던 이미지 목록과 진행 상황이 완전히 초기화되고 셋업(설정) 탭으로 돌아갑니다. *주의: 한 번 지워진 기존 대화 내역은 복구할 수 없습니다 (프롬프트별로 과거 내역이 저장되지 않음)*.

---

## 3. 백그라운드 세션 및 서버/캐시 전략 (향후 과제 포함)

*   **현재 클라이언트 구조**: 클라이언트 상태(브라우저 탭, 전역 React `useState`)가 내려가거나 새로고침하면 현재까지 생성된 이미지 목록과 상태가 소실됩니다. 
*   **백그라운드 지속 요구사항**:
    1.  서버 측에 `Session ID` 또는 `User ID`를 부여하여 현재 진행 중인 Job(대기열) 상태를 디비에 저장해야 합니다.
    2.  재적속 시 `/api/v1/jobs` 혹은 `/api/v1/my-images` 형태의 GET 요청을 통해 서버에서 이미 생성된 이미지 파일 및 추출해뒀던 스타일 프롬프트를 불러오도록 앱 진입 (initial load) 함수(`useEffect`)를 구현해야 합니다. (이 부분은 명세로 남기고, 실제 BE 서버와 테이블 스키마 연동이 필요합니다.)

---

## 4. API 명세서 (API Specification for Frontend Fetch)

초기 클라이언트 데모의 가짜 이미지(Dummy SVG) 코드를 걷어내고, 다음과 같은 REST API 스펙을 백엔드에 요청하도록 `page.tsx` 스크립트 연결이 완성되었습니다.
실제 서비스 시 `NEXT_PUBLIC_API_URL` 환경변수를 설정하여 대상 백엔드 서버를 지정합니다.

### 3.1. 이미지 생성 API

*   **Endpoint**: `POST /api/v1/generate` (또는 `process.env.NEXT_PUBLIC_API_URL` 주소)
*   **Content-Type**: `application/json`
*   **Description**: 주어진 프롬프트 텍스트를 기반으로 지정된 갯수만큼 백엔드 서버에 이미지 생성을 요청합니다.

#### Request Body
| Field | Type | Description | Required | Example |
| :--- | :--- | :--- | :--- | :--- |
| `prompt` | string | 이미지 생성을 위한 텍스트 프롬프트 + 추가 스타일 정보 | Mandatory | "Close up, portrait of a boy, cinematic lighting" |
| `id` | string | 프롬프트 고유 ID번 (백엔드 로그 라우팅 및 트래킹용) | Optional | "001" |
| `count` | number | 생성할 이미지 갯수 | Optional | 1 |

```json
// Frontend Request payload example
{
  "prompt": "Medium shot, a 12-year-old Korean boy... traditional Korean ink painting style",
  "id": "001",
  "count": 1
}
```

#### Response Body (Success Expected)
*   **Status Code**: `200 OK`

| Field | Type | Description |
| :--- | :--- | :--- |
| `success` | boolean | 옵셔널. 백엔드 성공 응답 여부. |
| `images` | string[] | 생성된 이미지의 Base64 데이터 문자열 또는 서버 스토리지 URL 배열 |

```json
// Backend Response payload example
{
  "images": [
    "https://external-bucket.com/images/generated-001-1.png",
    "https://external-bucket.com/images/generated-001-2.png"
  ]
}
```

#### Response Body (Error Expected)
*   **Status Code**: `400 Bad Request` or `5xx Internal Server Error`

| Field | Type | Description |
| :--- | :--- | :--- |
| `message` | string | 백엔드 발생 에러 문구 및 사유 |

```json
// Backend Error payload example
{
  "message": "Prompt contains restricted keywords or API key limit exceeded."
}
```
