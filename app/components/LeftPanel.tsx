import { Square, Play, Trash2 } from 'lucide-react';
import type { PageSummary, ImageSize } from '../types';

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
  useMock: boolean;
  setUseMock: (val: boolean) => void;
  imageCount: number;
  setImageCount: (val: number) => void;
  imageSize: ImageSize;
  setImageSize: (val: ImageSize) => void;
  isRunning: boolean;
  onRunToggle: () => void;
  promptsCount: number;
}

export default function LeftPanel({
  pages, currentPageId, onSelectPage, onNewPage, onDeletePage,
  stylePrompt, setStylePrompt,
  isAutoDownload, setIsAutoDownload,
  useMock, setUseMock,
  imageCount, setImageCount,
  imageSize, setImageSize,
  isRunning, onRunToggle, promptsCount,
}: LeftPanelProps) {

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
        <div className="text-[10px] font-semibold tracking-[0.08em] uppercase text-[var(--text3)]">스타일 작성</div>

        <textarea
          className="bg-[var(--surface2)] border border-[var(--border2)] rounded-[8px] p-2 px-2.5 min-h-[60px] text-[11px] text-[var(--text)] font-[var(--font-mono)] resize-none w-full leading-[1.6] outline-none focus:border-[var(--accent)] placeholder:text-[var(--text3)] transition-colors"
          rows={2}
          placeholder="스타일 텍스트 직접 입력..."
          value={stylePrompt}
          onChange={e => setStylePrompt(e.target.value)}
        />

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
          <span className="text-[10px] text-[var(--text3)] leading-[1.4]">Mock 모드<br /><span className="text-[9px] opacity-60">BE 서버 없이 테스트</span></span>
          <div
            onClick={() => setUseMock(!useMock)}
            className={`relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0 cursor-pointer
              ${useMock ? 'bg-[var(--accent)]' : 'bg-[var(--border2)]'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
              ${useMock ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
          </div>
        </label>

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
