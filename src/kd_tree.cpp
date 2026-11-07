#include "vectordb/kd_tree.hpp"
#include "vectordb/distance.hpp"
#include <queue>
#include <algorithm>
#include <cmath>
#include <stdexcept>

namespace vectordb {

namespace {

// Max-heap comparator matching BruteForceIndex:
// In std::priority_queue<SearchResult, vector<SearchResult>, MaxHeapComparator>,
// returning true for (a, b) means 'a' has lower priority than 'b', so 'b' floats to top().
// We maintain a bounded max-heap of size k where the WORST candidate is at top().
// Candidate 'b' is worse than 'a' if:
// 1) b has a larger distance from the query.
// 2) On identical distance, b has a larger VectorId (tie-breaker ensures deterministic ordering).
struct MaxHeapComparator {
    bool operator()(const SearchResult& a, const SearchResult& b) const noexcept {
        if (a.distance != b.distance) {
            return a.distance < b.distance; // Larger distance is worse (floats to top)
        }
        return a.id < b.id; // Larger ID is worse (floats to top on tie)
    }
};

using ResultHeap = std::priority_queue<SearchResult, std::vector<SearchResult>, MaxHeapComparator>;

} // anonymous namespace

KdTreeIndex::KdTreeIndex(std::size_t dim, Metric metric, std::size_t leafSize)
    : VectorIndex(dim, metric), leafSize_(leafSize) {
    if (dim == 0) {
        throw std::invalid_argument("Index dimension must be greater than zero");
    }
    if (leafSize == 0) {
        throw std::invalid_argument("Leaf size must be greater than zero");
    }
}

void KdTreeIndex::insert(VectorId id, const std::vector<float>& vec) {
    if (vec.size() != dim_) {
        throw std::invalid_argument("Vector dimension (" + std::to_string(vec.size()) +
                                    ") does not match index dimension (" + std::to_string(dim_) + ")");
    }

    if (id_set_.find(id) != id_set_.end()) {
        throw std::invalid_argument("Duplicate vector ID: " + std::to_string(id) + " already exists in the index");
    }

    const std::size_t row = ids_.size();
    ids_.push_back(id);
    id_set_.insert(id);
    data_.insert(data_.end(), vec.begin(), vec.end());

    // For Cosine distance: normalize vectors for Euclidean partitioning in the KD-Tree.
    // If a vector has zero norm, it cannot be normalized (0/0 is NaN).
    // Zero vectors are tracked in zeroRows_ and evaluated directly with distance 1.0f during search.
    if (metric_ == Metric::Cosine) {
        float normSq = 0.0f;
        for (float val : vec) {
            normSq += val * val;
        }

        if (normSq <= 0.0f) {
            zeroRows_.push_back(row);
            normData_.insert(normData_.end(), dim_, 0.0f);
        } else {
            const float invNorm = 1.0f / std::sqrt(normSq);
            for (float val : vec) {
                normData_.push_back(val * invNorm);
            }
        }
    }

    // Flag tree as dirty. Rebuilding is deferred until search() or explicit build().
    dirty_ = true;
}

void KdTreeIndex::ensureBuilt() const {
    if (!dirty_) {
        return;
    }

    nodes_.clear();
    indices_.clear();

    const std::size_t n = ids_.size();
    if (n == 0) {
        root_ = -1;
        dirty_ = false;
        return;
    }

    indices_.reserve(n);

    if (metric_ == Metric::Cosine) {
        // Zero-norm vectors cannot be partitioned on the unit hypersphere.
        // We only place non-zero vectors in the KD-tree.
        std::unordered_set<std::size_t> zeroSet(zeroRows_.begin(), zeroRows_.end());
        for (std::size_t i = 0; i < n; ++i) {
            if (zeroSet.find(i) == zeroSet.end()) {
                indices_.push_back(i);
            }
        }
    } else {
        for (std::size_t i = 0; i < n; ++i) {
            indices_.push_back(i);
        }
    }

    if (indices_.empty()) {
        root_ = -1;
    } else {
        root_ = buildSubtree(0, indices_.size());
    }

    dirty_ = false;
}

int KdTreeIndex::buildSubtree(std::size_t beginIdx, std::size_t endIdx) const {
    const std::size_t count = endIdx - beginIdx;
    if (count == 0) {
        return -1;
    }

    const int nodeIdx = static_cast<int>(nodes_.size());
    nodes_.emplace_back();

    // Base case: small partition becomes a leaf node
    if (count <= leafSize_) {
        nodes_[nodeIdx].beginIdx = beginIdx;
        nodes_[nodeIdx].endIdx = endIdx;
        return nodeIdx;
    }

    // Split Dimension Selection:
    // We choose the dimension with the LARGEST SPREAD (maxVal - minVal) among points in this subtree.
    // Why this is superior to simple round-robin cycling:
    // Real-world vector datasets typically exhibit non-uniform variance across dimensions.
    // Splitting along the dimension with greatest dispersion creates more cubic, well-proportioned
    // spatial bounding boxes, drastically reducing bounding box overlap with query hyperspheres
    // and pruning substantially more branches during search.
    const float* coordData = (metric_ == Metric::Cosine) ? normData_.data() : data_.data();
    int bestDim = 0;
    float maxSpread = -1.0f;

    for (std::size_t d = 0; d < dim_; ++d) {
        float minVal = coordData[indices_[beginIdx] * dim_ + d];
        float maxVal = minVal;
        for (std::size_t i = beginIdx + 1; i < endIdx; ++i) {
            const float val = coordData[indices_[i] * dim_ + d];
            if (val < minVal) minVal = val;
            if (val > maxVal) maxVal = val;
        }
        const float spread = maxVal - minVal;
        if (spread > maxSpread) {
            maxSpread = spread;
            bestDim = static_cast<int>(d);
        }
    }

    // Edge case: All points in this range have identical coordinates across every dimension.
    // They cannot be split by any hyperplane, so we make this a leaf node.
    if (maxSpread <= 0.0f) {
        nodes_[nodeIdx].beginIdx = beginIdx;
        nodes_[nodeIdx].endIdx = endIdx;
        return nodeIdx;
    }

    // Median split using std::nth_element (O(count) linear-time selection)
    const std::size_t midIdx = beginIdx + count / 2;
    std::nth_element(indices_.begin() + beginIdx,
                     indices_.begin() + midIdx,
                     indices_.begin() + endIdx,
                     [coordData, bestDim, this](std::size_t a, std::size_t b) {
                         return coordData[a * dim_ + bestDim] < coordData[b * dim_ + bestDim];
                     });

    const float splitVal = coordData[indices_[midIdx] * dim_ + bestDim];
    nodes_[nodeIdx].splitDim = bestDim;
    nodes_[nodeIdx].splitVal = splitVal;
    nodes_[nodeIdx].beginIdx = beginIdx;
    nodes_[nodeIdx].endIdx = endIdx;

    // Note: Re-indexing nodes_[nodeIdx] after recursive calls is necessary because nodes_
    // reallocates during emplace_back in child subtrees.
    const int leftChild = buildSubtree(beginIdx, midIdx);
    nodes_[nodeIdx].leftChild = leftChild;

    const int rightChild = buildSubtree(midIdx, endIdx);
    nodes_[nodeIdx].rightChild = rightChild;

    return nodeIdx;
}

void KdTreeIndex::build() {
    dirty_ = true;
    ensureBuilt();
}

std::vector<SearchResult> KdTreeIndex::search(const std::vector<float>& query, std::size_t k) const {
    SearchStats stats;
    return searchWithStats(query, k, stats);
}

std::vector<SearchResult> KdTreeIndex::searchWithStats(const std::vector<float>& query,
                                                      std::size_t k,
                                                      SearchStats& stats) const {
    if (query.size() != dim_) {
        throw std::invalid_argument("Query vector dimension (" + std::to_string(query.size()) +
                                    ") does not match index dimension (" + std::to_string(dim_) + ")");
    }

    if (k == 0 || ids_.empty()) {
        return {};
    }

    // Lazy rebuilding:
    // If inserts occurred since last build, the tree is rebuilt on the fly.
    // Note: This mutates internal state via mutable members; this is not thread-safe
    // without concurrent reader-writer locks (will be addressed in a future task).
    ensureBuilt();

    ResultHeap heap;

    if (metric_ == Metric::Cosine) {
        // Check if query vector is a zero vector
        float qNormSq = 0.0f;
        for (float v : query) {
            qNormSq += v * v;
        }

        if (qNormSq <= 0.0f) {
            // Edge case: By VectorDB definition, cosine distance from a zero vector to ANY vector is 1.0f.
            // All indexed vectors have identical distance 1.0f.
            // Collect the top-k vectors tie-broken deterministically by smaller ID.
            for (std::size_t i = 0; i < ids_.size(); ++i) {
                SearchResult cand{ids_[i], 1.0f};
                if (heap.size() < k) {
                    heap.push(cand);
                } else {
                    const SearchResult& worst = heap.top();
                    if (cand.distance < worst.distance ||
                       (cand.distance == worst.distance && cand.id < worst.id)) {
                        heap.pop();
                        heap.push(cand);
                    }
                }
            }
        } else {
            // Normalize query for Euclidean tree traversal
            const float invQNorm = 1.0f / std::sqrt(qNormSq);
            std::vector<float> normQuery(dim_);
            for (std::size_t d = 0; d < dim_; ++d) {
                normQuery[d] = query[d] * invQNorm;
            }

            // Search KD-Tree over non-zero normalized vectors
            if (root_ != -1) {
                searchSubtree(root_, normQuery.data(), query.data(), k, &heap, stats);
            }

            // Separately evaluate all zero vectors stored in zeroRows_ (distance is identically 1.0f)
            for (std::size_t row : zeroRows_) {
                SearchResult cand{ids_[row], 1.0f};
                if (heap.size() < k) {
                    heap.push(cand);
                } else {
                    const SearchResult& worst = heap.top();
                    if (cand.distance < worst.distance ||
                       (cand.distance == worst.distance && cand.id < worst.id)) {
                        heap.pop();
                        heap.push(cand);
                    }
                }
            }
        }
    } else {
        // Euclidean or Manhattan search
        if (root_ != -1) {
            searchSubtree(root_, query.data(), query.data(), k, &heap, stats);
        }
    }

    // Extract candidates from max-heap and sort ascending by distance (tie-break by smaller ID)
    std::vector<SearchResult> results;
    results.reserve(heap.size());
    while (!heap.empty()) {
        results.push_back(heap.top());
        heap.pop();
    }

    std::sort(results.begin(), results.end(), [](const SearchResult& a, const SearchResult& b) {
        if (a.distance != b.distance) {
            return a.distance < b.distance;
        }
        return a.id < b.id;
    });

    return results;
}

void KdTreeIndex::searchSubtree(int nodeIdx,
                               const float* queryCoords,
                               const float* origQuery,
                               std::size_t k,
                               void* heapPtr,
                               SearchStats& stats) const {
    if (nodeIdx < 0 || nodeIdx >= static_cast<int>(nodes_.size())) {
        return;
    }

    ++stats.nodesVisited;
    auto& heap = *reinterpret_cast<ResultHeap*>(heapPtr);
    const KdNode& node = nodes_[nodeIdx];

    if (node.isLeaf()) {
        for (std::size_t i = node.beginIdx; i < node.endIdx; ++i) {
            const std::size_t row = indices_[i];
            const float* vecData = &data_[row * dim_];
            const float dist = distance(metric_, origQuery, vecData, dim_);
            ++stats.distanceComputations;

            SearchResult cand{ids_[row], dist};
            if (heap.size() < k) {
                heap.push(cand);
            } else {
                const SearchResult& worst = heap.top();
                if (cand.distance < worst.distance ||
                   (cand.distance == worst.distance && cand.id < worst.id)) {
                    heap.pop();
                    heap.push(cand);
                }
            }
        }
        return;
    }

    const int splitDim = node.splitDim;
    const float splitVal = node.splitVal;
    const float qVal = queryCoords[splitDim];
    const float planeDiff = qVal - splitVal;
    const float planeDist = std::fabs(planeDiff);

    const int nearChild = (planeDiff <= 0.0f) ? node.leftChild : node.rightChild;
    const int farChild  = (planeDiff <= 0.0f) ? node.rightChild : node.leftChild;

    // Step 1: Always descend to the nearer child first
    if (nearChild != -1) {
        searchSubtree(nearChild, queryCoords, origQuery, k, heapPtr, stats);
    }

    // Step 2: Branch-and-bound pruning check for the far child
    if (farChild != -1) {
        bool shouldVisitFar = false;

        if (heap.size() < k) {
            // Max-heap is not full yet -> cannot safely prune, must visit
            shouldVisitFar = true;
        } else {
            const float worstDist = heap.top().distance;

            if (metric_ == Metric::Cosine) {
                // Unit sphere lower bound:
                // For unit vectors, ||u - v||^2 = 2 * (1 - cos(u, v)) = 2 * cosine_dist.
                // In normalized coordinates, the Euclidean distance to the split plane is planeDist.
                // Any point on the far side has Euclidean distance E >= planeDist.
                // Hence, cosine distance >= 0.5 * planeDist^2.
                const float planeCosineLowerBound = 0.5f * planeDist * planeDist;

                // IMPORTANT TIE-SAFETY:
                // Skip the far side ONLY if planeCosineLowerBound is STRICTLY greater than worstDist.
                // If planeCosineLowerBound <= worstDist, an equidistant candidate with a smaller VectorId
                // could reside in the far subtree and must not be skipped.
                if (planeCosineLowerBound <= worstDist) {
                    shouldVisitFar = true;
                }
            } else {
                // For Euclidean and Manhattan, planeDist = |query[d] - splitVal| is a rigorous
                // lower bound on the distance to any point across the splitting plane.
                // Tie-safety: Skip only if planeDist > worstDist; visit if planeDist <= worstDist.
                if (planeDist <= worstDist) {
                    shouldVisitFar = true;
                }
            }
        }

        if (shouldVisitFar) {
            searchSubtree(farChild, queryCoords, origQuery, k, heapPtr, stats);
        }
    }
}

std::size_t KdTreeIndex::size() const {
    return ids_.size();
}

std::size_t KdTreeIndex::dimension() const {
    return dim_;
}

std::string KdTreeIndex::name() const {
    return "KD-Tree";
}

} // namespace vectordb

