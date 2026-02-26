import { contextBridge, ipcRenderer } from 'electron';
import type { ImageSaveRequest, MemoApi, MemoDoc, UpdateStatusPayload } from '../src/shared/types';

const UPDATE_STATUS_CHANNEL = 'app:updateStatus';

const api: MemoApi = {
  loadMemo: async () => ipcRenderer.invoke('memo:load'),
  saveMemo: async (doc: MemoDoc) => ipcRenderer.invoke('memo:save', doc),
  saveImageFromBytes: async (payload: ImageSaveRequest) => ipcRenderer.invoke('image:saveBytes', payload),
  pasteImageFromClipboard: async () => ipcRenderer.invoke('image:pasteFromClipboard'),
  toggleAlwaysOnTop: async () => ipcRenderer.invoke('window:toggleAlwaysOnTop'),
  getAlwaysOnTop: async () => ipcRenderer.invoke('window:getAlwaysOnTop'),
  getUpdateStatus: async () => ipcRenderer.invoke('app:getUpdateStatus'),
  onUpdateStatus: (listener: (payload: UpdateStatusPayload) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: UpdateStatusPayload) => {
      listener(payload);
    };
    ipcRenderer.on(UPDATE_STATUS_CHANNEL, wrapped);
    return () => ipcRenderer.removeListener(UPDATE_STATUS_CHANNEL, wrapped);
  },
  openLatestRelease: async () => ipcRenderer.invoke('app:openLatestRelease')
};

contextBridge.exposeInMainWorld('memo', api);
