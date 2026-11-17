# VectorDB: Semantic Search Engine & Glass-Box Learning Platform

A transparent, offline vector database and Retrieval-Augmented Generation (RAG) learning tool.

---

## What is this and who is it for

VectorDB is an educational vector database built from scratch in C++17 with a zero-dependency web interface.

It is made for students and developers who want to learn how vector search and RAG work under the hood. Most vector databases are black boxes that hide math, graph algorithms, and retrieval steps behind cloud APIs. VectorDB runs entirely on your local computer and makes every stage visible and inspectable.

**Platform Status**: Windows is the developed and verified platform. Linux build and tests pass in GitHub Actions. macOS is unverified.

---

## What You Will Learn

VectorDB lets you inspect and experiment with core semantic search concepts:

- **Vector Embeddings**: How text turns into high-dimensional numerical coordinates.
- **Spatial Search (Brute Force and KD-Tree)**: How exact linear scans compare against spatial trees that divide space with hyperplanes, and why high dimensions degrade tree pruning.
- **HNSW Graph Mechanics**: How Hierarchical Navigable Small World graphs route queries across multiple layers using greedy hops and entry points.
- **Glass-Box RAG**: How retrieval pipelines fetch context passages, calculate chunk similarity, format numbered citation prompts (`[1]`, `[2]`), and stream answers from a local language model.

---

## Setup in 5 Minutes (Windows)

### Prerequisites
- Windows 10 or 11
- CMake 3.16+
- Ninja build system
- C++17 compiler (GCC via MSYS2 UCRT64 or MSVC 2019+)

### Build and Run
Open PowerShell in the project root directory and run these commands:

```powershell
# 1. Configure CMake (Release mode, Ninja generator)
cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Release

# 2. Compile all targets
cmake --build build

# 3. Run automated C++ test suite (118 registered tests)
.\build\vectordb_tests.exe

# 4. Start REST API server with embedded static Web UI
.\build\vectordb_server.exe --port 8080 --web-dir web
```

Open your web browser and go to:
```text
http://127.0.0.1:8080
```

To enable persistence across server restarts, pass the `--data-dir` argument:
```powershell
.\build\vectordb_server.exe --port 8080 --web-dir web --data-dir ./data
```

---

## Run with Docker (optional)

If you prefer containers, you can build and run VectorDB with Docker:

```bash
docker build -t vectordb .
docker run --rm -p 127.0.0.1:8080:8080 -v vectordb-data:/data vectordb
```

Then open your browser and go to:
```text
http://localhost:8080/
```

Always publish the port with `127.0.0.1:8080:8080` (never plain `8080:8080`). Inside the container the server listens on `0.0.0.0`, which turns off the loopback Host check, so the host port must stay loopback-only.

The **Explore**, **HNSW**, and **Compare** tabs work in Docker without Ollama.

The **Ask** tab inside Docker is untested, may need adjustment. It requires extra setup: the container must reach Ollama on the host via `--ollama-url http://host.docker.internal:11434` and `--allow-remote-ollama`, and Ollama on the host must accept outside connections via `OLLAMA_HOST`.

**Verification**: The Docker image builds and starts in GitHub Actions (Linux). It has not been run on the author's own machine.

---

## Ollama Setup

**Important**: The **Explore**, **HNSW**, and **Compare** tabs work on synthetic Demo vectors **WITHOUT Ollama**. You do not need Ollama to study vector search algorithms.

Only the **Ask** tab (RAG question answering) requires Ollama.

If you want to use the Ask tab:
1. Install [Ollama](https://ollama.com/) on your computer.
2. Make sure the Ollama service is running (`http://127.0.0.1:11434`).
3. Open a terminal and pull the required models:
```bash
ollama pull nomic-embed-text
ollama pull llama3.2
```

---

## Tab Guide

The web interface has 5 tabs:

- **Ask**: RAG chat workspace. Ingest plain text documents, ask questions, and inspect citation snippets, retrieval timings, and algorithm choices.
- **Explore**: 2D projection canvas. Uses matrix-free Principal Component Analysis (PCA) to project vectors onto a 2D plane with neighbor links.
- **HNSW**: Multi-layer proximity graph viewer. View graph nodes by layer and trace search paths step by step.
- **Compare**: Algorithm benchmark suite. Runs a search query through Brute Force, KD-Tree, and HNSW on all three algorithms to compare latency, distance evaluations, and recall.
- **Settings**: System health and configuration. Inspect server status, insert random demo vectors, view memory usage, and manage local chat history.

---

## Honest Limitations

VectorDB is designed as an educational tool, not an enterprise production database:

1. **HNSW vs Brute Force on Small Data**: On small collections (such as 100 vectors), Brute Force is faster than HNSW (ISS-004). Flat arrays stay in CPU cache and avoid graph traversal overhead. HNSW's advantage grows with collection size. On random high-dimensional data the speedup can stay small even at 20,000 vectors (ISS-004).
2. **Local LLM Hallucinations**: Small local language models (like Llama 3.2 3B) can hallucinate facts or misread retrieved chunks (ISS-001).
3. **CPU Generation Latency**: On standard CPU hardware, generating full answers through local LLM inference takes 10 to 30 seconds (ISS-027).
4. **In-Memory Storage by Default**: Collections are stored in RAM by default. If you stop the server without `--data-dir`, data is reset on next run.
5. **No Authentication or TLS**: The server is designed for local loopback use (`127.0.0.1`). There are no user accounts, passwords, or HTTPS encryption (ISS-007).

---

## Project Layout

```text
vectordb/
├── CMakeLists.txt              # CMake build configuration (C++17)
├── LICENSE                     # MIT License
├── README.md                   # Project overview and instructions
├── include/vectordb/           # C++ public interface headers
│   ├── brute_force.hpp         # Exact linear search index
│   ├── kd_tree.hpp             # Contiguous array KD-Tree index
│   ├── hnsw.hpp                # Hierarchical Navigable Small World index
│   ├── collection.hpp          # Multi-index collection manager
│   ├── pca.hpp                 # Matrix-free 2D PCA projection
│   ├── chunker.hpp             # UTF-8 sentence boundary chunking
│   ├── ollama_client.hpp       # Local Ollama HTTP client
│   └── rag.hpp                 # Grounded RAG pipeline
├── src/                        # C++ implementation files
│   ├── server_main.cpp         # HTTP server entry point
│   ├── main.cpp                # CLI demo benchmark executable
│   └── ...
├── tests/                      # Automated C++ unit tests (118 tests)
├── third_party/                # Vendored single headers (httplib.h, json.hpp)
├── web/                        # Zero-dependency browser interface
│   ├── index.html              # Single page application
│   ├── tests.html              # In-browser unit test runner
│   ├── css/app.css             # Theme stylesheet
│   └── js/                     # Frontend ES6 JavaScript modules
├── docs/                       # Project documentation
│   ├── ARCHITECTURE.md         # Architecture and data flow
│   ├── DECISIONS.md            # Architectural Decision Records (ADRs)
│   ├── KNOWN_ISSUES.md         # Issue and risk tracker
│   └── LEARNING_GUIDE.md       # 6-module vector search curriculum
└── scripts/
    └── check_web_safety.ps1    # Automated DOM security and CSP scanner
```

---

## License

VectorDB is open-source software licensed under the [MIT License](LICENSE). Copyright (c) 2026 Coder-Priyan.
