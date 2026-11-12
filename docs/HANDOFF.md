# Project Handoff

Last updated: 2026-11-12 by T-001

## 1. Current Status
VectorDB is in a stable, fully functional state following completion of Task T-001 documentation verification. All core search indexes (Brute Force, KD-Tree, HNSW), the matrix-free 2D PCA visualizer, the offline Ollama RAG pipeline, the 29-route REST HTTP server, and the 5-tab offline web UI are compiled and passing all hermetic tests.

## 2. Last Work Done (From Git)
- **Task T-001**: Reconciled endpoint count (29 routes), removed stale CI claims, aligned ISS-005/006 severities, corrected document ingest transaction wording, and committed project memory docs.
- **Commit `1297c59`**: Extended `scripts/check_web_safety.ps1` to detect DOM injection APIs (`createContextualFragment`, `DOMParser`, `srcdoc`, `javascript:`, `setAttribute on*`, `.href`/`.src` assignments) and split comment matches from code findings.
- **Commit `79335c3`**: Aligned `docs/DEMO_SCRIPT.md` (red star `#ef4444`, default 100 vectors) and `docs/API.md` (mandatory POST `Content-Type: application/json` on empty payloads).

## 3. Git State
- **Active Branch**: `main` [CONFIRMED]
- **Unpushed Commits**: Ahead of `origin/main` (commits from Task 7b and T-001) [CONFIRMED]
- **Working Tree**: Project documentation committed; untracked verification logs remain in `results/logs/` [CONFIRMED: git status]

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

