#pragma once

#include "vectordb/collection.hpp"

#include <string>
#include <optional>

namespace vectordb {

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

ApiResponse handleHnswTrace(Collection& collection, const std::string& body);

ApiResponse handleDemoRandom(Collection& collection, const std::string& body);

} // namespace vectordb
