#pragma once

#include "vectordb/index.hpp"
#include <vector>
#include <unordered_set>

namespace vectordb {

/**
 * @brief Search traversal and distance computation counters for KD-Tree queries.
 */
struct SearchStats {
    std::size_t nodesVisited = 0;
    std::size_t distanceComputations = 0;
};

/**
 * @brief Exact Nearest Neighbor k-d Tree index for multi-dimensional vector search.
 *
 * Architecture & Design:
 * - Vectors are stored in ONE flat, contiguous row-major std::vector<float> data_
 *   (identical to BruteForceIndex) with a parallel std::vector<VectorId> ids_.
 *   This ensures high cache locality and avoids heap fragmentation.
 * - The tree itself is represented as a FLAT array of small KdNode structs addressed
 *   by integer array indices (no raw pointers, no std::unique_ptr per node).
 *   This design is cache-friendly, trivial to serialize to disk, and eliminates pointer overhead.
 * - Leaves store [beginIdx, endIdx) index ranges into a permutation array indices_.
 *
 * Tree Construction:
 * - Lazy rebuild: insert() appends vectors and flags the tree as dirty (dirty_ = true).
 *   The tree is rebuilt lazily upon the first search() query or when build() is explicitly called.
 *   Mutating internal state during search() uses mutable members; note that this is NOT
 *   thread-safe yet (concurrency and thread-safety will be added in a future task).
 * - Split Dimension: chosen as the dimension with the LARGEST SPREAD (max - min) across
 *   active points in that node (rather than naive round-robin cycling). This clusters coordinates
 *   more compactly, creates squarer/cubic bounding boxes, minimizes bounding box overlap
 *   with query hyperspheres, and prunes significantly more branches during search.
 * - Split Value: exact median found via std::nth_element.
 *
 * Metric Pruning:
 * - Euclidean: Hyperplane lower bound is |query[d] - splitVal|.
 * - Manhattan: |query[d] - splitVal| is also a strict mathematical lower bound for L1.
 * - Cosine: Cosine distance is not a metric and does not satisfy the triangle inequality.
 *   To enable exact KD-tree search, vectors are internally L2-normalized and indexed in Euclidean
 *   space (since for unit vectors, ||a - b||^2 = 2 * (1 - cos(a,b))).
 *   Exact cosine distance is computed using the original unnormalized vectors at leaves.
 *   Zero vectors under Cosine (whose cosine distance is 1.0f by definition) cannot be normalized
 *   and are stored in a dedicated list always evaluated as distance 1.0f.
 * - Tie Safety: The far branch is skipped ONLY if the plane distance is STRICTLY greater
 *   than the current worst distance in the heap, ensuring equal-distance candidates with
 *   smaller VectorIDs are never discarded.
 */
class KdTreeIndex : public VectorIndex {
public:
    /**
     * @brief Construct a KdTreeIndex.
     *
     * @param dim Dimensionality of vectors.
     * @param metric Distance metric (Cosine, Euclidean, Manhattan).
     * @param leafSize Maximum number of vectors contained within a leaf node (default: 8).
     * @throws std::invalid_argument if dim == 0 or leafSize == 0.
     */
    KdTreeIndex(std::size_t dim, Metric metric, std::size_t leafSize = 8);
    ~KdTreeIndex() override = default;

    void insert(VectorId id, const std::vector<float>& vec) override;
    std::vector<SearchResult> search(const std::vector<float>& query, std::size_t k) const override;
    std::size_t size() const override;
    std::size_t dimension() const override;
    std::string name() const override;

    /// Explicitly build or rebuild the KD-Tree index over all indexed vectors.
    void build();

    /**
     * @brief Search top-k nearest neighbors while recording traversal and distance calculation statistics.
     *
     * @param query Query vector of size equal to dimension().
     * @param k Number of nearest neighbors to retrieve.
     * @param stats SearchStats object populated with nodesVisited and distanceComputations.
     * @return std::vector<SearchResult> Nearest neighbors sorted in ascending order of distance.
     */
    std::vector<SearchResult> searchWithStats(const std::vector<float>& query, std::size_t k, SearchStats& stats) const;

    /// Direct const pointer to contiguous raw vector buffer.
    const float* data() const noexcept { return data_.data(); }

    /// Parallel vector of stored vector IDs.
    const std::vector<VectorId>& ids() const noexcept { return ids_; }

    std::size_t leafSize() const noexcept { return leafSize_; }
    bool isDirty() const noexcept { return dirty_; }

private:
    struct KdNode {
        int leftChild = -1;
        int rightChild = -1;
        int splitDim = -1;
        float splitVal = 0.0f;
        std::size_t beginIdx = 0;
        std::size_t endIdx = 0;

        bool isLeaf() const noexcept {
            return leftChild == -1 && rightChild == -1;
        }
    };

    // Internal const helper to rebuild the tree when dirty
    void ensureBuilt() const;

    // Recursive tree building helper
    int buildSubtree(std::size_t beginIdx, std::size_t endIdx) const;

    // Recursive branch-and-bound nearest neighbor search
    void searchSubtree(int nodeIdx,
                       const float* queryCoords,
                       const float* origQuery,
                       std::size_t k,
                       void* heapPtr,
                       SearchStats& stats) const;

    std::size_t leafSize_;
    mutable bool dirty_ = false;

    std::vector<float> data_;              // Original vector data (row-major contiguous)
    std::vector<VectorId> ids_;            // Parallel IDs
    std::unordered_set<VectorId> id_set_;  // O(1) duplicate ID validation

    // Cosine handling
    std::vector<float> normData_;          // L2-normalized vectors for Euclidean tree pruning
    std::vector<std::size_t> zeroRows_;    // Row indices of zero-norm vectors under Cosine

    // Flat KD-Tree structure
    mutable std::vector<KdNode> nodes_;
    mutable std::vector<std::size_t> indices_; // Permutation of vector row indices
    mutable int root_ = -1;
};

} // namespace vectordb
