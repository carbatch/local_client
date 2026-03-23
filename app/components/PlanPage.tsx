'use client';

import { useSetAtom } from 'jotai';
import { planAtom, userAtom, type Plan } from '../store/atoms';
import { Check, X } from 'lucide-react';

interface PlanConfig {
  id: Plan;
  name: string;
  price: string;
  desc: string;
  badge?: string;
  features: { text: string; included: boolean }[];
  cta: string;
  highlighted: boolean;
}

const PLANS: PlanConfig[] = [
  {
    id: 'free',
    name: '일반',
    price: '무료',
    desc: '개인 프로젝트 및 테스트 용도',
    features: [
      { text: '이미지 브라우저(IndexedDB) 저장', included: true },
      { text: '로컬 Hugging Face AI 동작', included: true },
      { text: '서버 스토리지 저장', included: false },
      { text: '서버 AI 모델 사용', included: false },
    ],
    cta: '무료로 시작',
    highlighted: false,
  },
  {
    id: 'pro',
    name: '프로',
    price: '월 0원',
    desc: '전문가 및 소규모 팀 용도',
    badge: '추천',
    features: [
      { text: '이미지 서버 스토리지 저장', included: true },
      { text: '서버 스토리지 최대 40GB', included: true },
      { text: '서버 AI 모델 동작', included: true },
      { text: '브라우저 저장 포함', included: true },
    ],
    cta: '프로 시작',
    highlighted: true,
  },
  {
    id: 'business',
    name: '비즈니스',
    price: '월 0원',
    desc: '대용량 배치 작업 및 팀 협업',
    features: [
      { text: '프로 플랜 모든 기능 포함', included: true },
      { text: '서버 스토리지 최대 100GB', included: true },
      { text: '서버 AI 모델 동작', included: true },
      { text: '우선 처리 큐', included: true },
    ],
    cta: '비즈니스 시작',
    highlighted: false,
  },
];

export default function PlanPage() {
  const setPlan = useSetAtom(planAtom);
  const setUser = useSetAtom(userAtom);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[var(--bg)] px-6 py-10 overflow-y-auto">
      {/* 헤더 */}
      <div className="text-center mb-10">
        <div className="font-[var(--font-serif)] text-[26px] text-[var(--accent)] tracking-[-0.3px] mb-1">
          Batch<span className="text-[var(--text2)] text-[16px] font-[var(--font-sans)] font-light">&nbsp;Image Studio</span>
        </div>
        <p className="text-[13px] text-[var(--text2)] mt-2">요금제를 선택하세요</p>
        <p className="text-[11px] text-[var(--text3)] mt-1">언제든지 변경할 수 있습니다</p>
        <button
          onClick={() => setUser(null)}
          className="mt-3 text-[11px] text-[var(--text3)] hover:text-[var(--red)] transition-colors cursor-pointer"
        >
          로그아웃
        </button>
      </div>

      {/* 카드 */}
      <div className="flex gap-4 w-full max-w-[860px] items-stretch">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`flex-1 flex flex-col rounded-[16px] border overflow-hidden transition-all duration-200
              ${plan.highlighted
                ? 'border-[var(--accent)] bg-[var(--surface)] shadow-[0_0_40px_rgba(245,197,24,0.08)]'
                : 'border-[var(--border)] bg-[var(--surface)]'}`}
          >
            {/* 뱃지 */}
            <div className={`h-[28px] flex items-center justify-center text-[10px] font-bold tracking-[0.1em] uppercase
              ${plan.highlighted ? 'bg-[var(--accent)] text-black' : 'bg-transparent'}`}>
              {plan.badge ?? ''}
            </div>

            {/* 플랜 정보 */}
            <div className="px-5 pt-4 pb-5 border-b border-[var(--border)]">
              <div className="text-[15px] font-semibold text-[var(--text)] mb-1">{plan.name}</div>
              <div className={`text-[22px] font-bold tracking-[-0.5px] mb-1 font-[var(--font-mono)]
                ${plan.highlighted ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>
                {plan.price}
              </div>
              <div className="text-[11px] text-[var(--text3)] leading-[1.5]">{plan.desc}</div>
            </div>

            {/* 기능 목록 */}
            <div className="px-5 py-4 flex flex-col gap-2.5 flex-1">
              {plan.features.map((f, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className={`mt-[1px] shrink-0 w-4 h-4 rounded-full flex items-center justify-center
                    ${f.included ? 'bg-[var(--green)]/15 text-[var(--green)]' : 'bg-[var(--border2)] text-[var(--text3)]'}`}>
                    {f.included
                      ? <Check size={10} strokeWidth={3} />
                      : <X size={10} strokeWidth={3} />}
                  </div>
                  <span className={`text-[12px] leading-[1.5] ${f.included ? 'text-[var(--text2)]' : 'text-[var(--text3)]'}`}>
                    {f.text}
                  </span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="px-5 pb-5">
              <button
                onClick={() => setPlan(plan.id)}
                className={`w-full py-2.5 rounded-[10px] text-[13px] font-semibold transition-all cursor-pointer
                  ${plan.highlighted
                    ? 'bg-[var(--accent)] hover:bg-[var(--accent2)] text-black'
                    : 'bg-[var(--surface2)] hover:bg-[var(--border2)] text-[var(--text)] border border-[var(--border2)]'}`}
              >
                {plan.cta}
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 text-[11px] text-[var(--text3)] text-center leading-[1.8]">
        현재 요금제는 결제 없이 동작합니다.<br />
        서버 스토리지 용량 제한은 추후 적용 예정입니다.
      </p>
    </div>
  );
}
