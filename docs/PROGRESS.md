# Project Progress

Last updated: 2026-11-12 by T-018

## 1. Current Phase: Cleanup Complete (Task T-018, Branch `ui-redesign`); Ready for Human Verification

All core engine development and bug fix tasks are completed and verified (111 C++ tests, 62 browser tests). Engine code is frozen. Active development is on branch `ui-redesign` in the Editor/Terminal aesthetic. Phases 1 through 4b and T-016 (test fix) were verified in the browser by the human on 2026-11-12. Task T-017 (one-screen UI feasibility study) and Task T-018 (cleanup: mockup removal, alert/confirm replaced with inline UI and two-step confirm, docs cleanup) are completed. All 20 Compare DOM IDs (plus new `compare-progress-fill`), 19 Explore DOM IDs, 26 HNSW DOM IDs, 11 Settings DOM IDs (plus new `demo-reset-cancel-btn`, `settings-reset-status`, `settings-random-status`), 23 Ask DOM IDs (plus new `doc-reset-cancel-btn`), and all 62 browser unit tests remain functional [CONFIRMED: git status, git log].

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
| **Offline Grounded RAG Pipeline** (Citation synthesis, prompt defence) | `include/vectordb/rag.hpp`, `src/rag.cpp` | [CONFIRMED] | TESTED |
| **Automated RAG Evaluation Harness** (14 evaluation questions, CSV export) | `include/vectordb/rag_eval.hpp`, `src/rag_eval.cpp`, `src/rag_eval_main.cpp` | [CONFIRMED] | TESTED |
| **REST HTTP Server** (29 registered API endpoints, static web hosting) | `include/vectordb/api.hpp`, `src/api.cpp`, `src/server_main.cpp` | [CONFIRMED] | TESTED |
| **Server Security Hardening** (Host rebinding, Origin check, CSRF 415) | `src/server_main.cpp`, `tests/test_server_http.cpp` | [CONFIRMED] | TESTED |
| **Real-time SSE Token Streaming** (`/api/ask/stream` endpoint) | `src/server_main.cpp`, `src/api.cpp`, `web/js/sse.js` | [CONFIRMED] | TESTED |
| **Interactive Offline Browser UI** (5 tabs: Ask, Explore, HNSW, Compare, Settings) | `web/index.html`, `web/css/app.css`, `web/js/*.js` | [CONFIRMED] | TESTED |
| **Automated Web Safety Scanner** (Zero innerHTML, strict CSP verified) | `scripts/check_web_safety.ps1` | [CONFIRMED] | TESTED |
| **Hermetic C++ Unit & Integration Test Suite** (111 registered tests) | `tests/*.cpp`, `tests/fake_ollama.hpp` | [CONFIRMED] | TESTED |
| **Browser Pure-Logic Unit Test Suite** (62 registered unit tests) | `web/tests.html`, `web/js/tests/*.js` | [CONFIRMED] | TESTED |

*(Note: For real browser verification results and human-tested status as of 2026-11-12, see the [Verification status (as of 2026-11-12)](PROJECT_CONTEXT.md#verification-status-as-of-2026-11-12) section in docs/PROJECT_CONTEXT.md).*

---

## 3. In Progress / Half-Done Features

*No features are currently half-implemented or in progress. All implemented interfaces compile cleanly with zero stubs or unresolved links [CONFIRMED: git status, build logs].*

---

## 4. Not Started / Roadmap Features

| Feature | Target / Specification | Evidence | Status |
| :--- | :--- | :--- | :--- |
| **Hybrid Search (BM25 + RRF)** | Lexical BM25 score fusion with dense vector cosine similarity | [CONFIRMED: README.md:12] | NOT STARTED |
| **Cross-Encoder Reranking** | Second-pass neural reranker for retrieved candidate chunks | [CONFIRMED: README.md:14] | NOT STARTED |
| **Persistent Disk Storage** | Disk-backed storage engine with Write-Ahead Logging (WAL) | [CONFIRMED: README.md:15] | NOT STARTED |
| **Dynamic Vector/Doc Deletions** | In-place deletion and mutation of indexed vectors without reset | [CONFIRMED: README.md:16] | NOT STARTED |
| **Automated Browser E2E Click Tests** | Headless browser execution suite (Playwright / Selenium) | [CONFIRMED: docs/KNOWN_ISSUES.md:15] | NOT STARTED |
| **Streaming Document Ingestion** | Real-time progress updates during multi-document chunk embedding | [CONFIRMED: docs/KNOWN_ISSUES.md:9] | NOT STARTED |
| **Atomic Multi-Chunk Rollback** | Transactional collection rollback on out-of-memory insert failure | [CONFIRMED: docs/KNOWN_ISSUES.md:10] | NOT STARTED |

