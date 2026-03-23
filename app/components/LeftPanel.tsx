import { Square, Play, Trash2, ImagePlus } from 'lucide-react';
import { useRef, useState } from 'react';
import type { PageSummary, ImageSize, ModelType } from '../types';

const BE_URL = (process.env.NEXT_PUBLIC_BE_URL ?? 'http://localhost:8000').replace(/\/$/, '');

interface LeftPanelProps {
  pages: PageSummary[];
  currentPageId: string | null;
  onSelectPage: (id: string) => void;
  onNewPage: () => void;
  onDeletePage: (id: string) => void;
  stylePrompt: string;
  setStylePrompt: (val: string) => void;
  isAutoDownload: boolean;
  setIsAutoDownload: (val: boolean) => void;
  imageCount: number;
  setImageCount: (val: number) => void;
  imageSize: ImageSize;
  setImageSize: (val: ImageSize) => void;
  sdModel: ModelType;
  setSdModel: (val: ModelType) => void;
  isRunning: boolean;
  onRunToggle: () => void;
  promptsCount: number;
  token: string;
  onUnauthorized: () => void;
}

const MODEL_OPTIONS: { value: ModelType; label: string; desc: string; badge: string; badgeColor: string }[] = [
  {
    value: 'sd15',
    label: 'SD 1.5',
    desc: '고품질 / 느림',
    badge: '~20s',
    badgeColor: 'text-[var(--blue)]',
  },
  {
    value: 'sd15-lcm',
    label: 'SD 1.5 + LCM',
    desc: '빠른 생성',
    badge: '~4s',
    badgeColor: 'text-[var(--green)]',
  },
];

export default function LeftPanel({
  pages, currentPageId, onSelectPage, onNewPage, onDeletePage,
  stylePrompt, setStylePrompt,
  isAutoDownload, setIsAutoDownload,
  imageCount, setImageCount,
  imageSize, setImageSize,
  sdModel, setSdModel,
  isRunning, onRunToggle, promptsCount, token, onUnauthorized,
}: LeftPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setAnalyzeError(null);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setIsAnalyzing(true);
      try {
        const res = await fetch(`${BE_URL}/api/v1/extract-style`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ image: dataUrl }),
        });
        const data = await res.json();
        if (res.ok && data.style) {
          setStylePrompt(data.style);
        } else {
          setAnalyzeError(data.detail ?? '스타일 추출 실패');
        }
      } catch (err) {
        setAnalyzeError(err instanceof Error ? err.message : '네트워크 오류');
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="w-[280px] shrink-0 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col overflow-hidden">

      {/* 상단 버튼 */}
      <div className="p-3 flex flex-col gap-2 border-b border-[var(--border)]">
        <button
          onClick={onNewPage}
          disabled={isRunning}
          className="w-full py-2 px-3 rounded-[8px] border border-[var(--border2)] bg-transparent text-[var(--text2)] text-[12px] font-medium cursor-pointer transition-all hover:bg-[var(--surface2)] hover:text-[var(--text)] disabled:opacity-40 disabled:cursor-not-allowed text-left"
        >
          + 새 채팅 생성
        </button>

        <button
          onClick={onRunToggle}
          disabled={promptsCount === 0}
          className={`w-full py-2 px-3 rounded-[8px] text-[12px] font-semibold cursor-pointer transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed
            ${isRunning
              ? 'bg-[#ef444426] text-[var(--red)] border border-[#ef44444d] hover:bg-[#ef444440]'
              : 'bg-[var(--accent)] text-[#0e0e10] border-none hover:bg-[var(--accent2)]'}`}
        >
          {isRunning
            ? <><Square size={12} fill="currentColor" /> 자동화 중지</>
            : <><Play size={12} fill="currentColor" /> 자동화 시작</>}
        </button>
      </div>

      {/* 페이지 목록 */}
      <div className="flex-1 overflow-y-auto py-1">
        {pages.length === 0 ? (
          <div className="p-6 text-center text-[11px] text-[var(--text3)] leading-[1.8]">
            새 채팅을 생성하면<br />여기에 표시됩니다
          </div>
        ) : (
          pages.map((page) => {
            const isActive = currentPageId === page.id;
            return (
              <div
                key={page.id}
                onClick={() => onSelectPage(page.id)}
                className={`group flex items-center gap-2 py-2.5 px-4 cursor-pointer transition-colors duration-100 border-l-2
                  ${isActive ? 'border-[var(--accent)] bg-[#f5c51810]' : 'border-transparent hover:bg-white/5'}`}
              >
                <div className="flex-1 min-w-0">
                  <div className={`text-[12px] font-medium truncate ${isActive ? 'text-[var(--text)]' : 'text-[var(--text2)]'}`}>
                    {page.title}
                  </div>
                  <div className="text-[10px] text-[var(--text3)] mt-0.5 font-[var(--font-mono)]">
                    {page.created_at?.slice(0, 16)}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeletePage(page.id); }}
                  className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-[var(--text3)] hover:text-[var(--red)] hover:bg-[#ef444414] transition-all shrink-0"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* 하단 설정 영역 */}
      <div className="border-t border-[var(--border)] p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-semibold tracking-[0.08em] uppercase text-[var(--text3)]">스타일 작성</div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzing}
            title="이미지로 스타일 추출"
            className="flex items-center gap-1 px-2 py-1 rounded-[6px] text-[10px] text-[var(--text3)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 border border-transparent hover:border-[var(--accent)]/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ImagePlus size={12} />
            {isAnalyzing ? '분석 중...' : '이미지로 추출'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </div>

        <div className="relative">
          <textarea
            className="bg-[var(--surface2)] border border-[var(--border2)] rounded-[8px] p-2 px-2.5 min-h-[60px] text-[11px] text-[var(--text)] font-[var(--font-mono)] resize-none w-full leading-[1.6] outline-none focus:border-[var(--accent)] placeholder:text-[var(--text3)] transition-colors"
            rows={2}
            placeholder="스타일 텍스트 직접 입력..."
            value={stylePrompt}
            onChange={e => setStylePrompt(e.target.value)}
          />
          {isAnalyzing && (
            <div className="absolute inset-0 rounded-[8px] bg-[var(--surface2)]/80 flex items-center justify-center gap-1.5">
              <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
              </svg>
              <span className="text-[10px] text-[var(--text3)]">분석 중...</span>
            </div>
          )}
        </div>
        {analyzeError && (
          <p className="text-[10px] text-[var(--red)] leading-[1.5]">{analyzeError}</p>
        )}

        {/* 모델 선택 */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] text-[var(--text3)]">생성 모델</span>
          <div className="flex gap-1.5">
            {MODEL_OPTIONS.map(({ value, label, desc, badge, badgeColor }) => (
              <button
                key={value}
                onClick={() => setSdModel(value)}
                disabled={isRunning}
                className={`flex-1 flex flex-col items-start gap-0.5 px-2.5 py-2 rounded-[8px] text-left transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border
                  ${sdModel === value
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-[#0e0e10]'
                    : 'bg-[var(--surface2)] border-[var(--border2)] text-[var(--text2)] hover:border-[var(--accent)] hover:text-[var(--text)]'}`}
              >
                <div className="flex items-center justify-between w-full gap-1">
                  <span className="text-[11px] font-semibold leading-none">{label}</span>
                  <span className={`text-[9px] font-mono font-bold leading-none ${sdModel === value ? 'text-[#0e0e1099]' : badgeColor}`}>
                    {badge}
                  </span>
                </div>
                <span className={`text-[9px] leading-none ${sdModel === value ? 'text-[#0e0e1099]' : 'text-[var(--text3)]'}`}>
                  {desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between py-1">
          <span className="text-[10px] text-[var(--text3)]">이미지 비율</span>
          <div className="flex gap-1">
            {([
              { value: '1024x1024', label: '1:1',  w: 16, h: 16 },
              { value: '1792x1024', label: '16:9', w: 20, h: 12 },
              { value: '1024x1792', label: '9:16', w: 12, h: 20 },
            ] as { value: ImageSize; label: string; w: number; h: number }[]).map(({ value, label, w, h }) => (
              <button
                key={value}
                onClick={() => setImageSize(value)}
                disabled={isRunning}
                title={label}
                className={`flex flex-col items-center justify-center gap-1 px-2 py-1.5 rounded-[6px] text-[10px] font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed
                  ${imageSize === value
                    ? 'bg-[var(--accent)] text-[#0e0e10]'
                    : 'bg-[var(--surface2)] text-[var(--text2)] hover:bg-[var(--border2)]'}`}
              >
                <div
                  className={`border-[1.5px] rounded-[2px] ${imageSize === value ? 'border-[#0e0e10]' : 'border-current'}`}
                  style={{ width: w, height: h }}
                />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between py-1">
          <span className="text-[10px] text-[var(--text3)]">프롬프트당 이미지 수</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map(n => (
              <button
                key={n}
                onClick={() => setImageCount(n)}
                disabled={isRunning}
                className={`w-7 h-7 rounded-[6px] text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed
                  ${imageCount === n
                    ? 'bg-[var(--accent)] text-[#0e0e10]'
                    : 'bg-[var(--surface2)] text-[var(--text2)] hover:bg-[var(--border2)]'}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center justify-between cursor-pointer py-1">
          <span className="text-[10px] text-[var(--text3)] leading-[1.4]">프롬프트 전부 종료 후<br />zip파일 복사</span>
          <div
            onClick={() => setIsAutoDownload(!isAutoDownload)}
            className={`relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0 cursor-pointer
              ${isAutoDownload ? 'bg-[var(--accent)]' : 'bg-[var(--border2)]'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
              ${isAutoDownload ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
          </div>
        </label>
      </div>
    </div>
  );
}
