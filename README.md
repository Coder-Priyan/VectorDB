# VectorDB

A transparent vector database and Retrieval-Augmented Generation (RAG) learning platform in C++17.

---

## What it is

VectorDB is an educational vector database built from scratch in C++17 with a zero-dependency web interface. It includes exact linear scan, spatial tree partitioning, and multi-layer graph navigation alongside a transparent retrieval pipeline. Most vector databases are black boxes that hide search mechanics and generation steps behind cloud services. VectorDB runs on your local computer so you can inspect every distance evaluation, graph hop, and retrieval stage directly.

---

## What you will learn

VectorDB is structured for studying core semantic search concepts:

- Vector embeddings and distance metrics including Euclidean, Manhattan, and Cosine.
- Exact nearest neighbor retrieval using Brute Force linear scans.
- Space partitioning and median hyperplanes using flat-array KD-Trees.
- Multi-layer proximity graph routing and beam search using HNSW graphs.
- Grounded RAG pipelines with passage chunking, citation mapping, and local language model generation.

---

## Get started

Choose the installation method suited to your environment:

- [Windows native setup](docs/INSTALL_WINDOWS.md) is for developers and students building directly from source with GCC.
- [Docker setup](docs/INSTALL_DOCKER.md) is for users who want to run a pre-configured container without installing build tools.

The Explore, HNSW, and Compare tabs work on synthetic demo vectors without Ollama. Only the Ask tab requires a local Ollama model.

---

## The five tabs

The web interface provides five dedicated views:

- **Ask**: RAG workspace for document question answering. You ingest text documents, ask questions, and inspect citation snippets and retrieval timings.
- **Explore**: 2D projection canvas. It projects high-dimensional vectors onto a two-dimensional plane using matrix-free Principal Component Analysis (PCA) and displays nearest neighbors for queries.
- **HNSW**: Proximity graph inspector. You can view graph nodes by layer and trace greedy search paths across layers.
- **Compare**: Search benchmark suite. It runs a query across Brute Force, KD-Tree, and HNSW to compare latency, distance computations, and recall.
- **Settings**: System health and configuration dashboard. You can inspect server status, view persistence status, generate synthetic vectors, and reset collections.

---

## How it works

VectorDB consists of a core C++17 library, an embedded HTTP server, and a web interface written in HTML5 and ES6. All vector math, spatial indexing, and persistence routines run in local memory and disk without external package managers. For document text embeddings and question answering, the server connects over HTTP to a local Ollama daemon. The entire application runs offline with zero telemetry and zero cloud dependencies.

---

## Honest limitations

VectorDB is designed as an educational tool rather than a distributed production database:

1. **Small collection speed**: On small collections (such as 100 vectors), Brute Force is faster than HNSW. Flat arrays stay in cache and avoid graph traversal overhead. HNSW advantage grows with collection size. On random high-dimensional data the speedup can stay small even at 20,000 vectors.
2. **Local model accuracy**: Small local language models (such as Llama 3.2 3B) can hallucinate statements or misread retrieved passages.
3. **CPU generation latency**: Generating full answers through local language model inference on standard CPU hardware typically takes 10 to 30 seconds.
4. **In-memory storage by default**: Vector collections reside in RAM by default. Data resets on server restart unless you pass the data directory argument.
5. **No authentication or TLS**: The server is designed for local loopback use. It does not provide user accounts, passwords, or transport encryption.
6. **Platform status**: Windows is the developed and verified platform. Linux build and tests pass in GitHub Actions. macOS is unverified.

---

## Project layout

```text
vectordb/
├── CODE_OF_CONDUCT.md          # Contributor code of conduct
├── CONTRIBUTING.md             # Development guidelines
├── Dockerfile                  # Container build specification
├── LICENSE                     # MIT License
├── README.md                   # Project overview
├── docs/                       # Documentation
│   ├── API.md                  # REST API reference
│   ├── INSTALL_DOCKER.md       # Docker container setup guide
│   ├── INSTALL_WINDOWS.md      # Windows native setup guide
│   ├── LEARNING_GUIDE.md       # 6-module vector search curriculum
│   └── screenshots/            # UI screenshots
├── include/vectordb/           # C++ header files
├── samples/                    # Sample evaluation files and texts
├── scripts/                    # Web safety and verification scripts
├── src/                        # C++ implementation files
├── tests/                      # C++ unit tests
├── third_party/                # Header-only dependencies
└── web/                        # Browser UI assets
```

---

## Contributing and license

Contributions are welcome. Review [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before submitting changes.

VectorDB is open-source software licensed under the [MIT License](LICENSE). Copyright (c) 2026 Coder-Priyan.
