import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { app, BrowserWindow, clipboard, ipcMain, Menu, protocol } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import type { ImageSaveRequest, MemoDoc, TopState } from '../src/shared/types';
import { createStoragePaths, imagePathForId, loadMemo, saveImage, saveMemo } from './storage';

let mainWindow: BrowserWindow | null = null;

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
