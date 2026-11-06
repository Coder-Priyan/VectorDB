#pragma once

#include "vectordb/index.hpp"
#include <vector>
#include <unordered_set>

namespace vectordb {

/**
 * @brief Exact nearest-neighbor vector index using exhaustive scan.
 *
 * Why Brute Force is essential:
 * Approximate Nearest Neighbor (ANN) indexes like KD-Trees and HNSW trade off 100% recall
 * for sub-linear query latency. To measure Recall@k and rigorously evaluate search accuracy,
 * BruteForceIndex provides the exact, non-approximate Ground Truth baseline.
 *
 * Storage Architecture:
 * - Vectors are stored in ONE contiguous, row-major std::vector<float>.
 *   Vector i is stored contiguously at index [i * dim_] through [i * dim_ + dim_ - 1].
 *   This contiguous cache-friendly layout minimizes cache misses during sequential scans
 *   and sets up easy SIMD vectorization (AVX2/NEON) and direct memory-mapped serialization later.
 * - Vector IDs are stored in a parallel std::vector<VectorId>.
 * - An std::unordered_set<VectorId> ensures O(1) detection of duplicate IDs during insertion.
 */
class BruteForceIndex : public VectorIndex {
public:
    BruteForceIndex(std::size_t dim, Metric metric);
    ~BruteForceIndex() override = default;

    void insert(VectorId id, const std::vector<float>& vec) override;
    std::vector<SearchResult> search(const std::vector<float>& query, std::size_t k) const override;
    std::size_t size() const override;
    std::size_t dimension() const override;
    std::string name() const override;

    /// Direct const pointer to row-major contiguous vector data.
    const float* data() const noexcept { return data_.data(); }

    /// Parallel vector of stored vector IDs.
    const std::vector<VectorId>& ids() const noexcept { return ids_; }

private:
    std::vector<float> data_;              // Row-major contiguous vector storage
    std::vector<VectorId> ids_;            // Parallel IDs corresponding to vector rows
    std::unordered_set<VectorId> id_set_;  // Fast O(1) lookup to disallow duplicate IDs
};

} // namespace vectordb
