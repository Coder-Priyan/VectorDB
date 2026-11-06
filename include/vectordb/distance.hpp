#pragma once

#include <cstddef>
#include "vectordb/types.hpp"

namespace vectordb {

/**
 * @brief Computes the squared Euclidean distance between two vectors.
 * Formula: sum((a[i] - b[i])^2) for i from 0 to dim - 1.
 * Omit the square root to avoid costly floating-point sqrt operations when comparing distances.
 *
 * @param a Pointer to the first vector's components.
 * @param b Pointer to the second vector's components.
 * @param dim Dimensionality of the vectors.
 * @return Squared Euclidean distance (L2^2).
 */
float euclideanSquared(const float* a, const float* b, std::size_t dim);

/**
 * @brief Computes the standard Euclidean distance (L2 norm) between two vectors.
 * Formula: sqrt(sum((a[i] - b[i])^2)) for i from 0 to dim - 1.
 * Measures straight-line geometric distance in n-dimensional Euclidean space.
 *
 * @param a Pointer to the first vector's components.
 * @param b Pointer to the second vector's components.
 * @param dim Dimensionality of the vectors.
 * @return Euclidean distance (L2).
 */
float euclideanDistance(const float* a, const float* b, std::size_t dim);

/**
 * @brief Computes the Manhattan distance (L1 norm / taxicab metric) between two vectors.
 * Formula: sum(|a[i] - b[i]|) for i from 0 to dim - 1.
 * Measures the sum of absolute coordinate differences.
 *
 * @param a Pointer to the first vector's components.
 * @param b Pointer to the second vector's components.
 * @param dim Dimensionality of the vectors.
 * @return Manhattan distance (L1).
 */
float manhattanDistance(const float* a, const float* b, std::size_t dim);

/**
 * @brief Computes the Cosine distance between two vectors.
 * Formula: 1 - cosine_similarity = 1 - (a . b) / (||a|| * ||b||).
 * Measures the angular difference between vector directions regardless of scale.
 *
 * Edge case handling:
 * If either vector has zero norm (magnitude is 0, e.g. an all-zero vector), cosine
 * similarity is undefined. We return 1.0f (maximum dissimilarity / orthogonal angle)
 * instead of NaN to ensure robust numerical behavior and avoid poisoning downstream heaps.
 * Cosine similarity is clamped to [-1.0f, 1.0f] to prevent floating-point inaccuracies
 * from causing values outside the mathematical range.
 *
 * @param a Pointer to the first vector's components.
 * @param b Pointer to the second vector's components.
 * @param dim Dimensionality of the vectors.
 * @return Cosine distance in range [0.0f, 2.0f].
 */
float cosineDistance(const float* a, const float* b, std::size_t dim);

/**
 * @brief Dispatches the distance computation based on the specified Metric enum.
 *
 * @param m Distance metric to apply (Cosine, Euclidean, or Manhattan).
 * @param a Pointer to the first vector's components.
 * @param b Pointer to the second vector's components.
 * @param dim Dimensionality of the vectors.
 * @return Computed distance value.
 */
float distance(Metric m, const float* a, const float* b, std::size_t dim);

} // namespace vectordb
