'use client';
import { useState, useEffect, useCallback } from 'react';
import { Trash2, X, HardDrive, RefreshCcw } from 'lucide-react';
import type { PageSummary } from '../types';
import {
  getStorageStats,
  deletePageImages,
  deleteAllImages,
} from '../lib/idb';

const PAGES_KEY = 'carbatch_pages';
const pagePromptsKey = (id: string) => `carbatch_prompts_${id}`;

interface StorageModalProps {
  pages: PageSummary[];
  onClose: () => void;
  /** 특정 페이지 이미지 삭제 후 호출 → page.tsx가 state 동기화 */
  onPageImagesCleared: (pageId: string) => void;
  /** 전체 이미지 삭제 후 호출 */
  onAllImagesCleared: () => void;
  /** 전체 데이터(이미지 + 페이지) 삭제 후 호출 */
  onAllDataCleared: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StorageModal({
  pages,
  onClose,
  onPageImagesCleared,
  onAllImagesCleared,
  onAllDataCleared,
}: StorageModalProps) {
  const [stats, setStats] = useState<{
    total: { count: number; estimatedBytes: number };
    perPage: Map<string, { count: number; estimatedBytes: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<'all-images' | 'all-data' | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getStorageStats();
      setStats(s);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  // ── 이미지만 삭제 (페이지 단위) ─────────────────────────────────────
  const handleDeletePageImages = async (pageId: string) => {
    await deletePageImages(pageId);
    onPageImagesCleared(pageId);
    await loadStats();
  };

  // ── 전체 이미지 삭제 ─────────────────────────────────────────────────
  const handleClearAllImages = async () => {
    setConfirming(null);
    await deleteAllImages();
    onAllImagesCleared();
    await loadStats();
  };

  // ── 전체 초기화 (이미지 + 페이지) ────────────────────────────────────
  const handleClearAll = async () => {
    setConfirming(null);
    await deleteAllImages();
    // localStorage 페이지·프롬프트 전부 삭제
    const stored: PageSummary[] = JSON.parse(localStorage.getItem(PAGES_KEY) || '[]');
    stored.forEach(p => localStorage.removeItem(pagePromptsKey(p.id)));
    localStorage.removeItem(PAGES_KEY);
    localStorage.removeItem('lastPageId');
    onAllDataCleared();
    onClose();
  };

  const lsSize = (() => {
    let bytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('carbatch')) {
        bytes += (localStorage.getItem(k) ?? '').length * 2;
      }
    }
    return bytes;
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[460px] max-h-[80vh] flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-[16px] shadow-2xl overflow-hidden">

        {/* ── 헤더 ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <HardDrive size={15} className="text-[var(--accent)]" />
            <span className="text-[14px] font-semibold text-[var(--text)]">저장 공간 관리</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={loadStats}
              title="새로고침"
              className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text3)] hover:text-[var(--text)] hover:bg-white/5 cursor-pointer transition-colors"
            >
              <RefreshCcw size={13} />
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text3)] hover:text-[var(--text)] hover:bg-white/5 cursor-pointer transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── 전체 통계 ─────────────────────────────────────────────────── */}
        <div className="px-5 pb-3 shrink-0">
          <div className="bg-[var(--surface2)] border border-[var(--border)] rounded-[10px] p-3 grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <div className="text-[var(--text3)] mb-0.5">IndexedDB 이미지</div>
              <div className="text-[var(--text)] font-[var(--font-mono)] font-medium">
                {loading ? '—' : `${stats?.total.count ?? 0}장 · ${formatBytes(stats?.total.estimatedBytes ?? 0)}`}
              </div>
            </div>
            <div>
              <div className="text-[var(--text3)] mb-0.5">localStorage 데이터</div>
              <div className="text-[var(--text)] font-[var(--font-mono)] font-medium">
                {pages.length}개 페이지 · {formatBytes(lsSize)}
              </div>
            </div>
          </div>
        </div>

        {/* ── 페이지별 목록 ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 pb-2">
          {pages.length === 0 ? (
            <div className="text-[11px] text-[var(--text3)] text-center py-6">저장된 페이지가 없습니다</div>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text3)] mb-1">페이지별 이미지</div>
              {pages.map(page => {
                const pageStat = stats?.perPage.get(page.id);
                const hasImages = (pageStat?.count ?? 0) > 0;
                return (
                  <div
                    key={page.id}
                    className="flex items-center gap-3 py-2 px-3 bg-[var(--surface2)] border border-[var(--border)] rounded-[8px]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] text-[var(--text)] font-medium truncate">{page.title}</div>
                      <div className="text-[10px] text-[var(--text3)] font-[var(--font-mono)] mt-0.5">
                        {loading ? '—' : hasImages
                          ? `${pageStat!.count}장 · ${formatBytes(pageStat!.estimatedBytes)}`
                          : '이미지 없음'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeletePageImages(page.id)}
                      disabled={!hasImages || loading}
                      title="이 페이지 이미지 삭제"
                      className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text3)] hover:text-[var(--red)] hover:bg-[#ef444414] cursor-pointer transition-colors disabled:opacity-25 disabled:cursor-not-allowed shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 하단 액션 ─────────────────────────────────────────────────── */}
        <div className="px-5 pt-3 pb-5 flex flex-col gap-2 border-t border-[var(--border)] shrink-0">

          {/* 확인 다이얼로그 */}
          {confirming && (
            <div className="bg-[#ef444415] border border-[#ef444435] rounded-[8px] px-3 py-2.5 flex items-center justify-between gap-3">
              <span className="text-[11px] text-[var(--red)] leading-[1.4]">
                {confirming === 'all-images'
                  ? '모든 이미지를 삭제합니다. 되돌릴 수 없습니다.'
                  : '모든 이미지와 페이지 정보를 삭제합니다. 되돌릴 수 없습니다.'}
              </span>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => setConfirming(null)}
                  className="px-2.5 py-1 rounded-[6px] text-[11px] font-medium text-[var(--text2)] border border-[var(--border2)] hover:bg-[var(--surface2)] cursor-pointer"
                >
                  취소
                </button>
                <button
                  onClick={confirming === 'all-images' ? handleClearAllImages : handleClearAll}
                  className="px-2.5 py-1 rounded-[6px] text-[11px] font-semibold bg-[var(--red)] text-white hover:opacity-90 cursor-pointer"
                >
                  삭제
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => setConfirming('all-images')}
            disabled={(stats?.total.count ?? 0) === 0 || loading}
            className="w-full py-2.5 rounded-[10px] text-[12px] font-semibold border border-[var(--border2)] bg-transparent text-[var(--text2)] hover:bg-[var(--surface2)] hover:text-[var(--text)] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Trash2 size={13} />
            이미지만 전체 삭제 (페이지·프롬프트 유지)
          </button>

          <button
            onClick={() => setConfirming('all-data')}
            className="w-full py-2.5 rounded-[10px] text-[12px] font-semibold bg-[#ef444418] border border-[#ef444438] text-[var(--red)] hover:bg-[#ef444428] transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <Trash2 size={13} />
            전체 초기화 (이미지 + 페이지 모두 삭제)
          </button>
        </div>
      </div>
    </div>
  );
}
