# Project Handoff

Last updated: 2026-11-12 by T-SYNC-002

## 1. Current Status
VectorDB is in a stable, verified state following completion and human browser verification of Task T-004. Settings tab (Demo Memory 50.8 KB with 100 vectors, efConstruction form default 200, Ollama Models row with models list) and Ask tab (Title field clears after ingest, pizza question refused, Hinglish question tested) have been confirmed working in a real browser by the human. The test suite stands at 111 C++ tests and 62 browser pure-logic tests with zero compiler warnings and zero web safety violations.

## 2. Last Work Done (From Git)
- **Task T-006** (commit `c0585f1`): Cleaned up issue wording in `KNOWN_ISSUES.md` (removed leftover "In investigate queue" strings), recorded collaboration preferences (human handles viva/report/slides independently), and refreshed `HANDOFF.md` to match pushed state.
- **Task T-005** (commit `46e8cfc`): Recorded T-004 human verification across Settings and Ask tabs, corrected the 529,746 assertion count explanation, and confirmed push to `origin/main`.
- **Task T-004** (commits `2c92b6a`, `03d23d6`, `fe51206`, `c2cf8e4`, `c1ee64e`): Batched fix for ISS-018 to ISS-022 across backend stats (`memory_bytes`), web settings form sync (`efConstruction: 200`), title clearing after ingest, refusal-first V2 prompt with language-matching, Ollama models table row, regression tests, and documentation updates. Confirmed in real browser by human; pushed to `origin/main`.
- **Task T-003**: Read-only investigation of ISS-018..022 root causes and test count reconciliation (57 tests identified prior to T-004).
- **T-SYNC-001** (commit `e300385`): Recorded Brain chat knowledge into docs (verification status, ISS-018..022, ADR-015, viva talking points, collaboration preferences).
- **T-002** (commits `a57bd3f`, `d998065`, `2704c36`): Fixed demo/random field mismatch (frontend sent "count", server requires "n") in `web/js/api.js`, `web/js/settings.js`, `web/js/explore.js`.
- **T-001** (commits `2f9f9a4`, `1b0fa80`): Fixed doc errors (29 endpoints, no CI exists, severity of ISS-005/006, ingest wording).

## 3. Git State
- **Active Branch**: `main` [CONFIRMED: git status -sb]
- **Tracking Status**: `## main...origin/main` (all commits through `c0585f1` pushed to remote; verified by human terminal screenshot and builder git status) [CONFIRMED: human terminal screenshot 2026-11-12]
- **Recent Commits (`git log --oneline -8`)**:
  - `c0585f1` docs: sync handoff, preferences and issue wording after T-005
  - `46e8cfc` docs: record T-004 human verification, fix assertion count claim
  - `c1ee64e` docs: mark ISS-018..022 fixed, update test counts
  - `c2cf8e4` test: add regression tests for ISS-018, ISS-019, ISS-022
  - `fe51206` fix(rag): refusal-first V2 prompt with language and no-repeat rules (ISS-021)
  - `03d23d6` fix(web): sync settings form defaults, clear title after ingest, show Ollama models (ISS-019, ISS-020, ISS-022)
  - `2c92b6a` fix(api): add approximate memory_bytes to /api/stats (ISS-018)
  - `9930634` docs: correct handoff git state and commit references
- **Working Tree**: Clean (only untracked test logs in `results/logs/`) [CONFIRMED: git status -sb]
- Note: Git state in docs can go stale after pushes; always trust human's `git status -sb`.

## 4. Recommended Next Step
- No task pending. Wait for human.

## 5. Pending Human Actions
- All previous action items resolved by human decision on 2026-11-12:
  - Roadmap features (hybrid search, reranking, disk persistence, delete): ON HOLD by human decision; do not start unless explicitly requested by the human.
  - Post-T-004 manual re-check of Explore, HNSW, Compare tabs: SKIPPED by human decision; do not ask again.
  - Verification task T-007 (docs vs git audit): SKIPPED by human decision.

## 6. Open Decisions
- Roadmap features (hybrid search, reranking, disk persistence, delete) remain ON HOLD until the human confirms they are required.
- Strategy for rollback during `RagPipeline::ingest` if a vector insert fails midway (ISS-006) remains documented for future work.

## 7. Important Warnings (Fragile Areas)
- **Do not start roadmap features** (hybrid search, reranking, persistence, delete) until the human confirms they are required.
- **Zero-innerHTML rule**: Never introduce `innerHTML`, `outerHTML` or `insertAdjacentHTML` in `web/js/`. There is no CI; run the scanner manually: `powershell -ExecutionPolicy Bypass -File .\scripts\check_web_safety.ps1`.
- **Strict POST Content-Type**: Every POST route requires `Content-Type: application/json` (send `{}` for empty bodies). Do not weaken this in `server_main.cpp`.
- **No mutex held during Ollama calls** in `src/rag.cpp`.
- **Canvas zero-dimension guard**: Check `isCanvasDrawable` before drawing on hidden canvases.
- **Frontend-to-server field names must be covered by tests** (lesson from ISS-017 / ADR-015).
- **Testing from the human's side**: Reports from ChatGPT or another Claude are human-reported, not proof. Ask for terminal output or screenshots.

## 8. UNCLEAR Items
- Whether disk persistence is required for grading [UNCLEAR; on hold, human decided not to pursue for now].

## 9. Files to Read for Next Task
- `docs/PROJECT_CONTEXT.md`
- `docs/KNOWN_ISSUES.md`
- `docs/DECISIONS.md`
- `docs/PROGRESS.md`
- `docs/HANDOFF.md`
