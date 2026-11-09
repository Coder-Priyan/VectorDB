# VectorDB - Semantic Search Engine

A high-performance, self-contained vector database and semantic search engine written in modern C++17.

## Overview

VectorDB is designed from the ground up for fast vector similarity search, approximate nearest neighbor indexing (KD-Tree, HNSW), offline Retrieval-Augmented Generation (RAG with local Ollama), and hybrid search (BM25 + Dense Vectors with Reciprocal Rank Fusion).

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
  - Server CLI flags: `--port`, `--host`, `--dim`, `--metric`, `--M`, `--efConstruction`, `--efSearch`, `--seed`, `--web-dir`, `--ollama-url`, `--embed-model`, `--chat-model`, `--rag-dim`, `--allow-remote-ollama`, `--cors-origin`.
  - Static file hosting mounting `/web` at the root URL `/`.
- **Comprehensive Test Suite**:
  - 99 registered unit & integration tests including PCA mathematical correctness, mock in-process fake Ollama server, UTF-8 safety checks, all-or-nothing ingest verification, SSE streaming callbacks, and an opt-in live test against local Ollama.

---

## Folder Structure

```
vectordb/
â”œâ”€â”€ CMakeLists.txt              # CMake build configuration (minimum 3.16)
â”œâ”€â”€ README.md                   # Project documentation and build instructions
â”œâ”€â”€ .gitignore                  # Git ignore rules for C++ and build artifacts
â”œâ”€â”€ docs/
â”‚   â””â”€â”€ API.md                  # REST API reference and curl examples
â”œâ”€â”€ third_party/                # Vendored dependencies (header-only, MIT license)
â”‚   â”œâ”€â”€ httplib.h               # cpp-httplib v0.18.3
â”‚   â””â”€â”€ nlohmann/
â”‚       â””â”€â”€ json.hpp            # nlohmann/json v3.11.3
â”œâ”€â”€ web/
â”‚   â””â”€â”€ index.html              # Web UI mounted at root URL /
â”œâ”€â”€ samples/
â”‚   â””â”€â”€ vectordb_intro.txt      # Sample document on vector databases and RAG
â”œâ”€â”€ include/
â”‚   â””â”€â”€ vectordb/
â”‚       â”œâ”€â”€ types.hpp           # VectorId, SearchResult, Metric enum & string helpers
â”‚       â”œâ”€â”€ distance.hpp        # Distance function declarations
â”‚       â”œâ”€â”€ index.hpp           # Abstract base class VectorIndex
â”‚       â”œâ”€â”€ brute_force.hpp     # BruteForceIndex declaration
â”‚       â”œâ”€â”€ kd_tree.hpp         # KdTreeIndex declaration & SearchStats
â”‚       â”œâ”€â”€ hnsw.hpp            # HnswIndex, HnswParams, HnswSearchStats & HnswGraphInfo
â”‚       â”œâ”€â”€ collection.hpp      # Collection service layer declaration
â”‚       â”œâ”€â”€ chunker.hpp         # Document chunker (Fixed & Sentence strategies)
â”‚       â”œâ”€â”€ ollama_client.hpp   # Local Ollama client (embed, chat, status)
â”‚       â”œâ”€â”€ rag.hpp             # RagPipeline declaration (ingest, retrieve, ask)
â”‚       â”œâ”€â”€ api.hpp             # HTTP REST API handler declarations
â”‚       â”œâ”€â”€ dataset.hpp         # Synthetic dataset generator declarations
â”‚       â””â”€â”€ evaluation.hpp      # Recall@k and MeanRecall@k evaluation helpers
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ distance.cpp            # Distance kernels implementation
â”‚   â”œâ”€â”€ brute_force.cpp         # BruteForceIndex implementation
â”‚   â”œâ”€â”€ kd_tree.cpp             # KdTreeIndex implementation (flat array, median split)
â”‚   â”œâ”€â”€ hnsw.cpp                # HnswIndex implementation (Malkov & Yashunin 2018)
â”‚   â”œâ”€â”€ collection.cpp          # Collection service layer implementation
â”‚   â”œâ”€â”€ chunker.cpp             # UTF-8 boundary chunker implementation
â”‚   â”œâ”€â”€ ollama_client.cpp       # Ollama HTTP API client implementation
â”‚   â”œâ”€â”€ rag.cpp                 # RagPipeline implementation
â”‚   â”œâ”€â”€ api.cpp                 # API handlers implementation (JSON serialization)
â”‚   â”œâ”€â”€ server_main.cpp         # vectordb_server executable entry point
â”‚   â”œâ”€â”€ dataset.cpp             # Normal distribution vector generation
â”‚   â”œâ”€â”€ evaluation.cpp          # Evaluation module implementation
â”‚   â””â”€â”€ main.cpp                # 2D demo, KD-Tree & HNSW benchmarks with CSV export
â”œâ”€â”€ tests/
â”‚   â”œâ”€â”€ test_harness.hpp        # Lightweight test framework (CHECK, CHECK_NEAR, etc.)
â”‚   â”œâ”€â”€ fake_ollama.hpp         # Mock in-process Ollama HTTP server for hermetic testing
â”‚   â”œâ”€â”€ test_main.cpp           # Test runner entry point
â”‚   â”œâ”€â”€ test_distance.cpp       # Unit tests for distance metrics
â”‚   â”œâ”€â”€ test_brute_force.cpp    # Unit & cross-check tests for BruteForceIndex
â”‚   â”œâ”€â”€ test_evaluation.cpp     # Unit tests for Recall@k metrics
â”‚   â”œâ”€â”€ test_kd_tree.cpp        # Tests verifying KD-Tree against Brute Force
â”‚   â”œâ”€â”€ test_hnsw.cpp           # Invariants, level distribution, and HNSW recall tests
â”‚   â”œâ”€â”€ test_collection.cpp     # Tests for Collection service layer
â”‚   â”œâ”€â”€ test_chunker.cpp        # UTF-8 safety, danda, paragraph, and overlap tests
â”‚   â”œâ”€â”€ test_ollama_client.cpp  # OllamaClient unit tests against mock server
â”‚   â”œâ”€â”€ test_rag.cpp            # RagPipeline integration tests against mock server
â”‚   â”œâ”€â”€ test_api_rag.cpp        # RAG REST API handler unit tests
â”‚   â”œâ”€â”€ test_live_ollama.cpp    # Opt-in live test against real local Ollama
â”‚   â”œâ”€â”€ test_api.cpp            # Pure JSON unit tests for API handlers
â”‚   â””â”€â”€ test_server_http.cpp    # Live HTTP server integration test on ephemeral port
â””â”€â”€ results/                    # CSV exports from hardened benchmarks
    â”œâ”€â”€ README.md               # Column schema documentation
    â”œâ”€â”€ build.csv               # Graph layer node counts and average degree
    â”œâ”€â”€ ef_sweep.csv            # efSearch vs Recall@10, latency, and QPS
    â”œâ”€â”€ m_sweep.csv             # Connectivity M vs build time, recall, and memory
    â”œâ”€â”€ dim_compare.csv         # 3-way dimension comparison (dim 8 to 128)
    â””â”€â”€ metrics.csv             # Cosine & Manhattan benchmarks
```

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
```

Navigate to `http://127.0.0.1:8080/` to access the offline browser UI. See [web/README.md](web/README.md) for UI documentation and [docs/API.md](docs/API.md) for the complete HTTP API reference.

---

## Running the Test Suite

```bash
# Run the hermetic test suite (108 tests, zero cloud/network dependency)
./build/vectordb_tests

# Run including the opt-in live test against local Ollama
VECTORDB_LIVE_OLLAMA=1 ./build/vectordb_tests
```

All 108 registered unit & integration tests pass with zero failures. Browser pure logic tests (17 unit tests) run at `http://127.0.0.1:8080/tests.html`.
