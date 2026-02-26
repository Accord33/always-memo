import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { app, BrowserWindow, clipboard, ipcMain, Menu, protocol, shell } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import type { ImageSaveRequest, MemoDoc, TopState, UpdateStatusPayload } from '../src/shared/types';
import { createStoragePaths, imagePathForId, loadMemo, saveImage, saveMemo } from './storage';

let mainWindow: BrowserWindow | null = null;
const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const UPDATE_STATUS_CHANNEL = 'app:updateStatus';
const RELEASE_API_URL = 'https://api.github.com/repos/sakabe/always-memo/releases/latest';
const RELEASE_URL_PATTERN = /^https:\/\/github\.com\/sakabe\/always-memo\/releases\/tag\/.+/;

let latestUpdateStatus: UpdateStatusPayload = {
  state: 'idle',
  currentVersion: app.getVersion()
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'memo-image',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true
    }
  }
]);

function getTopState(): TopState {
  return {
    alwaysOnTop: !!mainWindow?.isAlwaysOnTop()
  };
}

function toggleAlwaysOnTop(): TopState {
  if (!mainWindow) {
    return { alwaysOnTop: false };
  }

  const nextValue = !mainWindow.isAlwaysOnTop();
  mainWindow.setAlwaysOnTop(nextValue);
  return { alwaysOnTop: nextValue };
}

function createAppMenu(): void {
  const template: MenuItemConstructorOptions[] = [];

  if (process.platform === 'darwin') {
    template.push({ role: 'appMenu' });
  }

  template.push({ role: 'editMenu' });

  template.push({
    label: 'Window',
    submenu: [
      {
        label: 'Toggle Always On Top',
        accelerator: 'CommandOrControl+Shift+T',
        click: () => {
          toggleAlwaysOnTop();
        }
      },
      { type: 'separator' },
      { role: 'minimize' },
      { role: 'close' }
    ]
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function setZoomFactor(value: number): void {
  if (!mainWindow) {
    return;
  }

  mainWindow.webContents.setZoomFactor(clampZoom(value));
}

function changeZoomFactor(delta: number): void {
  if (!mainWindow) {
    return;
  }

  const current = mainWindow.webContents.getZoomFactor();
  setZoomFactor(current + delta);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 640,
    minWidth: 340,
    minHeight: 360,
    title: 'Always Memo',
    alwaysOnTop: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    const indexPath = path.join(app.getAppPath(), 'dist/renderer/index.html');
    void mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || (!input.control && !input.meta)) {
      return;
    }

    const key = input.key.toLowerCase();

    if (key === '0') {
      event.preventDefault();
      setZoomFactor(1);
      return;
    }

    if (key === '+' || key === '=' || key === 'add') {
      event.preventDefault();
      changeZoomFactor(ZOOM_STEP);
      return;
    }

    if (key === '-' || key === '_' || key === 'subtract') {
      event.preventDefault();
      changeZoomFactor(-ZOOM_STEP);
    }
  });
}

function imageIdFromRequestUrl(requestUrl: string): string | null {
  try {
    const parsed = new URL(requestUrl);
    const id = parsed.host || parsed.pathname.replace(/^\/+/, '');
    return id || null;
  } catch {
    return null;
  }
}

function parseVersion(input: string): [number, number, number] | null {
  const match = input.trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) {
    return null;
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersions(a: string, b: string): number {
  const parsedA = parseVersion(a);
  const parsedB = parseVersion(b);

  if (!parsedA || !parsedB) {
    return 0;
  }

  for (let i = 0; i < 3; i += 1) {
    if (parsedA[i] > parsedB[i]) {
      return 1;
    }
    if (parsedA[i] < parsedB[i]) {
      return -1;
    }
  }

  return 0;
}

function versionFromTag(tag: string): string | null {
  const trimmed = tag.trim();
  const withoutPrefix = trimmed.startsWith('v') ? trimmed.slice(1) : trimmed;
  return parseVersion(withoutPrefix) ? withoutPrefix : null;
}

function pushUpdateStatus(payload: UpdateStatusPayload): void {
  latestUpdateStatus = payload;
  mainWindow?.webContents.send(UPDATE_STATUS_CHANNEL, payload);
}

async function checkForUpdatesOnStartup(): Promise<void> {
  const currentVersion = app.getVersion();

  if (!app.isPackaged) {
    latestUpdateStatus = {
      state: 'idle',
      currentVersion,
      message: 'Update check is disabled in development.'
    };
    return;
  }

  pushUpdateStatus({
    state: 'checking',
    currentVersion
  });

  try {
    const response = await fetch(RELEASE_API_URL, {
      headers: {
        accept: 'application/vnd.github+json',
        'user-agent': 'always-memo-update-check'
      }
    });

    if (!response.ok) {
      throw new Error(`Release API returned ${response.status}`);
    }

    const release = (await response.json()) as {
      tag_name?: string;
      html_url?: string;
    };

    const latestVersion = versionFromTag(release.tag_name ?? '');
    if (!latestVersion) {
      throw new Error('Failed to parse latest release version.');
    }

    if (compareVersions(latestVersion, currentVersion) > 0) {
      pushUpdateStatus({
        state: 'available',
        currentVersion,
        latestVersion,
        releaseUrl: release.html_url
      });
      return;
    }

    pushUpdateStatus({
      state: 'not_available',
      currentVersion,
      latestVersion
    });
  } catch (error) {
    pushUpdateStatus({
      state: 'error',
      currentVersion,
      message: error instanceof Error ? error.message : 'Failed to check updates.'
    });
  }
}

app.whenReady().then(() => {
  const storagePaths = createStoragePaths(app.getPath('userData'));

  protocol.handle('memo-image', async (request) => {
    const imageId = imageIdFromRequestUrl(request.url);
    if (!imageId) {
      return new Response('Bad request', { status: 400 });
    }

    let imagePath: string;
    try {
      imagePath = imagePathForId(storagePaths, imageId);
    } catch {
      return new Response('Bad request', { status: 400 });
    }

    try {
      const imageBuffer = await readFile(imagePath);
      return new Response(imageBuffer, {
        status: 200,
        headers: { 'content-type': 'image/png' }
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });

  createAppMenu();
  createWindow();
  void checkForUpdatesOnStartup();

  ipcMain.handle('memo:load', async () => loadMemo(storagePaths));

  ipcMain.handle('memo:save', async (_event, doc: MemoDoc) => saveMemo(storagePaths, doc));

  ipcMain.handle('image:saveBytes', async (_event, payload: ImageSaveRequest) => {
    const imageBuffer = Buffer.from(payload.buffer);
    return saveImage(storagePaths, imageBuffer, payload.width, payload.height);
  });

  ipcMain.handle('image:pasteFromClipboard', async () => {
    const image = clipboard.readImage();
    if (image.isEmpty()) {
      throw new Error('No image in clipboard');
    }

    const size = image.getSize();
    const imageBuffer = image.toPNG();
    return saveImage(storagePaths, imageBuffer, size.width, size.height);
  });

  ipcMain.handle('window:toggleAlwaysOnTop', async () => toggleAlwaysOnTop());

  ipcMain.handle('window:getAlwaysOnTop', async () => getTopState());

  ipcMain.handle('app:getUpdateStatus', async () => latestUpdateStatus);

  ipcMain.handle('app:openLatestRelease', async () => {
    const releaseUrl = latestUpdateStatus.releaseUrl;
    if (!releaseUrl || !RELEASE_URL_PATTERN.test(releaseUrl)) {
      throw new Error('No valid release URL is available.');
    }
    await shell.openExternal(releaseUrl);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
