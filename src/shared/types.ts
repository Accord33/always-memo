export type MemoDoc = {
  type: 'doc';
  content?: unknown[];
};

export type MemoRecord = {
  version: 1;
  updatedAt: string;
  doc: MemoDoc;
};

export type SaveMemoResponse = {
  ok: true;
  updatedAt: string;
};

export type ImageSaveRequest = {
  buffer: ArrayBuffer;
  width: number;
  height: number;
};

export type ImageSaveResponse = {
  id: string;
  filePath: string;
  fileUrl: string;
  width: number;
  height: number;
};

export type TopState = {
  alwaysOnTop: boolean;
};

export type MemoApi = {
  loadMemo: () => Promise<MemoRecord>;
  saveMemo: (doc: MemoDoc) => Promise<SaveMemoResponse>;
  saveImageFromClipboard: (payload: ImageSaveRequest) => Promise<ImageSaveResponse>;
  toggleAlwaysOnTop: () => Promise<TopState>;
  getAlwaysOnTop: () => Promise<TopState>;
};
