'use client';

import { useState } from 'react';
import { useSetAtom } from 'jotai';
import { userAtom } from '../store/atoms';

const BE_URL = (process.env.NEXT_PUBLIC_BE_URL ?? 'http://localhost:8000').replace(/\/$/, '');

function parseError(detail: unknown): string {
  if (!detail) return '오류가 발생했습니다.';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((e: { msg?: string }) => e.msg ?? '').filter(Boolean).join(', ');
  return '오류가 발생했습니다.';
}

type Tab = 'login' | 'register';

export default function AuthPage() {
  const setUser = useSetAtom(userAtom);
  const [tab, setTab] = useState<Tab>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPw, setLoginPw] = useState('');

  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPw, setRegPw] = useState('');
  const [regPwConfirm, setRegPwConfirm] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${BE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPw }),
      });
      const data = await res.json();
      if (!res.ok) { setError(parseError(data.detail)); return; }
      setUser({ token: data.token, userId: data.user_id, username: data.username, email: data.email });
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (regPw !== regPwConfirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: regUsername, email: regEmail, password: regPw }),
      });
      const data = await res.json();
      if (!res.ok) { setError(parseError(data.detail)); return; }
      setUser({ token: data.token, userId: data.user_id, username: data.username, email: data.email });
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (t: Tab) => { setTab(t); setError(''); };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg)]">
      <div className="w-[400px] bg-[var(--surface)] border border-[var(--border)] rounded-[16px] overflow-hidden shadow-2xl">

        {/* 헤더 */}
        <div className="px-6 pt-6 pb-5 border-b border-[var(--border)]">
          <div className="font-[var(--font-serif)] text-[22px] text-[var(--accent)] tracking-[-0.3px] mb-1">
            Batch<span className="text-[var(--text2)] text-[14px] font-[var(--font-sans)] font-light">&nbsp;Image Studio</span>
          </div>
          <p className="text-[12px] text-[var(--text3)] leading-[1.6]">
            배치 이미지 생성기 — 계속하려면 로그인하세요
          </p>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-[var(--border)]">
          {(['login', 'register'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`flex-1 py-2.5 text-[12px] font-semibold transition-colors cursor-pointer
                ${tab === t
                  ? 'text-[var(--accent)] border-b-2 border-[var(--accent)] bg-[var(--accent)]/5'
                  : 'text-[var(--text3)] hover:text-[var(--text2)]'}`}
            >
              {t === 'login' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>

        {/* 폼 */}
        <div className="px-6 py-5">
          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-3">
              <Field label="이메일" type="email" value={loginEmail} onChange={setLoginEmail} placeholder="you@example.com" />
              <Field label="비밀번호" type="password" value={loginPw} onChange={setLoginPw} placeholder="••••••" />
              {error && <ErrorBox msg={error} />}
              <SubmitButton label="로그인" loading={loading} />
              <p className="text-[11px] text-[var(--text3)] text-center">
                계정이 없으신가요?{' '}
                <button type="button" onClick={() => switchTab('register')} className="text-[var(--accent)] hover:underline cursor-pointer">
                  회원가입
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="flex flex-col gap-3">
              <Field label="닉네임" type="text" value={regUsername} onChange={setRegUsername} placeholder="홍길동" />
              <Field label="이메일" type="email" value={regEmail} onChange={setRegEmail} placeholder="you@example.com" />
              <Field label="비밀번호" type="password" value={regPw} onChange={setRegPw} placeholder="6자 이상" />
              <Field label="비밀번호 확인" type="password" value={regPwConfirm} onChange={setRegPwConfirm} placeholder="••••••" />
              {error && <ErrorBox msg={error} />}
              <SubmitButton label="회원가입" loading={loading} />
              <p className="text-[11px] text-[var(--text3)] text-center">
                이미 계정이 있으신가요?{' '}
                <button type="button" onClick={() => switchTab('login')} className="text-[var(--accent)] hover:underline cursor-pointer">
                  로그인
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, type, value, onChange, placeholder }: {
  label: string; type: string; value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] text-[var(--text3)] font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="w-full bg-[var(--surface2)] border border-[var(--border)] rounded-[8px] px-3 py-2 text-[13px] text-[var(--text)] placeholder:text-[var(--text3)] outline-none focus:border-[var(--accent)] transition-colors font-[var(--font-mono)]"
      />
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <p className="text-[11px] text-[var(--red)] bg-[var(--red)]/10 border border-[var(--red)]/20 rounded-[6px] px-3 py-2">
      {msg}
    </p>
  );
}

function SubmitButton({ label, loading }: { label: string; loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="mt-1 w-full bg-[var(--accent)] hover:bg-[var(--accent2)] disabled:opacity-50 text-black font-semibold text-[13px] py-2.5 rounded-[8px] transition-colors cursor-pointer disabled:cursor-not-allowed"
    >
      {loading ? '처리 중...' : label}
    </button>
  );
}