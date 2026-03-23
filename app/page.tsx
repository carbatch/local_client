"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useAtom } from 'jotai';
import type { PromptItem, PageSummary, LogEntry, ImageSize, ModelType } from './types';
import { userAtom, planAtom } from './store/atoms';
import { saveImages, loadImages, deletePageImages } from './lib/idb';
import { generateImagesSD, checkSDHealth } from './lib/sdGen';
import { generateImagesFree } from './lib/freeImageGen';
import AuthPage from './components/AuthPage';
import PlanPage from './components/PlanPage';
import StorageModal from './components/StorageModal';
import TopBar from './components/TopBar';
import LeftPanel from './components/LeftPanel';
import CanvasPane from './components/CanvasPane';
import { SetupPane, LogsPane } from './components/SetupAndLogsPanes';

// ── 로컬 ID 생성 ──────────────────────────────────────────────────────────
function newId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── 이미지 → base64 변환 (data URI / URL 모두 지원) ──────────────────────
async function imgToBase64(img: string): Promise<string> {
  if (img.startsWith('data:')) return img.split(',')[1];
  const res = await fetch(img);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
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
  const [user, setUser] = useAtom(userAtom);
  const [plan, setPlan] = useAtom(planAtom);

  const [showStorageModal, setShowStorageModal] = useState(false);

  const [beStatus, setBeStatus] = useState<'checking' | 'ok' | 'model-loading' | 'offline'>('checking');
  const beStatusRef = useRef<'checking' | 'ok' | 'model-loading' | 'offline'>('checking');

  const [activeTab, setActiveTab] = useState<'canvas' | 'setup' | 'logs'>('canvas');

  const [pages, setPages] = useState<PageSummary[]>([]);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<PromptItem[]>([]);

  const [stylePrompt, setStylePrompt] = useState('');

  const [isRunning, setIsRunning] = useState(false);
  const isRunningRef = useRef(false);
  const [isAutoDownload, setIsAutoDownload] = useState(false);
  const [imageCount, setImageCount] = useState(2);
  const imageCountRef = useRef(imageCount);
  useEffect(() => { imageCountRef.current = imageCount; }, [imageCount]);
  const [imageSize, setImageSize] = useState<ImageSize>('1024x1024');
  const imageSizeRef = useRef<ImageSize>(imageSize);
  useEffect(() => { imageSizeRef.current = imageSize; }, [imageSize]);
  const [sdModel, setSdModel] = useState<ModelType>('sd15');
  const sdModelRef = useRef<ModelType>('sd15');
  useEffect(() => { sdModelRef.current = sdModel; }, [sdModel]);
  const abortFlagRef = useRef(false);

  const generateImages = useCallback((
    prompt: string, count: number, size: ImageSize, isAborted: () => boolean,
  ) => plan === 'free'
    ? generateImagesFree(prompt, count, size, isAborted)
    : generateImagesSD(prompt, count, size, isAborted, sdModelRef.current, user?.token),
  [plan, user?.token]);

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

  // ── BE 헬스체크 폴링 ──────────────────────────────────────────────────

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      const result = await checkSDHealth();
      // free 플랜은 BE 연결 여부만 확인, pro/business는 모델 로드까지 확인
      const next = !result.ok
        ? 'offline'
        : (plan === 'free' || result.modelLoaded)
          ? 'ok'
          : 'model-loading';
      beStatusRef.current = next;
      setBeStatus(next);
      if (next !== 'ok') {
        timer = setTimeout(poll, 5_000);
      }
    };

    poll();
    return () => clearTimeout(timer);
  }, [plan]);

  // ── 초기 로드 ─────────────────────────────────────────────────────────

  useEffect(() => {
    const list = lsGetPages();
    setPages(list);
    if (list.length > 0) {
      const lastId = localStorage.getItem('lastPageId');
      const target = lastId ? list.find(p => p.id === lastId) : null;
      selectPageById(target ? target.id : list[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 페이지 선택 (IDB에서 이미지 복원) ────────────────────────────────

  const selectPageById = async (pageId: string) => {
    setCurrentPageId(pageId);
    localStorage.setItem('lastPageId', pageId);
    setActiveTab('canvas');

    const items = lsGetPrompts(pageId);
    setPrompts(items);

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
    const newPrompt: PromptItem = { id: promptId, text, status: 'running', images: null, size: imageSizeRef.current };
    setPrompts(prev => {
      if (prev.length === 0) {
        const title = text.slice(0, 30);
        setPages(ps => { const next = ps.map(p => p.id === pageId ? { ...p, title } : p); lsSetPages(next); return next; });
      }
      return [...prev, newPrompt];
    });

    addLog('info', '이미지 생성 시작');
    const full = stylePromptRef.current ? `${text}, ${stylePromptRef.current}` : text;
    const result = await generateImages(full, imageCountRef.current, imageSizeRef.current, () => false);

    if (result.success) {
      await saveImages(pageId, promptId, result.images);
    }

    setPrompts(prev => prev.map(p =>
      p.id === promptId
        ? { ...p, status: result.success ? 'done' : 'error', images: result.success ? result.images : null, error: result.error }
        : p
    ));

    if (result.success) addLog('success', `이미지 ${imageCountRef.current}장 생성 완료`);
    else addLog('error', `생성 실패: ${result.error}`);
  };

  // ── 배치 실행 ─────────────────────────────────────────────────────────

  const CONCURRENCY = 3; // SD는 순차 처리라 FE 동시 요청을 낮게 유지

  const runBatchItems = useCallback(async (items: PromptItem[], pageId: string) => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    abortFlagRef.current = false;
    setIsRunning(true);
    addLog('info', `자동화 시작 — ${items.length}개 프롬프트 (동시 ${CONCURRENCY}개)`);

    const resultMap = new Map<string, PromptItem>();
    let idx = 0;

    const processOne = async (): Promise<void> => {
      while (idx < items.length) {
        if (abortFlagRef.current) break;
        const p = items[idx++];

        setPrompts(prev => prev.map(x => x.id === p.id ? { ...x, status: 'running' } : x));
        const style = stylePromptRef.current;
        const full = style ? `${p.text}, ${style}` : p.text;
        const result = await generateImages(full, imageCountRef.current, imageSizeRef.current, () => abortFlagRef.current);

        if (result.success) {
          await saveImages(pageId, p.id, result.images);
        }

        const updated: PromptItem = {
          ...p,
          status: result.success ? 'done' : 'error',
          images: result.success ? result.images : null,
          size: imageSizeRef.current,
          error: result.error,
        };
        setPrompts(prev => prev.map(x => x.id === p.id ? updated : x));
        if (result.success) resultMap.set(p.id, updated);

        if (result.success) addLog('success', `[${p.text.slice(0, 20)}] 완료`);
        else addLog('error', `생성 실패: ${result.error}`);
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, processOne));

    if (!abortFlagRef.current) {
      addLog('success', '모든 프롬프트 처리 완료! ✦');
      const completedItems = items.filter(item => resultMap.has(item.id)).map(item => resultMap.get(item.id)!);
      if (isAutoDownload && completedItems.length > 0) {
        try {
          const zip = new JSZip();
          await Promise.all(completedItems.map(async (item, pi) => {
            await Promise.all(
              (item.images || []).filter((img): img is string => img !== null).map(async (img, ii) => {
                const base64 = await imgToBase64(img);
                zip.file(`${String(pi + 1).padStart(3, '0')}_${ii + 1}.png`, base64, { base64: true });
              })
            );
          }));
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

    try {
      const style = stylePromptRef.current;
      const full = style ? `${prompt.text}, ${style}` : prompt.text;
      const result = await generateImages(full, 1, imageSizeRef.current, () => false);

      if (result.success && result.images[0] !== null) {
        setPrompts(prev => prev.map(p => {
          if (p.id !== promptId) return p;
          const newImages: (string | null)[] = [...(p.images || [])];
          newImages[imgIndex] = result.images[0];
          const updated = { ...p, images: newImages, status: 'done' as const };
          saveImages(currentPageIdRef.current!, promptId, newImages);
          return updated;
        }));
        addLog('success', '이미지 재시도 완료');
      } else {
        addLog('error', `이미지 재시도 실패: ${result.error}`);
      }
    } finally {
      setRetryingImages(prev => { const next = new Set(prev); next.delete(key); return next; });
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

  // ── ZIP 다운로드 ──────────────────────────────────────────────────────

  const handleDownloadAllZip = async () => {
    const done = prompts.filter(p => p.status === 'done' && p.images?.length);
    if (!done.length) { addLog('warn', '다운로드할 이미지가 없습니다.'); return; }
    try {
      const zip = new JSZip();
      await Promise.all(done.map(async (p, pi) => {
        await Promise.all(
          (p.images || []).filter((img): img is string => img !== null).map(async (img, ii) => {
            const base64 = await imgToBase64(img);
            zip.file(`${String(pi + 1).padStart(3, '0')}_${ii + 1}.png`, base64, { base64: true });
          })
        );
      }));
      const blob = await zip.generateAsync({ type: 'blob' });
      const title = pages.find(p => p.id === currentPageId)?.title || 'batch';
      saveAs(blob, `carbatch-${title}.zip`);
      addLog('success', 'ZIP 다운로드 완료');
    } catch (e) {
      addLog('error', `ZIP 다운로드 실패: ${e}`);
    }
  };

  // ── StorageModal 콜백 ─────────────────────────────────────────────────

  const handlePageImagesCleared = (pageId: string) => {
    if (pageId === currentPageId) {
      setPrompts(prev => prev.map(p => ({ ...p, images: null, status: 'pending' as const })));
    }
    addLog('warn', '페이지 이미지 삭제됨');
  };

  const handleAllImagesCleared = () => {
    setPrompts(prev => prev.map(p => ({ ...p, images: null, status: 'pending' as const })));
    addLog('warn', '전체 이미지 삭제됨');
  };

  const handleAllDataCleared = () => {
    setPages([]);
    setCurrentPageId(null);
    setPrompts([]);
    addLog('warn', '전체 데이터 초기화됨');
  };

  // ── 로그아웃 ───────────────────────────────────────────────────────────

  const handleLogout = async () => {
    if (user?.token) {
      fetch(`${(process.env.NEXT_PUBLIC_BE_URL ?? '').replace(/\/$/, '')}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}`, 'ngrok-skip-browser-warning': 'true' },
      }).catch(() => {});
    }
    setUser(null);
  };

  // ── 렌더링 ────────────────────────────────────────────────────────────

  const doneCount = prompts.filter(p => p.status === 'done').length;

  if (!user) return <AuthPage />;
  if (!plan) return <PlanPage />;

  return (
    <div className="flex flex-col h-screen bg-[var(--bg)] text-[var(--text)] overflow-hidden font-[var(--font-sans)]">
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
        onOpenStorage={() => setShowStorageModal(true)}
        beStatus={beStatus}
        username={user.username}
        plan={plan}
        onLogout={handleLogout}
        onChangePlan={() => setPlan(null)}
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
          isAutoDownload={isAutoDownload}
          setIsAutoDownload={setIsAutoDownload}
          imageCount={imageCount}
          setImageCount={setImageCount}
          imageSize={imageSize}
          setImageSize={setImageSize}
          sdModel={sdModel}
          setSdModel={setSdModel}
          isRunning={isRunning}
          onRunToggle={handleRunToggle}
          promptsCount={prompts.length}
          token={user.token}
          onUnauthorized={() => setUser(null)}
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
