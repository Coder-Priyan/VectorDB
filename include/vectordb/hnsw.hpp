#pragma once

#include "vectordb/index.hpp"
#include <vector>
#include <unordered_map>
#include <random>
#include <cstdint>
#include <cstddef>

namespace vectordb {

/**
 * @brief Configuration parameters for the HNSW graph index.
 * Follows the seminal paper: Malkov & Yashunin (2018), "Efficient and robust
 * approximate nearest neighbor search using Hierarchical Navigable Small World graphs".
 */
struct HnswParams {
    std::size_t M = 16;                 ///< Max outgoing edges per node on layers >= 1
    std::size_t efConstruction = 200;   ///< Size of the dynamic candidate list during construction
    std::size_t efSearch = 50;          ///< Size of the dynamic candidate list during search
    unsigned seed = 42;                 ///< PRNG seed for level generation (ensures reproducible graphs)
    bool useHeuristic = true;           ///< Paper Algorithm 4 if true, simple closest-M (Algorithm 3) if false
};

/**
 * @brief Search statistics tracking traversal complexity across layers.
 */
struct HnswSearchStats {
    std::size_t distanceComputations = 0;   ///< Total number of vector distance calculations
    std::size_t nodesVisited = 0;           ///< Total number of graph nodes inspected
    std::vector<std::size_t> visitedPerLayer; ///< Number of nodes visited at each layer
};

/**
 * @brief A single step recorded during search traversal for debugging and visual analysis.
 */
struct HnswTraceStep {
    int layer = 0;          ///< Graph layer where the distance computation occurred
    VectorId id = 0;        ///< Vector ID of the node evaluated
    float distance = 0.0f;  ///< Distance from query to this node
};

/**
 * @brief Structural overview of the HNSW multi-layer graph.
 */
struct HnswGraphInfo {
    std::size_t numNodes = 0;                   ///< Total number of indexed vectors
    int maxLevel = -1;                          ///< Highest active layer index in the hierarchy
    VectorId entryPointId = 0;                  ///< Vector ID of the top-layer entry point
    std::vector<std::size_t> nodesPerLayer;     ///< Number of nodes present on each layer (0..maxLevel)
    std::vector<double> avgDegreePerLayer;      ///< Average node degree on each layer
    std::vector<std::size_t> maxDegreePerLayer; ///< Maximum node degree observed on each layer
};

/**
 * @brief Hierarchical Navigable Small World (HNSW) Vector Index.
 *
 * Implements approximate nearest-neighbor search with logarithmic query complexity O(log N).
 * Vectors are organized across multiple layers of proximity graphs:
 * - Upper layers have sparser connectivity with long-range links for rapid greedy routing.
 * - Layer 0 contains all vectors with denser connectivity (Mmax0 = 2 * M) for fine-grained local search.
 */
class HnswIndex : public VectorIndex {
public:
    /**
     * @brief Construct an HnswIndex.
     *
     * @param dim Vector dimensionality.
     * @param metric Distance metric (Cosine, Euclidean, Manhattan).
     * @param params HnswParams struct.
     * @throws std::invalid_argument if M < 2, efConstruction < M, or dim == 0.
     */
    HnswIndex(std::size_t dim, Metric metric, HnswParams params = {});
    ~HnswIndex() override = default;

    void insert(VectorId id, const std::vector<float>& vec) override;
    std::vector<SearchResult> search(const std::vector<float>& query, std::size_t k) const override;
    std::size_t size() const override;
    std::size_t dimension() const override;
    std::string name() const override;

    void setEfSearch(std::size_t ef);
    std::size_t efSearch() const noexcept;
    const HnswParams& params() const noexcept;

    /**
     * @brief Search top-k nearest neighbors while recording search statistics and an optional step trace.
     *
     * @param query Query vector of length equal to dimension().
     * @param k Number of nearest neighbors to retrieve.
     * @param stats Output search statistics.
     * @param trace Optional pointer to vector collecting each distance computation step.
     * @return std::vector<SearchResult> Best k results sorted ascending by distance (tie-break by smaller VectorId).
     */
    std::vector<SearchResult> searchWithStats(const std::vector<float>& query,
                                             std::size_t k,
                                             HnswSearchStats& stats,
                                             std::vector<HnswTraceStep>* trace = nullptr) const;

    /// Structural inspection of the multi-layer graph.
    HnswGraphInfo graphInfo() const;

    /// Retrieve the neighbor list for a specific node on a given layer.
    std::vector<VectorId> neighborsOf(VectorId id, int layer) const;

    /// Retrieve the maximum level assigned to a specific node.
    int levelOf(VectorId id) const;

    /// Direct const pointer to raw contiguous vector data.
    const float* data() const noexcept { return data_.data(); }

    /// Parallel vector of stored vector IDs.
    const std::vector<VectorId>& ids() const noexcept { return ids_; }

private:
    struct Node {
        int level = 0;
        // neighbors[layer] contains 0-based row indices of adjacent nodes
        std::vector<std::vector<std::uint32_t>> neighbors;
    };

    /// Generate random level using paper formula: floor(-ln(unif(0, 1]) * mL)
    int generateRandomLevel();

    // Internal helper for candidate pairs (distance, row_index)
    struct DistRowPair {
        float distance;
        std::uint32_t row;
    };

    // Internal helper search-layer (Paper Algorithm 2)
    std::vector<DistRowPair> searchLayer(const float* queryCoords,
                                         const std::vector<std::uint32_t>& enterPoints,
                                         std::size_t ef,
                                         int layer,
                                         HnswSearchStats* stats = nullptr,
                                         std::vector<HnswTraceStep>* trace = nullptr) const;

    // Neighbor selection: Algorithm 3 (simple) or Algorithm 4 (heuristic)
    std::vector<std::uint32_t> selectNeighbors(std::uint32_t baseRow,
                                               std::vector<DistRowPair>& candidates,
                                               std::size_t mCount,
                                               int layer) const;

    HnswParams params_;
    std::size_t mMax0_;
    std::size_t mMax_;
    double levelMult_;

    std::vector<float> data_;                                    // Flat row-major contiguous vector buffer
    std::vector<VectorId> ids_;                                  // Parallel VectorIDs
    std::unordered_map<VectorId, std::uint32_t> idToRow_;        // O(1) duplicate ID validation and ID-to-row lookup

    // Graph representation: vector of nodes indexed by row number
    std::vector<Node> nodes_;
    int entryPoint_ = -1;                                        // Row index of the entry point (-1 if empty)
    int maxLevel_ = -1;                                          // Maximum layer index currently in the graph

    // Visited-epoch tracker for O(1) resets during searchLayer
    mutable std::vector<std::uint32_t> visitedEpoch_;
    mutable std::uint32_t currentEpoch_ = 0;

    // PRNG for level generation
    std::mt19937 rng_;
    std::uniform_real_distribution<double> uniformDist_{0.0, 1.0};
};

} // namespace vectordb
