"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAtom } from 'jotai';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { PromptItem, PageSummary, LogEntry } from './types';
import { apiKeyAtom } from './store/atoms';
import { saveImages, loadImages, deletePageImages, deleteAllImages } from './lib/idb';
import ApiKeyModal from './components/AuthModal';
import StorageModal from './components/StorageModal';
import TopBar from './components/TopBar';
import LeftPanel from './components/LeftPanel';
import CanvasPane from './components/CanvasPane';
import { SetupPane, LogsPane } from './components/SetupAndLogsPanes';

// ── 로컬 ID 생성 ──────────────────────────────────────────────────────────
function newId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── OpenAI API 직접 호출 ─────────────────────────────────────────────────

/** DALL-E 3로 이미지 1장 생성 → base64 data URI 반환 */
async function openaiGenerateImage(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API 오류: ${res.status}`);
  }
  const data = await res.json();
  return `data:image/png;base64,${data.data[0].b64_json}`;
}

/** count장 이미지를 순차 생성 (DALL-E 3는 n=1만 지원) */
async function generateImagesLocal(
  prompt: string,
  count: number,
  apiKey: string,
  isAborted: () => boolean,
): Promise<{ success: boolean; images: string[]; error?: string }> {
  const images: string[] = [];
  for (let i = 0; i < count; i++) {
    if (isAborted()) return { success: false, images: [], error: '취소됨' };
    try {
      const img = await openaiGenerateImage(prompt, apiKey);
      images.push(img);
    } catch (e) {
      if (images.length === 0) return { success: false, images: [], error: (e as Error).message };
      break;
    }
  }
  return images.length > 0 ? { success: true, images } : { success: false, images: [], error: '생성 실패' };
}

/** GPT-4o Vision으로 이미지 스타일 추출 */
async function openaiExtractStyle(imageDataUri: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageDataUri } },
          {
            type: 'text',
            text: 'Analyze the visual style of this image. Describe the art style, lighting, color palette, mood, and texture in a concise style descriptor suitable for an image generation prompt. Keep it under 200 tokens.',
          },
        ],
      }],
      max_tokens: 200,
    }),
  });
  if (!res.ok) throw new Error('스타일 추출 실패');
  const data = await res.json();
  return data.choices[0].message.content as string;
}

// ── localStorage 페이지/프롬프트 관리 ────────────────────────────────────

const PAGES_KEY = 'carbatch_pages';
const pagePromptsKey = (id: string) => `carbatch_prompts_${id}`;

function lsGetPages(): PageSummary[] {
  try { return JSON.parse(localStorage.getItem(PAGES_KEY) || '[]'); } catch { return []; }
}
function lsSetPages(pages: PageSummary[]) {
  localStorage.setItem(PAGES_KEY, JSON.stringify(pages));
}
/** 프롬프트 텍스트만 저장 — 이미지는 IDB에 별도 보관 */
function lsGetPrompts(pageId: string): PromptItem[] {
  try {
    const raw = localStorage.getItem(pagePromptsKey(pageId));
    if (!raw) return [];
    return (JSON.parse(raw) as { id: string; text: string }[]).map(p => ({
      id: p.id, text: p.text, status: 'pending' as const, images: null,
    }));
  } catch { return []; }
}
function lsDeletePage(pageId: string) {
  localStorage.removeItem(pagePromptsKey(pageId));
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────────

export default function Page() {
  const [apiKey] = useAtom(apiKeyAtom);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);

  const apiKeyRef = useRef(apiKey);
  useEffect(() => { apiKeyRef.current = apiKey; }, [apiKey]);

  const [activeTab, setActiveTab] = useState<'canvas' | 'setup' | 'logs'>('canvas');

  const [pages, setPages] = useState<PageSummary[]>([]);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<PromptItem[]>([]);

  const [stylePrompt, setStylePrompt] = useState('');
  const [styleImagePreview, setStyleImagePreview] = useState<string | null>(null);
  const [isExtractingStyle, setIsExtractingStyle] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const isRunningRef = useRef(false);
  const [isAutoDownload, setIsAutoDownload] = useState(false);
  const abortFlagRef = useRef(false);

  const [logs, setLogs] = useState<LogEntry[]>([]);

  const stylePromptRef = useRef(stylePrompt);
  useEffect(() => { stylePromptRef.current = stylePrompt; }, [stylePrompt]);

  const currentPageIdRef = useRef(currentPageId);
  useEffect(() => { currentPageIdRef.current = currentPageId; }, [currentPageId]);

  const addLog = useCallback((level: LogEntry['level'], msg: string) => {
    setLogs(prev => [...prev, { level, msg, time: new Date().toLocaleTimeString('ko-KR', { hour12: false }) }]);
  }, []);

  // ── 프롬프트 텍스트 자동 저장 ─────────────────────────────────────────

  useEffect(() => {
    if (!currentPageId) return;
    const toSave = prompts.map(({ id, text }) => ({ id, text }));
    localStorage.setItem(pagePromptsKey(currentPageId), JSON.stringify(toSave));
  }, [prompts, currentPageId]);

  // ── 초기 로드 ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!apiKey) return;
    const list = lsGetPages();
    setPages(list);
    if (list.length > 0) {
      const lastId = localStorage.getItem('lastPageId');
      const target = lastId ? list.find(p => p.id === lastId) : null;
      selectPageById(target ? target.id : list[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // ── 페이지 선택 (IDB에서 이미지 복원) ────────────────────────────────

  const selectPageById = async (pageId: string) => {
    setCurrentPageId(pageId);
    localStorage.setItem('lastPageId', pageId);
    setActiveTab('canvas');

    // 1) 프롬프트 텍스트를 먼저 pending 상태로 표시
    const items = lsGetPrompts(pageId);
    setPrompts(items);

    // 2) IDB에서 이미지 비동기 복원
    const withImages = await Promise.all(
      items.map(async (item) => {
        try {
          const imgs = await loadImages(item.id);
          return imgs.length > 0
            ? { ...item, images: imgs, status: 'done' as const }
            : item;
        } catch { return item; }
      })
    );
    setPrompts(withImages);
  };

  const selectPage = async (pageId: string) => {
    if (isRunning) return;
    await selectPageById(pageId);
  };

  // ── 새 페이지 생성 ────────────────────────────────────────────────────

  const handleNewPage = () => {
    if (isRunning) return;
    const page: PageSummary = { id: newId(), title: '새 채팅', created_at: new Date().toISOString() };
    setPages(prev => { const next = [page, ...prev]; lsSetPages(next); return next; });
    setCurrentPageId(page.id);
    localStorage.setItem('lastPageId', page.id);
    setPrompts([]);
    setActiveTab('canvas');
    addLog('info', '새 페이지 생성됨');
  };

  // ── 페이지 삭제 ───────────────────────────────────────────────────────

  const handleDeletePage = async (pageId: string) => {
    lsDeletePage(pageId);
    await deletePageImages(pageId);
    setPages(prev => { const next = prev.filter(p => p.id !== pageId); lsSetPages(next); return next; });
    if (currentPageId === pageId) {
      const remaining = pages.filter(p => p.id !== pageId);
      if (remaining.length > 0) {
        selectPage(remaining[0].id);
      } else {
        setCurrentPageId(null);
        setPrompts([]);
        localStorage.removeItem('lastPageId');
      }
    }
  };

  // ── 단일 프롬프트 전송 ────────────────────────────────────────────────

  const sendSinglePrompt = async (text: string) => {
    let pageId = currentPageId;
    if (!pageId) {
      const page: PageSummary = { id: newId(), title: text.slice(0, 30), created_at: new Date().toISOString() };
      setPages(prev => { const next = [page, ...prev]; lsSetPages(next); return next; });
      setCurrentPageId(page.id);
      localStorage.setItem('lastPageId', page.id);
      pageId = page.id;
    }

    const promptId = newId();
    const newPrompt: PromptItem = { id: promptId, text, status: 'running', images: null };
    setPrompts(prev => {
      if (prev.length === 0) {
        const title = text.slice(0, 30);
        setPages(ps => { const next = ps.map(p => p.id === pageId ? { ...p, title } : p); lsSetPages(next); return next; });
      }
      return [...prev, newPrompt];
    });

    addLog('info', '이미지 생성 시작');
    const full = stylePromptRef.current ? `${text}, ${stylePromptRef.current}` : text;
    const result = await generateImagesLocal(full, 2, apiKeyRef.current, () => false);

    if (result.success && result.images.length > 0) {
      await saveImages(pageId, promptId, result.images);
    }

    setPrompts(prev => prev.map(p =>
      p.id === promptId
        ? { ...p, status: result.success ? 'done' : 'error', images: result.images.length ? result.images : null, error: result.error }
        : p
    ));

    if (result.success) addLog('success', '이미지 2장 생성 완료');
    else addLog('error', `생성 실패: ${result.error}`);
  };

  // ── 배치 실행 ─────────────────────────────────────────────────────────

  const runBatchItems = useCallback(async (items: PromptItem[], pageId: string) => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    abortFlagRef.current = false;
    setIsRunning(true);
    addLog('info', `자동화 시작 — ${items.length}개 프롬프트`);

    const completedItems: PromptItem[] = [];

    for (const p of items) {
      if (abortFlagRef.current) break;

      setPrompts(prev => prev.map(x => x.id === p.id ? { ...x, status: 'running' } : x));
      const style = stylePromptRef.current;
      const full = style ? `${p.text}, ${style}` : p.text;
      const result = await generateImagesLocal(full, 2, apiKeyRef.current, () => abortFlagRef.current);

      if (result.success && result.images.length > 0) {
        await saveImages(pageId, p.id, result.images);
      }

      const updated: PromptItem = {
        ...p,
        status: result.success ? 'done' : 'error',
        images: result.images.length ? result.images : null,
        error: result.error,
      };
      setPrompts(prev => prev.map(x => x.id === p.id ? updated : x));
      if (result.success) completedItems.push(updated);

      if (result.success) addLog('success', '이미지 2장 생성 완료');
      else addLog('error', `생성 실패: ${result.error}`);

      if (!abortFlagRef.current) await new Promise<void>(r => setTimeout(r, 500));
    }

    if (!abortFlagRef.current) {
      addLog('success', '모든 프롬프트 처리 완료! ✦');
      if (isAutoDownload && completedItems.length > 0) {
        try {
          const zip = new JSZip();
          completedItems.forEach((item, pi) => {
            (item.images || []).forEach((img, ii) => {
              const base64 = img.split(',')[1];
              zip.file(`${String(pi + 1).padStart(3, '0')}_${ii + 1}.png`, base64, { base64: true });
            });
          });
          const blob = await zip.generateAsync({ type: 'blob' });
          saveAs(blob, `carbatch-${pageId}.zip`);
          addLog('success', 'ZIP 자동 다운로드 완료');
        } catch (e) {
          addLog('error', `ZIP 자동 다운로드 실패: ${e}`);
        }
      }
    }

    isRunningRef.current = false;
    setIsRunning(false);
    abortFlagRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog, isAutoDownload]);

  // ── 배치 자동화 토글 ──────────────────────────────────────────────────

  const handleRunToggle = () => {
    if (isRunning) {
      abortFlagRef.current = true;
      isRunningRef.current = false;
      setIsRunning(false);
      addLog('warn', '자동화 중지됨');
      return;
    }
    const pending = prompts.filter(p => p.status === 'pending' || p.status === 'error');
    if (!pending.length || !currentPageId) return;
    runBatchItems(pending, currentPageId);
  };

  // ── 이미지 단건 재시도 ────────────────────────────────────────────────

  const [retryingImages, setRetryingImages] = useState<Set<string>>(new Set());

  const retryImage = async (promptId: string, imgIndex: number) => {
    const prompt = prompts.find(p => p.id === promptId);
    if (!prompt || !currentPageId) return;

    const key = `${promptId}__${imgIndex}`;
    setRetryingImages(prev => new Set([...prev, key]));

    const style = stylePromptRef.current;
    const full = style ? `${prompt.text}, ${style}` : prompt.text;
    const result = await generateImagesLocal(full, 1, apiKeyRef.current, () => false);

    setRetryingImages(prev => { const next = new Set(prev); next.delete(key); return next; });

    if (result.success && result.images.length > 0) {
      setPrompts(prev => prev.map(p => {
        if (p.id !== promptId) return p;
        const newImages = [...(p.images || [])];
        newImages[imgIndex] = result.images[0];
        const updated = { ...p, images: newImages, status: 'done' as const };
        // IDB 전체 이미지 업데이트
        saveImages(currentPageIdRef.current!, promptId, newImages);
        return updated;
      }));
      addLog('success', '이미지 재시도 완료');
    } else {
      addLog('error', `이미지 재시도 실패: ${result.error}`);
    }
  };

  // ── 텍스트 파일 파싱 (배치 로드) ─────────────────────────────────────

  const parsePrompts = async (text: string): Promise<boolean> => {
    const results: PromptItem[] = [];
    const lines = text.split('\n');
    let curId: string | null = null, curLines: string[] = [];

    const flush = () => {
      if (curId && curLines.length) {
        const joined = curLines.join(' ').trim();
        if (joined) results.push({ id: newId(), text: joined, status: 'pending', images: null });
      }
    };

    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      const m = t.match(/^(\d{1,3})\s+(.+)/);
      if (m) { flush(); curId = m[1]; curLines = [m[2]]; }
      else if (curId) curLines.push(t);
    }
    flush();

    if (!results.length) return false;

    let pageId = currentPageId;
    if (!pageId) {
      const page: PageSummary = { id: newId(), title: results[0].text.slice(0, 30), created_at: new Date().toISOString() };
      setPages(prev => { const next = [page, ...prev]; lsSetPages(next); return next; });
      setCurrentPageId(page.id);
      localStorage.setItem('lastPageId', page.id);
      pageId = page.id;
    }

    setPrompts(prev => [...prev, ...results]);
    setActiveTab('canvas');
    addLog('info', `${results.length}개 프롬프트 로드 완료`);

    if (!isRunning) {
      runBatchItems(results, pageId);
    }

    return true;
  };

  // ── 스타일 이미지 업로드 ──────────────────────────────────────────────

  const handleStyleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsExtractingStyle(true);
    addLog('info', '스타일 이미지 분석 중...');
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64Data = ev.target?.result as string;
      setStyleImagePreview(base64Data);
      try {
        const style = await openaiExtractStyle(base64Data, apiKeyRef.current);
        setStylePrompt(style);
        addLog('success', '스타일 추출 완료');
      } catch {
        addLog('error', '스타일 추출 실패');
      } finally {
        setIsExtractingStyle(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // ── ZIP 다운로드 ──────────────────────────────────────────────────────

  const handleDownloadAllZip = async () => {
    const done = prompts.filter(p => p.status === 'done' && p.images?.length);
    if (!done.length) { addLog('warn', '다운로드할 이미지가 없습니다.'); return; }
    try {
      const zip = new JSZip();
      done.forEach((p, pi) => {
        (p.images || []).forEach((img, ii) => {
          const base64 = img.split(',')[1];
          zip.file(`${String(pi + 1).padStart(3, '0')}_${ii + 1}.png`, base64, { base64: true });
        });
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      const title = pages.find(p => p.id === currentPageId)?.title || 'batch';
      saveAs(blob, `carbatch-${title}.zip`);
      addLog('success', 'ZIP 다운로드 완료');
    } catch (e) {
      addLog('error', `ZIP 다운로드 실패: ${e}`);
    }
  };

  // ── StorageModal 콜백 ─────────────────────────────────────────────────

  /** 특정 페이지 이미지 삭제 후 → 현재 페이지면 프롬프트 pending 초기화 */
  const handlePageImagesCleared = (pageId: string) => {
    if (pageId === currentPageId) {
      setPrompts(prev => prev.map(p => ({ ...p, images: null, status: 'pending' as const })));
    }
    addLog('warn', '페이지 이미지 삭제됨');
  };

  /** 전체 이미지 삭제 후 → 현재 프롬프트 pending 초기화 */
  const handleAllImagesCleared = () => {
    setPrompts(prev => prev.map(p => ({ ...p, images: null, status: 'pending' as const })));
    addLog('warn', '전체 이미지 삭제됨');
  };

  /** 전체 초기화 후 → 모든 state 비우기 */
  const handleAllDataCleared = () => {
    setPages([]);
    setCurrentPageId(null);
    setPrompts([]);
    addLog('warn', '전체 데이터 초기화됨');
  };

  // ── 렌더링 ────────────────────────────────────────────────────────────

  const doneCount = prompts.filter(p => p.status === 'done').length;

  return (
    <div className="flex flex-col h-screen bg-[var(--bg)] text-[var(--text)] overflow-hidden font-[var(--font-sans)]">
      {(!apiKey || showKeyModal) && (
        <ApiKeyModal onClose={showKeyModal ? () => setShowKeyModal(false) : undefined} />
      )}
      {showStorageModal && (
        <StorageModal
          pages={pages}
          onClose={() => setShowStorageModal(false)}
          onPageImagesCleared={handlePageImagesCleared}
          onAllImagesCleared={handleAllImagesCleared}
          onAllDataCleared={handleAllDataCleared}
        />
      )}
      <TopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        promptsCount={prompts.length}
        doneCount={doneCount}
        isRunning={isRunning}
        onChangeApiKey={() => setShowKeyModal(true)}
        onOpenStorage={() => setShowStorageModal(true)}
      />
      <div className="flex flex-1 overflow-hidden">
        <LeftPanel
          pages={pages}
          currentPageId={currentPageId}
          onSelectPage={selectPage}
          onNewPage={handleNewPage}
          onDeletePage={handleDeletePage}
          stylePrompt={stylePrompt}
          setStylePrompt={setStylePrompt}
          styleImagePreview={styleImagePreview}
          onStyleImageUpload={handleStyleImageUpload}
          isExtractingStyle={isExtractingStyle}
          isAutoDownload={isAutoDownload}
          setIsAutoDownload={setIsAutoDownload}
          isRunning={isRunning}
          onRunToggle={handleRunToggle}
          promptsCount={prompts.length}
        />
        <div className="flex-1 flex flex-col relative overflow-hidden">
          {activeTab === 'canvas' && (
            <CanvasPane
              prompts={prompts}
              isRunning={isRunning}
              onSendSinglePrompt={sendSinglePrompt}
              onRetryImage={retryImage}
              retryingImages={retryingImages}
              onParsePrompts={parsePrompts}
              onDownloadAllZip={handleDownloadAllZip}
              currentPageId={currentPageId}
            />
          )}
          {activeTab === 'setup' && (
            <SetupPane
              onParsePrompts={parsePrompts}
              onCancel={() => setActiveTab('canvas')}
            />
          )}
          {activeTab === 'logs' && (
            <LogsPane logs={logs} />
          )}
        </div>
      </div>
    </div>
  );
}
