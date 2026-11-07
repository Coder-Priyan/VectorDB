# VectorDB REST API Reference

The `vectordb_server` provides a clean HTTP JSON interface on top of the VectorDB C++17 engine.
All requests and responses use `Content-Type: application/json; charset=utf-8` (and `text/event-stream; charset=utf-8` for SSE streaming).

### Security Architecture
- **DNS Rebinding Protection**: When bound to loopback (`127.0.0.1`, `localhost`, `[::1]`), all incoming requests must carry a valid loopback `Host` header (`127.0.0.1:<port>`, `localhost:<port>`, `[::1]:<port>`, or port 80 equivalent). Requests with foreign or forged host headers are rejected with HTTP 403 `forbidden_host`.
- **Origin Header Validation**: If an incoming request carries an `Origin` header (sent by browsers), it must match the server's loopback origin (`http://127.0.0.1:<port>`, `http://localhost:<port>`, `http://[::1]:<port>`) or the explicit origin configured via `--cors-origin`. Foreign origins are rejected with HTTP 403 `forbidden_origin`.
- **Content-Type Enforcement**: All `POST` requests and any requests carrying a payload must specify `Content-Type: application/json`. Requests with missing or alternate media types are rejected with HTTP 415 `unsupported_media_type`.
- **Same-Origin CORS by Default**: By default, no `Access-Control-Allow-Origin` headers are emitted, enforcing browser same-origin policy. Cross-origin sharing can be enabled explicitly by starting the server with `--cors-origin <origin>`.

---

## Base URL

```
http://127.0.0.1:8080
```
*(By default, the server binds strictly to `127.0.0.1` for local-only safety).*

---

## Core Vector Endpoints

### 1. Health Check
`GET /api/health`

Verifies that the server process is alive and returns the software version.

```powershell
curl.exe -s http://127.0.0.1:8080/api/health
```

#### Response (200 OK):
```json
{
  "status": "ok",
  "version": "0.4.0"
}
```

---

### 2. Get Collection Configuration
`GET /api/config`

Returns current collection parameters (dimension, metric, HNSW parameters, and KD-Tree leaf size).

```powershell
curl.exe -s http://127.0.0.1:8080/api/config
```

#### Response (200 OK):
```json
{
  "dimension": 128,
  "metric": "cosine",
  "leafSize": 8,
  "hnsw": {
    "M": 16,
    "efConstruction": 200,
    "efSearch": 50,
    "seed": 42,
    "useHeuristic": true
  }
}
```

---

### 3. Reset Collection
`POST /api/reset`

Clears all stored vectors, metadata, and index structures. Re-initializes indexes with optional configuration overrides.

#### Request Body (optional parameters):
```json
{
  "dimension": 4,
  "metric": "euclidean",
  "hnsw": {
    "M": 32,
    "ef_construction": 100,
    "ef_search": 60
  }
}
```

```powershell
curl.exe -s -X POST http://127.0.0.1:8080/api/reset -H "Content-Type: application/json" -d "{\"\"dimension\"\": 4, \"\"metric\"\": \"\"euclidean\"\"}"
```

#### Response (200 OK):
```json
{
  "status": "ok",
  "message": "Collection reset successfully"
}
```

---

### 4. Collection Statistics
`GET /api/stats`

Returns live collection metrics.

```powershell
curl.exe -s http://127.0.0.1:8080/api/stats
```

#### Response (200 OK):
```json
{
  "count": 1000,
  "dimension": 128,
  "metric": "cosine"
}
```

---

### 5. Insert Vector
`POST /api/vectors`

Inserts a single vector with an optional explicit 64-bit ID and optional JSON metadata payload. If `id` is omitted, an auto-incrementing ID is assigned.

```powershell
curl.exe -s -X POST http://127.0.0.1:8080/api/vectors -H "Content-Type: application/json" -d "{\"\"vector\"\": [0.1, 0.2, 0.3, 0.4], \"\"metadata\"\": {\"\"tag\"\": \"\"demo\"\"}}"
```

#### Response (201 Created):
```json
{
  "id": 1
}
```

---

### 6. Batch Insert Vectors
`POST /api/vectors/batch`

Atomically inserts multiple vectors in a single request with all-or-nothing validation semantics.

```powershell
curl.exe -s -X POST http://127.0.0.1:8080/api/vectors/batch -H "Content-Type: application/json" -d "{\"\"items\"\": [{\"\"vector\"\": [1,2,3,4]}, {\"\"vector\"\": [5,6,7,8]}]}"
```

#### Response (201 Created):
```json
{
  "inserted": 2,
  "ids": [2, 3]
}
```

---

### 7. Get Vector by ID
`GET /api/vectors/:id`

Retrieves the raw float components and metadata of an indexed vector.

```powershell
curl.exe -s http://127.0.0.1:8080/api/vectors/1
```

#### Response (200 OK):
```json
{
  "id": 1,
  "vector": [0.1, 0.2, 0.3, 0.4],
  "metadata": {"tag": "demo"}
}
```

---

### 8. Nearest Neighbor Search
`POST /api/search`

Executes vector similarity search using `hnsw`, `kdtree`, or `brute` algorithm.

```powershell
curl.exe -s -X POST http://127.0.0.1:8080/api/search -H "Content-Type: application/json" -d "{\"\"vector\"\": [0.1, 0.2, 0.3, 0.4], \"\"k\"\": 5, \"\"algorithm\"\": \"\"hnsw\"\", \"\"ef\"\": 64}"
```

#### Response (200 OK):
```json
{
  "algorithm": "hnsw",
  "k": 5,
  "latency_us": 42,
  "distance_computations": 28,
  "results": [
    {
      "id": 1,
      "distance": 0.0,
      "metadata": {"tag": "demo"}
    }
  ]
}
```

---

### 9. Multi-Algorithm Benchmark
`POST /api/benchmark`

Executes the query vector across Brute Force, KD-Tree, and HNSW under identical conditions.

```powershell
curl.exe -s -X POST http://127.0.0.1:8080/api/benchmark -H "Content-Type: application/json" -d "{\"\"vector\"\": [0.1, 0.2, 0.3, 0.4], \"\"k\"\": 5}"
```

#### Response (200 OK):
```json
{
  "k": 5,
  "count": 1000,
  "ground_truth": "brute",
  "algorithms": {
    "brute": { "latency_us": 120, "distance_computations": 1000, "recall_at_k": 1.0, "results": [...] },
    "kdtree": { "latency_us": 35, "distance_computations": 140, "recall_at_k": 1.0, "results": [...] },
    "hnsw": { "latency_us": 18, "distance_computations": 45, "recall_at_k": 1.0, "results": [...] }
  }
}
```

---

### 10. Get HNSW Graph Information
`GET /api/hnsw/info`

Returns topological summary of the core HNSW index, including entry point node ID, max layer count, and total nodes registered at each level.

```powershell
curl.exe --max-time 5 -s http://127.0.0.1:8080/api/hnsw/info
```

#### Response (200 OK):
```json
{
  "entry_point": 42,
  "max_level": 3,
  "level_counts": [1000, 120, 15, 2]
}
```

---

### 11. Get HNSW Node Details
`GET /api/hnsw/node/:id`

Inspects layer assignments and neighbor adjacency lists across all active layers for a specific node ID.

```powershell
curl.exe --max-time 5 -s http://127.0.0.1:8080/api/hnsw/node/42
```

#### Response (200 OK):
```json
{
  "id": 42,
  "level": 2,
  "layers": [
    {"layer": 0, "neighbors": [10, 15, 88]},
    {"layer": 1, "neighbors": [15, 88]},
    {"layer": 2, "neighbors": [88]}
  ]
}
```

---

### 12. HNSW Search Trace
`POST /api/hnsw/trace`

Executes nearest-neighbor routing while capturing a step-by-step diagnostic trace across layers, recording every visited node, candidate distance, and layer transitions.

#### Request Body:
```json
{
  "vector": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
  "ef": 16
}
```

```powershell
curl.exe --max-time 5 -s -X POST http://127.0.0.1:8080/api/hnsw/trace -H "Content-Type: application/json" -d "{\"vector\":[0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8]}"
```

---

### 13. Demo Random Vectors
`POST /api/demo/random`

Generates and inserts $N$ random uniform vectors into the collection for rapid testing and visual benchmarking.

#### Request Body (optional parameters):
```json
{
  "count": 50
}
```

```powershell
curl.exe --max-time 5 -s -X POST http://127.0.0.1:8080/api/demo/random -H "Content-Type: application/json" -d "{\"count\": 50}"
```

#### Response (200 OK):
```json
{
  "status": "ok",
  "inserted": 50,
  "dimension": 128
}
```

---

### 14. Get Core PCA 2D Projection
`GET /api/pca?limit=5000`

Fits a 2D Principal Component Analysis (via power iteration and deflation) over the core collection's stored vectors and returns 2D coordinates `(x, y)` for every point, cached by collection version.

#### Parameters:
- `limit` *(optional, default: 5000, max: 20000)*: Maximum number of vectors to project.

```powershell
curl.exe --max-time 5 -s "http://127.0.0.1:8080/api/pca?limit=5000"
```

#### Response (200 OK):
```json
{
  "dim": 8,
  "total_variance": 0.8421,
  "explained_ratio": [0.3412, 0.2105],
  "points": [
    {
      "id": 1,
      "x": 0.452,
      "y": -0.128,
      "metadata": {"label": "sample"}
    }
  ]
}
```

---

### 15. Project Query Vector onto PCA Space
`POST /api/pca/query`

Projects an arbitrary query vector onto the cached 2D PCA subspace and executes top-$k$ nearest neighbor search, returning projected coordinates for both the query and its nearest neighbors.

```powershell
curl.exe --max-time 5 -s -X POST -H "Content-Type: application/json" -d '{
  "vector": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
  "k": 3,
  "algorithm": "hnsw"
}' http://127.0.0.1:8080/api/pca/query
```

#### Response (200 OK):
```json
{
  "query_projected": {"x": 0.367, "y": -0.004},
  "results": [
    {
      "id": 39,
      "distance": 0.204,
      "similarity": 0.796,
      "x": 0.599,
      "y": -0.338,
      "metadata": {}
    }
  ]
}
```

---

### 16. Get Core HNSW Graph Topology
`GET /api/hnsw/graph?layer=0&max_edges=20000`

Inspects the structural topology of the core HNSW multi-layer proximity graph on a specific layer, with nodes mapped to their cached 2D PCA positions and deduplicated undirected edges.

#### Parameters:
- `layer` *(optional, default: 0)*: Target layer index ($0 \le \text{layer} \le \text{maxLevel}$).
- `max_edges` *(optional, default: 20000, max: 20000)*: Maximum edges to return.

```powershell
curl.exe --max-time 5 -s "http://127.0.0.1:8080/api/hnsw/graph?layer=0"
```

#### Response (200 OK):
```json
{
  "layer": 0,
  "nodes": [
    {"id": 1, "x": -0.490, "y": 0.226}
  ],
  "edges": [
    {"source": 1, "target": 2}
  ]
}
```

---

## Offline RAG Pipeline Endpoints

The RAG pipeline provides fully offline document chunking, embedding, vector search, and grounded question answering powered by local Ollama models (`nomic-embed-text` and `llama3.2`).

---

### 17. Ollama Reachability & Status
`GET /api/ollama/status`

Inspects local Ollama instance connectivity, version, and installed model availability. Never throws.

```powershell
curl.exe -s http://127.0.0.1:8080/api/ollama/status
```

#### Response (200 OK):
```json
{
  "reachable": true,
  "version": "0.40.15",
  "models": ["llama3.2:latest", "nomic-embed-text:latest"],
  "embed_model_present": true,
  "chat_model_present": true,
  "error": ""
}
```

---

### 18. Ingest Document
`POST /api/docs`

Splits plain text into UTF-8 safe chunks, embeds all chunks using local Ollama (`nomic-embed-text`), and atomically inserts them into the document collection. Guarantees all-or-nothing semantics: if embedding fails or dimension mismatches, no document record is created and no vectors are indexed.

#### Request Body:
```json
{
  "title": "Machine Learning Primer",
  "text": "Supervised learning fits a function to labeled training examples. Unsupervised learning identifies underlying patterns.",
  "chunking": {
    "strategy": "sentence",
    "max_chars": 800,
    "overlap_chars": 100
  }
}
```

```powershell
curl.exe -s -X POST http://127.0.0.1:8080/api/docs -H "Content-Type: application/json" --data-binary "@document.json"
```

#### Response (201 Created):
```json
{
  "doc_id": 1,
  "chunks": 3,
  "dimension": 768,
  "embed_ms": 420.5
}
```

---

### 19. List Documents
`GET /api/docs`

Returns a list of all ingested documents without vector or text payloads.

```powershell
curl.exe -s http://127.0.0.1:8080/api/docs
```

#### Response (200 OK):
```json
{
  "documents": [
    {
      "id": 1,
      "title": "Machine Learning Primer",
      "bytes": 2048,
      "chunks": 3,
      "strategy": "sentence",
      "created_at": "2026-11-07T12:40:00Z"
    }
  ]
}
```

---

### 20. Get Document Details & Chunks
`GET /api/docs/:id`

Retrieves metadata and full chunk excerpts for a specific document.

```powershell
curl.exe -s http://127.0.0.1:8080/api/docs/1
```

#### Response (200 OK):
```json
{
  "id": 1,
  "title": "Machine Learning Primer",
  "bytes": 2048,
  "chunks_count": 3,
  "strategy": "sentence",
  "created_at": "2026-11-07T12:40:00Z",
  "chunks": [
    {
      "index": 0,
      "start": 0,
      "end": 280,
      "text": "Supervised learning fits a function..."
    }
  ]
}
```

---

### 21. Semantic Document Search
`POST /api/docs/search`

Embeds the textual query and retrieves the top-$k$ most relevant document chunks without calling the generative LLM.

#### Request Body:
```json
{
  "query": "What is supervised learning?",
  "k": 3,
  "algorithm": "hnsw",
  "ef": 64
}
```

```powershell
curl.exe -s -X POST http://127.0.0.1:8080/api/docs/search -H "Content-Type: application/json" --data-binary "@query.json"
```

#### Response (200 OK):
```json
{
  "query": "What is supervised learning?",
  "count": 3,
  "results": [
    {
      "doc_id": 1,
      "title": "Machine Learning Primer",
      "chunk_index": 0,
      "start": 0,
      "end": 280,
      "text": "Supervised learning fits a function to labeled training examples...",
      "distance": 0.28,
      "similarity": 0.72
    }
  ]
}
```

---

### 22. Document Collection Benchmark
`POST /api/docs/benchmark`

Embeds the query once and benchmarks Brute Force, KD-Tree, and HNSW on real 768-dimensional document embeddings.

```powershell
curl.exe -s -X POST http://127.0.0.1:8080/api/docs/benchmark -H "Content-Type: application/json" --data-binary "@bench.json"
```

#### Response (200 OK):
```json
{
  "query": "supervised learning",
  "k": 3,
  "count": 25,
  "ground_truth": "brute",
  "algorithms": {
    "brute": { "latency_us": 18, "distance_computations": 25, "recall_at_k": 1.0, "results": [...] },
    "kdtree": { "latency_us": 62, "distance_computations": 25, "recall_at_k": 1.0, "results": [...] },
    "hnsw": { "latency_us": 23, "distance_computations": 25, "recall_at_k": 1.0, "results": [...] }
  }
}
```

---

### 23. Ask Grounded Question (RAG)
`POST /api/ask`

Retrieves the top-$k$ relevant chunks, injects them into a strict grounding prompt, and queries the local LLM (`llama3.2`). Returns the generated answer along with numbered source citations (`[1]`, `[2]`). If the index is empty, immediately returns `"No documents have been ingested yet."` without invoking the LLM.

#### Request Body:
```json
{
  "question": "Who introduced KD-Trees and in what year?",
  "k": 3,
  "algorithm": "hnsw",
  "temperature": 0.0,
  "debug": true
}
```

```powershell
curl.exe --max-time 900 -s -X POST http://127.0.0.1:8080/api/ask -H "Content-Type: application/json" --data-binary "@ask.json"
```

#### Response (200 OK):
```json
{
  "answer": "According to the provided documents, Jon Louis Bentley introduced the multidimensional binary search tree (KD-Tree) in 1975 [1].",
  "sources": [
    {
      "n": 1,
      "doc_id": 1,
      "title": "Introduction to Vector Databases",
      "chunk_index": 1,
      "text": "Jon Louis Bentley introduced the multidimensional binary search tree, commonly known as the KD-Tree, in 1975.",
      "distance": 0.31,
      "similarity": 0.69
    }
  ],
  "timings": {
    "embed_ms": 142.2,
    "first_token_ms": 243.1,
    "search_ms": 0.07,
    "generate_ms": 15671.8,
    "total_ms": 15814.1
  },
  "model": "llama3.2",
  "prompt_chars": 2586,
  "prompt": "You are a careful assistant... Context:\n[1] ..."
}
```

---

### 24. Real-Time Streaming RAG Answer (SSE)
`POST /api/ask/stream`

Streams generation tokens incrementally over an HTTP chunked connection (`Content-Type: text/event-stream; charset=utf-8`) using standard Server-Sent Events format (`event: <type>\ndata: <json>\n\n`).

#### Event Progression:
1. `event: sources`: Emitted immediately after vector retrieval, before LLM generation begins.
2. `event: token`: Emitted once per generated token piece: `{"t": "Vector","token":"Vector"}`.
3. `event: done`: Emitted after stream concludes with complete answer, timings, and prompt length.
4. `event: error`: Emitted if an error occurs mid-stream.

#### Client Disconnect Handling:
If the client disconnects mid-stream (`sink.write` returns `false`), the stream aborts immediately, canceling generation in Ollama.

```powershell
curl.exe --max-time 900 -N -s -X POST -H "Content-Type: application/json" -d '{
  "question": "What is vector search?",
  "k": 3
}' http://127.0.0.1:8080/api/ask/stream
```

#### Sample Stream Output:
```
event: sources
data: {"sources":[{"chunk_index":0,"distance":0.226,"doc_id":1,"n":1,"similarity":0.774,"text":"...","title":"Introduction to Vector Databases"}]}

event: token
data: {"t":"Vector","token":"Vector"}

event: token
data: {"t":" search","token":" search"}

event: token
data: {"t":" discovers","token":" discovers"}

event: done
data: {"answer":"Vector search discovers vectors that minimize distance functions...","model":"llama3.2","prompt_chars":840,"timings":{"embed_ms":57.8,"first_token_ms":243.1,"generate_ms":14770.2,"search_ms":0.03,"total_ms":14828.2}}
```

---

### 25. Reset Documents
`POST /api/docs/reset`

Clears all ingested documents and wipes the RAG vector collection.

```powershell
curl.exe -s -X POST http://127.0.0.1:8080/api/docs/reset
```

#### Response (200 OK):
```json
{
  "status": "ok",
  "message": "All documents cleared and collection reset"
}
```

---

### 26. Get RAG Document PCA 2D Projection
`GET /api/docs/pca?limit=5000`

Projects 768-dimensional document chunk embeddings onto 2D space. Points include `doc_id`, `chunk_index`, and `title`, while omitting the raw chunk text to preserve bandwidth.

```powershell
curl.exe --max-time 5 -s "http://127.0.0.1:8080/api/docs/pca?limit=5000"
```

#### Response (200 OK):
```json
{
  "dim": 768,
  "total_variance": 0.2762,
  "explained_ratio": [0.3391, 0.2411],
  "points": [
    {
      "id": 1,
      "doc_id": 1,
      "chunk_index": 0,
      "title": "Introduction to Vector Databases",
      "x": -0.195,
      "y": 0.421
    }
  ]
}
```

---

### 27. Project RAG Document Query onto PCA Space
`POST /api/docs/pca/query`

Accepts a natural language query (embedded via `nomic-embed-text`) or a raw vector, projects it onto the 2D subspace, and returns top-$k$ retrieved chunks with 2D positions.

```powershell
curl.exe --max-time 30 -s -X POST -H "Content-Type: application/json" -d '{
  "query": "What is vector search?",
  "k": 3
}' http://127.0.0.1:8080/api/docs/pca/query
```

#### Response (200 OK):
```json
{
  "query_projected": {"x": -0.169, "y": 0.279},
  "results": [
    {
      "doc_id": 1,
      "chunk_index": 0,
      "title": "Introduction to Vector Databases",
      "text": "Vector databases represent...",
      "distance": 0.226,
      "similarity": 0.774,
      "x": -0.195,
      "y": 0.421
    }
  ]
}
```

---

### 28. Get RAG Document HNSW Graph Topology
`GET /api/docs/hnsw/graph?layer=0&max_edges=20000`

Returns the HNSW graph topology of the document chunk index, with each node enriched with `doc_id`, `chunk_index`, and `title`.

```powershell
curl.exe --max-time 5 -s "http://127.0.0.1:8080/api/docs/hnsw/graph?layer=0"
```

---

## Standard Error Response Format

Errors are returned with structured JSON payloads:
```json
{
  "error": {
    "code": "validation_error",
    "message": "Parameter 'k' must be between 1 and 20"
  }
}
```

| HTTP Status | Code | Description |
|---|---|---|
| `400` | `invalid_json` / `validation_error` | Missing or malformed parameters |
| `403` | `forbidden_host` | Host header not in loopback whitelist (DNS rebinding protection) |
| `403` | `forbidden_origin` | Origin header does not match loopback origins or `--cors-origin` |
| `404` | `not_found` | Resource ID not found |
| `413` | `payload_too_large` | Document exceeds maximum byte size (`maxDocBytes`) |
| `415` | `unsupported_media_type` | Content-Type must be `application/json` for POST or requests with body |
| `502` | `ollama_error` | Ollama model returned an error (includes model pull hints) |
| `503` | `ollama_unavailable` | Cannot connect to Ollama or connection timed out |
| `500` | `internal_error` | Unhandled server error |

---

## Known Limitations

1. **In-Memory Only**:
   - Ingested documents, chunks, and index graphs reside strictly in RAM. Restarting `vectordb_server` clears all documents. Disk persistence (`save` / `load`) is scheduled for subsequent development.
2. **No Document Deletion**:
   - The current pipeline supports `ingest`, `list`, `get`, and `reset`. Granular document deletion (`DELETE /api/docs/:id`) is not yet supported.
3. **Single Mutex Synchronization**:
   - `Collection` uses a single `std::mutex` for thread synchronization. Mutexes are never held while communicating with Ollama, but concurrent in-memory vector mutations serialize behind this lock.
4. **Plain-Text Only**:
   - Documents must be UTF-8 plain text. Binary formats (PDF, DOCX) require external text extraction.
5. **Slow CPU Generation**:
   - Running 3B parameter LLMs on CPU requires 10 to 30 seconds per query. Clients should configure generous timeouts (e.g. `--max-time 900`).
