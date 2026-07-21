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

## 2026-07-21 — Map download regressed to a silent hang after the Android fix, on desktop Safari

**What went wrong:** After the Android fix above switched `triggerCanvasPngDownload` from
`canvas.toDataURL()` to `canvas.toBlob()`, a live repro on desktop Safari showed *zero* console
output past the map-image-loaded log — not even the diagnostic logs added inside
`triggerFileDownload()`. No exception, no success message, nothing: the whole download promise
was hanging forever.

**Root cause:** `HTMLCanvasElement.toBlob()` has long-standing WebKit bug reports of silently
never invoking its callback for some canvases (bugs.webkit.org has multiple reports of this,
particularly for larger canvases). Since `triggerFileDownload()` is only reachable from inside
that callback, and the callback never ran, the `await triggerCanvasPngDownload(...)` in
`generateMap()`/`generateMapWithoutBackground()` just hung indefinitely — worse than the
original bug, since now not even the (misleading) success message appeared.

**How to avoid repeating:** Don't trust `canvas.toBlob()` as the source of truth for
canvas-to-file export in code that must work on Safari — its callback isn't guaranteed to fire.
`canvas.toDataURL()` is synchronous and always completes (no async callback to hang on); decode
it to a Blob manually (`DSDownloadController.dataUrlToBlob(dataUrl)`, base64 → `Uint8Array` →
`Blob`) instead of depending on `toBlob()`. This keeps the Android fix (never put a large
`data:` URI directly in an anchor `href`) while removing the new Safari hang risk entirely.
When debugging a "nothing happens, no error" report on WebKit, remember the success path may
log nothing at all — add explicit diagnostic logging at each branch of the flow rather than
assuming silence means either success or a caught exception.

## 2026-07-21 — New users hit Firestore connection errors on first load, needing a refresh

**What went wrong:** New users (and a repro on desktop Safari) saw `Fetch API cannot load
https://firestore.googleapis.com/.../Listen/channel?... due to access control checks` and a
matching `Write/channel` error in the console on first page load. The app recovered after a few
manual refreshes, but this happened to every new user.

**Root cause:** `firebase-module.js`'s `init()` called `db = firebase.firestore()` with zero
`.settings()` configuration. Firestore's JS SDK defaults to a WebChannel streaming transport for
its realtime Listen/Write channels; Safari (and some corporate proxies/VPNs/ad-blocking setups)
can fail that initial streaming handshake outright, and the SDK has to detect the failure and
fall back on a subsequent attempt — which is why reloading "fixed" it. This is a widely
documented Firebase-JS-SDK + Safari interaction, not specific to this app's code.

**How to avoid repeating:** Call `db.settings({ experimentalAutoDetectLongPolling: true })`
immediately after `firebase.firestore()` and before any other Firestore operation. This makes
the SDK detect streaming-hostile environments up front and use long-polling from the very first
load instead of failing the WebChannel handshake first. Covered by
`tests/firebase-manager.events.integration.test.js` — any test file that mocks
`firebase.firestore()` for `init()` must include a `settings: () => {}` stub on the returned
object or `init()`'s try/catch will silently swallow the resulting TypeError and return `false`.

## 2026-07-21 — Double-clicking a download button could race two navigator.share() calls

**What went wrong:** A live repro captured the console logging `navigator.share() cancelled by
user` twice in a row for the same map PNG filename before a single share sheet had actually been
dismissed — with a screenshot showing the share sheet still open and interactive at the time.

**Root cause:** The Web Share API only allows one `navigator.share()` call in flight per page;
`openDownloadModal()`'s buttons had no guard against a second click while the first download was
still running (generating the canvas/workbook, then awaiting `navigator.share()`). Since there
was also no visible "in progress" affordance on the buttons, a user unsure whether their first
click registered would naturally click again — firing a second `triggerFileDownload()` whose
`navigator.share()` call races the first, and Safari reports the resulting conflict as an
`AbortError`, which our code (reasonably, but incorrectly here) interpreted as "user cancelled".

**How to avoid repeating:** Any button that kicks off an async, non-reentrant browser API
(Web Share, WebUSB/WebBluetooth pickers, `showSaveFilePicker`, etc.) needs a busy-guard:
disable the button for the duration of the in-flight promise and ignore clicks while disabled.
`DSDownloadController.wireGuardedDownloadButton(button, handler)` now encapsulates this — reuse
it for the map and Excel download buttons (already wired) and any future one-at-a-time async
button handler in this codebase.
