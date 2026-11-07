#include "vectordb/hnsw.hpp"
#include "vectordb/distance.hpp"
#include <cmath>
#include <stdexcept>
#include <algorithm>
#include <queue>
#include <unordered_set>

namespace vectordb {

namespace {

// Comparison helper: returns true if candidate 'a' is strictly better than candidate 'b'.
// Smaller distance = better; tie-break by smaller VectorId.
inline bool isBetter(const HnswIndex::DistRowPair& a,
                     const HnswIndex::DistRowPair& b,
                     const std::vector<VectorId>& ids) noexcept {
    if (a.distance != b.distance) {
        return a.distance < b.distance;
    }
    return ids[a.row] < ids[b.row];
}

// Min-heap comparator for candidates set C (Paper Algorithm 2 line 3):
// The closest / best candidate must sit at top().
// Returning true means 'a' has lower priority than 'b', so 'b' floats to top.
// If 'a' is worse than 'b', comp(a, b) returns true.
struct MinDistCompare {
    const std::vector<VectorId>* ids;
    bool operator()(const HnswIndex::DistRowPair& a, const HnswIndex::DistRowPair& b) const noexcept {
        if (a.distance != b.distance) {
            return a.distance > b.distance; // larger distance is worse (smaller floats to top)
        }
        return (*ids)[a.row] > (*ids)[b.row]; // larger ID is worse (smaller floats to top)
    }
};

// Max-heap comparator for dynamic result set W (Paper Algorithm 2 line 3):
// The farthest / worst candidate must sit at top() for O(1) eviction.
// If 'b' is worse than 'a', comp(a, b) returns true so 'b' floats to top.
struct MaxDistCompare {
    const std::vector<VectorId>* ids;
    bool operator()(const HnswIndex::DistRowPair& a, const HnswIndex::DistRowPair& b) const noexcept {
        if (a.distance != b.distance) {
            return a.distance < b.distance; // larger distance floats to top
        }
        return (*ids)[a.row] < (*ids)[b.row]; // larger ID floats to top
    }
};

} // anonymous namespace

HnswIndex::HnswIndex(std::size_t dim, Metric metric, HnswParams params)
    : VectorIndex(dim, metric),
      params_(params),
      mMax0_(2 * params.M),
      mMax_(params.M),
      levelMult_(1.0 / std::log(static_cast<double>(params.M))),
      rng_(params.seed) {
    if (dim == 0) {
        throw std::invalid_argument("Index dimension must be greater than zero");
    }
    if (params_.M < 2) {
        throw std::invalid_argument("HNSW parameter M must be >= 2");
    }
    if (params_.efConstruction < params_.M) {
        throw std::invalid_argument("efConstruction must be >= M");
    }
}

int HnswIndex::generateRandomLevel() {
    // Malkov & Yashunin (2018), Algorithm 1 Line 4:
    // level = floor(-ln(unif(0, 1]) * mL), where mL = 1 / ln(M).
    // This produces an exponentially decaying geometric distribution such that
    // the probability of a node being assigned to layer l is (1/M)^l.
    double r = uniformDist_(rng_);
    if (r <= 0.0) {
        r = 1e-10; // Guard against log(0) undefined behavior
    }
    int level = static_cast<int>(std::floor(-std::log(r) * levelMult_));
    constexpr int MAX_LEVEL = 32;
    return std::min(level, MAX_LEVEL);
}

void HnswIndex::setEfSearch(std::size_t ef) {
    params_.efSearch = ef;
}

std::size_t HnswIndex::efSearch() const noexcept {
    return params_.efSearch;
}

const HnswParams& HnswIndex::params() const noexcept {
    return params_;
}

std::size_t HnswIndex::size() const {
    return ids_.size();
}

std::size_t HnswIndex::dimension() const {
    return dim_;
}

std::string HnswIndex::name() const {
    return "HNSW";
}

int HnswIndex::levelOf(VectorId id) const {
    auto it = idToRow_.find(id);
    if (it == idToRow_.end()) {
        throw std::out_of_range("VectorId " + std::to_string(id) + " not found in HnswIndex");
    }
    return nodes_[it->second].level;
}

std::vector<VectorId> HnswIndex::neighborsOf(VectorId id, int layer) const {
    auto it = idToRow_.find(id);
    if (it == idToRow_.end()) {
        throw std::out_of_range("VectorId " + std::to_string(id) + " not found in HnswIndex");
    }
    const auto& node = nodes_[it->second];
    if (layer < 0 || layer > node.level) {
        throw std::out_of_range("Layer " + std::to_string(layer) + " is out of range for VectorId " +
                                std::to_string(id) + " (max level " + std::to_string(node.level) + ")");
    }
    const auto& rowNeighbors = node.neighbors[layer];
    std::vector<VectorId> res;
    res.reserve(rowNeighbors.size());
    for (std::uint32_t r : rowNeighbors) {
        res.push_back(ids_[r]);
    }
    return res;
}

HnswGraphInfo HnswIndex::graphInfo() const {
    HnswGraphInfo info;
    info.numNodes = ids_.size();
    info.maxLevel = maxLevel_;
    info.entryPointId = (entryPoint_ >= 0) ? ids_[entryPoint_] : 0;

    if (maxLevel_ < 0) {
        return info;
    }

    const std::size_t numLayers = static_cast<std::size_t>(maxLevel_ + 1);
    info.nodesPerLayer.assign(numLayers, 0);
    info.avgDegreePerLayer.assign(numLayers, 0.0);
    info.maxDegreePerLayer.assign(numLayers, 0);

    std::vector<std::size_t> degreeSum(numLayers, 0);

    for (const auto& node : nodes_) {
        for (int l = 0; l <= node.level && l <= maxLevel_; ++l) {
            info.nodesPerLayer[l]++;
            std::size_t deg = node.neighbors[l].size();
            degreeSum[l] += deg;
            if (deg > info.maxDegreePerLayer[l]) {
                info.maxDegreePerLayer[l] = deg;
            }
        }
    }

    for (std::size_t l = 0; l < numLayers; ++l) {
        if (info.nodesPerLayer[l] > 0) {
            info.avgDegreePerLayer[l] = static_cast<double>(degreeSum[l]) /
                                       static_cast<double>(info.nodesPerLayer[l]);
        }
    }

    return info;
}

// Malkov & Yashunin (2018), Algorithm 2: SEARCH-LAYER(q, ep, ef, lc)
std::vector<HnswIndex::DistRowPair> HnswIndex::searchLayer(const float* queryCoords,
                                                           const std::vector<std::uint32_t>& enterPoints,
                                                           std::size_t ef,
                                                           int layer,
                                                           HnswSearchStats* stats,
                                                           std::vector<HnswTraceStep>* trace) const {
    if (enterPoints.empty()) {
        return {};
    }

    // Visited-epoch tracker:
    // Avoids re-allocating a visited hash set or clearing a boolean vector on every call.
    // Incrementing currentEpoch_ provides O(1) reset of visited state.
    // Note: Mutating visitedEpoch_ makes searchLayer() not thread-safe without synchronization.
    if (visitedEpoch_.size() < nodes_.size()) {
        visitedEpoch_.resize(nodes_.size(), 0);
    }
    ++currentEpoch_;
    if (currentEpoch_ == 0) {
        std::fill(visitedEpoch_.begin(), visitedEpoch_.end(), 0);
        currentEpoch_ = 1;
    }

    MinDistCompare minComp{&ids_};
    MaxDistCompare maxComp{&ids_};
    std::priority_queue<DistRowPair, std::vector<DistRowPair>, MinDistCompare> C(minComp); // Candidates to explore
    std::priority_queue<DistRowPair, std::vector<DistRowPair>, MaxDistCompare> W(maxComp); // Current best ef results

    for (std::uint32_t ep : enterPoints) {
        if (visitedEpoch_[ep] != currentEpoch_) {
            visitedEpoch_[ep] = currentEpoch_;
            float d = distance(metric_, queryCoords, &data_[ep * dim_], dim_);
            if (stats) {
                stats->distanceComputations++;
                stats->nodesVisited++;
                if (static_cast<std::size_t>(layer) < stats->visitedPerLayer.size()) {
                    stats->visitedPerLayer[layer]++;
                }
            }
            if (trace) {
                trace->push_back({layer, ids_[ep], d});
            }
            DistRowPair p{d, ep};
            C.push(p);
            W.push(p);
        }
    }

    while (!C.empty()) {
        DistRowPair curr = C.top();
        C.pop();

        DistRowPair worstInW = W.top();

        // Algorithm 2 Line 6:
        // If the closest candidate in C is worse than the furthest candidate in W,
        // no further expansion can improve W -> terminate search at this layer.
        if (W.size() >= ef && isBetter(worstInW, curr, ids_)) {
            break;
        }

        const auto& neighbors = nodes_[curr.row].neighbors[layer];
        for (std::uint32_t nId : neighbors) {
            if (visitedEpoch_[nId] != currentEpoch_) {
                visitedEpoch_[nId] = currentEpoch_;

                float d = distance(metric_, queryCoords, &data_[nId * dim_], dim_);
                if (stats) {
                    stats->distanceComputations++;
                    stats->nodesVisited++;
                    if (static_cast<std::size_t>(layer) < stats->visitedPerLayer.size()) {
                        stats->visitedPerLayer[layer]++;
                    }
                }
                if (trace) {
                    trace->push_back({layer, ids_[nId], d});
                }

                DistRowPair cand{d, nId};
                if (W.size() < ef) {
                    C.push(cand);
                    W.push(cand);
                } else if (isBetter(cand, W.top(), ids_)) {
                    C.push(cand);
                    W.pop();
                    W.push(cand);
                }
            }
        }
    }

    // Extract candidates from W and sort ascending by distance (best first)
    std::vector<DistRowPair> result;
    result.reserve(W.size());
    while (!W.empty()) {
        result.push_back(W.top());
        W.pop();
    }
    std::sort(result.begin(), result.end(), [this](const DistRowPair& a, const DistRowPair& b) {
        return isBetter(a, b, ids_);
    });
    return result;
}

// Malkov & Yashunin (2018), Algorithm 3 (Simple) and Algorithm 4 (Heuristic)
std::vector<std::uint32_t> HnswIndex::selectNeighbors(std::uint32_t baseRow,
                                                      std::vector<DistRowPair>& candidates,
                                                      std::size_t mCount,
                                                      int /*layer*/) const {
    if (candidates.empty() || mCount == 0) {
        return {};
    }

    // Filter out self-loops (cannot connect to baseRow) and duplicate rows
    std::vector<DistRowPair> filtered;
    filtered.reserve(candidates.size());
    std::unordered_set<std::uint32_t> seen;
    seen.insert(baseRow);

    for (const auto& cand : candidates) {
        if (seen.find(cand.row) == seen.end()) {
            seen.insert(cand.row);
            filtered.push_back(cand);
        }
    }

    // Sort candidates ascending by distance to baseRow (tie-break by smaller VectorId)
    std::sort(filtered.begin(), filtered.end(), [this](const DistRowPair& a, const DistRowPair& b) {
        return isBetter(a, b, ids_);
    });

    if (!params_.useHeuristic) {
        // Algorithm 3 (Simple closest-M selection)
        std::vector<std::uint32_t> selected;
        const std::size_t count = std::min(mCount, filtered.size());
        selected.reserve(count);
        for (std::size_t i = 0; i < count; ++i) {
            selected.push_back(filtered[i].row);
        }
        return selected;
    }

    // Algorithm 4 (Heuristic selection with keepPrunedConnections = true)
    // Principle: Candidate e is kept only if it is closer to the base vector than
    // to every already selected neighbor in R (i.e. dist(e, base) < dist(e, r) for all r in R).
    // This enforces directional diversity: it prevents clustering all edges along the same
    // dominant direction, ensuring paths branch out across different spatial sectors.
    std::vector<std::uint32_t> R;
    std::vector<std::uint32_t> W_discarded;
    R.reserve(mCount);

    for (const auto& cand : filtered) {
        bool keep = true;
        const float dist_e_base = cand.distance;
        const float* eVec = &data_[cand.row * dim_];

        for (std::uint32_t r : R) {
            float dist_e_r = distance(metric_, eVec, &data_[r * dim_], dim_);
            // If candidate e is closer to already chosen neighbor r than to base, reject e
            if (dist_e_r < dist_e_base ||
               (dist_e_r == dist_e_base && ids_[r] < ids_[baseRow])) {
                keep = false;
                break;
            }
        }

        if (keep) {
            R.push_back(cand.row);
        } else {
            W_discarded.push_back(cand.row);
        }

        if (R.size() >= mCount) {
            break;
        }
    }

    // keepPrunedConnections = true:
    // In clustered or isolated graph regions, the strict heuristic might select very few
    // neighbors (e.g. only 1 or 2), risking graph disconnection or dead ends during search.
    // Adding the closest discarded candidates ensures every node maintains sufficient degree
    // (up to M) to preserve high graph connectivity.
    if (R.size() < mCount) {
        for (std::uint32_t discRow : W_discarded) {
            R.push_back(discRow);
            if (R.size() >= mCount) {
                break;
            }
        }
    }

    return R;
}

// Malkov & Yashunin (2018), Algorithm 1: INSERT(hnsw, q, M, Mmax, efConstruction, mL)
void HnswIndex::insert(VectorId id, const std::vector<float>& vec) {
    if (vec.size() != dim_) {
        throw std::invalid_argument("Vector dimension (" + std::to_string(vec.size()) +
                                    ") does not match index dimension (" + std::to_string(dim_) + ")");
    }
    if (idToRow_.find(id) != idToRow_.end()) {
        throw std::invalid_argument("Duplicate vector ID: " + std::to_string(id) + " already exists in index");
    }

    const std::uint32_t newRow = static_cast<std::uint32_t>(ids_.size());
    ids_.push_back(id);
    idToRow_[id] = newRow;
    data_.insert(data_.end(), vec.begin(), vec.end());

    // Algorithm 1 Line 4: generate level for new element
    const int nodeLevel = generateRandomLevel();
    Node newNode;
    newNode.level = nodeLevel;
    newNode.neighbors.resize(nodeLevel + 1);
    nodes_.push_back(newNode);

    // Algorithm 1 Line 1: First node inserted becomes the entry point
    if (entryPoint_ < 0) {
        entryPoint_ = static_cast<int>(newRow);
        maxLevel_ = nodeLevel;
        return;
    }

    const float* qData = &data_[newRow * dim_];
    std::uint32_t currObj = static_cast<std::uint32_t>(entryPoint_);
    const int currMaxLevel = maxLevel_;

    // Algorithm 1 Lines 5-7: Greedy descent from maxLevel down to nodeLevel + 1
    // Running SEARCH-LAYER with ef = 1 to find the closest entry point
    for (int lc = currMaxLevel; lc > nodeLevel; --lc) {
        auto W = searchLayer(qData, {currObj}, 1, lc);
        if (!W.empty()) {
            currObj = W[0].row;
        }
    }

    // Algorithm 1 Lines 8-15: Search and connect from min(nodeLevel, maxLevel) down to 0
    std::vector<std::uint32_t> enterPoints = {currObj};
    const int startLayer = std::min(nodeLevel, currMaxLevel);

    for (int lc = startLayer; lc >= 0; --lc) {
        // Algorithm 1 Line 9: searchLayer with efConstruction
        auto W = searchLayer(qData, enterPoints, params_.efConstruction, lc);

        // Algorithm 1 Line 10: select M neighbors
        auto neighbors = selectNeighbors(newRow, W, params_.M, lc);

        // Algorithm 1 Lines 11-14: add bidirectional connections
        const std::size_t maxDeg = (lc == 0) ? mMax0_ : mMax_;
        for (std::uint32_t nId : neighbors) {
            // Forward connection: newRow -> nId
            nodes_[newRow].neighbors[lc].push_back(nId);

            // Reverse connection: nId -> newRow
            auto& nNeighbors = nodes_[nId].neighbors[lc];
            nNeighbors.push_back(newRow);

            // Algorithm 1 Lines 13-14: shrink neighbor list if degree exceeds maxDeg
            if (nNeighbors.size() > maxDeg) {
                std::vector<DistRowPair> candList;
                candList.reserve(nNeighbors.size());
                const float* nVec = &data_[nId * dim_];
                for (std::uint32_t candRow : nNeighbors) {
                    float d = distance(metric_, nVec, &data_[candRow * dim_], dim_);
                    candList.push_back({d, candRow});
                }
                nNeighbors = selectNeighbors(nId, candList, maxDeg, lc);
            }
        }

        // Algorithm 1 Line 15: update entry points for next layer down
        enterPoints.clear();
        enterPoints.reserve(W.size());
        for (const auto& item : W) {
            enterPoints.push_back(item.row);
        }
    }

    // Algorithm 1 Lines 16-18: update entry point if new node level exceeds current maxLevel
    if (nodeLevel > maxLevel_) {
        maxLevel_ = nodeLevel;
        entryPoint_ = static_cast<int>(newRow);
    }
}

// Malkov & Yashunin (2018), Algorithm 5: K-NN-SEARCH(hnsw, q, K, ef)
std::vector<SearchResult> HnswIndex::search(const std::vector<float>& query, std::size_t k) const {
    HnswSearchStats stats;
    return searchWithStats(query, k, stats, nullptr);
}

std::vector<SearchResult> HnswIndex::searchWithStats(const std::vector<float>& query,
                                                     std::size_t k,
                                                     HnswSearchStats& stats,
                                                     std::vector<HnswTraceStep>* trace) const {
    if (query.size() != dim_) {
        throw std::invalid_argument("Query vector dimension (" + std::to_string(query.size()) +
                                    ") does not match index dimension (" + std::to_string(dim_) + ")");
    }

    if (k == 0 || ids_.empty() || entryPoint_ < 0) {
        return {};
    }

    stats.distanceComputations = 0;
    stats.nodesVisited = 0;
    stats.visitedPerLayer.assign(maxLevel_ + 1, 0);

    if (trace) {
        trace->clear();
    }

    const float* qData = query.data();
    std::uint32_t currObj = static_cast<std::uint32_t>(entryPoint_);

    // Algorithm 5 Lines 3-6: Greedy routing on upper layers (from maxLevel down to 1)
    // Runs SEARCH-LAYER with ef = 1 to rapidly zoom in on the entry point for layer 0
    for (int lc = maxLevel_; lc >= 1; --lc) {
        auto W = searchLayer(qData, {currObj}, 1, lc, &stats, trace);
        if (!W.empty()) {
            currObj = W[0].row;
        }
    }

    // Algorithm 5 Line 7: Fine-grained search on layer 0 with ef = max(efSearch, k)
    const std::size_t ef = std::max(params_.efSearch, k);
    auto W = searchLayer(qData, {currObj}, ef, 0, &stats, trace);

    // Extract best k candidates
    const std::size_t returnCount = std::min(k, W.size());
    std::vector<SearchResult> results;
    results.reserve(returnCount);

    for (std::size_t i = 0; i < returnCount; ++i) {
        results.push_back({ids_[W[i].row], W[i].distance});
    }

    // Deterministic tie-breaking: sort ascending by distance, tie-break by smaller VectorId
    std::sort(results.begin(), results.end(), [](const SearchResult& a, const SearchResult& b) {
        if (a.distance != b.distance) {
            return a.distance < b.distance;
        }
        return a.id < b.id;
    });

    return results;
}

} // namespace vectordb
