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
- `release/Always Memo-<version>-arm64-mac.zip`

You can launch it from Finder by double-clicking the app icon.

## CI/CD (main push auto release)

When you push to `main`, GitHub Actions automatically runs:

1. `npm ci`
2. `npm run lint`
3. `npm run test`
4. `npm run dist:mac`
5. Tag creation: `v<package-version>+build.<run_number>`
6. GitHub Release creation with:
   - `electron-builder` generated `.zip`
   - `.app` bundle archived as `.app.zip`

Notes:

- The release build is currently unsigned (no notarization).
- Workflow file: `.github/workflows/release-on-main.yml`.

## Test

```bash
npm run test
```

## Type check

```bash
npm run lint
```
