# always-memo

A minimal macOS memo app built with Electron + Tiptap.

## Features

- Always-on-top window (`Cmd+Shift+T` to toggle)
- Drag the top bar to move the window
- Minimal rich text editing (paragraphs, bullets, bold)
- Paste images directly from clipboard (`Cmd+V`)
- Drag and drop image files into the editor
- Single memo auto-save and restore on restart

## Development

```bash
npm install
npm run dev
```

## Build and run

```bash
npm run build
npm run start
```

## Build macOS app (`.app`)

```bash
npm install
npm run dist:mac
```

Output:

- `release/mac-arm64/Always Memo.app` (Apple Silicon)

You can launch it from Finder by double-clicking the app icon.

## Test

```bash
npm run test
```

## Type check

```bash
npm run lint
```
