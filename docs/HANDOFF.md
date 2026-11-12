# Project Handoff

Last updated: 2026-11-12 by T-014

## 1. Current Status
VectorDB engine is in a stable, verified, and frozen state. Active development is UI/UX redesign on branch `ui-redesign`. Phase 1 (foundation), Phase 2 (Ask tab), Phase 3 (Settings tab), and Phase 4a (toolbar regression fix, Explore and HNSW tab redesign, dark canvas colors) are complete across `web/css/app.css`, `web/index.html`, `web/js/explore.js`, `web/js/explore_helpers.js`, `web/js/hnsw.js`, and `web/js/hnsw_helpers.js`. All 19 Explore DOM IDs, 26 HNSW DOM IDs, 11 Settings DOM IDs, 23 Ask DOM IDs, 62 browser logic tests, and 111 C++ tests (529,746 assertions) are verified.

## 2. Last Work Done (From Git)
- **Task T-014** (branch `ui-redesign`): Redesign Phase 4a complete.
  1. *Toolbar Regression & Empty Answer Fix* (commit `5ff39d8`): Fixed input width regression from `af6a101` where `width: 100%` on `.input-text, .input-select, .textarea-field` expanded toolbar selects to 100% width across Explore, HNSW, and Compare. Scoped `width: 100%` strictly to `.form-stack`, `.two-col-grid`, `#panel-ask .ask-sidebar`, and `#panel-settings`, setting `width: auto` for `.tab-toolbar select, .player-bar select`. Removed tall amber left-border box on empty Ask answer state (`.answer-box.empty { border-left: none; padding-left: 0; min-height: auto; }`).
  2. *Explore Tab Redesign & Canvas Colors* (commit `98d1505`): Restructured `#panel-explore` to unboxed `.tab-toolbar` and `.viz-layout` (large canvas main area + ~320px narrow right query sidebar). Replaced PCA doc color palette with 8 desaturated warm/earth hex colors (`#d9a441`, `#529b67`, `#c47043`, `#9c8269`, `#a0616a`, `#849646`, `#c89f65`, `#708a78`), fallback `#807c74`, dark canvas background `#0a0a0a`, `#2a2a2a` axes, `#949087` 12px Plex Sans labels, off-white `#f0ede6` query star with `#0b0b0b` outline, thin amber `rgba(217, 164, 65, 0.45)` neighbor connecting lines, `#d9a441` neighbor circles, `#f0ede6` hovered circle. All blue, indigo, and violet shades eliminated. Preserved all 19 Explore DOM IDs.
  3. *HNSW Tab Redesign & Canvas Colors* (commit `cc91def`): Restructured `#panel-hnsw` to unboxed `.tab-toolbar` and `.viz-layout` (canvas + topology summary main area + ~320px right trace sidebar). Replaced `LAYER_COLORS` with `["#6e6a63", "#a67c2e", "#d9a441", "#f0ede6"]` (L0 muted gray, L1 dim amber, L2 bright amber, L3+ off-white). Updated offscreen edges to subtle gray `rgba(110, 106, 99, 0.25)` for layer 0 and amber `rgba(217, 164, 65, 0.45)` for higher layers. Entry point rendered off-white `#f0ede6` with amber `#d9a441` stroke (lineWidth 1.5). Search trace hops rendered with amber path `#d9a441` (lineWidth 2), visited nodes `#e2ded6`, active hop highlighted `#d9a441` with `#ffffff` stroke (lineWidth 1.5), off-white `#f0ede6` query star. Preserved all 26 HNSW DOM IDs.
- **Task T-013** (branch `ui-redesign`): Redesign Phase 3 complete. Fixed Ask sidebar two-col-grid overflow (`min-width: 0`, 100% width, box-sizing), stabilized `scrollbar-gutter` to prevent 7px tab horizontal shift, disabled question input spellcheck. Redesigned Settings tab into a single centered column (~720px) with 40px section gaps and hairline dividers: Server status table with muted sentence case labels and monospace numbers; Demo collection configuration 2-column grid and Insert random vectors row; Danger zone section with accurate explanation and red outline Reset button. Preserved all 11 Settings DOM IDs.
- **Task T-012** (branch `ui-redesign`): Redesign Phase 2 complete. Implemented shell fixes (Fix 1: removed duplicate border line under tab bar; Fix 2: removed tab active font-weight jump to prevent horizontal layout shift; Fix 3: styled `#demo-reset-btn` as destructive `.btn-danger`). Restructured `#panel-ask` in `web/index.html` and `web/css/app.css` to `.ask-layout`: ~320px left ingestion column with 2-column chunking grid and clean document cards; centered ~820px calm reading column with 4-row question input, unified search controls bar, borderless answer box with amber left rule, single-line telemetry string, and flat ruled source rows. Preserved all 23 DOM IDs and dynamic classes in `web/js/ask.js`.
- **Task T-011** (branch `ui-redesign`): Redesign Phase 1 foundation complete. Rewrote `web/css/app.css` with dark-only tokens, local IBM Plex Sans and Mono fonts, flat hairline borders, zero gradients/shadows, single amber accent (`#d9a441`), and dark scrollbars. Restyled app shell in `web/index.html` (brand, integrated nav tabs, status indicator with text Refresh button, removed light theme button). Removed `initTheme()` in `web/js/main.js` and removed `#2563eb` and `data-theme` across the codebase.
- **Task T-010** (branch `ui-redesign`): Minimalist polish of Ask mockup v2 (`web/mockup/ask.html`, `mockup.css`). Increased whitespace (15-16px text, 32-48px gaps), centered 820px reading column, reduced uppercase labels to 4, simplified borders, single-line telemetry, flat source rows, and fixed sidebar layout.
- **Task T-009** (branch `ui-redesign`): Downloaded official IBM Plex Sans and Mono `.woff2` fonts with license into `web/fonts/`; created static Ask tab mockup in `web/mockup/ask.html` and `web/mockup/mockup.css` in the Editor/Terminal direction; verified 100% compliance with strict CSP, zero forbidden patterns, and HTTP 200 via `vectordb_server.exe`.
- **Task T-006** (commit `c0585f1`): Cleaned up issue wording in `KNOWN_ISSUES.md` (removed leftover "In investigate queue" strings), recorded collaboration preferences (human handles viva/report/slides independently), and refreshed `HANDOFF.md` to match pushed state.
- **Task T-005** (commit `46e8cfc`): Recorded T-004 human verification across Settings and Ask tabs, corrected the 529,746 assertion count explanation, and confirmed push to `origin/main`.
- **Task T-004** (commits `2c92b6a`, `03d23d6`, `fe51206`, `c2cf8e4`, `c1ee64e`): Batched fix for ISS-018 to ISS-022 across backend stats (`memory_bytes`), web settings form sync (`efConstruction: 200`), title clearing after ingest, refusal-first V2 prompt with language-matching, Ollama models table row, regression tests, and documentation updates. Confirmed in real browser by human; pushed to `origin/main`.
- **Task T-003**: Read-only investigation of ISS-018..022 root causes and test count reconciliation (57 tests identified prior to T-004).
- **T-SYNC-001** (commit `e300385`): Recorded Brain chat knowledge into docs (verification status, ISS-018..022, ADR-015, viva talking points, collaboration preferences).
- **T-002** (commits `a57bd3f`, `d998065`, `2704c36`): Fixed demo/random field mismatch (frontend sent "count", server requires "n") in `web/js/api.js`, `web/js/settings.js`, `web/js/explore.js`.
- **T-001** (commits `2f9f9a4`, `1b0fa80`): Fixed doc errors (29 endpoints, no CI exists, severity of ISS-005/006, ingest wording).

## 3. Git State
- **Active Branch**: `ui-redesign` (branched from `main` at `689aa47`) [CONFIRMED: git status -sb]
- **Tracking Status**: Local branch `ui-redesign` without upstream tracking (commits unpushed per protocol).
- **Working Tree**: Clean (only untracked test logs in `results/logs/`) [CONFIRMED: git status -sb]
- Note: Git state in docs can go stale after pushes; always trust human's `git status -sb`.

## 4. Recommended Next Step
- Human verifies Phase 4a: Explore (hover, zoom, pan, random query, stored-ID query, docs collection) and HNSW (layer slider, trace play/prev/next/reset) plus /tests.html; then T-015 Compare.

## 5. UI Redesign Phase Plan
UI redesign phases (branch `ui-redesign`):
1. **Phase 1 (Foundation + Shell - T-011)**: Design tokens, local IBM Plex fonts, dark app shell, global controls, light theme removal. [COMPLETED]
2. **Phase 2 (Ask Tab - T-012)**: Full layout restructure of Ask tab matching approved minimalist mockup v2; shell fixes for tab line, tab width shift, and red destructive reset button. [COMPLETED]
3. **Phase 3 (Settings Tab - T-013)**: Clean industrial layout for server health, metrics, and demo reset controls. [COMPLETED]
4. **Phase 4a (Explore + HNSW Tabs - T-014)**: Toolbar width regression fix, unboxed toolbars, `.viz-layout` restructure, dark canvas colors (warm/earth palette, muted gray/amber HNSW layers, off-white query stars, amber trace path). [COMPLETED]
5. **Phase 4b (Compare Tab - T-015)**: Benchmark layout restructure, flat progress bar, comparison table wrapping, bar charts color harmonization. [NEXT]
6. **Phase 5 (Polish & Merge)**: Final responsiveness, remove `web/mockup/`, regression testing, merge to `main`.
*Dark only. Human verifies in browser after each phase.*

## 6. Pending Human Actions
- All previous action items resolved by human decision on 2026-11-12:
  - Roadmap features (hybrid search, reranking, disk persistence, delete): ON HOLD by human decision; do not start unless explicitly requested by the human.
  - Post-T-004 manual re-check of Explore, HNSW, Compare tabs: SKIPPED by human decision; do not ask again.
  - Verification task T-007 (docs vs git audit): SKIPPED by human decision.

## 7. Open Decisions / Known Gaps
- Known UI gaps to address:
  - Compare tab bars and table wrapping: deferred to T-015.
  - Native `alert()` in Settings reset/save: deferred to Phase 5 polish.
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
