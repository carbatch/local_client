/**
 * sdGen.ts
 *
 * FastAPI BE 서버 (SD 1.5 / SD 1.5 + LCM) 를 통해 이미지를 생성합니다.
 * BE 서버 실행: car/BE/ 에서 `uvicorn main:app --host 0.0.0.0 --port 8000`
 *
 * 환경 변수:
 *   NEXT_PUBLIC_BE_URL — BE 서버 주소 (기본: http://localhost:8000)
 */

import type { ImageSize, ModelType } from '../types';

// ── 크기 매핑 (SD 1.5 최적 해상도) ───────────────────────────────────────────
// SD 1.5는 512 네이티브, 768까지 양호 (1024↑은 VRAM 많이 필요)
const SIZE_MAP: Record<ImageSize, { width: number; height: number }> = {
  '1024x1024': { width: 512, height: 512 },
  '1792x1024': { width: 768, height: 512 },
  '1024x1792': { width: 512, height: 768 },
};

const BE_URL = (process.env.NEXT_PUBLIC_BE_URL ?? 'http://localhost:8000').replace(/\/$/, '');

// ── BE 헬스 체크 ──────────────────────────────────────────────────────────────

export async function checkSDHealth(): Promise<{
  ok: boolean;
  modelLoaded: boolean;
  error?: string;
}> {
  try {
    const res = await fetch(`${BE_URL}/health`, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return { ok: false, modelLoaded: false, error: `HTTP ${res.status}` };
    const data = await res.json() as { status: string; model_loaded: boolean };
    return { ok: true, modelLoaded: data.model_loaded };
  } catch (e) {
    return { ok: false, modelLoaded: false, error: (e as Error).message };
  }
}

// ── 이미지 생성 ───────────────────────────────────────────────────────────────

export async function generateImagesSD(
  prompt: string,
  count: number,
  size: ImageSize,
  isAborted: () => boolean,
  model: ModelType = 'sd15',
  token?: string,
): Promise<{ success: boolean; images: (string | null)[]; error?: string }> {
  if (isAborted()) {
    return { success: false, images: Array(count).fill(null), error: '취소됨' };
  }

  const { width, height } = SIZE_MAP[size];

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BE_URL}/api/v1/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt, count, width, height }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { detail?: string };
      return {
        success: false,
        images: Array(count).fill(null),
        error: err.detail ?? `서버 오류: ${res.status}`,
      };
    }

    const data = await res.json() as { success: boolean; images: (string | null)[]; error?: string };
    return { success: data.success, images: data.images, error: data.error };
  } catch (e) {
    return {
      success: false,
      images: Array(count).fill(null),
      error: `BE 서버 연결 실패 (${BE_URL}): ${(e as Error).message}`,
    };
  }
}
