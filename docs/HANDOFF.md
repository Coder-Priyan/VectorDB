# Project Handoff

Last updated: 2026-11-14 by T-051

## 1. Current Status

VectorDB v2 has been completely built across all 9 phases (P0 to P8). Following human browser review on 2026-11-14, Tasks T-034 through T-038 resolved confirmed UI issues, test edge cases, and glass-box response mappers. Following visual rejection of T-040 ("no fun at all", line noise, patched overrides), Task T-041 rebuilt the UI layer under "Quiet Studio". Task T-042 addressed batched human review items across toolbars, compare canvas bars, summary table column visibility, HNSW topology viewport budgeting, native control restyling, and shared empty states. Task T-043 implemented the reference-guided Settings redesign with a live status rail, fixed Compare empty state restoration, transformed Ask glass-box latency breakdown to a tidy grid, converted the Documents drawer to an absolute slide-over panel preserving chat centering, reduced CSS `!important` to 3, and expanded test coverage.

Following human review of Settings (long single scroll rejected), Task T-046 rebuilt Settings into a one-screen 3-column panel grid of filled surface panels (--bg-panel, no borders, no shadows) chosen by the human from an AI mockup (structure and feel only). Human liked the 3-column panel grid concept. Following human review of T-046, Task T-047 polished Settings to fill available width and height, but height/width stretching made panels hollow and sparse. Pending task T-048 (Settings: content-sized panels, balanced columns, left-aligned header) was planned and written by Brain but NOT executed yet.

Following human visual rejection of T-049 Compare layout (2026-11-14; empty card / skeleton stayed visible over results, 8 rows not 10, side-by-side metrics/bars), Task T-050 rebuilt the Compare tab from a new human-approved AI mockup (layout and feel only, using our tokens and DOM IDs). Implemented as a 3-column Studio panel grid (`.compare-grid`): Column 1 holds benchmark controls, progress indicator, and Summary Metrics; Column 2 and Column 3 show either a clean mutually-exclusive centered empty state (`#compare-empty-state` with secondary action button) or results (`#compare-results-card`, `display: contents`) consisting of Column 2 stacked metric bar charts (latency, distances, recall across Brute Force, KD-Tree, HNSW) and Column 3 scrollable Top-k Diff table showing all 10 rows with match badges.

Following human screenshot review of T-050, Task T-051 resolved 6 observed defects structurally: removed `.table-container` wrapper class from diff scroll and summary table, eliminating the 320px max-height cap and nested `--bg-raised` boxes so all 10 diff rows fit without page scroll; added thin quiet scrollbars; placed match/diff badges directly after ID text with 6px gap in a fixed-grid table (`width: calc((100% - 36px) / 3)`) with headers left-aligned to cell text; removed hollow bottom area in left panel with content-sized summary section; formatted Median cell strictly in microseconds without extra `(0.0 ms)` suffix; unclipped Recall@k column; cleared chart canvases to transparent removing dark background box; made chart rows compact with sleek 8px bars and matching panel titles; made grid top-aligned with content-sized panels. Registered browser tests expanded to 99.

- **Key Collaboration & Process Lessons**:
  - **Dual Mockup Rule**: The mockup given to the builder in T-049 showed only the empty state; always get BOTH empty-state and results mockups before implementing so the builder does not invent results layouts.
  - **Builder Claims vs Human Screenshots**: Builder reports claimed "zero deviations" three times (T-046, T-047, T-049) while screenshots showed real deviations. T-050 builder claimed all 10 diff rows fit; real screenshot showed 8. Judge UI strictly by human screenshots at 100% browser zoom; builder claims of visual accuracy are never proof. Mark all visual aspects "not tested (visual)".
  - **ADR Numbering Gap**: Note that ADR-042 was reserved for T-048 (Settings content-sized panels) which was written but not executed, so ADR-042 is missing from `DECISIONS.md`. Any future Settings task must use ADR-045 or higher.
  - **Collaboration Preferences**: Human uses ChatGPT/Gemini for mockups and passes the chosen image. Brain gives outcome briefs; builder decides implementation. Human writes Hinglish (Hindi in Roman letters); Brain replies in short Hinglish with one question at a time.
  - **No Merge Until Approval**: Do not merge `ui-quiet-studio` to `main` until the human approves both the Settings fix (T-048) and the new Compare design (T-050/T-051).

- **Branches**:
  - `ui-redesign`: Base v2 platform through T-039.
  - `ui-polish-2026`: T-040 experimental redesign (visually rejected by human due to line noise and box-shadows).
  - `ui-quiet-studio`: Active branch containing T-041 (Quiet Studio rebuild), T-042 (batched fixes), T-043 (Settings redesign + polish), T-044/T-045 (docs fixes), T-046 (Settings 3-column panel grid rebuild), T-047 (Settings full width/height), T-049 (superseded), T-050 (Compare tab rebuild from human-approved mockup), and T-051 (Compare tab defect fixes).
  - `backup-before-v2`: Safety backup prior to v2 unfreeze, confirmed intact.
  - *Nothing pushed to remote origin.*
- **Human Verification on 2026-11-14**:
  - **Terminal**: C++ 118/118 (529,813 assertions, 117 run + 1 opt-in live-Ollama test skipped), scanner pass, CSS `!important` count 3 human-confirmed after T-046. NOT yet human-confirmed after T-047/T-049/T-050/T-051: `/tests.html` count (last confirmed 94/94 after T-043; 99 registered in T-051), C++ tests, scanner.
  - **Screenshots**: `/tests.html` 94/94 passed (2026-11-14, after T-043); Explore toolbar single row and canvas panel OK; Compare after benchmark shows 3 charts with all 3 algorithms and 5 summary columns (ISS-024 fixed); Settings font larger and persistence status in sans.
- **T-051 Commits on `ui-quiet-studio`**:
  - `ee9cd78` ui-quiet-studio: T-051 Compare diff table fill, badge alignment, remove nested surfaces
  - `cb04a73` ui-quiet-studio: T-051 Compare left panel, chart spacing, content-sized panels
- **Automated Tests**:
  - C++ unit and integration tests: 118 / 118 passed (529,813 assertions).
  - Browser unit tests: 99 registered tests (`http://127.0.0.1:8080/tests.html`), including 5 pure-logic tests for Compare diff rows, chart metrics extraction, and transparent bar chart rendering.
  - Web security scan: 28 files scanned, 100% clean (zero forbidden patterns, strict CSP verified).
- **Design System ("Quiet Studio") Principles Enforced**:
  - **Zero Lines**: Allowed lines are strictly the right boundary of the sidebar (`border-right: 1px solid var(--border-line)`) and accessibility focus ring (`outline: 2px solid var(--accent); outline-offset: 2px;`). All card borders, panel outlines, button borders, and table row underlines eliminated.
  - **3 Dark Surfaces for Depth**: `--bg-page: #09090b`, `--bg-panel: #121215`, `--bg-raised: #18181c` + generous whitespace. All canvas areas wrapped in `--bg-panel` with `--bg-canvas` surfaces.
  - **Zero Box-Shadows**: Grep `box-shadow` in `web/css` returns strictly 0 matches. Zero glow on status dots.
  - **Single Font Family**: IBM Plex Sans everywhere; IBM Plex Mono strictly restricted to code, IDs, numbers inside tables, and small size. Metric values and headings are never mono.
  - **Shared 5-Tab Header & Empty States**: Every tab has `<div class="page-header">` with `<h1 class="page-header-title">`. Ask and Compare use shared `.empty-state` component.
  - **Button System**: At most ONE `.btn-primary` (solid amber) per visible view; filled quiet secondary (`var(--bg-raised)`), ghost, and soft red tint danger (`var(--danger-bg)` with no border).
  - **Compact Single-Row Toolbars**: Selects and inputs sized to content; `.tab-toolbar` does not stretch controls to 800px or wrap across multiple rows on standard desktop screens.
  - **Slide-Over Drawer**: Ask tab documents drawer slides over as an overlay (`position: absolute; right: 0;`), preserving exact viewport centering of the chat column.

> [!NOTE]
> Verification status:
> - **Human-confirmed by terminal on 2026-11-14**: C++ 118/118, scanner ALL CHECKS PASSED, CSS `!important` 3 confirmed by human terminal after T-046; git log commits up to `febe43a` (T-047) and `e2fc065` (T-049).
> - **Human-confirmed by screenshots on 2026-11-14**: `/tests.html` 94/94 (after T-043), 5 tabs at 1920x1080, Ask chat flow, Explore Docs PCA, Open Explore deep link, Compare in Ask (3 rows), Trace (6 nodes), Settings new sections, footer removed, Explore toolbar 1 row, Compare 3 side-by-side charts, Compare summary table 5 columns unclipped.
> - **Pending Human Screenshots**:
>   - Settings tab: T-047 state seen (hollow panels, fix pending via T-048).
>   - Compare tab: new design (mockup pending; T-049 rejected).
>   - Ask tab: glass-box latency breakdown formatted as tidy label+value tiles in sans font.
>   - Ask tab: chat column remaining perfectly centered when Documents inventory drawer is opened or closed.
>   - HNSW tab at 1366x768 and 1920x1080 with topology summary.
>   - Sidebar collapsed (56px icon rail).
>   - 125% browser zoom layout check across all 5 tabs.
>   - Small-screen fallback below 1100px.
> - **Visual items marked**: All visual rendering items marked "not tested (visual)" until human screenshots confirm.


Per git log on branch `ui-redesign` and `ui-polish-2026`:
- **Phase P0 (Commit `b26212c`)**: Pre-flight unfreezing (ADR-029, ADR-030, ADR-031), CSS disabled-state fix, HNSW toolbar slider stabilization.
- **Phase P1 (Commit `4586a07`)**: Multi-turn history support in `/api/ask` and `/api/ask/stream` (capped to last 6 messages, 3,000 characters).
- **Phase P2 (Commit `b857406`)**: Unified HNSW search path trace (`POST /api/hnsw/trace` with `"collection": "demo" | "docs"` and chunk metadata). Fixed ISS-009.
- **Phase P3 (Commit `afc420c`)**: Versioned binary persistence format (`--data-dir`, atomic `.tmp` rename, ADR-032) and dynamic document deletion (`DELETE /api/docs/:id`, ADR-033).
- **Phase P4 (Commit `9e95ac8`)**: Design foundation (4px spacing scale, font scales, card/header tokens, `web/js/icons.js` zero-dependency SVG icon registry with 14 line icons).
- **Phase P5 (Commit `c25d8a6`)**: New app shell (collapsible sidebar ~260px to ~56px icon rail, recent chats list, Ollama status footer, Command Palette `Ctrl+K`, Toast notifications).
- **Phase P6 (Commit `cbc57a9`)**: Ask tab glass-box chat (multi-turn localStorage chat persistence, auto-growing composer, citation pill interactions, collapsible Documents drawer with sample loader and per-doc delete).
- **Phase P7 (Commit `72cbde3`)**: Glass-box panels & educational layer (retrieval chunks with similarity meters, latency breakdown, mini 2D PCA canvas, compare benchmark button, HNSW search path trace, `web/js/learn_content.js` with 7 plain-language explainers, info popovers on all tabs, interactive guided tour).
- **Phase P8 (Commit `cae814b`)**: Open-source release readiness (MIT `LICENSE`, rewritten `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `docs/LEARNING_GUIDE.md`, `.github/workflows/ci.yml`, browser unit tests in `web/js/tests/test_v2.js`).
- **T-034 (Commit `637fd58`)**: Fix stale docs (MIT license reference, 118 C++ test count, VDBC/VDBR persistence header documentation).
- **T-035 (Commit `83c1257`)**: Align ISS-006 ingest rollback documentation in `docs/API.md`, `docs/PROGRESS.md`, and `docs/KNOWN_ISSUES.md`.
- **T-036 (Commits `d1c6a3d`, `d5df34a`, `aaaa6c6`, `cf79729`)**: Batched UI fixes after human real-browser review:
  - **Group A (`d1c6a3d`)**: Fixed citation parser test assertion in `web/js/tests/test_v2.js` and enabled vertical scrolling on `/tests.html`.
  - **Group B (`d5df34a`)**: Ask tab header alignment to `.page-header` pattern, collapsible advanced chunking controls `<details>`, guided empty state with sample loader and 3 questions, Explore deep linking with prefill, removed empty mini 2D PCA canvas.
  - **Group C (`aaaa6c6`)**: Explore empty-state variance text clearing, Compare Summary Metrics table clipping fix (no horizontal scrollbar), Settings tab P7 additions (persistence status, two-step Clear Chat History, documentation links card filling vertical space), and moved version badge to sidebar footer while removing the verbose app footer.
- **T-037 (Commit `b401029`)**: Small fixes after T-036 human verification (hidden empty box under Compare algorithms until results exist, HNSW trace in Ask fixed to read `tRes.trace` and `tRes.stats.nodesVisited` instead of `visited_nodes`, verified persistence health JSON derivation with and without `--data-dir`, updated verification status in docs).
- **T-038 (Commit `a57c573`)**: Fix silent "Compare algorithms on this query" button in Ask glass-box (mapped server response `algorithms` field to display rows via new `web/js/ask_helpers.js`, added compact latency bars with swatches, added toast and inline notifications on error, added 4 pure-logic browser unit tests bringing test suite to 88 tests).
- **T-040 (Commits `c04dd79`, `c734f36`, `0ebae37`, `d7713c6`, `d438d41`)**: Full-app quiet luxury UI redesign across all 5 tabs and app shell. Implemented in 5 phases (tokens, colors module, zero hex outside tokens; spacious sidebar bottom; centered 820px Ask chat; 380px visual sidebars & unclipped compare table; centered 1040px Settings metrics grid with sans numbers and single unclipped scroll). All visual aspects reported as "not tested" pending human screenshots.

---

## 2. Inventory of New Files Created in v2

- `include/vectordb/persistence.hpp` - Versioned binary serialization header
- `src/persistence.cpp` - Atomic binary persistence implementation
- `tests/test_persistence.cpp` - Persistence and document deletion hermetic tests
- `web/js/icons.js` - Zero-dependency SVG line icon registry (14 icons)
- `web/js/sidebar.js` - Collapsible navigation sidebar and recent chats controller
- `web/js/palette.js` - Keyboard-first Command Palette (`Ctrl+K` / `Cmd+K`)
- `web/js/learn_content.js` - Plain-language learning explainers and interactive guided tour
- `web/js/tests/test_v2.js` - Browser unit tests for v2 functionality (15 tests)
- `web/samples/vectordb_intro.txt` - Sample document for zero-friction testing
- `LICENSE` - MIT License with `<YOUR NAME>` copyright holder placeholder
- `CONTRIBUTING.md` - Open-source contribution guidelines
- `CODE_OF_CONDUCT.md` - Community standards pledge
- `docs/LEARNING_GUIDE.md` - 6-module vector search & RAG curriculum
- `.github/workflows/ci.yml` - Continuous integration workflow for Windows and Linux

---

## 3. Running VectorDB v2

```powershell
# Build
cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build

# Run C++ unit and integration tests
.\build\vectordb_tests.exe

# Run web safety scanner
powershell -ExecutionPolicy Bypass -File .\scripts\check_web_safety.ps1

# Run server with persistence enabled
.\build\vectordb_server.exe --port 8080 --web-dir web --data-dir ./data
```
Open `http://127.0.0.1:8080` in any modern web browser. Automated browser unit tests can be verified at `http://127.0.0.1:8080/tests.html`.

---

## 4. Git State

- **Branches**:
  - `ui-redesign`: Base v2 platform + T-039 docs polish.
  - `ui-polish-2026`: T-040 experimental redesign (visually rejected by human due to line noise and box-shadows).
  - `ui-quiet-studio`: Active branch containing T-041 (Quiet Studio rebuild), T-042 (batched fixes), T-043 (Settings redesign + polish), SYNC-003, T-044 (browser test count fix to 94), T-045 (human C++ test verification), T-046 (Settings 3-column panel grid rebuild), T-047 (Settings full width/height & roomier panels), and T-049 (Compare tab redesign).
  - `backup-before-v2`: Safety backup prior to v2 unfreeze, confirmed intact.
- **Tracking Status**: Local branch `ui-quiet-studio` without upstream tracking (commits unpushed per protocol; nothing pushed to origin).
- **Working Tree**: The human's `git status -sb` shows only untracked files in `results/logs/`.
- Note: Git state in docs can go stale after pushes; always trust human's `git status -sb`.

---

## 5. Pending Human Actions

1. **(a) License copyright name**: Fill `<YOUR NAME>` placeholder in `LICENSE`.
2. **(b) Add Inter font files (optional)**: Add Inter `.woff2` files to `web/fonts/` (pending human action; currently IBM Plex Sans enforced).
3. **(c) Take screenshots for unverified / reported areas (Quiet Studio)**:
   - Settings tab: T-047 state seen (hollow panels, fix pending via T-048); not tested (visual).
   - Compare tab: T-051 defect fixes implemented (results state, empty state, collection switch at 100% zoom); not tested (visual).
   - Browser unit tests: `/tests.html` at 100% zoom (verify 99/99 tests pass in real browser).
   - Ask tab: glass-box latency breakdown formatted as tidy label+value tiles in sans font; chat column remaining centered with zero horizontal shift when Documents inventory drawer is opened or closed.
   - HNSW tab at 1366x768 and 1920x1080 with topology summary.
   - Sidebar collapsed (56px icon rail).
   - 125% browser zoom layout check across all 5 tabs.
   - Persistence restart screenshot with `--data-dir ./data`.
   - `Ctrl+K` Command Palette navigation.
   - Interactive guided tour.
4. **(d) Decide merge of `ui-quiet-studio` into `main`**: Do NOT merge `ui-quiet-studio` to `main` until the human approves both the Settings fix (T-048) and the new Compare design (T-050/T-051).
5. **(e) Decide Linux/macOS support tier & release timing**: Decide official support tier for Linux/macOS (ISS-029) and timing of public GitHub release.

---

## 6. Open Follow-ups & Roadmap

### Open Follow-ups
- Pending task T-048 execution (Settings: content-sized panels, balanced columns, left-aligned header).
- Human screenshot verification of Settings (after T-048) and Compare (T-051) at 100% browser zoom.
- Optional C++ unit test for ISS-006 ingest rollback.
- Human addition of Inter font files to `web/fonts/` (ISS-041).

### Roadmap (Not Started)
- **Hybrid search (BM25 + RRF)**: Requires inverted index and rank fusion; on roadmap, but strictly out of scope for v2.
- **Cross-encoder reranking**: Second-pass neural reranker for retrieved candidate chunks.
- **Automated browser E2E click tests**: Headless browser execution suite (Playwright / Selenium).
- **Real Linux/macOS desktop environment testing**: Real physical environment validation beyond CI.

---

## 7. Recommended Next Step

1. Human reviews Compare T-051 in real browser at 100% zoom and verifies via screenshots (results state, empty state, collection switch).
2. Human decides on pending task T-048 (Settings content-sized panels) or other polish before merging `ui-quiet-studio` to `main`.
3. Once Settings and Compare are approved, decide merge of `ui-quiet-studio` into `main`.
4. Address pending non-code items: LICENSE name placeholder, Linux/macOS tier & release timing.

---

## 8. Important Warnings (Fragile Areas)

- **Zero-innerHTML rule**: Never introduce `innerHTML`, `outerHTML`, or `insertAdjacentHTML` in `web/js/`. Always verify using `powershell -ExecutionPolicy Bypass -File .\scripts\check_web_safety.ps1`.
- **Strict POST Content-Type**: Every HTTP `POST` route requires header `Content-Type: application/json` (send `{}` for empty bodies); returns HTTP 415 otherwise.
- **No mutex held during Ollama calls**: In `src/rag.cpp`, never hold internal collection mutexes during network/Ollama inference calls.
- **Canvas zero-dimension guard**: Check `isCanvasDrawable` before drawing on hidden or unmeasured canvases to prevent `DOMException`.
- **No push without human instruction**: Do not run `git push`, do not merge to `main`, and do not modify remote repository state without explicit human instruction.
