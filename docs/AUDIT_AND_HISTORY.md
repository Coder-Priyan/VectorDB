# Project Takeover Audit & History

Last updated: 2026-11-12 by T-004

## 1. Project History Reconstructed from Git

The VectorDB repository consists of 72 commits authored by `Coder-Priyan` spanning 7 development phases:
1. **Phase 1 (Commits `d677dea`–`bf4fef9`)**: Initial C++17 project scaffold, CMake configuration, basic vocabulary types, Euclidean/Cosine/Manhattan distance metrics, `BruteForceIndex` with exact max-heap search, and the initial 2D dataset benchmark executable.
2. **Phase 2 (Commits `22c1143`–`7237fa6`)**: Contiguous flat-array binary heap KD-Tree with median-split partitioning, lazy rebuilding, and invariant verification tests.
3. **Phase 3 (Commits `ce41103`–`8f9f7dc`)**: Hierarchical Navigable Small World (HNSW) proximity graph following Malkov & Yashunin (2018), including heuristic neighbor selection, level distribution tests, and recall benchmarks.
4. **Phase 4 (Commits `f28a8d1`–`8263eb4`)**: Matrix-free 2D Principal Component Analysis (PCA) with Rayleigh quotient deflation, Collection multi-index service layer, and comprehensive Recall@k evaluation suites.
5. **Phase 5 (Commits `4e52516`–`bb7282b`)**: Offline RAG pipeline integration: UTF-8 sentence boundary chunker, embedded `cpp-httplib` Ollama client for local embeddings and streaming chat, and automated answer scoring harness (`vectordb_rag_eval`).
6. **Phase 6 (Commits `c9c104e`–`b9292c2`)**: HTTP REST server (29 routes), DNS rebinding / Origin security hardening, SSE token streaming (`/api/ask/stream`), and the zero-dependency vanilla HTML5/ES6 web UI (Ask, Explore, HNSW, Compare, Settings).
7. **Phase 7 (Commits `dc82c36`–`1297c59`)**: Bug fixes for Docs collection HNSW graph counts and canvas tab-switch dimensions, CSRF Content-Type test coverage, and documentation reconciliation (removing unbuilt hybrid search claims, fixing test counts, and extending web safety scanner rules).

---

## 2. Audit Findings & Top 5 Risks

### System Strengths
- **Strictly Zero Cloud / Zero Telemetry**: Operates completely offline with zero external network dependencies [CONFIRMED: CMakeLists.txt].
- **Hermetic Testing**: 117 out of 118 C++ tests run without network access using an in-process mock HTTP server [CONFIRMED: tests/fake_ollama.hpp].
- **High Web Safety Discipline**: 100% free of `innerHTML`, `outerHTML`, or `eval()`; verified by automated scanner [CONFIRMED: scripts/check_web_safety.ps1].
- **Modern C++ Standards**: Clean build with zero warnings under `-Wall -Wextra -Wpedantic` [CONFIRMED: CMakeLists.txt:21].

### Top 5 Risks (Highest Severity First)
1. **Risk 1 (High - ISS-005): Zero Persistence (Data Volatility)**: All vectors, metadata, and document records reside purely in heap memory (`std::unordered_map`). A server shutdown or crash immediately loses all indexed documents (Reason: complete data loss on process shutdown or crash) [CONFIRMED: include/vectordb/collection.hpp:172].
2. **Risk 2 (Medium - ISS-006): Document Ingestion Rollback**: `RagPipeline::ingest` validates embeddings upfront. If vector insertion throws mid-loop (e.g. out of memory), partial chunk vectors are caught and rolled back via `removeBatch`, preventing orphaned vectors (implemented in `src/rag.cpp:155-160`, not covered by an automated test) [CONFIRMED: src/rag.cpp:155-160].
3. **Risk 3 (Medium): Unbounded Context Injection in RAG**: Top-$k$ chunks are always passed to the chat prompt regardless of similarity distance; irrelevant documents induce LLM hallucinations [CONFIRMED: src/rag.cpp:240].
4. **Risk 4 (Medium): Unauthenticated Network Exposure**: The server lacks TLS, API keys, or rate limiting. Running with `--host 0.0.0.0` disables Host validation and exposes endpoints to local network eavesdropping or unauthorized writes [CONFIRMED: src/server_main.cpp:177].
5. **Risk 5 (Medium): Lack of Dynamic Deletion/Update**: Neither `Collection` nor `RagPipeline` support deleting or modifying individual vectors/documents; updating a document requires a full wipe and re-index [CONFIRMED: include/vectordb/collection.hpp].

---

## 3. Docs vs Reality (False Claims Fixed During Audit)

| Claim in Old Docs | File & Line | Reality in Codebase | Resolution Status |
| :--- | :--- | :--- | :--- |
| "Hybrid search (BM25 + Dense Vectors with Reciprocal Rank Fusion)" | `README.md:7` | Feature was not implemented anywhere in C++ code | Removed claim, moved to Roadmap in commit `8c3f56f` |
| "Zero External Dependencies" | `web/index.html:246` | Server vendors `httplib.h` and `json.hpp` and requires local Ollama | Reworded to "runs fully offline - no cloud, no external vector DB" in commit `b147097` |
| "A gold star plotted at the query vector's projected coordinates" | `docs/DEMO_SCRIPT.md:56` | Query marker is rendered as a red star (`#ef4444`) with white stroke | Corrected color name to red in commit `79335c3` |
| `curl.exe -s -X POST http://127.0.0.1:8080/api/docs/reset` (no headers) | `docs/API.md:709` | Server rejected request with HTTP 415 `unsupported_media_type` | Added `-H "Content-Type: application/json" -d "{}"` in commit `79335c3` |
| "99 registered unit & integration tests" | `README.md:70` | Real test runner registers 111 C++ tests and 62 browser tests | Updated test counts in commit `5a1d2a4` and subsequent tasks |

---

## 4. Documentation Confidence Assessment

- **High Confidence**:
  - `docs/API.md`: Fully verified against `src/server_main.cpp` and `src/api.cpp`. All 29 endpoints match implemented routes and request schemas.
  - `docs/PROJECT_CONTEXT.md` & `docs/ARCHITECTURE.md`: Derived directly from `CMakeLists.txt`, file system layout, and C++ class declarations.
  - `docs/KNOWN_ISSUES.md`: Grounded in actual edge-case tests and benchmark results.
- **Medium Confidence**:
  - `docs/DEMO_SCRIPT.md`: Reflects verified UI behaviors, but manual live viva walkthrough timing has not been evaluated with audience questions.
- **Areas Needing Human Input**:
  - Academic deadlines, submission deliverables, and grading priorities [UNCLEAR].

---

## 5. Five Claims the Human Can Verify with One Command

1. **Verify All 118 C++ Tests Pass**:
   ```powershell
   .\build\vectordb_tests.exe
   ```
   *Expected output*: `Tests passed: 118 / 118`, `Tests failed: 0 / 118`, `OVERALL STATUS: ALL TESTS PASSED`.

2. **Verify Clean Rebuild with Zero Warnings**:
   ```powershell
   cmake --build build --clean-first
   ```
   *Expected output*: Recompiles all 38 object files and 4 executables without a single warning.

3. **Verify Web Security and Zero Unsafe DOM Injections**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\check_web_safety.ps1
   ```
   *Expected output*: `ALL CHECKS PASSED: Zero forbidden patterns in active code.`

4. **Verify Server Starts and CLI Argument Parser**:
   ```powershell
   .\build\vectordb_server.exe --help
   ```
   *Expected output*: Prints usage text showing all 17 supported CLI flags and exits cleanly with 0.

5. **Verify Git Working Tree and Local Commits Ahead**:
   ```powershell
   git status
   ```
   *Expected output*: `Your branch is ahead of 'origin/main' by 6 commits.` with modified/untracked documentation in `docs/` and untracked verification logs in `results/logs/`.

---

## 6. Questions for the Human

1. Should the 6 local commits ahead of `origin/main` be pushed to GitHub (`git push origin main`)?
2. What is the scheduled date or deadline for the B.Tech Major Project submission and viva defense?
3. Which feature has the highest priority for the next phase: implementing hybrid search (BM25 + RRF), adding disk persistence, or preparing presentation slides/materials?
4. Is persistent disk storage required for project evaluation, or is in-memory storage acceptable for viva grading?
5. Do you plan to evaluate VectorDB on Linux/macOS in addition to Windows 11?
6. Are there specific document corpora or domain datasets you wish to ingest for final evaluation beyond the included `vectordb_intro.txt` sample?

