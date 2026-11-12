# Project Handoff

Last updated: 2026-11-12 by T-002

## 1. Current Status
VectorDB is fully functional following completion of Task T-002. The field name mismatch between frontend ({count}) and backend ({n}) for POST /api/demo/random is resolved, with defensive normalization in api.js and regression tests in both C++ and browser test suites.

## 2. Last Work Done (From Git)
- **Task T-002**: Fixed demo/random contract ({n}), updated settings.js, explore.js, and api.js, corrected API.md section 13 with live server curl output, and added regression tests.
- **Task T-001**: Reconciled endpoint count (29 routes), removed stale CI claims, aligned ISS-005/006 severities, corrected document ingest transaction wording, and committed project memory docs.

## 3. Git State
- **Active Branch**: `main` [CONFIRMED]
- **Unpushed Commits**: Ahead of `origin/main` (commits from Task T-002) [CONFIRMED]
- **Working Tree**: Committing task documentation; untracked verification logs remain in `results/logs/` [CONFIRMED: git status]

## 4. Recommended Next Step
Review the verified project documentation with Claude (Brain) and select the next engineering goal (e.g. hybrid BM25 search, cross-encoder reranking, disk persistence, or presentation preparations).

## 5. Pending Human Actions
1. Confirm whether the commits ahead of `origin/main` should be pushed to GitHub.
2. Confirm priority between feature roadmap items (hybrid search, disk persistence) vs academic presentation preparations.

## 6. Open Decisions
- Strategy for multi-chunk rollback during `RagPipeline::ingest` if an insert throws out-of-memory.
- Selection of disk persistence storage format (custom binary serialization vs SQLite WAL).

## 7. Important Warnings (Fragile Areas)
- **Zero-innerHTML Rule**: Never introduce `innerHTML`, `outerHTML`, or `insertAdjacentHTML` in `web/js/`. The automated safety scanner must be run manually: powershell -ExecutionPolicy Bypass -File .\scripts\check_web_safety.ps1.
- **Strict POST Content-Type**: Every HTTP `POST` route requires `Content-Type: application/json` and `-d "{}"`. Do not weaken this check in `server_main.cpp`.
- **No Mutex Holding during Ollama Calls**: Never hold the collection mutex across Ollama HTTP requests in `src/rag.cpp`.

## 8. UNCLEAR Items
- Calendar deadlines for viva defense and project submission [UNCLEAR].
- Whether persistent disk storage is required for project grading [UNCLEAR].

## 9. Files to Read for Next Task
- `docs/PROJECT_CONTEXT.md`
- `docs/ARCHITECTURE.md`
- `docs/PROGRESS.md`
- `docs/KNOWN_ISSUES.md`

