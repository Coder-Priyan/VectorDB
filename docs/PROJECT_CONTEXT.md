# Project Context

Last updated: 2026-11-14 by SYNC-004

## 1. Operating Model

This project operates on a strict three-party workflow:
- **CLAUDE (The Brain)**: Plans, designs, decides, authors task prompts, and reviews builder reports. Claude cannot see the filesystem or execute code directly; it operates solely from `/docs`, human messages, and builder reports.
- **ANTIGRAVITY (The Builder & Documentation Keeper)**: Writes, compiles, executes, tests, and fixes code, keeping documentation in `/docs` continuously synchronized with reality. Antigravity is the only entity with direct access to the live codebase.
- **THE HUMAN (The Bridge & Final Authority)**: Relays task specifications from Claude to Antigravity and reports back to Claude. The human retains final operational and design authority.

---

## 2. Project Metadata & Origin

- **Project Name**: VectorDB [CONFIRMED: CMakeLists.txt:2]
- **Repository Remote URL**: `https://github.com/Coder-Priyan/VectorDB.git` [CONFIRMED: git remote -v]
- **Current Active Branch**: `ui-quiet-studio` [CONFIRMED: git branch]
- **Fork Status**: Direct repository; not recorded as a git fork [CONFIRMED: git remote -v]
- **License**: MIT (LICENSE file in repo root; copyright holder placeholder <YOUR NAME> still to be filled by human); third-party headers `httplib.h` and `nlohmann/json.hpp` are licensed under the MIT License [CONFIRMED: LICENSE:3, third_party/README.md:14,26]
- **Last Commit Author**: Coder-Priyan `<230001938+Coder-Priyan@users.noreply.github.com.>` [CONFIRMED: git log -n 1]
- **What It Does**: VectorDB is a fully offline, zero-cloud C++17 vector database (in-memory by default, with atomic disk persistence via --data-dir) and retrieval-augmented generation (RAG) engine. It provides exact brute-force search, flat-array KD-Tree spatial indexing, hierarchical navigable small-world (HNSW) graphs, document chunking, matrix-free 2D PCA projection, a multi-threaded REST HTTP API server, and a dependency-free vanilla HTML5/ES6 web UI [CONFIRMED: README.md:1-80, src/].
- **Target Users**: Academic evaluators, students, and engineers seeking an offline, inspectable semantic search and RAG engine without external cloud or proprietary vector database services [INFERRED from B.Tech Major Project context, zero-cloud architecture, and educational demo tabs].
- **Deadlines & Non-Code Deliverables**: Academic major project report, viva defense presentation, and demo walkthrough script [INFERRED from docs/DEMO_SCRIPT.md; exact calendar deadlines are [UNCLEAR]].
- **Collaboration Preferences**: Human writes Hinglish (Hindi in Roman letters). Brain replies in simple short Hinglish with one question at a time. One step at a time. Human is not a technical planner: questions to the human must be short and answerable in one line. Human pastes Antigravity reports as plain text and runs verify commands in own terminal; human confirms many checks with short "OK" lines without screenshots, record them as human-reported. Brain must ask for screenshots of features that were previously only reported. Human wants a luxury, calm, trustworthy, professional modern 2026 UI (instrument panel, no page scroll, one font family, few lines and boxes, zero AI-slop). Human noted mixed fonts make the product feel untrustworthy. Human prefers: human uses ChatGPT/Gemini for mockups and passes the chosen image; Brain gives outcome-level briefs; builder decides implementation. Human is at the gym sometimes and wants a master prompt to run unattended. Human does not like text from AI mockups copied; layout and feel only. Merge and push to main are decided only AFTER the pending UI fixes. Brain vote: fixes first, then merge ui-quiet-studio. Brain should warn about chat length earlier (SYNC); human wants a SYNC when the chat is long. When several bugs are found in manual testing, batch them into ONE fix task instead of one task per bug. Human sometimes uses ChatGPT or another Claude as a testing helper and pastes their report; such reports are human-reported, not proof. Human handles viva, report and slides on their own. Brain must focus only on development and must not ask about viva dates or report status again. Human does not want AI-slop UI (gradients, glow, glass, indigo/violet accents); dark theme for now; has no reference website; delegated design choice to Brain. Human decided on 2026-11-14: aggressive mode with big master tasks, backup exists (branch backup-before-v2 and external backup); fixes follow after each big build. Brain still verifies with terminal output and screenshots; builder reports are claims, not proof. Wants Claude-style chat UI with history sidebar; wants the Ask tab to show how things work internally. [CONFIRMED: human instruction in chat]

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

# 4. Run automated C++ test suite (118 registered tests, 117 hermetic + 1 opt-in skipped)
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

# 11. Start server with persistence enabled across restarts
.\build\vectordb_server.exe --port 8080 --web-dir web --data-dir ./data
```
[CONFIRMED: all commands executed and verified in build logs].

---

## 6. Gotchas and Lessons Learned

1. **PowerShell Backtick Escaping**: Inside double-quoted PowerShell commands, backticks (`` ` ``) are escape characters. Embedding string backticks into inline scripts strips them; use file-based python scripts or single quotes to avoid corrupted files [CONFIRMED: task 7b].
2. **Mandatory POST Headers**: Any client (frontend, curl, test scripts) issuing a `POST` request must supply `-H "Content-Type: application/json"` and body `-d "{}"` even if the route expects no JSON payload. Omitting it results in HTTP 415 `unsupported_media_type` [CONFIRMED: src/server_main.cpp:218].
3. **Canvas Zero-Dimension Layout Guard**: Browsers reporting hidden tabs can pass `0x0` dimensions to HTML5 canvas render routines, triggering `DOMException: INVALID_STATE_ERR` on `drawImage`. Always verify `width > 0 && height > 0` before drawing [CONFIRMED: web/js/hnsw_helpers.js:15].
4. **HNSW Graph Edge Cap**: Rendering huge proximity graphs in the browser hangs the UI thread. The backend strictly truncates edge export at 60,000 edges and sets `"truncated": true`, while computing the true total edge count beforehand [CONFIRMED: src/collection.cpp:227].
5. **Document Ingestion Multi-Chunk Rollback**: Document ingestion embeddings are validated before committing. If vector insertion throws mid-loop (e.g. out of memory), `src/rag.cpp` catches the exception and executes `removeBatch` on inserted vector IDs, rolling back partial chunks and preventing orphaned vectors without a DocumentRecord (ISS-006 fixed in code, not covered by an automated test) [CONFIRMED: src/rag.cpp:155-160].
6. **Audit Claims Verification Status**: Claims from Antigravity's audit were verified by the human in their own terminal on 2026-11-12: 110/110 tests, zero warnings on clean rebuild, 4 executables, web safety scan pass, 72 commits with 6 ahead of origin, 29 API routes, 17 server flags. Not yet verified by the human: HNSW recall numbers (ISS-003, ISS-004), 74 browser tests, live Ollama RAG run.
7. **Demo Random Endpoint Contract**: Demo random insert uses field 'n', not 'count'. Docs claiming TESTED for the web UI meant pure-logic tests only; real browser testing by the human found a bug on 2026-11-12.
8. **Browser Test Count History**: Browser test count was 57 after T-002; older docs said 55; reached 62 after T-004; reached 66 after T-019; reached 70 after T-023b-1; reached 74 after T-023b-2; reached 84 after T-033 (83/84 real); reached 88 after T-036/T-038; reached 92 after T-041 (with `test_colors.js`); reached 94 after T-043 (builder claimed 96, real 94).
9. **Git State in Documentation**: Git state claims in docs can go stale after pushes; always trust human's git status -sb over docs.
10. **Browser Test Execution by Agent**: Antigravity cannot run browser tests; only the human can. Never tick browser checks.
11. **git diff --stat Typo**: Human twice typed `git diff --sta` (invalid); always give full flag `--stat`.
12. **Browser Zoom / DPR Canvas Scaling**: Browser zoom (DPR != 1) can reveal canvas bugs that DPR 1 hides: after `setupCanvasDpr`, `ctx.scale(dpr,dpr)` is active, so drawing code must use CSS px, never `canvas.width`/`canvas.height` (ISS-023).
13. **Git Status Discrepancies**: Antigravity reports sometimes show "git status -sb" as clean while the human's terminal shows 15 untracked results/logs/ files. Trust the human's terminal output.
14. **Viewport vs Screen Dimensions**: Brain's height estimates for 1366x768 are estimates only; the real browser viewport is smaller than the screen (about 530px for .app-content). Human verifies in the browser.
15. **Global CSS Badge Rule**: Global CSS rule .badge { line-height: 1.2 } was added in T-026 (applies to every .badge). If any badge looks different on another tab, check this rule first.
16. **Delegated Decisions**: When the human says "choose best on my behalf", Brain decides and states the reason in 2-3 lines.
17. **Builder Reports Verification & Truncation**: Builder reports in T-032 contained several wrong or invented details (Settings ID list, accent color #d4a373 instead of #d9a441, empty-state label, 'old class' column, retyped test output, scale(1.15) claim). Always verify with the human's terminal output. PowerShell tables truncate long lines; truncation is not retyping.
18. **Builder Cannot Run Browser Tests**: Builder cannot run browser tests; its browser test counts are never proof. Real browser testing by the human found a failing test in T-033 review (83/84 passed, consecutive citation pills edge case) despite earlier reports claiming 84/84. Always report browser tests as unverified until the human opens `/tests.html`.
19. **Human 'OK' Without Screenshot Can Be Wrong**: Any earlier claim or report that Compare algorithms and Trace HNSW path buttons were working based only on human "OK" report without screenshots was WRONG because the Compare button never worked until T-038 (read `bRes.reports` instead of `bRes.algorithms`) and Trace showed 0 nodes until T-037 (read `visited_nodes` instead of `stats.nodesVisited`). A human 'OK' without screenshot can be wrong; prefer screenshots for features.
20. **HNSW vs Brute Force Scaling**: Do not claim HNSW is faster than brute force in README, DEMO_SCRIPT or LEARNING_GUIDE for small collections; at 6 chunks brute force wins due to cache locality and zero graph traversal overhead (ISS-004).
21. **Visual Verification Requires Screenshots**: Visual changes, layouts, color palettes, and aesthetics cannot be verified programmatically or by unit tests alone. All visual aspects must be reported as "not tested" until verified by human screenshots.
22. **Stop Running Server Before Build**: Stop the running server before `cmake --build` (`vectordb_server.exe Permission denied` otherwise); the T-042 report showed this failed link while `vectordb_tests.exe` still linked. Stop via `Get-Process vectordb_server | Stop-Process -Force` prior to building.
23. **Compare Empty State False Claim**: T-042 claimed the Compare empty state was done, but the human screenshot showed a blank main area because `checkCollectionStats` hid it whenever vectors were present before a benchmark ran; verify visually before trusting.
24. **Builder Scratch Scripts**: Builder leaves helper scripts in `scratch/` (untracked); never commit them, keep workspace clean.
25. **Font Availability & Inter Requirement**: Builder says "IBM Plex Sans only" because no Inter file exists in `web/fonts/`; Inter `.woff2` must be added by the human (pending).
26. **Cross-Check Builder Counts and IDs**: T-043 builder reported 96 browser tests and a button id #btn-danger-reset; real values were 94 and #demo-reset-btn. Builder retyped numbers and ids that were not checked. Always cross-check counts and ids against the human's browser/terminal.
27. **Mono Font Deviations**: T-046 builder report claimed mono only for /tests.html and --data-dir, but the Data directory value was also mono; builder omitted this deviation. Check font-family of every value in Settings via screenshot.
28. **Dual Mockup Rule (Empty + Results)**: The mockup given to the builder in T-049 showed only the empty state; always get BOTH empty-state and results mockups so builder does not invent results layouts.
29. **Builder Claimed Zero Deviations vs Visual Screenshots**: Builder reports claimed "zero deviations" three times (T-046, T-047, T-049) while screenshots showed real deviations. Judge UI only by human screenshots at 100% browser zoom; builder claims are never proof.
30. **Settings Panel Sizing & Pending Task T-048**: Pending task T-048 (Settings: content-sized panels, balanced columns, left-aligned header) was written by Brain but NOT executed yet. Human liked the 3-column panel grid (T-046) but T-047 height/width stretching made hollow panels.
31. **Known T-049 Compare Bugs & Visual Rejection**: Human visually REJECTED the T-049 Compare layout (2026-11-14). Bugs seen in human screenshots: after benchmark completes, empty-state card & grey skeleton panels stay visible above results, pushing results down so page scrolls; controls bar is cramped (progress line inside it); diff table showed 8 rows not 10; summary metrics & bars sit side-by-side instead of the mockup's layout. A new Compare design is being created with another AI mockup. Do not merge T-049 to main until human approves a new design.

---

## 7. Verification Status (as of 2026-11-14)

- **Human-confirmed after T-046 by terminal**: C++ 118/118 (529,813 assertions, 117 run + 1 opt-in live-Ollama test skipped), scanner pass, CSS `!important` count 3.
- **NOT yet human-confirmed after T-047/T-049**: `/tests.html` count (last confirmed 94/94 after T-043), C++ tests, scanner.
- **Human-confirmed by screenshots on 2026-11-14**: `/tests.html` 94/94 (after T-043), 5 tabs at 1920x1080, Ask chat flow, Explore Docs PCA, Open Explore deep link, Compare in Ask (3 rows), Trace (6 nodes), Settings new sections, footer removed, Explore toolbar 1 row, Compare 3 side-by-side charts, Compare summary table 5 columns unclipped, Settings font larger and persistence status in sans.
- **Still human-reported only (no screenshots)**: `--data-dir` persistence restart, Ctrl K, sidebar collapse, guided tour.
- **Pending Human Screenshots**: Settings (T-047 state seen, fix pending via T-048), Compare new design (after new mockup), Ask glass-box latency breakdown grid & drawer toggle without chat shift, HNSW tab at 1366x768, 125% zoom, below 1100px.
- **Pending Human Actions**: LICENSE name placeholder, merge decision for `ui-quiet-studio` (do NOT merge until Settings and Compare are approved), Linux/macOS support tier.
- **Not verified**: 1366x768 layout, Ask New chat empty-state guided card.

Tasks verified and completed on branch `ui-redesign` (T-017 through T-038), and `ui-polish-2026` (T-040):
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
- **T-026** (2026-11-13, commits `a41b134`, `b369c6e`, `f593147`): Header Ollama badge clipping at high zoom (ISS-025) fix (`min-height: 48px; height: auto` on `.app-header` and `.tab-nav`, `line-height: 1.2` on `.badge`) + Settings column tabindex cleanup. Verified by human in real browser [CONFIRMED: human screenshot/report].
- **T-027** (2026-11-13, commits `5588462`, `966f86c`): Settings tab - remove awkward empty space (balanced bordered panels, vertically centered with `margin: auto`, Danger zone pinned to bottom of right panel with `margin-top: auto` and 1px border-top, row padding 13px 0). Verified by human in real browser [CONFIRMED: human screenshot/report].
- **T-028** (2026-11-13): Intermediate Settings layout, superseded by later Settings work; human verification not recorded.
- **T-029** (2026-11-13): Intermediate Settings layout, superseded by later Settings work; human verification not recorded.
- **T-030** (2026-11-13): Intermediate Settings layout, superseded by later Settings work; human verification not recorded.
- **T-033** (2026-11-14, commits `b26212c` through `cae814b`): VectorDB v2 master build - Glass-box chat product (engine unfreeze + multi-turn history + docs HNSW trace + atomic persistence format + per-document delete API + design foundation + collapsible sidebar & command palette + Ask glass-box chat + educational learning layer & tour + release readiness). C++ unit tests: 118/118 passed; Browser tests: 84/84 passed; Web safety scan: 100% clean; 30 REST/SSE endpoints. [CONFIRMED: test runs & git log]
- **T-034** (2026-11-14, commit `637fd58`): Fix stale docs (license, test count, persistence magic header).
- **T-035** (2026-11-14, commit `83c1257`): Align ISS-006 ingest rollback documentation in `docs/API.md`.
- **T-036** (2026-11-14, commits `d1c6a3d`, `d5df34a`, `aaaa6c6`, `cf79729`): Batched UI fixes after human real-browser review (citation parser assertion, tests scroll, ask layout, explore deep link, compare table fit, settings P7 cards, version badge).
- **T-037** (2026-11-14, commit `b401029`): Small fixes after human verification (empty compare box hidden, trace fields fix, persistence health derivation).
- **T-038** (2026-11-14, commit `a57c573`): Fix compare button in ask glass-box (algorithms mapping, latency bars, toast on error, 4 unit tests).

Features verified in a real browser by the human (earlier milestones and historical logs):
- T-032 verified in screenshots (human, 1920x1080, 2026-11-14): one solid amber button per tab, custom select chevron, no number spinners, dark Choose File button, amber unchanged [CONFIRMED: human screenshot]. Not yet verified by human: hover and focus ring, Settings Insert and Reset two-step confirm after class changes, /tests.html 74/74, console errors.
- T-027 Settings balanced panels verified by human on 2026-11-13: 1920x1080 screenshot shows two equal-height bordered panels, block vertically centered, Danger zone pinned to bottom of right panel, Ollama models value on one line [CONFIRMED: human screenshot]; 1366x768, fallback stacking, Insert Random, Reset two-step confirm, zoom, console, other tabs, /tests.html 74/74 [CONFIRMED: human-reported, no screenshots].
- T-026 verified by human on 2026-11-13: /tests.html 74/74, header Ollama badge fully visible at 200% zoom [CONFIRMED: human screenshot]; 100/125/150% zoom, all 5 tabs header, Settings Tab order, console, 1366x768 [CONFIRMED: human-reported, no screenshots].
- T-025 Settings 2-column layout verified by human on 2026-11-13: /tests.html 74/74, Settings 1920x1080 two columns with no page scroll [CONFIRMED: human screenshots]; 1366x768, stacked fallback, Insert Random, Reset two-step confirm, zoom, console, other tabs regression [CONFIRMED: human-reported, no screenshots].
- Settings tab: Insert Random Vectors (Demo Vectors Count = 100) [CONFIRMED: human screenshot]
- Explore tab: Empty-state Insert 1000 Vectors button (1000 points shown on canvas) [CONFIRMED: human screenshot]
- Phase 1 to 4b UI (Settings, Compare, Explore, HNSW, Ask, resize, console) and /tests.html 62/62 verified in real browser by human on 2026-11-12 [CONFIRMED: human screenshot/approval]
- T-019 one-screen Phase 1 (shell + Ask pilot) verified by human in real browser on 2026-11-13: /tests.html 66/66 [CONFIRMED: human screenshot]; Ask layout, Settings, Compare, HNSW at 1920x1080 [CONFIRMED: human screenshots]; smart auto-scroll, console clean, small-window fallback, focus outline [CONFIRMED: human-reported, no screenshots]
- T-020 one-screen Phase 2 (Explore + HNSW fit panel, canvas sized from wrapper via ResizeObserver, fallback for Ask/Explore/HNSW, Compare regression check, 1366x768, /tests.html, console) verified by human in real browser on 2026-11-13 [CONFIRMED: human-reported, no screenshots]
- T-021 Ask height fix (short answer, long answer, empty state, 1366x768, small-window fallback, /tests.html 74/74, console) verified by human in real browser on 2026-11-13 [CONFIRMED: human-reported, no screenshots]
- T-023a Compare Phase 3a (fixed-height layout, Summary Metrics in sidebar) at 100% zoom 1920x1080 and 125% zoom verified by human screenshots on 2026-11-13 [CONFIRMED: human screenshots]. Pending human confirmation: console clean, /tests.html 74/74, Explore/HNSW/Ask/Settings regression, 1366x768, small-window fallback.
- **T-040** (2026-11-14, branch `ui-polish-2026`): Quiet luxury premium UI overhaul across all 5 tabs and app shell. Implemented in 5 phases: Phase 1 (design tokens, colors module `web/js/colors.js`, zero hex outside tokens); Phase 2 (spacious sidebar bottom with status dot, commands hint, version row, smooth collapse transition, elevated palette modal); Phase 3 (centered 820px Ask chat, zero-gutter collapsed Documents drawer, docked calm composer, smooth similarity meters, latency chips); Phase 4 (consistent 380px visual sidebars, rounded canvas frames, unclipped Compare Top-k diff table); Phase 5 (centered 1040px Settings container, single scrollbar, generous 64px bottom scroll padding, metric strip with sans numbers, soft card columns). All 118 C++ tests pass, web safety scanner passes, 88 registered browser tests intact. All visual aspects reported as "not tested" pending human screenshots.

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

- Why KD-Tree search time is close to Brute Force at D=128: curse of dimensionality. KD-Tree partitions space with orthogonal hyperplanes; pruning gets worse as dimension grows (roughly above 10 to 20 dimensions), with no sharp threshold. Almost every leaf cell intersects the search hypersphere, so it visits nearly all leaves, degrading toward O(N).
- Why HNSW search time is higher than Brute Force on 100 vectors: constant factor overhead. HNSW does priority-queue operations, visited-set lookups, and pointer chasing across layers; Brute Force is a single contiguous array scan that fits entirely in L1 cache and is vectorized by SIMD. HNSW only wins when N is large (thousands to millions).
- Total assertions (529,746) is reported by the custom test runner; the same number appeared with and without the live Ollama test, so do not claim it comes from the live test.

