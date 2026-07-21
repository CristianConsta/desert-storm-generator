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
`URL.revokeObjectURL(url)` after the click. This removes Android's data-URI size ceiling
regardless of payload size — but note this alone does **not** fix iOS Safari; see the next entry.

## 2026-07-21 — Same download buttons also failed on iOS Safari, for a different reason

**What went wrong:** After the Android fix above, iOS users still reported the exact same
symptom — the app's "downloaded successfully" message appeared, but no file showed up anywhere
(Downloads, Files app, Photos). This affected **both** the map PNG and the Excel export
identically, which ruled out the Android root cause (Excel never used a `data:` URI — it was
already Blob-based via SheetJS — yet it failed the same way).

**Root cause:** Both download functions do real async work (`await ensureXLSXLoaded()` for
Excel; `await loadMapImage()` / `await loadActiveEventAvatarForHeader()` for the map) *before*
ever creating the anchor and calling `.click()`. WebKit/Safari expires "user activation" (the
flag that marks a call as a direct result of a real tap) much more aggressively than Chromium
once any async gap — a network fetch, an `<img onload>`, etc. — happens between the tap and the
triggering call. The `anchor.click()` still executes without throwing, so the app's success
message fires normally, but Safari silently discards the save instead of writing a file.

**How to avoid repeating:** For any download triggered after async work, prefer the Web Share
API (`navigator.share({ files: [file] })`) over `<a download>` — Apple's recommended path for
saving script-generated content, and it degrades gracefully via the native share sheet rather
than failing silently. Fall back to the Blob+anchor approach only when `navigator.share`/
`canShare` aren't available (desktop, older/non-Safari browsers), and treat an `AbortError` from
`share()` as a deliberate user cancellation (don't re-trigger a fallback download in that case —
any other rejection should still fall back). The shared helper
`DSDownloadController.triggerFileDownload(blob, filename)` now encapsulates this share-first/
anchor-fallback logic — reuse it (and `triggerCanvasPngDownload` for canvases specifically) for
any future file-save flow in this codebase instead of hand-rolling anchor downloads again.
