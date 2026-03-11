import React, { useState } from 'react';

interface SetupPaneProps {
  onParsePrompts: (text: string) => boolean;
}

export function SetupPane({ onParsePrompts }: SetupPaneProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const handleParse = () => {
    if (!text.trim()) {
      setError('텍스트를 입력해주세요');
      return;
    }
    const success = onParsePrompts(text);
    if (!success) {
      setError('프롬프트를 파싱할 수 없습니다. 형식을 확인해주세요.');
    } else {
      setError('');
    }
  };

  const loadExample = () => {
    setText(`001 Medium shot, a 12-year-old Korean boy with pale white skin, short black hair, dark deep eyes, wearing old white hemp clothes soaked with dripping water, barefoot sitting on a giant turtle with mystical blue patterns on its shell, glowing ethereal light, moonlight scene, no text\n\n003 Wide shot, bright full moon night in Joseon era Korea, 99-room tile-roofed mansion with a boy on a giant turtle at the gate, silver moonlight flooding the scene, eerie atmosphere, no text\n\n005 Medium shot, a Joseon era servant lifting torch high, face showing sudden shock and terror, torch about to fall from trembling hand, night scene, no text\n\n007 Full shot, a Korean nobleman in silk robes running in panic, mansion courtyard at night, urgent fearful movement, servants in background, no text`);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-10">
      <div className="w-full max-w-[640px] bg-[var(--surface)] border border-[var(--border)] rounded-[18px] overflow-hidden">
        <div className="pt-6 px-7">
          <div className="font-[var(--font-serif)] text-[22px] text-[var(--text)] mb-1.5">+ 새 채팅</div>
          <div className="text-[13px] text-[var(--text2)] leading-[1.5]">
            001, 003, 005... 형식의 번호 구분 프롬프트를 붙여넣으세요.<br/>
            각 프롬프트마다 이미지 1장이 자동으로 생성됩니다.
          </div>
        </div>
        <div className="p-5 px-7 flex flex-col gap-4">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.07em] uppercase text-[var(--text3)] mb-1.5">프롬프트 텍스트</div>
            <textarea 
              className="w-full bg-[var(--surface2)] border border-[var(--border2)] rounded-[10px] p-3 px-3.5 text-[12px] font-[var(--font-mono)] text-[var(--text)] resize-none outline-none transition-colors duration-150 leading-[1.6] focus:border-[var(--accent)] placeholder:text-[var(--text3)]"
              rows={10}
              placeholder="001 Medium shot, a Korean boy...&#10;&#10;003 Wide shot, bright full moon...&#10;&#10;005 Close up, a servant's terror..."
              value={text}
              onChange={e => setText(e.target.value)}
            />
            <div className="text-[11px] text-[var(--text3)] mt-1.5 font-[var(--font-mono)]">
              포맷: <code className="bg-[var(--surface2)] px-1 py-px rounded text-[var(--accent)]">001 프롬프트...</code> — 번호는 2씩 증가 (001, 003, 005...)
            </div>
          </div>
          {error && (
            <div className="bg-[#ef44441a] border border-[#ef444440] rounded-lg p-2.5 px-3 text-[12px] text-[#fca5a5]">
              {error}
            </div>
          )}
        </div>
        <div className="pb-6 px-7 flex gap-2">
          <button 
            className="flex-1 p-2.5 rounded-[var(--radius)] font-[var(--font-sans)] text-[13px] font-semibold border border-[var(--border2)] bg-transparent text-[var(--text2)] hover:bg-[var(--surface2)] hover:text-[var(--text)] transition-colors duration-150"
            onClick={loadExample}
          >
            예시 로드
          </button>
          <button 
            className="flex-1 p-2.5 rounded-[var(--radius)] font-[var(--font-sans)] text-[13px] font-semibold border-none bg-[var(--accent)] text-[#0e0e10] hover:bg-[var(--accent2)] hover:-translate-y-px transition-all duration-150"
            onClick={handleParse}
          >
            파싱 & 적용 →
          </button>
        </div>
      </div>
    </div>
  );
}


import type { LogEntry } from '../types';

export function LogsPane({ logs }: { logs: LogEntry[] }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3.5 px-5 font-[var(--font-mono)] text-[11px] leading-[1.8]">
        {logs.length === 0 ? (
          <div className="text-[var(--text3)] text-center py-15 text-[12px]">자동화를 시작하면 로그가 표시됩니다</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex gap-2.5">
              <span className="text-[var(--text3)] min-w-[72px] shrink-0">{log.time}</span>
              <span className="text-[var(--blue)] min-w-[36px] shrink-0">{log.promptId || ''}</span>
              <span className={`flex-1 ${log.level === 'success' ? 'text-[var(--green)]' : log.level === 'error' ? 'text-[var(--red)]' : log.level === 'warn' ? 'text-[var(--accent)]' : 'text-[var(--text2)]'}`}>
                {log.msg}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
