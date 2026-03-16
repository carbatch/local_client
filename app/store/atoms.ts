import { atomWithStorage } from 'jotai/utils';

// OpenAI API 키 — localStorage에 저장, 서버로 전송되지 않음
export const apiKeyAtom = atomWithStorage<string>('carbatch_apikey', '');
