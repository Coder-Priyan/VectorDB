#include "vectordb/evaluation.hpp"
#include <unordered_set>
#include <stdexcept>

namespace vectordb {

double recallAtK(const std::vector<SearchResult>& groundTruth, const std::vector<SearchResult>& approx) {
    // If ground truth is empty, there were no targets to retrieve -> perfect recall
    if (groundTruth.empty()) {
        return 1.0;
    }

    std::unordered_set<VectorId> gtIds;
    gtIds.reserve(groundTruth.size());
    for (const auto& item : groundTruth) {
        gtIds.insert(item.id);
    }

    std::unordered_set<VectorId> approxIds;
    approxIds.reserve(approx.size());
    for (const auto& item : approx) {
        approxIds.insert(item.id);
    }

    std::size_t matches = 0;
    for (const auto& id : approxIds) {
        if (gtIds.find(id) != gtIds.end()) {
            ++matches;
        }
    }

    return static_cast<double>(matches) / static_cast<double>(gtIds.size());
}

double meanRecallAtK(const std::vector<std::vector<SearchResult>>& groundTruths,
                     const std::vector<std::vector<SearchResult>>& approxes) {
    if (groundTruths.size() != approxes.size()) {
        throw std::invalid_argument("Size mismatch between groundTruths (" +
                                    std::to_string(groundTruths.size()) +
                                    ") and approxes (" +
                                    std::to_string(approxes.size()) + ")");
    }

    if (groundTruths.empty()) {
        return 1.0;
    }

    double sumRecall = 0.0;
    for (std::size_t i = 0; i < groundTruths.size(); ++i) {
        sumRecall += recallAtK(groundTruths[i], approxes[i]);
    }

    return sumRecall / static_cast<double>(groundTruths.size());
}

} // namespace vectordb
