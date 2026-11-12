# Project Handoff

Last updated: 2026-11-12 by T-019

## 1. Current Status
VectorDB engine is in a stable, verified, and frozen state. Active development is UI/UX redesign on branch `ui-redesign`. Phase 1 (foundation), Phase 2 (Ask tab), Phase 3 (Settings tab), Phase 4a (Explore + HNSW tabs), Phase 4b (Compare tab redesign, flat progress bar, table wrapping prevention, taupe/moss/amber palette with zero blue), T-016 (browser test fallback color fix), T-017 (one-screen UI feasibility study), T-018 (cleanup before one-screen UI: mockup removed, alert/confirm replaced with inline UI and two-step confirm, docs cleanup), and T-019 (One-screen UI Phase 1: fixed 100dvh app shell, Ask tab one-screen pilot with inner scroll areas, smart auto-scroll, temporary panel scroll for other tabs) are complete. All 20 Compare DOM IDs (plus new `compare-progress-fill`), 19 Explore DOM IDs, 26 HNSW DOM IDs, 11 Settings DOM IDs (plus new `demo-reset-cancel-btn`, `settings-reset-status`, `settings-random-status`), 25 Ask DOM IDs (including `panel-ask` and `doc-reset-cancel-btn`), 66 browser logic tests, and 111 C++ tests (529,746 assertions) are verified.

## 2. Last Work Done (From Git)
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
- Human verifies T-019 in browser on both normal desktop and resized window (one-screen layout, no page scroll on desktop, inner scroll on Ask tab answer and sources, smart auto-scroll while streaming, temporary panel scroll on other 4 tabs, fallback on <= 520px height or <= 1100px width, /tests.html 66/66). Then decide next phase: merge ui-redesign to main, or proceed with One-screen UI Phase 2 (Explore + HNSW canvas sizing).

## 5. UI Redesign Phase Plan
UI redesign phases (branch `ui-redesign`):
1. **Phase 1 (Foundation + Shell - T-011)**: Design tokens, local IBM Plex fonts, dark app shell, global controls, light theme removal. [COMPLETED]
2. **Phase 2 (Ask Tab - T-012)**: Full layout restructure of Ask tab matching approved minimalist mockup v2; shell fixes for tab line, tab width shift, and red destructive reset button. [COMPLETED]
3. **Phase 3 (Settings Tab - T-013)**: Clean industrial layout for server health, metrics, and demo reset controls. [COMPLETED]
4. **Phase 4a (Explore + HNSW Tabs - T-014)**: Toolbar width regression fix, unboxed toolbars, `.viz-layout` restructure, dark canvas colors (warm/earth palette, muted gray/amber HNSW layers, off-white query stars, amber trace path). [COMPLETED]
5. **Phase 4b (Compare Tab - T-015)**: Unboxed toolbar, `.viz-layout` restructure, horizontal table scrolling container, flat thin amber progress bar, taupe/moss/amber palette with zero blue. [COMPLETED]
6. **Phase 5 (Polish & Cleanup - T-018)**: Removed temporary mockup folder, replaced native alert/confirm with inline UI, docs cleanup. [COMPLETED]
7. **One-Screen UI Phase 1 (Shell + Ask Pilot - T-019)**: Fixed 100dvh app shell, Ask tab one-screen layout with inner scroll areas, smart auto-scroll, 4 unit tests (66 total), temporary panel-level scroll on non-Ask tabs, responsive fallback media query. [COMPLETED]
8. **One-Screen UI Phase 2 (Explore + HNSW Canvas Sizing)**: Container-driven canvas sizing in `canvas.js`, unboxed toolbar pinned, sidebar inner scroll. [PENDING]
9. **One-Screen UI Phase 3 (Compare Option A)**: Table and canvas chart inner scrolling. [PENDING]
10. **One-Screen UI Phase 4 (Settings)**: Settings 2-column grid inner scroll and compact tuning. [PENDING]
*Dark only. Human verifies in browser after each phase.*

## 6. Pending Human Actions
- All previous action items resolved by human decision on 2026-11-12:
  - Roadmap features (hybrid search, reranking, disk persistence, delete): ON HOLD by human decision; do not start unless explicitly requested by the human.
  - Post-T-004 manual re-check of Explore, HNSW, Compare tabs: SKIPPED by human decision; do not ask again.
  - Verification task T-007 (docs vs git audit): SKIPPED by human decision.

## 7. Open Decisions / Known Gaps
- **One-Screen UI Phase 1 (T-019)** = shell + Ask pilot. Explore/HNSW/Compare/Settings have TEMPORARY panel-level scroll until Phases 2-4. Fallback threshold (max-height 520px / max-width 1100px) is a guess; human tests on 1280x720. Merge to main only after human approves the one-screen feel.
- Total Ask DOM IDs is 25 (including `panel-ask`, 24 child IDs including `doc-reset-cancel-btn`).
- Feasibility risk notes from Brain review:
  1. Explore/HNSW canvas uses width:100%; height:auto, so max-height alone will distort/crop it and break hover/zoom coordinates; Phase 2 needs JS sizing from the wrapper (canvas.js).
  2. Fallback media query max-height: 520px is a guess; human will test threshold on a 1280x720 laptop window.
  3. Settings 'fits without scroll at 900px' is INFERRED only.
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
