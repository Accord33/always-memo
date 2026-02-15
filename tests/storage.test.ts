import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createStoragePaths, imagePathForId, loadMemo, normalizeImageDimensions, saveImage, saveMemo } from '../electron/storage';
import type { MemoDoc } from '../src/shared/types';

const tempRoots: string[] = [];

async function tempPaths() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'always-memo-test-'));
  tempRoots.push(root);
  return createStoragePaths(root);
}

afterEach(async () => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
  }
});

describe('storage', () => {
  it('returns default document when no memo exists', async () => {
    const paths = await tempPaths();
    const memo = await loadMemo(paths);

    expect(memo.version).toBe(1);
    expect(memo.doc.type).toBe('doc');
  });

  it('saves and loads memo content', async () => {
    const paths = await tempPaths();
    const doc: MemoDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'hello' }]
        }
      ]
    };

    await saveMemo(paths, doc);
    const loaded = await loadMemo(paths);

    expect(loaded.doc).toEqual(doc);
  });

  it('backs up corrupt memo file and starts from fallback', async () => {
    const paths = await tempPaths();
    await writeFile(paths.memoFilePath, '{broken-json', 'utf8');

    const loaded = await loadMemo(paths);
    const files = await readdir(path.dirname(paths.memoFilePath));

    expect(loaded.doc.type).toBe('doc');
    expect(files.some((file) => file.startsWith('memo.json.corrupt-'))).toBe(true);
  });

  it('stores pasted image on disk', async () => {
    const paths = await tempPaths();
    const content = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

    const saved = await saveImage(paths, content, 1400, 700);
    const fileContent = await readFile(imagePathForId(paths, saved.id));

    expect(fileContent.equals(content)).toBe(true);
    expect(saved.src).toBe(`memo-image://${saved.id}`);
    expect(saved.width).toBe(640);
    expect(saved.height).toBe(320);
  });

  it('normalizes dimensions only when image is too wide', () => {
    expect(normalizeImageDimensions(300, 150)).toEqual({ width: 300, height: 150 });
    expect(normalizeImageDimensions(1200, 600)).toEqual({ width: 640, height: 320 });
  });
});
