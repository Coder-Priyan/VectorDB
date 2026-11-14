# Project Handoff

Last updated: 2026-11-14 by SYNC-002

## 1. Current Status

VectorDB v2 has been completely built across all 9 phases (P0 to P8) on branch `ui-redesign`. VectorDB is now an open-source, fully offline, transparent "glass-box" vector database and RAG learning platform. Following human browser review on 2026-11-14, Tasks T-034 through T-038 resolved confirmed UI issues, test edge cases, and glass-box response mappers.

- **Active Branch**: `ui-redesign` (safety branch `backup-before-v2` confirmed intact).
- **Last Commit**: `a57c573` before SYNC-002; nothing pushed to remote.
- **Automated Tests**:
  - C++ unit and integration tests: 118 / 118 passed (529,813 assertions).
  - Browser unit tests: 88 registered tests (`http://127.0.0.1:8080/tests.html`).
  - Web security scan: 25 files scanned, 100% clean (zero forbidden patterns, strict CSP verified).
- **Server REST/SSE Endpoints**: 30 registered endpoints.
- **Button Hierarchy**: At most ONE `.btn-primary` per visible view.
- **DOM ID Preservation**: 100% of all existing tab DOM IDs preserved.

> [!NOTE]
> Verification status:
> - **Human-confirmed by terminal on 2026-11-14**: C++ 118/118 passed, scanner ALL CHECKS PASSED, git log commits up to `a57c573` (T-038).
> - **Human-confirmed by screenshots on 2026-11-14**: `/tests.html` 88/88 (after T-038), 5 tabs at 1920x1080, Ask chat flow, Explore Docs PCA, Open Explore deep link, Compare in Ask (3 rows), Trace (6 nodes), Settings new sections, footer removed.
> - **Still human-reported only (no screenshots)**: `--data-dir` persistence restart, Ctrl K, sidebar collapse, guided tour.
> - **Not verified**: 1366x768 layout, Ask New chat empty-state guided card.

Per git log on branch `ui-redesign`:
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

---

## 2. Inventory of New Files Created in v2

- `include/vectordb/persistence.hpp` - Versioned binary serialization header
- `src/persistence.cpp` - Atomic binary persistence implementation
- `tests/test_persistence.cpp` - Persistence and document deletion hermetic tests
- `web/js/icons.js` - Zero-dependency SVG line icon registry (14 icons)
- `web/js/sidebar.js` - Collapsible navigation sidebar and recent chats controller
- `web/js/palette.js` - Keyboard-first Command Palette (`Ctrl+K` / `Cmd+K`)
- `web/js/learn_content.js` - Plain-language learning explainers and interactive guided tour
- `web/js/tests/test_v2.js` - Browser unit tests for v2 functionality (10 tests)
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

- **Active Branch**: `ui-redesign` (safety branch `backup-before-v2` confirmed intact) [CONFIRMED: git branch]
- **Tracking Status**: Local branch `ui-redesign` without upstream tracking (commits unpushed per protocol).
- **Working Tree**: Clean on all tracked files (only untracked test logs in `results/logs/`) [CONFIRMED: git status -sb].
- Note: Git state in docs can go stale after pushes; always trust human's `git status -sb`.

---

## 5. Pending Human Actions

1. **(a) License copyright name**: Fill `<YOUR NAME>` placeholder in `LICENSE`.
2. **(b) Take screenshots for unverified / reported areas**:
   - Persistence restart with `--data-dir ./data`.
   - `Ctrl+K` Command Palette navigation.
   - Sidebar collapse to ~56px icon rail.
   - Interactive guided tour.
   - Ask New chat empty-state guided card with sample loader.
   - 1366x768 layout on Ask tab.
3. **(c) Decide merge of `ui-redesign` into `main`**: Branch `ui-redesign` contains all v2 commits; human authority decides when and whether to merge into `main` (not decided).
4. **(d) Decide Linux/macOS support tier & release timing**: Decide official support tier for Linux/macOS (ISS-029) and timing of public GitHub release.

---

## 6. Open Follow-ups (Planned for T-039) & Roadmap

### Open Follow-ups (Planned for T-039)
- Fix stale docs wording about Compare button.
- Note that `AUDIT_AND_HISTORY.md` is a historical snapshot; avoid rewriting history numbers.
- Optional C++ unit test for ISS-006 ingest rollback.
- Compare swatch colors are hardcoded in ask.js / CSS.
- Note HNSW is slower than brute force on 6 chunks (expected, small $N$); do not claim HNSW is faster in README or LEARNING_GUIDE for small collections.

### Roadmap (Not Started)
- **Hybrid search (BM25 + RRF)**: Requires inverted index and rank fusion; on roadmap, but strictly out of scope for v2.
- **Cross-encoder reranking**: Second-pass neural reranker for retrieved candidate chunks.
- **Automated browser E2E click tests**: Headless browser execution suite (Playwright / Selenium).
- **Real Linux/macOS desktop environment testing**: Real physical environment validation beyond CI.

---

## 7. Recommended Next Step

1. Human completes pending actions **(a)** (fill `<YOUR NAME>` in `LICENSE`) and **(b)** (take screenshots of persistence restart, `Ctrl+K`, sidebar collapse, guided tour, Ask New chat empty state, 1366x768 Ask).
2. Brain reviews screenshots.
3. Execute **T-039** (small docs polish and follow-ups).
4. Human decides on merging `ui-redesign` into `main`.

---

## 8. Important Warnings (Fragile Areas)

- **Zero-innerHTML rule**: Never introduce `innerHTML`, `outerHTML`, or `insertAdjacentHTML` in `web/js/`. Always verify using `powershell -ExecutionPolicy Bypass -File .\scripts\check_web_safety.ps1`.
- **Strict POST Content-Type**: Every HTTP `POST` route requires header `Content-Type: application/json` (send `{}` for empty bodies); returns HTTP 415 otherwise.
- **No mutex held during Ollama calls**: In `src/rag.cpp`, never hold internal collection mutexes during network/Ollama inference calls.
- **Canvas zero-dimension guard**: Check `isCanvasDrawable` before drawing on hidden or unmeasured canvases to prevent `DOMException`.
- **No push without human instruction**: Do not run `git push`, do not merge to `main`, and do not modify remote repository state without explicit human instruction.
