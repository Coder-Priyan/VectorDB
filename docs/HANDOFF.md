# Project Handoff

Last updated: 2026-11-16 by T-095 sync

> **NEXT STEP**: Review the human's full-window 1920x1080 100% screenshots of all 5 tabs (Ask, Explore, HNSW, Compare, Settings) after the T-095 defect fixes, and the terminal verification (git log --oneline -7, git status -sb, vectordb_tests.exe, check_web_safety.ps1, !important count, box-shadow count, hex count, DOM ID check), and get the human's feedback.

## Current Verification State (Human-Confirmed vs Builder-Reported)
- **/tests.html**: **/tests.html 159/159 is human-confirmed on 2026-11-16 and all visuals are still human-reported only**. Registered browser unit tests expanded in code to 166 (161 pass in headless Node DOM mock, 5 require real browser DOM). All visual states for T-071 through T-095 are **not tested (visual)** / builder-reported only.
- **Git State**: Local branch `ui-redesign-v4`, clean working tree (only untracked `results/logs/` and `scratch/`), commits unpushed per protocol.
- **Current UI State (by tab)**:
  - **Ask tab**: COMPLETE, human-approved, and human-verified. Byte-identical and 100% frozen.
  - **Explore tab**: Rebuilt from zero in T-094 P1 using Ask design spec (ADR-087). [not tested (visual) / builder-reported only]: Hero Canvas centerpiece fills viewport without voids; Ask page header with badges, Reset Zoom, Refresh, and Inspector drawer toggle; bottom docked composer bar for collection dropdown, badges, k presets + input, primary "Project Random Query" button, and ID search; slide-over inspector drawer (`#explore-inspector-drawer` matching `#doc-drawer` / 380px) for nearest neighbors and vector inspection. All 38 baseline Explore DOM IDs preserved.
  - **HNSW tab**: Rebuilt from zero in T-094 P2 using Ask design spec (ADR-087). [not tested (visual) / builder-reported only]: Hero Graph canvas centerpiece fills viewport without voids; Ask page header with legend, Refresh, and Telemetry drawer toggle; bottom docked composer bar for layer slider, max edges selector, topology quick pills, primary "Random Trace" button, ID search, and VCR playback transport; slide-over telemetry drawer (`#hnsw-telemetry-drawer` matching `#doc-drawer` / 380px) for step coordinates and search diagnostics. All 44 baseline HNSW DOM IDs preserved.
  - **Compare tab**: Rebuilt from zero in T-094 P3 using Ask design spec (ADR-087). [not tested (visual) / builder-reported only]: Centered 860px column layout matching Ask chat viewport; natural inner-scroll only; Ask page header; bottom docked composer bar (collection, repeat, query, primary benchmark button, parameters popover); timing tiles flow & elevated comparative cards. All 40 baseline Compare DOM IDs preserved.
  - **Settings tab**: Rebuilt from zero in T-094 P4 using Ask design spec (ADR-087). [not tested (visual) / builder-reported only]: Centered 860px column layout matching Ask chat viewport; natural inner-scroll only; clean elevated cards for Server Health, Demo Collection Ingestion, and Storage/Danger Zone; restored `#settings-start-tour-btn` and `#settings-tour-icon` in the UI, wired to `vectordb:start-tour` event (resolving ISS-092). All 26 baseline Settings DOM IDs + 2 restored IDs preserved.

## Pending Human Actions
- Delete duplicate 'VectorDB Intro' document in Documents drawer.
- Fill `<YOUR NAME>` placeholder in `LICENSE`.
- Decide Linux/macOS support tier & release timing (ISS-029).
- Do not merge to main, do not push to remote origin.

## Next Free Identifiers
- Next free ADR: **ADR-088**
- Next free ISS: **ISS-103**
- Next task number: **T-096**

## T-095 summary (ADR-088 pending; Fix Explore, Compare, and Settings Concrete Defects)

- **Goal & Motivation**: Fix concrete visual, interaction, and logical defects reported in human screenshots without redesigning layouts:
  1. *Explore*: Moved canvas viewport hint pill outside `.explore-canvas-container` so it never overlaps x-axis tick marks or "PC1 (Axis 1)" label.
  2. *Explore*: Eliminated duplicate variance readout by adding `.sr-only` CSS utility for accessibility note and displaying clean short notice if <10 vectors.
  3. *Explore*: Cleaned inspector drawer empty state to show "None selected" and designed empty note until a real query or click occurs; decoupled hover from mutating persistent inspector state.
  4. *Compare*: Separated distance computations and prune tags, recall percentages and sublabels with dedicated flex layouts, resolving "100Full scan", "1120% pruned", and "100.0%Recall @ k".
  5. *Compare*: Added `formatSpeedComparison` helper to correctly label candidates as "Nx faster", "Nx slower", or "1.0x (Equal)".
  6. *Compare*: Added `computePrunedPercent` and `formatPrunedText` helpers with strict 0% to 100% clamping (e.g. 112 on 100 is 0% pruned, not negative).
  7. *Compare*: Rendered top-k rank indicator cells with styled filled/empty squares and interactive tooltips for both matches and mismatches.
  8. *Compare*: Eliminated ~300px dead band under cards by naturally centering `.compare-results-view` in Ask's centered thread.
  9. *Settings*: Styled Distance metric dropdown button to match text input height (32px), dark background, and subtle border; aligned danger card right edge and removed nested scrollbars with `overflow: visible`.
- **Strict Invariants**:
  - Ask tab, sidebar/shell, C++ engine, and `docs/API.md` byte-identical to `cbd7e81`.
  - 0 hex literals outside `colors.js`.
  - 0 box-shadows.
  - `!important` count <= 2 (exactly 2).
  - All DOM IDs preserved across panels.
  - 118/118 C++ tests pass.

## T-092 summary (ADR-085; Explore Tab $5,000 Studio Elevation & Table-Flex Bug Resolution)

- **Goal & Motivation**: Addressed user request to focus strictly on Explore tab ("explore tab mai sirf work karanga... upgrade kroo aur worth 5k dollar... issue bhi fix kroo"). Fixed the empty nearest neighbors card shown in screenshot and elevated the entire Explore studio.
- **Root Cause & Architectural Fixes**:
  - Identified that `#explore-results-tbody` was wrapped inside a `<table>` while given `display: flex; flex-direction: column;` in CSS. Blink/WebKit breaks table rendering when flex is applied to tbody inside table, collapsing height to 0.
  - Replaced table with clean semantic `<div id="explore-results-tbody" class="explore-neighbors-feed">` containing `.explore-neighbor-card` components.
  - Added instant empty-state graphic on initial load so right column never shows a black void.
  - Elevated constellation points to luminous gold dots (`r=3.5px`, fill `rgba(217, 164, 65, 0.75)`, stroke `rgba(9, 9, 11, 0.95)`).
  - Added precision radar target lock reticle (outer dashed circle, inner solid circle, center pip, crosshairs, floating QUERY TARGET badge) and connecting geodesics to nearest neighbors.
  - Added automatic 2D coordinate fallback mapping from `currentPoints` in query handlers.
  - Balanced card padding and column distribution across all 3 zones (`390px | 1fr | 390px`), eliminating awkward dead space.
- **Strict Invariants**:
  - Ask, HNSW, Compare, and Settings tabs 100% frozen.
  - Zero innerHTML, strict CSP verified (`check_web_safety.ps1` passed).
  - 118/118 C++ tests pass.

## T-091 summary (ADR-084; Fixed SyntaxError in hnsw.js Restoring App Boot and Tab Switching)

- **Goal & Motivation**: Fix critical blocking issue where user was unable to switch tabs from the Ask tab to Explore, HNSW, Compare, or Settings ("brooo mai open hee nhi krr pa rha hu tab ko ask tab sa kisi aur maii ja hee nhi paraaa").
- **Root Cause & Fix**:
  - Node.js ESM import check identified an unexpected token `}` at line 542 in `web/js/hnsw.js`. Tracing braces revealed a duplicate closing brace `}    }` at line 362 introduced during T-090 canvas rendering updates.
  - In modern ES module architectures, a single syntax error anywhere in the imported module graph aborts `main.js` execution, which prevented `initTabs(".tab-nav")` from attaching click listeners to the sidebar navigation buttons.
  - Removed duplicate brace. Tested and verified that all 20 JavaScript modules in `web/js/` parse and evaluate cleanly in Node.js with 0 errors.
  - Ran `check_web_safety.ps1`: ALL CHECKS PASSED (0 violations).
  - Ran `vectordb_tests.exe`: 118 / 118 tests passed.
  - Tab navigation is now 100% active and responsive across all 5 tabs.

## T-090 summary (ADR-083; $10,000 Product-Grade Canvas Elevation & Precision CAD Rendering)

- **Goal & Motivation**: Addressed user instruction to approach the UI from scratch as a top-tier developer designing a $10,000 product. Elevated the canvas visualizers in Explore and HNSW from flat generic dots into high-precision, constellation-grade instruments.
- **Visual Architecture**:
  - **Explore Canvas**:
    - Faint CAD coordinate plane with background grid lines (`rgba(255, 255, 255, 0.025)` every 0.1 units).
    - Constellation vector points (`3.5px`, soft amber alpha `rgba(217, 164, 65, 0.55)`).
    - Multi-ring radar lock reticle on query target (crosshair ticks, dashed outer circle, white inner circle, amber center core, and floating "QUERY TARGET" pill badge).
    - Ranked nearest neighbor matches highlighted with outer gold halos, white core dots, sequential rank badges (`#1`, `#2`), and dashed connecting geodesics (`rgba(217, 164, 65, 0.35)`).
    - Instant hover coordinate pill with vector ID and (PC1, PC2) floating tooltip.
  - **HNSW Canvas**:
    - Entry node highlighted with beacon diamond rings and uppercase pill badge `ENTRY NODE (LN)`.
    - Beam search trace path rendered with animated connecting lines, active node beacon, and sequential step indicators (`#1`, `#2`, `#3`) allowing users to visually follow the greedy routing across layers.
    - Search target rendered with gold crosshair diamond reticle.
- **Strict Invariants**:
  - Zero innerHTML, strict CSP verified.
  - 0 non-root hex, 0 box-shadow, <= 2 !important.
  - 118/118 C++ tests pass.

## T-089 summary (ADR-082; Compare & Settings Tabs Rebuilt as Zero-Waste Studio Workbenches)

- **Goal & Motivation**: Rebuilt Compare and Settings tabs following user instructions to eliminate wasted space ("space waste nhi honi chaiyaaa") and present a serious, elegant, professional studio interface with zero glow.
- **Studio Architecture**:
  - **Compare Tab**:
    - Compact 42px studio control row with Collection, Repetitions, Docs semantic input, amber hero "Benchmark Random Query" button, parameters popover ($k$, $efSearch$, Stored Vector ID), and live health status badge.
    - Full-height results container eliminating the ~350px dead black void at screen bottom.
    - Equal-flex vertical pacing (`.spec-section { flex: 1 1 0; justify-content: center; }`) ensuring Latency, Distance Computations, and Accuracy rows align horizontally across Brute Force, KD-Tree, and HNSW pods.
  - **Settings Tab**:
    - Symmetrical 3-Column Studio Console with balanced cards.
    - Column 1: Server health status, Ollama online pill, 2-column tabular metrics bento (8 server metrics), Ollama models chip list.
    - Column 2: Dimension, Distance Metric selector, M, efConstruction form; Synthetic Vector Generator form (`+ Insert Vectors`) with live status feedback.
    - Column 3: Disk persistence status and path pill, Chat history purger with 2-step confirmation, Interactive Test Suite link, and isolated Danger Zone with 2-step confirmation.
    - Restored all interactive button bindings (`demo-insert-random-btn`, `demo-random-count`, `demo-reset-btn`, `demo-reset-cancel-btn`, `settings-clear-chats-btn`).
- **Strict Invariants**:
  - Ask tab and C++ engine 100% frozen.
  - Zero non-root hex colors, zero box-shadow, <= 2 !important, zero innerHTML, 118/118 C++ tests pass.

## T-088 summary (ADR-081; HNSW Tab Rebuilt as Symmetrical 3-Column Studio Workbench 390px | 1fr | 390px)

- **Goal & Motivation**: Rebuilt HNSW tab following the user's approved architectural pattern from Explore tab: symmetrical 3-column grid with equal-width left and right wings (390px each), a hero centerpiece canvas (~820px), zero AI-slop, zero neon glow, comfortable non-congested typography, and single-screen zero-scroll guarantee on 1080p displays.
- **Studio Architecture**:
  - **Left Column (390px, `.hnsw-config-deck`)**:
    - Card 1: Collection & Layer Config (`.hnsw-config-card`) containing Collection dropdown, Layer slider with live edge summary (`#hnsw-edge-summary`), Max Edges selector with truncation badge (`#hnsw-edge-warn-badge`), and Refresh button.
    - Card 2: Graph Topology Summary (`.hnsw-topology-card`, `#hnsw-topology-strip`) featuring stats tiles for Total Nodes (`#hnsw-topo-nodes`), Max Level (`#hnsw-topo-max-level`), Entry Point (`#hnsw-topo-entry`), and algorithm subtitle.
  - **Center Column (`1fr` / ~820px, `.hnsw-canvas-viewport`)**:
    - Precision Graph Viewport (`.canvas-card-container`): Viewport header with dynamic layer title (`#hnsw-graph-title`), subtitle (`#hnsw-graph-subtitle`), status badge, node/edge legend, full-height canvas (`#hnsw-canvas`), and navigation hint footer.
  - **Right Column (390px, `.hnsw-console-deck`)**:
    - Card 1: Beam Search Target Launcher (`.hnsw-launcher-card`) with amber "Trace Random Target" button (`#hnsw-trace-random-btn`), divider, $k$ (`#hnsw-trace-k`), $efSearch$ (`#hnsw-trace-ef`), and Stored Vector ID row (`#hnsw-trace-id-input`, `#hnsw-trace-id-btn`).
    - Card 2: Playback Transport (`.hnsw-player-card`) with step counter (`#hnsw-step-counter`), VCR controls (Prev, Play, Next, Reset), playback speed dropdown, and timeline scrubber (`#hnsw-trace-slider`).
    - Card 3: Step Telemetry & Search Stats Bento (`.hnsw-telemetry-card`) with 3 current-step tiles (Node `#hnsw-curr-node`, Distance `#hnsw-curr-dist`, Layer `#hnsw-curr-layer`) and 3 cumulative search stats tiles (Comps `#hnsw-stat-dist-comps`, Visited `#hnsw-stat-nodes-visited`, Layers `#hnsw-stat-visited-layers`).
- **Strict Invariants**:
  - Ask tab and C++ engine 100% frozen.
  - All 44 original HNSW DOM IDs verified and present.
  - 0 non-root hex colors, 0 box-shadow, <= 2 !important, zero innerHTML, 118/118 C++ tests pass.

- **Goal & Motivation**: Rebuilt HNSW tab from ground zero inspired by Apple Xcode Instruments and QuickTime Pro debugger aesthetics.
- **Studio Architecture**:
  - Dedicated `.hnsw-toolbar` on `--bg-panel` with collection dropdown, smooth layer slider, max edges selector, and live status badge with `.status-dot-healthy` green dot and edge summary.
  - Canvas studio frame on `--bg-panel` with layer graph rendering and legend chips.
  - Inspector sidebar on `--bg-panel` with QuickTime-style player transport console (`#hnsw-trace-prev-btn`, `#hnsw-trace-play-btn`, `#hnsw-trace-next-btn`, `#hnsw-trace-reset-btn`, speed dropdown), current step stat tiles on `--bg-raised`, and search statistics tiles.
  - Bottom topology summary strip (`.hnsw-topology-strip`) on `--bg-panel` with 14px radius and hairline stat items.
- **Strict Invariants**:
  - Ask, Settings, and Compare tabs 100% frozen. C++ engine 100% frozen. 156/156 unit tests pass, 118/118 C++ tests pass, scanner clean.

## T-080 summary (ADR-074; Explore tab rebuilt as Apple-grade Vector Space Studio & Neighbor Inspector)

- **Goal & Motivation**: Rebuilt Explore tab from ground zero inspired by Apple Pro Studio (Xcode / Final Cut) coordinate canvas and inspector aesthetics.
- **Studio Architecture**:
  - Dedicated `.explore-toolbar` on `--bg-panel` with collection selector, hairline divider, ghost Refresh, and live status badge with `.status-dot-healthy` green dot and variance note.
  - Canvas studio frame on `--bg-panel` with Reset Zoom action button (`#explore-reset-view-btn`) and DPR-safe coordinate rendering.
  - Inspector sidebar on `--bg-panel` with Query Parameters controls and Nearest Neighbours cards on `--bg-raised` with similarity badges and hover feedback.
- **Strict Invariants**:
  - Ask, Settings, and Compare tabs 100% frozen. C++ engine 100% frozen. 156/156 unit tests pass, 118/118 C++ tests pass, scanner clean.

## T-079 summary (ADR-073; Compare tab rebuilt as Apple-grade Spec Sheet Comparison Matrix, Option 1)

- **Goal & Motivation**: User instructed: "option 1 ka saath chalta haii and remember ask tab aur setting tab ko touch nhi krna but inspired hona uss sa sab ek tune krna chaiyaaa lke theme and all". Replaced 3 disconnected floating cards with an authentic unified Apple "Hardware Spec Comparison" style matrix.
- **Unified Spec Sheet Architecture**:
  - Hero Callout Banner (`.compare-hero-banner`): Elevated panel on `--bg-panel` with dynamic data-driven headline from `buildCompareHeadline(report)` (e.g. `⚡ HNSW delivered 8.4x speedup over Brute Force`), subtitle with k/count/reps, and 3 pill chips for Winner (`Fastest: HNSW`), Speedup (`8.4x Speedup`), and Recall (`100% Recall`).
  - Unified Spec Sheet (`.compare-spec-sheet`): Single elevated container on `--bg-panel` (`#121215`) with 14px radius and 1px hairline border, containing 3 columns (Brute Force, KD-Tree, HNSW) separated by hairline vertical borders (`border-right: 1px solid rgba(255, 255, 255, 0.06)`), winner column subtly tinted with amber accent.
  - Spec Section 1 (Latency Hero): 28px tabular bold hero latency value (`32 µs`), relative speedup tag (`3.8x faster` in amber tint, `1.0x (Baseline)` for brute), min-max range sublabel, and 6px smooth progress bar on `--bg-raised` track.
  - Spec Section 2 (Distance Computations): 22px tabular semibold count (`64`), with pruning efficiency tag (`93.6% pruned`, `0% pruned (Full scan)`).
  - Spec Section 3 (Accuracy & Ground Truth): 20px semibold Recall percentage + Top-k match visualizer (Brute Force: reference box; KD-Tree/HNSW: 10 interactive squares with hover tooltip + `X / Y matched` count).
- **Strict Invariants**:
  - Ask tab files (`web/js/ask.js`, `web/js/ask_helpers.js`, `#panel-ask`) and Settings tab files (`web/js/settings.js`, `#panel-settings`) 100% frozen.
  - C++ engine (`src/`, `include/`, `tests/`) 100% frozen.
  - 156/156 browser unit tests pass, 118/118 C++ tests pass, scanner 100% clean, 0 box-shadow, !important = 2.

## T-078 summary (ADR-072; Compare tab renovated inspired by Ask and Settings UI)

- **Goal & Motivation**: User instructed: "bohot badiya kfii acha kaam kiiya setting tab mai toh ab humm compare tab ka ui maii kaam karanga bss ab sab bhul jaaao ab tkk ka jo bhi kiyaa bss ask tab aur setting tab ka ui sa inspire hokaa compare tab banao professional typeee (Note - ask tab aur setting tab ko mtt chadhna uss sa inspire hokaa hee compare tab banao) sab design rules bhul jaao tumhara pass ask tab aur setting tab ka ui haii uski theme haii ab tumha compare tab ko design krna hai zero sa sab bhul jna compare tab ka ab tkk ka restart krooo".
- **Unified Canvas Architecture**:
  - Viewport: Aligned to 1180px centered studio canvas matching Settings (`max-width: 1180px; margin: 0 auto;`), eliminating horizontal mismatch when switching between tabs and giving cards generous breathing room.
  - Control Bar: `.compare-control-row` upgraded to `--bg-panel` with 14px radius, 1px hairline border, uppercase tracked labels (`11px, 600 weight`), `--bg-raised` dropdowns and buttons, smooth cubic-bezier transitions, and active button micro-scaling (`scale(0.98)`).
  - Live Status Badge: Added `.compare-status-cluster` with `.compare-status-badge` featuring live green pulse dot (`.status-dot-healthy`) and `#compare-progress-status` text next to the 2px bottom progress line.
  - Refined Algorithm Cards: 3 equal-width cards on `--bg-panel` with 14px radius, 1px hairline border, 24px 26px padding:
    - Card Header: 9px colored algorithm dot + 19px semibold title + 11px uppercase Baseline pill badge on Brute Force.
    - Hairline dividers: 18px separation with `rgba(255, 255, 255, 0.06)`.
    - Row 1: Median latency (14.5px label + range sublabel, 20px tabular semibold value) + 6px smooth progress bar on `--bg-raised` track.
    - Row 2: Distance computations (14.5px label, 20px tabular semibold value).
    - Row 3: Top-k rank match (Brute Force reference text; KD-Tree/HNSW with 14px algorithm-colored square cells and hover/focus tooltips + count).
    - Row 4: Recall (14.5px label, 20px tabular semibold value).
    - Footnote: Info circle icon + 13px muted indicative timings note.
  - CSS Cleanup: Removed dead `.compare-race-*` media queries and fixed unmatched brace in `app.css`.
- **Strict Invariants**:
  - Ask tab files (`web/js/ask.js`, `web/js/ask_helpers.js`, `#panel-ask`) and Settings tab files (`web/js/settings.js`, `#panel-settings`) 100% frozen.
  - C++ engine (`src/`, `include/`, `tests/`) 100% frozen.
  - 156/156 unit tests passed, 118/118 C++ tests passed.

## T-077 summary (ADR-071; Settings single-screen unified Bento dashboard without sub-tabs)

- **Goal & Motivation**: User requested: "option A ka saaath chalta haii acha sa apply krnaa issa chao suru ho jaaao". Eradicated sub-tab switching so that all settings and controls are directly visible on one single unified screen.
- **Unified Bento Dashboard Architecture**:
  - Viewport: centered at 1180px (`max-width: 1180px; margin: 0 auto;`).
  - Top full-width card: "Server & Engine Health" with live status cluster, 4x2 grid of elevated stat tiles (`--bg-raised`), and installed Ollama model chips.
  - Bottom 2-column balanced grid:
    - Left column: "Demo Collection" card with 2x2 grid form (Dimension, Metric dropdown, M, efConstruction) + "Insert synthetic vectors" form with primary amber button.
    - Right column: "Storage & Maintenance" card with disk persistence status/directory tiles, chat history with two-step confirm, documentation links, and danger zone collection reset.
  - All 22 original Settings DOM IDs, both two-step confirms, and custom dropdown preserved.
- **Strict Invariants**:
  - Ask tab files and C++ engine 100% frozen. 156/156 unit tests passed, 118/118 C++ tests passed.

## T-076 summary (ADR-070; Settings tab rebuilt from zero inspired by Ask canvas & Compare cards)

- **Goal & Motivation**: User instructed: "setting tab ka ui maii kaam karanga bss ab sab bhul jaaao ab tkk ka jo bhi kiyaa bss ask tab ka ui sa inspire hokaa setting tab banao professional typeee (Note - ask tab ko mtt chadhna uss sa inspire hokaa hee setting tab banao) sab design rules bhul jaao tumhara pass ask tab ka ui haii uski theme haii ab tumha setting tab ko design krna hai zero sa sab bhul jna setting tab ka ab tkk ka restart krooo".
- **Centered Studio Architecture**:
  - Removed nested 240px sidebar and two-pane container.
  - `.settings-viewport`: `max-width: 860px; margin: 0 auto;` matching Ask tab's exact chat thread width and vertical centering.
  - `.settings-segmented-bar`: Horizontal pill-shaped category picker on `--bg-panel` (Server, Collection, Storage, Data and chats, Danger zone) with roving tabindex and keyboard arrow navigation.
  - Grouped section cards: `--bg-panel` (`#121215`), 14px radius, 1px hairline border (`rgba(255, 255, 255, 0.08)`), 26px 30px padding.
  - System metrics: 4-column x 2-row grid of elevated stat tiles (`--bg-raised`, 8px radius, 11px uppercase label, 16px tabular semibold value).
  - Storage & Forms: 2-column input forms on `--bg-raised`, 2-tile storage grid, danger card with subtle red hairline border.
  - Preserved all 22 DOM IDs, both two-step confirms, and custom dropdowns.
- **Strict Invariants**:
  - Ask tab files and C++ engine 100% frozen. 156/156 unit tests passed, 118/118 C++ tests passed.

## T-075 summary (ADR-069; Compare 3-card list layout restored to approved mockup 15)

- **Goal & Motivation**: Human uploaded `docs/mockups/15-compare-rows.png` (`media_1794762824941_c84003ad.jpg`) directly in chat. Compare tab rebuilt from single table/race layout into the approved 3-card layout with Apple-grade polish.
- **Three Cards Architecture**:
  - `#compare-cards-container`: 3 equal-width columns (`grid-template-columns: repeat(3, minmax(0, 1fr))`, collapses to 1 column below 1100px), `--bg-panel` (`#121215`), 14px radius, 1px hairline border, content-sized height (~480px, no empty vertical bands, no bottom gaps).
  - Card Header: Algorithm dot (sand for Brute Force, emerald for KD-Tree, amber for HNSW) + 18.5px semibold title (`Brute Force`, `KD-Tree`, `HNSW`). Brute Force features subtle "Baseline" pill badge.
  - Row 1: "Median latency" + "Range min - max µs" on left, tabular value on right, 6px algorithm-colored progress bar underneath.
  - Row 2: "Distance computations" on left, tabular count on right.
  - Row 3: "Top-k rank match" (Brute Force: "Reference for the other algorithms" subtitle + "—"; KD-Tree/HNSW: 10 rounded square cells colored in algorithm accent with hover/focus tooltips + "10 / 10" tabular count on right).
  - Row 4: "Recall" on left, tabular percentage on right.
  - Below cards: Legend footnote with `createIcon("info", 14)` icon.
- **Helpers & Tests**:
  - Exported and integrated pure helper `mapReportToCards(report, latencies)`.
  - Added 4 unit tests in `test_compare.js` bringing total registered unit tests to 156 (156/156 passed).
- **Strict Invariants**:
  - Ask tab files (`web/js/ask.js`, `web/js/ask_helpers.js`), `#panel-ask` in HTML, and `.ask-*` CSS rules 100% frozen.
  - Engine code (`src/`, `include/`, `tests/`) 100% frozen.
  - Quality gates: zero innerHTML, zero box-shadow, !important count = 2, zero non-root hex, 156/156 unit tests passing, 118/118 C++ tests passing.

## T-074 summary (ADR-068; Apple-grade design renovation across Explore, HNSW, Compare, Settings)

- **Goal & Motivation**: User requested: "workclike a professional and renovate explore tab, hnsw tab, compare tab and setting tab just assume that that's a apple project toh unka jasa perfection chaiya, professionalism chaiya, smoothness chaiya aur feeling chaiyaaa jo apple deta haii but jo theme hai woh apna wala hee rahana chaiya thaa i give you full control just don't touch ask tab".
- **Apple HIG & Pro App Aesthetics**:
  - Tight SF Pro-inspired letter-spacing (-0.02em titles, -0.015em subtitles/headlines).
  - Uppercase tracked section overlines (`font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted)`).
  - Universal tabular numerals (`font-variant-numeric: tabular-nums`) on all data values, coordinates, metrics, and latencies.
  - Tactile micro-interactions: cubic-bezier transitions (`0.16, 1, 0.3, 1`), active button press micro-scaling (`scale(0.98)`), smooth slider scrubber tracks with hover thumb scaling.
  - Segmented toolbars with `.toolbar-divider` hairlines separating control groups.
  - Explore & HNSW: macOS Inspector-style sidebars with card-style neighbor rows and accent-tinted similarity match percentages; Apple statusbar-style Topology strip.
  - Settings: macOS System Settings grouped card architecture with 8px pill sidebar items, hairline row dividers, and clean active indicators.
- **Strict Invariants**:
  - Ask tab files and C++ engine 100% frozen. 152/152 unit tests passed, 118/118 C++ tests passed.

## T-073 summary (ADR-067; Redesign v4 round 3 - Full-project visual and viewport alignment to Ask tab theme)

- **Goal & Motivation**: User requested: "again apply major changes on project just leave ask tab don't touch it and use theme of ask tab". Aligned Explore, HNSW, Compare, and Settings to the exact theme, surface contrast hierarchy, borders, radii, and typography of the human-approved Ask tab while leaving Ask 100% untouched.
- **Unified Outer Containers & Viewports**:
  - Unified `#panel-ask, #panel-explore, #panel-hnsw, #panel-compare, #panel-settings` to identical outer padding: `padding: var(--space-3) var(--space-6); box-sizing: border-box; overflow: hidden;`.
  - Added dedicated viewport wrappers in `web/index.html`: `.explore-viewport`, `.hnsw-viewport`, `.compare-viewport`, `.settings-viewport`.
  - Centered content viewports: Compare (`.compare-viewport`, max-width 960px, margin: 0 auto), Settings (`.settings-viewport`, max-width 1000px, margin: 0 auto) with internal smooth scrollbars.
  - Studio viewports: Explore and HNSW flex column layout filling full available height.
- **Ask Surface Hierarchy**:
  - Cards and content surfaces use `--bg-panel` (`#121215`) with `1px solid var(--border-hairline)` (`rgba(255, 255, 255, 0.08)`).
  - Floating bars, elevated toolbars, and sidebars use `--bg-raised` (`#18181c`) with `1px solid var(--border-hairline)` matching `.ask-docs-drawer`.
  - Inner inputs use `--bg-panel` with hairline borders.
  - Pill chips for legend swatches use `--bg-raised` with hairline borders and 12px sans text.
  - Tabular numerals (`font-variant-numeric: tabular-nums`) applied to stat tiles and metrics.
- **Compare Surface Polish**:
  - `.compare-control-row`: floating raised pill (64px min-height, `--bg-raised`, hairline border, 14px radius, 0 20px padding).
  - `.compare-headline-block`: `--bg-panel` card with hairline border and 22px 28px padding.
  - `.compare-race-section`: `--bg-panel` card with hairline border and 22px 28px padding.
  - `.compare-table-section`: `--bg-panel` card with hairline border and 18px 24px padding.
  - `.compare-empty-panel`: `--bg-panel` card with hairline border and 48px 32px padding.
- **Settings Surface Polish**:
  - `.settings-section-panel`: `--bg-panel` card with hairline border, 14px radius, and 28px 32px padding.
  - `.settings-nav-pane`: 220px fixed navigation list with hairline border.
- **Strict Invariants**:
  - Ask tab files (`web/js/ask.js`, `web/js/ask_helpers.js`), `#panel-ask` in HTML, and `.ask-*` CSS rules 100% frozen.
  - Engine code (`src/`, `include/`, `tests/`) 100% frozen.
  - Quality gates: zero innerHTML, zero box-shadow, !important count = 2, zero non-root hex, 152/152 unit tests passing, 118/118 C++ tests passing.
- **Git Commit**: `c21fb68` (`T-073: Full-project visual and viewport alignment to Ask tab theme (Explore, HNSW, Compare, Settings)`).

## T-072 summary (ADR-066; Redesign v4 round 2 - Compare and Settings structural rebuild)

- **Context & Motivation**: T-071 was rejected by human for looking unchanged ("same as before, make MAJOR changes"). T-072 executed a complete structural rebuild of Compare and Settings:
- **Compare Tab Structural Rebuild (Commits `a60f6a9`, `f3b8c0d`)**:
  - Completely removed the 3-card grid and `.compare-card*` styles (zero occurrences of `compare-card` in codebase).
  - Rebuilt results into a single-column 1200px max-width layout (`#compare-results-view`):
    1. **Headline Block (`#compare-headline-block`)**: 28px regular sentence with medium-weight key numbers (e.g. "HNSW was 1.8x faster than Brute Force with 100.0% recall on 100 vectors.") and 14px muted subline.
    2. **Latency Race (`#compare-race-section`)**: 3 rows (Brute Force, KD-Tree, HNSW) with algorithm color dot, 12px rounded pill bar on shared linear scale (slowest = 100%), 20px tabular sans value (text-primary for fastest, text-secondary for others), and min-max range under it.
    3. **Detail Table (`#compare-table-section`)**: 3 rows x 4 columns (Algorithm | Distance computations | Recall@k | Top-k match vs Brute Force), 56px row height, faint hairlines between rows only, 16px tabular sans numbers, compact k flat cells with hover/focus tooltip, "Ground truth" text for Brute Force.
    4. **Footnote (`#compare-footnote`)**: Quiet notice: "Timings are indicative (browser JS loop). Official benchmarks run via the C++ CLI tool."
  - Pure helpers in `web/js/compare_helpers.js`: `buildCompareHeadline`, `buildLatencyRaceRows`, `buildDetailTableRows`.
  - Replaced 4 obsolete card tests in `web/js/tests/test_compare.js` with 7 comprehensive unit tests.
- **Settings Tab Two-Pane Rebuild (Commits `85bb63f`, `697e483`)**:
  - Replaced old full-width rows layout with an instrument-grade Two-Pane architecture (`.settings-two-pane-container`):
    1. **Left Pane (240px fixed nav, `.settings-nav-pane`)**: 5 section tabs (`#settings-tab-server`, `#settings-tab-collection`, `#settings-tab-storage`, `#settings-tab-data`, `#settings-tab-danger`). Active tab has 2px amber left indicator (danger has red indicator), `font-weight: 500`. Roving tabindex keyboard navigation (`ArrowDown`/`ArrowUp`, `ArrowRight`/`ArrowLeft`, `Home`/`End`) powered by pure helper `getSettingsNextSectionIndex`. Responsive horizontal scroll tab row below 1100px.
    2. **Right Content Pane (760px max-width, `.settings-content-pane`)**: Shows active section panel with 200ms ease-out fade transition. Panels: `#settings-section-server`, `#settings-section-collection`, `#settings-section-storage`, `#settings-section-data`, `#settings-section-danger`.
    3. **Server Status**: Live status badge ("Server ok"), Ollama status ("Ollama online"), 2-column definition list (`<dl id="settings-health-box">`) with 14px muted label left and 16px tabular sans value right separated by hairline rows, and plain text models list (`<ul class="settings-plain-list">`).
    4. **Collection & Storage**: Clean 44px vertical inputs with 440px max-width form container. Single primary button in Collection section (`#demo-insert-random-btn`).
    5. **Data & Chats**: Calm action blocks for chat history and documentation links.
    6. **Danger Zone**: Clear warning text and soft red reset button.
  - All 22 original Settings DOM IDs and both two-step confirms (`#demo-reset-btn`, `#settings-clear-chats-btn`) strictly preserved.
  - Added 6 pure unit tests in `web/js/tests/test_v2.js` covering `getSettingsNextSectionIndex`. Registered browser tests expanded to 152.
- **Git Commits**:
  - `a60f6a9` - `T-072 A: Compare structural rebuild (headline, latency race, detail table)`
  - `f3b8c0d` - `T-072 B: Compare helpers, tests, dead code removal`
  - `85bb63f` - `T-072 C: Settings two-pane rebuild`
  - `697e483` - `T-072 D: Settings tests, dead code removal`

## T-071 summary (ADR-065; Redesign v4 across Explore, HNSW, Compare, Settings)

- **Design Permission & Scope**: Full design delegation granted by human to establish an instrument-grade, calm, mature product UI across the 4 non-Ask tabs. Ask tab remains 100% frozen and untouched.
- **Root-Cause Padding Fix (P0, commit `b569bf1`)**:
  - Reset `.app-content` padding to 0.
  - Preserved Ask's exact padding (`#panel-ask { padding: var(--space-3) var(--space-6); }`).
  - Grouped `#panel-explore, #panel-hnsw, #panel-compare, #panel-settings` to share standard `padding: 24px 28px; box-sizing: border-box;`.
  - Removed `#panel-compare` negative-margin hack. Resolves ISS-057 and ISS-071 left-edge touching and right-edge clipping.
  - Unified `.page-header` and `.tab-toolbar` (60px height, 14px radius, `--bg-raised`, 1px hairline border, `0 20px` padding).
  - Global `appearance: textfield;` disables native spinners; added `prefers-reduced-motion` block.
- **Explore Redesign (P1, commit `8018f8a`)**:
  - Replaced native select `#explore-coll-select` with `createDropdown` in `#explore-coll-dropdown-wrap`.
  - Standardized collection labels to "Demo Vectors" / "Document Chunks".
  - Subtitle updates dynamically via `getExploreCanvasSubtitle(collection)`.
  - Query actions disabled when collection count === 0 via `isExploreActionDisabled(count)`.
  - Replaced banned emoji with SVG line icons. Added 2 pure unit tests in `test_explore_hnsw.js` (total 143 tests).
- **HNSW Redesign (P2, commit `328f429`)**:
  - Replaced native selects (`#hnsw-coll-select`, `#hnsw-max-edges-select`, `#hnsw-trace-speed`) with `createDropdown`.
  - Layer slider `#hnsw-layer-slider` given fixed width 120px with `flex-shrink: 0`, preventing toolbar wrapping.
  - Trace buttons disabled when collection count === 0.
- **Compare Redesign (P3, commit `dc778d3`)**:
  - Added quiet "Baseline" badge on Brute Force card header.
  - Fixed `#compare-coll-dropdown-wrap` min-width to 170px nowrap, preventing "Document Chunks" label clipping.
  - Preserved medium 580px cards and 0.0px row top alignment across all 3 cards.
- **Settings Redesign (P4, commit `59c0c83`)**:
  - Rebuilt `.settings-demo-controls-form` into clean 4-column grid (`repeat(4, minmax(110px, 130px))`) with 40px inputs, resolving ISS-071.
  - Hairline borders and 22px 28px padding.
- **Consistency Sweep (P5, commit `e2ec407`)**:
  - Verified all 119 DOM IDs statically present and functional.
  - Exactly 0 or 1 `.btn-primary` per view across all states.
  - Zero native selects on the 4 tabs.
  - All 143 browser unit tests pass in Node. Web safety scanner 100% clean.
  - `!important` count = 2, `box-shadow` count = 0, hex count outside `colors.js` = 0.
- **Git Commits**:
  - `b569bf1` - `T-071 P0: shared shell, padding root-cause fix and components`
  - `8018f8a` - `T-071 P1: Explore redesign`
  - `328f429` - `T-071 P2: HNSW redesign`
  - `dc778d3` - `T-071 P3: Compare redesign`
  - `59c0c83` - `T-071 P4: Settings redesign`
  - `e2ec407` - `T-071 P5: consistency sweep`

## T-070 summary (ADR-064; supersedes ADR-041 & Settings layout of ADR-048)

- **Layout**: Rebuilt Settings from the old 3-column panel grid (which left ~250px dead bottom space and had a centered title) into a left-aligned page header followed by calm, full-width rows (label left, controls right), matching the aesthetic of the new Compare cards.
- **Server Status Panel**: Full-width panel (`--bg-panel`, 14px radius, no border, no shadow) with title "Server status", status dot + "ok" badge, description "Local services and model runtime.", and real Ollama model chips on the right.
- **Real 8-Metric Strip**: Grid of 8 real server metric tiles on `--bg-raised` with hairline borders:
  1. Version: `v${health.version || "-"}`
  2. Dimension: `String(config.dimension ?? "-")`
  3. Metric: `String(config.metric ?? "-")`
  4. M: `String(config.hnsw?.M ?? "-")`
  5. efConstruction: `String(config.hnsw?.efConstruction ?? "-")`
  6. efSearch: `String(config.hnsw?.efSearch ?? "-")`
  7. Vectors: `String(stats.count ?? 0)`
  8. Memory (approx): `formatBytes(stats.memory_bytes || 0)`
  Labels are 13px muted; values are 22px regular/medium tabular sans (no mono).
- **Settings Rows**:
  - **Row a (Demo collection)**: Dimension (`#demo-dim-input`), Metric (`createDropdown` from `ui.js` with hidden input `#demo-metric-select`), M (`#demo-m-input`), efConstruction (`#demo-efc-input`). Form applies identically via `#demo-reset-btn` two-step confirm without inventing an Apply button.
  - **Row b (Insert random vectors)**: Count input (`#demo-random-count`) + the single primary amber button "+ Insert" (`#demo-insert-random-btn`, `.btn-primary`).
  - **Row c (Persistence and storage)**: Read-only fields for Persistence status (`#settings-persistence-status`) and Data directory (`#settings-persistence-dir`) with hint (`#settings-persistence-hint`).
  - **Row d (Chat history)**: "Clear Chat History" (`#settings-clear-chats-btn`) with existing two-step confirm (`#settings-clear-chats-cancel-btn`).
  - **Row e (Documentation and guides)**: Interactive Test Suite link (`/tests.html`) with external icon and Start Guided Tour button (`#settings-start-tour-btn`) with arrowRight icon.
  - **Row f (Danger zone)**: Soft-red styling with description "Clears all demo vectors and resets the index." and Reset Demo Collection button (`#demo-reset-btn`) with existing two-step confirm (`#demo-reset-cancel-btn`).
- **DOM & Behavior Invariants**: All 22 original Settings DOM IDs and both two-step confirms strictly preserved. Exactly ONE `.btn-primary` on Settings view.
- **Viewport Fit**: Content-sized rows with 20px 24px padding fit comfortably at 1920x1080 100% without page scroll. Responsive stacking below 1100px.
- **Git**: commits `0a804dc` (T-070 A), `953421a` (T-070 B), and docs commit.

## T-069 summary (ADR-063; supersedes ADR-062 card sizing & type scale)

- **Medium Content-Sized Cards**: Replaced 490px cards with medium content-sized 580px cards ($\in [560, 600]\text{px}$) matching mockup proportions at 1920x1080 scale ($581\text{px}$). Locked `.compare-card` to `grid-template-rows: 80px 150px 105px 140px 105px;` with 0.0px variance across all row tops across all 3 cards.
- **Row Padding & Symmetry**: Single-tier rows (Distance and Recall) are 105px with vertically centered content; two-tier rows (Latency and Rank match) get fixed vertical padding of 26px (`padding: 26px var(--space-5); justify-content: space-between;`), giving balanced, calm gaps.
- **Aesthetic Type Scale**:
  - Header algorithm name: 22px medium (`--text-xl`, 500).
  - Row metric labels: 17px in `--text-secondary` (clearly brighter, NOT `--text-muted`).
  - Row values: 24px regular, tabular numerals, primary text colour (`--text-primary`), right-aligned.
  - Unit "µs": 15px muted on the same baseline.
  - Helper lines ("Range min – max µs", "N / K", "Reference for the other algorithms"): 14px muted (`--text-base`).
- **Rank Strip & Match Cells**: Real-k flat cells expanded to 22px height, full row width; matched cells colored with algorithm palette at **80% opacity** (clearly visible, calm, not dull or glowing); mismatch cells keep 1px accent outline with hover/focus tooltip; Brute Force shows "Reference for the other algorithms" once.
- **Larger Control Row**: Raised bar height increased to 76px (`min-height: 76px; height: 76px; border-radius: var(--radius-lg); padding: 0 var(--space-6);`). Visible 14px muted labels ("Collection", "Repetitions"), 16px medium primary selected values, 40px height primary button with 15px text, 15px ghost Options button (40px height), 14px muted status text, and Options popover opening cleanly below the 76px bar. All original controls, IDs, and event handlers preserved.
- **Legend Gap**: Positioned directly under cards with 24px gap (`margin-top: var(--space-6);`), 13px muted text; dark space below accepted.
- **Git**: commit `386054b` (`T-069: Compare medium cards, type scale, larger control row`), docs commit.

## T-068 summary (ADR-062; supersedes ADR-061 card sizing)

- **Height & Proportions**: Replaced flex-1 and height-100% stretching with compact, content-sized cards (~490px total height, well within the 480-540px range) matching mockup `15-compare-rows.png`.
- **CSS Grid Row Template**: Locked `.compare-card` to `grid-template-rows: 72px 130px 84px 118px 86px;` matching mockup proportions (Header ~15%, Median latency ~27%, Distance computations ~17%, Top-k rank match ~24%, Recall ~18%). All rows are <= 130px (reversing earlier 150px stretched rows).
- **Layout Alignment**: All 3 cards share the identical row template, guaranteeing 0.0px variance across all row tops (Header y=0, Latency y=72, Distance y=202, Rank y=286, Recall y=404).
- **Stack & Container**: Removed `flex: 1` from `.compare-results-stack` and `.compare-cards-container` (`align-items: start;`), removing vertical stretching of cards to full viewport height.
- **Legend Placement**: Legend line pinned directly below the cards with a 20px gap (`margin-top: var(--space-5);`); dark empty space below the legend is intentionally accepted per human decision.
- **Responsive**: Stacks to 1 column below 1100px with the same 490px content height per card.
- **Git**: commit `6b0d979` (`T-068: Compare compact content-sized cards`), docs commit.

## T-067 summary (ADR-061; supersedes ADR-059 and ADR-060)

- **Layout**: Rebuilt cards into calm list-style rows separated by 1px faint hairlines (`var(--border-hairline)`). Full-height cards (`height: 100%`, `padding: 0`, `overflow: hidden`) with identical grid rows (`grid-template-rows: 56px 1.4fr 1fr 1.3fr 1fr;`) guaranteeing identical row tops across cards.
- **Vertical Centering**: Every row vertically centers its content (`justify-content: center;`), eliminating the ~100px bottom band under Recall and uneven 100-120px gaps.
- **Header**: Algorithm color dot + name (20px medium), no chips or decorative badges.
- **Median Latency Row**: Label left (15px) with min-max range (13px) below it; value right (24px tabular sans) with muted "µs" (14px) on baseline; 6px pill bar on faint track on shared scale (`computeBarScale`).
- **Distance Computations Row**: Label left (15px), value right (24px tabular sans). Distance bar completely removed.
- **Top-k Rank Match Row**: Label left (15px), count "N / K" right (15px muted) with aria-label; full-width strip of real-k flat rounded cells (20px height) below. Brute Force shows "Reference for the other algorithms" in place of strip/count.
- **Recall Row**: Label left (15px), value right (24px tabular sans) with "%", primary text color.
- **Dead Code Removed**: Removed 40px type styles (`.compare-latency-num`, `.compare-dist-num`, `.compare-recall-num`), `.compare-card-section`, distance bar CSS and JS (`distScale`, `distBarWidthPct`). Updated test assertions honestly.
- **Git**: commit A (`d679efe`), commit B (`5d70543`), docs commit.

## T-066 summary (ADR-060; refines ADR-059 Compare cards)

- **Row Alignment**: Replaced unconstrained flex justify-between with strict CSS Grid `grid-template-rows: auto 1fr 1fr 1fr 1fr; row-gap: var(--space-4);`. Card header is row 1; rows 2-5 are each `1fr` with top-aligned content, guaranteeing identical y-coordinates for Median latency, Distance computations, Top-k rank match, and Recall across all 3 cards with 0-1px tolerance.
- **Filled Spacing**: Eliminated ~150px gaps. All sections sit compactly within their row slots (gaps between section text and bars <= 90px).
- **Larger Type Scale**:
  - Card header algorithm name: 20px font-size, line-height 1.2.
  - Section labels: 13px font-size, line-height 1.3, text-muted.
  - Big numbers (Median latency, Distance computations, Recall): 40px regular sans font (`var(--font-sans)`), tabular numerals, primary text color (`text-primary`), line-height 1.1.
  - Unit "µs": 16px text-muted sitting directly on baseline with big number.
  - Range text, summary text, and reference text: 13px text-muted.
- **Restored Distance Bar**: 6px pill bar on faint track (`--bg-raised`) computed on a shared linear scale via `computeBarScale([brute.dist, kdtree.dist, hnsw.dist])` where largest distance = 100%.
- **Latency Bar**: 6px pill bar on faint track on shared linear scale where slowest latency = 100%.
- **Full-Width Rank Strip**: `.compare-rank-strip` spans full card content width (`width: 100%`) with `flex-wrap: nowrap`. Rank cells have `flex: 1 1 0; min-width: 0; height: 16px;` spreading evenly across the full ~480-530px card width without wrapping or overflowing even at $k=20$. Brute Force shows "Reference for the other algorithms" in rank match block with matching height.
- **Fixed Browser Test (ISS-066)**: Fixed failing test `mapReportToCards maps real benchmark fixture to 3 algorithm cards with correct structure` in `web/js/tests/test_compare.js:917` by aligning assertions with real fixture data (HNSW distance computations = 64, same-rank count = 9). All 141 registered tests pass.
- **Git**: commit A (`a7fb01c`), commit B (`30190ca`), docs commit.

## T-065 summary (ADR-059; supersedes ADR-058 5-column lanes panel)

- **Layout**: Replaced single 5-column lanes panel with three equal-height algorithm cards side by side (`#compare-cards-container`, `.compare-card`) filling ALL remaining height under the control row down to the legend line. Eliminated wide-screen ~600px dead gap and dead bottom bands.
- **Cards**:
  1. Brute Force (taupe `#9c8269` dot + name)
  2. KD-Tree (moss `#708a78` dot + name)
  3. HNSW (amber `#d9a441` dot + name)
- **Sections per card**:
  - **Median latency**: Muted label, 28px regular sans number with tabular numerals (NOT mono) + muted "µs" on same baseline, 11px muted range text, 5px pill bar on faint track (shared scale across the 3 medians where slowest = 100%).
  - **Distance computations**: Muted label, 26px regular sans number with tabular numerals (NOT mono). NO bar (Brain decision: fewer visual languages).
  - **Top-k rank match**: Muted label. Brute Force shows quiet text "Reference for the other algorithms" in this section only. KD-Tree and HNSW show real-k flat cells (55% algorithm opacity for match, 1px muted-amber outline for mismatch with hover/focus tooltip) + summary `N of K same rank`.
  - **Recall**: Muted label, 26px regular sans number with "%" in primary text color (NOT algorithm colored).
- **Tooltip**: Bound-checked tooltip for empty rank cells ("Rank R: expected #GT, got #ID" with IDs in mono). Flips below cell if near container top; clamped horizontally; not clipped by cards.
- **Legend**: Muted line pinned under cards: "Filled = same rank as ground truth. Latency: lower is better. Timings are indicative: official benchmarks come from the C++ tool."
- **Responsive**: 3 equal columns >= 1100px (and at 125% zoom on 1080p); stacks to 1 column below 1100px with tab scroll.
- **Pure Helpers & Tests**: Added `mapReportToCards(report, latencies)` in `web/js/compare_helpers.js`. Registered browser unit tests expanded to 141 in code (54 tests in `test_compare.js`).
- **Git**: commit A (`36de598`), commit B (`a34f44f`), docs commit.

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

Task T-063 executed the Compare tab redesign v3.2 (soft lanes with pill bars + collapsed top-k diff) from two new human-approved ChatGPT mockups on branch `ui-redesign-v3` (ADR-057).

Task T-064 executed the Compare tab redesign v3.3 (single "Algorithm lanes" panel with rank strips) on branch `ui-redesign-v3` (ADR-058):
- **Commit `467c0cb` (T-064 A)**: Replaced two-panel Compare results layout with a single `#compare-lanes-panel` filling all available height under the control row; subtitle updated to "Speed, work and accuracy against the ground truth."; strict 5-column shared CSS grid (`Algorithm | Median latency | Distance computations | Rank match vs ground truth | Recall`); median latency column with 26px regular number, muted "µs", 4px pill bar on faint track, and range text; plain right-aligned distance computation count; per-lane rank strip with flat cells; plain right-aligned recall percentage (~22px); 3 equal-height lanes with hairline dividers; bottom pinned muted legend line; removed `#compare-matrix-panel` and its DOM/CSS/JS.
- **Commit `035eb9a` (T-064 B)**: Pure helpers `buildRankStrip(gtResults, candResults, k)` and `formatRecallPercent(recall)` added to `compare_helpers.js`; dead helper `buildRankDiff` removed; interactive tooltip on hover (`mouseenter`) and focus (`tabindex="0"`) for empty cells showing exact expected vs got IDs with IBM Plex Mono font; closes on mouseleave, blur, and Escape; registered browser unit tests expanded to 137 in code with 50 tests in `test_compare.js`.

### Current Status by Tab (2026-11-15):
- **Ask**: COMPLETE & HUMAN-VERIFIED (T-057, T-058, T-059, T-060, T-061). Drawer re-center, collapsed-by-default glass-box, 3 tabs (Sources, Latency, Algorithms) with equal fixed height (`--glassbox-tab-h: 196px`), smooth animation confirmed by human ("satisfied now with the work" after T-061).
- **Compare**: COMPLETE (T-069, ADR-063). Medium content-sized cards (580px tall: 80px / 150px / 105px / 140px / 105px), 17px secondary labels, 24px primary values, 22px header, 80% opacity rank cells, 76px raised control row with 14px labels and 40px primary button, 24px legend gap. Awaiting human screenshots (Demo results, Demo empty, Docs results, full window 100% zoom) and /tests.html verification.
- **Settings**: NEXT (T-070, full-width rows mockup; ADR-064 reserved).
- **Explore, HNSW**: Next in defined order after Settings.

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
  - `ui-redesign-v3`: Active branch containing T-055 through T-070 and SYNC-012.
  - `backup-before-v2`: Safety backup prior to v2 unfreeze, confirmed intact.
- **Tracking Status**: Local branch `ui-redesign-v3`, without upstream tracking (commits unpushed per protocol; nothing pushed to origin).
- **Working Tree**: Clean tracked files; only untracked test logs in `results/logs/`.
- Note: Git state in docs can go stale after pushes; always trust human's `git status -sb`.

---

## 5. Pending Human Actions

1. **Bring new design / mockups for Compare and Settings in the next Brain chat**: Provide mockups or specifications for Compare and Settings (reversing prior disliked iterations T-064..T-069 for Compare, T-070 for Settings).
2. **Always attach the mockup image to the builder prompt**: Whenever writing a task for UI implementation, include the image directly in the prompt.
3. **Explore design work in Design Chat**: Work with the separate Design Chat (Design Director) on Explore image prompts and review, providing current Explore screenshots (empty and populated) to get the FINAL SPEC and approved mockup names (`12-explore-results.png`, `13-explore-empty.png`).
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
  - Compare tab: T-069 implemented (ADR-063, 580px medium cards), human saw and not satisfied (ISS-070); pending human's new design in next Brain chat.
  - Settings tab: T-070 implemented (ADR-064, full-width rows layout), human saw and not satisfied (ISS-070, ISS-071); pending human's new design in next Brain chat.
  - Explore tab: NEXT after Compare/Settings design resolution per ADR-050. Pending human screenshots of current Explore tab and FINAL SPEC from Design Chat.
  - HNSW tab: PENDING (redesign v3.1 from human-approved mockup).
- **Pending Human Screenshots (Not Yet Seen)**:
  - Compare Docs results, Compare Docs empty, Compare Options popover open, Compare dropdowns open, Compare at 125% zoom.
  - ISS-057 visual result in Docs mode, empty states, and 125% zoom.
  - Open algorithm dropdown popup visual.
  - Sidebar collapsed 56px rail.
  - `[n]` citation pill click expanding the panel and scrolling to the card.
  - Keyboard tab navigation (ArrowLeft/Right).
  - 125% zoom layout check across tabs.
  - Docs-mode tabs (Explore Docs with document cluster legend; HNSW Docs notice).
- **Other Tab Items**:
  - Explore subtitle displays "document chunk" text on Demo Vectors (must depend on collection).
  - Explore empty state shows an active solid amber Random Query button that cannot work when empty (must be disabled).
  - Settings title alignment and row styling (see ISS-071).
  - Ask "Compare algorithms" can show a cold-start KD-Tree outlier.
- Optional C++ unit test for ISS-006 ingest rollback.

### Roadmap (Not Started)
- **Hybrid search (BM25 + RRF)**: Requires inverted index and rank fusion; on roadmap, but strictly out of scope for v2.
- **Cross-encoder reranking**: Second-pass neural reranker for retrieved candidate chunks.
- **Automated browser E2E click tests**: Headless browser execution suite (Playwright / Selenium).
- **Real Linux/macOS desktop environment testing**: Real physical environment validation beyond CI.

---

## 7. Important Warnings (Fragile Areas)

- **Zero-innerHTML rule**: Never introduce `innerHTML`, `outerHTML`, or `insertAdjacentHTML` in `web/js/`. Always verify using `powershell -ExecutionPolicy Bypass -File .\scripts\check_web_safety.ps1`.
- **Strict POST Content-Type**: Every HTTP `POST` route requires header `Content-Type: application/json` (send `{}` for empty bodies); returns HTTP 415 otherwise.
- **No mutex held during Ollama calls**: In `src/rag.cpp`, never hold internal collection mutexes during network/Ollama inference calls.
- **Canvas zero-dimension guard**: Check `isCanvasDrawable` before drawing on hidden or unmeasured canvases to prevent `DOMException`.
- **No push without human instruction**: Do not run `git push`, do not merge to `main`, and do not modify remote repository state without explicit human instruction.
