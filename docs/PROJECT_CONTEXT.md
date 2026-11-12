# Project Context

Last updated: 2026-11-12 by SYNC

## 1. Operating Model

This project operates on a strict three-party workflow:
- **CLAUDE (The Brain)**: Plans, designs, decides, authors task prompts, and reviews builder reports. Claude cannot see the filesystem or execute code directly; it operates solely from `/docs`, human messages, and builder reports.
- **ANTIGRAVITY (The Builder & Documentation Keeper)**: Writes, compiles, executes, tests, and fixes code, keeping documentation in `/docs` continuously synchronized with reality. Antigravity is the only entity with direct access to the live codebase.
- **THE HUMAN (The Bridge & Final Authority)**: Relays task specifications from Claude to Antigravity and reports back to Claude. The human retains final operational and design authority.

---

## 2. Project Metadata & Origin

- **Project Name**: VectorDB [CONFIRMED: CMakeLists.txt:2]
- **Repository Remote URL**: `https://github.com/Coder-Priyan/VectorDB.git` [CONFIRMED: git remote -v]
- **Current Active Branch**: `main` [CONFIRMED: git branch]
- **Fork Status**: Direct repository; not recorded as a git fork [CONFIRMED: git remote -v]
- **License**: Unlicensed in repository root; third-party headers `httplib.h` and `nlohmann/json.hpp` are licensed under the MIT License [CONFIRMED: third_party/README.md:14,26]
- **Last Commit Author**: Coder-Priyan `<230001938+Coder-Priyan@users.noreply.github.com.>` [CONFIRMED: git log -n 1]
- **What It Does**: VectorDB is a fully offline, zero-cloud C++17 in-memory vector database and retrieval-augmented generation (RAG) engine. It provides exact brute-force search, flat-array KD-Tree spatial indexing, hierarchical navigable small-world (HNSW) graphs, document chunking, matrix-free 2D PCA projection, a multi-threaded REST HTTP API server, and a dependency-free vanilla HTML5/ES6 web UI [CONFIRMED: README.md:1-80, src/].
- **Target Users**: Academic evaluators, students, and engineers seeking an offline, inspectable semantic search and RAG engine without external cloud or proprietary vector database services [INFERRED from B.Tech Major Project context, zero-cloud architecture, and educational demo tabs].
- **Deadlines & Non-Code Deliverables**: Academic major project report, viva defense presentation, and demo walkthrough script [INFERRED from docs/DEMO_SCRIPT.md; exact calendar deadlines are [UNCLEAR]].
- **Collaboration Preferences**: Human writes Hinglish (Hindi in Roman letters). Brain should reply in simple short Hinglish. One step at a time. Human is not a technical planner: questions to the human must be short and answerable in one line. When several bugs are found in manual testing, batch them into ONE fix task instead of one task per bug. Human sometimes uses ChatGPT or another Claude as a testing helper and pastes their report; such reports are human-reported, not proof. [CONFIRMED: human instruction in chat]

---

## 3. Tech Stack & Dependencies

- **Language Standard**: C++17 (`-std=c++17`, required and enforced) [CONFIRMED: CMakeLists.txt:9-11]
- **Build System**: CMake 3.16+ with Ninja / Make generators [CONFIRMED: CMakeLists.txt:1]
- **C++ Compiler**: GCC (MSYS2 UCRT64 `g++` 13+ / 14+) on Windows; compatible with Clang 10+ and MSVC 2019+ [CONFIRMED: CMakeLists.txt:18-22, README.md:204]
- **Vendored Third-Party Dependencies (Header-Only)**:
  - `cpp-httplib` v0.18.3 (`third_party/httplib.h`, MIT License) [CONFIRMED: third_party/README.md:12]
  - `nlohmann/json` v3.11.3 (`third_party/nlohmann/json.hpp`, MIT License) [CONFIRMED: third_party/README.md:24]
- **External Local Daemon (RAG only)**:
  - Ollama local daemon (`http://127.0.0.1:11434`) [CONFIRMED: src/server_main.cpp:32]
  - Embedding Model: `nomic-embed-text` (768-dimensional embeddings) [CONFIRMED: src/server_main.cpp:33]
  - Chat LLM: `llama3.2` [CONFIRMED: src/server_main.cpp:34]
- **Web Frontend**:
  - Vanilla HTML5, CSS3, ES6 JavaScript modules [CONFIRMED: web/index.html, web/js/main.js]
  - Zero bundlers, zero npm, zero external CDNs, zero third-party fonts [CONFIRMED: web/index.html:1-249]
  - Security hardening: Strict CSP meta tag and headers (`default-src 'self'`), zero `innerHTML` / `outerHTML` [CONFIRMED: web/index.html:6, scripts/check_web_safety.ps1].
- **Operating Systems**: Primary development on Windows 11 (PowerShell, MSYS2 UCRT64 toolchain); POSIX-compatible standard C++17 [CONFIRMED: CMakeLists.txt:55,79,127].

---

## 4. Coding & Architectural Conventions

- **Namespace**: All core engine code resides in namespace `vectordb` [CONFIRMED: include/vectordb/types.hpp:10].
- **Memory Discipline**: Zero raw owning pointers; standard smart pointers (`std::unique_ptr`, `std::shared_ptr`) throughout; standard containers (`std::vector`, `std::unordered_map`) [CONFIRMED: include/vectordb/].
- **Headers & Includes**:
  - No `using namespace` declarations in any header file [CONFIRMED: include/vectordb/].
  - Public interfaces in `include/vectordb/*.hpp`; implementation in `src/*.cpp`.
- **Compiler Warnings**: Clean build required with `-Wall -Wextra -Wpedantic` (GCC/Clang) or `/W4` (MSVC) [CONFIRMED: CMakeLists.txt:18-22].
- **Line Endings**: LF (`\n`) enforced repo-wide via `.gitattributes` [CONFIRMED: .gitattributes:1].
- **Web DOM Security**: Server responses and dynamic content rendered strictly through `textContent`, `setAttribute`, and `createElement`; direct HTML injection (`innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, `new Function`, `createContextualFragment`, `DOMParser`) is prohibited and verified by scanner [CONFIRMED: scripts/check_web_safety.ps1].
- **HTTP CSRF Hardening**: Every `POST` request must include header `Content-Type: application/json` even when sending empty bodies (`{}`); missing content-type returns HTTP 415 [CONFIRMED: src/server_main.cpp:218, tests/test_server_http.cpp:115].
- **DNS Rebinding & CORS**: Loopback host verification (`127.0.0.1`, `localhost`, `[::1]`) enforced on loopback bindings; same-origin CORS default with explicit `--cors-origin` [CONFIRMED: src/server_main.cpp:177,204].

---

## 5. Build, Run, and Test Commands

All verified working commands on Windows PowerShell:

```powershell
# 1. Configure CMake (Release mode, Ninja generator)
cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Release

# 2. Compile all targets
cmake --build build

# 3. Clean full rebuild
cmake --build build --clean-first

# 4. Run automated C++ test suite (110 registered tests, 109 hermetic + 1 opt-in skipped)
.\build\vectordb_tests.exe

# 5. Run test suite including live local Ollama
$env:VECTORDB_LIVE_OLLAMA="1"; .\build\vectordb_tests.exe; Remove-Item Env:\VECTORDB_LIVE_OLLAMA

# 6. Run web security scanner (scans HTML/JS for unsafe DOM calls and CSP compliance)
powershell -ExecutionPolicy Bypass -File .\scripts\check_web_safety.ps1

# 7. Start REST API server with embedded static Web UI
.\build\vectordb_server.exe --port 8080 --web-dir web

# 8. Start server with customized RAG settings
.\build\vectordb_server.exe --port 8080 --web-dir web --ollama-url http://127.0.0.1:11434 --embed-model nomic-embed-text --chat-model llama3.2 --rag-dim 768 --rag-prompt v2

# 9. Run RAG evaluation harness across prompt templates
.\build\vectordb_rag_eval.exe --questions samples/rag_eval_questions.json --out results/rag_eval_run.csv

# 10. Run CLI demo and benchmarks with CSV export
.\build\vectordb_demo.exe
```
[CONFIRMED: all commands executed and verified in build logs].

---

## 6. Gotchas and Lessons Learned

1. **PowerShell Backtick Escaping**: Inside double-quoted PowerShell commands, backticks (`` ` ``) are escape characters. Embedding string backticks into inline scripts strips them; use file-based python scripts or single quotes to avoid corrupted files [CONFIRMED: task 7b].
2. **Mandatory POST Headers**: Any client (frontend, curl, test scripts) issuing a `POST` request must supply `-H "Content-Type: application/json"` and body `-d "{}"` even if the route expects no JSON payload. Omitting it results in HTTP 415 `unsupported_media_type` [CONFIRMED: src/server_main.cpp:218].
3. **Canvas Zero-Dimension Layout Guard**: Browsers reporting hidden tabs can pass `0x0` dimensions to HTML5 canvas render routines, triggering `DOMException: INVALID_STATE_ERR` on `drawImage`. Always verify `width > 0 && height > 0` before drawing [CONFIRMED: web/js/hnsw_helpers.js:15].
4. **HNSW Graph Edge Cap**: Rendering huge proximity graphs in the browser hangs the UI thread. The backend strictly truncates edge export at 60,000 edges and sets `"truncated": true`, while computing the true total edge count beforehand [CONFIRMED: src/collection.cpp:227].
5. **In-Memory Non-Atomic Ingestion**: Document ingestion embeddings are validated before committing, but if vector insertion fails mid-loop, already inserted chunks remain in memory without a DocumentRecord until `POST /api/docs/reset` is called [CONFIRMED: src/rag.cpp:138].
6. **Audit Claims Verification Status**: Claims from Antigravity's audit were verified by the human in their own terminal on 2026-11-12: 110/110 tests, zero warnings on clean rebuild, 4 executables, web safety scan pass, 72 commits with 6 ahead of origin, 29 API routes, 17 server flags. Not yet verified by the human: HNSW recall numbers (ISS-003, ISS-004), 55 browser tests, live Ollama RAG run.
7. **Demo Random Endpoint Contract**: Demo random insert uses field 'n', not 'count'. Docs claiming TESTED for the web UI meant pure-logic tests only; real browser testing by the human found a bug on 2026-11-12.

---

## 7. Verification Status (as of 2026-11-12)

Features verified in a real browser by the human (with screenshots saved in results/screenshots/):
- Settings tab: Insert Random Vectors (Demo Vectors Count = 100) [CONFIRMED: human screenshot]
- Explore tab: Empty-state Insert 1000 Vectors button (1000 points shown on canvas) [CONFIRMED: human screenshot]

Features reported working by the human without screenshots:
- Compare tab: Brute 34 µs, KD-Tree 41 µs, HNSW 103 µs on 100 vectors, all recall 100%. Nearest neighbors panel works, red star drawn. [CONFIRMED: human manual test]
- HNSW tab: Demo collection graph works (100 nodes, max level 2, 1324 edges). [CONFIRMED: human manual test]
- Ask tab: vectordb_intro.txt ingested (6 chunks), 3 test Q&A answered with sources and timings. [CONFIRMED: human manual test]
- Live Ollama test: 1 passed, 0 skipped, 529,746 assertions (run by human with VECTORDB_LIVE_OLLAMA=1). [CONFIRMED: human test run]

All these were broken or unverified before Task 7a / 7a-fix / 7a-fix2 / T-002.

---

## 8. Viva Talking Points (Honest Answers) [INFERRED]

- Why KD-Tree search time is close to Brute Force at D=128: curse of dimensionality. KD-Tree partitions space with orthogonal hyperplanes; above ~10-15 dimensions, almost every leaf cell intersects the search hypersphere, so it visits nearly all leaves, degrading to O(N).
- Why HNSW search time is higher than Brute Force on 100 vectors: constant factor overhead. HNSW does priority-queue operations, visited-set lookups, and pointer chasing across layers; Brute Force is a single contiguous array scan that fits entirely in L1 cache and is vectorized by SIMD. HNSW only wins when N is large (thousands to millions).
- Why the live Ollama test has 529,746 assertions: it loops through large embeddings, running ASSERT_NEAR on every float element across multiple vectors.

