'use client';
import { useState } from 'react';
import { useSetAtom } from 'jotai';
import { apiKeyAtom } from '../store/atoms';

interface ApiKeyModalProps {
  onClose?: () => void;
}

export default function ApiKeyModal({ onClose }: ApiKeyModalProps) {
  const setApiKey = useSetAtom(apiKeyAtom);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const key = value.trim();
    if (!key.startsWith('sk-')) {
      setError('올바른 OpenAI API 키를 입력하세요 (sk- 로 시작)');
      return;
    }
    setApiKey(key);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-[400px] bg-[var(--surface)] border border-[var(--border)] rounded-[16px] overflow-hidden shadow-2xl">
        {/* 헤더 */}
        <div className="px-6 pt-6 pb-4">
          <div className="font-[var(--font-serif)] text-[22px] text-[var(--accent)] tracking-[-0.3px] mb-1">
            Batch<span className="text-[var(--text2)] text-[14px] font-[var(--font-sans)] font-light">&nbsp;Image Studio</span>
          </div>
          <p className="text-[12px] text-[var(--text3)] leading-[1.6]">
            OpenAI API 키를 입력하면 바로 시작합니다.<br />
            키는 브라우저 localStorage에만 저장되며 서버로 전송되지 않습니다.
          </p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-[var(--text3)] font-medium">OpenAI API Key</label>
            <input
              type="password"
              value={value}
              onChange={e => { setValue(e.target.value); setError(''); }}
              placeholder="sk-..."
              autoComplete="off"
              required
              className="w-full bg-[var(--surface2)] border border-[var(--border)] rounded-[8px] px-3 py-2 text-[13px] text-[var(--text)] placeholder-[var(--text3)] outline-none focus:border-[var(--accent)] transition-colors font-[var(--font-mono)]"
            />
          </div>

          {error && (
            <p className="text-[11px] text-[var(--red)] bg-[var(--red)]/10 border border-[var(--red)]/20 rounded-[6px] px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="mt-1 w-full bg-[var(--accent)] hover:bg-[var(--accent2)] text-black font-semibold text-[13px] py-2.5 rounded-[8px] transition-colors cursor-pointer"
          >
            시작하기
          </button>

          <p className="text-[10px] text-[var(--text3)] text-center leading-[1.5]">
            API 키는{' '}
            <span className="text-[var(--text2)]">platform.openai.com</span>
            에서 발급받을 수 있습니다
          </p>
        </form>
      </div>
    </div>
  );
}
