# Project Handoff

Last updated: 2026-11-15 by SYNC-006

## 1. Current Status

VectorDB v2 has been completely built across all 9 phases (P0 to P8). Following human browser review on 2026-11-14, Tasks T-034 through T-038 resolved confirmed UI issues, test edge cases, and glass-box response mappers. Following visual rejection of T-040 ("no fun at all", line noise, patched overrides), Task T-041 rebuilt the UI layer under "Quiet Studio". Task T-042 addressed batched human review items across toolbars, compare canvas bars, summary table column visibility, HNSW topology viewport budgeting, native control restyling, and shared empty states. Task T-043 implemented the reference-guided Settings redesign with a live status rail, fixed Compare empty state restoration, transformed Ask glass-box latency breakdown to a tidy grid, converted the Documents drawer to an absolute slide-over panel preserving chat centering, reduced CSS `!important` to 3, and expanded test coverage.

Following human review of Settings (long single scroll rejected), Task T-046 rebuilt Settings into a one-screen 3-column panel grid of filled surface panels (--bg-panel, no borders, no shadows) chosen by the human from an AI mockup (structure and feel only). Human liked the 3-column panel grid concept. Following human review of T-046, Task T-047 polished Settings to fill available width and height, but height/width stretching made panels hollow and sparse. Pending task T-048 (Settings: content-sized panels, balanced columns, left-aligned header) was planned and written by Brain but NOT executed, and was CANCELLED/superseded by ADR-047.

Following human visual rejection of T-049 Compare layout (2026-11-14; empty card / skeleton stayed visible over results, 8 rows not 10, side-by-side metrics/bars), Task T-050 rebuilt the Compare tab from a new human-approved AI mockup (layout and feel only, using our tokens and DOM IDs). Implemented as a 3-column Studio panel grid (`.compare-grid`): Column 1 holds benchmark controls, progress indicator, and Summary Metrics; Column 2 and Column 3 show either a clean mutually-exclusive centered empty state (`#compare-empty-state` with secondary action button) or results (`#compare-results-card`, `display: contents`) consisting of Column 2 stacked metric bar charts (latency, distances, recall across Brute Force, KD-Tree, HNSW) and Column 3 scrollable Top-k Diff table showing all 10 rows with match badges.

Following human screenshot review of T-050, Task T-051 resolved 6 observed defects structurally: removed `.table-container` wrapper class from diff scroll and summary table, eliminating the 320px max-height cap and nested `--bg-raised` boxes so all 10 diff rows fit without page scroll; added thin quiet scrollbars; placed match/diff badges directly after ID text with 6px gap in a fixed-grid table (`width: calc((100% - 36px) / 3)`) with headers left-aligned to cell text; removed hollow bottom area in left panel with content-sized summary section; formatted Median cell strictly in microseconds without extra `(0.0 ms)` suffix; unclipped Recall@k column; cleared chart canvases to transparent removing dark background box; made chart rows compact with sleek 8px bars and matching panel titles. Registered browser tests expanded to 99.

Following human screenshot review of T-051, Task T-052 restored the full-height equal panel layout from T-050 (reversing the mistaken T-051 "content-sized" change on Compare): `.compare-grid` fills available height with equal columns (`align-items: stretch`, `height: 100%`), bars spaced calmly across panel height as in T-050, while strictly preserving all T-051 diff table fixes (zero nested boxes, narrow # column, equal result columns, inline badge next to ID, no visible scrollbar when 10 rows fit, no gutter, Median only in us, transparent chart canvases, matching panel titles).

Task T-053 resolved Compare tab stale results and empty state presentation. Added `resetCompareView()` to wipe Summary Metrics, status text, progress bar, chart canvases, diff table, and cached report data when: (a) collection is changed, (b) collection count is 0, or (c) Compare tab is activated (via `#tab-btn-compare` click, `MutationObserver` on `#panel-compare` class, or `window.focus`). Empty panel titles dynamically adapt via helper `getCompareEmptyStateConfig`: 'Collection is empty' (Demo), 'No documents yet' (Docs), and 'No benchmark yet' (unbenchmarked populated collection). Registered browser unit tests expanded to 105 (6 new tests).

Task T-054 replaced the 3 middle-column Compare bar charts with the human-approved design from AI mockups (ADR-045). Added HTML panel headers with SVG line icons (`clock`, `layers`/`stack`, `target` in `web/js/icons.js`), bold titles ("Latency (µs)", "Distance Computations", "Recall@k"), and muted subtitles ("Lower is better", "Higher is better"); thicker solid horizontal bars (14-18px) with rounded right ends and mono value labels; hairline x-axes with tick marks, muted tick labels, and centered axis titles; pure helper `niceAxis(maxValue)` (~5-6 ticks) and `mapChartRows(metricKey, report, latencies)` reading real server responses. Registered browser unit tests expanded to 113 (8 new pure-logic tests).

Following human approval of the full set of 7 AI mockups (ADR-047, superseding Quiet Studio), Task T-055 initiated the Redesign v3 on branch `ui-redesign-v3`. T-055 established the unified design foundation (3 dark surfaces `#09090b`, `#121215`, `#18181c`, amber accent `#d9a441`, radii 6/10/14px, hairlines restricted to tables/metric strips/sidebar dividers, zero box-shadows), app shell (brand header, timestamped Recent Chats with `+` action, footer with `Ollama online` / `v0.4.0` status pills), and completely rebuilt the Ask tab (centered 860px viewport, empty state with chips matching `01-ask-empty.png`, results view with user avatar timestamps, assistant layers logo, citation pills, glass-box accordion with 3-part chunk cards, 5-column latency metric tiles with amber Total tile, 3 action buttons matching `02-ask-results.png`, and slide-over `.ask-docs-drawer`).

Task T-055b investigated the 2 failing tests reported by human on `/tests.html` (111/113 passed). Found `realBenchmarkFixture` had been defined inside the T-050 `describe` closure, making it `undefined` in the T-054 `describe` suite added on `ui-quiet-studio`. Moved `realBenchmarkFixture` to module scope in `web/js/tests/test_compare.js`. Scoping fix uncovered a secondary bug in `mapChartRows` (`web/js/compare_helpers.js:552` passes `latencies = null` into `extractChartMetrics` which does `latencies[alg]` throwing `TypeError: Cannot read properties of null (reading 'brute')`). Documented as ISS-049; stopped without touching production code per instructions.

Task T-055c resolved the secondary bug in `extractChartMetrics` (`web/js/compare_helpers.js:414` now normalizes null/undefined `latencies` to an empty object, allowing fallback to `latency_us`), replaced the hex literal `#ffffff` at line 701 with `THEME.white` from `web/js/colors.js` (achieving zero hex literals outside `:root` and `colors.js`), and added a pure-logic test for null latencies bringing registered tests to 114. Top-k control (`#ask-k-input`) was restored as a compact quiet control next to algorithm select in the Ask composer, and the Command Palette button (`#open-palette-btn`) was restored as a visible ghost search-icon button in the sidebar footer (functioning in both expanded and 56px collapsed rail) (decisions by Brain, delegated design, ADR-049).

Task T-056 executed the complete master build of Redesign v3 across 6 sequential phases on branch `ui-redesign-v3` (ADR-048):
- **Phase 0 (Commit `515ff77`)**: Ask polish & canvas color sync. Synchronized `web/js/colors.js` text tokens (`#f4f4f5`, `#a1a1aa`, `#71717a`) to match `:root` CSS tokens; updated test assertions in `test_colors.js`; verified Ask chip text, page-header subtitle, and glass-box title.
- **Phase 1 (Commit `7b2be62`)**: Explore tab rebuild from `03-explore.png`. Large rounded 2D PCA panel with PC1/PC2 axis ticks and titles, document cluster legend with counts and Demo neutral swatch, star query with line links and neighbor ID labels, right query sidebar with Project & Search amber primary button and Nearest neighbours list cards displaying distance and similarity, and shared empty-state component.
- **Phase 2 (Commit `8abdef3`)**: HNSW tab rebuild from `04-hnsw.png`. Fixed-width compact layer slider (`L0..Ln`), "HNSW Graph — Layer Ln" header, entry point ring with `Entry (Ln)` badge, query star with `Query` badge, right search path trace panel with Random amber primary button, step playback controls with step counter, stat tiles for current node/dist/layer and search statistics, and bottom topology summary metric strip (Nodes, Max level, Entry point).
- **Phase 3 (Commit `d9a4097`)**: Compare tab rebuild from `05-compare-results.png` & `06-compare-empty.png`. Panel headers with subtitles ("Benchmark Setup", "Summary Metrics", "Top-k ground truth diff"), preserved 3-column equal-height layout (T-052), 3 stacked bar charts with ADR-045 axis design, 10 unclipped diff rows with inline match badges, and calm mutually exclusive empty state with secondary button.
- **Phase 4 (Commit `f45e51b`)**: Settings tab rebuild from `07-settings.png`. One-screen 3-column grid of content-sized filled surface panels with calm padding (eliminating hollow stretching): Col 1 Server status (live status dot, version, dimension/metric, HNSW params, models list, demo memory), Col 2 Demo collection form + Insert random (single primary amber button `+ Insert`), Col 3 Chat history, Documentation links, and quiet soft-red Danger zone.
- **Phase 5 (Commit `1f5b093`)**: Consistency sweep across all 5 tabs. Verified strictly <= 1 primary amber button per view across all states, zero dead styles, `!important` count = 2 (<= 3), `box-shadow` count = 0, zero hex literals outside `:root` and `colors.js`, docs synchronized (ADR-048, ISS-049 fixed).

### Complete Commits List for T-055 and T-056:
- `7dc5cf6`: T-055 A: design tokens, shared components and app shell
- `48dd7ab`: T-055 B: Ask tab empty and results state
- `79693eb`: docs: T-055 sync
- `00dbfcd`: T-055b: define real benchmark fixture for mapChartRows tests
- `f59cf68`: T-055c: null-safe latencies in extractChartMetrics, white from colors.js, test
- `b12c488`: T-055c: restore top-k control and palette button
- `ac98680`: docs: T-055c sync
- `515ff77`: T-056 P0: Ask polish and canvas color sync
- `7b2be62`: T-056 P1: Explore tab from mockup 03
- `8abdef3`: T-056 P2: HNSW tab from mockup 04
- `d9a4097`: T-056 P3: Compare tab from mockups 05 and 06
- `f45e51b`: T-056 P4: Settings tab from mockup 07
- `1f5b093`: T-056 P5: consistency sweep

### Verification Status Breakdown:
- **Human-Confirmed (Real Browser & Terminal)**:
  - C++ hermetic suite: 118/118 passed (529,813 assertions).
  - Browser tests: `/tests.html` 114/114 passing (human confirmed on 2026-11-15 after T-055c).
  - Web safety automated scanner: 100% clean (zero innerHTML/outerHTML, strict CSP verified).
  - CSS metrics: `!important` count = 2, `box-shadow` count = 0, zero hex literals outside `:root` and `colors.js`.
  - Git state: clean tracked files on branch `ui-redesign-v3`.
- **Builder-Reported (Visual States NOT YET TESTED)**:
  - All visual UI rendering across all 5 tabs in Redesign v3 is reported as "not tested (visual)" pending human review and screenshot capture at 100% zoom. Builder claims of visual accuracy are never proof.

### T-056 decisions:
- P0: Synced canvas text colors in `colors.js` to `:root` tokens `#f4f4f5`, `#a1a1aa`, `#71717a` because canvas rendered slightly warmer beige than HTML text.
- P1: Mapped Explore query input to textarea placeholder matching mockup 03 query text while retaining full form submit and k parameter.
- P1: Explore neighbor list rendered as individual rounded cards with file icon, title, chunk subtitle, distance, and similarity matching mockup 03 while keeping table semantics.
- P1: Displayed axis ticks and titles (PC1, PC2) on the 2D PCA canvas matching mockup 03.
- P2: Restyled HNSW layer label to `Layer L<n>` with compact fixed-width slider to avoid toolbar wrapping.
- P2: Rendered entry point ring with `Entry (L<n>)` badge and query star with `Query` badge on HNSW canvas matching mockup 04.
- P2: Restyled HNSW trace sidebar into step counter, stat tiles (current node, distance, layer), and search statistics tiles (distance comps, nodes visited, visited per layer) matching mockup 04.
- P2: Placed topology summary at the bottom of the HNSW tab as a metric strip with hairline dividers (Nodes, Max level, Entry point) matching mockup 04.
- P3: Added bold titles and muted subtitles ("Benchmark Setup", "Summary Metrics", "Top-k ground truth diff") matching mockup 05 while retaining T-052 full-height 3-column equal grid.
- P4: Sized Settings panels to content with calm padding in a 3-column grid (`align-items: start`, `height: auto`), eliminating T-047 hollow vertical stretching.
- P4: Excluded fake mockup controls (Auto-save toggle, Export/Import collection, System max context/chunk size) while retaining all real engine controls.
- P5: Strictly enforced at most 1 primary button (`.btn-primary`) per view in every state across all tabs.

### Primary Button Count Audit:
| Tab | State | Primary Amber Buttons (`.btn-primary`) | Target Button |
| :--- | :--- | :---: | :--- |
| Ask | Empty | 1 | `#ask-submit-btn` (Composer send) |
| Ask | Results | 1 | `#ask-submit-btn` (Composer send) |
| Explore | Demo Collection | 1 | `#explore-demo-random-btn` (Random Query) |
| Explore | Docs Collection | 1 | `#explore-query-docs-btn` (Project & Search) |
| Explore | Empty | 0 | None (Insert Demo Vectors is `.btn-secondary`) |
| HNSW | Demo | 1 | `#hnsw-trace-random-btn` (Random) |
| HNSW | Docs | 0 | None (Step trace unavailable for Docs; notice shown) |
| Compare | Demo (Results) | 1 | `#compare-demo-random-btn` (Benchmark Random Query) |
| Compare | Docs (Results) | 1 | `#compare-docs-run-btn` (Run Benchmark) |
| Compare | Empty | 0 | None (Initial run button is `.btn-secondary`) |
| Settings | Default | 1 | `#demo-insert-random-btn` (+ Insert) |

### Deviations from Mockup:
| Tab | Mockup Feature | Real Implementation & Reason |
| :--- | :--- | :--- |
| Explore | Mockup showed kb-computer-networks | Real collection select has "Demo Vectors" and "Document Chunks" |
| Explore | Mockup showed 4 hardcoded cluster legends | Real Docs legend dynamically lists ingested document titles with chunk counts; Demo shows neutral amber swatch |
| HNSW | Mockup showed kb-computer-networks | Real collection select has "Demo" and "Docs" |
| Compare | Mockup showed Query Count & algorithm checkboxes | Real Compare uses Repetitions (1/3/5/10/20) and benchmarks all 3 algorithms simultaneously |
| Compare | Mockup diff table showed query sentences and checkmarks | Real diff table shows ground truth Brute Force vs KD-Tree vs HNSW ID matches at ranks 1-10 with inline badges |
| Settings | Mockup showed System panel (max context, chunk size/overlap) | Real RAG chunk settings belong in document ingest drawer; not global server settings |
| Settings | Mockup showed Auto-save toggle & Export/Import | Real persistence is `--data-dir <path>` on server startup; no runtime toggle exists |
| Settings | Mockup showed llama3.1:8b | Real server reports actual installed Ollama models via API (e.g. llama3.2:latest) |
| :--- | :--- | :--- |
| Explore | Mockup showed kb-computer-networks | Real collection select has "Demo Vectors" and "Document Chunks" |
| Explore | Mockup showed 4 hardcoded cluster legends | Real Docs legend dynamically lists ingested document titles with chunk counts; Demo shows neutral amber swatch |
| HNSW | Mockup showed kb-computer-networks | Real collection select has "Demo" and "Docs" |
| Compare | Mockup showed Query Count & algorithm checkboxes | Real Compare uses Repetitions (1/3/5/10/20) and benchmarks all 3 algorithms simultaneously |
| Compare | Mockup diff table showed query sentences and checkmarks | Real diff table shows ground truth Brute Force vs KD-Tree vs HNSW ID matches at ranks 1-10 with inline badges |
| Settings | Mockup showed System panel (max context, chunk size/overlap) | Real RAG chunk settings belong in document ingest drawer; not global server settings |
| Settings | Mockup showed Auto-save toggle & Export/Import | Real persistence is `--data-dir <path>` on server startup; no runtime toggle exists |
| Settings | Mockup showed llama3.1:8b | Real server reports actual installed Ollama models via API (e.g. llama3.2:latest) |

- **Key Collaboration & Process Lessons**:
  - **Full Product-Level Redesign (ADR-047)**: Human approved 7 AI mockups saved in `docs/mockups/` representing one coherent design direction for the entire app. T-048 (Settings content-sized panels) is CANCELLED (superseded by ADR-047). Redesign v3 proceeds tab-by-tab with human screenshots after each task.
  - **AI Mockup Realism & Engine Constraints**: AI mockups invent controls the engine does not have. Mismatches to handle: Compare mockup shows Query Count, algorithm checkboxes, ms units and per-query match counts, but the real Compare has repetitions (1/3/5), one query run on all 3 algorithms, latency in microseconds and a rank-by-rank top-10 diff; Settings mockup shows System panel (max context, chunk size/overlap), Auto-save toggle, Export/Import collection, storage quota, uptime, model llama3.1:8b which are not real (model is llama3.2; persistence is the --data-dir flag); Explore, HNSW and Settings have no empty-state mockup, use the shared empty-state component.
  - **Builder Claims vs Human Screenshots**: Builder reports claimed "zero deviations" multiple times while screenshots showed real deviations. Judge UI strictly by human screenshots at 100% browser zoom; builder claims of visual accuracy are never proof. Mark all visual aspects "not tested (visual)".
  - **Collaboration Preferences**: Human uses ChatGPT/Gemini for mockups and passes the chosen image. Brain gives outcome briefs; builder decides implementation. Human writes Hinglish (Hindi in Roman letters); Brain replies in short Hinglish with one question at a time.
  - **No Merge Until Approval**: Do not merge `ui-redesign-v3` to `main` and do not push until the human explicitly approves.

- **Branches**:
  - `ui-redesign`: Base v2 platform through T-039.
  - `ui-polish-2026`: T-040 experimental redesign (visually rejected by human due to line noise and box-shadows).
  - `ui-quiet-studio`: Quiet Studio branch through T-054 and SYNC-005.
  - `ui-redesign-v3`: Active branch containing T-055, T-055b, T-055c, and full T-056 master build (P0-P5).
  - `backup-before-v2`: Safety backup prior to v2 unfreeze, confirmed intact.
  - *Nothing pushed to remote origin.*
- **Human Verification Status**:
  - **Terminal**: C++ 118/118 (529,813 assertions, 117 run + 1 opt-in live-Ollama test skipped), scanner pass, CSS `!important` count 2, `box-shadow` count 0, zero hex color literals outside `:root` and `colors.js`.
  - **Browser Pure-Logic Tests**: `/tests.html` 114/114 passed [CONFIRMED: human real-browser run 2026-11-15 after T-055c].
  - **Screenshots (Historic / Quiet Studio)**: `/tests.html` 94/94 (after T-043); Compare results state seen after T-052 and T-054 and looked close to mockup.
  - **Redesign v3 Visual States**: All 5 tabs and app shell in Redesign v3 are reported as "not tested (visual)" pending human review and screenshot capture at 100% zoom.
- **T-050 to T-054 Commits on `ui-quiet-studio`**:
  - `c89aa04`, `17986e9`, `96170df`: T-050 Compare tab rebuild
  - `ee9cd78`, `cb04a73`, `231370e`: T-051 Compare diff table, badge, metric fixes
  - `bb0649c`, `0818c56`: T-052 Compare restore full-height equal panels, keep diff table fixes
  - `f22417b`, `d06fec0`: T-053 Compare reset stale results on empty or changed collection
  - `846c5a1`, `1b46ad2`: T-054 Compare new chart design (header, axis, ticks)
- **Automated Tests**:
  - C++ unit and integration tests: 118 / 118 passed (529,813 assertions).
  - Browser unit tests: 114 registered tests (`http://127.0.0.1:8080/tests.html`), 114/114 passing.
  - Web security scan: 28 files scanned, 100% clean (zero forbidden patterns, strict CSP verified).
- **Design System ("Redesign v3" / ADR-047) Principles Enforced**:
  - **Hairlines Only in Tables, Metric Strips, and Sidebar Dividers**: All card borders, panel outlines, and button borders eliminated.
  - **3 Dark Surfaces for Depth**: `--bg-page: #09090b`, `--bg-panel: #121215`, `--bg-raised: #18181c`.
  - **Zero Box-Shadows**: Grep `box-shadow` in `web/css` returns strictly 0 matches. Zero glow on status dots.
  - **Single Font Family**: IBM Plex Sans everywhere; IBM Plex Mono strictly restricted to code, IDs, numbers inside tables, and small size.
  - **Single Amber Accent**: `#d9a441`, with at most ONE primary amber button (`.btn-primary`) per view in every state across all 5 tabs.
  - **Radii Scale**: 6px (`--radius-sm`), 10px (`--radius-md`), 14px (`--radius-lg`).
  - **Shared 5-Tab Header & Empty States**: Every tab has `<div class="page-header">` with `<h1 class="page-header-title">` and clean subtitle. Shared `.empty-state` component used for Ask, Explore, Compare, and HNSW/Settings fallback.

> [!NOTE]
> Verification status:
> - **Human-confirmed by terminal on 2026-11-15**: C++ 118/118, scanner ALL CHECKS PASSED, `/tests.html` 114/114 passed, CSS `!important` count = 2, `box-shadow` count = 0, zero hex literals outside `:root` and `colors.js`.
> - **Redesign v3 Screenshots Pending**:
>   - Ask tab empty state (`01-ask-empty.png`)
>   - Ask tab results state (`02-ask-results.png`)
>   - Explore tab (`03-explore.png`)
>   - HNSW tab (`04-hnsw.png`)
>   - Compare tab empty state (`06-compare-empty.png`)
>   - Compare tab results state (`05-compare-results.png`)
>   - Settings tab (`07-settings.png`)
>   - Sidebar collapsed (56px icon rail)
>   - 125% browser zoom layout check across tabs.
> - **Paused / Superseded**:
>   - T-048 (Settings content-sized panels) is CANCELLED (superseded by ADR-047/ADR-048).
>   - T-054 optional chart polish (larger tick labels, more space between axis and bars, more icon contrast) NOT done.
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
  - `ui-quiet-studio`: Quiet Studio branch through T-054 and SYNC-005.
  - `ui-redesign-v3`: Active branch containing T-055 (foundation + shell + Ask tab).
  - `backup-before-v2`: Safety backup prior to v2 unfreeze, confirmed intact.
- **Tracking Status**: Local branch `ui-redesign-v3` without upstream tracking (commits unpushed per protocol; nothing pushed to origin).
- **Working Tree**: Clean tracked files; only untracked test logs in `results/logs/`.
- Note: Git state in docs can go stale after pushes; always trust human's `git status -sb`.

---

## 5. Pending Human Actions

1. **Verify `/tests.html` in real browser**: Open `http://127.0.0.1:8080/tests.html` at 100% browser zoom and verify 114/114 tests pass.
2. **Screenshots review**: Capture screenshots at 100% browser zoom (1920x1080) for all 5 tabs and shell states:
   - Ask tab empty state (`01-ask-empty.png`)
   - Ask tab results state (`02-ask-results.png`)
   - Explore tab (`03-explore.png`)
   - HNSW tab (`04-hnsw.png`)
   - Compare tab empty state (`06-compare-empty.png`)
   - Compare tab results state (`05-compare-results.png`)
   - Settings tab (`07-settings.png`)
   - Sidebar collapsed (56px icon rail)
   - 125% zoom layout check across tabs
3. **License copyright name**: Fill `<YOUR NAME>` placeholder in `LICENSE`.
4. **Decide Linux/macOS support tier & release timing**: Decide official support tier for Linux/macOS (ISS-029) and timing of public GitHub release.
5. **No merge and no push**: Do NOT merge `ui-redesign-v3` into `main` and do NOT push to remote origin until approved.

---

## 6. Open Follow-ups & Roadmap

### Open Follow-ups
- **Redesign v3 verification (ADR-047, ADR-048)**:
  - T-055 (Foundation, app shell, Ask tab): Complete on `ui-redesign-v3`.
  - T-055b / T-055c (Null-safety, top-k & palette button restore, colors sync): Complete on `ui-redesign-v3`.
  - T-056 (Master build across P0-P5: Ask polish, Explore, HNSW, Compare, Settings, Consistency): Complete on `ui-redesign-v3`.
  - Pending: Human screenshot review against `docs/mockups/`. Brain will review screenshots and write ONE batched fix task if any visual adjustments are needed.
- **T-048**: CANCELLED (superseded by ADR-047).
- Optional C++ unit test for ISS-006 ingest rollback.

### Roadmap (Not Started)
- **Hybrid search (BM25 + RRF)**: Requires inverted index and rank fusion; on roadmap, but strictly out of scope for v2.
- **Cross-encoder reranking**: Second-pass neural reranker for retrieved candidate chunks.
- **Automated browser E2E click tests**: Headless browser execution suite (Playwright / Selenium).
- **Real Linux/macOS desktop environment testing**: Real physical environment validation beyond CI.

---

## 7. Recommended Next Step

1. Human opens `http://127.0.0.1:8080/tests.html` in browser at 100% zoom and confirms 114/114 passing.
2. Human captures 100% zoom screenshots (1920x1080) of all 5 tabs (both empty and results where applicable), collapsed sidebar, and 125% zoom check.
3. Brain compares the screenshots with `docs/mockups/` and batches any visual fixes into ONE task.
4. No merge of `ui-redesign-v3` to `main` and no push to origin.

---

## 8. Important Warnings (Fragile Areas)

- **Zero-innerHTML rule**: Never introduce `innerHTML`, `outerHTML`, or `insertAdjacentHTML` in `web/js/`. Always verify using `powershell -ExecutionPolicy Bypass -File .\scripts\check_web_safety.ps1`.
- **Strict POST Content-Type**: Every HTTP `POST` route requires header `Content-Type: application/json` (send `{}` for empty bodies); returns HTTP 415 otherwise.
- **No mutex held during Ollama calls**: In `src/rag.cpp`, never hold internal collection mutexes during network/Ollama inference calls.
- **Canvas zero-dimension guard**: Check `isCanvasDrawable` before drawing on hidden or unmeasured canvases to prevent `DOMException`.
- **No push without human instruction**: Do not run `git push`, do not merge to `main`, and do not modify remote repository state without explicit human instruction.
