# VectorDB Learning Curriculum & Guide

VectorDB is designed as a glass-box educational platform for mastering vector search algorithms, index structures, and grounded retrieval-augmented generation (RAG).

This guide walks you through six core modules using VectorDB's interactive tools.

---

## Module 1: Vector Fundamentals & Embeddings

### Core Concepts
- **What is an embedding?** A high-dimensional vector $v \in \mathbb{R}^D$ that encodes the semantic meaning of data (such as words, paragraphs, or images).
- **Dense vs Sparse**: Dense embeddings allocate non-zero values across hundreds of continuous dimensions (e.g. 128, 768, 1536), allowing neural distance metrics to capture nuance.

### Hands-on Exercise
1. Open the **Settings** tab.
2. In the **Demo Collection** section, configure a 128-dimensional collection using the **Cosine** metric.
3. Click **Insert** to populate 100 random vectors.
4. Note how each vector is stored with a unique 64-bit ID.

---

## Module 2: Distance Metrics (Cosine, Euclidean, Dot Product)

### Mathematical Foundations
- **Cosine Distance**: $1 - \frac{u \cdot v}{\|u\|_2 \|v\|_2}$. Measures angular divergence regardless of vector magnitude.
- **Euclidean (L2) Distance**: $\sqrt{\sum_{i=1}^D (u_i - v_i)^2}$. Measures straight-line geometric distance.
- **Dot Product**: $-\sum_{i=1}^D u_i v_i$. Direction and magnitude combined; optimal for pre-normalized vectors.

### Hands-on Exercise
1. Navigate to the **Compare** tab.
2. Run a benchmark with **Cosine** metric, then switch collection config to **Euclidean**.
3. Observe how distance values and relative rankings behave under different metrics.

---

## Module 3: Space Partitioning & KD-Trees

### Algorithmic Mechanism
- A **k-d tree** is a binary space partitioning tree that cyclically splits dimensions at each level.
- During search, hyper-plane boundaries allow the tree to prune branches that cannot contain a point closer than the current $k$-th nearest candidate.
- **Curse of Dimensionality**: When $D > 30$, points become nearly equidistant, forcing search to inspect almost every leaf.

### Hands-on Exercise
1. In the **Compare** tab, benchmark **Brute Force** vs **KD-Tree** on 128-dimensional vectors.
2. Note the query latency and distance computation counts: at high dimensions, KD-Tree approaches Brute Force complexity.

---

## Module 4: Graph-Based Approximate Nearest Neighbors (HNSW)

### Algorithmic Mechanism
- **Hierarchical Navigable Small World (HNSW)** builds multi-layer proximity graphs inspired by skip-lists.
- Layer 0 contains all vectors with dense local connections. Higher layers contain exponentially fewer nodes with long-range highway edges.
- Search begins at the top entry point, greedily greedily descends through layers, and explores layer 0 with an exploration beam (`efSearch`).

### Hands-on Exercise
1. Switch to the **HNSW Graph** tab.
2. Adjust the **Layer slider** from layer 0 up to top layers to view graph sparsity.
3. Use the **Trace** feature to enter a query and observe every hop visited by the algorithm across layers.

---

## Module 5: Dimensionality Reduction (PCA)

### Mechanism & Trade-offs
- High-dimensional spaces ($D \ge 128$) cannot be visually perceived.
- **Principal Component Analysis (PCA)** finds orthogonal eigenvectors of the covariance matrix that capture maximal variance.
- Projecting vectors onto the top 2 eigenvectors yields a 2D scatter plot.
- **Trade-off**: 2D projection flattens complex manifold geometry; nearby 2D points may have higher distance in full space.

### Hands-on Exercise
1. Navigate to the **Explore (PCA)** tab.
2. Inspect the **Explained Variance** ratio at the top.
3. Enter a search query to watch the query point project into 2D and highlight nearest neighbor candidates.

---

## Module 6: Grounded Retrieval-Augmented Generation (RAG)

### The Glass-Box Architecture
- Plain LLM queries often hallucinate unsupported facts.
- Grounded RAG embeds documents into chunks, indexes chunks in HNSW, retrieves top-$k$ relevant passages, and feeds them into the generation prompt with citation rules.
- Only retrieved sources may be cited using markers like `[1]`, `[2]`.

### Hands-on Exercise
1. Open the **Ask (RAG)** tab and toggle the **Documents** drawer.
2. Click **Sample** to load the introductory text, then click **Ingest Document**.
3. Ask: *"What distance metrics does VectorDB support?"*
4. Click the citation pill `[1]` in the answer to highlight the supporting source chunk.
5. Expand the **"How this was answered"** drawer to inspect latency breakdown, 2D PCA location, and HNSW hops.

