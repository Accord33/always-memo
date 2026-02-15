import { useEffect, useRef, useState } from 'react';
import Image from '@tiptap/extension-image';
import { TextSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor } from '@tiptap/react';
import type { MemoDoc } from '../shared/types';

function getFirstImageFile(dataTransfer: DataTransfer | null): File | null {
  if (!dataTransfer) {
    return null;
  }

  const fromFiles = Array.from(dataTransfer.files).find((file) => file.type.startsWith('image/'));
  if (fromFiles) {
    return fromFiles;
  }

  const fromItems = Array.from(dataTransfer.items)
    .find((item) => item.type.startsWith('image/'))
    ?.getAsFile();

  return fromItems ?? null;
}

async function imageDimensions(file: File): Promise<{ width: number; height: number }> {
  const blobUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Unable to read image dimensions'));
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

function insertImageNode(
  view: EditorView,
  src: string,
  alt: string
): void {
  const imageNodeType = view.state.schema.nodes.image;
  if (!imageNodeType) {
    return;
  }

  view.dispatch(
    view.state.tr.replaceSelectionWith(
      imageNodeType.create({
        src,
        alt
      })
    )
  );
  view.focus();
}

function clipboardDebugInfo(data: DataTransfer | null): {
  hasClipboardData: boolean;
  types: string[];
  itemTypes: string[];
  fileTypes: string[];
} {
  return {
    hasClipboardData: !!data,
    types: Array.from(data?.types ?? []),
    itemTypes: Array.from(data?.items ?? []).map((item) => item.type),
    fileTypes: Array.from(data?.files ?? []).map((file) => file.type || file.name)
  };
}

export function App(): JSX.Element {
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        console.info('[paste] fired', {
          ...clipboardDebugInfo(event.clipboardData),
          selectionPos: view.state.selection.from
        });

        const imageFile = getFirstImageFile(event.clipboardData);
        if (!imageFile) {
          const plainText = event.clipboardData?.getData('text/plain') ?? '';
          const htmlText = event.clipboardData?.getData('text/html') ?? '';
          const hasTextPayload = plainText.length > 0 || htmlText.length > 0;

          if (hasTextPayload) {
            console.info('[paste] text path -> delegate default');
            return false;
          }

          event.preventDefault();
          console.info('[paste] clipboard image path -> pasteImageFromClipboard');

          void (async () => {
            try {
              const saved = await window.memo.pasteImageFromClipboard();
              insertImageNode(view, saved.src, 'Pasted image');
              setErrorMessage(null);
            } catch (error) {
              console.error('[paste] failed', error);
              const message = error instanceof Error ? error.message : 'Image paste failed';
              if (message.includes('No image in clipboard')) {
                setErrorMessage('Clipboardに画像がありません。スクショはCtrl+Cmd+Shift+4/3でコピーしてください。');
                return;
              }
              setErrorMessage(message);
            }
          })();

          return true;
        }

        event.preventDefault();
        console.info('[paste] image file path -> saveImageFromBytes');

        void (async () => {
          try {
            const { width, height } = await imageDimensions(imageFile);
            const buffer = await imageFile.arrayBuffer();
            const saved = await window.memo.saveImageFromBytes({ buffer, width, height });
            insertImageNode(view, saved.src, imageFile.name || 'Pasted image');
            setErrorMessage(null);
          } catch (error) {
            console.error('[paste] failed', error);
            const message = error instanceof Error ? error.message : 'Image paste failed';
            setErrorMessage(message);
          }
        })();

        return true;
      },
      handleDrop(view, event) {
        console.info('[drop] fired', {
          fileTypes: Array.from(event.dataTransfer?.files ?? []).map((file) => file.type || file.name),
          selectionPos: view.state.selection.from
        });

        const imageFile = getFirstImageFile(event.dataTransfer);
        if (!imageFile) {
          return false;
        }

        event.preventDefault();

        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (coords) {
          const selection = TextSelection.create(view.state.doc, coords.pos);
          view.dispatch(view.state.tr.setSelection(selection));
        }

        void (async () => {
          try {
            const { width, height } = await imageDimensions(imageFile);
            const buffer = await imageFile.arrayBuffer();
            const saved = await window.memo.saveImageFromBytes({ buffer, width, height });
            insertImageNode(view, saved.src, imageFile.name || 'Dropped image');
            setErrorMessage(null);
          } catch (error) {
            console.error('[drop] failed', error);
            const message = error instanceof Error ? error.message : 'Image drop failed';
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

      saveTimer.current = setTimeout(async () => {
        if (!lastDoc.current) {
          return;
        }

        try {
          await window.memo.saveMemo(lastDoc.current);
          setErrorMessage(null);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Save failed';
          setErrorMessage(message);
        }
      }, 500);
    }
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') {
        const active = document.activeElement as HTMLElement | null;
        console.info('[key] paste shortcut', {
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          tagName: active?.tagName ?? null,
          className: active?.className ?? null
        });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

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
        setAlwaysOnTop(topState.alwaysOnTop);
      } catch (error) {
        if (disposed) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Initialization failed';
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

  return (
    <main className="app-shell">
      <header className="toolbar">
        <div className="drag-hint">Always Memo</div>
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
