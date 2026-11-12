# Project Handoff

Last updated: 2026-11-12 by T-009

## 1. Current Status
VectorDB engine is in a stable, verified, and frozen state. The current active work is UI/UX redesign on branch `ui-redesign` in the Editor/Terminal direction (serious, flat, dark, tool-like, IBM Plex typography, amber accent). A complete static mockup of the Ask tab has been implemented in `web/mockup/ask.html` for human review before touching any real UI production code.

## 2. Last Work Done (From Git)
- **Task T-009** (branch `ui-redesign`): Downloaded official IBM Plex Sans and Mono `.woff2` fonts with license into `web/fonts/`; created static Ask tab mockup in `web/mockup/ask.html` and `web/mockup/mockup.css` in the Editor/Terminal direction; verified 100% compliance with strict CSP, zero forbidden patterns, and HTTP 200 via `vectordb_server.exe`.
- **Task T-006** (commit `c0585f1`): Cleaned up issue wording in `KNOWN_ISSUES.md` (removed leftover "In investigate queue" strings), recorded collaboration preferences (human handles viva/report/slides independently), and refreshed `HANDOFF.md` to match pushed state.
- **Task T-005** (commit `46e8cfc`): Recorded T-004 human verification across Settings and Ask tabs, corrected the 529,746 assertion count explanation, and confirmed push to `origin/main`.
- **Task T-004** (commits `2c92b6a`, `03d23d6`, `fe51206`, `c2cf8e4`, `c1ee64e`): Batched fix for ISS-018 to ISS-022 across backend stats (`memory_bytes`), web settings form sync (`efConstruction: 200`), title clearing after ingest, refusal-first V2 prompt with language-matching, Ollama models table row, regression tests, and documentation updates. Confirmed in real browser by human; pushed to `origin/main`.
- **Task T-003**: Read-only investigation of ISS-018..022 root causes and test count reconciliation (57 tests identified prior to T-004).
- **T-SYNC-001** (commit `e300385`): Recorded Brain chat knowledge into docs (verification status, ISS-018..022, ADR-015, viva talking points, collaboration preferences).
- **T-002** (commits `a57bd3f`, `d998065`, `2704c36`): Fixed demo/random field mismatch (frontend sent "count", server requires "n") in `web/js/api.js`, `web/js/settings.js`, `web/js/explore.js`.
- **T-001** (commits `2f9f9a4`, `1b0fa80`): Fixed doc errors (29 endpoints, no CI exists, severity of ISS-005/006, ingest wording).

## 3. Git State
- **Active Branch**: `ui-redesign` (branched from `main` at `689aa47`) [CONFIRMED: git status -sb]
- **Tracking Status**: Local branch `ui-redesign` without upstream tracking (commits unpushed per protocol).
- **Working Tree**: Clean (only untracked test logs in `results/logs/`) [CONFIRMED: git status -sb]
- Note: Git state in docs can go stale after pushes; always trust human's `git status -sb`.

## 4. Recommended Next Step
- Human reviews web/mockup/ask.html in browser; then decide full redesign phases.

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
