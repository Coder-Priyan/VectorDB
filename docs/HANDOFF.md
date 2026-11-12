# Project Handoff

Last updated: 2026-11-12 by SYNC

## 1. Current Status
VectorDB is in a stable, verified state following manual browser testing by the human and completion of bugfix tasks T-001 and T-002. All 5 web tabs (Ask, Explore, HNSW, Compare, Settings) have been tested in a real browser by the human. Five minor low-severity UI/display issues (ISS-018 to ISS-022) were discovered during testing and tracked in `docs/KNOWN_ISSUES.md`. The project has 110 passing C++ unit tests, 57 browser unit tests, zero compiler warnings, and passed web safety checks.

## 2. Last Work Done (From Git)
- **Task T-002** (commits `a57bd3f`, `d998065`, `2704c36`): Fixed demo/random field name mismatch ("n" vs "count") across frontend (`web/js/settings.js`, `web/js/explore.js`, `web/js/api.js`), updated `docs/API.md` section 13 with verified curl responses, and added regression tests (`tests/test_api.cpp`, `web/js/tests/api_tests.js`).
- **Task T-001** (commits `8c3f56f`, `1b0fa80`): Corrected documentation claims (29 registered API endpoints, removed nonexistent CI badge, updated ISS-005/006 severity levels, fixed document ingest transaction claims).
- **Task 7b** (commit `dc82c36`): Fixed false doc claims regarding hybrid search and test counts; bumped version to 1.1.0; created project documentation in `/docs`.

## 3. Git State
- **Active Branch**: `main` [CONFIRMED: git status -sb]
- **Tracking Status**: `## main...origin/main [ahead 3]` [CONFIRMED: git status -sb]
- **Unpushed Commits (3)**:
  - `2704c36` docs: correct /api/demo/random request and response in API.md
  - `d998065` fix(web): send 'n' to /api/demo/random from settings and explore
  - `a57bd3f` test: add regression test for demo/random field name
  [CONFIRMED: git log origin/main..HEAD --oneline]
- **Working Tree**: Documentation synchronized; untracked logs in `results/logs/` [CONFIRMED: git status]

## 4. Recommended Next Step
- **T-003**: Read-only investigation of ISS-018 (Demo Memory 0 B), ISS-019 (efConstruction form default mismatch), and ISS-020 (Ask tab title field retention), followed by ONE batched fix task addressing confirmed bugs among ISS-018 through ISS-022 if approved.

## 5. Pending Human Actions
1. Review screenshots in `results/screenshots/` (Settings random vector insert, Explore 1000 vector empty-state).
2. Decide whether ISS-018 through ISS-022 need fixing before calling the project complete.
3. Decide whether to push the 3 local commits (`a57bd3f..2704c36`) to GitHub `origin/main`.
4. Decide whether any roadmap feature (hybrid search, reranking, persistence, delete) is needed.

## 6. Open Decisions
- Whether to address ISS-018..022 in a single batched fix task (per ADR-015).
- Strategy for multi-chunk rollback during `RagPipeline::ingest` if an insert throws out-of-memory.
- Selection of disk persistence storage format (custom binary serialization vs SQLite WAL) if persistence is requested.

## 7. Important Warnings (Fragile Areas)
- **Do Not Start Roadmap Features**: Do not start roadmap features (hybrid search, reranking, persistence, delete) until the human confirms they are required.
- **Zero-innerHTML Rule**: Never introduce `innerHTML`, `outerHTML`, or `insertAdjacentHTML` in `web/js/`. The automated safety scanner must remain clean: `powershell -ExecutionPolicy Bypass -File .\scripts\check_web_safety.ps1`.
- **Strict POST Content-Type**: Every HTTP `POST` route requires header `Content-Type: application/json` and body `-d "{}"`. Do not weaken this check in `server_main.cpp`.
- **No Mutex Holding during Ollama Calls**: Never hold the collection mutex across Ollama HTTP requests in `src/rag.cpp`.
- **Canvas Zero-Dimension Guard**: Verify `isCanvasDrawable` before drawing on dynamic or hidden canvases in `web/js/`.

## 8. UNCLEAR Items
- Calendar deadlines for viva defense and final project submission [UNCLEAR].
- Whether persistent disk storage is required for academic grading [UNCLEAR].

## 9. Files to Read for Next Task
- `docs/PROJECT_CONTEXT.md`
- `docs/KNOWN_ISSUES.md`
- `docs/DECISIONS.md`
- `docs/PROGRESS.md`
- `docs/HANDOFF.md`
