# Project Handoff

Last updated: 2026-11-13 by T-029

## 1. Current Status
VectorDB engine is in a stable, verified, and frozen state. Active development is UI/UX redesign on branch `ui-redesign`. UI redesign T-011 to T-029 complete. Latest finished task is T-029 (Settings tab reworked into page header + 4x2 Server status metric strip + full-width 3-column hairline config row; no bordered cards, calm breathing room ending at ~60% height at 1920x1080). All 20 Compare DOM IDs (plus new `compare-progress-fill`), 19 Explore DOM IDs, 26 HNSW DOM IDs, 14 Settings DOM IDs (including `panel-settings`, `settings-health-box`, `settings-reset-demo-form`, `demo-dim-input`, `demo-metric-select`, `demo-m-input`, `demo-efc-input`, `settings-random-demo-form`, `demo-random-count`, `demo-insert-random-btn`, `settings-random-status`, `settings-reset-status`, `demo-reset-cancel-btn`, `demo-reset-btn`), 25 Ask DOM IDs (including `panel-ask` and `doc-reset-cancel-btn`), 74 browser logic tests, and 111 C++ tests (529,746 assertions) are verified.

## 2. Last Work Done (From Git)
- **Task T-029** (branch `ui-redesign`): Settings tab - page header + metric strip + 3-column config row.
  1. *Page Header*: Added clean page header with h1 "Settings" (22px, weight 500, primary text) and muted subtitle "Server status and demo collection configuration." (13px) with 24px top / 20px bottom padding and 1px hairline border-bottom.
  2. *Metric Strip (4x2)*: Restyled Server status `#settings-health-box` table using CSS grid on `tbody` (`grid-template-columns: repeat(4, minmax(0, 1fr))`) into a full-width 4x2 metric strip with 18px mono values, 12px muted top labels, 8px green status dot before "ok", smaller 14px mono for wrapping Ollama models, and vertical/horizontal 1px hairlines without outer boxes. Zero JS changes.
  3. *3-Column Configuration Row*: Full-width 3-column row separated by 1px vertical hairlines (no boxes, first column left 0, last column right 0): Column 1 = Demo collection (2x2 grid), Column 2 = Insert random vectors (description + count input and solid amber button), Column 3 = Danger zone (description + red-outline Reset button with two-step confirm).
  4. *Vertical Rhythm & Fallback*: 32px spacing between header, metric strip, and config row; content ends calmly at ~60% of viewport at 1920x1080. In fallback @media (max-height: 520px / max-width: 1100px), metric strip becomes 2 columns and config row stacks into 1 column with horizontal hairlines.
- **Task T-028** (branch `ui-redesign`): Settings tab - align with other tabs (toolbar + main/sidebar layout, no cards).
  1. *Toolbar & Layout Language*: Rebuilt Settings tab using `.tab-toolbar` (left title "Settings" 14px medium + muted subtitle "Server status and demo collection configuration.") and `.viz-layout` with `.viz-main` and `.viz-sidebar` (width 460px), exactly matching Compare/Explore/HNSW tabs. Removed all bordered cards, vertical centering, and equal-height panel logic (ADR-025 superseding ADR-023/ADR-024). Top-aligned directly under toolbar hairline.
  2. *Server Status Hairline Table*: Restyled `#settings-health-box .info-table` with 44px row height (padding 12px 0), 1px hairlines between rows, 200px muted label column, mono tabular-nums value column with `overflow-wrap: anywhere;` (stays on one line at 1920 width), and 8px green status dot (`::before` with `--success-color`) before "ok". Zero JS changes.
  3. *Right 460px Sidebar*: Structured into 3 sections separated by 1px hairlines: (a) "Demo collection" with 2x2 field grid (Dimension, Metric / M, efConstruction) matching Compare styling; (b) "Insert random vectors" with count input + solid amber Insert button on one row (`btn btn-primary w-100`) and `#settings-random-status` below; (c) "Danger zone" with muted description and red-outline Reset Demo Collection button (`btn btn-sm btn-danger`) matching Ask tab Reset Docs button. Two-step confirm and all 14 DOM IDs preserved.
  4. *Responsive Stacking Fallback*: Integrated into shared `@media (max-height: 520px), (max-width: 1100px)` with `.viz-sidebar { width: 100%; height: auto; overflow-y: visible; }` for seamless stacking without clipping.
- **Task T-027** (commit `5588462`, branch `ui-redesign`): Settings tab - remove awkward empty space (balanced bordered panels, vertically centered).
  1. *Balanced Equal-Height Panels*: Configured `#panel-settings .settings-col` as flat bordered panels (`background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 24px; gap: 28px;`). In `.settings-layout`, set `align-items: stretch` so both panels stretch to equal height.
  2. *Safe Vertical & Horizontal Centering*: Set `.settings-layout` to `margin: auto; height: auto; max-height: 100%; gap: 24px;` inside flex container `#panel-settings` (`display: flex; flex-direction: column;`). This cleanly centers the two-column block in remaining viewport space without clipping the top during short viewports.
  3. *Danger Zone Pinned to Bottom*: Assigned `.settings-section-danger` with `margin-top: auto; border-top: 1px solid var(--border-color); padding-top: 20px;`, anchoring the Danger zone card to the bottom edge of the right panel.
  4. *Roomier Server Status Rows*: Increased `#panel-settings .info-table td` padding from `10px 0` to `13px 0`, giving the 8-row table a calm, comfortable vertical rhythm.
  5. *Stacking Fallback*: In `@media (max-height: 520px), (max-width: 1100px)`, set `.settings-layout { margin: 0 auto; }` and `.settings-section-danger { margin-top: 0; }` for natural scroll flow.
  Verified by human in real browser (1920x1080 screenshot confirmed two equal-height panels, block vertically centered, Danger zone pinned, Ollama models on one line; 1366x768 and fallback verified).
- **Task T-026** (commits `a41b134`, `b369c6e`, branch `ui-redesign`): Header Ollama badge clipping at high zoom (ISS-025) fix + Settings column tabindex cleanup.
  1. *Flexible Header & Tab Navigation*: Changed `.app-header` and `.tab-nav` from fixed `height: 48px;` to `min-height: 48px; height: auto;`. At 100% zoom, header retains exact 48px height. At 200% zoom (where effective width drops to 960px or 683px and controls wrap/expand), the header expands vertically to fit wrapped controls rather than clipping them, with `.app-content` flex-resizing below it.
  2. *Badge Line-Height*: Added `line-height: 1.2;` to `.badge` so status badges avoid inheriting `line-height: 1.6` from `body`.
  3. *Settings Column Tabindex*: Removed `tabindex="0"` and `aria-label` from `.settings-col` wrappers in `web/index.html`. Eliminates redundant keyboard tab stops; child `<section>` and `<h2>` headings provide semantic structure. All 14 Settings DOM IDs intact.
- **Task T-025** (commit `6b45f89`, branch `ui-redesign`): One-screen UI Phase 4 - Settings tab 2-column layout (Option A) + Settings fallback.
  1. *Two-Column Layout*: Regrouped `#panel-settings .settings-layout` into 2 equal columns using CSS grid (`grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 40px;`). Left column contains Server status table (`#settings-health-box`). Right column contains Demo collection (config form + random vectors) and Danger zone reset card. Removed `<hr class="settings-divider">` separators.
  2. *Fixed-Height Panel & Inner Column Scroll*: Replaced temporary panel-level scroll on `#panel-settings` with `height: 100%; min-height: 0; overflow: hidden;`. Configured `.settings-col` with `display: flex; flex-direction: column; gap: 32px; min-width: 0; max-height: 100%; overflow-y: auto;` with 1px amber `:focus-visible` outline.
  3. *Table Column Width & Wrap*: Reduced Server status table first column from 220px to 160px; added `overflow-wrap: anywhere;` to value column so long Ollama model lists wrap without horizontal overflow.
  4. *Responsive Fallback*: In `@media (max-height: 520px), (max-width: 1100px)`, configured `.settings-layout` to stack in a single column (`grid-template-columns: 1fr; height: auto; gap: 24px;`) with `.settings-col { max-height: none; overflow: visible; }`.
  5. *Zero JS Changes & All 14 IDs Preserved*: No JS files modified. All 14 Settings DOM IDs intact and verified.
- **Task T-024** (commit `46e1991`, branch `ui-redesign`): One-screen UI Phase 4 - Settings tab + small-screen fallback feasibility study (read-only architectural analysis + docs sync). Evaluated DOM blocks, CSS rules, content height (~754px vs 965px at 1080p and 653px at 768p), proposed Option A 2-column layout vs Option B single column compact, audited fallback media queries across all 5 tabs, and isolated ISS-025 header badge clipping to fixed 48px header height.
- **Task T-023b-2** (commits `f0eded4`, `cfb2f2a`, branch `ui-redesign`): Compare bars as 3 side-by-side charts (Latency, Distances, Recall) + Summary Metrics Recall column visible.
  1. *Side-by-Side Canvas Layout*: Replaced 3 stacked vertical sections with a single row of 3 side-by-side metric charts (Latency, Distance Computations, Recall @ k) in a 140px canvas wrapper. Added single left algorithm label gutter (80px), responsive metric titles with multi-stage fallback shortening, non-overflowing bars and mono value labels, and baseline grid rules. Pure helper `computeChartLayout(w, h)` exports geometry with 4 unit tests (total browser tests now 74).
  2. *Summary Metrics Width & Padding*: Widened `#panel-compare .viz-sidebar` to 460px and reduced cell padding to `4px 6px` so all 5 columns including Recall@k are fully visible with no horizontal scrollbar at 100% and 125% zoom. Diff table in `.viz-main` gains ~100px freed vertical space.
- **Task T-023b-1** (commits `e120905`, `207130f`, `b62e577`, branch `ui-redesign`): Compare - fix chart size at DPR != 1 and fix cramped Summary Metrics table.
  1. *DPR CSS Sizing Fix*: Added pure helper `resolveChartSize(cssW, cssH, bufW, bufH, dpr)` in `web/js/compare_helpers.js` and wired into `drawComparisonBars(canvas, data, isDark)` so drawing bounds use CSS pixels rather than buffer pixels. Added 4 unit tests in `web/js/tests/test_compare.js` bringing browser test count to 70.
  2. *Compact Summary Metrics Table*: Widened `#panel-compare .viz-sidebar` to 420px; applied `white-space: nowrap`, 6px 8px padding, and 12px font size to Summary Metrics table cells; removed container max-height and inner vertical scroll (`max-height: none; overflow-y: visible; overflow-x: auto;`) so all 3 rows render cleanly on one line each.
- **Task T-023a** (commits `448f563`, `309addb`, `210557a`, branch `ui-redesign`): Compare tab one-screen Phase 3a - fixed-height layout (Summary Metrics to left column, Diff table scrolls inside).
  1. *Fixed-Height Panel & Column Redistribution*: Replaced temporary panel scroll on `#panel-compare` with `display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden;`. Sized `.viz-sidebar` to 380px with `height: 100%; overflow-y: auto;` and moved Summary Metrics table inside it below progress block. Configured `.viz-main` with `flex: 1; min-height: 0; display: flex; flex-direction: column;`.
  2. *Diff Table Inner Scroll & Header Fix*: Configured `#compare-results-card` with `flex: 1; min-height: 0; display: flex; flex-direction: column;`. Sized Top-k Ground Truth Diff `.table-container` with `flex: 1; min-height: 140px; max-height: none; overflow-y: auto; overflow-x: auto;`. Assigned sticky `th` with `background: var(--bg-primary); z-index: 2;`. Overrode global 40% column rule on Compare tables, fixing diff `#` column width to 48px. Added `tabindex="0"`, `aria-label`, and 1px amber `:focus-visible` to both table containers.
  3. *Canvas Wrapper & ResizeObserver*: Fixed `#panel-compare .canvas-wrapper` height to 240px (`flex-shrink: 0`) and `#compare-bars-canvas` to `width: 100%; height: 100%;`. Wired `ResizeObserver` on `canvasWrapper` with rAF throttling and `isCanvasDrawable` guard. Maintained fallback `@media (max-height: 520px), (max-width: 1100px)`.
- **Task T-022** (commit `88d63d2`, branch `ui-redesign`): Compare tab one-screen feasibility study (read-only architectural analysis and proposal for Option A).
- **Task T-021** (commits `4db1567`, `4c736e7`, branch `ui-redesign`): Ask tab - answer box sizes to content, sources take remaining height (verified in real browser by human on 2026-11-13).
  1. *Flex Distribution*: Changed `.answer-section` from `flex: 1` to `flex: 0 1 auto; min-height: 0;` and `.sources-section` from `flex-shrink: 0` to `flex: 1; min-height: 0;`.
  2. *Answer Box & Sources Sizing*: Changed `.answer-box` from `flex: 1; min-height: 120px;` to `flex: 0 1 auto; min-height: 60px; max-height: 50vh; overflow-y: auto;`. Preserved empty state behavior (`border-left: none; min-height: auto; flex: 0 0 auto`). Changed `.sources-list` from `max-height: 180px; flex-shrink: 0;` to `flex: 1; min-height: 120px; overflow-y: auto;`.
  3. *Responsive Fallback*: Updated `@media (max-height: 520px), (max-width: 1100px)` with `.answer-section { flex: none; }`, `.sources-section { flex: none; }`, and `.sources-list { flex: none; min-height: 0; max-height: 360px; }`.
- **Task T-020** (commits `a56e903`, `a6ddfc2`, `a98c00e`, branch `ui-redesign`): One-screen UI Phase 2 - Explore + HNSW tabs fit the panel.
  1. *Fixed-Height Panel & Canvas Frame Layout*: Replaced temporary panel-level scroll on `#panel-explore` and `#panel-hnsw` with `height: 100%; min-height: 0; overflow: hidden; display: flex; flex-direction: column;`. Pinned `.tab-toolbar` (`flex-shrink: 0; margin-bottom: 12px;`). Sized `.viz-layout` with `flex: 1; min-height: 0; align-items: stretch;`, `.viz-main` with `flex: 1; min-height: 0; min-width: 0; display: flex; flex-direction: column;`, and `.viz-sidebar` with `height: 100%; min-height: 0; overflow-y: auto;`.
  2. *Canvas Frame*: Wrapped `explore-canvas` and `hnsw-canvas` in `.canvas-frame` (`position: relative; flex: 1; min-height: 0; min-width: 0; background: #0a0a0a; border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden;`) with canvases styled as `position: absolute; inset: 0; width: 100%; height: 100%; display: block;` (decoupled from intrinsic aspect ratio; Compare bars canvas retained `height: auto` in `.canvas-wrapper`). Pinned Explore legend (`max-height: 80px; overflow-y: auto; flex-shrink: 0;`) and HNSW Graph Topology Summary (`max-height: 160px; overflow-y: auto; flex-shrink: 0;`). Preserved fallback media query `@media (max-height: 520px), (max-width: 1100px)` with `.canvas-frame { height: 60vh; min-height: 320px; flex: none; }`.
  3. *JS Sizing & ResizeObserver*: Attached `ResizeObserver` on each `.canvas-frame` throttled via `requestAnimationFrame` (one redraw per frame). Guarded renders with `isCanvasDrawable` to prevent 0x0 hidden-tab exceptions (ADR-014). Preserved zoom and pan state across window and frame resizes.
- **Task T-019** (commits `8ce28c9`, `a230057`, `6ee2d04`, `c3693e7`, branch `ui-redesign`): One-screen UI Phase 1 - fixed app shell + Ask tab pilot.
  1. *App Shell & Panel Scroll*: Set `html, body` to `height: 100% / 100vh / 100dvh` with `overflow: hidden`, removed `html` scrollbar-gutter and `overflow-y: scroll`. Pinned `.app-header` and `.app-footer` with `flex-shrink: 0`. `.app-content` configured with `flex: 1`, `min-height: 0`, `overflow: hidden`, and tighter vertical padding `16px 28px 12px 28px`. Added temporary panel-level scroll (`overflow-y: auto; height: 100%`) for `#panel-explore`, `#panel-hnsw`, `#panel-compare`, and `#panel-settings`.
  2. *Ask Tab Layout*: Configured `#panel-ask` with `overflow: hidden; height: 100%`. `.ask-layout` set to `height: 100%; min-height: 0; align-items: stretch`. `.ask-sidebar` (320px) scrolls with its own `overflow-y: auto`. `.reading-column` set to `height: 100%; min-height: 0` with pinned query section (`flex-shrink: 0`). `.answer-box` gets `flex: 1; min-height: 120px; overflow-y: auto`, preserving natural height when empty (`border-left: none; min-height: auto; flex: 0 0 auto`). `.sources-list` capped at `max-height: 180px; overflow-y: auto; flex-shrink: 0`. Added `tabindex="0"` and `aria-label` to answer box and sources list with calm 1px amber `:focus-visible`. Added fallback `@media (max-height: 520px), (max-width: 1100px)` restoring document scroll.
  3. *Smart Auto-Scroll*: Added pure helper `shouldAutoScroll(scrollTop, scrollHeight, clientHeight, threshold = 40)` in `web/js/ui.js` and wired into `web/js/ask.js` token streaming handler (evaluates scroll condition before appending new tokens). Added 4 unit tests in `web/js/tests/test_core.js`, raising browser test count from 62 to 66.
- **Task T-018** (commits `7ea24db`, `e98b381`, `31a2edb`, branch `ui-redesign`): Cleanup before one-screen UI work.
  1. *Mockup Removal*: Removed temporary directory `web/mockup/` (`ask.html` and `mockup.css`) while retaining local fonts in `web/fonts/`.
  2. *Replace Native alert()/confirm()*: Replaced all native dialogs in production JavaScript with non-blocking inline DOM elements. Replaced `confirm()` on `#doc-reset-btn` and `#demo-reset-btn` with a 2-step inline confirmation flow (button text changes to "Confirm reset", displays a "Cancel" button, and auto-resets after a 5-second timeout). Replaced `alert()` on random vector insertion and demo reset with `#settings-random-status` and `#settings-reset-status` banner notices (`role="status"` with 5-second auto-hide).
  3. *Documentation Cleanup*: Deduplicated sections in `HANDOFF.md`, updated `PROJECT_CONTEXT.md`, updated `ARCHITECTURE.md`, recorded ADR-020 in `DECISIONS.md`, and updated `PROGRESS.md`.
- **Task T-017** (commit `033c8fd`, branch `ui-redesign`): One-screen UI feasibility study (read-only architectural analysis). Evaluated viewport layout constraints, overflow configurations, and sizing mechanics across all 5 tabs for zero-page-scroll instrument-panel UX.
- **Task T-016** (branch `ui-redesign`): Fixed failing browser unit test in `web/js/tests/test_explore_hnsw.js`. Updated expected fallback color to `#807c74` matching T-014 production constant.
- **Task T-015** (branch `ui-redesign`): Redesign Phase 4b complete (Compare tab layout, flat progress bar, zero blue palette).
- **Task T-014** (branch `ui-redesign`): Redesign Phase 4a complete (Explore & HNSW tabs redesign, warm/earth palette, trace colors).
- **Task T-013** (branch `ui-redesign`): Redesign Phase 3 complete (Settings tab industrial layout, 2-column config grid, Danger zone reset card, Ask overlap fix).
- **Task T-012** (branch `ui-redesign`): Redesign Phase 2 complete (Ask tab layout restructure into ingestion column, reading column, sources rows).
- **Task T-011** (branch `ui-redesign`): Redesign Phase 1 foundation complete (design tokens, local IBM Plex fonts, dark app shell, global controls, light theme removal).
- **Task T-010** (branch `ui-redesign`): Minimalist polish of Ask mockup v2 (`web/mockup/ask.html`, `mockup.css`).
- **Task T-009** (branch `ui-redesign`): IBM Plex fonts downloaded into `web/fonts/`, static Ask tab mockup created.
- **Task T-006** (commit `c0585f1`): Cleaned up issue wording in `KNOWN_ISSUES.md`, recorded collaboration preferences.
- **Task T-005** (commit `46e8cfc`): Recorded T-004 human verification, corrected assertion count explanation, confirmed push.
- **Task T-004** (commits `2c92b6a`..`c1ee64e`): Batched fix for ISS-018 to ISS-022. Confirmed in real browser by human; pushed to `origin/main`.

## 3. Git State
- **Active Branch**: `ui-redesign` (branched from `main` at `689aa47`) [CONFIRMED: git status -sb]
- **Tracking Status**: Local branch `ui-redesign` without upstream tracking (commits unpushed per protocol).
- **Working Tree**: Clean (only untracked test logs in `results/logs/`) [CONFIRMED: git status -sb]
- Note: Git state in docs can go stale after pushes; always trust human's `git status -sb`.

## 4. Recommended Next Step
Human browser verification of T-029 (Settings layout at 1920x1080 and 1366x768, page header, 4x2 metric strip, 3-column config row, two-step reset confirm, random insert, fallback stacking). Then decide merge of ui-redesign to main or optional polish.

## 5. UI Redesign Phase Plan
UI redesign phases (branch `ui-redesign`):
1. **Phase 1 (Foundation + Shell - T-011)**: Design tokens, local IBM Plex fonts, dark app shell, global controls, light theme removal. [COMPLETED]
2. **Phase 2 (Ask Tab - T-012)**: Full layout restructure of Ask tab matching approved minimalist mockup v2; shell fixes for tab line, tab width shift, and red destructive reset button. [COMPLETED]
3. **Phase 3 (Settings Tab - T-013)**: Clean industrial layout for server health, metrics, and demo reset controls. [COMPLETED]
4. **Phase 4a (Explore + HNSW Tabs - T-014)**: Toolbar width regression fix, unboxed toolbars, `.viz-layout` restructure, dark canvas colors (warm/earth palette, muted gray/amber HNSW layers, off-white query stars, amber trace path). [COMPLETED]
5. **Phase 4b (Compare Tab - T-015)**: Unboxed toolbar, `.viz-layout` restructure, horizontal table scrolling container, flat thin amber progress bar, taupe/moss/amber palette with zero blue. [COMPLETED]
6. **Phase 5 (Polish & Cleanup - T-018)**: Removed temporary mockup folder, replaced native alert/confirm with inline UI, docs cleanup. [COMPLETED]
7. **Phase 7: One-Screen UI Phase 1 (Shell + Ask Pilot - T-019)**: Fixed 100dvh app shell, Ask tab one-screen layout with inner scroll areas, smart auto-scroll, 4 unit tests (66 total), temporary panel-level scroll on non-Ask tabs, responsive fallback media query. [COMPLETED]
8. **Phase 8: One-Screen UI Phase 2 (Explore + HNSW Canvas Sizing - T-020)**: Replaced temporary panel scroll with fixed-height flex layout, wrapped canvases in `.canvas-frame` with absolute inset, ResizeObserver sizing with rAF throttle and `isCanvasDrawable` guard, sidebar inner scroll. [COMPLETED]
9. **Phase 9: Ask Answer Box & Sources Height Tuning (T-021)**: Answer box sizes to content with `flex: 0 1 auto` and `max-height: 50vh`, sources list takes remaining height with `flex: 1`, responsive fallback updated. Verified in real browser by human on 2026-11-13. [COMPLETED]
10. **Phase 10: One-Screen UI Phase 3 (Compare Option A - T-022 feasibility, T-023a layout complete, T-023b-1 DPR & table fix complete, T-023b-2 side-by-side canvas)**: T-023a fixed layout + T-023b-1 DPR CSS px fix & compact sidebar table + T-023b-2 side-by-side 3-panel canvas & full-width Summary Metrics. [COMPLETED and human-verified]
11. **Phase 11: One-Screen UI Phase 4 (Settings - T-024 feasibility complete, T-025 implementation complete, human-verified)**: [COMPLETED and human-verified]
*Dark only. Human verifies in browser after each phase.*

## 6. Pending Human Actions
- (1) Verify T-029 in real browser (Settings layout at 1920x1080, 1366x768, zoom, reset, insert, fallback).
- (2) Decide merge of ui-redesign into main (Brain will ask for backup branch and safety checks first).
- (3) Optional polish of Compare sidebar empty space below Summary Metrics at 1920x1080.
- (4) Roadmap features (hybrid search, reranking, disk persistence, delete) stay ON HOLD.

## 7. Open Decisions / Known Gaps
- **Compare layout choice**: RESOLVED: Option A chosen (form + metrics in sidebar, bars + diff table on right). Cited in ADR-021.
- **T-029 (completed)**: Settings tab page header + 4x2 Server status metric strip + full-width 3-column config row (Demo collection, Insert random, Danger zone); no bordered cards; content ends calmly at ~60% panel height. Pending human browser verification.
- **T-028 (completed)**: Settings tab aligned with other tabs (toolbar + main/sidebar layout, no cards, 460px right sidebar, 8-row hairline server status table with 8px green dot, solid amber insert button, red outline reset button).
- **T-027 (completed)**: Settings tab balanced bordered panels (`--bg-surface`, 1px `--border-color`, `--radius-md`, 24px padding), vertically centered with `margin: auto`, Danger zone pinned to bottom of right panel (`margin-top: auto; border-top: 1px solid var(--border-color)`), Server table row padding 13px 0. Human-verified by screenshot at 1920x1080 on 2026-11-13.
- **T-026 (completed)**: Header flexible min-height: 48px + badge line-height: 1.2 (ISS-025 fix) + Settings column tabindex removal. Verified by human in real browser (screenshot at 200% zoom).
- **T-025 (completed)**: Settings tab 2-column layout implemented (left = Server status, right = Demo collection + Danger zone) with stacked fallback below 1100px width or 520px height. Verified by human in real browser.
- **T-024 (completed)**: Settings tab and fallback media query feasibility study complete. Option A 2-column layout recommended for zero-scroll on 1366x768 and 1920x1080. ISS-025 identified as fixed 48px header height clipping zoomed content.
- **T-023b-2 (completed)**: bars as 3 side-by-side charts (Latency, Distances, Recall) in a 140px canvas, drawn in CSS px. Summary Metrics sidebar widened to 460px with 4px 6px padding to ensure Recall column is fully visible without horizontal scrollbar. Verified by human screenshots.
- **Known from review**: .answer-box max-height uses 50vh (viewport based); revisit only if sources look too small at 1366x768.
- **Fallback media query** (max-height 520px / max-width 1100px) is a guess, human-tested OK on desktop windows only.
- Total DOM ID counts: Ask 25 (including `panel-ask`), Explore 19, HNSW 26, Settings 14, Compare 20.
- Known UI gaps to address:
  - `DEMO_SCRIPT.md` refers to "red star" marker: query star is now off-white `#f0ede6` with black outline. (Human handles viva/presentation docs independently).
- Roadmap features (hybrid search, reranking, disk persistence, delete) remain ON HOLD until the human confirms they are required.
- Strategy for rollback during `RagPipeline::ingest` if a vector insert fails midway (ISS-006) remains documented for future work.

## 8. Important Warnings (Fragile Areas)
- **Do not start roadmap features** (hybrid search, reranking, persistence, delete) until the human confirms they are required.
- **Zero-innerHTML rule**: Never introduce `innerHTML`, `outerHTML` or `insertAdjacentHTML` in `web/js/`. There is no CI; run the scanner manually: `powershell -ExecutionPolicy Bypass -File .\scripts\check_web_safety.ps1`.
- **Strict POST Content-Type**: Every POST route requires `Content-Type: application/json` (send `{}` for empty bodies). Do not weaken this in `server_main.cpp`.
- **No mutex held during Ollama calls** in `src/rag.cpp`.
- **Canvas zero-dimension guard**: Check `isCanvasDrawable` before drawing on hidden canvases.
- **Frontend-to-server field names must be covered by tests** (lesson from ISS-017 / ADR-015).
- **Testing from the human's side**: Reports from ChatGPT or another Claude are human-reported, not proof. Ask for terminal output or screenshots.

## 9. UNCLEAR Items
- Whether disk persistence is required for grading [UNCLEAR; on hold, human decided not to pursue for now].

## 10. Files to Read for Next Task
- `docs/PROJECT_CONTEXT.md`
- `docs/KNOWN_ISSUES.md`
- `docs/DECISIONS.md`
- `docs/PROGRESS.md`
- `docs/HANDOFF.md`
