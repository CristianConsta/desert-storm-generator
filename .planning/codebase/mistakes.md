# Mistakes Log

Append-only log of validated bug fixes: what went wrong, root cause, how to avoid repeating it.
Consult before implementing new features that touch the same area.

## 2026-07-21 — Team map/assignments PNG download silently failed on Android mobile

**What went wrong:** Users on Android reported that tapping "Download Map" in the generator's
download modal did nothing — no file, no error, no console output.

**Root cause:** `js/features/generator/download-controller.js` built the exported PNG via
`canvas.toDataURL('image/png')` and assigned the resulting base64 `data:` URI directly to an
`<a download>` anchor's `href`, then called `.click()`. Android Chrome/WebView silently fails to
trigger a download when a `data:` URI anchor exceeds a few MB — no exception is thrown, the click
just does nothing. The generated map canvas (up to ~1440px wide, with a drawn map background and
dozens of gradient-filled cards) routinely produces a multi-megabyte PNG once base64-encoded.
The sibling Excel export (`downloadTeamExcel`) was unaffected because `XLSX.writeFile()` uses a
Blob + object URL internally, not a raw data URI — this contrast was the key clue.

**How to avoid repeating:** Never trigger a browser download of generated binary content (canvas
PNGs, generated files, etc.) via `element.toDataURL()` + `<a href="data:...">`. Always use
`canvas.toBlob(cb, mimeType)` → `URL.createObjectURL(blob)` for the anchor `href`, then
`URL.revokeObjectURL(url)` after the click. This is the only pattern that reliably works across
desktop, iOS Safari, and Android Chrome/WebView regardless of payload size. The shared helper
`DSDownloadController.triggerCanvasPngDownload(canvas, filename)` now encapsulates this — reuse it
for any future canvas-to-file download in this codebase instead of hand-rolling the anchor/data URI
pattern again.
