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

## Endpoints

### 1. Health Check
`GET /api/health`

Verifies that the server process is alive and returns the software version.

#### Windows PowerShell:
```powershell
curl.exe -s http://127.0.0.1:8080/api/health
```

#### Bash:
```bash
curl -s http://127.0.0.1:8080/api/health
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

#### Windows PowerShell:
```powershell
curl.exe -s http://127.0.0.1:8080/api/config
```

#### Bash:
```bash
curl -s http://127.0.0.1:8080/api/config
```

#### Response (200 OK):
```json
{
  "dimension": 128,
  "metric": "cosine",
  "hnsw": {
    "M": 16,
    "efConstruction": 200,
    "efSearch": 50,
    "seed": 42,
    "useHeuristic": true
  },
  "leafSize": 8
}
```

---

### 3. Reset Collection
`POST /api/reset`

Clears all stored vectors and indexes. Optionally applies new configuration parameters. Any omitted parameters retain their previous values.

#### Request Body (All fields optional):
```json
{
  "dimension": 8,
  "metric": "cosine",
  "hnsw": {
    "M": 16,
    "efConstruction": 200,
    "efSearch": 50,
    "seed": 42
  },
  "leafSize": 8
}
```

#### Windows PowerShell:
```powershell
curl.exe -s -X POST http://127.0.0.1:8080/api/reset -H "Content-Type: application/json" -d '{\"dimension\": 8, \"metric\": \"cosine\"}'
```

#### Bash:
```bash
curl -s -X POST http://127.0.0.1:8080/api/reset -H "Content-Type: application/json" -d '{"dimension": 8, "metric": "cosine"}'
```

#### Response (200 OK):
Returns the updated collection configuration document.

---

### 4. Collection Statistics
`GET /api/stats`

Returns total indexed vector count, dimensionality, and distance metric.

#### Windows PowerShell:
```powershell
curl.exe -s http://127.0.0.1:8080/api/stats
```

#### Bash:
```bash
curl -s http://127.0.0.1:8080/api/stats
```

#### Response (200 OK):
```json
{
  "count": 2000,
  "dimension": 8,
  "metric": "cosine"
}
```

---

### 5. Insert Single Vector
`POST /api/vectors`

Inserts a vector into all indexes (BruteForce, KD-Tree, HNSW). If `id` is omitted, an auto-incrementing monotonic 64-bit ID is assigned.

#### Request Body:
```json
{
  "id": 101,
  "vector": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
  "metadata": {"title": "Introduction to AI", "category": "education"}
}
```

#### Windows PowerShell:
```powershell
curl.exe -s -X POST http://127.0.0.1:8080/api/vectors -H "Content-Type: application/json" -d '{\"id\": 101, \"vector\": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8], \"metadata\": {\"title\": \"Introduction to AI\"}}'
```

#### Bash:
```bash
curl -s -X POST http://127.0.0.1:8080/api/vectors -H "Content-Type: application/json" -d '{"id": 101, "vector": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8], "metadata": {"title": "Introduction to AI"}}'
```

#### Response (201 Created):
```json
{
  "id": 101
}
```

---

### 6. Batch Insert (All-or-Nothing)
`POST /api/vectors/batch`

Inserts multiple vectors in one atomic pass. Validates every item before inserting: if any vector has an invalid dimension, NaN/infinity value, or duplicate ID, **no vectors are inserted** and a 400 error identifying the index of the first invalid item is returned.

#### Request Body:
```json
{
  "items": [
    {"id": 1, "vector": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8], "metadata": "doc1"},
    {"vector": [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]}
  ]
}
```

#### Windows PowerShell:
```powershell
curl.exe -s -X POST http://127.0.0.1:8080/api/vectors/batch -H "Content-Type: application/json" -d '{\"items\": [{\"id\": 1, \"vector\": [0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8]}, {\"vector\": [0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9]}]}'
```

#### Bash:
```bash
curl -s -X POST http://127.0.0.1:8080/api/vectors/batch -H "Content-Type: application/json" -d '{"items": [{"id": 1, "vector": [0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8]}, {"vector": [0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9]}]}'
```

#### Response (201 Created):
```json
{
  "inserted": 2,
  "ids": [1, 2]
}
```

---

### 7. Get Vector by ID
`GET /api/vectors/:id`

Retrieves the stored float32 vector components and associated metadata.

#### Windows PowerShell:
```powershell
curl.exe -s http://127.0.0.1:8080/api/vectors/101
```

#### Bash:
```bash
curl -s http://127.0.0.1:8080/api/vectors/101
```

#### Response (200 OK):
```json
{
  "id": 101,
  "vector": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
  "metadata": {"title": "Introduction to AI"}
}
```

---

### 8. Nearest Neighbor Search
`POST /api/search`

Executes approximate or exact nearest neighbor retrieval using the selected algorithm (`"brute"`, `"kdtree"`, or `"hnsw"`). For HNSW queries, `ef` can be overridden per query and is automatically restored.

#### Request Body:
```json
{
  "vector": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
  "k": 5,
  "algorithm": "hnsw",
  "ef": 50
}
```

#### Windows PowerShell:
```powershell
curl.exe -s -X POST http://127.0.0.1:8080/api/search -H "Content-Type: application/json" -d '{\"vector\": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8], \"k\": 5, \"algorithm\": \"hnsw\", \"ef\": 50}'
```

#### Bash:
```bash
curl -s -X POST http://127.0.0.1:8080/api/search -H "Content-Type: application/json" -d '{"vector": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8], "k": 5, "algorithm": "hnsw", "ef": 50}'
```

#### Response (200 OK):
```json
{
  "algorithm": "hnsw",
  "k": 5,
  "latency_us": 56,
  "results": [
    {"distance": 0.057717, "id": 1831, "metadata": null},
    {"distance": 0.069663, "id": 972, "metadata": null},
    {"distance": 0.101318, "id": 197, "metadata": null},
    {"distance": 0.147427, "id": 102, "metadata": null},
    {"distance": 0.171875, "id": 1956, "metadata": null}
  ]
}
```

---

### 9. Multi-Algorithm Benchmark
`POST /api/benchmark`

Executes the query against all three algorithms simultaneously, using BruteForce as the ground-truth baseline to compute Recall@k, microsecond latency, and distance computations for each index.

#### Request Body:
```json
{
  "vector": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
  "k": 5,
  "ef": 50
}
```

#### Windows PowerShell:
```powershell
curl.exe -s -X POST http://127.0.0.1:8080/api/benchmark -H "Content-Type: application/json" -d '{\"vector\": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8], \"k\": 5, \"ef\": 50}'
```

#### Bash:
```bash
curl -s -X POST http://127.0.0.1:8080/api/benchmark -H "Content-Type: application/json" -d '{"vector": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8], "k": 5, "ef": 50}'
```

#### Response (200 OK):
```json
{
  "k": 5,
  "count": 2000,
  "ground_truth": "brute",
  "algorithms": {
    "brute": {
      "latency_us": 62,
      "distance_computations": 2000,
      "recall_at_k": 1.0,
      "results": [...]
    },
    "kdtree": {
      "latency_us": 69,
      "distance_computations": 1587,
      "recall_at_k": 1.0,
      "results": [...]
    },
    "hnsw": {
      "latency_us": 151,
      "distance_computations": 450,
      "recall_at_k": 1.0,
      "results": [...]
    }
  }
}
```

---

### 10. HNSW Graph Overview
`GET /api/hnsw/info`

Inspects structural layer statistics of the multi-layer HNSW graph.

#### Windows PowerShell:
```powershell
curl.exe -s http://127.0.0.1:8080/api/hnsw/info
```

#### Bash:
```bash
curl -s http://127.0.0.1:8080/api/hnsw/info
```

#### Response (200 OK):
```json
{
  "numNodes": 2000,
  "maxLevel": 3,
  "entryPointId": 1050,
  "nodesPerLayer": [2000, 122, 14, 1],
  "avgDegreePerLayer": [25.95, 16.0, 13.0, 0.0],
  "maxDegreePerLayer": [32, 16, 13, 0]
}
```

---

### 11. HNSW Node Connectivity
`GET /api/hnsw/node/:id`

Retrieves the top layer assigned to a specific vector and lists all outgoing neighbor connections across every layer where it is present.

#### Windows PowerShell:
```powershell
curl.exe -s http://127.0.0.1:8080/api/hnsw/node/1050
```

#### Bash:
```bash
curl -s http://127.0.0.1:8080/api/hnsw/node/1050
```

#### Response (200 OK):
```json
{
  "id": 1050,
  "level": 3,
  "neighbors": {
    "0": [943, 640, 154, ...],
    "1": [680, 1121, 1222, ...],
    "2": [126, 991, 617, ...],
    "3": []
  }
}
```

---

### 12. HNSW Search Traversal Trace
`POST /api/hnsw/trace`

Executes a search while capturing every distance evaluation and layer step during the greedy descent and beam search.

#### Request Body:
```json
{
  "vector": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
  "k": 3,
  "ef": 20
}
```

#### Windows PowerShell:
```powershell
curl.exe -s -X POST http://127.0.0.1:8080/api/hnsw/trace -H "Content-Type: application/json" -d '{\"vector\": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8], \"k\": 3, \"ef\": 20}'
```

#### Bash:
```bash
curl -s -X POST http://127.0.0.1:8080/api/hnsw/trace -H "Content-Type: application/json" -d '{"vector": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8], "k": 3, "ef": 20}'
```

#### Response (200 OK):
```json
{
  "results": [{"distance": 0.057717, "id": 1831, "metadata": null}],
  "stats": {
    "distanceComputations": 268,
    "nodesVisited": 268,
    "visitedPerLayer": [225, 28, 14, 1]
  },
  "trace": [
    {"distance": 1.5396, "id": 1050, "layer": 3},
    {"distance": 1.5396, "id": 1050, "layer": 2},
    {"distance": 1.2731, "id": 126, "layer": 2}
  ]
}
```

---

### 13. Synthetic Demo Vector Generation
`POST /api/demo/random`

Generates and inserts $N$ reproducible pseudo-random Gaussian vectors for benchmarking and quick demonstrations (up to 100,000 vectors).

#### Request Body:
```json
{
  "n": 2000,
  "seed": 42
}
```

#### Windows PowerShell:
```powershell
curl.exe -s -X POST http://127.0.0.1:8080/api/demo/random -H "Content-Type: application/json" -d '{\"n\": 2000, \"seed\": 42}'
```

#### Bash:
```bash
curl -s -X POST http://127.0.0.1:8080/api/demo/random -H "Content-Type: application/json" -d '{"n": 2000, "seed": 42}'
```

#### Response (200 OK):
```json
{
  "inserted": 2000
}
```

---

## Known Limitations

1. **Single Coarse Mutex (Global Lock)**:
   - `Collection` uses a single `std::mutex` to protect all read and write operations.
   - *Why*: KD-Tree (lazy median split rebuild) and HNSW (visited epoch counter mutations) mutate internal state even during read-only search operations. Finer-grained reader-writer locking will be introduced in a future concurrency task.
2. **In-Memory Only (No Disk Persistence)**:
   - Vectors and graph structures are stored entirely in RAM. Terminating the server process discards all indexed data. Disk persistence (`save` / `load`) is scheduled for Task 5.
3. **No Dynamic Deletions / Updates**:
   - The current engine supports insert and search only. Vector removal (`remove(id)`) and in-place updates will be added in a later iteration.
4. **Local Binding by Default**:
   - The server binds to `127.0.0.1` by default to avoid unintended external exposure.
