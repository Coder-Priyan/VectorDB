# Project Handoff

Last updated: 2026-11-14 by T-034

## 1. Current Status

VectorDB v2 has been completely built across all 9 phases (P0 to P8) on branch `ui-redesign`. VectorDB is now an open-source, fully offline, transparent "glass-box" vector database and RAG learning platform.

> [!NOTE]
> T-033 numbers 118/118 C++ tests and clean web safety scan are confirmed by the human terminal on 2026-11-14. Browser tests 84/84, UI behavior and persistence restart are still unverified by the human.

Per git log on branch `ui-redesign`, all 9 phases of Task T-033 are completed and committed:
- **Phase P0 (Commit `b26212c`)**: Pre-flight unfreezing (ADR-029, ADR-030, ADR-031), CSS disabled-state fix, HNSW toolbar slider stabilization.
- **Phase P1 (Commit `4586a07`)**: Multi-turn history support in `/api/ask` and `/api/ask/stream` (capped to last 6 messages, 3,000 characters).
- **Phase P2 (Commit `b857406`)**: Unified HNSW search path trace (`POST /api/hnsw/trace` with `"collection": "demo" | "docs"` and chunk metadata). Fixed ISS-009.
- **Phase P3 (Commit `afc420c`)**: Versioned binary persistence format (`--data-dir`, atomic `.tmp` rename, ADR-032) and dynamic document deletion (`DELETE /api/docs/:id`, ADR-033).
- **Phase P4 (Commit `9e95ac8`)**: Design foundation (4px spacing scale, font scales, card/header tokens, `web/js/icons.js` zero-dependency SVG icon registry with 14 line icons).
- **Phase P5 (Commit `c25d8a6`)**: New app shell (collapsible sidebar ~260px to ~56px icon rail, recent chats list, Ollama status footer, Command Palette `Ctrl+K`, Toast notifications).
- **Phase P6 (Commit `cbc57a9`)**: Ask tab glass-box chat (multi-turn localStorage chat persistence, auto-growing composer, citation pill interactions, collapsible Documents drawer with sample loader and per-doc delete).
- **Phase P7 (Commit `72cbde3`)**: Glass-box panels & educational layer (retrieval chunks with similarity meters, latency breakdown, mini 2D PCA canvas, compare benchmark button, HNSW search path trace, `web/js/learn_content.js` with 7 plain-language explainers, info popovers on all tabs, interactive guided tour).
- **Phase P8 (Commit `cae814b`)**: Open-source release readiness (MIT `LICENSE`, rewritten `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `docs/LEARNING_GUIDE.md`, `.github/workflows/ci.yml`, browser unit tests in `web/js/tests/test_v2.js` expanded to 84/84 passing).

**Verification Metrics**:
- C++ unit and integration tests: 118 / 118 passed (529,813 assertions).
- Browser unit tests: 84 / 84 passed (`http://127.0.0.1:8080/tests.html`).
- Web security scan: 25 files scanned, zero forbidden patterns, strict CSP verified.
- Server REST/SSE endpoints: 30 registered endpoints.
- Button hierarchy: at most ONE `.btn-primary` per visible view.
- DOM ID preservation: 100% of all existing tab DOM IDs preserved (total IDs in `web/index.html` expanded from 113 to 135).

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

1. **(a) License copyright name**: Fill the `<YOUR NAME>` copyright holder placeholder in `LICENSE`.
2. **(b) Decide Linux/macOS support**: Primary development and testing are currently on Windows 11 (MSYS2 UCRT64 toolchain); GitHub Actions CI workflow is configured for Linux and Windows; decide official release support tiers.
3. **(c) Submission & viva timeline**: Academic report submission, viva defense date, and presentation slides are handled independently by the human; Brain focuses strictly on software development.
4. **(d) Real-browser verification of the whole new UI**:
   - Save screenshots at 1920x1080 for all 5 tabs (Ask, Explore, HNSW, Compare, Settings).
   - Test 1366x768 viewport on Ask tab and observe inner scroll behavior.
   - Ask tab workflow: ingest sample document (`web/samples/vectordb_intro.txt` or custom text), ask 2 questions, test multi-turn context retention, and expand the "How this was answered" glass-box accordion (verify chunk similarity meters, latency badges, 2D PCA canvas, benchmark compare button, and HNSW search path trace button).
   - Test `--data-dir ./data` persistence: insert documents and vectors, shut down server, restart with `--data-dir ./data`, and confirm data is restored.
   - Verify `Ctrl+K` Command Palette navigation, sidebar collapse/expand toggle, and interactive guided tour.
   - Run `/tests.html` in browser and confirm 84 / 84 tests pass with zero browser console errors.
5. **(e) Confirm external backup**: Confirm external backup and git branch `backup-before-v2` can be restored if ever needed.
6. **(f) Possible follow-up decisions**: Hybrid search (BM25 + RRF) and cross-encoder reranking remain strictly NOT in scope of T-033.

---

## 6. Open Decisions / Known Gaps

- **Hybrid search (BM25 + RRF)**: Requires inverted index and rank fusion; on roadmap, but strictly out of scope for T-033.
- **Cross-encoder reranking**: Second-pass neural reranking requires ONNX or local model execution; out of scope for T-033.
- **Follow-up question condensation strategy**: Currently passes the raw conversation history window (last 6 messages / 3,000 characters) directly into the RAG context; evaluate based on human manual testing whether query condensation/rephrasing is necessary.
- **Merge of `ui-redesign` into `main`**: Branch `ui-redesign` contains all v2 commits; human authority decides when and whether to merge into `main`.
- **GitHub repository publication timing**: Timing of public repository release or GitHub sync is decided by the human.
- **[UNCLEAR] ADR numbering alignment**: Brain chat prompt drafted Product Positioning as ADR-032 and Project Name as ADR-033, while T-033 Phase P3 had already recorded Binary Persistence as ADR-032 and Document Deletion as ADR-033 in git. To prevent conflicts or breaking existing commits, Persistence and Deletion remain ADR-032 & ADR-033, and Product Positioning and Project Name are recorded as ADR-034 & ADR-035 in `docs/DECISIONS.md`.

---

## 7. Recommended Next Step

Brain reviews the T-033 report critically, then writes **ONE batched fix task (T-034)** from the human's screenshots and terminal output.

---

## 8. Important Warnings (Fragile Areas)

- **Zero-innerHTML rule**: Never introduce `innerHTML`, `outerHTML`, or `insertAdjacentHTML` in `web/js/`. Always verify using `powershell -ExecutionPolicy Bypass -File .\scripts\check_web_safety.ps1`.
- **Strict POST Content-Type**: Every HTTP `POST` route requires header `Content-Type: application/json` (send `{}` for empty bodies); returns HTTP 415 otherwise.
- **No mutex held during Ollama calls**: In `src/rag.cpp`, never hold internal collection mutexes during network/Ollama inference calls.
- **Canvas zero-dimension guard**: Check `isCanvasDrawable` before drawing on hidden or unmeasured canvases to prevent `DOMException`.
- **No push without human instruction**: Do not run `git push`, do not merge to `main`, and do not modify remote repository state without explicit human instruction.
