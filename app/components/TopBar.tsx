import { ScrollText, Settings, HardDrive, LogOut, CreditCard } from 'lucide-react';

interface TopBarProps {
  activeTab: 'canvas' | 'setup' | 'logs';
  setActiveTab: (tab: 'canvas' | 'setup' | 'logs') => void;
  promptsCount: number;
  doneCount: number;
  isRunning: boolean;
  onOpenStorage: () => void;
  beStatus: 'checking' | 'ok' | 'model-loading' | 'offline';
  username: string;
  plan: 'free' | 'pro' | 'business';
  onLogout: () => void;
  onChangePlan: () => void;
}

const PLAN_LABEL: Record<'free' | 'pro' | 'business', string> = {
  free: '일반',
  pro: 'Pro',
  business: 'Biz',
};

const BE_STATUS_CONFIG = {
  checking:       { dot: 'bg-[var(--text3)] animate-pulse',                         label: 'BE 연결 확인 중...' },
  ok:             { dot: 'bg-[var(--green)]',                                        label: 'BE 연결됨' },
  'model-loading':{ dot: 'bg-[var(--accent)] animate-[blink_1s_ease-in-out_infinite]', label: '모델 로딩 중...' },
  offline:        { dot: 'bg-[var(--red)]',                                          label: 'BE 오프라인' },
} as const;

export default function TopBar({ activeTab, setActiveTab, promptsCount, doneCount, isRunning, onOpenStorage, beStatus, username, plan, onLogout, onChangePlan }: TopBarProps) {
  const pct = promptsCount > 0 ? Math.round((doneCount / promptsCount) * 100) : 0;

  return (
    <div className="flex items-center justify-between px-5 h-[52px] bg-[var(--surface)] border-b border-[var(--border)] shrink-0 gap-3">
      <div className="flex items-center gap-2.5">
        <div className="font-[var(--font-serif)] text-[18px] text-[var(--accent)] tracking-[-0.3px]">
          Batch<span className="text-[var(--text2)] text-[13px] font-[var(--font-sans)] font-light">&nbsp;Image Studio</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div
          title={BE_STATUS_CONFIG[beStatus].label}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--surface2)] border border-[var(--border)] rounded-[20px] text-[11px] text-[var(--text2)] font-[var(--font-mono)] cursor-default select-none"
        >
          <div className={`w-[7px] h-[7px] rounded-full shrink-0 ${BE_STATUS_CONFIG[beStatus].dot}`} />
          <span>{BE_STATUS_CONFIG[beStatus].label}</span>
        </div>

        {promptsCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--surface2)] border border-[var(--border)] rounded-[20px] text-[11px] text-[var(--text2)] font-[var(--font-mono)]">
            <div className={`w-[7px] h-[7px] rounded-full shrink-0 ${isRunning ? 'bg-[var(--accent)] animate-[blink_1s_ease-in-out_infinite]' : (doneCount === promptsCount ? 'bg-[var(--green)]' : 'bg-[var(--text3)]')}`} />
            <div className="w-[60px] h-[3px] bg-[var(--border2)] rounded-[2px] overflow-hidden">
              <div className="h-full bg-[var(--accent)] rounded-[2px] transition-all duration-400 ease-in-out" style={{ width: `${pct}%` }} />
            </div>
            <span>{doneCount} / {promptsCount}</span>
          </div>
        )}

        <button
          onClick={() => setActiveTab(activeTab === 'logs' ? 'canvas' : 'logs')}
          title="로그"
          className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150 border
            ${activeTab === 'logs'
              ? 'bg-[var(--surface2)] border-[var(--border2)] text-[var(--text)]'
              : 'border-transparent text-[var(--text3)] hover:text-[var(--text)] hover:bg-white/5'}`}
        >
          <ScrollText size={15} />
        </button>

        <button
          onClick={() => setActiveTab(activeTab === 'setup' ? 'canvas' : 'setup')}
          title="설정 / 프롬프트 로드"
          className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150 border
            ${activeTab === 'setup'
              ? 'bg-[var(--surface2)] border-[var(--border2)] text-[var(--text)]'
              : 'border-transparent text-[var(--text3)] hover:text-[var(--text)] hover:bg-white/5'}`}
        >
          <Settings size={15} />
        </button>

        <button
          onClick={onOpenStorage}
          title="저장 공간 관리"
          className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150 border border-transparent text-[var(--text3)] hover:text-[var(--text)] hover:bg-white/5"
        >
          <HardDrive size={14} />
        </button>

        <div className="w-px h-4 bg-[var(--border2)]" />

        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--surface2)] border border-[var(--border)] rounded-[20px]">
          <div className="w-[6px] h-[6px] rounded-full bg-[var(--green)] shrink-0" />
          <span className="text-[11px] text-[var(--text2)] font-[var(--font-mono)] max-w-[80px] truncate">{username}</span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-[4px] ${
            plan === 'business' ? 'bg-[var(--blue)]/20 text-[var(--blue)]' :
            plan === 'pro'      ? 'bg-[var(--accent)]/20 text-[var(--accent)]' :
                                  'bg-[var(--border2)] text-[var(--text3)]'
          }`}>{PLAN_LABEL[plan]}</span>
        </div>

        <button
          onClick={onChangePlan}
          title="요금제 변경"
          className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150 border border-transparent text-[var(--text3)] hover:text-[var(--text)] hover:bg-white/5"
        >
          <CreditCard size={14} />
        </button>

        <button
          onClick={onLogout}
          title="로그아웃"
          className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150 border border-transparent text-[var(--text3)] hover:text-[var(--red)] hover:bg-[var(--red)]/10"
        >
          <LogOut size={14} />
        </button>
      </div>
    </div>
  );
}
