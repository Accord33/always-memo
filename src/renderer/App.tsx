import { useEffect, useMemo, useRef, useState } from 'react';
import Image from '@tiptap/extension-image';
import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor } from '@tiptap/react';
import type { MemoDoc } from '../shared/types';

function formatUpdatedAt(value: string | null): string {
  if (!value) {
    return 'Not saved yet';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Saved';
  }

  return `Saved ${date.toLocaleString()}`;
}

async function imageDimensions(file: File): Promise<{ width: number; height: number }> {
  const blobUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Unable to load pasted image'));
      img.src = blobUrl;
    });

    return {
      width: image.naturalWidth,
      height: image.naturalHeight
    };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export function App(): JSX.Element {
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [status, setStatus] = useState('Loading...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDoc = useRef<MemoDoc | null>(null);

  const editor = useEditor({
    extensions: [StarterKit, Image],
    content: {
      type: 'doc',
      content: [{ type: 'paragraph' }]
    },
    editorProps: {
      attributes: {
        class: 'memo-editor'
      },
      handlePaste(view, event) {
        const items = Array.from(event.clipboardData?.items ?? []);
        const imageItem = items.find((item) => item.type.startsWith('image/'));

        if (!imageItem) {
          return false;
        }

        const file = imageItem.getAsFile();
        if (!file) {
          return false;
        }

        void (async () => {
          try {
            const { width, height } = await imageDimensions(file);
            const buffer = await file.arrayBuffer();
            const saved = await window.memo.saveImageFromClipboard({
              buffer,
              width,
              height
            });
            const imageNodeType = view.state.schema.nodes.image;
            if (!imageNodeType) {
              return;
            }

            view.dispatch(
              view.state.tr.replaceSelectionWith(
                imageNodeType.create({
                  src: saved.fileUrl,
                  alt: 'Pasted image'
                })
              )
            );
            view.focus();
            setErrorMessage(null);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Image paste failed';
            setErrorMessage(message);
          }
        })();

        return true;
      }
    },
    onUpdate({ editor: currentEditor }) {
      const doc = currentEditor.getJSON() as MemoDoc;
      lastDoc.current = doc;

      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }

      setStatus('Saving...');

      saveTimer.current = setTimeout(async () => {
        if (!lastDoc.current) {
          return;
        }

        try {
          const result = await window.memo.saveMemo(lastDoc.current);
          setUpdatedAt(result.updatedAt);
          setStatus('Saved');
          setErrorMessage(null);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Save failed';
          setStatus('Save failed');
          setErrorMessage(message);
        }
      }, 500);
    }
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    let disposed = false;

    void (async () => {
      try {
        const [memo, topState] = await Promise.all([window.memo.loadMemo(), window.memo.getAlwaysOnTop()]);

        if (disposed) {
          return;
        }

        editor.commands.setContent(memo.doc, false);
        setUpdatedAt(memo.updatedAt);
        setAlwaysOnTop(topState.alwaysOnTop);
        setStatus('Ready');
      } catch (error) {
        if (disposed) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Initialization failed';
        setStatus('Error');
        setErrorMessage(message);
      }
    })();

    return () => {
      disposed = true;
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [editor]);

  const updatedAtText = useMemo(() => formatUpdatedAt(updatedAt), [updatedAt]);

  return (
    <main className="app-shell">
      <header className="toolbar">
        <div className="status">
          <span className="status-main">{status}</span>
          <span className="status-sub">{updatedAtText}</span>
        </div>
        <button
          className="top-toggle"
          type="button"
          onClick={async () => {
            const next = await window.memo.toggleAlwaysOnTop();
            setAlwaysOnTop(next.alwaysOnTop);
          }}
        >
          {alwaysOnTop ? 'Top: On' : 'Top: Off'}
        </button>
      </header>

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

      <section className="editor-wrap">
        <EditorContent editor={editor} />
      </section>
    </main>
  );
}
