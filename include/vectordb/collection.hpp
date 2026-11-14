#pragma once

#include "vectordb/types.hpp"
#include "vectordb/distance.hpp"
#include "vectordb/brute_force.hpp"
#include "vectordb/kd_tree.hpp"
#include "vectordb/hnsw.hpp"
#include "vectordb/evaluation.hpp"

#include <vector>
#include <string>
#include <unordered_map>
#include <memory>
#include <mutex>
#include <optional>
#include <cstdint>

namespace vectordb {

/**
 * @brief Search algorithm selection for the Collection service layer.
 */
enum class Algorithm {
    BruteForce,
    KdTree,
    Hnsw
};

/**
 * @brief Converts an Algorithm enum value to lowercase string ("brute", "kdtree", "hnsw").
 */
std::string algorithmToString(Algorithm alg);

/**
 * @brief Parses an algorithm string (case-insensitive, accepts "brute", "bruteforce", "kdtree", "hnsw").
 * @throws std::invalid_argument if the algorithm name is unknown.
 */
Algorithm stringToAlgorithm(const std::string& str);

/**
 * @brief Configuration parameters for a Collection.
 */
struct CollectionConfig {
    std::size_t dimension = 128;
    Metric metric = Metric::Cosine;
    HnswParams hnswParams;
    std::size_t leafSize = 8;
};

/**
 * @brief Summary statistics of a Collection.
 */
struct CollectionStats {
    std::size_t count = 0;
    std::size_t dimension = 0;
    Metric metric = Metric::Cosine;
    std::size_t memoryBytes = 0;
};

/**
 * @brief Benchmark results for a single algorithm execution.
 */
struct AlgorithmBenchmarkResult {
    std::vector<SearchResult> results;
    long long latencyUs = 0;
    std::size_t distanceComputations = 0;
    double recallAtK = 0.0;
};

/**
 * @brief Multi-algorithm comparison report evaluated on the same query vector.
 */
struct BenchmarkReport {
    std::size_t k = 0;
    std::size_t count = 0;
    std::string groundTruth = "brute";
    AlgorithmBenchmarkResult brute;
    AlgorithmBenchmarkResult kdtree;
    AlgorithmBenchmarkResult hnsw;
};

/**
 * @brief Introspection data for a single node inside the HNSW graph hierarchy.
 */
struct HnswNodeInfo {
    VectorId id = 0;
    int level = -1;
    std::unordered_map<int, std::vector<VectorId>> neighbors;
};

/**
 * @brief Detailed search traversal trace and statistics for an HNSW query.
 */
struct HnswTraceResult {
    std::vector<SearchResult> results;
    HnswSearchStats stats;
    std::vector<HnswTraceStep> trace;
};

/**
 * @brief Representation of an indexed vector with its payload metadata.
 */
struct StoredVector {
    VectorId id = 0;
    std::vector<float> vector;
    std::string metadata;
};

/**
 * @brief Undirected edge in the HNSW layer graph.
 */
struct HnswEdge {
    VectorId source = 0;
    VectorId target = 0;
};

/**
 * @brief Nodes and edges residing on a specific HNSW graph layer.
 */
struct HnswLayerGraph {
    int layer = 0;
    std::vector<VectorId> nodes;
    std::vector<HnswEdge> edges;
    std::size_t totalEdges = 0;
    bool truncated = false;
};

/**
 * @brief High-level service layer managing a unified vector database collection.
 *
 * Owns three synchronized indexes (BruteForceIndex, KdTreeIndex, HnswIndex),
 * an opaque metadata payload store, and an original vector store.
 *
 * THREAD SAFETY NOTE:
 * KdTreeIndex and HnswIndex mutate internal state during query execution
 * (lazy median-split tree rebuilding in KD-Tree, and visited epoch counter updates
 * in HNSW). Therefore, concurrent queries or mutations are not safe on raw indexes.
 * To ensure complete thread safety across multi-threaded HTTP request handlers,
 * Collection synchronizes all public methods using a single std::mutex.
 * This is a documented design decision and will be upgraded to finer-grained
 * read-write concurrency in a future task.
 */
class Collection {
public:
    static constexpr VectorId MAX_SAFE_INTEGER = 9007199254740991ULL; // 2^53 - 1 (IEEE 754 safe integer)

    /**
     * @brief Constructs a new collection with the given configuration.
     * @throws std::invalid_argument if dimension == 0 or leafSize == 0.
     */
    explicit Collection(CollectionConfig config = {});

    ~Collection() = default;
    Collection(const Collection&) = delete;
    Collection& operator=(const Collection&) = delete;
    Collection(Collection&&) = delete;
    Collection& operator=(Collection&&) = delete;

    /**
     * @brief Inserts a vector with optional user-supplied ID and metadata JSON string.
     *
     * If id is std::nullopt, an auto-incrementing monotonic ID is assigned.
     * Inserts synchronously into Brute Force, KD-Tree, and HNSW indexes.
     *
     * @throws std::invalid_argument on wrong dimension, empty vector, NaN/inf, id > 2^53-1, id == 0, duplicate id.
     */
    VectorId insert(std::optional<VectorId> id, const std::vector<float>& v, std::string metadata = "");

    /**
     * @brief Executes nearest neighbor search using the specified algorithm.
     *
     * If algorithm is Hnsw and ef is provided, efSearch is temporarily overridden
     * for this query and restored upon return (even if an exception occurs).
     *
     * @throws std::invalid_argument on wrong query dimension, NaN/inf, or k == 0 / k > 1000.
     */
    std::vector<SearchResult> search(
        Algorithm alg,
        const std::vector<float>& query,
        std::size_t k,
        std::optional<std::size_t> ef = std::nullopt,
        SearchStats* stats = nullptr
    );

    /**
     * @brief Runs the query against BruteForce, KdTree, and HNSW, measuring latency and recall.
     */
    BenchmarkReport benchmarkAll(
        const std::vector<float>& query,
        std::size_t k,
        std::optional<std::size_t> ef = std::nullopt
    );

    /**
     * @brief Retrieves the original vector components by VectorId.
     * @throws std::out_of_range if VectorId is not found.
     */
    std::vector<float> getVector(VectorId id) const;

    /**
     * @brief Retrieves the opaque metadata JSON string associated with a VectorId.
     * @throws std::out_of_range if VectorId is not found.
     */
    std::string getMetadata(VectorId id) const;

    /**
     * @brief Checks if a VectorId exists in the collection.
     */
    bool contains(VectorId id) const;

    /**
     * @brief Returns summary collection statistics (count, dimension, metric).
     */
    CollectionStats stats() const;

    /**
     * @brief Returns the structural graph overview of the underlying HNSW index.
     */
    HnswGraphInfo hnswInfo() const;

    /**
     * @brief Returns the layer and neighbor connectivity list for a specific HNSW node.
     * @throws std::out_of_range if VectorId is not found.
     */
    HnswNodeInfo hnswNode(VectorId id) const;

    /**
     * @brief Executes an HNSW search and returns the complete traversal step trace.
     */
    HnswTraceResult hnswTrace(
        const std::vector<float>& query,
        std::size_t k,
        std::optional<std::size_t> ef = std::nullopt
    );

    /**
     * @brief Returns the layer graph (nodes and undirected edges) for the specified HNSW layer.
     * @param layer The layer index (0 <= layer <= maxLevel).
     * @param maxEdges Maximum number of edges to return (default: 20000).
     */
    HnswLayerGraph hnswLayerGraph(int layer, std::size_t maxEdges = 20000) const;

    /**
     * @brief Monotonically increasing version counter, incremented on insert and reset.
     */
    std::uint64_t version() const;

    /**
     * @brief Exports stored vectors up to limit, sorted in ascending VectorId order.
     * @param limit Maximum number of vectors to return (hard cap: 20000).
     */
    std::vector<StoredVector> exportVectors(std::size_t limit = 20000) const;

    /**
     * @brief Resets the collection, clearing all vectors and applying the new configuration.
     * @throws std::invalid_argument if newConfig has invalid parameters.
     */
    void reset(const CollectionConfig& newConfig);

    /**
     * @brief Returns the current collection configuration.
     */
    CollectionConfig getConfig() const;

    /**
     * @brief Removes a vector by ID, rebuilding internal indexes from remaining vectors.
     * Retains exact IDs of remaining vectors. Returns true if vector was found and removed.
     */
    bool remove(VectorId id);

    /**
     * @brief Removes a set of vectors by ID, rebuilding internal indexes from remaining vectors.
     * Returns count of removed vectors.
     */
    std::size_t removeBatch(const std::vector<VectorId>& ids);

    /**
     * @brief Exports all stored vectors with their IDs and metadata without cap.
     */
    std::vector<StoredVector> exportAllVectors() const;

    /**
     * @brief Returns the next auto-assigned ID counter.
     */
    VectorId nextId() const noexcept;

    /**
     * @brief Rebuilds the collection from stored vectors.
     */
    void loadFromVectors(const CollectionConfig& config,
                         const std::vector<StoredVector>& vectors,
                         VectorId nextId);

private:
    void validateVector(const std::vector<float>& v) const;
    void validateK(std::size_t k) const;

    mutable std::mutex mutex_;
    CollectionConfig config_;
    VectorId nextAutoId_ = 1;
    std::uint64_t version_ = 0;

    std::unique_ptr<BruteForceIndex> brute_;
    std::unique_ptr<KdTreeIndex> kd_;
    std::unique_ptr<HnswIndex> hnsw_;

    std::unordered_map<VectorId, std::vector<float>> vectors_;
    std::unordered_map<VectorId, std::string> metadataJson_;
};

} // namespace vectordb
