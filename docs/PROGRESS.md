# Project Progress

Last updated: 2026-11-14 by T-045

## 1. Current Phase: VectorDB v2 Glass-Box Chat & Learning Platform (Task T-033 Complete across all 9 Phases P0-P8, Branch `ui-quiet-studio`)

**Direction Change (2026-11-14)**: ADR-017 (engine freeze) was cancelled by the human after safety backup (`backup-before-v2`). Direction pivoted to an open-source, fully offline, transparent "glass-box" vector database and RAG learning product (ADR-029). The aggressive T-033 master build unfreezing the engine and implementing the full glass-box product across 9 phases (P0 to P8) is 100% complete on branch `ui-redesign`. All 9 phases are completed and committed:
- **P0**: Pre-flight unfreezing (ADR-029, ADR-030, ADR-031), CSS fixes, HNSW toolbar stabilization.
- **P1**: Multi-turn history support in `/api/ask` and `/api/ask/stream` (capped to 6 messages, 3000 chars).
- **P2**: Unified HNSW search path trace (`POST /api/hnsw/trace` with `"collection": "demo" | "docs"` and query text embedding).
- **P3**: Versioned binary persistence format (`--data-dir`, atomic `.tmp` rename), dynamic document deletion (`DELETE /api/docs/:id`), and index rebuilding (ADR-032, ADR-033).
- **P4**: Design foundation (4px spacing scale `--space-1` to `--space-8`, explicit type scale `--text-xs` to `--text-2xl`, shared components `.card`, `.page-header`, `.empty-state`, `.skeleton`, `.toast`, `.kbd`, and zero-dependency SVG icon registry `web/js/icons.js` with 14 line icons).
- **P5**: New app shell (collapsible sidebar ~260px to ~56px icon rail, recent chats list, bottom Ollama status and shortcut hint, Command Palette `Ctrl+K`, Toast notifications). All existing DOM IDs preserved.
- **P6**: Ask tab glass-box chat (multi-turn persistent chat with localStorage, auto-growing composer, citation pill interactions, collapsible Documents drawer with sample loader and per-doc delete).
- **P7**: Glass-box panels & educational layer (retrieval chunks, latency breakdown, mini 2D PCA canvas, compare benchmark button, HNSW search path trace, `web/js/learn_content.js` with 7 plain-language explainers, info popovers on all tabs, guided tour).
- **P8**: Release readiness (MIT `LICENSE`, `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `docs/LEARNING_GUIDE.md`, `.github/workflows/ci.yml`, browser unit tests expanded to 84/84 passing - builder's claim at that time, real was 83/84; see ISS-030).
- **637fd58**: T-034: Fix stale docs (license, test count, persistence magic header)
- **83c1257**: T-035: Align ISS-006 ingest rollback documentation in `docs/API.md`
- **d1c6a3d**: T-036 A: Fix citation parser test assertion and `/tests.html` scroll
- **d5df34a**: T-036 B: Ask tab `.page-header` alignment, `<details>` advanced controls, guided empty state, Explore deep link
- **aaaa6c6**: T-036 C: Explore empty-state variance text clear, Compare header fit, Settings P7 additions, sidebar version footer
- **cf79729**: docs: Sync verification and gotchas for T-036
- **b401029**: T-037: Small fixes after human verification (empty compare box hidden, trace fields fix, persistence health derivation)
- **a57c573**: T-038: Fix compare button in ask glass-box (`algorithms` mapping, latency bars, toast on error, 4 unit tests)
- **T-039**: Docs polish - fix stale and false claims (removed non-existent dot-product metric, corrected HNSW speedup claims, synced demo script with current UI, unified KD-tree dimension wording, documented POST /api/hnsw/trace fields, updated architecture directory tree).
- **T-040**: Full-app UI polish on branch `ui-polish-2026` (reviewed by human, rejected visually due to remaining line noise, patched overrides, and box-shadows). Status: REJECTED VISUALLY.
- **T-041**: Rebuild the UI layer properly - "Quiet Studio" on branch `ui-quiet-studio`. Clean structural rewrite in 6 phased commits (`e495d64`, `9e4d24e`, `3c49374`, `0e08c3a`, `e1880fe`, `1882064`) enforcing 3 dark surfaces, zero box-shadows, zero non-sidebar lines, and IBM Plex Sans typography. Status: IMPLEMENTED (visual verification pending).
- **T-042**: Quiet Studio fixes after human screenshot review on branch `ui-quiet-studio`. Batched fixes in 3 commits (`eeb605e`, `280c3b2`, `f466c41`) addressing compact single-row toolbars, compare 3-row canvas fitting, summary metrics recall column (ISS-024), unified canvas panels, custom native controls, shared empty states, and expanding test suite to 93 tests. Status: IMPLEMENTED (partially verified by human screenshots on 2026-11-14: `/tests.html` 93/93, Explore toolbar, Compare 3 charts & 5 columns, Settings sans status; remaining items visual verification pending).
- **T-043**: Settings redesign (reference-guided) + pending Ask/Compare polish on branch `ui-quiet-studio`. Two commits (`c84a913`, `34e403a`) implementing live status rail (Variant E), unboxed stacked settings, compare empty state restoration (ISS-035), Ask latency breakdown grid (ISS-037), slide-over document drawer preserving chat center (ISS-036), widened mini select (ISS-038), reducing CSS `!important` to 3, and expanding test suite to 94 tests. Status: IMPLEMENTED (visual verification pending).

All 118 C++ tests pass (529,813 assertions, human-confirmed by terminal after T-043). 94 browser unit tests registered (94/94 confirmed passed by human screenshot at `/tests.html`). 100% clean web safety scan.

---

## 2. Completed Features

| Feature | Primary Files | Evidence | Status |
| :--- | :--- | :--- | :--- |
| **Distance Kernels** (Euclidean $L_2$, Cosine, Manhattan $L_1$) | `include/vectordb/distance.hpp`, `src/distance.cpp` | [CONFIRMED] | TESTED |
| **Exact Brute-Force Index** (Linear scan, max-heap top-$k$) | `include/vectordb/brute_force.hpp`, `src/brute_force.cpp` | [CONFIRMED] | TESTED |
| **Flat-Array KD-Tree Index** (Contiguous heap indexing, median split) | `include/vectordb/kd_tree.hpp`, `src/kd_tree.cpp` | [CONFIRMED] | TESTED |
| **HNSW Proximity Graph** (Malkov & Yashunin 2018, heuristic pruning) | `include/vectordb/hnsw.hpp`, `src/hnsw.cpp` | [CONFIRMED] | TESTED |
| **Thread-Safe Collection Manager** (Multi-index synchronization, mutex) | `include/vectordb/collection.hpp`, `src/collection.cpp` | [CONFIRMED] | TESTED |
| **2D PCA Projection Engine** (Power iteration, Rayleigh deflation) | `include/vectordb/pca.hpp`, `src/pca.cpp` | [CONFIRMED] | TESTED |
| **Document Boundary Chunker** (UTF-8 safe, sentence boundaries, danda) | `include/vectordb/chunker.hpp`, `src/chunker.cpp` | [CONFIRMED] | TESTED |
| **Local Ollama HTTP Client** (Embeddings `/api/embed`, chat `/api/chat`) | `include/vectordb/ollama_client.hpp`, `src/ollama_client.cpp` | [CONFIRMED] | TESTED |
| **Offline Grounded RAG Pipeline** (Citation synthesis, prompt defence, multi-turn) | `include/vectordb/rag.hpp`, `src/rag.cpp` | [CONFIRMED] | TESTED |
| **Automated RAG Evaluation Harness** (14 evaluation questions, CSV export) | `include/vectordb/rag_eval.hpp`, `src/rag_eval.cpp`, `src/rag_eval_main.cpp` | [CONFIRMED] | TESTED |
| **Atomic Binary Persistence** (`--data-dir`, `.bin` format, atomic rename) | `include/vectordb/persistence.hpp`, `src/persistence.cpp` | [CONFIRMED] | TESTED |
| **Dynamic Document Deletions** (`DELETE /api/docs/:id`, stable index rebuild) | `src/api.cpp`, `src/rag.cpp`, `src/collection.cpp` | [CONFIRMED] | TESTED |
| **REST HTTP Server** (30 registered API endpoints, static web hosting) | `include/vectordb/api.hpp`, `src/api.cpp`, `src/server_main.cpp` | [CONFIRMED] | TESTED |
| **Server Security Hardening** (Host rebinding, Origin check, CSRF 415) | `src/server_main.cpp`, `tests/test_server_http.cpp` | [CONFIRMED] | TESTED |
| **Real-time SSE Token Streaming** (`/api/ask/stream` endpoint) | `src/server_main.cpp`, `src/api.cpp`, `web/js/sse.js` | [CONFIRMED] | TESTED |
| **Modern App Shell & Navigation** (Collapsible sidebar, Command Palette `Ctrl+K`) | `web/js/sidebar.js`, `web/js/palette.js` | [CONFIRMED] | TESTED |
| **Glass-Box Ask Chat & Explainability** (Multi-turn, citations, PCA, trace, benchmark) | `web/js/ask.js`, `web/css/app.css` | [CONFIRMED] | TESTED |
| **Educational Learning Layer & Guided Tour** (7 explainers, info popovers, tour) | `web/js/learn_content.js`, `docs/LEARNING_GUIDE.md` | [CONFIRMED] | TESTED |
| **Automated Web Safety Scanner** (Zero innerHTML, strict CSP verified) | `scripts/check_web_safety.ps1` | [CONFIRMED] | TESTED |
| **Hermetic C++ Unit & Integration Test Suite** (118 registered tests) | `tests/*.cpp`, `tests/fake_ollama.hpp` | [CONFIRMED] | TESTED |
| **Browser Pure-Logic Unit Test Suite** (94 registered unit tests) | `web/tests.html`, `web/js/tests/*.js` | [CONFIRMED] | TESTED |
| **Atomic Multi-Chunk Rollback** (Transactional vector rollback on mid-ingest failure, not covered by automated test) | `include/vectordb/rag.hpp`, `src/rag.cpp` | [CONFIRMED: src/rag.cpp:155-160] | IMPLEMENTED |
| **Quiet Studio UI Design System** (Zero lines except sidebar edge, depth via 3 dark surfaces, zero box-shadows, zero table row underlines, IBM Plex Sans typography, 94 browser unit tests) | `web/css/app.css`, `web/js/colors.js` | [CONFIRMED: ADR-038] | IMPLEMENTED (visual not tested) |
| **Quiet Studio Layout & Controls Tuning** (Compact single-row toolbars, 170px compare canvas 3-row fit, 440px sidebar unclipped summary metrics, unified canvas panels, custom native controls) | `web/css/app.css`, `web/js/compare_helpers.js` | [CONFIRMED: ADR-039] | IMPLEMENTED (partially tested by screenshots) |
| **Settings Status Rail & Glass-Box Polish** (Variant E unboxed settings + boxed live status rail, compare empty state restored, Ask latency grid, slide-over drawer preserving chat center) | `web/index.html`, `web/css/app.css`, `web/js/settings.js`, `web/js/compare.js`, `web/js/ask.js` | [CONFIRMED: ADR-040] | IMPLEMENTED (visual not tested) |

---

## 3. In Progress / Half-Done Features

*No features are currently half-implemented or in progress. All v2 phases P0-P8 are complete.*

---

## 4. Not Started / Roadmap Features

| Feature | Target / Specification | Evidence | Status |
| :--- | :--- | :--- | :--- |
| **Hybrid Search (BM25 + RRF)** | Lexical BM25 score fusion with dense vector cosine similarity | [CONFIRMED: README.md] | NOT STARTED |
| **Cross-Encoder Reranking** | Second-pass neural reranker for retrieved candidate chunks | [CONFIRMED: README.md] | NOT STARTED |
| **Automated Browser E2E Click Tests** | Headless browser execution suite (Playwright / Selenium) | [CONFIRMED: docs/KNOWN_ISSUES.md:15] | NOT STARTED |
| **Streaming Document Ingestion** | Real-time progress updates during multi-document chunk embedding | [CONFIRMED: docs/KNOWN_ISSUES.md:9] | NOT STARTED |


