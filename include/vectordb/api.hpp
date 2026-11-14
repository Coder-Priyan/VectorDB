#pragma once

#include "vectordb/collection.hpp"
#include "vectordb/rag.hpp"
#include "vectordb/pca.hpp"

#include <string>
#include <optional>
#include <limits>
#include <utility>
#include <mutex>
#include <unordered_map>

namespace vectordb {

/**
 * @brief Thread-safe cache holding fitted PCA models and preprojected 2D coordinates.
 */
struct PcaCache {
    mutable std::mutex mutex;
    std::uint64_t cachedVersion = std::numeric_limits<std::uint64_t>::max();
    std::size_t cachedLimit = 0;
    PcaResult result;
    std::unordered_map<VectorId, std::pair<float, float>> nodeCoords;
    std::vector<StoredVector> cachedVectors;
};

/**
 * @brief Fits or updates the PCA cache if the underlying Collection version changed.
 */
void ensurePcaFit(const Collection& collection, PcaCache& cache, std::size_t limit = 5000);

/**
 * @brief Generic HTTP response container returned by API handler functions.
 *
 * Keeps handlers decoupled from network sockets so they can be unit-tested
 * without opening network ports.
 */
struct ApiResponse {
    int status = 200;
    std::string body;
    std::string contentType = "application/json; charset=utf-8";
};

/**
 * @brief Constructs a standardized error response document.
 * Format: {"error": {"code": "<machine_code>", "message": "<human text>"}}
 */
ApiResponse makeErrorResponse(int status, const std::string& code, const std::string& message);

// -----------------------------------------------------------------------------
// Endpoint Handlers
// -----------------------------------------------------------------------------

ApiResponse handleHealth();

ApiResponse handleGetConfig(const Collection& collection);

ApiResponse handleReset(Collection& collection, const std::string& body);

ApiResponse handleGetStats(const Collection& collection);

ApiResponse handleInsertVector(Collection& collection, const std::string& body);

ApiResponse handleBatchInsert(Collection& collection, const std::string& body);

ApiResponse handleGetVector(const Collection& collection, VectorId id);

ApiResponse handleSearch(Collection& collection, const std::string& body);

ApiResponse handleBenchmark(Collection& collection, const std::string& body);

ApiResponse handleHnswInfo(const Collection& collection);

ApiResponse handleHnswNode(const Collection& collection, VectorId id);

ApiResponse handleHnswTrace(Collection& collection, const std::string& body, RagPipeline* rag = nullptr);

ApiResponse handleDemoRandom(Collection& collection, const std::string& body);

// -----------------------------------------------------------------------------
// RAG Pipeline Handlers
// -----------------------------------------------------------------------------

ApiResponse handleOllamaStatus(const RagPipeline& rag);

ApiResponse handleIngestDoc(RagPipeline& rag, const std::string& body);

ApiResponse handleListDocs(const RagPipeline& rag);

ApiResponse handleGetDoc(const RagPipeline& rag, uint64_t id);

ApiResponse handleSearchDocs(RagPipeline& rag, const std::string& body);

ApiResponse handleBenchmarkDocs(RagPipeline& rag, const std::string& body);

struct AskRequest {
    std::string question;
    std::size_t k = 4;
    Algorithm algorithm = Algorithm::Hnsw;
    std::optional<std::size_t> ef = std::nullopt;
    ChatOptions chatOpt;
    bool debug = false;
    std::vector<ChatMessage> history;
};

/**
 * @brief Parses and validates an /api/ask or /api/ask/stream request body.
 * Returns std::nullopt on success, or an error ApiResponse on failure.
 */
std::optional<ApiResponse> parseAskRequest(const std::string& body, AskRequest& out);

ApiResponse handleAsk(RagPipeline& rag, const std::string& body);

ApiResponse handleResetDocs(RagPipeline& rag);

// -----------------------------------------------------------------------------
// SSE Streaming & PCA/Graph Handlers
// -----------------------------------------------------------------------------

/**
 * @brief Validates HTTP Host header against allowed loopback hosts for DNS rebinding protection.
 */
bool isAllowedLoopbackHost(const std::string& hostHeader, int port);

/**
 * @brief Validates HTTP Origin header against allowed loopback origins and configured CORS origin.
 */
bool isAllowedOrigin(const std::string& origin, int port, const std::string& corsOrigin = "");

/**
 * @brief Formats a single Server-Sent Events (SSE) message block: "event: <event>\ndata: <data>\n\n".
 */
std::string formatSseEvent(const std::string& event, const std::string& data);

ApiResponse handleGetPca(const Collection& collection, PcaCache& cache, std::optional<std::size_t> limit, bool isDocs);

ApiResponse handlePcaQuery(Collection& collection, PcaCache& cache, const std::string& body);

ApiResponse handleDocsPcaQuery(RagPipeline& rag, PcaCache& cache, const std::string& body);

ApiResponse handleHnswGraph(const Collection& collection, PcaCache& cache, std::optional<int> layer, std::optional<std::size_t> maxEdges, bool isDocs);

} // namespace vectordb
