/**
 * freeImageGen.ts
 *
 * 무료 이미지 검색/가져오기 로직 — API 키 불필요
 *
 * 원본 OpenAI 로직(page.tsx)은 수정하지 않습니다.
 * generateImagesFree() 의 반환 타입은 generateImagesLocal()과 동일하므로 교체 가능합니다.
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  사용 서비스                                                  │
 * │  ① LoremFlickr  — 프롬프트 키워드로 실제 사진 검색 (기본)       │
 * │     https://loremflickr.com/{w}/{h}/{keyword}               │
 * │  ② Lorem Picsum — 키워드 무시, 완전 랜덤 사진 (fallback)       │
 * │     https://picsum.photos/{w}/{h}?random={n}                │
 * └─────────────────────────────────────────────────────────────┘
 */

import type { ImageSize } from '../types';

// ── 크기 매핑 ─────────────────────────────────────────────────────────────

const SIZE_MAP: Record<ImageSize, { width: number; height: number }> = {
  '1024x1024': { width: 1024, height: 1024 },
  '1792x1024': { width: 1792, height: 1024 },
  '1024x1792': { width: 1024, height: 1792 },
};

// ── 프롬프트 → 키워드 추출 ────────────────────────────────────────────────

/**
 * 긴 프롬프트에서 검색에 쓸 핵심 키워드를 추출합니다.
 * - 불용어(a, the, of, ...) 제거
 * - 앞에서 최대 3단어만 사용 (LoremFlickr URL 제한 대응)
 */
function extractKeywords(prompt: string): string {
  const stopwords = new Set([
    'a','an','the','of','in','on','at','to','for','with','and','or','but',
    'is','are','was','were','be','been','by','from','as','that','this',
    'it','its','have','has','had','do','does','did','will','would','could',
    'should','may','might','shall','not','no','nor','so','yet','both',
    'either','neither','each','every','all','any','few','more','most',
    'other','some','such','than','then','too','very','just','also',
  ]);

  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.has(w));

  // 중복 제거 후 최대 3개
  return [...new Set(words)].slice(0, 3).join(',') || 'nature';
}

// ── 단일 이미지 가져오기 ──────────────────────────────────────────────────

/**
 * 프롬프트 키워드로 LoremFlickr에서 이미지 1장을 가져옵니다.
 * 실패 시 Lorem Picsum 랜덤 이미지로 fallback.
 * 반환값: base64 data URI (기존 IDB 파이프라인과 호환)
 */
export async function fetchFreeImage(
  prompt: string,
  size: ImageSize,
): Promise<string> {
  const { width, height } = SIZE_MAP[size];
  const keywords = extractKeywords(prompt);
  const seed = Math.floor(Math.random() * 9_999_999);

  // 1차: LoremFlickr (키워드 기반)
  try {
    const url = `https://loremflickr.com/${width}/${height}/${encodeURIComponent(keywords)}?random=${seed}`;
    const res = await fetchWithTimeout(url, 10_000);
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0) return blobToDataUri(blob);
    }
  } catch {
    // fallback으로 진행
  }

  // 2차 fallback: Lorem Picsum (완전 랜덤)
  const fallbackUrl = `https://picsum.photos/${width}/${height}?random=${seed}`;
  const res = await fetchWithTimeout(fallbackUrl, 10_000);
  if (!res.ok) throw new Error(`이미지 가져오기 실패: ${res.status}`);
  const blob = await res.blob();
  return blobToDataUri(blob);
}

// ── 병렬 다중 가져오기 (generateImagesLocal 과 동일한 인터페이스) ────────────

/**
 * count 장 이미지를 병렬로 가져옵니다.
 * - API 키가 필요 없습니다.
 * - 반환 images 배열 길이는 count 고정, 실패 슬롯은 null.
 */
export async function generateImagesFree(
  prompt: string,
  count: number,
  size: ImageSize,
  isAborted: () => boolean,
): Promise<{ success: boolean; images: (string | null)[]; error?: string }> {
  if (isAborted()) {
    return { success: false, images: Array(count).fill(null), error: '취소됨' };
  }

  const tasks = Array.from({ length: count }, () => fetchFreeImage(prompt, size));
  const results = await Promise.allSettled(tasks);

  const images: (string | null)[] = results.map(r =>
    r.status === 'fulfilled' ? r.value : null,
  );

  const successCount = images.filter(img => img !== null).length;

  if (successCount === 0) {
    const first = results.find(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    return {
      success: false,
      images,
      error: (first?.reason as Error)?.message || '이미지 가져오기 실패',
    };
  }

  return { success: true, images };
}

// ── 유틸리티 ─────────────────────────────────────────────────────────────

function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

async function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Blob → data URI 변환 실패'));
    reader.readAsDataURL(blob);
  });
}
