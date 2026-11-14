# Architecture

Last updated: 2026-11-12 by T-018

## 1. Directory Tree & Artifact Layout

```text
vectordb/
├── CMakeLists.txt              # Top-level build configuration (C++17, Ninja/MSVC) [CONFIRMED]
├── README.md                   # Project overview, quick start, build instructions [CONFIRMED]
├── .gitattributes              # Line ending normalization (LF) [CONFIRMED]
├── .gitignore                  # Build artifact and IDE exclusions [CONFIRMED]
├── docs/                       # Project documentation, API specs, architectural records [CONFIRMED]
│   ├── API.md                  # Complete HTTP REST API reference [CONFIRMED]
│   ├── DEMO_SCRIPT.md          # Viva presentation walkthrough script [CONFIRMED]
│   ├── KNOWN_ISSUES.md         # Detailed limitations and risk tracker [CONFIRMED]
│   └── screenshots/            # Pre-rendered high-DPI UI snapshots [CONFIRMED]
├── third_party/                # Vendored header-only dependencies (MIT License) [CONFIRMED]
│   ├── README.md               # Version provenance [CONFIRMED]
│   ├── httplib.h               # cpp-httplib v0.18.3 [CONFIRMED]
│   └── nlohmann/json.hpp       # nlohmann/json v3.11.3 [CONFIRMED]
├── include/vectordb/           # Public C++ interface headers [CONFIRMED]
│   ├── types.hpp               # VectorId, SearchResult, Metric enum [CONFIRMED]
│   ├── distance.hpp            # Euclidean, Cosine, Manhattan kernels [CONFIRMED]
│   ├── index.hpp               # VectorIndex abstract base class [CONFIRMED]
│   ├── brute_force.hpp         # Exact linear search index [CONFIRMED]
│   ├── kd_tree.hpp             # Flat-array KD-Tree spatial index [CONFIRMED]
│   ├── hnsw.hpp                # Hierarchical Navigable Small World index [CONFIRMED]
│   ├── collection.hpp          # Thread-safe multi-index collection manager [CONFIRMED]
│   ├── pca.hpp                 # Matrix-free 2D Principal Component Analysis [CONFIRMED]
│   ├── chunker.hpp             # UTF-8 text boundary chunking engine [CONFIRMED]
│   ├── ollama_client.hpp       # HTTP client for local Ollama daemon [CONFIRMED]
│   ├── rag.hpp                 # Offline Retrieval-Augmented Generation pipeline [CONFIRMED]
│   ├── rag_eval.hpp            # Automated evaluation harness for RAG answers [CONFIRMED]
│   ├── api.hpp                 # HTTP API serialization handlers [CONFIRMED]
│   ├── dataset.hpp             # Synthetic vector generation utilities [CONFIRMED]
│   └── evaluation.hpp          # Recall@k evaluation routines [CONFIRMED]
├── src/                        # C++ implementation files [CONFIRMED]
├── tests/                      # Automated C++ unit and integration tests [CONFIRMED]
├── web/                        # Fully offline browser SPA (HTML5/CSS3/ES6) [CONFIRMED]
│   ├── index.html              # Main application UI mounted at / [CONFIRMED]
│   ├── tests.html              # In-browser pure-logic test runner [CONFIRMED]
│   ├── css/app.css             # Dark-only Editor/Terminal stylesheet [CONFIRMED]
│   ├── fonts/                  # Local IBM Plex Sans/Mono .woff2 fonts + OFL license [CONFIRMED]
│   └── js/                     # Modular frontend controllers and helpers [CONFIRMED]
├── samples/                    # Test documents and evaluation datasets [CONFIRMED]
│   ├── vectordb_intro.txt      # Sample document on vector databases [CONFIRMED]
│   └── rag_eval_questions.json # 14 gold standard RAG evaluation questions [CONFIRMED]
├── scripts/                    # Automation and quality assurance scripts [CONFIRMED]
│   ├── check_web_safety.ps1    # AST-like pattern scanner for DOM safety and CSP [CONFIRMED]
│   └── run_benchmarks_pinned.ps1 # Core-pinned benchmark runner [CONFIRMED]
└── results/                    # CSV outputs and execution logs [CONFIRMED]
```

---

## 2. Core Modules & Responsibilities

### Core Indexing Layer (`libvectordb_core.a`)
1. **Distance Kernels (`distance.hpp`, `src/distance.cpp`)**:
   - Computes Euclidean ($L_2$), Cosine, and Manhattan ($L_1$) distance metrics [CONFIRMED: src/distance.cpp:11-85].
   - Cosine kernel includes zero-vector norm detection returning 1.0 to prevent division by zero [CONFIRMED: src/distance.cpp:44].
2. **Exact Brute-Force (`brute_force.hpp`, `src/brute_force.cpp`)**:
   - Implements `VectorIndex` via linear scan using a max-heap of capacity $k$ [CONFIRMED: src/brute_force.cpp:45].
   - Establishes exact ground truth for recall evaluations [CONFIRMED: src/evaluation.cpp:16].
3. **KD-Tree Index (`kd_tree.hpp`, `src/kd_tree.cpp`)**:
   - Flat contiguous node vector with 1-based binary heap indexing (`2*i`, `2*i+1`) [CONFIRMED: src/kd_tree.cpp:25].
   - Built via median-split with quickselect (`std::nth_element`); lazy-rebuilt upon search after dynamic insertions [CONFIRMED: src/kd_tree.cpp:70,195].
4. **HNSW Proximity Graph (`hnsw.hpp`, `src/hnsw.cpp`)**:
   - Multi-layer proximity graph implementing Malkov & Yashunin (2018) [CONFIRMED: src/hnsw.cpp:10].
   - Exponential level decay (`mL = 1 / ln(M)`), greedy upper-layer traversal, beam search at layer 0 [CONFIRMED: src/hnsw.cpp:35,160].
   - Heuristic neighbor pruning (`use_heuristic = true`) with fallback edge retention [CONFIRMED: src/hnsw.cpp:240].
5. **Collection Service Layer (`collection.hpp`, `src/collection.cpp`)**:
   - Thread-safe repository synchronizing BruteForce, KD-Tree, and HNSW indexes under a single `std::mutex` [CONFIRMED: src/collection.cpp:15].
   - Enforces dimension and metric consistency; assigns auto-incrementing `VectorId` (1-based) [CONFIRMED: src/collection.cpp:44].
6. **2D PCA Projection (`pca.hpp`, `src/pca.cpp`)**:
   - Matrix-free Principal Component Analysis using power iteration and Rayleigh quotient deflation [CONFIRMED: src/pca.cpp:20-80].
   - Projects $d$-dimensional spaces down to 2D coordinates for interactive canvas visualization [CONFIRMED: src/pca.cpp:105].
7. **Document Chunker (`chunker.hpp`, `src/chunker.cpp`)**:
   - Splits plain text into overlapping chunks respecting UTF-8 boundaries and sentence terminators (`.`, `!`, `?`, `\n`, danda `।`) [CONFIRMED: src/chunker.cpp:78].

### RAG & Evaluation Layer (`libvectordb_rag.a`)
1. **Ollama Client (`ollama_client.hpp`, `src/ollama_client.cpp`)**:
   - Embedded HTTP client communicating with local Ollama daemon via `third_party/httplib.h` [CONFIRMED: src/ollama_client.cpp:15].
   - Batches text embeddings (`/api/embed`) and streams NDJSON chat completions (`/api/chat`) [CONFIRMED: src/ollama_client.cpp:115,220].
   - Hardened against remote SSRF: rejects non-loopback URLs unless `--allow-remote-ollama` is provided [CONFIRMED: src/ollama_client.cpp:42].
2. **RAG Pipeline (`rag.hpp`, `src/rag.cpp`)**:
   - Unites text chunker, dedicated document vector collection, and Ollama client [CONFIRMED: src/rag.cpp:70].
   - Document ingestion: chunks text, generates embeddings via Ollama, and indexes chunk vectors [CONFIRMED: src/rag.cpp:102].
   - Grounded Q&A: retrieves top-$k$ context chunks, formats numbered citation prompt (`[1]`, `[2]`), and streams response tokens [CONFIRMED: src/rag.cpp:220].
3. **Evaluation Suite (`rag_eval.hpp`, `src/rag_eval.cpp`, `src/rag_eval_main.cpp`)**:
   - Evaluates response quality across prompt templates (v1, v2, v3) measuring citation presence, forbidden phrases, and refusal accuracy [CONFIRMED: src/rag_eval.cpp:30-120].
4. **Persistence Layer (`persistence.hpp`, `src/persistence.cpp`)**:
   - Versioned binary file storage (`VDBC` for collection, `VDBR` for RAG pipeline) supporting atomic writes via temp-file rename and automatic startup hydration with full index reconstruction [CONFIRMED: src/persistence.cpp:10].

### Server & Web Interface Layer
1. **REST API Server (`api.hpp`, `src/api.cpp`, `src/server_main.cpp`)**:
   - Embedded multi-threaded HTTP server exposing 30 REST endpoints and static file routes [CONFIRMED: src/server_main.cpp:230-380].
2. **Browser Single Page App (`web/`)**:
   - Zero-dependency client featuring 5 tabs: `#ask` (RAG chat), `#explore` (2D PCA), `#hnsw` (graph viewer), `#compare` (benchmarks), `#settings` (server health) rendered in a dark-only Editor/Terminal aesthetic [CONFIRMED: web/js/main.js:15-60, ADR-018, ADR-019].

---

## 3. Data Flow & Communication Topology

```text
[ Browser Web UI ] 
        │
   (HTTP/SSE)
        ▼
[ vectordb_server ] (Host & Origin validation, Content-Type enforcement)
   ├── /api/docs, /api/ask  ────────► [ RagPipeline ]
   │                                         │
   │                                         ├─ (HTTP) ──► [ Local Ollama (127.0.0.1:11434) ]
   │                                         │             (nomic-embed-text / llama3.2)
   │                                         ▼
   │                                  [ Docs Collection ] (dim=768)
   │                                         ├── BruteForceIndex
   │                                         ├── KdTreeIndex
   │                                         └── HnswIndex
   │
   └── /api/vectors, /api/search ────► [ Demo Collection ] (dim=128 default)
                                             ├── BruteForceIndex
                                             ├── KdTreeIndex
                                             └── HnswIndex
```
[CONFIRMED: src/server_main.cpp:80-150, src/rag.cpp:70-120].

---

## 4. External Services & APIs

1. **Local Ollama Daemon**:
   - Base URL: `http://127.0.0.1:11434` (configurable via `--ollama-url`) [CONFIRMED: src/server_main.cpp:32].
   - Embedding Endpoint: `POST /api/embed` (body: `{"model": "...", "input": [...]}`) [CONFIRMED: src/ollama_client.cpp:125].
   - Chat Completion Endpoint: `POST /api/chat` (streaming NDJSON; body: `{"model": "...", "messages": [...]}`) [CONFIRMED: src/ollama_client.cpp:230].
   - Status Check: `GET /api/tags` [CONFIRMED: src/ollama_client.cpp:92].
2. **Zero Cloud Dependencies**: The system runs entirely offline without external SaaS, telemetry, or remote vector stores [CONFIRMED: web/index.html:246, CMakeLists.txt].

---

## 5. Storage Schema & Concurrency Model

All storage is **in-memory only**; no database files or WAL logs are written to disk [CONFIRMED: include/vectordb/collection.hpp].

### Collection Internal State
- `vectors_`: `std::unordered_map<VectorId, std::vector<float>>` [CONFIRMED: include/vectordb/collection.hpp:172]
- `payloads_`: `std::unordered_map<VectorId, std::string>` [CONFIRMED: include/vectordb/collection.hpp:173]
- `next_id_`: `std::atomic<VectorId>` (monotonically increasing 1-based counter) [CONFIRMED: include/vectordb/collection.hpp:174]
- `version_`: `std::atomic<uint64_t>` (incremented on structural mutations) [CONFIRMED: include/vectordb/collection.hpp:175]
- `mutex_`: `mutable std::mutex` guarding all collections, indexes, and document stores [CONFIRMED: include/vectordb/collection.hpp:177]

### Document Record State (`RagPipeline`)
- `docs_`: `std::unordered_map<DocumentId, DocumentRecord>` [CONFIRMED: include/vectordb/rag.hpp:124]
- `DocumentRecord`: `id`, `title`, `text`, `chunks` (`vector<DocumentChunk>`: `chunk_index`, `vector_id`, `text`) [CONFIRMED: include/vectordb/rag.hpp:35]
- `doc_id_counter_`: `std::atomic<DocumentId>` (monotonically increasing) [CONFIRMED: include/vectordb/rag.hpp:127]

---

## 6. Environment Variables

Only two environment variable names are referenced across the codebase:
1. `PROCESSOR_IDENTIFIER`: Windows system environment variable inspected at runtime by `vectordb_demo` to capture CPU hardware identity for benchmark CSV headers [CONFIRMED: src/main.cpp:49].
2. `VECTORDB_LIVE_OLLAMA`: Test harness environment variable. If set to `"1"`, enables `LiveOllamaTest.RealOllamaIntegration`; otherwise, the test is skipped [CONFIRMED: tests/test_live_ollama.cpp:11].

