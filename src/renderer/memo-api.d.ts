import type { MemoApi } from '../shared/types';

declare global {
  interface Window {
    memo: MemoApi;
  }
}

export {};
