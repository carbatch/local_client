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
      const err = await res.json().catch(() => ({})) as { detail?: unknown };
      const detail = err.detail;
      const errorMsg = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(', ')
          : `서버 오류: ${res.status}`;
      return { success: false, images: Array(count).fill(null), error: errorMsg };
    }

    const job = await res.json() as { prompt_id: string };
    const promptId = job.prompt_id;

    // 폴링 — done / error 될 때까지 대기
    const POLL_INTERVAL = 2000;
    const TIMEOUT = 5 * 60 * 1000; // 5분
    const deadline = Date.now() + TIMEOUT;

    while (Date.now() < deadline) {
      if (isAborted()) return { success: false, images: Array(count).fill(null), error: '취소됨' };
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
      if (isAborted()) return { success: false, images: Array(count).fill(null), error: '취소됨' };

      const statusRes = await fetch(`${BE_URL}/api/v1/generations/${promptId}/status`, { headers });
      if (!statusRes.ok) continue;

      const status = await statusRes.json() as {
        status: 'pending' | 'running' | 'done' | 'error';
        image_paths: string[];
        error_msg: string | null;
      };

      if (status.status === 'done') {
        const images = status.image_paths.map(p => `${BE_URL}/storage/${p}`);
        return { success: true, images };
      }
      if (status.status === 'error') {
        return { success: false, images: Array(count).fill(null), error: status.error_msg ?? '생성 실패' };
      }
    }

    return { success: false, images: Array(count).fill(null), error: '생성 시간 초과 (5분)' };
  } catch (e) {
    return {
      success: false,
      images: Array(count).fill(null),
      error: `BE 서버 연결 실패 (${BE_URL}): ${(e as Error).message}`,
    };
  }
}
