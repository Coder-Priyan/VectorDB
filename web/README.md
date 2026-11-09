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

---

## Directory Structure

```
web/
â”œâ”€â”€ css/
â”‚   â””â”€â”€ app.css              # Theme CSS custom properties, responsive layout, components
â”œâ”€â”€ js/
â”‚   â”œâ”€â”€ api.js               # Universal fetch wrapper with timeout, JSON error parsing & busy states
â”‚   â”œâ”€â”€ sse.js               # Streaming SSE parser with split-chunk & multi-byte UTF-8 preservation
â”‚   â”œâ”€â”€ ui.js                # DOM element builders, formatters, and accessible tab controller
â”‚   â”œâ”€â”€ canvas.js            # Affine 2D Viewport transformations, zoom/pan & Retina DPR scaling
â”‚   â”œâ”€â”€ ask.js               # Grounded Q&A (RAG) controller, document ingestion & SSE streaming
â”‚   â”œâ”€â”€ settings.js          # Server health, configuration, and demo collection management
â”‚   â”œâ”€â”€ main.js              # Application entry point, theme bootstrapper & Ollama poller
â”‚   â””â”€â”€ tests/
â”‚       â””â”€â”€ all_tests.js     # Hermetic browser unit test suite (17 tests)
â”œâ”€â”€ index.html               # Main single-page application shell
â”œâ”€â”€ tests.html               # Browser-run unit test runner
â””â”€â”€ README.md                # Web UI documentation
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

---

## Tab Overview & Roadmap

| Tab | Status | Capabilities |
|---|---|---|
| **Ask (RAG)** | **Functional (Part 1)** | Document ingestion (plain text, `.txt`, `.md` up to 2 MB), chunk inspection, live SSE token streaming (`POST /api/ask/stream`), interactive citation pills `[1]`, thinking notices, and timing metrics. |
| **Settings** | **Functional (Part 1)** | Server status inspection (`/api/health`, `/api/config`, `/api/stats`), demo collection reset, and random vector insertion. |
| **Explore** | Planned (Part 2) | Interactive 2D PCA vector projection scatter map with zoom/pan and nearest-neighbor query visualization. |
| **HNSW** | Planned (Part 2) | Multi-layer proximity graph topology visualizer and search-path hop animator. |
| **Compare** | Planned (Part 3) | Multi-algorithm benchmark comparison across Brute Force, KD-Tree, and HNSW with latency distribution charts. |

---

## Running Unit Tests

Navigate to `http://127.0.0.1:8080/tests.html` in your browser.

The page runs the 17 pure logic unit tests covering:
1. `SseParser`: Single events, split chunk boundaries, multi-byte UTF-8 preservation, comment ignoring, and unknown event handling.
2. `Viewport2D`: Algebraic invertibility between data coordinates and screen pixels, zoom scale centering, pan offsets, and degenerate bound handling.
3. `UI & Citation Safety`: Regex token splitting for citations (`[1]`, `[2]`), DOM text node injection security against XSS.
4. `Math & Formatters`: Median calculations (odd/even arrays), byte formatting, latency duration formatting, and similarity percentages.
