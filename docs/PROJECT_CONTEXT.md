# Project Context

Last updated: 2026-11-13 by T-026

## 1. Operating Model

This project operates on a strict three-party workflow:
- **CLAUDE (The Brain)**: Plans, designs, decides, authors task prompts, and reviews builder reports. Claude cannot see the filesystem or execute code directly; it operates solely from `/docs`, human messages, and builder reports.
- **ANTIGRAVITY (The Builder & Documentation Keeper)**: Writes, compiles, executes, tests, and fixes code, keeping documentation in `/docs` continuously synchronized with reality. Antigravity is the only entity with direct access to the live codebase.
- **THE HUMAN (The Bridge & Final Authority)**: Relays task specifications from Claude to Antigravity and reports back to Claude. The human retains final operational and design authority.

---

## 2. Project Metadata & Origin

- **Project Name**: VectorDB [CONFIRMED: CMakeLists.txt:2]
- **Repository Remote URL**: `https://github.com/Coder-Priyan/VectorDB.git` [CONFIRMED: git remote -v]
- **Current Active Branch**: `ui-redesign` [CONFIRMED: git branch]
- **Fork Status**: Direct repository; not recorded as a git fork [CONFIRMED: git remote -v]
- **License**: Unlicensed in repository root; third-party headers `httplib.h` and `nlohmann/json.hpp` are licensed under the MIT License [CONFIRMED: third_party/README.md:14,26]
- **Last Commit Author**: Coder-Priyan `<230001938+Coder-Priyan@users.noreply.github.com.>` [CONFIRMED: git log -n 1]
- **What It Does**: VectorDB is a fully offline, zero-cloud C++17 in-memory vector database and retrieval-augmented generation (RAG) engine. It provides exact brute-force search, flat-array KD-Tree spatial indexing, hierarchical navigable small-world (HNSW) graphs, document chunking, matrix-free 2D PCA projection, a multi-threaded REST HTTP API server, and a dependency-free vanilla HTML5/ES6 web UI [CONFIRMED: README.md:1-80, src/].
- **Target Users**: Academic evaluators, students, and engineers seeking an offline, inspectable semantic search and RAG engine without external cloud or proprietary vector database services [INFERRED from B.Tech Major Project context, zero-cloud architecture, and educational demo tabs].
- **Deadlines & Non-Code Deliverables**: Academic major project report, viva defense presentation, and demo walkthrough script [INFERRED from docs/DEMO_SCRIPT.md; exact calendar deadlines are [UNCLEAR]].
- **Collaboration Preferences**: Human writes Hinglish (Hindi in Roman letters). Brain replies in simple short Hinglish with one question at a time. One step at a time. Human is not a technical planner: questions to the human must be short and answerable in one line. Human pastes Antigravity reports as plain text and runs verify commands in own terminal; human confirmations are usually 'OK' lines without screenshots, record them as human-reported. Human wants a WOW feel UI (instrument panel, no page scroll) and delegated design choices to Brain. Brain should warn about chat length earlier (SYNC). When several bugs are found in manual testing, batch them into ONE fix task instead of one task per bug. Human sometimes uses ChatGPT or another Claude as a testing helper and pastes their report; such reports are human-reported, not proof. Human handles viva, report and slides on their own. Brain must focus only on development and must not ask about viva dates or report status again. Human does not want AI-slop UI (gradients, glow, glass, indigo/violet accents); dark theme for now; has no reference website; delegated design choice to Brain. [CONFIRMED: human instruction in chat]

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
  - Zero bundlers, zero npm, zero external CDNs, local IBM Plex Sans/Mono woff2 in web/fonts/, no CDN fonts [CONFIRMED: web/index.html:1-249]
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

# 4. Run automated C++ test suite (111 registered tests, 110 hermetic + 1 opt-in skipped)
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
6. **Audit Claims Verification Status**: Claims from Antigravity's audit were verified by the human in their own terminal on 2026-11-12: 110/110 tests, zero warnings on clean rebuild, 4 executables, web safety scan pass, 72 commits with 6 ahead of origin, 29 API routes, 17 server flags. Not yet verified by the human: HNSW recall numbers (ISS-003, ISS-004), 74 browser tests, live Ollama RAG run.
7. **Demo Random Endpoint Contract**: Demo random insert uses field 'n', not 'count'. Docs claiming TESTED for the web UI meant pure-logic tests only; real browser testing by the human found a bug on 2026-11-12.
8. **Browser Test Count History**: Browser test count was 57 after T-002; older docs said 55; reached 62 after T-004; reached 66 after T-019; reached 70 after T-023b-1; reached 74 after T-023b-2.
9. **Git State in Documentation**: Git state claims in docs can go stale after pushes; always trust human's git status -sb over docs.
10. **Browser Test Execution by Agent**: Antigravity cannot run browser tests; only the human can. Never tick browser checks.
11. **git diff --stat Typo**: Human twice typed `git diff --sta` (invalid); always give full flag `--stat`.
12. **Browser Zoom / DPR Canvas Scaling**: Browser zoom (DPR != 1) can reveal canvas bugs that DPR 1 hides: after `setupCanvasDpr`, `ctx.scale(dpr,dpr)` is active, so drawing code must use CSS px, never `canvas.width`/`canvas.height` (ISS-023).

---

## 7. Verification Status (as of 2026-11-13)

Tasks verified and completed on branch `ui-redesign` (T-017 through T-023b-2):
- **T-017** (2026-11-12, commit `033c8fd`): One-screen feasibility study (read-only architectural analysis across shell and all 5 tabs; confirmed CSS layout strategy and Option A proposal for Compare).
- **T-018** (2026-11-12, commits `7ea24db`, `e98b381`, `31a2edb`): Pre-redesign cleanup (removed `web/mockup/`, replaced native alert/confirm with inline banners/two-step reset confirm, cleaned and deduplicated docs). [CONFIRMED: human terminal test / git]
- **T-019** (2026-11-13, commits `8ce28c9`, `a230057`, `6ee2d04`, `c3693e7`): One-screen UI Phase 1 (100dvh fixed app shell, Ask tab one-screen layout with inner scroll, smart auto-scroll helper with 4 unit tests bringing count to 66). Verified by human in real browser at 1920x1080 and small-window fallback. [CONFIRMED: human screenshot/report]
- **T-020** (2026-11-13, commits `a56e903`, `a6ddfc2`, `a98c00e`): One-screen UI Phase 2 (Explore & HNSW fixed-height layout, `.canvas-frame` relative wrapper, ResizeObserver rAF sizing with `isCanvasDrawable` guard, sidebar inner scroll). Verified by human in real browser. [CONFIRMED: human-reported]
- **T-021** (2026-11-13, commits `4db1567`, `4c736e7`): Ask answer box & sources height tuning (short answers size to content with `flex: 0 1 auto; max-height: 50vh`, sources list takes remaining height with `flex: 1; min-height: 120px`). Verified by human in real browser. [CONFIRMED: human-reported]
- **T-022** (2026-11-13, commit `88d63d2`): Compare tab one-screen feasibility study (read-only proposal for Option A: form + metrics on left, bars + diff table on right).
- **T-023a** (2026-11-13, commits `448f563`, `309addb`, `210557a`): Compare one-screen Phase 3a (fixed-height panel, Summary Metrics moved to sidebar below progress block, diff table inner scroll with sticky `th`, 240px canvas wrapper, ResizeObserver). Layout verified by human screenshots at 100% and 125% zoom. [CONFIRMED: human screenshot]
- **T-023b-1** (2026-11-13, commits `e120905`, `207130f`, `b62e577`): Compare DPR zoom fix (`resolveChartSize` CSS px drawing helper + 4 unit tests bringing count to 70) and compact Summary Metrics table in widened 420px sidebar (`white-space: nowrap`, 6px 8px padding, 12px font). Pure tests pass 70/70. T-023b-1 verified by human on 2026-11-13: /tests.html 70/70 [CONFIRMED: human screenshot]; Compare chart fits at 100%, 125% and 200% zoom, Summary Metrics rows on one line [CONFIRMED: human screenshots]; 150% zoom, console clean, Ask/Explore/HNSW/Settings regression OK [CONFIRMED: human-reported, no screenshots]. Remaining gap: Summary Metrics Recall column clipped at 420px (ISS-024), addressed in T-023b-2.
- **T-023b-2** (2026-11-13, commits `f0eded4`, `cfb2f2a`): Compare bars as 3 side-by-side charts (Latency, Distances, Recall) in 140px canvas frame + pure layout helper `computeChartLayout` with 4 unit tests (bringing count to 74) + Summary Metrics Recall column fully visible in 460px sidebar with 4px 6px padding. T-023b-2 verified by human on 2026-11-13: /tests.html 74/74, Compare 3 side-by-side charts, Summary Metrics Recall@K fully visible with no horizontal scrollbar, Top-k diff table shows all 10 rows at 100% [CONFIRMED: human screenshots at 100% and 125%]; 150% and 200% zoom, 1366x768, console clean, Ask/Explore/HNSW/Settings regression [CONFIRMED: human-reported, no screenshots].
- **T-024** (2026-11-13, commit `46e1991`): One-screen UI Phase 4 - Settings tab + small-screen fallback feasibility study (read-only architectural analysis + docs sync completed) [CONFIRMED: git log by human].
- **T-025** (2026-11-13, commits `6b45f89`, `64dd849`): One-screen UI Phase 4 - Settings tab 2-column layout (Option A: left = Server status, right = Demo collection + Danger zone) with stacked fallback below 1100px width or 520px height. Verified by human in real browser [CONFIRMED: human screenshot/report].
- **T-026** (2026-11-13): Header Ollama badge clipping at high zoom (ISS-025) fix (`min-height: 48px; height: auto` on `.app-header` and `.tab-nav`, `line-height: 1.2` on `.badge`) + Settings column tabindex cleanup. Implemented, pending human verification.

Features verified in a real browser by the human (with screenshots saved in results/screenshots/):
- T-025 Settings 2-column layout verified by human on 2026-11-13: /tests.html 74/74, Settings 1920x1080 two columns with no page scroll [CONFIRMED: human screenshots]; 1366x768, stacked fallback, Insert Random, Reset two-step confirm, zoom, console, other tabs regression [CONFIRMED: human-reported, no screenshots].
- Settings tab: Insert Random Vectors (Demo Vectors Count = 100) [CONFIRMED: human screenshot]
- Explore tab: Empty-state Insert 1000 Vectors button (1000 points shown on canvas) [CONFIRMED: human screenshot]
- Phase 1 to 4b UI (Settings, Compare, Explore, HNSW, Ask, resize, console) and /tests.html 62/62 verified in real browser by human on 2026-11-12 [CONFIRMED: human screenshot/approval]
- T-019 one-screen Phase 1 (shell + Ask pilot) verified by human in real browser on 2026-11-13: /tests.html 66/66 [CONFIRMED: human screenshot]; Ask layout, Settings, Compare, HNSW at 1920x1080 [CONFIRMED: human screenshots]; smart auto-scroll, console clean, small-window fallback, focus outline [CONFIRMED: human-reported, no screenshots]
- T-020 one-screen Phase 2 (Explore + HNSW fit panel, canvas sized from wrapper via ResizeObserver, fallback for Ask/Explore/HNSW, Compare regression check, 1366x768, /tests.html, console) verified by human in real browser on 2026-11-13 [CONFIRMED: human-reported, no screenshots]
- T-021 Ask height fix (short answer, long answer, empty state, 1366x768, small-window fallback, /tests.html 74/74, console) verified by human in real browser on 2026-11-13 [CONFIRMED: human-reported, no screenshots]
- T-023a Compare Phase 3a (fixed-height layout, Summary Metrics in sidebar) at 100% zoom 1920x1080 and 125% zoom verified by human screenshots on 2026-11-13 [CONFIRMED: human screenshots]. Pending human confirmation: console clean, /tests.html 74/74, Explore/HNSW/Ask/Settings regression, 1366x768, small-window fallback.

Features verified in a real browser by the human (2026-11-12, T-004):
- Settings tab: Demo Memory shows 50.8 KB with 100 vectors, efConstruction form default 200, Ollama Models row shows llama3.2:latest and nomic-embed-text:latest [CONFIRMED: screenshot saved by human in chat, not in results/screenshots/]
- Ask tab: Title clears after ingest, pizza question refused, Hinglish question tested [CONFIRMED: human-reported, no screenshots]
- Git sync status (pushed, nothing ahead) verified by human terminal screenshot 2026-11-12. [CONFIRMED: human terminal screenshot 2026-11-12]

Features reported working by the human without screenshots:
- Compare tab: Brute 34 µs, KD-Tree 41 µs, HNSW 103 µs on 100 vectors, all recall 100%. Nearest neighbors panel works, red star drawn. [CONFIRMED: human manual test]
- HNSW tab: Demo collection graph works (100 nodes, max level 2, 1324 edges). [CONFIRMED: human manual test]
- Ask tab: vectordb_intro.txt ingested (6 chunks), 3 test Q&A answered with sources and timings. [CONFIRMED: human manual test]
- Live Ollama test: 1 passed, 0 skipped when run with VECTORDB_LIVE_OLLAMA=1; total assertions reported 529,746. [CONFIRMED: human test run]

All these were broken or unverified before Task 7a / 7a-fix / 7a-fix2 / T-002 / T-004.

---

## 8. Viva Talking Points (Honest Answers) [INFERRED]

- Why KD-Tree search time is close to Brute Force at D=128: curse of dimensionality. KD-Tree partitions space with orthogonal hyperplanes; above ~10-15 dimensions, almost every leaf cell intersects the search hypersphere, so it visits nearly all leaves, degrading to O(N).
- Why HNSW search time is higher than Brute Force on 100 vectors: constant factor overhead. HNSW does priority-queue operations, visited-set lookups, and pointer chasing across layers; Brute Force is a single contiguous array scan that fits entirely in L1 cache and is vectorized by SIMD. HNSW only wins when N is large (thousands to millions).
- Total assertions (529,746) is reported by the custom test runner; the same number appeared with and without the live Ollama test, so do not claim it comes from the live test.

