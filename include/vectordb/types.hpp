#pragma once

#include <cstdint>
#include <string>
#include <stdexcept>
#include <algorithm>
#include <cctype>

namespace vectordb {

/// Unique 64-bit integer identifier for every indexed vector.
using VectorId = std::uint64_t;

/// Supported distance metrics.
enum class Metric {
    Cosine,
    Euclidean,
    Manhattan
};

/// Result of a nearest-neighbor search query.
/// Note: Smaller distance = more similar for ALL metrics.
struct SearchResult {
    VectorId id;
    float distance;
};

/// Convert a Metric enum to its lowercase string representation.
inline std::string metricToString(Metric metric) {
    switch (metric) {
        case Metric::Cosine:
            return "cosine";
        case Metric::Euclidean:
            return "euclidean";
        case Metric::Manhattan:
            return "manhattan";
        default:
            throw std::invalid_argument("Unknown Metric enum value");
    }
}

/// Convert a string (case-insensitive) to its corresponding Metric enum value.
/// Throws std::invalid_argument if the metric string is not recognized.
inline Metric metricFromString(const std::string& str) {
    std::string lower;
    lower.reserve(str.size());
    for (char ch : str) {
        lower.push_back(static_cast<char>(std::tolower(static_cast<unsigned char>(ch))));
    }

    if (lower == "cosine") {
        return Metric::Cosine;
    } else if (lower == "euclidean") {
        return Metric::Euclidean;
    } else if (lower == "manhattan") {
        return Metric::Manhattan;
    } else {
        throw std::invalid_argument("Unknown metric string: " + str);
    }
}

} // namespace vectordb
