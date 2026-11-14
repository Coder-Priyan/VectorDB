# VectorDB: Semantic Search Engine

> **A transparent, offline vector database and RAG learning tool.**

VectorDB is a high-performance, offline vector database and grounded Retrieval-Augmented Generation (RAG) engine written in modern C++17. Designed as an interactive "glass-box" learning platform, VectorDB lets you inspect every stage of semantic search: vector embeddings, multi-metric distance calculations, spatial partitioning trees, multi-layer graph navigation, 2D PCA projections, and grounded citation generation.

---

## The Glass-Box Philosophy

Most vector databases and RAG frameworks operate as opaque black boxes: queries go in, answers come out, and latency or hallucination sources remain hidden.

VectorDB makes the entire pipeline visible and interactive:
- **Transparent Citations**: Every generated fact references a numbered citation (`[1]`, `[2]`) mapped directly to an exact document passage.
- **Explainability Accordions**: Inspect embed times, vector search latencies, first-token delays, and generation durations in real time.
- **Visualized Geometry**: Watch high-dimensional queries project into 2D PCA coordinate space alongside retrieved document chunks.
- **Graph Traversal Tracing**: Step through HNSW graph layers to see the exact entry points, greedy hops, and neighbor candidates examined during retrieval.
- **Algorithmic Benchmarking**: Compare Brute Force, KD-Tree, and HNSW head-to-head on the same query to observe speed vs recall trade-offs.

---

## 30-Second Quickstart

### 1. Build from Source
```bash
# Clone and build with CMake & Ninja
cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build

# Run unit tests (118 hermetic tests)
./build/vectordb_tests
```

### 2. Start the Server
```bash
# Launch server with optional persistent storage directory
./build/vectordb_server --port 8080 --data-dir ./data
```

### 3. Open the Web Interface
Open your browser and navigate to:
```
http://127.0.0.1:8080
```
*(VectorDB serves its zero-dependency web interface directly with strict CSP and zero CDN dependencies.)*

---

## Architecture

```text
               +-------------------------------------------------+
               |              Web Browser Interface              |
               | (Collapsible Sidebar, Command Palette, Glass Box)|
               +-----------------------+-------------------------+
                                       | HTTP / REST + SSE
                                       v
               +-------------------------------------------------+
               |             C++17 HTTP API Server               |
               | (Loopback Security, SSE Streaming, Persistence) |
               +-----------------------+-------------------------+
                                       |
                   +-------------------+-------------------+
                   |                                       |
                   v                                       v
     +--------------------------+            +--------------------------+
     |   Demo Collection Mgr    |            |   RAG Pipeline Service   |
     |  (Brute, KD-Tree, HNSW)  |            | (Chunker, Embed, Search) |
     +-------------+------------+            +-------------+------------+
                   |                                       |
                   v                                       v
     +--------------------------+            +--------------------------+
     |   Distance & Math Core   |            |   Local Ollama Client    |
     | (Cosine, L2, Dot, PCA)   |            | (nomic-embed, llama3.2)  |
     +--------------------------+            +--------------------------+
```

---

## Feature Matrix

| Capability | VectorDB Implementation |
| :--- | :--- |
| **Exact Search** | `BruteForceIndex` with bounded top-$k$ max-heap and deterministic tie-breaking. |
| **Spatial Indexing** | `KdTreeIndex` with median splits, branch-and-bound pruning, and Euclidean mapping. |
| **Approximate Graph (ANN)** | Malkov & Yashunin (2018) `HnswIndex` with heuristic neighbor selection and skip-list layers. |
| **Distance Metrics** | Cosine distance, Euclidean (L2), and Dot Product. |
| **Dimensionality Reduction** | Matrix-free Power Iteration PCA with Gram-Schmidt deflation (2D projections). |
| **Document Processing** | Configurable Sentence Boundary and Fixed Window chunking with UTF-8 safety. |
| **Local LLM Integration** | Non-blocking loopback client for Ollama embeddings and streaming generation. |
| **Storage & Persistence** | Atomic binary serialization (`.bin` via `.tmp` rename) with `--data-dir` support. |
| **Security & Privacy** | Strict CSP (`default-src 'self'`), zero `innerHTML`, DNS rebinding and Origin validation. |

---

## Educational Curriculum

VectorDB includes an interactive learning layer and curriculum covering 6 core modules:
1. **Vector Fundamentals**: High-dimensional coordinates and semantic embeddings.
2. **Distance Metrics**: Geometric differences between Cosine, Euclidean, and Dot Product.
3. **Space Partitioning**: How KD-Trees prune space and why the curse of dimensionality affects high dimensions.
4. **Graph-Based ANN**: Hierarchical skip-list graphs and logarithmic routing.
5. **Dimensionality Reduction**: Visualizing 768-dimensional manifolds on 2D screens with PCA.
6. **Grounded RAG**: Eliminating hallucinations through verified local citations.

See [`docs/LEARNING_GUIDE.md`](docs/LEARNING_GUIDE.md) for the complete walkthrough.

---

## Contributing

We welcome pull requests and issues! Please review our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before submitting code.

---

## License

VectorDB is open-source software licensed under the [MIT License](LICENSE).
