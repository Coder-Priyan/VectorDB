#include "vectordb/distance.hpp"
#include <cmath>
#include <algorithm>
#include <stdexcept>

namespace vectordb {

// Formula: sum((a[i] - b[i])^2)
float euclideanSquared(const float* a, const float* b, std::size_t dim) {
    float sum = 0.0f;
    for (std::size_t i = 0; i < dim; ++i) {
        const float diff = a[i] - b[i];
        sum += diff * diff;
    }
    return sum;
}

// Formula: sqrt(sum((a[i] - b[i])^2))
float euclideanDistance(const float* a, const float* b, std::size_t dim) {
    return std::sqrt(euclideanSquared(a, b, dim));
}

// Formula: sum(|a[i] - b[i]|)
float manhattanDistance(const float* a, const float* b, std::size_t dim) {
    float sum = 0.0f;
    for (std::size_t i = 0; i < dim; ++i) {
        sum += std::fabs(a[i] - b[i]);
    }
    return sum;
}

// Formula: 1 - (dot(a, b) / (norm(a) * norm(b)))
float cosineDistance(const float* a, const float* b, std::size_t dim) {
    float dot = 0.0f;
    float normASq = 0.0f;
    float normBSq = 0.0f;

    for (std::size_t i = 0; i < dim; ++i) {
        dot += a[i] * b[i];
        normASq += a[i] * a[i];
        normBSq += b[i] * b[i];
    }

    // Edge case: If either vector has zero magnitude (zero norm), cosine similarity
    // is mathematically undefined (division by zero). We return 1.0f (maximum dissimilarity)
    // rather than NaN to keep downstream heap comparisons safe and deterministic.
    if (normASq <= 0.0f || normBSq <= 0.0f) {
        return 1.0f;
    }

    const float normA = std::sqrt(normASq);
    const float normB = std::sqrt(normBSq);
    const float denom = normA * normB;

    if (denom <= 0.0f) {
        return 1.0f;
    }

    float similarity = dot / denom;

    // Clamp cosine similarity to [-1.0f, 1.0f] to counteract floating-point drift
    similarity = std::clamp(similarity, -1.0f, 1.0f);

    return 1.0f - similarity;
}

float distance(Metric m, const float* a, const float* b, std::size_t dim) {
    switch (m) {
        case Metric::Cosine:
            return cosineDistance(a, b, dim);
        case Metric::Euclidean:
            return euclideanDistance(a, b, dim);
        case Metric::Manhattan:
            return manhattanDistance(a, b, dim);
        default:
            throw std::invalid_argument("Unknown Metric specified for distance calculation");
    }
}

} // namespace vectordb
