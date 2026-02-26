import type { JSONContent } from '@tiptap/core';

export type MemoDoc = JSONContent;

export type MemoRecord = {
  version: 1;
  updatedAt: string;
  doc: MemoDoc;
};

export type SaveMemoResponse = {
  ok: true;
  updatedAt: string;
};

export type ImageSaveResponse = {
  id: string;
  src: string;
  width: number;
  height: number;
};

export type ImageSaveRequest = {
  buffer: ArrayBuffer;
  width: number;
  height: number;
};

export type TopState = {
  alwaysOnTop: boolean;
};

export type UpdateState = 'idle' | 'checking' | 'available' | 'not_available' | 'error';

export type UpdateStatusPayload = {
  state: UpdateState;
  currentVersion: string;
  latestVersion?: string;
  releaseUrl?: string;
  message?: string;
};

export type MemoApi = {
  loadMemo: () => Promise<MemoRecord>;
  saveMemo: (doc: MemoDoc) => Promise<SaveMemoResponse>;
  saveImageFromBytes: (payload: ImageSaveRequest) => Promise<ImageSaveResponse>;
  pasteImageFromClipboard: () => Promise<ImageSaveResponse>;
  toggleAlwaysOnTop: () => Promise<TopState>;
  getAlwaysOnTop: () => Promise<TopState>;
  getUpdateStatus: () => Promise<UpdateStatusPayload>;
  onUpdateStatus: (listener: (payload: UpdateStatusPayload) => void) => () => void;
  openLatestRelease: () => Promise<void>;
};
