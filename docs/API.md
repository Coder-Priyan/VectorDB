# VectorDB REST API Reference

The `vectordb_server` provides a clean HTTP JSON interface on top of the VectorDB C++17 engine.
All requests and responses use `Content-Type: application/json; charset=utf-8`.
CORS headers (`Access-Control-Allow-Origin: *`) are attached to all API endpoints, including `OPTIONS` preflight responses.

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
  "leaf_size": 8,
  "hnsw": {
    "M": 16,
    "ef_construction": 200,
    "ef_search": 50,
    "seed": 42,
    "use_heuristic": true
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

### 10. HNSW Graph Introspection Endpoints

- `GET /api/hnsw/info`: Graph topology summary (entry point, max level, node counts per level).
- `GET /api/hnsw/node/:id`: Layer assignment and neighbor adjacency list for a specific node.
- `POST /api/hnsw/trace`: Step-by-step routing trace for a search query.

---

## Offline RAG Pipeline Endpoints

The RAG pipeline provides fully offline document chunking, embedding, vector search, and grounded question answering powered by local Ollama models (`nomic-embed-text` and `llama3.2`).

---

### 11. Ollama Reachability & Status
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

### 12. Ingest Document
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

### 13. List Documents
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

### 14. Get Document Details & Chunks
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

### 15. Semantic Document Search
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

### 16. Document Collection Benchmark
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

### 17. Ask Grounded Question (RAG)
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

### 18. Reset Documents
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
| `404` | `not_found` | Resource ID not found |
| `413` | `payload_too_large` | Document exceeds maximum byte size (`maxDocBytes`) |
| `502` | `ollama_error` | Ollama model returned an error (includes model pull hints) |
| `503` | `ollama_unavailable` | Cannot connect to Ollama or connection timed out |
| `500` | `internal_error` | Unhandled server error |

---

## Known Limitations

1. **Non-Streaming HTTP Answers**:
   - While `OllamaClient` internally parses incremental NDJSON streams across network packets, the `/api/ask` HTTP endpoint aggregates the complete answer before responding. Server-Sent Events (SSE) streaming will be added in a future update.
2. **In-Memory Only**:
   - Ingested documents, chunks, and index graphs reside strictly in RAM. Restarting `vectordb_server` clears all documents. Disk persistence (`save` / `load`) is scheduled for subsequent development.
3. **No Document Deletion**:
   - The current pipeline supports `ingest`, `list`, `get`, and `reset`. Granular document deletion (`DELETE /api/docs/:id`) is not yet supported.
4. **Single Mutex Synchronization**:
   - `Collection` uses a single `std::mutex` for thread synchronization. Mutexes are never held while communicating with Ollama, but concurrent in-memory vector mutations serialize behind this lock.
5. **Plain-Text Only**:
   - Documents must be UTF-8 plain text. Binary formats (PDF, DOCX) require external text extraction.
6. **Slow CPU Generation**:
   - Running 3B parameter LLMs on CPU requires 10 to 30 seconds per query. Clients should configure generous timeouts (e.g. `--max-time 900`).
