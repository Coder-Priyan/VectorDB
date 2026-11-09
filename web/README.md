# VectorDB Web UI

A modern, fully offline browser interface for the **VectorDB** C++17 semantic search engine and RAG pipeline.

Built strictly with vanilla HTML5, CSS3 (custom properties, responsive flexbox/grid), and ES modules without external build tools, bundlers, npm packages, CDNs, or remote fonts.

---

## Architecture & Security

- **Strict Content Security Policy (CSP)**:
  ```html
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self';">
  ```
- **Zero-innerHTML Sanitization**: Server responses, document titles, chunk texts, and LLM-generated tokens are treated as untrusted data and rendered strictly as DOM text nodes (`textContent`, `document.createTextNode`) or SVG/CSSOM attributes.
- **Robust SSE Streaming Parser (`web/js/sse.js`)**: Survives network packet boundaries, comments, and UTF-8 multibyte characters split across chunks using `TextDecoder({ stream: true })`.
- **Accessible & Responsive**: Keyboard-navigable tabs (`role="tablist"` / `role="tab"` / `role="tabpanel"`), aria-live announcement regions, and responsive CSS down to 360px viewport width.
- **Theme Support**: Seamless dark and light themes respecting `prefers-color-scheme` with manual toggle stored in `localStorage`.
- **Deep-Linking via Hash Routing**: Direct URL hash navigation (`#ask`, `#explore`, `#hnsw`, `#settings`, and `#compare`).

---

## Directory Structure

```
web/
├── css/
│   └── app.css              # Theme CSS custom properties, responsive layout, components
├── js/
│   ├── api.js               # Universal fetch wrapper with timeout, JSON error parsing & busy states
│   ├── sse.js               # Streaming SSE parser with split-chunk & multi-byte UTF-8 preservation
│   ├── ui.js                # DOM element builders, formatters, and accessible tab controller
│   ├── canvas.js            # Affine 2D Viewport transformations, zoom/pan & Retina DPR scaling
│   ├── ask.js               # Grounded Q&A (RAG) controller, document ingestion & SSE streaming
│   ├── settings.js          # Server health, configuration, and demo collection management
│   ├── explore_helpers.js   # Pure logic: hit-testing, palette mapping, bounds calculation
│   ├── explore.js           # 2D PCA vector map controller, zoom/pan, query star & neighbor table
│   ├── hnsw_helpers.js      # Pure logic: playback state machine, layer colors, trace mapping
│   ├── hnsw.js              # HNSW graph layer visualizer, offscreen buffering & search-path animator
│   ├── main.js              # Application entry point, theme bootstrapper & Ollama poller
│   └── tests/
│       ├── framework.js     # Lightweight assertion and suite framework
│       ├── test_core.js     # Core logic tests: SSE, Viewport2D, citations, formatters
│       ├── test_explore_hnsw.js # Explore & HNSW pure logic tests: hit-test, state machine, trace mapping
│       └── all_tests.js     # Hermetic browser unit test aggregator & DOM runner (32 tests)
├── index.html               # Main single-page application shell
├── tests.html               # Browser-run unit test runner
└── README.md                # Web UI documentation
```

---

## Running the Web UI

Start the C++ server with `--web-dir web`:

```bash
# Start server with default port 8080 and web-dir mounted
./build/vectordb_server --web-dir web

# Or with custom port and RAG prompt version
./build/vectordb_server --port 8080 --web-dir web --rag-prompt v2
```

Open `http://127.0.0.1:8080/` in any modern web browser.
Deep-linking is supported via hash routing: `#ask`, `#explore`, `#hnsw`, `#settings` (and later `#compare`).

---

## Tab Overview & Roadmap

| Tab | Status | Capabilities |
|---|---|---|
| **Ask (RAG)** | **Functional (Part 1)** | Document ingestion (plain text, `.txt`, `.md` up to 2 MB), chunk inspection, live SSE token streaming (`POST /api/ask/stream`), interactive citation pills `[1]`, thinking notices, and timing metrics. |
| **Settings** | **Functional (Part 1)** | Server status inspection (`/api/health`, `/api/config`, `/api/stats`), demo collection reset, and random vector insertion. |
| **Explore** | **Functional (Part 2)** | Interactive 2D PCA vector projection scatter map with zoom/pan, double-click fit, 8px hit-testing with tooltip, color per document with palette legend, text/vector nearest-neighbor query visualization with query star and neighbor distance lines, side-by-side results table, and empty states. |
| **HNSW** | **Functional (Part 2)** | Proximity graph visualizer across hierarchy layers $0\dots\text{max\_level}$, edge truncation selector ($2000, 10000, 20000, 60000$) with warning banner, offscreen canvas edge buffering for performance, entry point indicator, graph summary statistics, and animated search-path tracing (`POST /api/hnsw/trace`) with play/pause/step/seek/speed playback controls, aria-live step announcer, and graceful handling of visited nodes missing from PCA projection. |
| **Compare** | Planned (Part 3) | Multi-algorithm benchmark comparison across Brute Force, KD-Tree, and HNSW with latency distribution charts. |

---

## Running Unit Tests

Navigate to `http://127.0.0.1:8080/tests.html` in your browser.

The page executes 32 hermetic pure logic unit tests across 8 suites:
1. `SSE Parser (sse.js)`: Single events, split chunk boundaries, multi-byte UTF-8 preservation, comment ignoring, and unknown event handling.
2. `2D Canvas Viewport (canvas.js)`: Algebraic invertibility between data coordinates and screen pixels, zoom scale centering, pan offsets, and degenerate bound handling.
3. `UI & Citation Safety (ui.js)`: Regex token splitting for citations (`[1]`, `[2]`), DOM text node injection security against XSS.
4. `Formatting & Math Helpers (ui.js)`: Median calculations (odd/even arrays), byte formatting, latency duration formatting, and similarity percentages.
5. `Hit-Testing (explore_helpers.js)`: Exact coordinate matching, 8px threshold detection, out-of-radius filtering, and empty point list safety.
6. `Color & Bounds Helpers (explore_helpers.js)`: Deterministic palette mapping with wrapping, bounds min/max calculation with degeneracies.
7. `HNSW Layer & Edge Helpers (hnsw_helpers.js)`: Layer color indexing, edge summary formatting with truncation detection, trace-to-coordinate mapping with missing node tracking.
8. `Playback State Machine (hnsw_helpers.js)`: Play/pause state transitions, step forward/backward bounds, seek, tick progression, and end-of-animation pausing.
