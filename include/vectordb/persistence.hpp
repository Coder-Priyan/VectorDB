#pragma once

#include "vectordb/collection.hpp"
#include "vectordb/rag.hpp"

#include <string>

namespace vectordb {

struct PersistenceStatus {
    bool enabled = false;
    std::string dataDir;
    bool lastLoadSuccess = true;
    std::string lastError;
};

/**
 * @brief Saves a Collection to a versioned binary file atomically via a temporary file.
 */
bool saveCollectionToFile(const Collection& collection, const std::string& filePath, std::string* errorOut = nullptr);

/**
 * @brief Loads a Collection from a versioned binary file, rebuilding indexes from vectors.
 */
bool loadCollectionFromFile(Collection& collection, const std::string& filePath, std::string* errorOut = nullptr);

/**
 * @brief Saves a RagPipeline (documents and collection) to a versioned binary file atomically.
 */
bool saveRagPipelineToFile(const RagPipeline& rag, const std::string& filePath, std::string* errorOut = nullptr);

/**
 * @brief Loads a RagPipeline from a versioned binary file, rebuilding indexes and restoring documents.
 */
bool loadRagPipelineFromFile(RagPipeline& rag, const std::string& filePath, std::string* errorOut = nullptr);

} // namespace vectordb

