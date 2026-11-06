#pragma once

#include <vector>
#include <cstddef>

namespace vectordb {

/**
 * @brief Generates reproducible pseudo-random vectors drawn from a standard normal distribution.
 *
 * Uses std::mt19937 and std::normal_distribution<float>(0.0f, 1.0f).
 * Providing the same seed guarantees identical dataset generation across runs,
 * which is essential for reproducible benchmarking and future Recall@k evaluation.
 *
 * @param n Number of vectors to generate.
 * @param dim Dimensionality of each vector.
 * @param seed Seed for the Mersenne Twister PRNG engine.
 * @return std::vector<std::vector<float>> Vector of generated n vectors.
 */
std::vector<std::vector<float>> randomVectors(std::size_t n, std::size_t dim, unsigned seed = 42);

} // namespace vectordb
