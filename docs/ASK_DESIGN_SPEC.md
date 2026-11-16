# Ask Design Specification & Design System Contract (T-094)

**Status**: Definitive Design System Contract for VectorDB Web UI (T-094)  
**Derived From**: Pure code analysis of the verified Ask tab (`web/index.html` lines 79-226, `web/css/app.css` lines 43-133, 194-250, 370-445, 1445-2650, `web/js/ask.js`, `web/js/ui.js`, `web/js/colors.js`, `web/js/icons.js`).  
**Authority**: The Ask tab is the sole, final design authority. All earlier layouts for Explore, HNSW, Compare, and Settings are discarded and rebuilt from zero to adhere to this contract.

---

## 1. Surface Hierarchy & Depth

The design system uses strictly **3 dark matte surfaces**, eliminating artificial glow, saturated neons, heavy borders, and gradients:

| Surface Token | Hex Value | Semantic Usage in Ask Tab | Visual Role |
| :--- | :--- | :--- | :--- |
| `--bg-page` / `--bg-canvas` | `#09090b` | Global viewport background, canvas background (`app.css:51,55`) | Deepest layer; pure dark canvas |
| `--bg-panel` / `--bg-surface` | `#121215` | Chat bubbles (`.chat-bubble-user`, `.chat-bubble-assistant`), bottom composer box (`.composer-box`), suggestion chips, documents drawer (`.ask-docs-drawer`), timing tiles (`app.css:52,1616,1656,2297,2520`) | Elevated surface for primary interactive modules |
| `--bg-raised` / `--bg-elevated`| `#18181c` | Glass-box container (`.glass-box-details`), algo control pill (`.composer-algo-control`), k-control pill (`.composer-k-control`), document items (`.doc-item`), secondary buttons (`app.css:53,1753,2341,2463,2612`) | Island surface for nested controls & grouped telemetry |
| `--bg-active` | `#222228` | Hover/active states on secondary buttons, dropdown options (`app.css:54,404,2418`) | Micro-elevation on user interaction |

---

## 2. Spacing Scale

Strict 4px base spacing scale defined in `:root` (`app.css:112-121`):

| Token | Pixels | Usage in Ask Tab |
| :--- | :--- | :--- |
| `--space-1` | `4px` | Fine gaps, message action margins, chip vertical padding |
| `--space-2` | `8px` | Control pill gaps, header action gaps, timing tile flow gaps, glass-box tabs gap |
| `--space-3` | `12px` | Content padding, suggestion chip gap, composer internal gap |
| `--space-4` | `16px` | Page header vertical padding (`16px 0`), chat thread gap, composer box padding |
| `--space-5` | `20px` | Empty state bottom margin, composer bottom padding (`20px`) |
| `--space-6` | `24px` | Viewport horizontal padding (`0 24px`), empty state padding |
| `--space-7` | `32px` | Major sectional separation |
| `--space-8` | `48px` | Maximum relaxed breathing room |

---

## 3. Typography & Type Scale

* **Font Families**:
  * Sans-Serif: `"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` (`app.css:47`)
  * Monospace: `"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` (`app.css:48`) — **Strictly reserved for tabular numbers, vector IDs, coordinates, code chunks, and latency metrics**.
* **Type Scale & Weights**:
  * `--text-xs` (`12px`): Subtitles, metadata labels, timing labels, timestamps, chip text. Weight: `400` / `500`.
  * `--text-sm` (`13px`): Button text, input text, source document names, descriptions (`13.5px`). Weight: `400` / `500`.
  * `--text-base` (`14px`): Chat body text, answer prose, composer input text. Weight: `400`, `line-height: 1.6`.
  * `--text-md` (`16px`): Section titles, timing metric values. Weight: `600`.
  * `--text-lg` (`18px`): Featured latency numbers (`font-variant-numeric: tabular-nums`). Weight: `600`.
  * `--text-xl` (`22px`): Subheaders. Weight: `600`.
  * `--text-2xl` (`26px`): Page header titles (`.page-header-title`), empty state title (`26px`). Weight: `600`, `letter-spacing: -0.02em`.
* **Colors**:
  * `--text-primary` (`#f4f4f5`): Headers, user message text, primary values.
  * `--text-secondary` (`#a1a1aa`): Labels, inactive tab buttons, snippet text.
  * `--text-muted` (`#71717a`): Helper text, icons, disabled hints, metadata.
  * `--text-inverse` (`#09090b`): Text inside solid amber primary buttons.

---

## 4. Radii Scale

* `--radius-xs` (`4px`): Citation pills (`.citation-pill`), close buttons.
* `--radius-sm` (`6px`): Standard buttons (`.btn`, `.btn-sm`), control pills (`.composer-algo-control`, `.composer-k-control`), timing chips.
* `--radius-md` (`10px`): User chat bubbles (`.chat-bubble-user`), suggestion chips (`.ask-suggestion-chip`), glass-box container (`.glass-box-details`), timing items.
* `--radius-lg` (`14px`): Assistant answer bubbles (`.chat-bubble-assistant`), composer box (`.composer-box`), hero canvas frames.
* `--radius-full` (`9999px`): Status dot badges, progress meter tracks, circular avatars.

---

## 5. Buttons & Controls

* **Hierarchy**: Exactly **one `.btn-primary` amber button per view at most** (`#ask-submit-btn` in Ask). All other actions are secondary (`.btn-secondary`), ghost (`.btn-ghost`), or danger (`.btn-danger`).
* **Variants & Heights**:
  * **Primary (`.btn-primary`)**: Background `--accent` (`#d9a441`), text `#09090b` (`--text-inverse`), weight `500`/`600`. Hover: `--accent-hover` (`#e5b14e`). Height: `34px` - `36px` (padding `8px 18px`).
  * **Secondary (`.btn-secondary`)**: Background `--bg-raised` (`#18181c`), text `--text-primary` (`#f4f4f5`). Hover: `--bg-active` (`#222228`). Height: `34px` (padding `8px 14px`).
  * **Small (`.btn-sm`)**: Height `28px` - `30px` (padding `6px 10px`, font size `12px`).
  * **Ghost (`.btn-ghost`)**: Background `transparent`, text `--text-secondary` (`#a1a1aa`). Hover: `--bg-raised` (`#18181c`), text `--text-primary`.
  * **Danger (`.btn-danger`)**: Background `rgba(239, 68, 68, 0.12)`, text `#ef4444`. Hover: `rgba(239, 68, 68, 0.20)`.
* **Micro-interactions**:
  * Active press: `transform: scale(0.98)` (`app.css:380`).
  * Disabled: `opacity: 0.4; cursor: not-allowed;` (`app.css:384`).

---

## 6. Inputs, Textareas & Custom Dropdowns

* **Inputs (`.input-text`, `.input-sm`)**:
  * Background: `--bg-raised` (`#18181c`), zero borders (`border: none`).
  * Radius: `var(--radius-sm)` (`6px`).
  * Color: `--text-primary` (`#f4f4f5`).
  * Focus state: Background shifts smoothly to `--bg-active` (`#222228`), zero harsh outlines.
* **Textarea (`.composer-textarea`, `.textarea-field`)**:
  * Seamless transparent background inside elevated card (`.composer-box`).
  * Custom scrollbar (`width: 4px`, thumb `--border-subtle`).
* **Custom Dark Dropdown (`createDropdown` / `.custom-dropdown`)**:
  * Trigger: Inline button with label + rotated chevron (`transition: transform 0.15s ease`).
  * Popup: Floating elevated panel (`--bg-raised`), hairline border (`1px solid var(--border-hairline)`), radius `10px`, padding `4px`.
  * Options: Item padding `6px 10px`, radius `6px`. Hover: `--bg-active`. Selected: `--accent` text with checkmark glyph.

---

## 7. Chips, Pills & Meters

* **Citation Pill (`.citation-pill`)**:
  * Background: `--accent-tint` (`rgba(217, 164, 65, 0.12)`).
  * Text: `--accent` (`#d9a441`), weight `500`, font size `12px`.
  * Radius: `4px` (`--radius-xs`).
  * Hover: Background `--accent`, text `#09090b`.
* **Telemetry Chip (`.glass-box-chip`)**:
  * Background: `--bg-panel` (`#121215`).
  * Text: `--text-muted` (`#71717a`), font size `11px`, padding `2px 8px`.
* **Proportional Meters (`.meter-track`, `.bench-bar-track`)**:
  * Height: `4px` - `5px`, radius `9999px`, background `--bg-raised`.
  * Fill: Algorithm-coded (`--color-brute: #9c8269`, `--color-kdtree: #708a78`, `--color-hnsw: #d9a441`) or `--accent`. Transition: `width 0.3s ease`.

---

## 8. Hairlines & Divider Policy

* **Strict Restriction**: Hairline dividers are permitted **ONLY** as 1px thin separators inside tables, metric strips, drawer side boundaries, or collapsible accordion footers (`border: 1px solid var(--border-hairline)` / `rgba(255, 255, 255, 0.06)`).
* **Card Boundaries**: Cards and containers in the Ask tab do **NOT** use loud borders or neon outlines; they define depth purely through flat surface color contrast (`--bg-page` vs `--bg-panel` vs `--bg-raised`).

---

## 9. Transitions & Animations

* **Standard Transition**: `0.15s cubic-bezier(0.16, 1, 0.3, 1)` or `0.15s ease-out` on `background`, `color`, and `opacity`.
* **Accordion Disclosure**: Smooth CSS grid transition (`grid-template-rows: 0fr -> 1fr`, `0.2s ease-out`).
* **Drawer Slide**: `transform: translateX(100%) -> translateX(0)`, `0.2s cubic-bezier(0.16, 1, 0.3, 1)`.
* **Prefers-Reduced-Motion**: Explicit `@media (prefers-reduced-motion: reduce)` disables animations and transitions (`app.css:2531`).

---

## 10. Layout Centering & Anti-Void Architecture

* **The 860px Centered Column**:
  * The main interactive area of Ask (`.page-header`, `.chat-thread`, `.ask-composer-wrap`) is constrained to `max-width: 860px; margin: 0 auto; width: 100%;`.
  * When a side panel opens (Documents Drawer), the column re-centers cleanly in the remaining space (`margin-right: 380px`).
* **On-Demand / Anti-Void Policy**:
  * **Nothing is placed on screen that has nothing to show**.
  * No huge 3-column empty grids.
  * Secondary tools live in slim toolbars, collapsible glass-box disclosures, or slide-over side drawers (`.ask-docs-drawer`).
  * When there are no results, a clean, centered empty state graphic is displayed. When results arrive, content renders with natural height and scrolls internally.

---

## 11. Scroll Architecture

* **Zero Page Scroll**: Global `html` and `body` have `overflow: hidden; height: 100%;`.
* **Inner Scroll Only**:
  * Chat messages scroll inside `.chat-thread { overflow-y: auto; flex: 1; min-height: 0; }`.
  * Drawer contents scroll inside `.docs-drawer-scroll { overflow-y: auto; flex: 1; }`.
  * Source chunks scroll inside `.glass-tab-panel { overflow-y: auto; }`.
  * Custom quiet 4px scrollbars throughout (`::-webkit-scrollbar { width: 4px; }`).

---

## 12. Contract for Phases 1 to 4

1. **Phase P1 (Explore)**:
   * Header matches Ask (`.page-header` with Title "Explore", Subtitle "Interactive 2D PCA dimensionality reduction and vector space inspection", right action button for Documents/Inspector).
   * Hero centerpiece: Clean canvas viewport with calm CAD axes (perimeter ticks with backing pills), luminous points, radar reticle.
   * Controls: Slim docked toolbar or Ask-style calm control bar (k, Random Query primary button, ID search).
   * Inspector / Nearest Neighbors: On-demand slide-over drawer or bottom glass-box panel matching Ask's documents drawer and source chunk cards.
2. **Phase P2 (HNSW)**:
   * Header matches Ask (`.page-header` with Title "HNSW Graph", Subtitle "Multi-layer proximity graph topology and greedy beam search routing").
   * Hero centerpiece: Clean graph canvas with subtle hairline edges (`0.65px`, `rgba(255, 255, 255, 0.055)`), diamond entry beacons, and prominent `#1`, `#2`, `#3` trajectory steps.
   * Controls: Compact toolbar (layer slider, max edges, Random search primary button, ID trace).
   * Playback & Telemetry: Docked transport bar and on-demand slide-over drawer / glass-box telemetry panel.
3. **Phase P3 (Compare)**:
   * Header matches Ask (`.page-header` with Title "Compare", Subtitle "Multi-algorithm latency, distance computation, and recall benchmarks").
   * Layout: Calm centered 860px column matching Ask.
   * Controls: Docked composer-style control bar (collection dropdown, repeat count, semantic query / random benchmark primary button, options popover).
   * Results: Ask-style timing tiles flow (Embed -> First Token -> Generate -> Total) and comparative algorithm cards matching `.glass-box-bench-results` and `.chat-bubble-assistant`.
4. **Phase P4 (Settings)**:
   * Header matches Ask (`.page-header` with Title "Settings", Subtitle "System configuration, engine hyperparameters, and storage maintenance").
   * Layout: Calm centered 860px column matching Ask with natural vertical inner scroll.
   * Sections: Clean elevated cards (`.composer-box` / `.chat-bubble-assistant` style) for Server Telemetry, Demo Collection Hyperparameters & Ingestion, and Persistence & Danger Zone.
   * Restore `settings-start-tour-btn` (ISS-092) and preserve both two-step confirms.
