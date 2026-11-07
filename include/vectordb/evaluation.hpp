#pragma once

#include <vector>
#include "vectordb/types.hpp"

namespace vectordb {

/**
 * @brief Computes Recall@k between an exact ground-truth nearest-neighbor result set and an approximate result set.
 *
 * Recall@k is defined as:
 *   | {ids in groundTruth} ∩ {ids in approx} | / |groundTruth|
 *
 * Edge cases:
 * - If groundTruth is empty, returns 1.0 (vacuously perfect recall).
 * - If approx is empty and groundTruth is non-empty, returns 0.0.
 *
 * @param groundTruth Results from exact exhaustive search (BruteForceIndex).
 * @param approx Results from an index under evaluation (e.g. KD-Tree, HNSW).
 * @return double Recall value in the range [0.0, 1.0].
 */
double recallAtK(const std::vector<SearchResult>& groundTruth, const std::vector<SearchResult>& approx);

/**
 * @brief Computes Mean Recall@k across multiple test queries.
 *
 * @param groundTruths Collection of ground truth results for each query.
 * @param approxes Collection of approximate results for each query.
 * @return double Average recall across all queries in range [0.0, 1.0].
 * @throws std::invalid_argument if groundTruths.size() != approxes.size().
 */
double meanRecallAtK(const std::vector<std::vector<SearchResult>>& groundTruths,
                     const std::vector<std::vector<SearchResult>>& approxes);

} // namespace vectordb
