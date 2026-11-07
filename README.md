# VectorDB - Semantic Search Engine

A high-performance, self-contained vector database and semantic search engine written in modern C++17.

## Overview

VectorDB is designed from the ground up for fast vector similarity search, approximate nearest neighbor indexing (KD-Tree, HNSW), offline Retrieval-Augmented Generation (RAG with Ollama), and hybrid search (BM25 + Dense Vectors with Reciprocal Rank Fusion).

### Current Features (Task 1, Task 2 & Task 3)
- **Core Types & Metrics**: `SearchResult`, `VectorId`, `Metric` enum (`Cosine`, `Euclidean`, `Manhattan`) with case-insensitive string parsing.
- **Distance Module**: Raw-pointer float32 distance kernels (`cosineDistance`, `euclideanDistance`, `euclideanSquared`, `manhattanDistance`) with zero-norm safety and clamping.
- **Abstract VectorIndex Interface**: Clean polymorphic base class allowing runtime switching between indexing algorithms.
- **BruteForceIndex Baseline**: Exact nearest neighbor index with row-major contiguous memory layout (`std::vector<float>`) and bounded max-heap ($O(n \log k)$) top-$k$ retrieval with deterministic tie-breaking.
- **KdTreeIndex (Exact Spatial Index)**:
  - Flat array node storage addressed by integer indices (no heap pointer overhead, cache-friendly, easily serializable).
  - Largest-spread split dimension selection (creating cubic spatial bounding boxes) and linear-time median partition via `std::nth_element`.
  - Recursive branch-and-bound nearest neighbor search with strict tie-safe pruning.
  - Normalized Euclidean mapping for exact Cosine search with dedicated zero-vector tracking.
  - Traversal statistics tracking (`nodesVisited`, `distanceComputations`).
  - Lazy rebuilding upon search.
- **HnswIndex (Hierarchical Navigable Small World - Approximate ANN Index)**:
  - Complete faithful implementation of Malkov & Yashunin (2018):
    - **Algorithm 1 (INSERT)**: Multi-layer exponential skip-list insertion with greedy descent down to insertion level, followed by candidate expansion with `efConstruction` and bidirectional edge linking.
    - **Algorithm 2 (SEARCH-LAYER)**: Priority-queue beam search using min-heap for unvisited candidate exploration and max-heap for dynamic tracking of nearest neighbours. Fast $O(1)$ epoch-based visited tracking.
    - **Algorithm 3 & 4 (SELECT-NEIGHBORS-HEURISTIC)**: Diversity-promoting neighbour selection heuristic with `keepPrunedConnections = true` ensuring high clustering and graph connectivity.
    - **Algorithm 5 (K-NN-SEARCH)**: Multi-layer hierarchical routing with adjustable `efSearch`.
  - Configurable index parameters via `HnswParams` (`M`, `efConstruction`, `efSearch`, `seed`, `useHeuristic`).
  - Full observability and introspection APIs: `searchWithStats()`, `HnswSearchStats`, `HnswTraceStep`, `HnswGraphInfo`, `graphInfo()`, `neighborsOf()`, and `levelOf()`.
- **Evaluation Module**: Ground truth `recallAtK` and multi-query `meanRecallAtK` evaluation metrics.
- **Dataset Helper**: Reproducible pseudo-random Gaussian vector generator using `std::mt19937`.
- **Zero-Dependency Test Harness**: 34 registered unit tests verifying numerical accuracy, edge cases, tie-breaking, graph invariants (layer hierarchy, entry point, reciprocal links, degree bounds), level distribution, reproducibility, and cross-checking HNSW/KD-Tree against Brute Force across metrics.
- **Benchmarks & Demos**:
  - Interactive 2D vector search demo across all three metrics.
  - Task 1 mini benchmark measuring Brute Force insertion throughput and query latency.
  - KD-Tree dimension scaling benchmark ($d \in [2, 128]$) demonstrating the "Curse of Dimensionality".
  - HNSW Comprehensive Benchmark Suite:
    - **Section A**: Build report and graph layer distribution ($n = 20,000, d = 128$).
    - **Section B**: $efSearch$ sweep ($\{10, 20, 50, 100, 200, 400\}$) tracking Recall@10, QPS, and distance computation reduction.
    - **Section C**: $M$ sweep ($\{8, 16, 32\}$) measuring build time, recall, and memory footprints.
    - **Section D**: Three-way comparison (Brute Force vs KD-Tree vs HNSW) across dimensions $d \in \{8, 16, 32, 64, 128\}$.
    - **Section E**: Non-Euclidean metric evaluation (Cosine and Manhattan at $d = 128$).

---

## Folder Structure

```
vectordb/
├── CMakeLists.txt              # CMake build configuration (minimum 3.16)
├── README.md                   # Project documentation and build instructions
├── .gitignore                  # Git ignore rules for C++ and build artifacts
├── .gitattributes              # LF line-ending normalization
├── include/
│   └── vectordb/
│       ├── types.hpp           # VectorId, SearchResult, Metric enum & string helpers
│       ├── distance.hpp        # Distance function declarations
│       ├── index.hpp           # Abstract base class VectorIndex
│       ├── brute_force.hpp     # BruteForceIndex declaration
│       ├── kd_tree.hpp         # KdTreeIndex declaration & SearchStats
│       ├── hnsw.hpp            # HnswIndex, HnswParams, HnswSearchStats & HnswGraphInfo
│       ├── dataset.hpp         # Synthetic dataset generator declarations
│       └── evaluation.hpp      # Recall@k and MeanRecall@k evaluation helpers
├── src/
│   ├── distance.cpp            # Distance kernels implementation
│   ├── brute_force.cpp         # BruteForceIndex implementation
│   ├── kd_tree.cpp             # KdTreeIndex implementation (flat array, median split)
│   ├── hnsw.cpp                # HnswIndex implementation (Malkov & Yashunin 2018)
│   ├── dataset.cpp             # Normal distribution vector generation
│   ├── evaluation.cpp          # Evaluation module implementation
│   └── main.cpp                # 2D demo, mini benchmark, KD-Tree & HNSW benchmarks
└── tests/
    ├── test_harness.hpp        # Lightweight test framework (CHECK, CHECK_NEAR, etc.)
    ├── test_main.cpp           # Test runner entry point
    ├── test_distance.cpp       # Unit tests for distance metrics
    ├── test_brute_force.cpp    # Unit & cross-check tests for BruteForceIndex
    ├── test_evaluation.cpp     # Unit tests for Recall@k metrics
    ├── test_kd_tree.cpp        # Tests verifying KD-Tree against Brute Force
    └── test_hnsw.cpp           # Invariants, level distribution, and HNSW recall tests
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

# 2. Compile all targets (library, demo, and test suite)
cmake --build build
```

---

## Running the Demo & Benchmarks

Run the compiled `vectordb_demo` executable:

```bash
# Windows
.\build\vectordb_demo.exe

# Linux / macOS
./build/vectordb_demo
```

The executable runs:
1. **Interactive 2D Demo**: Inserts 5 unit/diagonal vectors and searches the nearest 3 neighbors across Cosine, Euclidean, and Manhattan metrics.
2. **Mini Benchmark**: Indexes 10,000 vectors of dimension 128, executes 100 queries ($k=10$), and reports build time, total search latency, average per-query latency (ms), and QPS.
3. **KD-Tree Dimension Scaling Benchmark**: Compares KD-Tree against Brute Force across $d \in \{2, 4, 8, 16, 32, 64, 128\}$ on $n = 20,000$ vectors ($100$ queries, $k=10$).
4. **HNSW Comprehensive Benchmark**:
   - **Section A**: Build report and graph layer distribution ($n = 20,000, d = 128, M = 16, efConstruction = 200$).
   - **Section B**: $efSearch$ sweep ($ef \in \{10, 20, 50, 100, 200, 400\}$) vs BruteForce ground truth ($100$ queries, $k = 10$).
   - **Section C**: $M$ sweep ($M \in \{8, 16, 32\}$) measuring build latency, query throughput, and graph memory footprint.
   - **Section D**: Three-way comparison (Brute Force vs KD-Tree vs HNSW) across dimensions $d \in \{8, 16, 32, 64, 128\}$.
   - **Section E**: Non-Euclidean metric evaluation (Cosine and Manhattan at $d = 128$).

---

## Benchmark Highlights (Empirical Results on $n = 20,000$)

### Three-Way Index Comparison ($n = 20,000, k = 10$, Euclidean)

| Dimension | Brute Force (ms) | KD-Tree (ms) | HNSW (ms) | HNSW Recall@10 | HNSW Speedup vs BF |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **8** | 0.0843 ms | 0.0414 ms | 0.1410 ms | 1.0000 | 0.59x |
| **16** | 0.5111 ms | 0.8884 ms | 0.2145 ms | 1.0000 | **2.38x** |
| **32** | 1.1450 ms | 1.8276 ms | 0.3103 ms | 0.9800 | **3.68x** |
| **64** | 2.0729 ms | 3.5797 ms | 0.1236 ms | 0.8940 | **16.76x** |
| **128** | 1.2182 ms | 2.0506 ms | 1.0102 ms | 0.8100 | **1.20x** |

> *Observation*: In low dimensions ($d \le 8$), KD-Tree pruning excels. At dimensions $d \ge 16$, KD-Tree succumbs to the Curse of Dimensionality (searching 100% of leaves with traversal overhead), while HNSW maintains sub-millisecond query latencies and strong recall.

### HNSW $efSearch$ Sweep ($n = 20,000, d = 128, M = 16, efConstruction = 200$)

| $efSearch$ | Recall@10 | Query Time (ms) | QPS | Speedup vs BF | Dist Comps (% of $n$) |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **10** | 0.3080 | 0.0652 ms | 15,344 | 41.74x | 2.29% |
| **20** | 0.4420 | 0.0904 ms | 11,065 | 30.10x | 3.66% |
| **50** | 0.6520 | 0.1377 ms | 7,262 | 19.75x | 7.12% |
| **100** | 0.8100 | 0.2291 ms | 4,365 | 11.87x | 12.09% |
| **200** | 0.9300 | 0.4739 ms | 2,110 | 5.74x | 20.42% |
| **400** | 0.9720 | 0.8764 ms | 1,141 | 3.10x | 33.08% |

---

## Running the Test Suite

Run tests via CMake's test runner `ctest`:

```bash
ctest --test-dir build --output-on-failure
```

Or execute the test binary directly for detailed test-by-test output:

```bash
# Windows
.\build\vectordb_tests.exe

# Linux / macOS
./build/vectordb_tests
```

All 34 registered unit tests pass with zero failures:
- Metric kernels & mathematical correctness
- Exact Brute Force top-$k$ and deterministic tie-breaking
- KD-Tree spatial median splits, pruning stats, and zero-vector handling
- HNSW graph construction invariants, layer hierarchy, degree caps, and seed reproducibility
- Ground truth Recall@k and MeanRecall@k evaluation across metrics

---

## Fallback One-Line Compilation (Without CMake)

If CMake is not available, you can compile directly using standard `g++`:

### Compile & Run Demo & Benchmarks:
```bash
g++ -std=c++17 -O3 -Wall -Wextra -Wpedantic -Iinclude src/distance.cpp src/brute_force.cpp src/kd_tree.cpp src/hnsw.cpp src/dataset.cpp src/evaluation.cpp src/main.cpp -o vectordb_demo.exe
./vectordb_demo.exe
```

### Compile & Run Tests:
```bash
g++ -std=c++17 -O3 -Wall -Wextra -Wpedantic -Iinclude -Itests src/distance.cpp src/brute_force.cpp src/kd_tree.cpp src/hnsw.cpp src/dataset.cpp src/evaluation.cpp tests/test_main.cpp tests/test_distance.cpp tests/test_brute_force.cpp tests/test_evaluation.cpp tests/test_kd_tree.cpp tests/test_hnsw.cpp -o vectordb_tests.exe
./vectordb_tests.exe
```
*(On Linux or macOS, omit `.exe` from the output filename).*
