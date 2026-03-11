import React from 'react';

interface TopBarProps {
  activeTab: 'canvas' | 'setup' | 'logs';
  setActiveTab: (tab: 'canvas' | 'setup' | 'logs') => void;
  promptsCount: number;
  doneCount: number;
  isRunning: boolean;
}

export default function TopBar({ activeTab, setActiveTab, promptsCount, doneCount, isRunning }: TopBarProps) {
  const pct = promptsCount > 0 ? Math.round((doneCount / promptsCount) * 100) : 0;
  
  return (
    <div className="flex items-center justify-between px-5 h-[52px] bg-[var(--surface)] border-b border-[var(--border)] shrink-0 gap-3">
      <div className="flex items-center gap-2.5">
        <div className="font-[var(--font-serif)] text-[18px] text-[var(--accent)] tracking-[-0.3px]">
          Batch<span className="text-[var(--text2)] text-[13px] font-[var(--font-sans)] font-light">&nbsp;Image Studio</span>
        </div>
      </div>
      
      <div className="flex items-center gap-1.5 flex-1 justify-center max-w-[480px] mx-auto">
        <TabButton label="캔버스" active={activeTab === 'canvas'} onClick={() => setActiveTab('canvas')} />
        <TabButton label="설정" active={activeTab === 'setup'} onClick={() => setActiveTab('setup')} />
        <TabButton label="로그" active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} />
      </div>

      <div className="flex items-center gap-2">
        {promptsCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--surface2)] border border-[var(--border)] rounded-[20px] text-[11px] text-[var(--text2)] font-[var(--font-mono)]">
            <div className={`w-[7px] h-[7px] rounded-full shrink-0 ${isRunning ? 'bg-[var(--accent)] animate-[blink_1s_ease-in-out_infinite]' : (doneCount === promptsCount ? 'bg-[var(--green)]' : 'bg-[var(--text3)]')}`} />
            <div className="w-[60px] h-[3px] bg-[var(--border2)] rounded-[2px] overflow-hidden">
              <div className="h-full bg-[var(--accent)] rounded-[2px] transition-all duration-400 ease-in-out" style={{ width: `${pct}%` }} />
            </div>
            <span>{doneCount} / {promptsCount}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-1.25 px-3 py-1.25 rounded-[7px] border text-[12px] font-[var(--font-sans)] cursor-pointer transition-all duration-150 whitespace-nowrap
        ${active ? 'bg-[var(--surface2)] border-[var(--border2)] text-[var(--text)]' : 'border-transparent bg-transparent text-[var(--text2)] hover:text-[var(--text)] hover:bg-white/5'}`}
    >
      <span className={`w-[6px] h-[6px] rounded-full ${active ? 'bg-[var(--accent)]' : 'bg-[var(--text3)]'}`} />
      {label}
    </button>
  );
}
