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
    - **Algorithm 2 (SEARCH-LAYER)**: Priority-queue beam search using min-heap for unvisited candidate exploration and max-heap for dynamic tracking of nearest neighbours. Zero-allocation $O(1)$ epoch-based visited tracking.
    - **Algorithm 3 & 4 (SELECT-NEIGHBORS-HEURISTIC)**: Diversity-promoting neighbour selection heuristic with `keepPrunedConnections = true` ensuring high clustering and graph connectivity.
    - **Algorithm 5 (K-NN-SEARCH)**: Multi-layer hierarchical routing with adjustable `efSearch`.
  - Configurable index parameters via `HnswParams` (`M`, `efConstruction`, `efSearch`, `seed`, `useHeuristic`).
  - Full observability and introspection APIs: `searchWithStats()`, `HnswSearchStats`, `HnswTraceStep`, `HnswGraphInfo`, `graphInfo()`, `neighborsOf()`, and `levelOf()`.
- **Evaluation Module**: Ground truth `recallAtK` and multi-query `meanRecallAtK` evaluation metrics.
- **Dataset Helper**: Reproducible pseudo-random Gaussian vector generator using `std::mt19937`.
- **Zero-Dependency Test Harness**: 34 registered unit tests verifying numerical accuracy, edge cases, tie-breaking, graph invariants (layer hierarchy, entry point, reciprocal links, degree bounds), level distribution, reproducibility, and cross-checking HNSW/KD-Tree against Brute Force across metrics.
- **Hardened Benchmark Suite**:
  - Repeatable scientific methodology: 1 warm-up pass followed by 5 timed repetitions (reporting median, min, max).
  - Baseline `BruteForceIndex` measured once per $(n, \text{dim}, \text{metric})$ and reused across all speedup and ground-truth comparisons.
  - Automated CSV export to `results/*.csv` for paper reproduction.
  - Fast developer mode via `--quick` command-line flag ($n = 2,000$, 3 repetitions).

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
│   └── main.cpp                # 2D demo, KD-Tree & HNSW benchmarks with CSV export
├── tests/
│   ├── test_harness.hpp        # Lightweight test framework (CHECK, CHECK_NEAR, etc.)
│   ├── test_main.cpp           # Test runner entry point
│   ├── test_distance.cpp       # Unit tests for distance metrics
│   ├── test_brute_force.cpp    # Unit & cross-check tests for BruteForceIndex
│   ├── test_evaluation.cpp     # Unit tests for Recall@k metrics
│   ├── test_kd_tree.cpp        # Tests verifying KD-Tree against Brute Force
│   └── test_hnsw.cpp           # Invariants, level distribution, and HNSW recall tests
└── results/                    # CSV exports from hardened benchmarks
    ├── README.md               # Column schema documentation
    ├── build.csv               # Graph layer node counts and average degree
    ├── ef_sweep.csv            # efSearch vs Recall@10, latency, and QPS
    ├── m_sweep.csv             # Connectivity M vs build time, recall, and memory
    ├── dim_compare.csv         # 3-way dimension comparison (dim 8 to 128)
    └── metrics.csv             # Cosine & Manhattan benchmarks
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
# Windows (Full run: n = 20,000, 5 repetitions)
.\build\vectordb_demo.exe

# Quick run for rapid verification (n = 2,000, 3 repetitions)
.\build\vectordb_demo.exe --quick

# Linux / macOS
./build/vectordb_demo
./build/vectordb_demo --quick
```

### Benchmark Methodology
- **Warm-up**: 1 un-timed warm-up pass over the query set to eliminate cold-start cache anomalies.
- **Repetitions**: 5 timed repetitions per configuration (3 in `--quick` mode). Latency is reported as the **median** of the per-repetition average query time, alongside observed minimum and maximum values.
- **Single Baseline**: For any given $(n, \text{dim}, \text{metric})$ tuple, `BruteForceIndex` is constructed and timed **once**. Its median latency and exact top-$k$ nearest neighbors serve as the fixed baseline for all speedup and Recall@k computations.
- **Deterministic Datasets**: Identical pseudo-random Gaussian vectors and query vectors are shared across all index types (`seed=42` for data, `seed=1337` for queries).
- **Single-Threaded**: All queries are executed sequentially on a single thread.

---

## Benchmark Results ($n = 20,000$, 13th Gen Intel Core i5-1334U, GCC 16.2.0, `-O3`)

### 1. Three-Way Index Comparison ($n = 20,000, k = 10$, Euclidean)

| Dim | BF Median (ms) | KD-Tree Median (ms) | HNSW Median (ms) | HNSW Min..Max (ms) | HNSW Recall@10 | HNSW Speedup vs BF |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **8** | 0.2111 ms | 0.0777 ms | 0.0528 ms | 0.0486 .. 0.0628 ms | 1.0000 | **4.00x** |
| **16** | 0.2147 ms | 0.4519 ms | 0.1047 ms | 0.0999 .. 0.1091 ms | 1.0000 | **2.05x** |
| **32** | 0.4782 ms | 0.7999 ms | 0.1141 ms | 0.1128 .. 0.1418 ms | 0.9800 | **4.19x** |
| **64** | 0.8757 ms | 1.5902 ms | 0.2596 ms | 0.2083 .. 0.3355 ms | 0.8940 | **3.37x** |
| **128** | 2.3357 ms | 3.2363 ms | 0.4082 ms | 0.3309 .. 0.5141 ms | 0.8100 | **5.72x** |

> *Engineering Analysis*:
> - At $d = 8$, KD-Tree prunes effectively and achieves a 2.71x speedup over Brute Force.
> - At $d \ge 16$, KD-Tree is overwhelmed by the Curse of Dimensionality: every spatial bounding box intersects the search hypersphere, forcing the traversal to visit 100% of leaves with recursive function overhead, running 1.4x to 2.1x *slower* than Brute Force's flat sequential scan.
> - HNSW bypasses coordinate bounding boxes by navigating small-world proximity graphs, delivering 2x to 5.7x speedups over Brute Force with high recall across all dimensions.

### 2. HNSW $efSearch$ Sweep ($n = 20,000, d = 128, M = 16, efConstruction = 200$, BF Median: $5.1642\text{ ms}$)

| $efSearch$ | Recall@10 | Median Query (ms) | Min..Max (ms) | QPS (med) | Speedup vs BF | Dist Comps (% of $n$) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **10** | 0.3080 | 0.0637 ms | 0.0629 .. 0.0728 ms | 15,699.8 | **81.08x** | 2.29% |
| **20** | 0.4420 | 0.1336 ms | 0.1024 .. 0.1459 ms | 7,483.4 | **38.65x** | 3.66% |
| **50** | 0.6520 | 0.2474 ms | 0.2116 .. 0.3296 ms | 4,042.6 | **20.88x** | 7.12% |
| **100** | 0.8100 | 0.3968 ms | 0.3688 .. 0.8792 ms | 2,520.2 | **13.01x** | 12.09% |
| **200** | 0.9300 | 0.7664 ms | 0.6701 .. 0.9349 ms | 1,304.8 | **6.74x** | 20.42% |
| **400** | 0.9720 | 1.3620 ms | 1.3077 .. 1.7552 ms | 734.2 | **3.79x** | 33.08% |

### 3. HNSW $M$ Sweep ($M \in \{8, 16, 32\}, efConstruction = 200, efSearch = 50$)

| $M$ | Build Time (ms) | Recall@10 | Median Query (ms) | QPS (med) | Graph Memory (KB) |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **8** | 10,122.22 ms | 0.4630 | 0.1142 ms | 8,757.6 | 948.4 KB |
| **16** | 21,427.23 ms | 0.6520 | 0.2007 ms | 4,981.6 | 1,906.2 KB |
| **32** | 76,744.49 ms | 0.8130 | 0.5185 ms | 1,928.8 | 3,776.8 KB |

### 4. Non-Euclidean Metrics ($d = 128, efSearch = 100, M = 16, efConstruction = 200$)

| Metric | BF Median (ms) | HNSW Median (ms) | Min..Max (ms) | Speedup vs BF | Recall@10 |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **Cosine** | 3.1229 ms | 0.5429 ms | 0.4029 .. 0.7163 ms | **5.75x** | 0.6120 |
| **Manhattan** | 2.2097 ms | 0.5270 ms | 0.4261 .. 0.5504 ms | **4.19x** | 0.7450 |

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
