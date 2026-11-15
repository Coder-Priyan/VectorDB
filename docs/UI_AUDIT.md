# VectorDB UI Consistency Audit

Date: 2026-11-13 (Updated 2026-11-14 following T-033 implementation)
Task: T-031 (Informed T-032 & T-033 Phases P4-P7)
Author: Antigravity (The Builder)  
Branch: `ui-redesign`  
Status: [CONFIRMED: Successfully implemented and resolved in T-033 P4-P7]

> **Post-Implementation Note (T-033)**:  
> The findings of this audit directly informed the architectural execution of VectorDB v2:  
> 1. A 4px spacing scale (`--space-1` to `--space-8`) was formalized in `:root` and used across all tabs.  
> 2. An explicit type scale (`--text-xs` 11px to `--text-2xl` 28px) was defined and applied.  
> 3. Standardized shared components were introduced: `.card`, `.page-header`, `.empty-state`, `.skeleton`, `.toast`, `.kbd`.  
> 4. Native form controls (file input, number spinners, select chevrons, range sliders) were completely restyled with zero external libraries.  
> 5. Button hierarchy was strictly enforced: at most ONE `.btn-primary` per visible view across all tabs.  
> 6. All 14 line icons were unified into a zero-dependency SVG registry (`web/js/icons.js`).

---

## 1. Design Tokens Inventory

### 1.1 CSS Custom Properties in `:root`
All custom properties are declared in [web/css/app.css:43-84](file:///f:/Desktop/vectordb/web/css/app.css#L43-L84) [CONFIRMED]:

| Category | CSS Variable | Value | Role / Usage |
| :--- | :--- | :--- | :--- |
| **Fonts** | `--font-sans` | `"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` | UI body text, buttons, inputs |
| | `--font-mono` | `"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` | Data tables, metrics, code, counts |
| **Backgrounds** | `--bg-primary` | `#0e0e0e` | App viewport background |
| | `--bg-surface` | `#131313` | Header, footer, tooltips, cards |
| | `--bg-secondary` | `#181818` | Inputs, empty state boxes, button hovers |
| | `--bg-active` | `#1f1f1f` | Focused input background, active items |
| **Text** | `--text-primary` | `#f0ede6` | Primary headers, values, active tabs |
| | `--text-secondary` | `#c4c1ba` | Section titles, secondary labels |
| | `--text-muted` | `#949087` | Form labels, helper captions, empty states |
| **Borders** | `--border-color` | `#242424` | Hairlines, table dividers, card frames |
| | `--border-active` | `#3a3a3a` | Outline button borders, active borders |
| **Accent (Amber)**| `--accent-color` | `#d9a441` | Primary buttons, active tab border, focus rings |
| | `--accent-hover` | `#e5b14e` | Primary button hover background |
| | `--accent-light` | `#241d11` | Amber badge background |
| | `--accent-border` | `#4a3819` | Amber badge border |
| **Status (Danger)**| `--danger-color` | `#ef4444` | Reset buttons, destructive actions |
| | `--danger-bg` | `#2b1414` | Danger hover background |
| | `--danger-border`| `#4a2020` | Danger button border |
| **Status (Warning)**| `--warning-color`| `#d9a441` | Truncation warning, notices |
| | `--warning-bg` | `#241d11` | Warning notice background |
| | `--warning-border`| `#4a3819` | Warning notice border |
| **Status (Success)**| `--success-color`| `#22c55e` | Server ok dot, green badges, success notice |
| | `--success-bg` | `#132218` | Success notice background |
| | `--success-border`| `#1e402b` | Success notice border |
| **Border Radius** | `--radius-sm` | `0px` | Crisp square corners |
| | `--radius-md` | `2px` | Buttons, inputs, canvas frames |
| | `--radius-lg` | `2px` | Card containers |
| **Spacing** | *(none)* | *(none declared)* | **Zero spacing tokens defined in `:root`** [CONFIRMED] |

---

### 1.2 Hardcoded Colors Outside `:root`
There are **15 hardcoded color declarations** in `web/css/app.css` outside the `:root` block [CONFIRMED]:

1. `web/css/app.css:455`: `color: #0b0b0b;` in `.btn-primary` (high-contrast dark text on amber).
2. `web/css/app.css:495`: `color: #0b0b0b;` in `.btn-warning:not(:disabled):hover`.
3. `web/css/app.css:879`: `color: #0b0b0b;` in `.citation-pill:hover`.
4. `web/css/app.css:1301`: `background: #0a0a0a;` in `.canvas-frame` (canvas container background).
5. `web/css/app.css:1318`: `background: #0a0a0a;` in `.canvas-wrapper` (Compare canvas background).
6. `web/css/app.css:1380`: `background-color: #2a2a2a;` in `.progress-track` (Compare progress bar track).
7. `web/css/app.css:1440`: `background: #132218;` in `#panel-compare .badge-success`.
8. `web/css/app.css:1441`: `border-color: #1e402b;` in `#panel-compare .badge-success`.
9. `web/css/app.css:1442`: `color: #529b67;` in `#panel-compare .badge-success` (sage green text).
10. `web/css/app.css:1446`: `background: #241d11;` in `#panel-compare .badge-warning`.
11. `web/css/app.css:1447`: `border-color: #4a3819;` in `#panel-compare .badge-warning`.
12. `web/css/app.css:1448`: `color: #d9a441;` in `#panel-compare .badge-warning`.
13. `web/css/app.css:1451`: `background-color: #9c8269;` in `.swatch-brute` (taupe legend swatch).
14. `web/css/app.css:1452`: `background-color: #708a78;` in `.swatch-kdtree` (moss legend swatch).
15. `web/css/app.css:1453`: `background-color: #d9a441;` in `.swatch-hnsw` (amber legend swatch).

### 1.3 Hardcoded Pixel Values Outside Tokens
- **Total pixel (`px`) occurrences in `web/css/app.css`**: **289 occurrences** across **45 unique values** [CONFIRMED: regex scan].
- 10 representative examples of hardcoded px values:
  1. `web/css/app.css:156`: `14px` (`.app-title` font-size)
  2. `web/css/app.css:221`: `16px 28px 12px 28px` (`.app-content` padding)
  3. `web/css/app.css:437`: `7px 14px` (`.btn` padding)
  4. `web/css/app.css:605`: `48px` (`.ask-layout` gap)
  5. `web/css/app.css:984`: `24px 0 20px 0` (`.settings-page-header` padding)
  6. `web/css/app.css:1185`: `8px 10px` (`.info-table th` padding)
  7. `web/css/app.css:1197`: `9px 10px` (`.info-table td` padding)
  8. `web/css/app.css:1226`: `0 0 12px 0` (`.tab-toolbar` padding)
  9. `web/css/app.css:1257`: `32px` (`.viz-layout` gap)
  10. `web/css/app.css:1338`: `5px 9px` (`.canvas-tooltip` padding)

---

## 2. Typography Inventory

### 2.1 Distinct Font Sizes, Weights, Line Heights
Scanned across active rules in `web/css/app.css` [CONFIRMED]:

| Property | Value | Rule Occurrences | Examples |
| :--- | :--- | :--- | :--- |
| **font-size** | `11px` | 2 rules | `.info-table th`, `#panel-compare .viz-sidebar .info-table th` |
| | `12px` | 18 rules | `.btn-sm`, `.badge`, `.toolbar-label`, `.legend-row`, `.app-footer`, `.text-xs` |
| | `13px` | 18 rules | `body`, `.tab-btn`, `.form-group label`, `.btn`, `.settings-col-desc`, `.empty-state` |
| | `14px` | 10 rules | `.app-title`, `.section-title`, `.input-text`, `.input-select`, `#settings-health-box tr:nth-child(8) td:last-child` |
| | `15px` | 3 rules | `.answer-box` (large reading text) |
| | `16px` | 2 rules | `.doc-item-title`, `.notice-box` |
| | `18px` | 1 rule | `#panel-settings #settings-health-box td:last-child` (metric strip figures) |
| | `22px` | 1 rule | `.settings-title` (Settings page header h1) |
| **font-weight** | `400` (Regular) | 7 rules | `body`, `.form-group label`, `#settings-health-box td:first-child`, Ollama model value |
| | `500` (Medium) | 16 rules | `.tab-btn`, `.section-title`, `.info-table th`, `.btn`, `.settings-title`, `.info-table td:first-child` |
| | `600` (SemiBold)| 4 rules | `.app-title`, `.btn-primary`, `.test-summary` |
| **line-height** | `1` | 1 rule | `.badge` (reset inside icon) |
| | `1.2` | 1 rule | `.badge` (ISS-025 anti-clip rule) |
| | `1.3` | 1 rule | `.settings-title` |
| | `1.4` | 3 rules | `#panel-settings #settings-health-box td`, `#settings-health-box td:last-child` |
| | `1.5` | 7 rules | `.settings-col-desc`, `.form-group label`, `.answer-box`, `.doc-item-snippet`, `.settings-inline-msg` |
| | `1.6` | 2 rules | `body`, `.question-input` |
| | `1.65` | 1 rule | `.answer-box p` |

---

### 2.2 Heading Selectors & Computed Sizes Per Tab
Scanned from `web/index.html` and `web/css/app.css` [CONFIRMED]:

| Tab / Context | Selector / Element | Tag | CSS Rule (File:Line) | Computed Font Size & Weight |
| :--- | :--- | :--- | :--- | :--- |
| **Header** | `.app-title` | `<h1>` | `web/css/app.css:156` | **14px**, weight **600** |
| **Ask** | `.section-title` | `<h2>` | `web/css/app.css:312` | **14px**, weight **500** ("Document Ingestion") |
| | `.section-title` | `<h3>` | `web/css/app.css:312, 639` | **14px**, weight **500** ("Ingested Documents", "Answer", "Retrieved Sources") |
| **Explore** | *(no h1 or h2)* | — | — | *(absent)* |
| | `.section-title` | `<h3>` | `web/css/app.css:312` | **14px**, weight **500** ("Query Document Space", "Query Demo Vectors", "Nearest Neighbors") |
| **HNSW** | *(no h1 or h2)* | — | — | *(absent)* |
| | `.section-title` | `<h3>` | `web/css/app.css:312` | **14px**, weight **500** ("Graph Topology Summary", "Search Path Step Trace", "Search Traversal Statistics") |
| **Compare** | *(no h1 or h2)* | — | — | *(absent)* |
| | `.section-title` | `<h3>` | `web/css/app.css:312` | **14px**, weight **500** ("Comparative Performance Bars", "Top-k Results Ground Truth Diff", "Benchmark Demo Vectors", "Benchmark Document Chunks", "Summary Metrics") |
| **Settings**| `.settings-title` | `<h1>` | `web/css/app.css:989` | **22px**, weight **500** ("Settings") |
| | `.section-title` | `<h2>` | `web/css/app.css:1005` | **14px**, weight **500** ("Server status", "Demo collection", "Insert random vectors", "Danger zone") |

**Key Finding**: Heading hierarchy is severely inconsistent across tabs. Settings has a modern 22px `h1` and 14px `h2`s; Ask uses `h2` and `h3` (both rendered at 14px); Explore, HNSW, and Compare have no `h1` or `h2` at all, using only `h3` (also rendered at 14px).

---

## 3. Spacing Inventory

- **Total Spacing Declarations in `web/css/app.css`**: **136 declarations** (`padding`, `margin`, `gap`) [CONFIRMED].
- **Unique Spacing Expressions**: **47 distinct expressions** [CONFIRMED].
- **Scale Analysis**: **No consistent spacing scale exists** [CONFIRMED].
  - Component paddings and margins are hardcoded ad-hoc: `0`, `2px`, `4px`, `5px 9px`, `6px`, `7px 14px`, `8px`, `8px 10px`, `9px 10px`, `10px`, `10px 28px`, `12px`, `13px 0`, `14px`, `16px`, `16px 20px`, `16px 28px 12px 28px`, `18px`, `20px`, `20px 24px`, `24px`, `24px 0 20px 0`, `28px`, `32px`, `40px`, `48px`.
  - There are no CSS variables for spacing (e.g. `--space-xs`, `--space-sm`, `--space-md`, `--space-lg`).
  - Layout column gaps vary arbitrarily: `.ask-layout` uses `gap: 48px;`, while `.viz-layout` uses `gap: 32px;` in Explore, HNSW, and Compare.

---

## 4. Button Inventory

### 4.1 Button Classes & Styles
Declared in [web/css/app.css:433-510](file:///f:/Desktop/vectordb/web/css/app.css#L433-L510) [CONFIRMED]:

| Class | Base Styles | Hover State | Disabled State |
| :--- | :--- | :--- | :--- |
| `.btn` | 13px, weight 500, padding 7px 14px, radius-md, 1px solid transparent, inline-flex, gap 6px | — | `opacity: 0.35; cursor: not-allowed;` |
| `.btn-primary` | `background: var(--accent-color); color: #0b0b0b; font-weight: 600; border-color: var(--accent-color);` | `background: var(--accent-hover); border-color: var(--accent-hover);` | Inherits `.btn:disabled` |
| `.btn-outline` | `background: transparent; border-color: var(--border-active); color: var(--text-secondary);` | `background: var(--bg-secondary); color: var(--text-primary); border-color: var(--text-muted);` | Inherits `.btn:disabled` |
| `.btn-danger` | `background: transparent; border-color: var(--danger-border); color: var(--danger-color);` | `background: var(--danger-bg);` | Inherits `.btn:disabled` |
| `.btn-warning` | `background: var(--warning-bg); border-color: var(--warning-border); color: var(--warning-color);` | `background: var(--accent-hover); color: #0b0b0b;` | Inherits `.btn:disabled` |
| `.btn-sm` | `font-size: 12px; padding: 4px 10px;` | — | — |
| `.btn-icon` | `font-size: 12px;` | — | — |
| `.btn-close` | `background: none; border: none; font-size: 14px;` | — | — |

---

### 4.2 Button Usage Per Tab & Solid-Amber Primary Count

#### Global / Header
1. `web/index.html:27`: `#ollama-check-btn` (`.btn .btn-sm .btn-outline`) - Refresh Ollama status.
2. `web/index.html:34`: `#global-error-dismiss` (`.btn-close`) - Dismiss error banner.
- **Solid-amber primary buttons**: **0**

#### Tab 1: Ask
1. `web/index.html:47`: `#doc-reset-cancel-btn` (`.btn .btn-sm .btn-outline .hidden`) - Cancel docs reset.
2. `web/index.html:48`: `#doc-reset-btn` (`.btn .btn-sm .btn-danger`) - Reset Docs collection.
3. `web/index.html:81`: `#doc-ingest-btn` (`.btn .btn-primary .w-100`) - **Primary solid-amber #1** ("Ingest Document").
4. `web/index.html:124`: `#ask-submit-btn` (`.btn .btn-primary`) - **Primary solid-amber #2** ("Ask").
5. `web/index.html:125`: `#ask-stop-btn` (`.btn .btn-outline`) - Stop token streaming.
6. `web/js/ask.js:124`: `.source-toggle-btn` (`.btn .btn-sm .btn-outline`) - Show/hide source text preview.
7. `web/js/ask.js:302`: `.citation-pill` (custom button class) - Clickable source citation pill.
- **Solid-amber primary buttons in Ask**: **2** [CONFIRMED]

#### Tab 2: Explore
1. `web/index.html:163`: `#explore-refresh-btn` (`.btn .btn-sm .btn-outline`) - Refresh PCA projection.
2. `web/index.html:192`: `#explore-query-docs-btn` (`.btn .btn-primary .w-100`) - **Primary solid-amber #1** ("Project Query").
3. `web/index.html:206`: `#explore-demo-random-btn` (`.btn .btn-primary .w-100`) - **Primary solid-amber #2** ("Random Query").
4. `web/index.html:215`: `#explore-demo-id-btn` (`.btn .btn-outline .w-100`) - Search stored vector ID.
5. `web/js/explore.js:72`: `insertBtn` (`.btn .btn-primary .mt-2`) - **Primary solid-amber #3** (Dynamic inside empty-state box: "Insert 1,000 Vectors & Explore").
- **Solid-amber primary buttons in Explore**: **2 static** (or **3** when empty-state is shown) [CONFIRMED]

#### Tab 3: HNSW
1. `web/index.html:253`: `#hnsw-refresh-btn` (`.btn .btn-sm .btn-outline`) - Refresh HNSW layer graph.
2. `web/index.html:285`: `#hnsw-trace-random-btn` (`.btn .btn-primary .w-100`) - **Primary solid-amber #1** ("Random").
3. `web/index.html:294`: `#hnsw-trace-id-btn` (`.btn .btn-outline .w-100`) - Trace vector ID.
4. `web/index.html:298`: `#hnsw-trace-play-btn` (`.btn .btn-sm .btn-primary`) - **Primary solid-amber #2** ("Play").
5. `web/index.html:299`: `#hnsw-trace-prev-btn` (`.btn .btn-sm .btn-outline`) - Step trace backwards.
6. `web/index.html:300`: `#hnsw-trace-next-btn` (`.btn .btn-sm .btn-outline`) - Step trace forwards.
7. `web/index.html:301`: `#hnsw-trace-reset-btn` (`.btn .btn-sm .btn-outline`) - Reset trace player.
- **Solid-amber primary buttons in HNSW**: **2** [CONFIRMED]

#### Tab 4: Compare (Updated T-063 / ADR-057)
1. `web/index.html`: `#compare-demo-random-btn` (`.btn .btn-sm .btn-primary`) - Primary solid-amber in Demo mode ("Benchmark Random Query").
2. `web/index.html`: `#compare-docs-run-btn` (`.btn .btn-sm .btn-primary`) - Primary solid-amber in Docs mode ("Run Benchmark").
3. `web/index.html`: `#compare-options-btn` (`.btn .btn-sm .btn-ghost .compare-options-btn`) - Ghost options trigger with `sliders` icon.
4. `web/index.html`: `#compare-demo-id-btn` (`.btn .btn-sm .btn-secondary`) - Secondary button inside `#compare-options-popover` ("Benchmark ID").
5. `web/index.html`: `#compare-initial-run-btn` (`.btn .btn-secondary .mt-3`) - Secondary button in empty state.
- **Solid-amber primary buttons in Compare per visible view**: Strictly **1** in all states (Demo results: 1; Demo empty: 1; Docs results: 1; Docs empty: 1; disabled when collection has 0 items) [CONFIRMED in T-063].

#### Tab 5: Settings
1. `web/index.html:483`: `#demo-insert-random-btn` (`.btn .btn-primary .w-100`) - **Primary solid-amber #1** ("Insert").
2. `web/index.html:494`: `#demo-reset-cancel-btn` (`.btn .btn-sm .btn-outline .hidden`) - Cancel demo reset.
3. `web/index.html:495`: `#demo-reset-btn` (`.btn .btn-sm .btn-danger`) - Reset Demo Collection.
- **Solid-amber primary buttons in Settings**: **1** [CONFIRMED]

---

## 5. Form Controls Inventory

Audited in [web/css/app.css:383-430](file:///f:/Desktop/vectordb/web/css/app.css#L383-L430) and [web/index.html](file:///f:/Desktop/vectordb/web/index.html) [CONFIRMED]:

| Form Control | Location(s) | Custom Styling Applied | Native Browser Appearance Unreset | Assessment |
| :--- | :--- | :--- | :--- | :--- |
| **File Input (`<input type="file">`)** | Ask tab (`#doc-file-input`, line 75) | Font-size 12px, text-muted color | **100% native**. Renders browser default light-grey "Choose File" / "Browse" button. | **Severe visual clash** with dark UI. Needs custom file picker styling or drag-and-drop target. |
| **Number Spinners (`<input type="number">`)** | Ask (`#ask-k-input`), HNSW (`#hnsw-trace-k`, `#hnsw-trace-ef`, `#hnsw-trace-id-input`), Compare (`#compare-k-input`, `#compare-ef-input`, `#compare-demo-id-input`, `#compare-docs-k-input`, `#compare-docs-ef-input`), Settings (`#demo-dim-input`, `#demo-m-input`, `#demo-efc-input`, `#demo-random-count`) | Dark bg, border, font, focus | **Spin buttons are native**. `::-webkit-inner-spin-button`, `::-webkit-outer-spin-button`, and Firefox `-moz-appearance: textfield` are not reset. | Native browser spin arrows render unstyled on hover/focus. |
| **Select Dropdowns (`<select>`)** | Header (`#doc-strategy-select`, `#ask-algo-select`, `#explore-coll-select`, `#hnsw-coll-select`, `#hnsw-max-edges-select`, `#hnsw-trace-speed`, `#compare-coll-select`, `#compare-repeat-select`, `#demo-metric-select`) | Dark bg, border, padding, radius | **`appearance: none` NOT set**. Uses default OS drop-down arrow and OS native menu. | Lacks a custom, sleek SVG chevron icon. Dropdown arrow looks dated and browser-dependent. |
| **Range Sliders (`<input type="range">`)** | HNSW (`#hnsw-layer-slider`, line 245; `#hnsw-trace-slider`, line 309) | `accent-color: var(--accent-color); width: 100%;` | **Native track and thumb**. No custom slider pseudo-elements (`::-webkit-slider-runnable-track`, `::-webkit-slider-thumb`, `::-moz-range-track`). | Plain OS track height and circular thumb. Stretches to `width: 100%` even inside inline toolbars. |
| **Text Inputs & Textareas** | Ingestion title, question input, query inputs | Dark bg, border, font, focus | `::placeholder` styling is default browser grey. | Moderate polish needed for placeholder contrast and text padding. |

---

## 6. Table Styles Inventory

Scanned from [web/css/app.css:976-1212, 1503-1555](file:///f:/Desktop/vectordb/web/css/app.css#L976-L1212) and JS table generators [CONFIRMED]:

| Table Identifier | Tab / Context | Container & Scroll | Header (`th`) Styling | Cell (`td`) Styling | Column Sizing & Alignment |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Global `.info-table`** | Base for all tables | `.table-container` (`max-height: 320px; overflow: auto;`) | 11px font-mono, uppercase, letter-spacing 0.05em, padding `8px 10px`, border-bottom 1px. **Not sticky**. | Padding `9px 10px`, font 13px, border-bottom 1px. | `td:first-child` has hardcoded `width: 40%; font-weight: 500;`. `td:last-child` has `font-family: var(--font-mono); tabular-nums;`. |
| **Explore Neighbors** | Explore sidebar (`#explore-neighbors-box`) | `.table-container` inside 320px sidebar | Inherits global `.info-table`. Not sticky. | Inherits global `9px 10px` padding. | First column forced to 40% width (128px), causing long vector IDs or distance values to wrap. |
| **HNSW Topology Summary** | HNSW main (`#hnsw-info-box`) | `.info-table-container` | Inherits global `.info-table`. Not sticky. | Inherits global `9px 10px` padding. | First column 40%, second column mono numbers. |
| **HNSW Traversal Stats** | HNSW sidebar (`#hnsw-trace-stats-box`) | `.info-table-container` | Inherits global `.info-table`. Not sticky. | Inherits global `9px 10px` padding. | Key-value pairs with 40% key width. |
| **Compare Summary Metrics** | Compare sidebar (`#compare-metrics-box`) | `.table-container` (`max-height: none; overflow-x: auto;`) | 11px font-mono, uppercase. **Sticky `top: 0; background: var(--bg-primary); z-index: 2;`** | **Custom compact**: padding `4px 6px`, font-size `12px`, `white-space: nowrap;`. | `th:first-child, td:first-child` overridden to `width: auto;`. All 5 columns stay on one line. |
| **Compare Diff Table** | Compare main (`#compare-results-card`) | `.table-container` (`flex: 1; min-height: 140px; overflow: auto;`) | 11px font-mono, uppercase. **Sticky `top: 0; background: var(--bg-primary); z-index: 2;`** | Padding `9px 10px`, font 13px. | `th:first-child, td:first-child` overridden to `width: 48px; text-align: center;`. |
| **Settings Server Health** | Settings tab (`#settings-health-box table`) | No container; transformed via CSS Grid | None (table headers omitted by JS). | Display block, padding 0. Value cell has 18px mono font with 8px green status dot. | Replaced by 3-row CSS grid strip (`repeat(4, minmax(0, 1fr))`) with 1px hairlines. |

---

## 7. Empty States Inventory

Scanned across `web/index.html` and `web/js/*.js` [CONFIRMED]:

| Tab | Context | Element & Class | Exact Rendered Text / Content | Actionable CTA Included? |
| :--- | :--- | :--- | :--- | :--- |
| **Ask** | Ingested Docs list | `<div id="docs-list-container">` `<p class="text-muted empty-state">` | `"No documents ingested."` | No |
| **Ask** | Grounded Answer box | `<div id="ask-answer-box">` `<p class="text-muted empty-state">` | `"Ask a question above to see grounded answers."` | No |
| **Ask** | Retrieved Sources list | `<div id="ask-sources-container">` `<p class="text-muted empty-state">` | `"No sources retrieved yet."` | No |
| **Explore** | Variance note | `<span id="explore-variance-note" class="text-muted font-mono text-xs">` | `"Loading variance..."` | No |
| **Explore** | Empty Demo collection | `<div id="explore-empty-state" class="empty-state-box">` | `"No vectors in this collection yet."` + `<button class="btn btn-primary mt-2">` | **Yes**: `"Insert 1,000 Vectors & Explore"` button |
| **Explore** | Empty Docs collection | `<div id="explore-empty-state" class="empty-state-box">` | `"No documents ingested yet. Go to the Ask tab to add text documents."` | No button (text-only instruction) |
| **HNSW** | Graph edge summary | `<span id="hnsw-edge-summary" class="text-muted font-mono text-xs">` | `"Loading graph..."` | No |
| **HNSW** | Traversal statistics | `<div id="hnsw-trace-stats-box">` `<p class="text-muted empty-state">` | `"Run a trace above to see hop diagnostics."` | No |
| **HNSW** | Trace status announcement| `<div id="hnsw-trace-announcement" class="text-muted font-mono text-xs">` | `"Search trace ready"` | No |
| **Compare** | Empty Docs collection | `<div id="compare-empty-state" class="empty-state-box">` | `"No documents ingested yet. Add documents in the Ask tab, or switch to the Demo collection."` | No |
| **Compare** | Empty Demo collection | `<div id="compare-empty-state" class="empty-state-box">` | `"Demo collection is empty. Insert vectors in Settings, or run benchmarks on Document Chunks."` | No |
| **Compare** | Progress status | `<div id="compare-progress-status" class="text-muted font-mono text-xs">` | `"Ready to benchmark."` | No |
| **Compare** | Summary Metrics table | `<tbody id="compare-summary-tbody">` `<tr><td class="text-muted empty-state">` | `"Run a benchmark to compare algorithms."` | No |
| **Settings**| Server health loading | `<div id="settings-health-box">` `<p class="text-muted empty-state">` | `"Loading metrics..."` | No |

**Key Disparity**: Explore tab is the ONLY tab that provides a styled actionable CTA card with a primary button (`.empty-state-box`). Compare uses `.empty-state-box` with text only. Ask, HNSW, and Settings use unboxed inline paragraphs (`.empty-state`).

---

## 8. Layout & Toolbar Inventory

### 8.1 Layout Structure Per Tab
Declared in [web/css/app.css:217-250, 603-645, 983-1120, 1220-1288](file:///f:/Desktop/vectordb/web/css/app.css) [CONFIRMED]:

| Tab | Content Frame (`.app-content`) | Container Class | Left / Main Column | Right / Sidebar Column | Column Gap | Toolbar Structure |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Ask** | Max-width 1440px, padding `16px 28px 12px` | `.ask-layout` | **Sidebar** (`.ask-sidebar`, 320px) | **Main** (`.ask-main`, `flex: 1`) | **48px** | **None**. No toolbar; content starts immediately under header. |
| **Explore** | Max-width 1440px, padding `16px 28px 12px` | `.viz-layout` | **Main** (`.viz-main`, `flex: 1`, canvas) | **Sidebar** (`.viz-sidebar`, 320px) | **32px** | `.tab-toolbar` (collection select, refresh, variance note) |
| **HNSW** | Max-width 1440px, padding `16px 28px 12px` | `.viz-layout` | **Main** (`.viz-main`, `flex: 1`, canvas + topology) | **Sidebar** (`.viz-sidebar`, 320px, trace + stats) | **32px** | `.tab-toolbar` (collection, slider, max edges, refresh, summary) |
| **Compare** | Max-width 1440px, padding `16px 28px 12px` | `.viz-layout` | **Main** (`.viz-main`, `flex: 1`, bars + diff table) | **Sidebar** (`#panel-compare .viz-sidebar`, **460px**) | **32px** | `.tab-toolbar` (collection select, repeat select, disclaimer) |
| **Settings**| Max-width 1440px, padding `16px 28px 12px` | `.settings-page-header`, `.settings-strip-section`, `.settings-config-row` | Full width across all 3 vertical blocks | *(no sidebar; 3 equal columns in config row)* | 24px internal padding | **None**. Uses dedicated `.settings-page-header` with 22px h1. |

---

### 8.2 Toolbar Structure & Alignment Flaws
Audited in [web/index.html:156-168, 237-259, 326-344](file:///f:/Desktop/vectordb/web/index.html) and [web/css/app.css:1220-1254](file:///f:/Desktop/vectordb/web/css/app.css#L1220-L1254) [CONFIRMED]:

1. **Toolbar Inversion & Omission**:
   - Ask tab and Settings tab have **zero toolbar**.
   - Explore, HNSW, and Compare have a 1-line `.tab-toolbar`.
2. **Collection Select Labeling Inconsistency**:
   - Explore: `<option value="demo">Demo Vectors</option>`, `<option value="docs">Document Chunks</option>`.
   - HNSW: `<option value="demo">Demo</option>`, `<option value="docs">Docs</option>`.
   - Compare: `<option value="demo">Demo Vectors</option>`, `<option value="docs">Document Chunks</option>`.
3. **HNSW Toolbar Wrapping Flaw**:
   - In HNSW tab toolbar (`web/index.html:245`), `<input type="range" id="hnsw-layer-slider" class="input-range">` is placed inline inside `.toolbar-left`.
   - Rule `web/css/app.css:427`: `.input-range { width: 100%; }`.
   - Result: Because `.toolbar-left` has `flex-wrap: wrap`, the slider stretches to 100% width or pushes all subsequent controls (`Max Edges` select and `Refresh` button) onto a second/third wrapped row.
   - This creates the known horizontal offset where the controls in HNSW sit at $X=276\text{px}$ instead of $X=268\text{px}$ (or wrap beneath), breaking the clean horizontal toolbar line shared with Explore and Compare.
4. **Left vs Right Sidebar Inversion**:
   - In Ask tab, the navigation/ingestion sidebar is on the **LEFT** (reading column on the right).
   - In Explore, HNSW, and Compare, the canvas/results are on the **LEFT** and the controls sidebar is on the **RIGHT**.
5. **Sidebar Width Disparity**:
   - Explore: `width: 320px;`
   - HNSW: `width: 320px;`
   - Ask: `width: 320px;`
   - Compare: `width: 460px;` (widened by 140px in T-023b-2 to fit 5-column Summary Metrics).

---

## 9. Colors in Canvases Inventory

Scanned across `web/js/explore_helpers.js`, `web/js/explore.js`, `web/js/hnsw_helpers.js`, `web/js/hnsw.js`, and `web/js/compare_helpers.js` [CONFIRMED]:

| Tab / Script | Element / Role | Color Constant / Value | File & Line |
| :--- | :--- | :--- | :--- |
| **Explore** | Cluster 0 (Warm amber) | `#d9a441` | [web/js/explore_helpers.js:10](file:///f:/Desktop/vectordb/web/js/explore_helpers.js#L10) |
| | Cluster 1 (Muted sage green) | `#529b67` | [web/js/explore_helpers.js:11](file:///f:/Desktop/vectordb/web/js/explore_helpers.js#L11) |
| | Cluster 2 (Terracotta) | `#c47043` | [web/js/explore_helpers.js:12](file:///f:/Desktop/vectordb/web/js/explore_helpers.js#L12) |
| | Cluster 3 (Warm taupe) | `#9c8269` | [web/js/explore_helpers.js:13](file:///f:/Desktop/vectordb/web/js/explore_helpers.js#L13) |
| | Cluster 4 (Dusty rose) | `#a0616a` | [web/js/explore_helpers.js:14](file:///f:/Desktop/vectordb/web/js/explore_helpers.js#L14) |
| | Cluster 5 (Olive bronze) | `#849646` | [web/js/explore_helpers.js:15](file:///f:/Desktop/vectordb/web/js/explore_helpers.js#L15) |
| | Cluster 6 (Ochre sand) | `#c89f65` | [web/js/explore_helpers.js:16](file:///f:/Desktop/vectordb/web/js/explore_helpers.js#L16) |
| | Cluster 7 (Muted moss) | `#708a78` | [web/js/explore_helpers.js:17](file:///f:/Desktop/vectordb/web/js/explore_helpers.js#L17) |
| | Cluster Fallback | `#807c74` | [web/js/explore_helpers.js:25](file:///f:/Desktop/vectordb/web/js/explore_helpers.js#L25) |
| | PCA Grid / Axes Lines | `#2a2a2a` | [web/js/explore.js:118](file:///f:/Desktop/vectordb/web/js/explore.js#L118) |
| | PCA Axis Labels | `#949087` | [web/js/explore.js:126](file:///f:/Desktop/vectordb/web/js/explore.js#L126) |
| | Demo Vectors Scatter Fill | `#d9a441` | [web/js/explore.js:138](file:///f:/Desktop/vectordb/web/js/explore.js#L138) |
| | Query Radius Ring | `rgba(217, 164, 65, 0.45)` | [web/js/explore.js:147](file:///f:/Desktop/vectordb/web/js/explore.js#L147) |
| | Nearest Neighbor Ring | `#d9a441` | [web/js/explore.js:149](file:///f:/Desktop/vectordb/web/js/explore.js#L149) |
| | Query Star Fill & Stroke | Fill: `#f0ede6`, Stroke: `#0b0b0b` | [web/js/explore.js:152](file:///f:/Desktop/vectordb/web/js/explore.js#L152) |
| | Crosshair Cursor Lines | `#f0ede6` | [web/js/explore.js:159](file:///f:/Desktop/vectordb/web/js/explore.js#L159) |
| **HNSW** | Layer 0 Node Fill (Muted gray) | `#6e6a63` | [web/js/hnsw_helpers.js:9](file:///f:/Desktop/vectordb/web/js/hnsw_helpers.js#L9) |
| | Layer 1 Node Fill (Dim amber) | `#a67c2e` | [web/js/hnsw_helpers.js:10](file:///f:/Desktop/vectordb/web/js/hnsw_helpers.js#L10) |
| | Layer 2 Node Fill (Bright amber) | `#d9a441` | [web/js/hnsw_helpers.js:11](file:///f:/Desktop/vectordb/web/js/hnsw_helpers.js#L11) |
| | Layer 3+ Node Fill (Off-white) | `#f0ede6` | [web/js/hnsw_helpers.js:12](file:///f:/Desktop/vectordb/web/js/hnsw_helpers.js#L12) |
| | Active Layer Edges | `rgba(217, 164, 65, 0.45)` | [web/js/hnsw.js:117](file:///f:/Desktop/vectordb/web/js/hnsw.js#L117) |
| | Lower Layer Edges | `rgba(110, 106, 99, 0.25)` | [web/js/hnsw.js:118](file:///f:/Desktop/vectordb/web/js/hnsw.js#L118) |
| | Entry Point Node Ring | `#d9a441` | [web/js/hnsw.js:152](file:///f:/Desktop/vectordb/web/js/hnsw.js#L152) |
| | Step Trace Path Line | `#d9a441` | [web/js/hnsw.js:164](file:///f:/Desktop/vectordb/web/js/hnsw.js#L164) |
| | Trace Visited Node Fill | Current: `#d9a441`, Visited: `#e2ded6` | [web/js/hnsw.js:169](file:///f:/Desktop/vectordb/web/js/hnsw.js#L169) |
| | Trace Node Stroke | `#ffffff` | [web/js/hnsw.js:172](file:///f:/Desktop/vectordb/web/js/hnsw.js#L172) |
| | Query Star Fill & Stroke | Fill: `#f0ede6`, Stroke: `#0b0b0b` | [web/js/hnsw.js:180](file:///f:/Desktop/vectordb/web/js/hnsw.js#L180) |
| **Compare** | Brute Force Bar Swatch (Taupe) | `#9c8269` | [web/js/compare_helpers.js:6](file:///f:/Desktop/vectordb/web/js/compare_helpers.js#L6) |
| | KD-Tree Bar Swatch (Moss) | `#708a78` | [web/js/compare_helpers.js:7](file:///f:/Desktop/vectordb/web/js/compare_helpers.js#L7) |
| | HNSW Bar Swatch (Amber) | `#d9a441` | [web/js/compare_helpers.js:8](file:///f:/Desktop/vectordb/web/js/compare_helpers.js#L8) |
| | Canvas Clear Background | `#0a0a0a` | [web/js/compare_helpers.js:248](file:///f:/Desktop/vectordb/web/js/compare_helpers.js#L248) |
| | Chart Title & Value Text | `#f0ede6` | [web/js/compare_helpers.js:254](file:///f:/Desktop/vectordb/web/js/compare_helpers.js#L254) |
| | Algorithm Labels & Muted Units | `#949087` | [web/js/compare_helpers.js:255](file:///f:/Desktop/vectordb/web/js/compare_helpers.js#L255) |
| | Baseline Hairline & Sub-chart Dividers | `#2a2a2a` | [web/js/compare_helpers.js:256](file:///f:/Desktop/vectordb/web/js/compare_helpers.js#L256) |
| | Bar Fill Fallback Color | `#807c74` | [web/js/compare_helpers.js:353](file:///f:/Desktop/vectordb/web/js/compare_helpers.js#L353) |

---

## 10. Top 10 Inconsistencies

Ranked by visual and user experience impact across the application [CONFIRMED]:

### 1. Competing Solid-Amber Primary Buttons Per View
- **Selectors Involved**:
  - Ask tab: `#doc-ingest-btn.btn-primary` vs `#ask-submit-btn.btn-primary` [web/index.html:81, 124](file:///f:/Desktop/vectordb/web/index.html#L81)
  - Explore tab: `#explore-query-docs-btn.btn-primary` vs `#explore-demo-random-btn.btn-primary` vs dynamic `insertBtn.btn-primary` [web/index.html:192, 206](file:///f:/Desktop/vectordb/web/index.html#L192)
  - HNSW tab: `#hnsw-trace-random-btn.btn-primary` vs `#hnsw-trace-play-btn.btn-primary` [web/index.html:285, 298](file:///f:/Desktop/vectordb/web/index.html#L285)
  - Compare tab: `#compare-demo-random-btn.btn-primary` vs `#compare-docs-run-btn.btn-primary` [web/index.html:375, 405](file:///f:/Desktop/vectordb/web/index.html#L375)
- **Visual Impact**: **Critical**. Breaks the core UI design rule of "one primary action per view". Having two high-contrast solid-amber buttons visible simultaneously in one screen splits user attention and creates a chaotic visual hierarchy.

### 2. Fragmented Heading Hierarchy Across Tabs
- **Selectors Involved**:
  - Global Header: `.app-title` (14px, weight 600) [web/css/app.css:156](file:///f:/Desktop/vectordb/web/css/app.css#L156)
  - Settings Tab: `.settings-title` (22px, weight 500) [web/css/app.css:989](file:///f:/Desktop/vectordb/web/css/app.css#L989)
  - Ask Tab: `h2.section-title` (14px) and `h3.section-title` (14px) [web/css/app.css:312](file:///f:/Desktop/vectordb/web/css/app.css#L312)
  - Explore, HNSW, Compare Tabs: Only `h3.section-title` (14px); no `h1` or `h2` present [web/index.html:180, 266, 349](file:///f:/Desktop/vectordb/web/index.html#L180)
- **Visual Impact**: **High**. Settings feels like a polished, modern product page with a commanding 22px title and subtitle, while Explore, HNSW, and Compare appear as un-titled tool dashboards with small 14px section subheadings.

### 3. Inconsistent Tab Toolbars & Option Labels
- **Selectors Involved**:
  - Presence: `.tab-toolbar` exists in Explore, HNSW, and Compare [web/css/app.css:1220](file:///f:/Desktop/vectordb/web/css/app.css#L1220), but is completely absent in Ask and Settings.
  - Option Labels:
    - Explore (`#explore-coll-select`): `"Demo Vectors"` / `"Document Chunks"` [web/index.html:160](file:///f:/Desktop/vectordb/web/index.html#L160)
    - HNSW (`#hnsw-coll-select`): `"Demo"` / `"Docs"` [web/index.html:241](file:///f:/Desktop/vectordb/web/index.html#L241)
    - Compare (`#compare-coll-select`): `"Demo Vectors"` / `"Document Chunks"` [web/index.html:330](file:///f:/Desktop/vectordb/web/index.html#L330)
- **Visual Impact**: **High**. Switching between tabs causes toolbar jumps, and the dropdown naming for the exact same underlying collections changes inconsistently ("Demo" vs "Demo Vectors").

### 4. HNSW Toolbar Multi-Row Wrapping & Control Displacement
- **Selectors Involved**:
  - `#panel-hnsw .tab-toolbar .toolbar-left` [web/index.html:238](file:///f:/Desktop/vectordb/web/index.html#L238)
  - `#hnsw-layer-slider.input-range` [web/index.html:245](file:///f:/Desktop/vectordb/web/index.html#L245)
  - `.input-range { width: 100%; }` [web/css/app.css:427](file:///f:/Desktop/vectordb/web/css/app.css#L427)
- **Visual Impact**: **High**. The full-width range slider forces "Max Edges" and "Refresh" to wrap onto a second row, displacing controls horizontally ($X=276\text{px}$ vs $X=268\text{px}$ in Explore/Compare) and producing an awkward 3-line tall toolbar.

### 5. Inverted Sidebar Positions & Variable Sidebar Widths
- **Selectors Involved**:
  - Ask: `.ask-sidebar` (left side, width: 320px, `gap: 48px;`) [web/css/app.css:605, 613](file:///f:/Desktop/vectordb/web/css/app.css#L605)
  - Explore & HNSW: `.viz-sidebar` (right side, width: 320px, `gap: 32px;`) [web/css/app.css:1257, 1273](file:///f:/Desktop/vectordb/web/css/app.css#L1257)
  - Compare: `#panel-compare .viz-sidebar` (right side, width: 460px, `gap: 32px;`) [web/css/app.css:1494](file:///f:/Desktop/vectordb/web/css/app.css#L1494)
  - Settings: Full-width 3-column row, no sidebar [web/css/app.css:1111](file:///f:/Desktop/vectordb/web/css/app.css#L1111)
- **Visual Impact**: **High**. The primary controls alternate from left (Ask) to right (Explore/HNSW/Compare), and the right sidebar jumps from 320px to 460px on Compare, making the tab layouts feel assembled from disconnected prototypes.

### 6. Unreset Native Browser Form Controls
- **Selectors Involved**:
  - Ask File Input: `.input-file` (`#doc-file-input`) [web/css/app.css:421](file:///f:/Desktop/vectordb/web/css/app.css#L421)
  - Number Inputs: `.input-text[type="number"]` across all tabs (`::-webkit-inner-spin-button`, `::-webkit-outer-spin-button`, `-moz-appearance`)
  - Select Dropdowns: `.input-select`, `.toolbar-select` (`appearance: none` missing) [web/css/app.css:383](file:///f:/Desktop/vectordb/web/css/app.css#L383)
  - Range Sliders: `.input-range` (`::-webkit-slider-thumb`, `::-webkit-slider-runnable-track`) [web/css/app.css:426](file:///f:/Desktop/vectordb/web/css/app.css#L426)
- **Visual Impact**: **Medium-High**. The light-grey OS button on the file upload and native unstyled spin/arrow/slider controls look jarring in a dark terminal-style interface.

### 7. Inconsistent Table Density & Cell Spacing
- **Selectors Involved**:
  - Global `.info-table td`: `padding: 9px 10px; font-size: 13px;` [web/css/app.css:1197](file:///f:/Desktop/vectordb/web/css/app.css#L1197)
  - Compare Sidebar `.info-table td`: `padding: 4px 6px; font-size: 12px;` [web/css/app.css:1520](file:///f:/Desktop/vectordb/web/css/app.css#L1520)
  - Sticky Headers: Sticky on Compare (`position: sticky; top: 0; background: var(--bg-primary); z-index: 2;`) [web/css/app.css:1546](file:///f:/Desktop/vectordb/web/css/app.css#L1546), but non-sticky on Explore and HNSW tables.
  - Hardcoded Column Width: Global `.info-table td:first-child` forces `width: 40%` [web/css/app.css:1205](file:///f:/Desktop/vectordb/web/css/app.css#L1205), which breaks narrow sidebars in Explore and HNSW.
- **Visual Impact**: **Medium**. Tables in Compare feel ultra-compact and professional with sticky headers, while tables in Explore and HNSW feel overly loose and lack sticky headers.

### 8. Disparate Empty State Patterns
- **Selectors Involved**:
  - Boxed with CTA: `.empty-state-box` with `.btn-primary` (Explore) [web/css/app.css:1410](file:///f:/Desktop/vectordb/web/css/app.css#L1410)
  - Boxed without CTA: `.empty-state-box` (Compare) [web/index.html:347](file:///f:/Desktop/vectordb/web/index.html#L347)
  - Raw Paragraph: `<p class="text-muted empty-state">` (Ask, HNSW stats, Settings) [web/css/app.css:1434](file:///f:/Desktop/vectordb/web/css/app.css#L1434)
- **Visual Impact**: **Medium**. Empty states switch unpredictably between centered dark-card boxes with action buttons and plain, unstyled inline muted text.

### 9. Complete Absence of a Spacing Token System
- **Selectors Involved**:
  - `:root` declares zero spacing variables [web/css/app.css:43-84](file:///f:/Desktop/vectordb/web/css/app.css#L43-L84)
  - 136 hardcoded declarations using 47 distinct arbitrary values across `web/css/app.css` (e.g. 5px, 6px, 7px, 8px, 9px, 10px, 12px, 14px, 16px, 18px, 20px, 24px, 28px, 32px, 40px, 48px).
- **Visual Impact**: **Medium**. Elements throughout the app feel slightly out of rhythm because margins and paddings were picked by feel rather than snapped to a standard 4px/8px modular scale.

### 10. Hardcoded Colors in CSS & Canvas JavaScript
- **Selectors / Files Involved**:
  - CSS Hardcoded: `.btn-primary` (`#0b0b0b`), `.canvas-frame` (`#0a0a0a`), `.progress-track` (`#2a2a2a`), `#panel-compare .badge-success` (`#529b67`, `#132218`, `#1e402b`), swatches (`#9c8269`, `#708a78`, `#d9a441`) [web/css/app.css:455, 1301, 1380, 1440-1453](file:///f:/Desktop/vectordb/web/css/app.css#L455)
  - JS Canvas Hardcoded: `web/js/explore_helpers.js:10-17`, `web/js/hnsw_helpers.js:9-12`, `web/js/compare_helpers.js:6-8`, `web/js/explore.js:118, 152`, `web/js/hnsw.js:117, 180`.
- **Visual Impact**: **Medium-Low** (Maintenance / Consistency). Hex colors in canvas scripts and button states bypass `:root` CSS custom properties, making future theme or contrast adjustments prone to omissions.
