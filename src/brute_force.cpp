#include "vectordb/brute_force.hpp"
#include "vectordb/distance.hpp"
#include <queue>
#include <algorithm>
#include <stdexcept>

namespace vectordb {

BruteForceIndex::BruteForceIndex(std::size_t dim, Metric metric)
    : VectorIndex(dim, metric) {
    if (dim == 0) {
        throw std::invalid_argument("Index dimension must be greater than zero");
    }
}

void BruteForceIndex::insert(VectorId id, const std::vector<float>& vec) {
    if (vec.size() != dim_) {
        throw std::invalid_argument("Vector dimension (" + std::to_string(vec.size()) +
                                    ") does not match index dimension (" + std::to_string(dim_) + ")");
    }

    if (id_set_.find(id) != id_set_.end()) {
        throw std::invalid_argument("Duplicate vector ID: " + std::to_string(id) + " already exists in the index");
    }

    ids_.push_back(id);
    id_set_.insert(id);
    data_.insert(data_.end(), vec.begin(), vec.end());
}

std::vector<SearchResult> BruteForceIndex::search(const std::vector<float>& query, std::size_t k) const {
    if (query.size() != dim_) {
        throw std::invalid_argument("Query vector dimension (" + std::to_string(query.size()) +
                                    ") does not match index dimension (" + std::to_string(dim_) + ")");
    }

    if (k == 0 || ids_.empty()) {
        return {};
    }

    // Max-Heap Comparator for Top-k Retrieval:
    // In std::priority_queue<T, Container, Compare>, Compare(a, b) == true means 'a' has
    // lower priority than 'b', causing 'b' to float towards top().
    // We want a bounded MAX-heap of size k holding the current best candidates, with the
    // WORST candidate at top() so it can be evicted when a superior candidate appears.
    //
    // An element is "worse" if:
    // 1) It has a larger distance from the query.
    // 2) Ties: it has a larger VectorId (tie-breaker ensures deterministic ordering).
    //
    // Thus, if candidate 'b' is worse than 'a', Compare(a, b) returns true.
    struct MaxHeapComparator {
        bool operator()(const SearchResult& a, const SearchResult& b) const noexcept {
            if (a.distance != b.distance) {
                return a.distance < b.distance; // Larger distance is worse (floats to top)
            }
            return a.id < b.id; // Larger ID is worse (floats to top on distance tie)
        }
    };

    std::priority_queue<SearchResult, std::vector<SearchResult>, MaxHeapComparator> maxHeap;

    const std::size_t n = ids_.size();
    const float* qData = query.data();

    for (std::size_t i = 0; i < n; ++i) {
        const float* vecData = &data_[i * dim_];
        const float dist = distance(metric_, qData, vecData, dim_);
        const SearchResult candidate{ids_[i], dist};

        if (maxHeap.size() < k) {
            maxHeap.push(candidate);
        } else {
            const SearchResult& worst = maxHeap.top();
            // Candidate is strictly better if smaller distance, or equal distance with smaller ID
            if (candidate.distance < worst.distance ||
               (candidate.distance == worst.distance && candidate.id < worst.id)) {
                maxHeap.pop();
                maxHeap.push(candidate);
            }
        }
    }

    std::vector<SearchResult> results;
    results.reserve(maxHeap.size());
    while (!maxHeap.empty()) {
        results.push_back(maxHeap.top());
        maxHeap.pop();
    }

    // Sort ascending: smallest distance first; on tie, smaller ID first
    std::sort(results.begin(), results.end(), [](const SearchResult& a, const SearchResult& b) {
        if (a.distance != b.distance) {
            return a.distance < b.distance;
        }
        return a.id < b.id;
    });

    return results;
}

std::size_t BruteForceIndex::size() const {
    return ids_.size();
}

std::size_t BruteForceIndex::dimension() const {
    return dim_;
}

std::string BruteForceIndex::name() const {
    return "BruteForce";
}

} // namespace vectordb
