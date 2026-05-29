# Event Wiki — Implementation Plan

## Summary

Add a per-user/per-alliance wiki page for each event. Each authenticated user (or alliance) can create, edit, and publish a rich-text strategy wiki for any event. Published wikis are publicly readable (no auth required). Uses Quill.js (vendored) as the rich text editor with image and video embed support.

---

## Phase 1: Foundation — Firestore paths, rules, and vendor setup

### 1.1 Vendor Quill.js
- Download Quill.js 2.x UMD build (~48KB min) → `vendor/quill.min.js`
- Download Quill Snow CSS theme → `vendor/quill.snow.css`
- Update `vendor/README.txt` with Quill version info

### 1.2 Add Firestore path builders (`firebase-infra.js`)
- Add subcollection constant: `GAME_SOLO_EVENT_WIKI_SUBCOLLECTION = 'event_wiki'`
- Add `getSoloEventWikiCollectionRef(gameId, uid)` → `games/{gameId}/soloplayers/{uid}/event_wiki`
- Add `getSoloEventWikiDocRef(gameId, uid, eventId)` → `.doc(eventId)`
- Add `getAllianceEventWikiCollectionRef(gameId, allianceId)` → `games/{gameId}/alliances/{allianceId}/event_wiki`
- Add `getAllianceEventWikiDocRef(gameId, allianceId, eventId)` → `.doc(eventId)`
- Export all new functions in `DSFirebaseInfra`

### 1.3 Add Firestore security rules (`firestore.rules`)
- Under `match /games/{gameId}/soloplayers/{uid}`:
  - Add `match /event_wiki/{eventId}`:
    - `allow read: if true;` (public reads for published wikis)
    - `allow write: if isSelf(uid);` (only owner can write)
- Under `match /games/{gameId}/alliances/{allianceId}`:
  - Add `match /event_wiki/{eventId}`:
    - `allow read: if true;` (public reads)
    - `allow write: if isAllianceActor(get(/databases/$(database)/documents/games/$(gameId)/alliances/$(allianceId)).data);` (any alliance member can write)

---

## Phase 2: Backend — Wiki CRUD in FirebaseManager & FirebaseService

### 2.1 Add wiki gateway (`js/shared/data/firebase-wiki-gateway.js`)
New IIFE module following existing gateway pattern. Methods:
- `loadWiki(eventId, context)` — reads wiki doc from solo or alliance path based on playerSource
- `loadWikiByPath(gameId, uid, allianceId, eventId)` — reads wiki by explicit path params (for public page)
- `saveWiki(eventId, content, context)` — writes/updates wiki doc
- `deleteWiki(eventId, context)` — deletes wiki doc
- `getWikiUrl(eventId, context)` — builds the shareable URL with correct params

### 2.2 Wire into FirebaseManager (`firebase-module.js`)
- Add wiki methods that delegate to gateway:
  - `loadEventWiki(eventId, context)`
  - `saveEventWiki(eventId, wikiData, context)`
  - `deleteEventWiki(eventId, context)`
  - `getEventWikiUrl(eventId, context)` — builds URL with gameId + uid or allianceId
- Resolve path based on `getPlayerSource()`:
  - `'personal'` → `getSoloEventWikiDocRef(gameId, uid, eventId)`
  - `'alliance'` → `getAllianceEventWikiDocRef(gameId, allianceId, eventId)`

### 2.3 Expose via FirebaseService adapter (`js/services/firebase-service.js`)
- Add `loadEventWiki`, `saveEventWiki`, `deleteEventWiki`, `getEventWikiUrl`
- Follow existing `withManager(fn, fallback)` pattern

---

## Phase 3: Standalone wiki page — HTML, CSS, JS

### 3.1 Create `event-wiki.html`
Standalone page following `player-update.html` pattern:
- Loads: `theme-variables.css`, `event-wiki.css`
- Loads (defer): Firebase SDKs, `firebase-config.js`, `translations.js`, `js/core/i18n.js`, `vendor/quill.min.js`, `js/event-wiki/event-wiki.js`
- Loads: `vendor/quill.snow.css` (stylesheet)
- CSP: same as `player-update.html` but with `frame-src https://www.youtube.com https://player.vimeo.com https://accounts.google.com` for video embeds
- Inline theme script (same pattern as player-update.html)
- Language switcher
- URL params: `?game={gameId}&event={eventId}&uid={uid}` (personal) or `?game={gameId}&event={eventId}&aid={allianceId}` (alliance)

**HTML structure:**
```
#wikiRoot
  .wiki-header
    .wiki-game-badge          ← game name
    .wiki-event-info
      img.wiki-event-logo     ← event logo
      h1.wiki-event-name      ← event name
  .wiki-auth-bar              ← sign-in button (hidden if signed in), edit/share buttons (if authorized)
  #wikiContent                ← rendered HTML content (read mode)
  #wikiEditor                 ← Quill editor container (edit mode, hidden by default)
  #wikiToolbar                ← Quill toolbar (edit mode)
  .wiki-actions               ← Save/Cancel/Delete buttons (edit mode)
  #wikiEmpty                  ← "No wiki yet" message + Create button
  #wikiLoading                ← loading spinner
  #wikiError                  ← error state
```

### 3.2 Create `event-wiki.css`
Mobile-first styling:
- Content max-width: `min(760px, 92vw)` centered
- Uses `--ds-*` tokens from `theme-variables.css`
- Header: flex layout with logo (64px mobile, 96px desktop) + event name
- Game badge: small pill with game name
- Content area: clean typography, proper spacing for headings/paragraphs/lists
- Quill editor: themed to match app design tokens (override Quill Snow defaults)
- Images in content: `max-width: 100%; border-radius: 8px`
- Video embeds: responsive `padding-bottom: 56.25%` wrapper
- Auth bar: sticky top with sign-in/edit buttons
- Breakpoints: 480px (phone), 768px (tablet)
- Touch targets: min-height 44px
- Safe-area insets

### 3.3 Create `js/event-wiki/event-wiki.js`
IIFE module — page logic:

**Init flow:**
1. Parse URL params (game, event, uid/aid)
2. Init i18n (language switcher)
3. Init Firebase (same SDK pattern as player-update.js)
4. Load event metadata — fetch event name + logo from event registry or wiki doc itself
5. Render header (game name, event name, logo)
6. Load wiki doc from Firestore (using explicit path from URL params)
7. If wiki exists → render content in `#wikiContent`
8. If wiki doesn't exist → show `#wikiEmpty`
9. Check auth state → if signed in and authorized, show Edit button

**Auth flow:**
- Google sign-in button (not anonymous — needs real auth for write access)
- On sign-in: check if user is the owner (uid match) or alliance member (aid match)
- If authorized: show Edit/Delete buttons
- If not authorized: read-only view

**Edit flow:**
1. Click "Edit" → hide `#wikiContent`, show `#wikiEditor`
2. Initialize Quill editor with existing content (or empty)
3. Quill toolbar: Bold, Italic, Underline, Headings (H2, H3), Lists (ordered/unordered), Link, Image upload, Video embed, Blockquote, Code block
4. Image upload: file input → FileReader → canvas resize (reuse DSEventsImageProcessor pattern, max 800px width, JPEG 0.8 quality) → insert as base64 data URL into editor
5. Video embed: prompt for URL → validate YouTube/Vimeo → insert iframe via Quill video module
6. Click "Save" → extract HTML from Quill → write to Firestore with metadata (lastEditedBy, lastEditedAt)
7. Click "Cancel" → discard changes → switch back to read mode
8. Click "Delete" → confirm → delete Firestore doc → show empty state

**Firestore document schema:**
```javascript
{
  eventId: string,
  eventName: string,
  gameId: string,
  gameName: string,
  logoDataUrl: string,           // cached event logo
  content: string,               // HTML string from Quill
  published: true,               // always true when saved
  createdBy: string,             // uid
  createdByName: string,         // display name
  createdAt: Timestamp,
  lastEditedBy: string,          // uid
  lastEditedByName: string,      // display name
  lastEditedAt: Timestamp,
  ownerType: 'personal'|'alliance',
}
```

---

## Phase 4: Main app integration — Wiki link in event selector

### 4.1 Update event list UI (`js/ui/event-list-ui.js`)
- Add a "Wiki" icon button inside each event list item (after the text wrap, before appending to list)
- The button opens `event-wiki.html` in a new tab with correct URL params
- Add `onGetWikiUrl` callback to `renderEventsList` options — returns the wiki URL for a given eventId
- The button uses `event.stopPropagation()` to prevent triggering event selection
- Render as a small icon link: `<a class="events-list-wiki-link" href="..." target="_blank" rel="noopener" title="View Wiki">` with an SVG book/document icon

### 4.2 Wire wiki URL generation
- In `events-registry-controller.js` where `renderEventsList()` is called, pass `onGetWikiUrl` callback
- This callback calls `FirebaseService.getEventWikiUrl(eventId)` which builds the URL based on current playerSource (personal uid or alliance id)

### 4.3 Add CSS for wiki link (`styles.css`)
- `.events-list-wiki-link` — small icon positioned at right side of event list item
- Hover/focus states using `--ds-*` tokens
- Mobile: adequate touch target (44px)

---

## Phase 5: i18n — Translations for all 6 languages

### 5.1 Add translation keys (`translations.js`)
Add to ALL 6 languages (EN, FR, DE, IT, KO, RO):

- `wiki_page_title` — "Event Wiki"
- `wiki_loading` — "Loading wiki..."
- `wiki_empty_title` — "No Wiki Yet"
- `wiki_empty_description` — "No strategy wiki has been published for this event."
- `wiki_create_btn` — "Create Wiki"
- `wiki_edit_btn` — "Edit"
- `wiki_delete_btn` — "Delete Wiki"
- `wiki_save_btn` — "Save"
- `wiki_cancel_btn` — "Cancel"
- `wiki_sign_in_prompt` — "Sign in to edit this wiki"
- `wiki_sign_in_btn` — "Sign in with Google"
- `wiki_delete_confirm` — "Are you sure you want to delete this wiki?"
- `wiki_save_success` — "Wiki saved successfully"
- `wiki_save_error` — "Failed to save wiki"
- `wiki_load_error` — "Failed to load wiki"
- `wiki_not_authorized` — "You are not authorized to edit this wiki"
- `wiki_last_edited_by` — "Last edited by {name}"
- `wiki_share_btn` — "Share Link"
- `wiki_link_copied` — "Wiki link copied to clipboard"
- `events_manager_wiki_link` — "Wiki"

---

## Phase 6: Bundle, deploy, and tests

### 6.1 Update bundle entry (`js/main-entry.js`)
- Add `require('../js/shared/data/firebase-wiki-gateway.js')` in the gateway section
- Note: `event-wiki.js` is NOT bundled (standalone page script)

### 6.2 Update CI/CD deploy (`.github/workflows/pages.yml`)
- **Sparse checkout**: Add `event-wiki.html`, `event-wiki.css`
- **Stage deploy files**: Add `event-wiki.html event-wiki.css` to the `cp` command
- Vendor files (`vendor/quill.min.js`, `vendor/quill.snow.css`) are already covered by `cp -r vendor _site/vendor`

### 6.3 Add tests
- `tests/event-wiki.core.test.js` — unit tests for wiki gateway logic (path resolution, data validation)
- `tests/i18n-keys.core.test.js` — already enforces key parity; new keys auto-checked
- Verify Firestore rules test coverage for new wiki paths if feasible

---

## Phase 7: Documentation

### 7.1 Update CLAUDE.md
- Add `event-wiki.html`, `event-wiki.css`, `js/event-wiki/` to Directory Layout
- Add `event_wiki` to Firestore Data Model section
- Add `DSEventWikiGateway` to Key Window Globals
- Update CI deploy files list note

---

## File Summary

### New files (7):
| File | Purpose |
|------|---------|
| `event-wiki.html` | Standalone public wiki page |
| `event-wiki.css` | Mobile-first wiki styling |
| `js/event-wiki/event-wiki.js` | Wiki page logic (IIFE) |
| `js/shared/data/firebase-wiki-gateway.js` | Wiki Firestore gateway (IIFE) |
| `vendor/quill.min.js` | Vendored Quill.js rich text editor |
| `vendor/quill.snow.css` | Vendored Quill Snow theme CSS |
| `tests/event-wiki.core.test.js` | Wiki unit tests |

### Modified files (8):
| File | Change |
|------|--------|
| `firebase-infra.js` | Add wiki path builders |
| `firebase-module.js` | Add wiki CRUD methods |
| `js/services/firebase-service.js` | Expose wiki methods |
| `js/ui/event-list-ui.js` | Add wiki link to event list items |
| `firestore.rules` | Add wiki read/write rules |
| `translations.js` | Add wiki i18n keys (6 languages) |
| `js/main-entry.js` | Require wiki gateway |
| `.github/workflows/pages.yml` | Add wiki files to deploy |

### Unchanged (no new tokens needed):
| File | Reason |
|------|--------|
| `styles.css` | Wiki link CSS added here (uses existing tokens) |
| `theme-variables.css` | Existing tokens sufficient |
