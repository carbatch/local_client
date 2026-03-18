export type PromptStatus = 'pending' | 'running' | 'done' | 'error';
export type ImageSize = '1024x1024' | '1792x1024' | '1024x1792';

export interface PromptItem {
  id: string;           // 로컬 추적용 ID (타임스탬프 기반)
  text: string;         // 프롬프트 텍스트
  status: PromptStatus;
  images: (string | null)[] | null; // base64 data URI, null = 해당 슬롯 생성 실패
  size?: ImageSize;     // 생성 당시 선택한 이미지 비율
  error?: string;
}

export interface PageSummary {
  id: string;           // 로컬 UUID
  title: string;        // 페이지 제목 (첫 프롬프트 기반으로 자동 설정)
  created_at: string;
}

export interface LogEntry {
  level: 'info' | 'success' | 'warn' | 'error';
  msg: string;
  time: string;
  promptId?: string;
}
