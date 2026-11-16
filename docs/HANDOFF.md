# Project Handoff

Last updated: 2026-11-16 by T-099 sync

> **NEXT STEP**: Merge `ui-redesign-v4` to `main`. Then: verify Linux/macOS build, update README with beginner setup steps and screenshots, add Docker or Windows release zip, write short learning path. UI work is FROZEN by human decision (2026-11-16). Known visual issues are deferred — see below. LICENSE copyright filled (Coder-Priyan, T-100 ✅).

## Current Verification State (Human-Confirmed vs Builder-Reported)
- **/tests.html**: **190/190 human-confirmed 2026-11-16 22:26** (real browser). Registered browser test count is 190. Older numbers 172/185 are stale.
- **Git State**: Local branch `ui-redesign-v4`, clean working tree. `scratch/` and `results/logs/` are now gitignored (files still on disk). `ui-redesign-v4` is 246 commits ahead of `main`; `main` has 0 commits not in `v4`. Commits unpushed per protocol.
- **Quality Gates (Human-Confirmed 2026-11-16)**:
  - HEAD: `5446fde`
  - `check_web_safety.ps1`: 100% clean (29 files, zero innerHTML/outerHTML/eval/etc.).
  - `build/vectordb_tests.exe`: 118/118 passing (529,813 assertions).
  - Browser tests: 190/190 passing in real browser (`/tests.html`).
  - CSS Invariants: 0 hex outside `colors.js`, 0 box-shadows, `!important` count = 2.
  - Engine diff vs `ui-quiet-studio`: empty (C++ engine unchanged).
  - DOM IDs: 40 Compare DOM IDs (100% preserved) and 37 Settings DOM IDs (100% preserved).
  - Frozen Files: Ask, Explore, HNSW, sidebar/shell, C++ engine, and `docs/API.md` byte-identical.

## UI Freeze & Known Deferred Visual Issues (2026-11-16)
UI work is **FROZEN** by human decision. The following known visual issues are deferred to the human for a future fix pass — do NOT address them before merge:
- **Compare**: KD-Tree shows "1.0x slower" for 166 µs vs 160 µs (rounding/threshold edge case).
- **Settings**: `vectordb_intro` document listed twice; empty space visible inside cards.
- **Explore**: Bottom axis labels overlap the viewport hint pill.
- **HNSW L0**: Dense hairball on large collections (known graph rendering limitation).

## Product Direction (2026-11-16)
VectorDB is being repositioned as a **free, open-source, self-hosted learning platform** for students who want to understand vector databases, HNSW, KD-Tree, Brute Force, and RAG pipelines interactively and visually. Fully offline, Ollama required only for the Ask/RAG tab. No cloud, no subscription.

**Planned post-merge order**:
1. Merge `ui-redesign-v4` → `main`
2. ~~Fill LICENSE copyright name~~ ✅ **Done** — `Copyright (c) 2026 Coder-Priyan` (T-100)
3. Verify Linux/macOS build
4. Update README: beginner-friendly setup steps + screenshots
5. Add Docker support or Windows release zip (1-command setup)
6. Write short in-app learning path / guided onboarding
7. (Future) Marketing/landing website — on hold for now
