# VectorDB - Semantic Search Engine

A high-performance, self-contained vector database and semantic search engine written in modern C++17.

## Overview

VectorDB is designed from the ground up for fast vector similarity search, approximate nearest neighbor indexing (KD-Tree, HNSW), and offline Retrieval-Augmented Generation (RAG with local Ollama).

## Roadmap (Not Implemented Yet)

The following architectural capabilities are planned for future versions but are currently not implemented:
- **Hybrid Search**: BM25 inverted index combined with dense vector retrieval using Reciprocal Rank Fusion (RRF).
- **Reranking**: Second-stage cross-encoder re-scoring of top-$k$ retrieved chunks.
- **Persistence**: On-disk serialization, snapshotting, and recovery (currently collection data is strictly in-memory).
- **Delete & Update Operations**: Dynamic vector removal and in-place vector modification across index structures.

### Current Features (Tasks 1â€“6a)
- **Core Types & Metrics**: `SearchResult`, `VectorId`, `Metric` enum (`Cosine`, `Euclidean`, `Manhattan`) with case-insensitive string parsing.
- **Distance Module**: Raw-pointer float32 distance kernels (`cosineDistance`, `euclideanDistance`, `euclideanSquared`, `manhattanDistance`) with zero-norm safety and clamping.
- **Abstract VectorIndex Interface**: Clean polymorphic base class allowing runtime switching between indexing algorithms.
- **BruteForceIndex Baseline**: Exact nearest neighbor index with row-major contiguous memory layout (`std::vector<float>`) and bounded max-heap ($O(n \log k)$) top-$k$ retrieval with deterministic tie-breaking.
- **KdTreeIndex (Exact Spatial Index)**:
  - Flat array node storage addressed by integer indices (no heap pointer overhead, cache-friendly, serializable).
  - Largest-spread split dimension selection (creating cubic spatial bounding boxes) and linear-time median partition via `std::nth_element`.
  - Recursive branch-and-bound nearest neighbor search with strict tie-safe pruning.
  - Normalized Euclidean mapping for exact Cosine search with dedicated zero-vector tracking.
  - Traversal statistics tracking (`nodesVisited`, `distanceComputations`).
  - Lazy rebuilding upon search.
- **HnswIndex (Hierarchical Navigable Small World - Approximate ANN Index)**:
  - Complete faithful implementation of Malkov & Yashunin (2018):
    - **Algorithm 1 (INSERT)**: Multi-layer exponential skip-list insertion with greedy descent down to insertion level, followed by candidate expansion with `efConstruction` and bidirectional edge linking.
    - **Algorithm 2 (SEARCH-LAYER)**: Priority-queue beam search using min-heap for unvisited candidate exploration and max-heap for dynamic tracking of nearest neighbours. Zero-allocation $O(1)$ epoch-based visited tracking.
    - **Algorithm 3 & 4 (SELECT-NEIGHBORS-HEURISTIC)**: Diversity-promoting neighbour selection heuristic with `keepPrunedConnections = true` ensuring high clustering and graph connectivity.
    - **Algorithm 5 (K-NN-SEARCH)**: Multi-layer hierarchical routing with adjustable `efSearch`.
  - Configurable index parameters via `HnswParams` (`M`, `efConstruction`, `efSearch`, `seed`, `useHeuristic`).
  - Full observability and introspection APIs: `searchWithStats()`, `HnswSearchStats`, `HnswTraceStep`, `HnswGraphInfo`, `graphInfo()`, `neighborsOf()`, and `levelOf()`.
- **Principal Component Analysis (`vectordb::fitPca`, `vectordb::projectPca`)**:
  - Deterministic 2D dimensionality reduction using power iteration with Gram-Schmidt deflation.
  - Matrix-free computation: evaluates $C v = \frac{1}{n-1} X_c^T (X_c v)$ in $O(n \cdot d)$ per iteration without forming the $d \times d$ covariance matrix.
  - Consistent sign convention (coordinate of largest absolute magnitude is positive).
  - Row-normalization support for Cosine metric.
  - Robust handling of degenerate datasets ($n \le 1$, zero variance) returning canonical axes without NaNs.
- **Collection Service Layer (`vectordb::Collection`)**:
  - Unified manager maintaining synchronized `BruteForceIndex`, `KdTreeIndex`, and `HnswIndex` instances.
  - Integrated payload store (`std::unordered_map<VectorId, std::string>`) for opaque metadata JSON.
  - Monotonic collection version counter (`version()`) for cache invalidation.
  - Bulk vector export (`exportVectors()`) with ascending ID ordering and 20,000 safety cap.
  - Layer-by-layer HNSW graph adjacency export (`hnswLayerGraph()`) with deduplicated undirected edges.
  - Thread-safe public API protected by `std::mutex`.
  - Automatic `efSearch` temporary override and RAII restoration during query execution.
  - Multi-algorithm simultaneous query benchmarking with ground-truth recall and microsecond latency measurement.
- **Document Chunker (`vectordb::chunkText`)**:
  - `Fixed` and `Sentence` chunking strategies with configurable window size (`maxChars`) and overlap (`overlapChars`).
  - Strict UTF-8 character boundary snapping: never splits multi-byte code points (supports Hindi, accented characters, emojis).
  - Sentence splitting on `. ! ?`, Devanagari danda (`\xE0\xA5\x84` / `U+0964`), and blank line paragraph breaks (`\n\n`).
  - Long sentence hard-splitting and consecutive 0-based indexing.
- **Ollama Client (`vectordb::OllamaClient`)**:
  - Fully offline local client with loopback enforcement (`127.0.0.1`, `localhost`, `::1`) unless `allowRemote` is explicitly enabled.
  - Batch embedding via `/api/embed` with automatic `nomic-embed-text` task prefixes (`search_document: ` / `search_query: `) and single-retry error resilience.
  - Streaming NDJSON chat completion parser (`/api/chat`) with incremental line buffering across network chunks and early token cancellation (`onToken`).
  - Non-throwing reachability and model presence inspection (`status()`).
- **Offline RAG Pipeline (`vectordb::RagPipeline`)**:
  - Self-contained pipeline uniting Chunker, dedicated document Collection, and Ollama.
  - All-or-nothing document ingestion: embeddings must succeed before any chunks are committed.
  - Grounded question answering citing numbered context excerpts (`[1]`, `[2]`), prompt defense against indirect instruction injection, and deterministic empty index short-circuiting.
  - Strict lock discipline: mutexes are never held while awaiting Ollama HTTP communication.
- **REST API Server (`vectordb_server`)**:
  - Embedded HTTP server built with vendored `cpp-httplib` and `nlohmann/json`.
  - 28 endpoints covering collection management, vector operations, HNSW topology inspection, document ingestion, semantic search, benchmarking, RAG question answering, PCA projections, and real-time SSE token streaming (`/api/ask/stream`).
  - Security hardening:
    - Host header DNS rebinding protection on loopback (HTTP 403 `forbidden_host`).
    - Origin header validation against loopback origins and `--cors-origin` (HTTP 403 `forbidden_origin`).
    - Content-Type enforcement (`application/json` required for POST and requests with body, HTTP 415 `unsupported_media_type`).
    - Same-origin CORS by default with optional `--cors-origin <origin>`.
  - Server CLI flags: 17 command-line flags including `--port`, `--host`, `--dim`, `--metric`, `--M`, `--efConstruction`, `--efSearch`, `--seed`, `--web-dir`, `--ollama-url`, `--embed-model`, `--chat-model`, `--rag-dim`, `--rag-prompt` (v1|v2|v3), `--allow-remote-ollama`, `--cors-origin`, and `--help`.
  - Static file hosting mounting `/web` at the root URL `/`.
- **Comprehensive Test Suite**:
  - 110 registered C++ unit & integration tests in `vectordb_tests.exe` (1 test, `LiveOllamaTest.RealOllamaIntegration`, is skipped unless `VECTORDB_LIVE_OLLAMA=1` is set).
  - 55 browser unit tests in `web/tests.html` across 13 test suites testing the SSE parser, 2D canvas viewport, request builders, citation parsing, hit-testing, and HNSW/Compare logic helpers.

---

## Folder Structure

`
vectordb/
├── CMakeLists.txt              # CMake build configuration (minimum 3.16)
├── README.md                   # Project documentation and build instructions
├── .gitignore                  # Git ignore rules for C++ and build artifacts
├── .gitattributes              # Git line ending normalization (LF)
├── docs/
│   ├── API.md                  # REST API reference and curl examples
│   ├── DEMO_SCRIPT.md          # Chronological step-by-step viva presentation guide
│   └── screenshots/            # High-DPI UI screenshots (explore, hnsw, compare)
├── scripts/
│   ├── check_web_safety.ps1    # Automated scanner verifying zero unsafe DOM operations & strict CSP
│   └── run_benchmarks_pinned.ps1 # Isolated CPU core 0 high-priority benchmark harness
├── third_party/                # Vendored dependencies (header-only, MIT license)
│   ├── README.md               # Dependency versions and upstream provenance
│   ├── httplib.h               # cpp-httplib v0.18.3
│   └── nlohmann/
│       └── json.hpp            # nlohmann/json v3.11.3
├── web/                        # Offline vanilla HTML5/CSS3/ES-module web application
│   ├── index.html              # Main single-page application mounted at root URL /
│   ├── tests.html              # In-browser test runner UI
│   ├── README.md               # Web UI architecture, CSP guidelines, and accessibility notes
│   ├── css/
│   │   └── app.css             # Unified application styles, responsive layout, dark/light themes
│   └── js/
│       ├── main.js             # Application entry point, tab router, theme management
│       ├── api.js              # Typed fetch API client with timeout, error banner, and busy state
│       ├── ui.js               # Accessible tablist controller, citation parser, DOM element builder
│       ├── canvas.js           # 2D affine transformations, zoom/pan viewport, high-DPI scaling
│       ├── sse.js              # Streaming Server-Sent Events parser with chunk reassembly
│       ├── ask.js              # Grounded Q&A controller with streaming token ingestion
│       ├── explore.js          # 2D PCA projection scatter map controller
│       ├── explore_helpers.js  # Color palette generator, hit testing, bounding box math
│       ├── hnsw.js             # HNSW graph visualizer and animated traversal controller
│       ├── hnsw_helpers.js     # Edge summary formatting, layer color mapping, playback state machine
│       ├── compare.js          # Multi-algorithm benchmark comparison controller
│       ├── compare_helpers.js  # Timing statistics, canvas bar charting, ground-truth diffing
│       ├── settings.js         # Server health inspection and demo collection management
│       └── tests/              # In-browser unit test suites
│           ├── framework.js    # Lightweight browser unit testing framework
│           ├── all_tests.js    # Test aggregator and runner
│           ├── test_core.js    # Tests for SSE parser, canvas viewport, formatters, and request init
│           ├── test_explore_hnsw.js # Tests for PCA projection, HNSW helpers, and drawable guards
│           └── test_compare.js # Tests for benchmark stats and bar chart math
├── samples/
│   ├── vectordb_intro.txt      # Sample document on vector databases and RAG
│   └── rag_eval_questions.json # Evaluation question set with ground truth expectations
├── include/
│   └── vectordb/
│       ├── types.hpp           # VectorId, SearchResult, Metric enum & string helpers
│       ├── distance.hpp        # Distance function declarations
│       ├── index.hpp           # Abstract base class VectorIndex
│       ├── brute_force.hpp     # BruteForceIndex declaration
│       ├── kd_tree.hpp         # KdTreeIndex declaration & SearchStats
│       ├── hnsw.hpp            # HnswIndex, HnswParams, HnswSearchStats & HnswGraphInfo
│       ├── pca.hpp             # 2D Principal Component Analysis dimensionality reduction
│       ├── collection.hpp      # Collection service layer declaration
│       ├── chunker.hpp         # Document chunker (Fixed & Sentence strategies)
│       ├── ollama_client.hpp   # Local Ollama client (embed, chat, status)
│       ├── rag.hpp             # RagPipeline declaration (ingest, retrieve, ask)
│       ├── rag_eval.hpp        # RAG automated evaluation and answer scoring harness
│       ├── api.hpp             # HTTP REST API handler declarations
│       ├── dataset.hpp         # Synthetic dataset generator declarations
│       └── evaluation.hpp      # Recall@k and MeanRecall@k evaluation helpers
├── src/
│   ├── distance.cpp            # Distance kernels implementation
│   ├── brute_force.cpp         # BruteForceIndex implementation
│   ├── kd_tree.cpp             # KdTreeIndex implementation (flat array, median split)
│   ├── hnsw.cpp                # HnswIndex implementation (Malkov & Yashunin 2018)
│   ├── pca.cpp                 # Matrix-free PCA with power iteration and deflation
│   ├── collection.cpp          # Collection service layer implementation
│   ├── chunker.cpp             # UTF-8 boundary chunker implementation
│   ├── ollama_client.cpp       # Ollama HTTP API client implementation
│   ├── rag.cpp                 # RagPipeline implementation
│   ├── rag_eval.cpp            # RAG answer scoring and evaluation suite
│   ├── rag_eval_main.cpp       # vectordb_rag_eval executable entry point
│   ├── api.cpp                 # API handlers implementation (JSON serialization)
│   ├── server_main.cpp         # vectordb_server executable entry point
│   ├── dataset.cpp             # Normal distribution vector generation
│   ├── evaluation.cpp          # Evaluation module implementation
│   └── main.cpp                # 2D demo, KD-Tree & HNSW benchmarks with CSV export
├── tests/
│   ├── test_harness.hpp        # Lightweight test framework (CHECK, CHECK_NEAR, etc.)
│   ├── fake_ollama.hpp         # Mock in-process Ollama HTTP server for hermetic testing
│   ├── test_main.cpp           # Test runner entry point
│   ├── test_distance.cpp       # Unit tests for distance metrics
│   ├── test_brute_force.cpp    # Unit & cross-check tests for BruteForceIndex
│   ├── test_evaluation.cpp     # Unit tests for Recall@k metrics
│   ├── test_kd_tree.cpp        # Tests verifying KD-Tree against Brute Force
│   ├── test_hnsw.cpp           # Invariants, level distribution, and HNSW recall tests
│   ├── test_pca.cpp            # Unit tests for PCA projection math and edge cases
│   ├── test_collection.cpp     # Tests for Collection service layer
│   ├── test_chunker.cpp        # UTF-8 safety, danda, paragraph, and overlap tests
│   ├── test_ollama_client.cpp  # OllamaClient unit tests against mock server
│   ├── test_rag.cpp            # RagPipeline integration tests against mock server
│   ├── test_api_rag.cpp        # RAG REST API handler unit tests
│   ├── test_live_ollama.cpp    # Opt-in live test against real local Ollama
│   ├── test_api.cpp            # Pure JSON unit tests for API handlers
│   └── test_server_http.cpp    # Live HTTP server integration test on ephemeral port
└── results/                    # Benchmark outputs and automated test logs
    ├── README.md               # Column schema documentation
    ├── build.csv               # Graph layer node counts and average degree
    ├── ef_sweep.csv            # efSearch vs Recall@10, latency, and QPS
    ├── m_sweep.csv             # Connectivity M vs build time, recall, and memory
    ├── dim_compare.csv         # 3-way dimension comparison (dim 8 to 128)
    ├── metrics.csv             # Cosine & Manhattan benchmarks
    ├── rag_eval_v1.csv         # Baseline evaluation run across prompt template v1
    ├── rag_eval_v2.csv         # Optimized evaluation run across prompt template v2
    ├── rag_eval_v3.csv         # Specialized evaluation run across prompt template v3
    ├── logs/                   # Raw verification logs and curl responses
    └── official/               # Pinned official benchmark runs
        └── 2026-11-10/         # Baseline run on idle laptop (Core 0, high priority)
`

---

## Building with CMake

### Prerequisites
- C++17 compliant compiler (`g++` >= 9.0, `clang++` >= 10.0, or MSVC 2019+)
- CMake 3.16 or higher

### Build Instructions

```bash
# 1. Create build configuration (Release mode default)
cmake -B build -DCMAKE_BUILD_TYPE=Release

# 2. Compile all targets
cmake --build build
```

This compiles three executables:
1. `vectordb_demo`: Interactive 2D demo and hardened multi-algorithm benchmarks with CSV export.
2. `vectordb_server`: Multi-threaded HTTP REST API server with RAG support.
3. `vectordb_tests`: Automated unit and integration test runner.

---

## Running the REST API Server

```bash
# Default options (Port 8080, dim=128, Ollama=http://127.0.0.1:11434, rag-dim=768)
./build/vectordb_server

# Custom RAG configuration and Web UI
./build/vectordb_server --port 8080 --web-dir web --ollama-url http://127.0.0.1:11434 --embed-model nomic-embed-text --chat-model llama3.2 --rag-dim 768 --rag-prompt v2
`

### Server CLI Options

The server accepts 17 command-line arguments matching ectordb_server --help:

| Option | Argument | Default | Description |
| :--- | :--- | :--- | :--- |
| --port | <PORT> | 8080 | Port to listen on |
| --host | <HOST> | 127.0.0.1 | Host to bind to |
| --dim | <DIM> | 128 | Default vector dimension |
| --metric | <METRIC> | cosine | Metric: cosine, euclidean, manhattan |
| --M | <M> | 16 | HNSW max neighbours M |
| --efConstruction | <EFC> | 200 | HNSW construction beam size |
| --efSearch | <EFS> | 50 | HNSW search beam size |
| --seed | <SEED> | 42 | PRNG seed for HNSW levels |
| --web-dir | <DIR> | web | Static web directory to mount at / |
| --ollama-url | <URL> | http://127.0.0.1:11434 | Ollama base URL |
| --embed-model | <NAME> | 
omic-embed-text | Ollama embedding model |
| --chat-model | <NAME> | llama3.2 | Ollama chat model |
| --rag-dim | <DIM> | 768 | Embedding dimension for RAG documents |
| --rag-prompt | <v1\|v2\|v3> | 2 | RAG prompt template version |
| --allow-remote-ollama | *(flag)* | *(off)* | Allow connecting to non-loopback Ollama hosts |
| --cors-origin | <ORIGIN> | *(disabled)* | Allowed CORS origin header (same-origin only by default) |
| --help, -h | *(flag)* | | Display help message and exit |``

Navigate to `http://127.0.0.1:8080/` to access the offline browser UI. See [web/README.md](web/README.md) for UI documentation and [docs/API.md](docs/API.md) for the complete HTTP API reference.

---

## Web UI

A modern, fully offline browser UI for VectorDB built strictly with vanilla HTML5, CSS3, and ES modules without bundlers, npm, CDNs, or external fonts. Fully CSP-compliant with zero `innerHTML` usage.

### Deep-Linking Hash Routes

- `http://127.0.0.1:8080/#ask`: Grounded Question Answering (RAG) with live SSE token streaming, chunk inspection, and interactive citation cards `[1]`.
- `http://127.0.0.1:8080/#explore`: 2D PCA vector projection scatter map with zoom/pan, double-click fit, 8px hit-testing tooltip, and nearest-neighbor query star.
- `http://127.0.0.1:8080/#hnsw`: Multi-layer proximity graph topology visualizer ($0\dots\text{max\_level}$) and animated search-path step trace player.
- `http://127.0.0.1:8080/#compare`: Multi-algorithm benchmark comparison across Brute Force, KD-Tree, and HNSW with sequential repeat runs (5, 10, 20), warmup discard, canvas performance bars, and top-$k$ ground truth difference highlighting.
- `http://127.0.0.1:8080/#settings`: Server health metrics, live Ollama daemon connectivity, and demo collection management.

### Screenshots

The offline UI includes pre-rendered high-DPI screenshots in `docs/screenshots/`:
- `docs/screenshots/explore_demo.png`: 2D PCA projection scatter map for 2,000 demo vectors.
- `docs/screenshots/explore_docs.png`: 2D PCA projection of ingested document chunks with color palette legend.
- `docs/screenshots/hnsw_demo.png`: Layer 0 graph topology with 2,000 nodes and offscreen-buffered edges.
- `docs/screenshots/hnsw_docs.png`: Document collection HNSW layer graph view.
- `docs/screenshots/compare_demo.png`: Multi-algorithm benchmark comparison on 2,000 demo vectors.
- `docs/screenshots/compare_docs.png`: Document collection semantic query benchmark view.

### Automated Web Safety Scanner

Run the automated web safety scanner to verify zero unsafe DOM operations (`innerHTML`, `eval()`, inline styles/handlers) and strict CSP headers:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\check_web_safety.ps1
```

---

## Running the Test Suite

```bash
# Run the hermetic test suite (108 tests, zero cloud/network dependency)
./build/vectordb_tests

# Run including the opt-in live test against local Ollama
VECTORDB_LIVE_OLLAMA=1 ./build/vectordb_tests
```

All 108 registered unit & integration tests pass with zero failures. Browser pure logic tests (43 unit tests across 11 test suites) run at `http://127.0.0.1:8080/tests.html`.
