# Platform UX Redesign Plan

## Problem Statement
The platform suffers from information overload on each page, difficult navigation, and poor discoverability of features. Users see too many options simultaneously, making the interface feel overwhelming.

---

## Phase 1: Navigation Restructure (Reduce navigation complexity)

### 1A. Desktop — Grouped sidebar navigation
Replace the dropdown menu panel with a persistent left sidebar (collapsible to icons-only):

```
WORKSPACE
  [icon] Generator         ← primary action
  [icon] Players           ← data management
  [icon] Event History     ← records/review

CONFIGURE
  [icon] Events Manager    ← setup
  [icon] Alliance          ← collaboration

[bottom]
  [icon] Settings
  [icon] Support
  [icon] Sign Out
```

**Changes:**
- `index.html`: Replace `#navMenuPanel` dropdown with a `<nav id="appSidebar">` element
- `styles.css`: Add sidebar layout (width 220px expanded, 56px collapsed), with `.container` offset
- `js/shell/navigation/navigation-controller.js`: Update `syncMenuVisibility()` → sidebar toggle logic
- `app.js`: Update `hideAllMainPages()` and nav button bindings for sidebar items
- Add sidebar collapse/expand button with localStorage persistence
- Add active-page indicator (left accent border on active nav item)

### 1B. Mobile — Simplified bottom nav (4 items + overflow)
Reduce mobile bottom nav from 5+ items to 4 with a "More" sheet:

```
[Generator]  [Players]  [History]  [More ⋯]
```

"More" opens a half-sheet containing: Events Manager, Alliance, Settings, Support, Sign Out.

**Changes:**
- `index.html`: Restructure `#mobileBottomNav` to 4 buttons + more trigger
- `styles.css`: Add half-sheet overlay styles for mobile "More" menu
- Remove floating generate buttons from mobile nav area — integrate into Generator page sticky footer instead
- `js/shell/navigation/navigation-controller.js`: Add mobile "More" sheet open/close

### 1C. Header simplification
- Keep only: game badge, profile avatar, notification bell in the header
- Remove menu hamburger button (replaced by sidebar on desktop, bottom nav on mobile)
- Remove alliance create shortcut from header (moved to Alliance page)

**Files modified:** `index.html`, `styles.css`, `navigation-controller.js`, `app.js`

---

## Phase 2: Generator Page — Progressive Disclosure

### 2A. Step-based workflow indicator
Add a visual workflow bar showing the 3 steps: Select Players → Generate → Download

```html
<div class="workflow-steps">
  <div class="workflow-step active" data-step="select">
    <span class="step-number">1</span> Select Players
  </div>
  <div class="workflow-step" data-step="generate">
    <span class="step-number">2</span> Generate
  </div>
  <div class="workflow-step" data-step="download">
    <span class="step-number">3</span> Download
  </div>
</div>
```

### 2B. Collapse event/algorithm selectors
- Wrap event selector tabs + algorithm selector in a collapsible "Event Configuration" summary bar
- Show current event name + algorithm as a compact summary line
- Expand on click to change settings
- Default: collapsed (shows "Desert Storm — Balanced Assignment")

### 2C. Streamline player table
- Hide Notes/THP columns by default on desktop; show Name, Power, Troop Type, Team buttons
- Add "Show all columns" toggle
- Increase row height to 48px for better touch targets
- Make table header sticky

### 2D. Sticky generate bar
- Move Team A/B generate buttons to a sticky bottom bar (replacing floating buttons)
- Show team counters inline: "Team A: 5 selected | Team B: 4 selected"
- Bar appears only when players are selected (progressive disclosure)

**Files modified:** `index.html`, `styles.css`, `app.js`, `js/features/generator/generator-view.js`, `js/features/generator/generator-controller.js`

---

## Phase 3: Players Management — Section Collapsing

### 3A. Default collapsed sections
- "Upload Players" section: collapsed by default, shows "Upload from Excel template"
- "Add Player" section: collapsed by default, shows "+ Add Player" as a compact button
- "Browse Players" section: always expanded (primary action)

### 3B. Simplified add player flow
- Initially show only Name field + "Add" button
- "Add more details" expandable reveals Power, THP, Troops, Notes fields
- Auto-expand for edit mode (all fields shown)

### 3C. Player table improvements
- Larger touch targets for edit/delete/save/cancel buttons (44px minimum)
- Sticky search bar at top of table
- Row count summary: "Showing 12 of 45 players"

**Files modified:** `index.html`, `styles.css`, `js/features/players-management/players-management-view.js`

---

## Phase 4: Visual Hierarchy & Spacing

### 4A. Typography scale enforcement
Add CSS custom properties with clear scale (1.333 ratio):
```css
--ds-text-xs:    0.6875rem;  /* 11px — metadata */
--ds-text-sm:    0.8125rem;  /* 13px — secondary */
--ds-text-base:  0.9375rem;  /* 15px — body */
--ds-text-lg:    1.25rem;    /* 20px — section headers */
--ds-text-xl:    1.6875rem;  /* 27px — page titles */
```

### 4B. Spacing system (8px grid)
Standardize spacing tokens:
```css
--ds-space-xs:   4px;
--ds-space-sm:   8px;
--ds-space-md:   16px;
--ds-space-lg:   24px;
--ds-space-xl:   32px;
--ds-space-2xl:  48px;
```

### 4C. Card breathing room
- Increase card padding from 28px → 32px on desktop
- Add 24px gap between cards (currently inconsistent 12-18px)
- Reduce card border-radius from 16px → 12px for a more professional look
- Remove glassmorphism blur on cards (performance + clarity)

### 4D. Section headers
- Page titles: 27px bold, `--ds-text-primary`
- Section titles within cards: 20px semibold, `--ds-text-primary`
- Subsection labels: 13px uppercase tracking, `--ds-text-muted`
- Consistent 16px gap between header and content

**Files modified:** `styles.css`, `theme-variables.css`

---

## Phase 5: Events Manager — Layout Cleanup

### 5A. Tab-based layout
Replace the two-column events layout with tabs:
- Tab 1: "Events List" — browse/select existing events
- Tab 2: "Event Editor" — create/edit event details

### 5B. Event editor sections
Group the editor form into collapsible sections:
1. **Basic Info** (always open): Name, Algorithm selector
2. **Branding** (collapsed): Logo upload/randomize
3. **Map** (collapsed): Map image upload, building coordinates
4. **Buildings** (collapsed): Buildings table with slots/priority/type

### 5C. Buildings table simplification
- Show building name + slots by default
- "Advanced" toggle shows priority, type, coordinates columns
- Inline editing with click-to-edit pattern (remove edit/save/cancel button clutter)

**Files modified:** `index.html`, `styles.css`, `js/features/events-manager/event-selector-view.js`, `js/features/events-manager/events-manager-controller.js`

---

## Phase 6: Mobile-Specific Improvements

### 6A. Responsive table cards
Player tables on mobile already use card layout (good). Improve:
- Add visual separator between cards (8px gap, subtle border)
- Make team selection buttons full-width in card layout
- Add swipe-to-reveal actions (edit/delete) — or keep buttons visible but larger

### 6B. Modal → Bottom sheet on mobile
Convert modals to bottom sheets on mobile (slide up from bottom):
- Settings → full-height bottom sheet with scroll
- Download → compact bottom sheet
- Game selector → full-height bottom sheet

```css
@media (max-width: 768px) {
  .modal-shell {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    border-radius: 16px 16px 0 0;
    max-height: 85dvh;
    animation: slide-up 0.25s ease;
  }
}
```

### 6C. Safe area optimization
- Ensure sticky bottom bars account for `env(safe-area-inset-bottom)`
- Bottom sheet padding includes safe area

**Files modified:** `styles.css`

---

## Phase 7: Interaction Polish

### 7A. Loading states
Add spinner/skeleton states to:
- Generate button (show spinner during assignment calculation)
- Save buttons in settings/events (show "Saving..." state)
- Player table initial load (skeleton rows)

### 7B. Empty states
Add helpful empty states:
- No players: illustration + "Add your first player" CTA
- No events: "Create your first event" CTA
- No history: "Your event history will appear here after generating teams"

### 7C. Toast notifications
Replace `alert()` calls with non-blocking toast notifications (bottom-right on desktop, bottom-center on mobile).

**Files modified:** `styles.css`, `js/shell/overlays/`, various controllers

---

## i18n Impact
New translation keys needed across all phases (all 6 languages: EN, FR, DE, IT, KO, RO):
- Navigation labels (sidebar group headers, "More" button)
- Workflow step labels
- Progressive disclosure toggle labels ("Show more", "Add details", "Advanced")
- Empty state messages
- Loading state labels
- Toast notification messages

---

## Implementation Order
1. **Phase 4** (Visual Hierarchy) — lowest risk, immediate visual improvement
2. **Phase 1** (Navigation) — structural change, biggest UX impact
3. **Phase 2** (Generator) — most-used page improvement
4. **Phase 3** (Players Management) — second most-used page
5. **Phase 6** (Mobile) — responsive improvements
6. **Phase 5** (Events Manager) — setup page cleanup
7. **Phase 7** (Polish) — final touches

Each phase is independently deployable and testable.
