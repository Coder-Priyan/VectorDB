# Project Handoff

Last updated: 2026-11-17 by SYNC-014

> **CRITICAL PROTOCOL**: Brain must **NOT** write a Dockerfile task before the Ubuntu CI result and the `--host 0.0.0.0` test are confirmed by the human.

---

## 1. Current Branch & Git State
- **Branch**: `main` (intentional; merged from `ui-redesign-v4` by fast-forward and pushed).
- **Last Commit on Remote**: `4a096ed` (`fix: remove remaining SIMD labels, compute vector footprint`), pushed to origin (`548e081..4a096ed`).
- **Working Tree**: Clean tracked files. `scratch/` and `results/logs/` are ignored in `.gitignore` (files preserved on disk).

---

## 2. Pending Human Checks (Not Yet Seen by Brain)
The following checks must be performed by the human in their terminal / real browser before new implementation tasks:
1. **/tests.html count**: Open `http://localhost:8080/tests.html` in real browser; report passed/total count after T-103 (190 expected).
2. **Settings 1920x1080 100% Zoom Screenshot**:
   - Verify label displays `"Optimization:"` (not `"SIMD Kernel:"`).
   - Verify per-vector memory footprint displays dynamically computed value.
   - Verify footer note displays `"Index State: Active"` (without `"SIMD Aligned"`).
3. **Footprint Dynamic Recalculation Test (ISS-113)**:
   - *Status*: Check 3 (Dimension 64 footprint test, ISS-113) skipped by human on 2026-11-17; stays OPEN.
   - When running: In Settings Demo form, set Dimension to `64`, click Reset Demo Collection, expect `256 Bytes (64 × float32)`, then restore `128`.
4. **GitHub Actions Ubuntu CI Job Screenshot (MOST IMPORTANT - OWED)**:
   - Check GitHub repository Actions tab for the latest push (`4a096ed` on `main`).
   - Report whether the `linux-build` (Ubuntu Latest) job passed or failed, including step logs if failed.
5. **Server `--host 0.0.0.0` Binding & Compare Test (OWED)**:
   - Start server with `.\build\vectordb_server.exe --host 0.0.0.0 --port 8080 --web-dir web`.
   - Open `http://localhost:8080/` in browser, navigate to Compare tab, run benchmark.
   - Report whether requests succeed or if Host/Origin pre-routing security checks trigger 403.

> **NOTE**: Checks 4 and 5 are still owed; Dockerfile is blocked until both are confirmed.

---

## 3. Next Steps in Priority Order
1. **Finish Pending Checks**: Checks 4 and 5 (Ubuntu CI result, `--host 0.0.0.0` test).
2. **Dockerfile Task**: (Blocked until Ubuntu CI result and `--host 0.0.0.0` test results are verified).
3. **~~README Beginner-Friendly Overhaul~~** ✅ **Done (T-104)**:
   - Structured for students: What is this, What You Will Learn, Setup in 5 Minutes (verified Windows commands), Ollama setup, Tab guide, Honest limitations, Project layout, License.
   - Disclosed: Explore/HNSW/Compare work without Ollama; HNSW slower than Brute Force on small collections ($N \le 100$, ISS-004); hallucinations (ISS-001); CPU inference latency (ISS-027); in-memory storage; no auth/TLS (ISS-007); Windows-only confirmation.
4. **Packaging & Distribution**: Author Docker container or pre-compiled Windows release `.zip` on GitHub Releases.
5. **Interactive Curriculum / Learning Path**: Short guided documentation covering Brute Force baseline, KD-Tree orthogonal splits, and HNSW multi-layer navigation.
6. **ISS-110 Decisions**: Human decision on remaining hardcoded strings (items 2, 4, 5, 6, 7).
   - UI screenshots.
4. **Packaging & Distribution**: Author Docker container or pre-compiled Windows release `.zip` on GitHub Releases.
5. **Interactive Curriculum / Learning Path**: Short guided documentation covering Brute Force baseline, KD-Tree orthogonal splits, and HNSW multi-layer navigation.
6. **ISS-110 Decisions**: Human decision on remaining hardcoded strings (items 2, 4, 5, 6, 7).

---

## 4. Current Quality & Verification Gates
- **/tests.html**: 190/190 human-confirmed (2026-11-16 22:26, prior to T-102/T-103; post-T-103 run owed).
- **C++ Tests**: 118/118 passing hermetically (529,813 assertions).
- **Web Safety Scanner**: 29 HTML/JS files scanned; 100% clean (zero forbidden DOM injection APIs, strict CSP verified).
- **CSS Invariants**: 0 hex outside `colors.js`, 0 `box-shadow`, `!important` count = 2.
- **Engine Diff**: `git diff --stat ui-quiet-studio -- src include tests` strictly empty.
- **DOM IDs**: 100% of the 40 Compare DOM IDs and 37 Settings DOM IDs preserved.
- **LICENSE**: Valid MIT License assigned to `Coder-Priyan` (T-100 ✅).

---

## 5. UI Freeze & Deferred Issues (ADR-093)
UI development is officially **FROZEN**. Minor visual issues deferred:
- Compare: KD-Tree shows "1.0x slower" for 166 µs vs 160 µs (rounding/threshold edge case).
- Settings: `vectordb_intro` document listed twice; empty space visible inside cards.
- Explore: Bottom axis labels overlap viewport hint pill.
- HNSW L0: Dense hairball on large collections (edge limit dropdown 20,000 vs "Showing 6,931 of 6,931" is confusing).
