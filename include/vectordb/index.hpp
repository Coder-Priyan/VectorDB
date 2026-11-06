#pragma once

#include <vector>
#include <string>
#include <cstddef>
#include "vectordb/types.hpp"

namespace vectordb {

/**
 * @brief Abstract base class representing a vector index.
 *
 * Designed to support Brute Force, KD-Tree, and HNSW indexes behind one uniform interface,
 * switchable dynamically at runtime. The interface provides essential vector operations
 * while leaving room for future features (removal, metadata filtering, and persistence)
 * without constraining implementations to in-memory only structures.
 */
class VectorIndex {
public:
    /**
     * @brief Construct a VectorIndex with a fixed dimensionality and distance metric.
     *
     * @param dim Dimensionality of vectors to be indexed.
     * @param metric Distance metric used for comparisons.
     */
    VectorIndex(std::size_t dim, Metric metric)
        : dim_(dim), metric_(metric) {}

    virtual ~VectorIndex() = default;

    // Prevent polymorphic slicing
    VectorIndex(const VectorIndex&) = delete;
    VectorIndex& operator=(const VectorIndex&) = delete;
    VectorIndex(VectorIndex&&) noexcept = default;
    VectorIndex& operator=(VectorIndex&&) noexcept = default;

    /**
     * @brief Insert a vector associated with a unique identifier.
     *
     * @param id Unique 64-bit vector identifier.
     * @param vec Vector values of size equal to dimension().
     * @throws std::invalid_argument if vec.size() != dimension() or if id is a duplicate.
     */
    virtual void insert(VectorId id, const std::vector<float>& vec) = 0;

    /**
     * @brief Query the index for the top-k nearest neighbors.
     *
     * @param query Query vector of size equal to dimension().
     * @param k Maximum number of nearest neighbors to retrieve.
     * @return std::vector<SearchResult> Nearest neighbors sorted in ascending order of distance.
     * @throws std::invalid_argument if query.size() != dimension().
     */
    virtual std::vector<SearchResult> search(const std::vector<float>& query, std::size_t k) const = 0;

    /// Number of vectors currently stored in the index.
    virtual std::size_t size() const = 0;

    /// Dimensionality of the vectors in this index.
    virtual std::size_t dimension() const = 0;

    /// Descriptive name of the indexing algorithm (e.g. "BruteForce", "KDTree", "HNSW").
    virtual std::string name() const = 0;

    /// Get the distance metric configured for this index.
    Metric metric() const noexcept { return metric_; }

protected:
    std::size_t dim_;
    Metric metric_;
};

} // namespace vectordb
