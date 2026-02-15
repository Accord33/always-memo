import { contextBridge, ipcRenderer } from 'electron';
import type { ImageSaveRequest, MemoApi, MemoDoc } from '../src/shared/types';

const api: MemoApi = {
  loadMemo: async () => ipcRenderer.invoke('memo:load'),
  saveMemo: async (doc: MemoDoc) => ipcRenderer.invoke('memo:save', doc),
  saveImageFromBytes: async (payload: ImageSaveRequest) => ipcRenderer.invoke('image:saveBytes', payload),
  pasteImageFromClipboard: async () => ipcRenderer.invoke('image:pasteFromClipboard'),
  toggleAlwaysOnTop: async () => ipcRenderer.invoke('window:toggleAlwaysOnTop'),
  getAlwaysOnTop: async () => ipcRenderer.invoke('window:getAlwaysOnTop')
};

contextBridge.exposeInMainWorld('memo', api);
