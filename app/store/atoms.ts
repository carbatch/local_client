import { atomWithStorage } from 'jotai/utils';

// OpenAI API 키 — localStorage에 저장, 서버로 전송되지 않음
export const apiKeyAtom = atomWithStorage<string>('carbatch_apikey', '');

// 로그인 유저 정보
export interface User {
  token: string;
  userId: string;
  username: string;
  email: string;
}

export const userAtom = atomWithStorage<User | null>('carbatch_user', null);

// 요금제
export type Plan = 'free' | 'pro' | 'business';
export const planAtom = atomWithStorage<Plan | null>('carbatch_plan', null);