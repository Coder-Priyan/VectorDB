# Project Handoff

Last updated: 2026-11-12 by SYNC

## 1. Current Status
VectorDB is stable and verified for the core engine. The human confirmed in their own terminal: 110/110 C++ tests (assertions 529746 in the live Ollama run), zero warnings on clean rebuild, 4 executables, web safety scan pass, 29 API routes, 17 server flags. The human also manually tested the web UI in a real browser on 2026-11-12 and found the demo/random bug (ISS-017), which T-002 fixed. Five low-severity UI issues (ISS-018 to ISS-022) are open in `docs/KNOWN_ISSUES.md`. See "Verification Status" in `docs/PROJECT_CONTEXT.md` for what is confirmed by the human and what is only human-reported.

## 2. Last Work Done (From Git)
- **T-SYNC-001** (commit `e300385`): Recorded Brain chat knowledge into docs (verification status, ISS-018..022, ADR-015, viva talking points, collaboration preferences).
- **T-002** (commits `a57bd3f`, `d998065`, `2704c36`): Fixed demo/random field mismatch (frontend sent "count", server requires "n") in `web/js/api.js`, `web/js/settings.js`, `web/js/explore.js`. Added regression assertions in `tests/test_api.cpp` and `web/js/tests/test_core.js`. Corrected `docs/API.md` section 13. Confirmed by the human in a real browser (Settings insert: count 100; Explore insert: 1000 points).
- **T-001** (commits `2f9f9a4`, `1b0fa80`): Fixed doc errors (29 endpoints, no CI exists, severity of ISS-005/006, ingest wording) and committed the project memory docs.
- **Phase 7 / Task 7b** (last code commit before takeover: `1297c59`): Doc reconciliation and web safety scanner extension.

## 3. Git State
- **Active Branch**: `main`
- **Pushed**: All commits up to `e300385` are on `origin/main` (pushed by the human on 2026-11-12).
- **Working Tree**: No modified tracked files except this handoff edit, if not yet committed. Untracked logs remain in `results/logs/`.
- Always read the real state with `git status -sb` before trusting this section.

## 4. Recommended Next Step
- **T-003**: Read-only investigation of ISS-018 (Demo Memory shows 0 B), ISS-019 (efConstruction form default 64 vs server 200) and ISS-020 (Ask Title field not cleared after ingest). No code changes. Then ONE batched fix task for ISS-018 to ISS-022 if the human approves (per ADR-015).

## 5. Pending Human Actions
1. Tell Brain the submission and viva dates (even an approximate month).
2. Tell Brain the status of the project report and slides (done, partly done, not started).
3. Decide whether ISS-018 to ISS-022 must be fixed before the viva.
4. Decide whether the college requires disk persistence or any other roadmap feature.

## 6. Open Decisions
- Whether to fix ISS-018..022 in a single batched task (per ADR-015).
- Strategy for rollback during `RagPipeline::ingest` if a vector insert fails midway (ISS-006).
- Disk persistence format (custom binary vs SQLite WAL), only if persistence is required.

## 7. Important Warnings (Fragile Areas)
- **Do not start roadmap features** (hybrid search, reranking, persistence, delete) until the human confirms they are required.
- **Zero-innerHTML rule**: Never introduce `innerHTML`, `outerHTML` or `insertAdjacentHTML` in `web/js/`. There is no CI; run the scanner manually: `powershell -ExecutionPolicy Bypass -File .\scripts\check_web_safety.ps1`.
- **Strict POST Content-Type**: Every POST route requires `Content-Type: application/json` (send `{}` for empty bodies). Do not weaken this in `server_main.cpp`.
- **No mutex held during Ollama calls** in `src/rag.cpp`.
- **Canvas zero-dimension guard**: Check `isCanvasDrawable` before drawing on hidden canvases.
- **Frontend-to-server field names must be covered by tests** (lesson from ISS-017).
- **Testing from the human's side**: Reports from ChatGPT or another Claude are human-reported, not proof. Ask for terminal output or screenshots.

## 8. UNCLEAR Items
- Calendar deadlines for viva and project submission [UNCLEAR].
- Status of the project report and slides [UNCLEAR].
- Whether disk persistence is required for grading [UNCLEAR].
- Number of browser pure-logic tests: docs say 55, an earlier draft said 57; not verified by the human [UNCLEAR].

## 9. Files to Read for Next Task
- `docs/PROJECT_CONTEXT.md`
- `docs/KNOWN_ISSUES.md`
- `docs/DECISIONS.md`
- `docs/PROGRESS.md`
- `docs/HANDOFF.md`