# Project Handoff

Last updated: 2026-11-17 by SYNC-016

> **CURRENT STATUS**: Branch `main`. HEAD = commit after SYNC-016 (pushed to `origin/main` up to `4f32299`).
> **CONTAINER & PACKAGING STATUS**: Dockerfile task DONE (T-106..T-108), CI job DONE (T-107), README Docker section DONE (T-109). Packaging decision (human, 2026-11-17): Docker only for now (ADR-100); Windows release zip not planned. Docker is CI-verified (GitHub Actions runs #6 and #7 green across Windows, Linux, and Docker smoke test). Dockerfile is CI-tested, not locally tested.
> **CRITICAL PROTOCOL**: Check 5 DONE. Check 3 SKIPPED/OPEN. UI work is officially FROZEN per ADR-093. Next chat focuses on interactive curriculum / learning path and ISS-110 string decisions.

---

## 1. Current Branch & Git State
- **Branch**: `main` (intentional; merged from `ui-redesign-v4` by fast-forward and pushed).
- **Last Commit on Remote**: `4f32299` (`docs: README Docker section (T-109)`), pushed to origin.
- **Working Tree**: Clean tracked files. `scratch/` and `results/logs/` are ignored in `.gitignore` (files preserved on disk).

---

## 2. Verification Gates & Human Checks Status
1. **Check 1 (Git State & SIMD Grep Verification)** — ✅ **DONE**:
   - Human terminal output confirmed HEAD `d7b8bd4` pushed to `origin/main` on 2026-11-17.
   - `Select-String -Path web\js\*.js,web\index.html -Pattern 'SIMD'` gives exactly 6 matches, all internal identifiers or code comments (`settings-simd-status` ID, `simdStatusEl`, `simdStatus`, 2 JSDoc comments); zero visible UI claims.
2. **Check 2 (Browser Tests & Settings UI Verification)** — ✅ **DONE**:
   - Human real browser run: `/tests.html` **190/190 passed** (confirmed 2026-11-17 09:08, post-T-103).
   - Human Settings screenshot (1920x1080 100% zoom, 09:09): Confirmed label `"Optimization:"`, `"Index State: Active"`, and `"Footprint / Vec: 512 Bytes (128 × float32)"`.
3. **Check 3 (Dimension 64 Footprint Test, ISS-113)** — ⏸️ **SKIPPED by human, stays OPEN**:
   - Skipped by human on 2026-11-17. Stays OPEN as low-priority verification debt.
4. **Check 4 (GitHub Actions CI Run #4 Verification)** — ✅ **DONE**:
   - Human screenshots of GitHub Actions run #4 (commit `d7b8bd4`, 2026-11-17) confirmed:
     - Ubuntu Build & Test (Linux) green: steps "Configure CMake", "Build VectorDB", and "Run Test Suite" all passed.
     - Windows Build & Test (UCRT64) green: including Web Safety Scanner.
5. **Check 5 (Server `--host 0.0.0.0` Binding & Compare Test)** — ✅ **DONE**:
   - Confirmed by human screenshot on 2026-11-17: Server started with `.\build\vectordb_server.exe --host 0.0.0.0 --port 8080 --web-dir web`.
   - Opened as `http://localhost:8080/` (NOT `http://0.0.0.0:8080/`, which triggers `ERR_ADDRESS_INVALID` in modern browsers).
   - Settings tab: inserted 100 random vectors via Demo form.
   - Compare tab: benchmark executed successfully across Brute Force, KD-Tree, and HNSW with zero 403 / CORS errors.
   - Unblocked Dockerfile task (T-106).
6. **Check 6 (Docker CI Smoke Test, `docker-build` Job)** — ✅ **DONE (CI Runs #6 & #7)**:
   - Packaging decision (human, 2026-11-17): Docker only for now (ADR-100); Windows release zip not planned.
   - GitHub Actions run #6 (commit `f67d1ea`) and run #7 (commit `4f32299`) green across all 3 jobs (Windows Build & Test, Ubuntu Build & Test, Docker Build & Smoke Test).
   - Verified in CI: image builds and smoke test succeeds (`curl -sf http://127.0.0.1:8080/` and `curl -sf http://127.0.0.1:8080/api/health`).
   - Not verified: Ask inside Docker, named-volume persistence across restarts, any local docker run on author's PC (Docker not installed on host).
   - Dockerfile status: CI-tested, not locally tested.

---

## 3. Next Steps in Priority Order
1. **Interactive Curriculum / Learning Path**:
   - Short guided documentation covering:
     - Brute Force baseline (linear scan, cache locality, exact distances).
     - KD-Tree orthogonal splits (median partitioning, hyperplanes, curse of dimensionality).
     - HNSW multi-layer navigation (skip-list graph hierarchy, greedy upper-layer hops, beam search at L0).
   - **Crucial protocol**: Brain must **ask the human for format first** (markdown documentation file vs in-app guide / educational modal).
2. **Human Decision on ISS-110 Remaining Strings**:
   - Items 2, 4, 5, 6, 7 in `docs/KNOWN_ISSUES.md` (e.g. "Uniform Spherical Manifold", "M = 16 (L1+)...", "Greedy Upper", "O(log N) Beam Navigation", "Multi-Threaded HTTP Worker Pool").
3. **Optional Verification Debt**:
   - Check 3 (ISS-113): Test whether changing dimension dynamically updates the Settings footprint line without full page refresh.
4. **Optional Local Docker Testing**:
   - If human installs Docker Desktop in the future: test local docker run, named-volume persistence across restarts, and Ask-in-Docker with host Ollama.

---

## 4. Collaboration Notes & Working Protocol
- **Communication Style**: The human replies in short Hinglish, wants **one question at a time**.
- **Verification Rule**: The Brain must verify against the human's terminal output and actual file contents on disk, never builder report diffs.
- **Terminal Pagers**: Always use `git --no-pager diff` so output does not halt at `(END)`.
- **Sync Trigger**: "SYNC" is requested when the chat context gets long to prepare a clean resume point.
- **Git Authority**: Push and merge operations are the human's sole operational decisions.

---

## 5. Current Quality & Verification Gates
- **/tests.html**: **190/190 passed** (human-confirmed in real browser 2026-11-17 09:08, post-T-103).
- **C++ Tests**: 118/118 passing hermetically (529,813 assertions).
- **Web Safety Scanner**: 29 HTML/JS files scanned; 100% clean (zero forbidden DOM injection APIs, strict CSP verified).
- **CSS Invariants**: 0 hex outside `colors.js`, 0 `box-shadow`, `!important` count = 2.
- **Engine Diff**: `git diff --stat ui-quiet-studio -- src include tests` strictly empty.
- **DOM IDs**: 100% of the 40 Compare DOM IDs and 37 Settings DOM IDs preserved.
- **LICENSE**: Valid MIT License assigned to `Coder-Priyan` (T-100 ✅).

---

## 6. UI Freeze & Deferred Issues (ADR-093)
UI development is officially **FROZEN**. Minor visual issues deferred:
- Compare: KD-Tree shows "1.0x slower" for 166 µs vs 160 µs (rounding/threshold edge case).
- Settings: `vectordb_intro` document listed twice; empty space visible inside cards.
- Settings: Section header "HARDWARE ACCELERATION" still visible above "Optimization:" (ISS-115).
- Explore: Bottom axis labels overlap viewport hint pill.
- HNSW L0: Dense hairball on large collections (edge limit dropdown 20,000 vs "Showing 6,931 of 6,931" is confusing).
