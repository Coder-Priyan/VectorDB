# Project Handoff

Last updated: 2026-11-13 by T-023a

## 1. Current Status
VectorDB engine is in a stable, verified, and frozen state. Active development is UI/UX redesign on branch `ui-redesign`. Phase 1 (foundation), Phase 2 (Ask tab), Phase 3 (Settings tab), Phase 4a (Explore + HNSW tabs), Phase 4b (Compare tab redesign, flat progress bar, table wrapping prevention, taupe/moss/amber palette with zero blue), T-016 (browser test fallback color fix), T-017 (one-screen UI feasibility study), T-018 (cleanup before one-screen UI: mockup removed, alert/confirm replaced with inline UI and two-step confirm, docs cleanup), T-019 (One-screen UI Phase 1: fixed 100dvh app shell, Ask tab one-screen pilot with inner scroll areas, smart auto-scroll, temporary panel scroll for other tabs), T-020 (One-screen UI Phase 2: Explore + HNSW tabs fit panel with .canvas-frame and ResizeObserver), T-021 (Ask answer box sizes to content, sources take remaining height), T-022 (Compare tab one-screen feasibility study), and T-023a (Compare one-screen Phase 3a fixed layout) are complete. All 20 Compare DOM IDs (plus new `compare-progress-fill`), 19 Explore DOM IDs, 26 HNSW DOM IDs, 11 Settings DOM IDs (plus new `demo-reset-cancel-btn`, `settings-reset-status`, `settings-random-status`), 25 Ask DOM IDs (including `panel-ask` and `doc-reset-cancel-btn`), 66 browser logic tests, and 111 C++ tests (529,746 assertions) are verified.

## 2. Last Work Done (From Git)
- **Task T-023a** (branch `ui-redesign`): Compare tab one-screen Phase 3a - fixed-height layout (Summary Metrics to left column, Diff table scrolls inside).
  1. *Fixed-Height Panel & Column Redistribution*: Replaced temporary panel scroll on `#panel-compare` with `display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden;`. Sized `.viz-sidebar` to 380px with `height: 100%; overflow-y: auto;` and moved Summary Metrics table inside it below progress block. Configured `.viz-main` with `flex: 1; min-height: 0; display: flex; flex-direction: column;`.
  2. *Diff Table Inner Scroll & Header Fix*: Configured `#compare-results-card` with `flex: 1; min-height: 0; display: flex; flex-direction: column;`. Sized Top-k Ground Truth Diff `.table-container` with `flex: 1; min-height: 140px; max-height: none; overflow-y: auto; overflow-x: auto;`. Assigned sticky `th` with `background: var(--bg-primary); z-index: 2;`. Overrode global 40% column rule on Compare tables, fixing diff `#` column width to 48px. Added `tabindex="0"`, `aria-label`, and 1px amber `:focus-visible` to both table containers.
  3. *Canvas Wrapper & ResizeObserver*: Fixed `#panel-compare .canvas-wrapper` height to 240px (`flex-shrink: 0`) and `#compare-bars-canvas` to `width: 100%; height: 100%;`. Wired `ResizeObserver` on `canvasWrapper` with rAF throttling and `isCanvasDrawable` guard. Maintained fallback `@media (max-height: 520px), (max-width: 1100px)`.
- **Task T-022** (branch `ui-redesign`): Compare tab one-screen feasibility study (read-only architectural analysis and proposal for Option A).
- **Task T-021** (branch `ui-redesign`): Ask tab - answer box sizes to content, sources take remaining height (verified in real browser by human on 2026-11-13).
  1. *Flex Distribution*: Changed `.answer-section` from `flex: 1` to `flex: 0 1 auto; min-height: 0;` and `.sources-section` from `flex-shrink: 0` to `flex: 1; min-height: 0;`.
  2. *Answer Box & Sources Sizing*: Changed `.answer-box` from `flex: 1; min-height: 120px;` to `flex: 0 1 auto; min-height: 60px; max-height: 50vh; overflow-y: auto;`. Preserved empty state behavior (`border-left: none; min-height: auto; flex: 0 0 auto`). Changed `.sources-list` from `max-height: 180px; flex-shrink: 0;` to `flex: 1; min-height: 120px; overflow-y: auto;`.
  3. *Responsive Fallback*: Updated `@media (max-height: 520px), (max-width: 1100px)` with `.answer-section { flex: none; }`, `.sources-section { flex: none; }`, and `.sources-list { flex: none; min-height: 0; max-height: 360px; }`.
- **Task T-020** (branch `ui-redesign`): One-screen UI Phase 2 - Explore + HNSW tabs fit the panel.
  1. *Fixed-Height Panel & Canvas Frame Layout*: Replaced temporary panel-level scroll on `#panel-explore` and `#panel-hnsw` with `height: 100%; min-height: 0; overflow: hidden; display: flex; flex-direction: column;`. Pinned `.tab-toolbar` (`flex-shrink: 0; margin-bottom: 12px;`). Sized `.viz-layout` with `flex: 1; min-height: 0; align-items: stretch;`, `.viz-main` with `flex: 1; min-height: 0; min-width: 0; display: flex; flex-direction: column;`, and `.viz-sidebar` with `height: 100%; min-height: 0; overflow-y: auto;`.
  2. *Canvas Frame*: Wrapped `explore-canvas` and `hnsw-canvas` in `.canvas-frame` (`position: relative; flex: 1; min-height: 0; min-width: 0; background: #0a0a0a; border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden;`) with canvases styled as `position: absolute; inset: 0; width: 100%; height: 100%; display: block;` (decoupled from intrinsic aspect ratio; Compare bars canvas retained `height: auto` in `.canvas-wrapper`). Pinned Explore legend (`max-height: 80px; overflow-y: auto; flex-shrink: 0;`) and HNSW Graph Topology Summary (`max-height: 160px; overflow-y: auto; flex-shrink: 0;`). Preserved fallback media query `@media (max-height: 520px), (max-width: 1100px)` with `.canvas-frame { height: 60vh; min-height: 320px; flex: none; }`.
  3. *JS Sizing & ResizeObserver*: Attached `ResizeObserver` on each `.canvas-frame` throttled via `requestAnimationFrame` (one redraw per frame). Guarded renders with `isCanvasDrawable` to prevent 0x0 hidden-tab exceptions (ADR-014). Preserved zoom and pan state across window and frame resizes.
- **Task T-019** (branch `ui-redesign`): One-screen UI Phase 1 - fixed app shell + Ask tab pilot.
  1. *App Shell & Panel Scroll*: Set `html, body` to `height: 100% / 100vh / 100dvh` with `overflow: hidden`, removed `html` scrollbar-gutter and `overflow-y: scroll`. Pinned `.app-header` and `.app-footer` with `flex-shrink: 0`. `.app-content` configured with `flex: 1`, `min-height: 0`, `overflow: hidden`, and tighter vertical padding `16px 28px 12px 28px`. Added temporary panel-level scroll (`overflow-y: auto; height: 100%`) for `#panel-explore`, `#panel-hnsw`, `#panel-compare`, and `#panel-settings`.
  2. *Ask Tab Layout*: Configured `#panel-ask` with `overflow: hidden; height: 100%`. `.ask-layout` set to `height: 100%; min-height: 0; align-items: stretch`. `.ask-sidebar` (320px) scrolls with its own `overflow-y: auto`. `.reading-column` set to `height: 100%; min-height: 0` with pinned query section (`flex-shrink: 0`). `.answer-box` gets `flex: 1; min-height: 120px; overflow-y: auto`, preserving natural height when empty (`border-left: none; min-height: auto; flex: 0 0 auto`). `.sources-list` capped at `max-height: 180px; overflow-y: auto; flex-shrink: 0`. Added `tabindex="0"` and `aria-label` to answer box and sources list with calm 1px amber `:focus-visible`. Added fallback `@media (max-height: 520px), (max-width: 1100px)` restoring document scroll.
  3. *Smart Auto-Scroll*: Added pure helper `shouldAutoScroll(scrollTop, scrollHeight, clientHeight, threshold = 40)` in `web/js/ui.js` and wired into `web/js/ask.js` token streaming handler (evaluates scroll condition before appending new tokens). Added 4 unit tests in `web/js/tests/test_core.js`, raising browser test count from 62 to 66.
- **Task T-018** (branch `ui-redesign`): Cleanup before one-screen UI work.
  1. *Mockup Removal*: Removed temporary directory `web/mockup/` (`ask.html` and `mockup.css`) while retaining local fonts in `web/fonts/`.
  2. *Replace Native alert()/confirm()*: Replaced all native dialogs in production JavaScript with non-blocking inline DOM elements. Replaced `confirm()` on `#doc-reset-btn` and `#demo-reset-btn` with a 2-step inline confirmation flow (button text changes to "Confirm reset", displays a "Cancel" button, and auto-resets after a 5-second timeout). Replaced `alert()` on random vector insertion and demo reset with `#settings-random-status` and `#settings-reset-status` banner notices (`role="status"` with 5-second auto-hide).
  3. *Documentation Cleanup*: Deduplicated sections in `HANDOFF.md`, updated `PROJECT_CONTEXT.md`, updated `ARCHITECTURE.md`, recorded ADR-020 in `DECISIONS.md`, and updated `PROGRESS.md`.
- **Task T-017** (branch `ui-redesign`): One-screen UI feasibility study (read-only architectural analysis). Evaluated viewport layout constraints, overflow configurations, and sizing mechanics across all 5 tabs for zero-page-scroll instrument-panel UX.
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
- Human verifies T-023a (Compare at 1920x1080 and 1366x768, benchmark run, table scroll, resize, small-window fallback, /tests.html, console); then T-023b.

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
10. **Phase 10: One-Screen UI Phase 3 (Compare Option A - T-022 feasibility, T-023a layout complete, T-023b side-by-side canvas)**: T-023a fixed layout, sidebar summary metrics, diff table scroll, 240px canvas wrapper, ResizeObserver. [T-023a COMPLETED, T-023b PENDING]
11. **Phase 11: One-Screen UI Phase 4 (Settings)**: Settings 2-column grid inner scroll and compact tuning. [PENDING]
*Dark only. Human verifies in browser after each phase.*

## 6. Pending Human Actions
- All previous action items resolved by human decision on 2026-11-12:
  - Roadmap features (hybrid search, reranking, disk persistence, delete): ON HOLD by human decision; do not start unless explicitly requested by the human.
  - Post-T-004 manual re-check of Explore, HNSW, Compare tabs: SKIPPED by human decision; do not ask again.
  - Verification task T-007 (docs vs git audit): SKIPPED by human decision.

## 7. Open Decisions / Known Gaps
- **Human chose WOW feel (2026-11-13)**: Compare Phase 3b (T-023b) = bars as 3 side-by-side charts (Latency, Distances, Recall) in a ~140px canvas, after a DPR/buffer-size check of drawComparisonBars (compare_helpers.js:101-102). T-023a = layout only.
- **T-021 (verified)**: Ask tab answer box sizes to content (`flex: 0 1 auto; max-height: 50vh;`), leaving leftover reading column height for the sources list (`flex: 1; min-height: 120px;`). Verified by human in real browser on 2026-11-13. Known from T-021 review: `.answer-box` max-height uses `50vh` (viewport based, not column based); revisit only if human sees sources too small at 1366x768.
- **Next Step**: Human verifies T-023a (Compare at 1920x1080 and 1366x768, benchmark run, table scroll, resize, small-window fallback, /tests.html, console); then T-023b.
- Total DOM ID counts: Ask 25 (including `panel-ask`), Explore 19, HNSW 26, Settings 11, Compare 20.
- Fallback threshold (`max-height: 520px` / `max-width: 1100px`) restores document-style scroll for small viewports; `.canvas-frame` assigned `height: 60vh; min-height: 320px; flex: none;`. Human tests threshold on a 1280x720 laptop window.
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
