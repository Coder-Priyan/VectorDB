#include "vectordb/dataset.hpp"
#include <random>

namespace vectordb {

std::vector<std::vector<float>> randomVectors(std::size_t n, std::size_t dim, unsigned seed) {
    std::mt19937 rng(seed);
    std::normal_distribution<float> dist(0.0f, 1.0f);

    std::vector<std::vector<float>> dataset(n, std::vector<float>(dim));
    for (std::size_t i = 0; i < n; ++i) {
        for (std::size_t d = 0; d < dim; ++d) {
            dataset[i][d] = dist(rng);
        }
    }
    return dataset;
}

} // namespace vectordb
