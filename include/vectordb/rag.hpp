#pragma once

#include "vectordb/collection.hpp"
#include "vectordb/chunker.hpp"
#include "vectordb/ollama_client.hpp"

#include <chrono>
#include <cstddef>
#include <functional>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <vector>

namespace vectordb {

/// Configuration for the RAG pipeline
struct RagConfig {
    std::size_t dimension = 768;
    Metric metric = Metric::Cosine;
    HnswParams hnsw;
    std::size_t maxDocBytes = 2 * 1024 * 1024;    ///< 2 MB per document
    std::size_t maxChunksPerDoc = 5000;
};

/// Result of document ingestion
struct IngestResult {
    uint64_t docId = 0;
    std::size_t chunkCount = 0;
    std::size_t dimension = 0;
    double embedMs = 0.0;
};

/// Retrieved chunk information
struct RetrievedChunk {
    uint64_t docId = 0;
    std::string title;
    std::size_t chunkIndex = 0;
    std::size_t startByte = 0;
    std::size_t endByte = 0;
    std::string text;
    float distance = 0.0f;
    float similarity = 0.0f;   ///< 1.0f - distance
};

/// Cited source reference returned with an answer
struct RagSource {
    std::size_t n = 0;         ///< 1-based citation number: [1], [2], ...
    uint64_t docId = 0;
    std::string title;
    std::size_t chunkIndex = 0;
    std::string text;
    float distance = 0.0f;
    float similarity = 0.0f;
};

/// Execution timings (in milliseconds)
struct RagTimings {
    double embedMs = 0.0;
    double searchMs = 0.0;
    double generateMs = 0.0;
    double totalMs = 0.0;
};

/// Result of an ask query
struct AskResult {
    std::string answer;
    std::vector<RagSource> sources;
    RagTimings timings;
    std::string model;
    std::size_t promptChars = 0;
    std::string prompt;        ///< Non-empty only if debug == true
};

/// Chunk metadata inside a DocumentRecord
struct DocumentChunkInfo {
    std::size_t index = 0;
    std::size_t startByte = 0;
    std::size_t endByte = 0;
    std::string text;
};

/// Stored document record
struct DocumentRecord {
    uint64_t id = 0;
    std::string title;
    std::size_t byteLength = 0;
    std::size_t chunkCount = 0;
    ChunkStrategy strategy = ChunkStrategy::Sentence;
    std::string createdAt;     ///< UTC ISO 8601 string
    std::vector<uint64_t> chunkVectorIds;
    std::vector<DocumentChunkInfo> chunks;
};

/**
 * @brief Fully offline RAG pipeline integrating Chunker, Collection, and OllamaClient.
 *
 * Implements strict lock discipline: mutexes are NEVER held while communicating
 * with Ollama, preventing server starvation during slow CPU generation or embedding.
 */
class RagPipeline {
public:
    RagPipeline(RagConfig config, OllamaClient ollama);

    const RagConfig& config() const noexcept { return config_; }
    const OllamaClient& ollama() const noexcept { return ollama_; }
    OllamaClient& ollama() noexcept { return ollama_; }

    const Collection& collection() const noexcept { return *collection_; }
    Collection& collection() noexcept { return *collection_; }

    /**
     * @brief Ingest a plain-text document (chunk -> embed -> atomic insert).
     *
     * Guarantee: all-or-nothing semantics. If embedding fails or dimension mismatches,
     * no document is created and the vector collection remains untouched.
     */
    IngestResult ingest(const std::string& title,
                        const std::string& text,
                        const ChunkOptions& opt = {});

    /**
     * @brief Retrieve the most relevant chunks for a query without invoking the LLM.
     */
    std::vector<RetrievedChunk> retrieve(const std::string& query,
                                         std::size_t k = 5,
                                         Algorithm algo = Algorithm::Hnsw,
                                         std::optional<std::size_t> ef = std::nullopt);

    /**
     * @brief Answer a question using retrieved chunks as context, citing sources.
     *
     * If the index is empty, immediately returns "No documents have been ingested yet."
     * without calling the LLM.
     */
    AskResult ask(const std::string& question,
                  std::size_t k = 4,
                  Algorithm algo = Algorithm::Hnsw,
                  std::optional<std::size_t> ef = std::nullopt,
                  const ChatOptions& chatOpt = {},
                  bool debug = false,
                  const std::function<bool(const std::string&)>& onToken = {});

    /**
     * @brief Run brute-force, KD-Tree, and HNSW benchmarks on real document embeddings.
     */
    BenchmarkReport benchmarkQuery(const std::string& query,
                                   std::size_t k = 5,
                                   std::optional<std::size_t> ef = std::nullopt);

    /// List all ingested documents
    std::vector<DocumentRecord> listDocuments() const;

    /// Get details of a single document including its chunks
    std::optional<DocumentRecord> getDocument(uint64_t id) const;

    /// Clear all documents and reset the collection
    void reset();

private:
    RagConfig config_;
    OllamaClient ollama_;

    mutable std::mutex pipelineMutex_;
    std::unique_ptr<Collection> collection_;
    uint64_t nextDocId_ = 1;
    std::vector<DocumentRecord> documents_;

    CollectionConfig makeCollectionConfig() const;
};

} // namespace vectordb
