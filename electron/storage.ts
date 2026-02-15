import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ImageSaveResponse, MemoDoc, MemoRecord, SaveMemoResponse } from '../src/shared/types';

export type StoragePaths = {
  memoFilePath: string;
  imagesDirPath: string;
};

const MEMO_FILENAME = 'memo.json';
const IMAGES_DIRNAME = 'images';
const MAX_IMAGE_WIDTH = 640;
const IMAGE_ID_PATTERN = /^[a-f0-9-]+$/i;

function nowIso(): string {
  return new Date().toISOString();
}

function defaultDoc(): MemoDoc {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph'
      }
    ]
  };
}

function fallbackRecord(): MemoRecord {
  return {
    version: 1,
    updatedAt: nowIso(),
    doc: defaultDoc()
  };
}

function isMemoRecord(value: unknown): value is MemoRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<MemoRecord>;
  return candidate.version === 1 && typeof candidate.updatedAt === 'string' && !!candidate.doc;
}

async function ensureStorageDirs(paths: StoragePaths): Promise<void> {
  await mkdir(path.dirname(paths.memoFilePath), { recursive: true });
  await mkdir(paths.imagesDirPath, { recursive: true });
}

export function createStoragePaths(userDataPath: string): StoragePaths {
  return {
    memoFilePath: path.join(userDataPath, MEMO_FILENAME),
    imagesDirPath: path.join(userDataPath, IMAGES_DIRNAME)
  };
}

export function normalizeImageDimensions(width: number, height: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: 0, height: 0 };
  }

  if (width <= MAX_IMAGE_WIDTH) {
    return { width, height };
  }

  const ratio = MAX_IMAGE_WIDTH / width;
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio)
  };
}

export function isValidImageId(id: string): boolean {
  return IMAGE_ID_PATTERN.test(id);
}

export function imagePathForId(paths: StoragePaths, id: string): string {
  if (!isValidImageId(id)) {
    throw new Error('Invalid image id');
  }
  return path.join(paths.imagesDirPath, `${id}.png`);
}

export async function loadMemo(paths: StoragePaths): Promise<MemoRecord> {
  await ensureStorageDirs(paths);

  try {
    const raw = await readFile(paths.memoFilePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);

    if (!isMemoRecord(parsed)) {
      throw new Error('invalid memo schema');
    }

    return parsed;
  } catch (error: unknown) {
    const fallback = fallbackRecord();

    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return fallback;
    }

    const backupPath = `${paths.memoFilePath}.corrupt-${Date.now()}`;
    await rename(paths.memoFilePath, backupPath).catch(() => undefined);
    return fallback;
  }
}

export async function saveMemo(paths: StoragePaths, doc: MemoDoc): Promise<SaveMemoResponse> {
  await ensureStorageDirs(paths);

  const payload: MemoRecord = {
    version: 1,
    updatedAt: nowIso(),
    doc
  };

  const tempPath = `${paths.memoFilePath}.tmp`;
  await writeFile(tempPath, JSON.stringify(payload, null, 2), 'utf8');
  await rename(tempPath, paths.memoFilePath);

  return {
    ok: true,
    updatedAt: payload.updatedAt
  };
}

export async function saveImage(
  paths: StoragePaths,
  imageBuffer: Buffer,
  width: number,
  height: number
): Promise<ImageSaveResponse> {
  await ensureStorageDirs(paths);

  const id = randomUUID();
  const filename = `${id}.png`;
  const imagePath = path.join(paths.imagesDirPath, filename);
  await writeFile(imagePath, imageBuffer);

  const normalized = normalizeImageDimensions(width, height);

  return {
    id,
    src: `memo-image://${id}`,
    width: normalized.width,
    height: normalized.height
  };
}
