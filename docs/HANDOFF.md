# Project Handoff

Last updated: 2026-11-15 by SYNC-010

> **NEXT STEP**: Human verifies T-063 (Compare) and sends: /tests.html count; full-window 1920x1080 100% screenshots of Compare Demo results, Demo empty (0 vectors), Docs results, Docs empty, Options popover open, both dropdowns open, one at 125% zoom. Brain reviews them (ISS-057 gap and right-edge clipping first). Then next tab = Explore: the human works in the Design Chat (needs screenshots of the current Explore, empty and populated) and brings the FINAL SPEC plus approved mockup names (planned 12-explore-results.png, 13-explore-empty.png); Brain then writes ONE builder task. Do not write the Explore task before the FINAL SPEC.
>
> **NEEDED FROM THE HUMAN**: (1) /tests.html count; (2) full-window 1920x1080 100% screenshots of Compare Demo results, Demo empty (0 vectors), Docs results, Docs empty, Options popover open, both dropdowns open, one at 125% zoom; (3) save approved mockups as docs/mockups/10-compare-results-v2.png and 11-compare-empty-v2.png; (4) Explore design work in the Design Chat (send screenshots of current Explore tab).

## T-063 summary (Brain wrote it; supersedes T-062 layout per ADR-057)

- **Layout**: page header -> raised control row (~56px, `--bg-raised`, 14px radius, no border) containing Collection and Repetitions dropdowns, Docs query input, single primary amber button per mode (`compare-demo-random-btn` / `compare-docs-run-btn`), ghost "Options" button with `sliders` line icon opening `#compare-options-popover` (k, efSearch, Stored Vector ID input, secondary `compare-demo-id-btn`, warm-up note), right status notice, and 2px progress fill line (amber only while running, auto-resets) -> two stacked panels (~55% / 45%) OR calm centered empty-state panel with secondary button (`compare-initial-run-btn`).
- **Lanes spec**: 3 lanes (Brute Force taupe `#9c8269`, KD-Tree moss `#708a78`, HNSW amber `#d9a441`) with 4-column shared CSS grid. Median latency 6px pill bar on shared scale with min-max range text in µs; distance computations 6px pill bar on shared linear scale (`computeBarScale`, replaces dot matrix); top-k recall squares for real $k$ (10x10px, 4px gap, filled in alg color, unfilled faint); muted legend line.
- **Top-k ground truth diff spec**: collapsed design (`buildRankDiff`, replaces 10-column matrix). Per non-brute algorithm (KD-Tree, HNSW): header with colored dot, label, dot separator, "N of K same rank". If N=K, small stroke-only muted-moss check glyph and no chips. If mismatches exist, compact pill chips with muted amber dot ("Rank R: expected #GT, got #ID" or "got —" if missing) with mono IDs. Bottom muted note.
- **Rules**: one primary amber button per view in every state (when collection has 0 items, benchmark buttons disabled, initial-run button hidden); zero box-shadows; zero hex outside colors.js; 28px main padding applied via tab-scoped margin/padding compensation (ISS-057 resolved); real data only.
- **Git**: commit A (`96c2495`), commit B (`63b96f4`), docs commit (`9e36e5a`).

## 1. Current Status

VectorDB v2 has been completely built across all 9 phases (P0 to P8). Following human browser review on 2026-11-14, Tasks T-034 through T-038 resolved confirmed UI issues, test edge cases, and glass-box response mappers. Following visual rejection of T-040 ("no fun at all", line noise, patched overrides), Task T-041 rebuilt the UI layer under "Quiet Studio". Task T-042 addressed batched human review items across toolbars, compare canvas bars, summary table column visibility, HNSW topology viewport budgeting, native control restyling, and shared empty states. Task T-043 implemented the reference-guided Settings redesign with a live status rail, fixed Compare empty state restoration, transformed Ask glass-box latency breakdown to a tidy grid, converted the Documents drawer to an absolute slide-over panel preserving chat centering, reduced CSS `!important` to 3, and expanded test coverage.

Following human review of Settings (long single scroll rejected), Task T-046 rebuilt Settings into a one-screen 3-column panel grid of filled surface panels (--bg-panel, no borders, no shadows) chosen by the human from an AI mockup (structure and feel only). Human liked the 3-column panel grid concept. Following human review of T-046, Task T-047 polished Settings to fill available width and height, but height/width stretching made panels hollow and sparse. Pending task T-048 (Settings: content-sized panels, balanced columns, left-aligned header) was planned and written by Brain but NOT executed, and was CANCELLED/superseded by ADR-047.

Following human visual rejection of T-049 Compare layout (2026-11-14; empty card / skeleton stayed visible over results, 8 rows not 10, side-by-side metrics/bars), Task T-050 rebuilt the Compare tab from a new human-approved AI mockup (layout and feel only, using our tokens and DOM IDs). Implemented as a 3-column Studio panel grid (`.compare-grid`): Column 1 holds benchmark controls, progress indicator, and Summary Metrics; Column 2 and Column 3 show either a clean mutually-exclusive centered empty state (`#compare-empty-state` with secondary action button) or results (`#compare-results-card`, `display: contents`) consisting of Column 2 stacked metric bar charts (latency, distances, recall across Brute Force, KD-Tree, HNSW) and Column 3 scrollable Top-k Diff table showing all 10 rows with match badges.

Following human screenshot review of T-050, Task T-051 resolved 6 observed defects structurally: removed `.table-container` wrapper class from diff scroll and summary table, eliminating the 320px max-height cap and nested `--bg-raised` boxes so all 10 diff rows fit without page scroll; added thin quiet scrollbars; placed match/diff badges directly after ID text with 6px gap in a fixed-grid table (`width: calc((100% - 36px) / 3)`) with headers left-aligned to cell text; removed hollow bottom area in left panel with content-sized summary section; formatted Median cell strictly in microseconds without extra `(0.0 ms)` suffix; unclipped Recall@k column; cleared chart canvases to transparent removing dark background box; made chart rows compact with sleek 8px bars and matching panel titles. Registered browser tests expanded to 99.

Following human screenshot review of T-051, Task T-052 restored the full-height equal panel layout from T-050 (reversing the mistaken T-051 "content-sized" change on Compare): `.compare-grid` fills available height with equal columns (`align-items: stretch`, `height: 100%`), bars spaced calmly across panel height as in T-050, while strictly preserving all T-051 diff table fixes (zero nested boxes, narrow # column, equal result columns, inline badge next to ID, no visible scrollbar when 10 rows fit, no gutter, Median only in us, transparent chart canvases, matching panel titles).

Task T-053 resolved Compare tab stale results and empty state presentation. Added `resetCompareView()` to wipe Summary Metrics, status text, progress bar, chart canvases, diff table, and cached report data when: (a) collection is changed, (b) collection count is 0, or (c) Compare tab is activated (via `#tab-btn-compare` click, `MutationObserver` on `#panel-compare` class, or `window.focus`). Empty panel titles dynamically adapt via helper `getCompareEmptyStateConfig`: 'Collection is empty' (Demo), 'No documents yet' (Docs), and 'No benchmark yet' (unbenchmarked populated collection). Registered browser unit tests expanded to 105 (6 new tests).

Task T-054 replaced the 3 middle-column Compare bar charts with the human-approved design from AI mockups (ADR-045). Added HTML panel headers with SVG line icons (`clock`, `layers`/`stack`, `target` in `web/js/icons.js`), bold titles ("Latency (µs)", "Distance Computations", "Recall@k"), and muted subtitles ("Lower is better", "Higher is better"); thicker solid horizontal bars (14-18px) with rounded right ends and mono value labels; hairline x-axes with tick marks, muted tick labels, and centered axis titles; pure helper `niceAxis(maxValue)` (~5-6 ticks) and `mapChartRows(metricKey, report, latencies)` reading real server responses. Registered browser unit tests expanded to 113 (8 new pure-logic tests).

Following human approval of the full set of 7 AI mockups (ADR-047, superseding Quiet Studio), Task T-055 initiated the Redesign v3 on branch `ui-redesign-v3`. T-055 established the unified design foundation (3 dark surfaces `#09090b`, `#121215`, `#18181c`, amber accent `#d9a441`, radii 6/10/14px, hairlines restricted to tables/metric strips/sidebar dividers, zero box-shadows), app shell (brand header, timestamped Recent Chats with `+` action, footer with `Ollama online` / `v0.4.0` status pills), and completely rebuilt the Ask tab (centered 860px viewport, empty state with chips matching `01-ask-empty.png`, results view with user avatar timestamps, assistant layers logo, citation pills, glass-box accordion with 3-part chunk cards, 5-column latency metric tiles with amber Total tile, 3 action buttons matching `02-ask-results.png`, and slide-over `.ask-docs-drawer`).

Task T-055b investigated the 2 failing tests reported by human on `/tests.html` (111/113 passed). Found `realBenchmarkFixture` had been defined inside the T-050 `describe` closure, making it `undefined` in the T-054 `describe` suite added on `ui-quiet-studio`. Moved `realBenchmarkFixture` to module scope in `web/js/tests/test_compare.js`. Scoping fix uncovered a secondary bug in `mapChartRows` (`web/js/compare_helpers.js:552` passes `latencies = null` into `extractChartMetrics` which does `latencies[alg]` throwing `TypeError: Cannot read properties of null (reading 'brute')`). Documented as ISS-049; stopped without touching production code per instructions.

Task T-055c resolved the secondary bug in `extractChartMetrics` (`web/js/compare_helpers.js:414` now normalizes null/undefined `latencies` to an empty object, allowing fallback to `latency_us`), replaced the hex literal `#ffffff` at line 701 with `THEME.white` from `web/js/colors.js` (achieving zero hex literals outside `:root` and `colors.js`), and added a pure-logic test for null latencies bringing registered tests to 114. Top-k control (`#ask-k-input`) was restored as a compact quiet control next to algorithm select in the Ask composer, and the Command Palette button (`#open-palette-btn`) was restored as a visible ghost search-icon button in the sidebar footer (functioning in both expanded and 56px collapsed rail) (decisions by Brain, delegated design, ADR-049).

Task T-056 executed the complete master build of Redesign v3 across 6 sequential phases on branch `ui-redesign-v3` (ADR-048):
- **Phase 0 (Commit `515ff77`)**: Ask polish & canvas color sync. Synchronized `web/js/colors.js` text tokens (`#f4f4f5`, `#a1a1aa`, `#71717a`) to match `:root` CSS tokens; updated test assertions in `test_colors.js`; verified Ask chip text, page-header subtitle, and glass-box title.
- **Phase 1 (Commit `7b2be62`)**: Explore tab rebuild from `03-explore.png`. Large rounded 2D PCA panel with PC1/PC2 axis ticks and titles, document cluster legend with counts and Demo neutral swatch, star query with line links and neighbor ID labels, right query sidebar with Project & Search amber primary button and Nearest neighbours list cards displaying distance and similarity, and shared empty-state component.
- **Phase 2 (Commit `8abdef3`)**: HNSW tab rebuild from `04-hnsw.png`. Fixed-width compact layer slider (`L0..Ln`), "HNSW Graph — Layer Ln" header, entry point ring with `Entry (Ln)` badge, query star with `Query` badge, right search path trace panel with Random amber primary button, step playback controls with step counter, stat tiles for current node/dist/layer and search statistics, and bottom topology summary metric strip (Nodes, Max level, Entry point).
- **Phase 3 (Commit `d9a4097`)**: Compare tab rebuild from `05-compare-results.png` & `06-compare-empty.png`. Panel headers with subtitles ("Benchmark Setup", "Summary Metrics", "Top-k ground truth diff"), preserved 3-column equal-height layout (T-052), 3 stacked bar charts with ADR-045 axis design, 10 unclipped diff rows with inline match badges, and calm mutually exclusive empty state with secondary button.
- **Phase 4 (Commit `f45e51b`)**: Settings tab rebuild from `07-settings.png`. One-screen 3-column grid of content-sized filled surface panels with calm padding (eliminating hollow stretching): Col 1 Server status (live status dot, version, dimension/metric, HNSW params, models list, demo memory), Col 2 Demo collection form + Insert random (single primary amber button `+ Insert`), Col 3 Chat history, Documentation links, and quiet soft-red Danger zone.
- **Phase 5 (Commit `1f5b093`)**: Consistency sweep across all 5 tabs. Verified strictly <= 1 primary amber button per view across all states, zero dead styles, `!important` count = 2 (<= 3), `box-shadow` count = 0, zero hex literals outside `:root` and `colors.js`, docs synchronized (ADR-048, ISS-049 fixed).

Task T-057 executed the Ask tab redesign v3.1 from human-approved mockups (and shell status pill) on branch `ui-redesign-v3` (ADR-050):
- **Commit `acb96a3` (T-057 A)**: Removed leftover `max-height: 50vh` cap on Ask message list (`.answer-box`), allowing message list to fill the viewport down to the composer without dead gap; chunk card similarity value formatted with `white-space: nowrap` and `min-width: 44px`; latency pipeline 5 tiles in left-to-right flow with `arrowRight` line icons between tiles and real timings; synchronized `web/samples/vectordb_intro.txt` with `samples/vectordb_intro.txt` (zero 'dot' matches); added 2 browser unit tests for `formatPipelineLatency` and `arrowRight` icon.
- **Commit `b9fd372` (T-057 B)**: Verified Compare rows with taupe/moss/amber dots and real proportional bar lengths; custom CSS SVG chevron on composer algorithm select; quiet muted helper line added under empty-state suggestion chips; sidebar status pill ("Ollama online") formatted with `white-space: nowrap` and collapsed rail layout.

Task T-058 executed the Ask tab UX refinements and reusable custom dark dropdown component on branch `ui-redesign-v3` (ADR-051):
- **Commit `833a2ee` (T-058 A)**: Documents drawer re-centers chat column via 200ms cubic-bezier margin transition, disabled under `prefers-reduced-motion` and falling back to overlay on viewports < 1280px; "How this was answered" glass-box accordion collapsed by default for all answers with ghost toggle pill; clicking citation `[n]` pill auto-expands the accordion.
- **Commit `a557a53` (T-058 B)**: Reusable accessible dark dropdown component `createDropdown` in `web/js/ui.js` replacing native select `#ask-algo-select` while preserving ID and value contract; keyboard navigation and ARIA attributes; registered 5 new unit tests.

Task T-059 resolved the createDropdown recursion bug and implemented smooth accordion animation on branch `ui-redesign-v3` (ADR-053):
- **Commit `82e828c` (T-059 A)**: Resolved `Maximum call stack size exceeded` in `createDropdown` by using native prototype descriptor setter directly, guarding updates with `isUpdating`, and adding comprehensive regression test asserting: initial value set, hidden input value matches, `onChange` NOT called at init, and option selection invokes `onChange` exactly once.
- **Commit `f5e3609` (T-059 B)**: Smooth 200ms ease-out glass-box accordion animation using `grid-template-rows: 0fr -> 1fr` and opacity fade, smooth chevron rotation (-90deg to 0deg), screen-reader hidden/inert attributes when collapsed, instant execution under `prefers-reduced-motion`, and citation pill click `transitionend` coordination (expands first, then scrolls to and highlights target source card). Cleared false-positive hex literal comment in `web/js/explore.js:226` restoring hex literal count to strictly 0.

Task T-060 redesigned the Ask glass-box "How this was answered" from human-approved mockups into a calm summary strip and 3-tab panel on branch `ui-redesign-v3` (ADR-054):
- **Commit `fb0bf01` (T-060 A)**: Slim summary strip (`--bg-raised`, 10px radius, NO border) with left chevron + "How this was answered" (`text-primary`, not amber) and right 3 real muted chips (`<n> sources`, total time e.g. "27.9 s", algorithm name e.g. "HNSW"). Expands into a compact panel with 3 underline tabs (`Sources`, `Latency`, `Algorithms`), stable 120px min-height to prevent layout jumps, max-height 260px with quiet scrollbar. Default active tab is Sources reusing existing chunk cards. Latency tab displays the 5 timing tiles with arrows or quiet empty text. Algorithms tab displays quiet empty state before running Compare, and 3 real benchmark rows (taupe/moss/amber) plus trace summary line after running. Shared footer actions (`Open Explore`, `Compare algorithms`, `Trace HNSW path`) visible under every tab; clicking Compare or Trace switches to Algorithms tab. Saved `algorithm` on assistant chat messages.
- **Commit `0cf2d47` (T-060 B)**: Accessible tab navigation with `role="tablist"` / `"tab"` / `"tabpanel"`, roving tabindex, Arrow/Home/End keyboard navigation via pure helper `getTabNextIndex(current, count, key)` with 6 registered unit tests in `test_v2.js` (total 127 registered tests in code). Coordinated citation pill expand: clicking `[n]` on collapsed answer expands accordion, switches to Sources tab, and scrolls/highlights target card after 200ms ease-out transition.

Task T-061 established equal-height tabs in the Ask glass-box (no size change when switching tabs) on branch `ui-redesign-v3` (ADR-055):
- **Commit `19b2276` (T-061)**: Fixed tab height (`--glassbox-tab-h: 196px`), equal content-area height (220px with 24px vertical padding), fixed positions for footer buttons. Sources tab scrolls cleanly inside fixed 196px box if k > 3 rows. Latency tab stretches 5 tiles vertically to fill box height with centered content, larger numbers (`font-size: var(--text-lg)`), centered arrows, amber Total tile, and muted caption (`"Time spent in each stage of this answer."`); empty state centered vertically and horizontally. Algorithms tab spreads 3 benchmark rows evenly (`justify-content: space-evenly`), HNSW trace summary line sits inside the same box below rows without expanding height (total 135px <= 196px); empty state centered vertically and horizontally. Footer actions stay directly under the box in the exact same position for all tabs. Instant tab switching, 200ms accordion animation, ARIA tabs, keyboard navigation, and citations strictly preserved.

Task T-062 executed the Compare tab redesign v3.1 (lane sheet + rank matrix) from human-approved mockups on branch `ui-redesign-v3` (ADR-056; visually rejected by human, superseded by T-063).

Task T-063 executed the Compare tab redesign v3.2 (soft lanes with pill bars + collapsed top-k diff) from two new human-approved ChatGPT mockups on branch `ui-redesign-v3` (ADR-057):
- **Commit `96c2495` (T-063 A)**: Resolved ISS-057 root cause on `#panel-compare` (padding/margin fix), added `sliders` icon in `web/js/icons.js`, raised control row (`compare-control-row`) with Collection and Repetitions dropdowns, Docs query input, single primary button per mode (`compare-demo-random-btn` / `compare-docs-run-btn`), ghost "Options" button (`compare-options-btn`) with `#compare-options-popover` (k, efSearch, Stored ID input, secondary `compare-demo-id-btn`, warm-up note), right status notice, and 2px progress fill line (amber only while running, auto-resets). Centered empty-state panel with dynamic title and secondary button (`compare-initial-run-btn`). When collection has 0 items, benchmark buttons disabled and initial-run hidden.
- **Commit `63b96f4` (T-063 B)**: Algorithm lanes panel (~55%) with 4-column shared CSS grid, 6px pill bars for median latency (with min-max range text in µs) and distance computations on shared linear scale (`computeBarScale`), real-k recall squares (10px, 4px gap, filled in alg color, unfilled faint), and muted legend line. Top-k ground truth diff panel (~45%) with collapsed design (`buildRankDiff`): KD-Tree and HNSW sections showing "N of K same rank" with small stroke-only check glyph for full matches and compact pill chips with muted amber dot ("Rank R: expected #GT, got #ID" or "got —" if missing) for mismatches, and bottom note. Updated `test_compare.js` with 8 pure tests (135 total tests across web suite).

### Current Status by Tab (2026-11-15):
- **Ask**: COMPLETE & HUMAN-VERIFIED (T-057, T-058, T-059, T-060, T-061). Drawer re-center, collapsed-by-default glass-box, 3 tabs (Sources, Latency, Algorithms) with equal fixed height (`--glassbox-tab-h: 196px`), smooth animation confirmed by human ("satisfied now with the work" after T-061).
- **Compare**: COMPLETE (T-063, ADR-057). Control row with Options popover, soft lanes with pill bars, collapsed top-k rank diff, empty state, strictly <= 1 primary button per view, 135 browser unit tests registered. Awaiting human screenshots (Demo results, Demo empty, Docs results, full window 100% zoom).
- **Explore**: NEXT per ADR-050. Needs human screenshots of current Explore tab (empty and populated) to write ChatGPT image prompt.
- **HNSW, Settings**: Next in defined order after Explore.

### Human-Confirmed on 2026-11-15 (Terminal after T-061):
- HEAD: `60d2123` (`docs: T-061 sync`), preceded by `19b2276`, `9123a14`, `0cf2d47`, `fb0bf01`.
- C++ hermetic suite: 118/118 passed (529,813 assertions).
- Web safety automated scanner: 100% clean (28 files scanned).
- CSS Quality metrics: `!important` count = 2, `box-shadow` count = 0, zero hex color literals in `web/js` outside `colors.js`.
- No match for "dot" in either `vectordb_intro.txt` (`samples/vectordb_intro.txt` and `web/samples/vectordb_intro.txt`).
- Engine diff: `git diff --stat ui-quiet-studio -- src include tests` strictly empty.

### Human-Confirmed on 2026-11-15 (Real Browser Screenshots):
- `/tests.html`: 127/127 passed (after T-060 B).
- Ask empty state: shows the helper line and the algorithm select chevron.
- Sidebar footer: "Ollama online" pill is strictly on one line.
- Ask answer view: fills down to the composer with no dead gap.
- Chunk similarity: (e.g. 70.0%) is on one line.
- Citation `[1]`: amber pill.
- Latency tiles: show arrows between them.
- Compare algorithms block: uses taupe/moss/amber dots and real proportional bars (first run showed KD-Tree 19.71 ms as a cold-start tree build, so its bar was full length; second run all in microseconds; this is real engine behaviour, not a UI bug; the human may decide later whether to warm up the KD-Tree first).
- Latency numbers add up: Embed 90.3 ms + First token 16.53 s, Generate 22.30 s, Total 22.39 s.
- Documents drawer: opening the Documents drawer smoothly shifts and re-centers the chat column in the remaining space without obscuring messages or composer.
- Glass-box accordion: "How this was answered" defaults to collapsed with ghost toggle pill and expands smoothly (200ms ease-out animation judged smooth by human).
- Glass-box 3 tabs: Sources, Latency, Algorithms with equal fixed height (`--glassbox-tab-h: 196px`), no height shift on tab switch; human confirmed "satisfied now with the work" after T-061.
- Note on documents: The sample document was ingested twice in the human's environment (duplicate inventory, showing Chunk #3 twice in retrieved chunks); human will delete one in their own workflow.

### Earlier Human Screenshots 2026-11-15 (before T-057):
- Explore (empty and with 1000 vectors), HNSW layer L0 (13,562 edges), Compare (empty and results), Settings (1000 and 1100 vectors, memory 507.8 KB then 558.6 KB) all rendered; numbers consistent.

### NOT Yet Seen by the Human:
- Open algorithm dropdown popup visual.
- Sidebar collapsed (56px rail).
- `[n]` citation pill click expanding the panel and scrolling to the card.
- Keyboard tab navigation (ArrowLeft/Right).
- 125% zoom layout check across tabs.
- Explore/HNSW/Compare in Docs mode.
- Compare and Settings at full 1920x1080 window (the crops the human sent were about 1794px wide and showed content touching the sidebar and the right edge; unverified whether real).
- The answer to the question "what is vector db?" (showed no answer in two screenshots; unknown if generation was still running).
- Small blue dot seen once at the top-left of the Ask composer in the empty state (unexplained, possibly browser or extension; ask human to report if it appears again).

### Current Workflow (Per-Tab Redesign, ADR-050):
For each tab in the order Ask, Compare, Explore, HNSW, Settings:
1. The human takes a screenshot of the current tab (full browser window, 100% zoom, both empty and results states).
2. Brain writes an image prompt for ChatGPT (1920x1080, 16:9, app screen only, no browser frame, real controls only, explicit "STRICTLY DO NOT ADD" list, algorithm colors Brute Force taupe `#9c8269`, KD-Tree moss `#708a78`, HNSW amber `#d9a441`, shell footer pill on one line, 28px main padding).
3. The human generates the mockup and sends it with a one-line opinion.
4. Brain reviews it against the real controls, names what is taken and what is rejected, and the human approves.
5. Brain writes ONE builder task.
6. The human verifies by terminal and screenshots; then the next tab.

### Known Pending Items for Later Tab Tasks:
1. **Explore chart subtitle**: Says "document chunk" even for Demo Vectors (must dynamically depend on active collection).
2. **Explore empty state**: (Demo, 0 vectors) shows an active solid amber Random Query and Search ID that cannot work (must be disabled when collection is empty).
3. **Compare collection select text clips**: ("Demo Collection (Random/Vectors") and should use the labels "Demo Vectors" / "Document Chunks" like Explore.
4. **Compare empty-state Summary Metrics header is clipped**: (`Distai...`, `Recall@k` missing) with a horizontal scrollbar.
5. **Compare and Settings zero padding**: Possible zero left padding and clipped right edge in 1794px crops (needs a full-window 100% screenshot to verify whether real).
6. **Settings title alignment**: Differs from other tabs (verify).
7. **Ask Compare algorithms KD-Tree outlier**: Cold-start build shows high first-query latency.

---

### Complete Commits List for T-055 through T-061:
- `7dc5cf6`: T-055 A: design tokens, shared components and app shell
- `48dd7ab`: T-055 B: Ask tab empty and results state
- `79693eb`: docs: T-055 sync
- `00dbfcd`: T-055b: define real benchmark fixture for mapChartRows tests
- `f59cf68`: T-055c: null-safe latencies in extractChartMetrics, white from colors.js, test
- `b12c488`: T-055c: restore top-k control and palette button
- `ac98680`: docs: T-055c sync
- `515ff77`: T-056 P0: Ask polish and canvas color sync
- `7b2be62`: T-056 P1: Explore tab from mockup 03
- `8abdef3`: T-056 P2: HNSW tab from mockup 04
- `d9a4097`: T-056 P3: Compare tab from mockups 05 and 06
- `f45e51b`: T-056 P4: Settings tab from mockup 07
- `1f5b093`: T-056 P5: consistency sweep
- `4ec9c1e`: docs: SYNC-006
- `acb96a3`: T-057 A: Ask message area fill, chunk cards, pipeline latency
- `b9fd372`: T-057 B: Ask compare rows, select chevron, empty helper, sidebar status pill
- `4f82c21`: docs: T-057 sync
- `833a2ee`: T-058 A: drawer re-centers chat, glass-box collapsed by default
- `a557a53`: T-058 B: shared dark dropdown component, Ask algorithm select
- `4ce2dd0`: docs: T-058 sync
- `5d04dca`: docs: SYNC-007
- `82e828c`: T-059 A: fix createDropdown recursion and add regression test
- `f5e3609`: T-059 B: smooth accordion animation, clear stray hex literal
- `1df744b`: docs: T-059 sync
- `fb0bf01`: T-060 A: Ask glass-box summary strip and 3-tab layout
- `0cf2d47`: T-060 B: accordion animation, citation expand, tab keyboard support
- `9123a14`: docs: T-060 sync
- `19b2276`: T-061: equal-height glass-box tabs with filled content
- `60d2123`: docs: T-061 sync

### Verification Status Breakdown:
- **Human-Confirmed (Real Browser & Terminal on 2026-11-15)**:
  - C++ hermetic suite: 118/118 passed (529,813 assertions).
  - Browser tests: `/tests.html` 127/127 passing (human-confirmed on 2026-11-15 after T-060 B).
  - Screenshots confirmed: Ask empty, Ask results, Documents drawer re-centering, "How this was answered" default collapsed & 200ms smooth expand, equal-height tabs (`--glassbox-tab-h: 196px`), Explore Demo PCA, HNSW L0 graph and trace, Compare empty and results, Settings 3-column grid.
  - Web safety automated scanner: 100% clean (28 files, zero innerHTML/outerHTML, strict CSP verified).
  - CSS metrics: `!important` count = 2, `box-shadow` count = 0, zero hex literals outside `:root` and `colors.js`.
  - Git state: clean tracked files on branch `ui-redesign-v3`.
- **Builder-Reported (Visual States NOT YET TESTED)**:
  - Open algorithm dropdown popup visual, collapsed 56px sidebar rail, `[n]` citation pill click expand and scroll, keyboard tab navigation (ArrowLeft/Right), 125% zoom layout check across tabs, Docs-mode tabs. Builder claims of visual accuracy are never proof.

### Known Pending Items for Later Tab Tasks:
1. Explore subtitle displays "document chunk" text on Demo Vectors.
2. Explore empty state shows an active solid amber Random Query button (builder visual audit claim corrected).
3. Compare select label clips.
4. Compare empty Summary Metrics header clips with horizontal scrollbar.
5. Collapsed sidebar (56px rail) not yet seen by screenshot.
6. 125% browser zoom check not yet seen by screenshot.
7. Docs-mode tabs (Explore Docs with document cluster legend; HNSW Docs notice) not yet seen by screenshot.

### T-056 decisions:
- P0: Synced canvas text colors in `colors.js` to `:root` tokens `#f4f4f5`, `#a1a1aa`, `#71717a` because canvas rendered slightly warmer beige than HTML text.
- P1: Mapped Explore query input to textarea placeholder matching mockup 03 query text while retaining full form submit and k parameter.
- P1: Explore neighbor list rendered as individual rounded cards with file icon, title, chunk subtitle, distance, and similarity matching mockup 03 while keeping table semantics.
- P1: Displayed axis ticks and titles (PC1, PC2) on the 2D PCA canvas matching mockup 03.
- P2: Restyled HNSW layer label to `Layer L<n>` with compact fixed-width slider to avoid toolbar wrapping.
- P2: Rendered entry point ring with `Entry (L<n>)` badge and query star with `Query` badge on HNSW canvas matching mockup 04.
- P2: Restyled HNSW trace sidebar into step counter, stat tiles (current node, distance, layer), and search statistics tiles (distance comps, nodes visited, visited per layer) matching mockup 04.
- P2: Placed topology summary at the bottom of the HNSW tab as a metric strip with hairline dividers (Nodes, Max level, Entry point) matching mockup 04.
- P3: Added bold titles and muted subtitles ("Benchmark Setup", "Summary Metrics", "Top-k ground truth diff") matching mockup 05 while retaining T-052 full-height 3-column equal grid.
- P4: Sized Settings panels to content with calm padding in a 3-column grid (`align-items: start`, `height: auto`), eliminating T-047 hollow vertical stretching.
- P4: Excluded fake mockup controls (Auto-save toggle, Export/Import collection, System max context/chunk size) while retaining all real engine controls.
- P5: Strictly enforced at most 1 primary button (`.btn-primary`) per view in every state across all tabs.

### Primary Button Count Audit:
| Tab | State | Primary Amber Buttons (`.btn-primary`) | Target Button |
| :--- | :--- | :---: | :--- |
| Ask | Empty | 1 | `#ask-submit-btn` (Composer send) |
| Ask | Results | 1 | `#ask-submit-btn` (Composer send) |
| Explore | Demo Collection | 1 | `#explore-demo-random-btn` (Random Query) |
| Explore | Docs Collection | 1 | `#explore-query-docs-btn` (Project & Search) |
| Explore | Empty | 0 | None (Insert Demo Vectors is `.btn-secondary`) |
| HNSW | Demo | 1 | `#hnsw-trace-random-btn` (Random) |
| HNSW | Docs | 0 | None (Step trace unavailable for Docs; notice shown) |
| Compare | Demo (Results) | 1 | `#compare-demo-random-btn` (Benchmark Random Query) |
| Compare | Docs (Results) | 1 | `#compare-docs-run-btn` (Run Benchmark) |
| Compare | Empty | 0 | None (Initial run button is `.btn-secondary`) |
| Settings | Default | 1 | `#demo-insert-random-btn` (+ Insert) |

### Deviations from Mockup:
| Tab | Mockup Feature | Real Implementation & Reason |
| :--- | :--- | :--- |
| Explore | Mockup showed kb-computer-networks | Real collection select has "Demo Vectors" and "Document Chunks" |
| Explore | Mockup showed 4 hardcoded cluster legends | Real Docs legend dynamically lists ingested document titles with chunk counts; Demo shows neutral amber swatch |
| HNSW | Mockup showed kb-computer-networks | Real collection select has "Demo" and "Docs" |
| Compare | Mockup showed Query Count & algorithm checkboxes | Real Compare uses Repetitions (1/3/5/10/20) and benchmarks all 3 algorithms simultaneously |
| Compare | Mockup diff table showed query sentences and checkmarks | Real diff table shows ground truth Brute Force vs KD-Tree vs HNSW ID matches at ranks 1-10 with inline badges |
| Settings | Mockup showed System panel (max context, chunk size/overlap) | Real RAG chunk settings belong in document ingest drawer; not global server settings |
| Settings | Mockup showed Auto-save toggle & Export/Import | Real persistence is `--data-dir <path>` on server startup; no runtime toggle exists |
| Settings | Mockup showed llama3.1:8b | Real server reports actual installed Ollama models via API (e.g. llama3.2:latest) |

- **Key Collaboration & Process Lessons**:
  - **Full Product-Level Redesign (ADR-047)**: Human approved 7 AI mockups saved in `docs/mockups/` representing one coherent design direction for the entire app. T-048 (Settings content-sized panels) is CANCELLED (superseded by ADR-047). Redesign v3 proceeds tab-by-tab with human screenshots after each task.
  - **AI Mockup Realism & Engine Constraints**: AI mockups invent controls the engine does not have. Mismatches to handle: Compare mockup shows Query Count, algorithm checkboxes, ms units and per-query match counts, but the real Compare has repetitions (1/3/5), one query run on all 3 algorithms, latency in microseconds and a rank-by-rank top-10 diff; Settings mockup shows System panel (max context, chunk size/overlap), Auto-save toggle, Export/Import collection, storage quota, uptime, model llama3.1:8b which are not real (model is llama3.2; persistence is the --data-dir flag); Explore, HNSW and Settings have no empty-state mockup, use the shared empty-state component.
  - **Builder Claims vs Human Screenshots**: Builder reports claimed "zero deviations" multiple times while screenshots showed real deviations. Judge UI strictly by human screenshots at 100% browser zoom; builder claims of visual accuracy are never proof. Mark all visual aspects "not tested (visual)".
  - **Collaboration Preferences**: Human uses ChatGPT/Gemini for mockups and passes the chosen image. Brain gives outcome briefs; builder decides implementation. Human writes Hinglish (Hindi in Roman letters); Brain replies in short Hinglish with one question at a time.
  - **No Merge Until Approval**: Do not merge `ui-redesign-v3` to `main` and do not push until the human explicitly approves.

- **Branches**:
  - `ui-redesign`: Base v2 platform through T-039.
  - `ui-polish-2026`: T-040 experimental redesign (visually rejected by human due to line noise and box-shadows).
  - `ui-quiet-studio`: Quiet Studio branch through T-054 and SYNC-005.
  - `ui-redesign-v3`: Active branch containing T-055, T-055b, T-055c, T-056 master build, T-057, T-058, T-059, and T-060 Ask glass-box redesign.
  - `backup-before-v2`: Safety backup prior to v2 unfreeze, confirmed intact.
  - *Nothing pushed to remote origin.*
- **Human Verification Status**:
  - **Terminal**: C++ 118/118 (529,813 assertions, 117 run + 1 opt-in live-Ollama test skipped), scanner pass, CSS `!important` count 2, `box-shadow` count 0, zero hex color literals outside `:root` and `colors.js`.
  - **Browser Pure-Logic Tests**: `/tests.html` 121/121 passed [CONFIRMED: human real-browser run 2026-11-15 after T-059 A]; 127 registered in code after T-060 B.
  - **Screenshots (Historic / Quiet Studio & v3)**: `/tests.html` 94/94 (after T-043); Compare results state seen after T-052 and T-054; Ask empty/results, Documents drawer, Explore Demo PCA, HNSW L0, Compare empty/results, and Settings seen on 2026-11-15.
  - **Redesign v3.1 Visual States**: All visual changes in T-057, T-058, T-059, and T-060 are reported as "not tested (visual)" pending human review and screenshot capture at 100% zoom.
- **T-050 to T-054 Commits on `ui-quiet-studio`**:
  - `c89aa04`, `17986e9`, `96170df`: T-050 Compare tab rebuild
  - `ee9cd78`, `cb04a73`, `231370e`: T-051 Compare diff table, badge, metric fixes
  - `bb0649c`, `0818c56`: T-052 Compare restore full-height equal panels, keep diff table fixes
  - `f22417b`, `d06fec0`: T-053 Compare reset stale results on empty or changed collection
  - `846c5a1`, `1b46ad2`: T-054 Compare new chart design (header, axis, ticks)
- **Automated Tests**:
  - C++ unit and integration tests: 118 / 118 passed (529,813 assertions).
  - Browser unit tests: 127 registered tests (`http://127.0.0.1:8080/tests.html`), 127/127 passing in pure-logic suite.
  - Web security scan: 28 files scanned, 100% clean (zero forbidden patterns, strict CSP verified).
- **Design System ("Redesign v3" / ADR-047) Principles Enforced**:
  - **Hairlines Only in Tables, Metric Strips, and Sidebar Dividers**: All card borders, panel outlines, and button borders eliminated.
  - **3 Dark Surfaces for Depth**: `--bg-page: #09090b`, `--bg-panel: #121215`, `--bg-raised: #18181c`.
  - **Zero Box-Shadows**: Grep `box-shadow` in `web/css` returns strictly 0 matches. Zero glow on status dots.
  - **Single Font Family**: IBM Plex Sans everywhere; IBM Plex Mono strictly restricted to code, IDs, numbers inside tables, and small size.
  - **Single Amber Accent**: `#d9a441`, with at most ONE primary amber button (`.btn-primary`) per view in every state across all 5 tabs.
  - **Radii Scale**: 6px (`--radius-sm`), 10px (`--radius-md`), 14px (`--radius-lg`).
  - **Shared 5-Tab Header & Empty States**: Every tab has `<div class="page-header">` with `<h1 class="page-header-title">` and clean subtitle. Shared `.empty-state` component used for Ask, Explore, Compare, and HNSW/Settings fallback.

> [!NOTE]
> Verification status:
> - **Human-confirmed by terminal on 2026-11-15**: C++ 118/118, scanner ALL CHECKS PASSED, `/tests.html` 114/114 passed (121 registered unit tests now in code), CSS `!important` count = 2, `box-shadow` count = 0, zero hex literals outside `:root` and `colors.js`.
> - **Redesign v3 Screenshots & Human Verification Pending**:
>   - Ask tab empty state (`01-ask-empty.png`)
>   - Ask tab results state (`02-ask-results.png`)
>   - Ask tab with Documents drawer open (chat column shifts left and re-centers smoothly)
>   - Ask tab glass-box accordion collapsed by default; click citation pill `[n]` auto-expands and highlights source card
>   - Ask composer custom dark dropdown (upward popup, keyboard cycling, checkmark)
>   - Small blue dot seen once above composer check
>   - Explore tab (`03-explore.png`)
>   - HNSW tab (`04-hnsw.png`)
>   - Compare tab empty state (`06-compare-empty.png`)
>   - Compare tab results state (`05-compare-results.png`)
>   - Settings tab (`07-settings.png`)
>   - Sidebar collapsed (56px icon rail)
>   - 125% browser zoom layout check across tabs.
> - **Paused / Superseded**:
>   - T-048 (Settings content-sized panels) is CANCELLED (superseded by ADR-047/ADR-048).
>   - T-054 optional chart polish (larger tick labels, more space between axis and bars, more icon contrast) NOT done.
> - **Visual items marked**: All visual rendering items marked "not tested (visual)" until human screenshots confirm.


Per git log on branch `ui-redesign` and `ui-polish-2026`:
- **Phase P0 (Commit `b26212c`)**: Pre-flight unfreezing (ADR-029, ADR-030, ADR-031), CSS disabled-state fix, HNSW toolbar slider stabilization.
- **Phase P1 (Commit `4586a07`)**: Multi-turn history support in `/api/ask` and `/api/ask/stream` (capped to last 6 messages, 3,000 characters).
- **Phase P2 (Commit `b857406`)**: Unified HNSW search path trace (`POST /api/hnsw/trace` with `"collection": "demo" | "docs"` and chunk metadata). Fixed ISS-009.
- **Phase P3 (Commit `afc420c`)**: Versioned binary persistence format (`--data-dir`, atomic `.tmp` rename, ADR-032) and dynamic document deletion (`DELETE /api/docs/:id`, ADR-033).
- **Phase P4 (Commit `9e95ac8`)**: Design foundation (4px spacing scale, font scales, card/header tokens, `web/js/icons.js` zero-dependency SVG icon registry with 14 line icons).
- **Phase P5 (Commit `c25d8a6`)**: New app shell (collapsible sidebar ~260px to ~56px icon rail, recent chats list, Ollama status footer, Command Palette `Ctrl+K`, Toast notifications).
- **Phase P6 (Commit `cbc57a9`)**: Ask tab glass-box chat (multi-turn localStorage chat persistence, auto-growing composer, citation pill interactions, collapsible Documents drawer with sample loader and per-doc delete).
- **Phase P7 (Commit `72cbde3`)**: Glass-box panels & educational layer (retrieval chunks with similarity meters, latency breakdown, mini 2D PCA canvas, compare benchmark button, HNSW search path trace, `web/js/learn_content.js` with 7 plain-language explainers, info popovers on all tabs, interactive guided tour).
- **Phase P8 (Commit `cae814b`)**: Open-source release readiness (MIT `LICENSE`, rewritten `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `docs/LEARNING_GUIDE.md`, `.github/workflows/ci.yml`, browser unit tests in `web/js/tests/test_v2.js`).
- **T-034 (Commit `637fd58`)**: Fix stale docs (MIT license reference, 118 C++ test count, VDBC/VDBR persistence header documentation).
- **T-035 (Commit `83c1257`)**: Align ISS-006 ingest rollback documentation in `docs/API.md`, `docs/PROGRESS.md`, and `docs/KNOWN_ISSUES.md`.
- **T-036 (Commits `d1c6a3d`, `d5df34a`, `aaaa6c6`, `cf79729`)**: Batched UI fixes after human real-browser review:
  - **Group A (`d1c6a3d`)**: Fixed citation parser test assertion in `web/js/tests/test_v2.js` and enabled vertical scrolling on `/tests.html`.
  - **Group B (`d5df34a`)**: Ask tab header alignment to `.page-header` pattern, collapsible advanced chunking controls `<details>`, guided empty state with sample loader and 3 questions, Explore deep linking with prefill, removed empty mini 2D PCA canvas.
  - **Group C (`aaaa6c6`)**: Explore empty-state variance text clearing, Compare Summary Metrics table clipping fix (no horizontal scrollbar), Settings tab P7 additions (persistence status, two-step Clear Chat History, documentation links card filling vertical space), and moved version badge to sidebar footer while removing the verbose app footer.
- **T-037 (Commit `b401029`)**: Small fixes after T-036 human verification (hidden empty box under Compare algorithms until results exist, HNSW trace in Ask fixed to read `tRes.trace` and `tRes.stats.nodesVisited` instead of `visited_nodes`, verified persistence health JSON derivation with and without `--data-dir`, updated verification status in docs).
- **T-038 (Commit `a57c573`)**: Fix silent "Compare algorithms on this query" button in Ask glass-box (mapped server response `algorithms` field to display rows via new `web/js/ask_helpers.js`, added compact latency bars with swatches, added toast and inline notifications on error, added 4 pure-logic browser unit tests bringing test suite to 88 tests).
- **T-040 (Commits `c04dd79`, `c734f36`, `0ebae37`, `d7713c6`, `d438d41`)**: Full-app quiet luxury UI redesign across all 5 tabs and app shell. Implemented in 5 phases (tokens, colors module, zero hex outside tokens; spacious sidebar bottom; centered 820px Ask chat; 380px visual sidebars & unclipped compare table; centered 1040px Settings metrics grid with sans numbers and single unclipped scroll). All visual aspects reported as "not tested" pending human screenshots.

---

## 2. Inventory of New Files Created in v2

- `include/vectordb/persistence.hpp` - Versioned binary serialization header
- `src/persistence.cpp` - Atomic binary persistence implementation
- `tests/test_persistence.cpp` - Persistence and document deletion hermetic tests
- `web/js/icons.js` - Zero-dependency SVG line icon registry (14 icons)
- `web/js/sidebar.js` - Collapsible navigation sidebar and recent chats controller
- `web/js/palette.js` - Keyboard-first Command Palette (`Ctrl+K` / `Cmd+K`)
- `web/js/learn_content.js` - Plain-language learning explainers and interactive guided tour
- `web/js/tests/test_v2.js` - Browser unit tests for v2 functionality (15 tests)
- `web/samples/vectordb_intro.txt` - Sample document for zero-friction testing
- `LICENSE` - MIT License with `<YOUR NAME>` copyright holder placeholder
- `CONTRIBUTING.md` - Open-source contribution guidelines
- `CODE_OF_CONDUCT.md` - Community standards pledge
- `docs/LEARNING_GUIDE.md` - 6-module vector search & RAG curriculum
- `.github/workflows/ci.yml` - Continuous integration workflow for Windows and Linux

---

## 3. Running VectorDB v2

```powershell
# Build
cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build

# Run C++ unit and integration tests
.\build\vectordb_tests.exe

# Run web safety scanner
powershell -ExecutionPolicy Bypass -File .\scripts\check_web_safety.ps1

# Run server with persistence enabled
.\build\vectordb_server.exe --port 8080 --web-dir web --data-dir ./data
```
Open `http://127.0.0.1:8080` in any modern web browser. Automated browser unit tests can be verified at `http://127.0.0.1:8080/tests.html`.

---

## 4. Git State

- **Branches**:
  - `ui-redesign`: Base v2 platform + T-039 docs polish.
  - `ui-polish-2026`: T-040 experimental redesign (visually rejected by human due to line noise and box-shadows).
  - `ui-quiet-studio`: Quiet Studio branch through T-054 and SYNC-005.
  - `ui-redesign-v3`: Active branch containing T-055, T-055b, T-055c, T-056, T-057 (human-verified), T-058, T-059, T-060, T-061, T-062 (superseded), and T-063.
  - `backup-before-v2`: Safety backup prior to v2 unfreeze, confirmed intact.
- **Tracking Status**: Local branch `ui-redesign-v3`, HEAD `9e36e5a` before SYNC-010 commit, without upstream tracking (commits unpushed per protocol; nothing pushed to origin).
- **Working Tree**: Clean tracked files; only untracked test logs in `results/logs/`.
- Note: Git state in docs can go stale after pushes; always trust human's `git status -sb`.

---

## 5. Pending Human Actions

1. **Verify Compare tab by screenshots**: Take full-window 1920x1080 100% screenshots of Compare tab (Demo results, Demo empty with 0 vectors, Docs results, Docs empty, Options popover open, both dropdowns open, 125% zoom) to visually verify T-063.
2. **Explore design work in Design Chat**: Work with the separate Design Chat (Design Director) on Explore image prompts and review, providing current Explore screenshots (empty and populated) to get the FINAL SPEC and approved mockup names (planned `12-explore-results.png`, `13-explore-empty.png`).
3. **Save approved Compare mockups**: Save approved mockups as `docs/mockups/10-compare-results-v2.png` and `11-compare-empty-v2.png` (08 and 09 are obsolete).
4. **Delete duplicate document**: Delete one of the two duplicate "VectorDB Intro" documents in the Documents drawer (causes duplicate Chunk rows in Sources).
5. **Decide glass-box text size**: Decide whether to raise text size of glass-box strip title and tabs (Brain proposed strip title 14px, tabs 14px, chunk subtitle and footer buttons 13px; human has NOT decided; do not start without instruction).
6. **License copyright name**: Fill `<YOUR NAME>` placeholder in `LICENSE`.
7. **Decide Linux/macOS support tier & release timing**: Decide official support tier for Linux/macOS (ISS-029) and timing of public GitHub release.
8. **No merge and no push**: Do NOT merge `ui-redesign-v3` into `main` and do NOT push to remote origin until approved.

---

## 6. Open Follow-ups & Roadmap

### Open Follow-ups
- **Redesign v3.1 per-tab rollout (ADR-050)**:
  - Ask tab: COMPLETE & HUMAN-VERIFIED (T-057 through T-061: drawer re-center, collapsed-by-default glass-box, 3 tabs with equal fixed height `--glassbox-tab-h: 196px`, 200ms smooth animation, `/tests.html` 127/127; human said "satisfied now with the work" after T-061).
  - Compare tab: COMPLETE (T-063, ADR-057; visual verification pending, T-062 layout rejected). Rebuilt with soft lanes with pill bars + collapsed top-k rank diff, raised control row with Options popover, 2px progress line, empty state, strictly <= 1 primary button per view. Browser test count unverified pending human run on `/tests.html`.
  - Explore tab: NEXT per ADR-050. Pending human screenshots of current Explore tab and FINAL SPEC from Design Chat.
  - HNSW tab: PENDING (redesign v3.1 from human-approved mockup).
  - Settings tab: PENDING (redesign v3.1 from human-approved mockup).
- **Pending Human Screenshots (Not Yet Seen)**:
  - All T-063 visual states (Demo results, Demo empty with 0 vectors, Docs results, Docs empty, Options popover open, both dropdowns open, 125% zoom).
  - ISS-057 visual result (sidebar gap and right-edge clipping on full-window 1920x1080 100%).
  - Open algorithm dropdown popup visual.
  - Sidebar collapsed 56px rail.
  - `[n]` citation pill click expanding the panel and scrolling to the card.
  - Keyboard tab navigation (ArrowLeft/Right).
  - 125% zoom layout check across tabs.
  - Docs-mode tabs (Explore Docs with document cluster legend; HNSW Docs notice).
- **Other Tab Items**:
  - Explore subtitle displays "document chunk" text on Demo Vectors (must depend on collection).
  - Explore empty state shows an active solid amber Random Query button that cannot work when empty (must be disabled).
  - Settings title alignment differs from other tabs (verify).
  - Ask "Compare algorithms" can show a cold-start KD-Tree outlier.
- Optional C++ unit test for ISS-006 ingest rollback.

### Roadmap (Not Started)
- **Hybrid search (BM25 + RRF)**: Requires inverted index and rank fusion; on roadmap, but strictly out of scope for v2.
- **Cross-encoder reranking**: Second-pass neural reranker for retrieved candidate chunks.
- **Automated browser E2E click tests**: Headless browser execution suite (Playwright / Selenium).
- **Real Linux/macOS desktop environment testing**: Real physical environment validation beyond CI.

---

## 7. Recommended Next Step

1. **Human verifies T-063 (Compare)** and sends: `/tests.html` count; full-window 1920x1080 100% screenshots of Compare Demo results, Demo empty (0 vectors), Docs results, Docs empty, Options popover open, both dropdowns open, one at 125% zoom. Brain reviews them (ISS-057 gap and right-edge clipping first).
2. **Next tab = Explore**: the human works in the separate Design Chat (needs screenshots of the current Explore, empty and populated) and brings the FINAL SPEC plus approved mockup names (planned `12-explore-results.png`, `13-explore-empty.png`).
3. **Brain writes ONE builder task**: Brain turns the FINAL SPEC into one builder task. Brain must NOT write the Explore task before it has the FINAL SPEC from the Design Chat.

---

## 8. Important Warnings (Fragile Areas)

- **Zero-innerHTML rule**: Never introduce `innerHTML`, `outerHTML`, or `insertAdjacentHTML` in `web/js/`. Always verify using `powershell -ExecutionPolicy Bypass -File .\scripts\check_web_safety.ps1`.
- **Strict POST Content-Type**: Every HTTP `POST` route requires header `Content-Type: application/json` (send `{}` for empty bodies); returns HTTP 415 otherwise.
- **No mutex held during Ollama calls**: In `src/rag.cpp`, never hold internal collection mutexes during network/Ollama inference calls.
- **Canvas zero-dimension guard**: Check `isCanvasDrawable` before drawing on hidden or unmeasured canvases to prevent `DOMException`.
- **No push without human instruction**: Do not run `git push`, do not merge to `main`, and do not modify remote repository state without explicit human instruction.
