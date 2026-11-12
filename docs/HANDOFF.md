# Project Handoff

Last updated: 2026-11-12 by T-015

## 1. Current Status
VectorDB engine is in a stable, verified, and frozen state. Active development is UI/UX redesign on branch `ui-redesign`. Phase 1 (foundation), Phase 2 (Ask tab), Phase 3 (Settings tab), Phase 4a (Explore + HNSW tabs), and Phase 4b (Compare tab redesign, flat progress bar, table wrapping prevention, taupe/moss/amber palette with zero blue) are complete across `web/css/app.css`, `web/index.html`, `web/js/compare.js`, `web/js/compare_helpers.js`, and `web/js/ask.js`. All 20 Compare DOM IDs (plus new `compare-progress-fill`), 19 Explore DOM IDs, 26 HNSW DOM IDs, 11 Settings DOM IDs, 23 Ask DOM IDs, 62 browser logic tests, and 111 C++ tests (529,746 assertions) are verified.

## 2. Last Work Done (From Git)
- **Task T-015** (branch `ui-redesign`): Redesign Phase 4b complete.
  1. *Compare Tab Layout & Progress Bar* (commit `17d1a28`): Restructured `#panel-compare` in `web/index.html` and `web/css/app.css` to unboxed `.tab-toolbar` (collection and repetitions dropdowns with indicative timing note) and `.viz-layout` (wide `.viz-main` for Summary Metrics and results; ~320px `.viz-sidebar` for Demo/Docs benchmark query parameters and flat thin progress bar `#compare-progress-fill` in `#2a2a2a` track). Enforced `overflow-x: auto` on `.table-container` to guarantee page body never scrolls horizontally. Styled Ground Truth diff badges with muted green `#529b67` for match and amber `#d9a441` for diff. Added explicit `empty` class handling in `web/js/ask.js` on doc reset. Preserved all 20 Compare DOM IDs.
  2. *Compare Canvas & Swatch Colors, No Blue* (commit `7ae5cf0`): Replaced blue/green algorithm colors with earthy palette in `web/js/compare_helpers.js` and `web/css/app.css`: brute `#9c8269` (taupe), kdtree `#708a78` (moss), hnsw `#d9a441` (amber), fallback `#807c74`. Configured dark canvas bar charts with `#0a0a0a` background, `#2a2a2a` rules, `#949087` IBM Plex Sans titles/labels, `#f0ede6` text, and monospace numbers. Fully eliminated all blue hex occurrences across active production web assets.
- **Task T-014** (branch `ui-redesign`): Redesign Phase 4a complete.
  1. *Toolbar Regression & Empty Answer Fix* (commit `5ff39d8`): Fixed input width regression from `af6a101` by scoping `width: 100%` strictly to form stacks / grids and restoring `width: auto` on toolbar selects. Lightened empty answer box state on Ask tab.
  2. *Explore Tab Redesign & Canvas Colors* (commit `98d1505`): Restructured `#panel-explore` to unboxed `.tab-toolbar` and `.viz-layout`. Replaced PCA doc color palette with 8 desaturated warm/earth hex colors (`#d9a441`, `#529b67`, `#c47043`, `#9c8269`, `#a0616a`, `#849646`, `#c89f65`, `#708a78`), fallback `#807c74`, dark canvas background `#0a0a0a`, `#2a2a2a` axes, `#949087` labels, off-white query star. Preserved all 19 Explore DOM IDs.
  3. *HNSW Tab Redesign & Canvas Colors* (commit `cc91def`): Restructured `#panel-hnsw` to unboxed `.tab-toolbar` and `.viz-layout`. Replaced `LAYER_COLORS` with `["#6e6a63", "#a67c2e", "#d9a441", "#f0ede6"]`. Updated offscreen edges to subtle gray `rgba(110, 106, 99, 0.25)` and amber `rgba(217, 164, 65, 0.45)`. Entry point rendered off-white with amber stroke. Search trace rendered with amber path, `#e2ded6` visited nodes, active hop highlighted `#d9a441` with white stroke. Preserved all 26 HNSW DOM IDs.
  - *Human Verification Note*: Human verified T-014 command checks in their terminal (clean git state, id diff: only theme-toggle-btn removed per ADR-019, blue only in Compare files, src/tests/CMake diff empty, scanner pass). Browser verification of Phase 4a: pending human browser testing.
- **Task T-013** (branch `ui-redesign`): Redesign Phase 3 complete (Settings tab industrial layout, 2-column config grid, Danger zone reset card, Ask overlap fix, stable scrollbar gutter, question input spellcheck disabled).
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
- Human verifies Phase 4b Compare in browser: Benchmark Demo Random Query, Benchmark ID, Document benchmark, repetition passes, timing bars, Ground Truth diff table wrapping, /tests.html; then proceed to Phase 5.

## 5. UI Redesign Phase Plan
UI redesign phases (branch `ui-redesign`):
1. **Phase 1 (Foundation + Shell - T-011)**: Design tokens, local IBM Plex fonts, dark app shell, global controls, light theme removal. [COMPLETED]
2. **Phase 2 (Ask Tab - T-012)**: Full layout restructure of Ask tab matching approved minimalist mockup v2; shell fixes for tab line, tab width shift, and red destructive reset button. [COMPLETED]
3. **Phase 3 (Settings Tab - T-013)**: Clean industrial layout for server health, metrics, and demo reset controls. [COMPLETED]
4. **Phase 4a (Explore + HNSW Tabs - T-014)**: Toolbar width regression fix, unboxed toolbars, `.viz-layout` restructure, dark canvas colors (warm/earth palette, muted gray/amber HNSW layers, off-white query stars, amber trace path). [COMPLETED]
5. **Phase 4b (Compare Tab - T-015)**: Unboxed toolbar, `.viz-layout` restructure, horizontal table scrolling container, flat thin amber progress bar, taupe/moss/amber palette with zero blue. [COMPLETED]
6. **Phase 5 (Polish & Merge)**:
   - Remove temporary directory `web/mockup/`
   - Replace native `alert()` / `confirm()` in Settings reset/save with inline message / banner
   - Docs cleanup (`PROJECT_CONTEXT.md` references to "Current Active Branch: main" and "zero third-party fonts" are stale)
   - Note on `DEMO_SCRIPT.md`: "red star" is now off-white star (human handles viva/presentation docs independently)
   - Final responsiveness pass, browser regression test, merge `ui-redesign` to `main`.
*Dark only. Human verifies in browser after each phase.*

## 6. Pending Human Actions
- All previous action items resolved by human decision on 2026-11-12:
  - Roadmap features (hybrid search, reranking, disk persistence, delete): ON HOLD by human decision; do not start unless explicitly requested by the human.
  - Post-T-004 manual re-check of Explore, HNSW, Compare tabs: SKIPPED by human decision; do not ask again.
  - Verification task T-007 (docs vs git audit): SKIPPED by human decision.

## 7. Open Decisions / Known Gaps
- Known UI gaps to address:
  - Compare tab bars and table wrapping: FIXED in T-015.
  - Native `alert()` in Settings reset/save: scheduled for Phase 5 polish.
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
