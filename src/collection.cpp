#include "vectordb/collection.hpp"

#include <cmath>
#include <chrono>
#include <algorithm>
#include <stdexcept>

namespace vectordb {

namespace {

/**
 * @brief RAII guard to temporarily override HNSW efSearch and guarantee restoration upon exit.
 */
class EfSearchGuard {
public:
    EfSearchGuard(HnswIndex& index, std::optional<std::size_t> newEf)
        : index_(index), oldEf_(index.efSearch()) {
        if (newEf.has_value()) {
            if (*newEf == 0) {
                throw std::invalid_argument("efSearch must be greater than 0");
            }
            index_.setEfSearch(*newEf);
        }
    }

    ~EfSearchGuard() {
        index_.setEfSearch(oldEf_);
    }

    EfSearchGuard(const EfSearchGuard&) = delete;
    EfSearchGuard& operator=(const EfSearchGuard&) = delete;

private:
    HnswIndex& index_;
    std::size_t oldEf_;
};

} // namespace

std::string algorithmToString(Algorithm alg) {
    switch (alg) {
        case Algorithm::BruteForce: return "brute";
        case Algorithm::KdTree:     return "kdtree";
        case Algorithm::Hnsw:       return "hnsw";
    }
    return "unknown";
}

Algorithm stringToAlgorithm(const std::string& str) {
    std::string s = str;
    for (char& c : s) {
        c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    }

    if (s == "brute" || s == "bruteforce") {
        return Algorithm::BruteForce;
    }
    if (s == "kdtree" || s == "kd_tree" || s == "kd") {
        return Algorithm::KdTree;
    }
    if (s == "hnsw") {
        return Algorithm::Hnsw;
    }

    throw std::invalid_argument("Unknown algorithm: " + str + " (valid: brute, kdtree, hnsw)");
}

Collection::Collection(CollectionConfig config)
    : config_(config) {
    if (config_.dimension == 0) {
        throw std::invalid_argument("Dimension must be greater than 0");
    }
    if (config_.leafSize == 0) {
        throw std::invalid_argument("Leaf size must be greater than 0");
    }

    brute_ = std::make_unique<BruteForceIndex>(config_.dimension, config_.metric);
    kd_ = std::make_unique<KdTreeIndex>(config_.dimension, config_.metric, config_.leafSize);
    hnsw_ = std::make_unique<HnswIndex>(config_.dimension, config_.metric, config_.hnswParams);
}

void Collection::validateVector(const std::vector<float>& v) const {
    if (v.empty()) {
        throw std::invalid_argument("Vector cannot be empty");
    }
    if (v.size() != config_.dimension) {
        throw std::invalid_argument(
            "Vector dimension mismatch: expected " + std::to_string(config_.dimension) +
            ", got " + std::to_string(v.size())
        );
    }
    for (std::size_t i = 0; i < v.size(); ++i) {
        float val = v[i];
        if (std::isnan(val) || std::isinf(val)) {
            throw std::invalid_argument("Vector contains NaN or infinite values at index " + std::to_string(i));
        }
    }
}

void Collection::validateK(std::size_t k) const {
    if (k == 0 || k > 1000) {
        throw std::invalid_argument("Parameter k must be between 1 and 1000 (got " + std::to_string(k) + ")");
    }
}

VectorId Collection::insert(std::optional<VectorId> id, const std::vector<float>& v, std::string metadata) {
    std::lock_guard<std::mutex> lock(mutex_);

    validateVector(v);

    VectorId assignedId = 0;
    if (id.has_value()) {
        assignedId = *id;
        if (assignedId == 0) {
            throw std::invalid_argument("VectorId must be non-zero");
        }
        if (assignedId > MAX_SAFE_INTEGER) {
            throw std::invalid_argument(
                "VectorId " + std::to_string(assignedId) + " exceeds maximum safe JSON integer (" +
                std::to_string(MAX_SAFE_INTEGER) + ")"
            );
        }
        if (vectors_.find(assignedId) != vectors_.end()) {
            throw std::invalid_argument("Duplicate vector ID: " + std::to_string(assignedId));
        }
        if (assignedId >= nextAutoId_) {
            nextAutoId_ = assignedId + 1;
        }
    } else {
        while (vectors_.find(nextAutoId_) != vectors_.end()) {
            ++nextAutoId_;
        }
        if (nextAutoId_ > MAX_SAFE_INTEGER) {
            throw std::invalid_argument("Next auto ID exceeds maximum safe JSON integer");
        }
        assignedId = nextAutoId_++;
    }

    brute_->insert(assignedId, v);
    kd_->insert(assignedId, v);
    hnsw_->insert(assignedId, v);

    vectors_.emplace(assignedId, v);
    metadataJson_.emplace(assignedId, std::move(metadata));

    return assignedId;
}

std::vector<SearchResult> Collection::search(
    Algorithm alg,
    const std::vector<float>& query,
    std::size_t k,
    std::optional<std::size_t> ef,
    SearchStats* stats
) {
    std::lock_guard<std::mutex> lock(mutex_);

    validateVector(query);
    validateK(k);

    switch (alg) {
        case Algorithm::BruteForce:
            return brute_->search(query, k);

        case Algorithm::KdTree:
            if (stats != nullptr) {
                return kd_->searchWithStats(query, k, *stats);
            }
            return kd_->search(query, k);

        case Algorithm::Hnsw: {
            EfSearchGuard guard(*hnsw_, ef);
            return hnsw_->search(query, k);
        }
    }

    throw std::invalid_argument("Unsupported algorithm");
}

BenchmarkReport Collection::benchmarkAll(
    const std::vector<float>& query,
    std::size_t k,
    std::optional<std::size_t> ef
) {
    std::lock_guard<std::mutex> lock(mutex_);

    validateVector(query);
    validateK(k);

    BenchmarkReport report;
    report.k = k;
    report.count = vectors_.size();
    report.groundTruth = "brute";

    // 1. Brute Force (Ground Truth)
    {
        auto t0 = std::chrono::steady_clock::now();
        report.brute.results = brute_->search(query, k);
        auto t1 = std::chrono::steady_clock::now();
        report.brute.latencyUs = std::chrono::duration_cast<std::chrono::microseconds>(t1 - t0).count();
        report.brute.distanceComputations = report.count;
        report.brute.recallAtK = 1.0;
    }

    // 2. KD-Tree
    {
        SearchStats kdStats;
        auto t0 = std::chrono::steady_clock::now();
        report.kdtree.results = kd_->searchWithStats(query, k, kdStats);
        auto t1 = std::chrono::steady_clock::now();
        report.kdtree.latencyUs = std::chrono::duration_cast<std::chrono::microseconds>(t1 - t0).count();
        report.kdtree.distanceComputations = kdStats.distanceComputations;
        report.kdtree.recallAtK = recallAtK(report.brute.results, report.kdtree.results);
    }

    // 3. HNSW (with optional efSearch override)
    {
        EfSearchGuard guard(*hnsw_, ef);
        HnswSearchStats hStats;
        auto t0 = std::chrono::steady_clock::now();
        report.hnsw.results = hnsw_->searchWithStats(query, k, hStats);
        auto t1 = std::chrono::steady_clock::now();
        report.hnsw.latencyUs = std::chrono::duration_cast<std::chrono::microseconds>(t1 - t0).count();
        report.hnsw.distanceComputations = hStats.distanceComputations;
        report.hnsw.recallAtK = recallAtK(report.brute.results, report.hnsw.results);
    }

    return report;
}

std::vector<float> Collection::getVector(VectorId id) const {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = vectors_.find(id);
    if (it == vectors_.end()) {
        throw std::out_of_range("Vector ID " + std::to_string(id) + " not found");
    }
    return it->second;
}

std::string Collection::getMetadata(VectorId id) const {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = metadataJson_.find(id);
    if (it == metadataJson_.end()) {
        throw std::out_of_range("Vector ID " + std::to_string(id) + " not found");
    }
    return it->second;
}

bool Collection::contains(VectorId id) const {
    std::lock_guard<std::mutex> lock(mutex_);
    return vectors_.find(id) != vectors_.end();
}

CollectionStats Collection::stats() const {
    std::lock_guard<std::mutex> lock(mutex_);
    CollectionStats s;
    s.count = vectors_.size();
    s.dimension = config_.dimension;
    s.metric = config_.metric;
    return s;
}

HnswGraphInfo Collection::hnswInfo() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return hnsw_->graphInfo();
}

HnswNodeInfo Collection::hnswNode(VectorId id) const {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = vectors_.find(id);
    if (it == vectors_.end()) {
        throw std::out_of_range("Vector ID " + std::to_string(id) + " not found in collection");
    }

    int lvl = hnsw_->levelOf(id);
    HnswNodeInfo info;
    info.id = id;
    info.level = lvl;

    for (int l = 0; l <= lvl; ++l) {
        info.neighbors[l] = hnsw_->neighborsOf(id, l);
    }

    return info;
}

HnswTraceResult Collection::hnswTrace(
    const std::vector<float>& query,
    std::size_t k,
    std::optional<std::size_t> ef
) {
    std::lock_guard<std::mutex> lock(mutex_);

    validateVector(query);
    validateK(k);

    EfSearchGuard guard(*hnsw_, ef);
    HnswTraceResult res;
    res.results = hnsw_->searchWithStats(query, k, res.stats);
    return res;
}

void Collection::reset(const CollectionConfig& newConfig) {
    std::lock_guard<std::mutex> lock(mutex_);

    if (newConfig.dimension == 0) {
        throw std::invalid_argument("Dimension must be greater than 0");
    }
    if (newConfig.leafSize == 0) {
        throw std::invalid_argument("Leaf size must be greater than 0");
    }

    config_ = newConfig;
    nextAutoId_ = 1;
    vectors_.clear();
    metadataJson_.clear();

    brute_ = std::make_unique<BruteForceIndex>(config_.dimension, config_.metric);
    kd_ = std::make_unique<KdTreeIndex>(config_.dimension, config_.metric, config_.leafSize);
    hnsw_ = std::make_unique<HnswIndex>(config_.dimension, config_.metric, config_.hnswParams);
}

CollectionConfig Collection::getConfig() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return config_;
}

} // namespace vectordb
