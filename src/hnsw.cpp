#include "vectordb/hnsw.hpp"
#include "vectordb/distance.hpp"
#include <cmath>
#include <stdexcept>
#include <algorithm>

namespace vectordb {

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
    // Paper: level = floor(-ln(unif(0, 1]) * mL)
    // where mL = 1 / ln(M)
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

// Temporary stubs for insert and search (to be implemented in subsequent commits)
void HnswIndex::insert(VectorId id, const std::vector<float>& vec) {
    if (vec.size() != dim_) {
        throw std::invalid_argument("Vector dimension mismatch");
    }
    if (idToRow_.find(id) != idToRow_.end()) {
        throw std::invalid_argument("Duplicate vector ID: " + std::to_string(id));
    }
    // Stub
}

std::vector<SearchResult> HnswIndex::search(const std::vector<float>& query, std::size_t k) const {
    HnswSearchStats stats;
    return searchWithStats(query, k, stats, nullptr);
}

std::vector<SearchResult> HnswIndex::searchWithStats(const std::vector<float>& /*query*/,
                                                     std::size_t /*k*/,
                                                     HnswSearchStats& /*stats*/,
                                                     std::vector<HnswTraceStep>* /*trace*/) const {
    return {};
}

std::vector<HnswIndex::DistRowPair> HnswIndex::searchLayer(const float* /*queryCoords*/,
                                                           const std::vector<std::uint32_t>& /*enterPoints*/,
                                                           std::size_t /*ef*/,
                                                           int /*layer*/,
                                                           HnswSearchStats* /*stats*/,
                                                           std::vector<HnswTraceStep>* /*trace*/) const {
    return {};
}

std::vector<std::uint32_t> HnswIndex::selectNeighbors(std::uint32_t /*baseRow*/,
                                                      std::vector<DistRowPair>& /*candidates*/,
                                                      std::size_t /*mCount*/,
                                                      int /*layer*/) const {
    return {};
}

} // namespace vectordb
