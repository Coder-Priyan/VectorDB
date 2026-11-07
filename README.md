# VectorDB - Semantic Search Engine

A high-performance, self-contained vector database and semantic search engine written in modern C++17.

## Overview

VectorDB is designed from the ground up for fast vector similarity search, approximate nearest neighbor indexing (KD-Tree, HNSW), offline Retrieval-Augmented Generation (RAG with Ollama), and hybrid search (BM25 + Dense Vectors with Reciprocal Rank Fusion).

### Current Features (Task 1 & Task 2)
- **Core Types & Metrics**: `SearchResult`, `VectorId`, `Metric` enum (`Cosine`, `Euclidean`, `Manhattan`) with case-insensitive string parsing.
- **Distance Module**: Raw-pointer float32 distance kernels (`cosineDistance`, `euclideanDistance`, `euclideanSquared`, `manhattanDistance`) with zero-norm safety and clamping.
- **Abstract VectorIndex Interface**: Clean polymorphic base class allowing runtime switching between indexing algorithms.
- **BruteForceIndex Baseline**: Exact nearest neighbor index with row-major contiguous memory layout (`std::vector<float>`) and bounded max-heap ($O(n \log k)$) top-$k$ retrieval with deterministic tie-breaking.
- **KdTreeIndex**: Exact nearest-neighbor k-d Tree index featuring:
  - Flat array node storage addressed by integer indices (no heap pointer overhead, cache-friendly, easily serializable).
  - Largest-spread split dimension selection (creating cubic spatial bounding boxes) and linear-time median partition via `std::nth_element`.
  - Recursive branch-and-bound nearest neighbor search with strict tie-safe pruning.
  - Normalized Euclidean mapping for exact Cosine search with dedicated zero-vector tracking.
  - Traversal statistics tracking (`nodesVisited`, `distanceComputations`).
  - Lazy rebuilding upon search.
- **Evaluation Module**: Ground truth `recallAtK` and multi-query `meanRecallAtK` evaluation metrics.
- **Dataset Helper**: Reproducible pseudo-random Gaussian vector generator using `std::mt19937`.
- **Zero-Dependency Test Harness**: Comprehensive test runner verifying numerical accuracy, edge cases, tie-breaking, and cross-checking KD-Tree against Brute Force across metrics and dimensions.
- **Benchmarks & Demos**:
  - Interactive 2D vector search demo across all three metrics.
  - Task 1 mini benchmark measuring Brute Force insertion throughput and query latency.
  - Dimension scaling benchmark ($d \in [2, 128]$) empirically demonstrating the "Curse of Dimensionality".

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
│       ├── dataset.hpp         # Synthetic dataset generator declarations
│       └── evaluation.hpp      # Recall@k and MeanRecall@k evaluation helpers
├── src/
│   ├── distance.cpp            # Distance kernels implementation
│   ├── brute_force.cpp         # BruteForceIndex implementation
│   ├── kd_tree.cpp             # KdTreeIndex implementation (flat array, median split)
│   ├── dataset.cpp             # Normal distribution vector generation
│   ├── evaluation.cpp          # Evaluation module implementation
│   └── main.cpp                # 2D demo, mini benchmark & dimension scaling benchmark
└── tests/
    ├── test_harness.hpp        # Lightweight test framework (CHECK, CHECK_NEAR, etc.)
    ├── test_main.cpp           # Test runner entry point
    ├── test_distance.cpp       # Unit tests for distance metrics
    ├── test_brute_force.cpp    # Unit & cross-check tests for BruteForceIndex
    ├── test_evaluation.cpp     # Unit tests for Recall@k metrics
    └── test_kd_tree.cpp        # Tests verifying KD-Tree against Brute Force
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
3. **KD-Tree Dimension Scaling Benchmark**: Compares KD-Tree against Brute Force across $d \in \{2, 4, 8, 16, 32, 64, 128\}$ on $n = 20,000$ vectors ($100$ queries, $k=10$), reporting build time, average query time, speedup factor, distance computation percentage, and Recall@10.

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

---

## Fallback One-Line Compilation (Without CMake)

If CMake is not available, you can compile directly using standard `g++`:

### Compile & Run Demo & Benchmarks:
```bash
g++ -std=c++17 -O3 -Wall -Wextra -Wpedantic -Iinclude src/distance.cpp src/brute_force.cpp src/kd_tree.cpp src/dataset.cpp src/evaluation.cpp src/main.cpp -o vectordb_demo.exe
./vectordb_demo.exe
```

### Compile & Run Tests:
```bash
g++ -std=c++17 -O3 -Wall -Wextra -Wpedantic -Iinclude -Itests src/distance.cpp src/brute_force.cpp src/kd_tree.cpp src/dataset.cpp src/evaluation.cpp tests/test_main.cpp tests/test_distance.cpp tests/test_brute_force.cpp tests/test_evaluation.cpp tests/test_kd_tree.cpp -o vectordb_tests.exe
./vectordb_tests.exe
```
*(On Linux or macOS, omit `.exe` from the output filename).*
