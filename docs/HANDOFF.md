# Project Handoff

Last updated: 2026-11-12 by T-005

## 1. Current Status
VectorDB is in a stable, verified state following completion and human browser verification of Task T-004. Settings tab (Demo Memory 50.8 KB with 100 vectors, efConstruction form default 200, Ollama Models row with models list) and Ask tab (Title field clears after ingest, pizza question refused, Hinglish question tested) have been confirmed working in a real browser by the human. The test suite stands at 111 C++ tests and 62 browser pure-logic tests with zero compiler warnings and zero web safety violations.

## 2. Last Work Done (From Git)
- **Task T-004** (commits `2c92b6a`, `03d23d6`, `fe51206`, `c2cf8e4`, `c1ee64e`): Batched fix for ISS-018 to ISS-022 across backend stats (`memory_bytes`), web settings form sync (`efConstruction: 200`), title clearing after ingest, refusal-first V2 prompt with language-matching, Ollama models table row, regression tests, and documentation updates. Confirmed in real browser by human; pushed to `origin/main`.
- **Task T-003**: Read-only investigation of ISS-018..022 root causes and test count reconciliation (57 tests identified prior to T-004).
- **T-SYNC-001** (commit `e300385`): Recorded Brain chat knowledge into docs (verification status, ISS-018..022, ADR-015, viva talking points, collaboration preferences).
- **T-002** (commits `a57bd3f`, `d998065`, `2704c36`): Fixed demo/random field mismatch (frontend sent "count", server requires "n") in `web/js/api.js`, `web/js/settings.js`, `web/js/explore.js`.
- **T-001** (commits `2f9f9a4`, `1b0fa80`): Fixed doc errors (29 endpoints, no CI exists, severity of ISS-005/006, ingest wording).

## 3. Git State
- **Active Branch**: `main`
- **Tracking Status**: `## main...origin/main` (up to date with remote; confirmed via `git status -sb`).
- **Working Tree**: Clean. Untracked logs remain in `results/logs/`.
- Always read the real state with `git status -sb` before trusting this section.

## 4. Recommended Next Step
- No code task pending; await human decision on roadmap features or further manual testing of Explore, HNSW, Compare tabs after T-004.

## 5. Pending Human Actions
1. Decide whether any roadmap features (hybrid search, reranking, persistence, delete) are desired.
2. Decide whether further manual testing of Explore, HNSW, and Compare tabs is needed.
3. Tell Brain the submission and viva dates (even an approximate month).
4. Tell Brain the status of the project report and slides (done, partly done, not started).
5. Decide whether the college requires disk persistence or any other roadmap feature.

## 6. Open Decisions
- Strategy for rollback during `RagPipeline::ingest` if a vector insert fails midway (ISS-006).
- Disk persistence format (custom binary vs SQLite WAL), only if persistence is required.

## 7. Important Warnings (Fragile Areas)
- **Do not start roadmap features** (hybrid search, reranking, persistence, delete) until the human confirms they are required.
- **Zero-innerHTML rule**: Never introduce `innerHTML`, `outerHTML` or `insertAdjacentHTML` in `web/js/`. There is no CI; run the scanner manually: `powershell -ExecutionPolicy Bypass -File .\scripts\check_web_safety.ps1`.
- **Strict POST Content-Type**: Every POST route requires `Content-Type: application/json` (send `{}` for empty bodies). Do not weaken this in `server_main.cpp`.
- **No mutex held during Ollama calls** in `src/rag.cpp`.
- **Canvas zero-dimension guard**: Check `isCanvasDrawable` before drawing on hidden canvases.
- **Frontend-to-server field names must be covered by tests** (lesson from ISS-017 / ADR-015).
- **Testing from the human's side**: Reports from ChatGPT or another Claude are human-reported, not proof. Ask for terminal output or screenshots.

## 8. UNCLEAR Items
- Calendar deadlines for viva and project submission [UNCLEAR].
- Status of the project report and slides [UNCLEAR].
- Whether disk persistence is required for grading [UNCLEAR].

## 9. Files to Read for Next Task
- `docs/PROJECT_CONTEXT.md`
- `docs/KNOWN_ISSUES.md`
- `docs/DECISIONS.md`
- `docs/PROGRESS.md`
- `docs/HANDOFF.md`
