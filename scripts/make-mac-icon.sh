#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_ICON="$ROOT_DIR/icon.png"
BUILD_DIR="$ROOT_DIR/build"
TMP_DIR="$BUILD_DIR/icon.tmp"
OUTPUT_ICNS="$BUILD_DIR/icon.icns"

if [[ ! -f "$SOURCE_ICON" ]]; then
  echo "Missing source icon: $SOURCE_ICON" >&2
  exit 1
fi

if ! command -v sips >/dev/null 2>&1; then
  echo "sips command is required on macOS" >&2
  exit 1
fi

if ! command -v tiffutil >/dev/null 2>&1; then
  echo "tiffutil command is required on macOS" >&2
  exit 1
fi

if ! command -v tiff2icns >/dev/null 2>&1; then
  echo "tiff2icns command is required on macOS" >&2
  exit 1
fi

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

for size in 16 32 48 128 256 512 1024; do
  sips -z "$size" "$size" "$SOURCE_ICON" --out "$TMP_DIR/icon_${size}.png" >/dev/null
done

tiffutil -cat \
  "$TMP_DIR/icon_16.png" \
  "$TMP_DIR/icon_32.png" \
  "$TMP_DIR/icon_48.png" \
  "$TMP_DIR/icon_128.png" \
  "$TMP_DIR/icon_256.png" \
  "$TMP_DIR/icon_512.png" \
  "$TMP_DIR/icon_1024.png" \
  -out "$TMP_DIR/icon.tiff" >/dev/null

tiff2icns "$TMP_DIR/icon.tiff" "$OUTPUT_ICNS" >/dev/null
rm -rf "$TMP_DIR"

echo "Created $OUTPUT_ICNS"
