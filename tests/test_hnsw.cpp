#include "test_harness.hpp"
#include "vectordb/hnsw.hpp"
#include "vectordb/brute_force.hpp"
#include "vectordb/dataset.hpp"
#include "vectordb/evaluation.hpp"
#include <cmath>
#include <vector>
#include <unordered_set>
#include <algorithm>

using namespace vectordb;

TEST(HnswTest, ConstructorValidation) {
    // Bad M (< 2) throws
    HnswParams p1;
    p1.M = 1;
    CHECK_THROWS(HnswIndex(4, Metric::Euclidean, p1), std::invalid_argument);

    // Bad efConstruction (< M) throws
    HnswParams p2;
    p2.M = 16;
    p2.efConstruction = 10;
    CHECK_THROWS(HnswIndex(4, Metric::Euclidean, p2), std::invalid_argument);

    // Bad dimension (0) throws
    HnswParams p3;
    CHECK_THROWS(HnswIndex(0, Metric::Euclidean, p3), std::invalid_argument);
}

TEST(HnswTest, EdgeCasesAndValidation) {
    HnswIndex index(3, Metric::Euclidean);
    const std::vector<float> q = {1.0f, 2.0f, 3.0f};

    // Empty index search returns empty
    CHECK(index.search(q, 5).empty());

    // Single vector insertion and search
    index.insert(100, {1.0f, 0.0f, 0.0f});
    CHECK(index.size() == 1);
    CHECK(index.dimension() == 3);
    CHECK(index.name() == "HNSW");

    auto res1 = index.search(q, 1);
    CHECK(res1.size() == 1);
    CHECK(res1[0].id == 100);

    // k == 0 returns empty
    CHECK(index.search(q, 0).empty());

    // k > size returns all vectors
    auto resAll = index.search(q, 10);
    CHECK(resAll.size() == 1);

    // Two vectors
    index.insert(200, {1.0f, 2.0f, 2.0f});
    CHECK(index.size() == 2);
    auto resTwo = index.search(q, 2);
    CHECK(resTwo.size() == 2);
    CHECK(resTwo[0].id == 200); // [1,2,2] is distance 1 from [1,2,3]
    CHECK(resTwo[1].id == 100);

    // Wrong dimension on insert throws
    CHECK_THROWS(index.insert(300, {1.0f, 2.0f}), std::invalid_argument);
    CHECK_THROWS(index.insert(400, {1.0f, 2.0f, 3.0f, 4.0f}), std::invalid_argument);

    // Duplicate ID on insert throws
    CHECK_THROWS(index.insert(100, {0.0f, 0.0f, 0.0f}), std::invalid_argument);

    // Wrong dimension on search throws
    CHECK_THROWS(index.search({1.0f, 2.0f}, 2), std::invalid_argument);
}

TEST(HnswTest, AllIdenticalVectorsAndTieStress) {
    HnswIndex index(2, Metric::Euclidean);

    // Insert 6 identical points in arbitrary ID order
    index.insert(50, {3.0f, 3.0f});
    index.insert(10, {3.0f, 3.0f});
    index.insert(40, {3.0f, 3.0f});
    index.insert(20, {3.0f, 3.0f});
    index.insert(60, {3.0f, 3.0f});
    index.insert(30, {3.0f, 3.0f});

    const std::vector<float> query = {3.0f, 3.0f};
    index.setEfSearch(10);
    const auto results = index.search(query, 4);

    CHECK(results.size() == 4);
    // Must be tie-broken deterministically by smaller ID: 10, 20, 30, 40
    CHECK(results[0].id == 10);
    CHECK(results[1].id == 20);
    CHECK(results[2].id == 30);
    CHECK(results[3].id == 40);
    for (const auto& r : results) {
        CHECK_NEAR(r.distance, 0.0f, 1e-6f);
    }
}

TEST(HnswTest, SmallHandMadeDatasetMatchesBruteForce) {
    const std::vector<std::pair<VectorId, std::vector<float>>> dataset = {
        {1, {1.0f, 0.0f}},
        {2, {0.0f, 1.0f}},
        {3, {1.0f, 1.0f}},
        {4, {2.0f, 0.0f}},
        {5, {0.0f, 2.0f}}
    };

    const std::vector<Metric> metrics = {
        Metric::Cosine,
        Metric::Euclidean,
        Metric::Manhattan
    };

    for (Metric metric : metrics) {
        HnswParams p;
        p.M = 4;
        p.efConstruction = 20;
        p.efSearch = 20; // efSearch >= size guarantees full coverage

        HnswIndex hnsw(2, metric, p);
        BruteForceIndex brute(2, metric);

        for (const auto& item : dataset) {
            hnsw.insert(item.first, item.second);
            brute.insert(item.first, item.second);
        }

        const std::vector<float> query = {0.8f, 0.3f};
        const auto hnswRes = hnsw.search(query, 3);
        const auto bruteRes = brute.search(query, 3);

        CHECK(hnswRes.size() == 3);
        CHECK(bruteRes.size() == 3);
        CHECK_NEAR(recallAtK(bruteRes, hnswRes), 1.0, 1e-6);

        for (std::size_t r = 0; r < 3; ++r) {
            CHECK(hnswRes[r].id == bruteRes[r].id);
            CHECK_NEAR(hnswRes[r].distance, bruteRes[r].distance, 1e-5f);
        }
    }
}

TEST(HnswTest, GraphInvariants) {
    constexpr std::size_t n = 3000;
    constexpr std::size_t dim = 16;

    const std::vector<Metric> metrics = {
        Metric::Euclidean,
        Metric::Cosine,
        Metric::Manhattan
    };

    for (Metric metric : metrics) {
        HnswParams p;
        p.M = 16;
        p.efConstruction = 100;
        p.seed = 12345;

        HnswIndex index(dim, metric, p);
        const auto data = randomVectors(n, dim, 42);

        for (std::size_t i = 0; i < n; ++i) {
            index.insert(static_cast<VectorId>(i + 1), data[i]);
        }

        const auto info = index.graphInfo();
        CHECK(info.numNodes == n);
        CHECK(info.maxLevel >= 1);
        CHECK(index.levelOf(info.entryPointId) == info.maxLevel);
        CHECK(info.nodesPerLayer.size() == static_cast<std::size_t>(info.maxLevel + 1));
        CHECK(info.nodesPerLayer[0] == n);

        // Nodes per layer must be non-increasing with layer
        for (std::size_t l = 1; l < info.nodesPerLayer.size(); ++l) {
            CHECK(info.nodesPerLayer[l] <= info.nodesPerLayer[l - 1]);
        }

        const std::size_t mMax0 = 2 * p.M;
        const std::size_t mMax = p.M;

        // Invariant checks across every node and layer
        for (std::size_t i = 0; i < n; ++i) {
            VectorId id = static_cast<VectorId>(i + 1);
            int nodeLvl = index.levelOf(id);
            CHECK(nodeLvl >= 0);
            CHECK(nodeLvl <= info.maxLevel);

            for (int l = 0; l <= nodeLvl; ++l) {
                auto neighbors = index.neighborsOf(id, l);
                const std::size_t maxAllowed = (l == 0) ? mMax0 : mMax;
                CHECK(neighbors.size() <= maxAllowed);

                std::unordered_set<VectorId> uniqueSet;
                for (VectorId nId : neighbors) {
                    // No self-loops
                    CHECK(nId != id);
                    // Neighbor must have level >= l
                    CHECK(index.levelOf(nId) >= l);
                    uniqueSet.insert(nId);
                }
                // No duplicate neighbors
                CHECK(uniqueSet.size() == neighbors.size());
            }
        }
    }
}

TEST(HnswTest, LevelDistribution) {
    constexpr std::size_t n = 20000;
    constexpr std::size_t dim = 4;
    HnswParams p;
    p.M = 16;
    p.seed = 999;

    HnswIndex index(dim, Metric::Euclidean, p);
    const auto data = randomVectors(n, dim, 777);

    for (std::size_t i = 0; i < n; ++i) {
        index.insert(static_cast<VectorId>(i + 1), data[i]);
    }

    const auto info = index.graphInfo();
    CHECK(info.maxLevel >= 2);

    // Number of nodes with level >= 1 is nodesPerLayer[1]
    const double fractionLevel1OrHigher = static_cast<double>(info.nodesPerLayer[1]) / static_cast<double>(n);
    const double expectedFraction = 1.0 / static_cast<double>(p.M); // 1/16 = 0.0625

    // Within 25% relative tolerance
    const double lowerBound = expectedFraction * 0.75;
    const double upperBound = expectedFraction * 1.25;

    CHECK(fractionLevel1OrHigher >= lowerBound);
    CHECK(fractionLevel1OrHigher <= upperBound);
}

TEST(HnswTest, ReproducibilityWithSeed) {
    constexpr std::size_t n = 500;
    constexpr std::size_t dim = 8;
    const auto data = randomVectors(n, dim, 555);
    const auto query = randomVectors(1, dim, 666)[0];

    HnswParams pA;
    pA.seed = 42;
    HnswIndex indexA1(dim, Metric::Euclidean, pA);
    HnswIndex indexA2(dim, Metric::Euclidean, pA);

    for (std::size_t i = 0; i < n; ++i) {
        VectorId id = static_cast<VectorId>(i + 1);
        indexA1.insert(id, data[i]);
        indexA2.insert(id, data[i]);
    }

    const auto info1 = indexA1.graphInfo();
    const auto info2 = indexA2.graphInfo();

    CHECK(info1.numNodes == info2.numNodes);
    CHECK(info1.maxLevel == info2.maxLevel);
    CHECK(info1.entryPointId == info2.entryPointId);
    CHECK(info1.nodesPerLayer == info2.nodesPerLayer);

    const auto res1 = indexA1.search(query, 10);
    const auto res2 = indexA2.search(query, 10);

    CHECK(res1.size() == 10);
    CHECK(res2.size() == 10);
    for (std::size_t r = 0; r < 10; ++r) {
        CHECK(res1[r].id == res2[r].id);
        CHECK_NEAR(res1[r].distance, res2[r].distance, 1e-6f);
    }
}

TEST(HnswTest, RecallAgainstBruteForceAcrossEfSearch) {
    constexpr std::size_t n = 5000;
    constexpr std::size_t dim = 16;
    constexpr std::size_t numQueries = 100;
    constexpr std::size_t k = 10;

    const auto data = randomVectors(n, dim, 123);
    const auto queries = randomVectors(numQueries, dim, 456);

    HnswParams p;
    p.M = 16;
    p.efConstruction = 200;
    p.seed = 42;

    HnswIndex hnsw(dim, Metric::Euclidean, p);
    BruteForceIndex brute(dim, Metric::Euclidean);

    for (std::size_t i = 0; i < n; ++i) {
        VectorId id = static_cast<VectorId>(i + 1);
        hnsw.insert(id, data[i]);
        brute.insert(id, data[i]);
    }

    std::vector<std::vector<SearchResult>> groundTruth(numQueries);
    for (std::size_t q = 0; q < numQueries; ++q) {
        groundTruth[q] = brute.search(queries[q], k);
    }

    // 1. Monotonic recall check as efSearch increases: 10, 20, 50, 100, 200
    const std::vector<std::size_t> efValues = {10, 20, 50, 100, 200};
    double prevRecall = 0.0;

    for (std::size_t ef : efValues) {
        hnsw.setEfSearch(ef);
        std::vector<std::vector<SearchResult>> approx(numQueries);
        for (std::size_t q = 0; q < numQueries; ++q) {
            approx[q] = hnsw.search(queries[q], k);
        }
        double meanRec = meanRecallAtK(groundTruth, approx);

        if (ef == 100) {
            // Requirement: dim 16 Euclidean at efSearch = 100 must reach mean recall >= 0.98
            CHECK(meanRec >= 0.98);
        }

        // Monotonic non-decreasing check (with 0.01 tolerance)
        CHECK(meanRec >= prevRecall - 0.01);
        prevRecall = meanRec;
    }

    // 2. efSearch = size => mean recall >= 0.99
    hnsw.setEfSearch(n);
    std::vector<std::vector<SearchResult>> approxAll(numQueries);
    for (std::size_t q = 0; q < numQueries; ++q) {
        approxAll[q] = hnsw.search(queries[q], k);
    }
    double meanRecAll = meanRecallAtK(groundTruth, approxAll);
    CHECK(meanRecAll >= 0.99);

    // 3. Cosine and Manhattan check at dim 16 with efSearch = 100 (require >= 0.95)
    for (Metric metric : {Metric::Cosine, Metric::Manhattan}) {
        HnswIndex hIndex(dim, metric, p);
        BruteForceIndex bIndex(dim, metric);

        for (std::size_t i = 0; i < n; ++i) {
            VectorId id = static_cast<VectorId>(i + 1);
            hIndex.insert(id, data[i]);
            bIndex.insert(id, data[i]);
        }

        hIndex.setEfSearch(100);
        std::vector<std::vector<SearchResult>> gt(numQueries);
        std::vector<std::vector<SearchResult>> ap(numQueries);

        for (std::size_t q = 0; q < numQueries; ++q) {
            gt[q] = bIndex.search(queries[q], k);
            ap[q] = hIndex.search(queries[q], k);
        }

        double rec = meanRecallAtK(gt, ap);
        CHECK(rec >= 0.95);
    }
}

TEST(HnswTest, UseHeuristicFalseBuildsValidGraphAndHighRecall) {
    constexpr std::size_t n = 5000;
    constexpr std::size_t dim = 16;
    constexpr std::size_t numQueries = 100;
    constexpr std::size_t k = 10;

    const auto data = randomVectors(n, dim, 123);
    const auto queries = randomVectors(numQueries, dim, 456);

    HnswParams p;
    p.M = 16;
    p.efConstruction = 200;
    p.useHeuristic = false; // Simple closest-M (Algorithm 3)
    p.seed = 42;

    HnswIndex hnsw(dim, Metric::Euclidean, p);
    BruteForceIndex brute(dim, Metric::Euclidean);

    for (std::size_t i = 0; i < n; ++i) {
        VectorId id = static_cast<VectorId>(i + 1);
        hnsw.insert(id, data[i]);
        brute.insert(id, data[i]);
    }

    hnsw.setEfSearch(100);
    std::vector<std::vector<SearchResult>> groundTruth(numQueries);
    std::vector<std::vector<SearchResult>> approx(numQueries);

    for (std::size_t q = 0; q < numQueries; ++q) {
        groundTruth[q] = brute.search(queries[q], k);
        approx[q] = hnsw.search(queries[q], k);
    }

    double rec = meanRecallAtK(groundTruth, approx);
    // Requirement: recall >= 0.90 for useHeuristic = false
    CHECK(rec >= 0.90);
}

TEST(HnswTest, ObservabilityStatsTraceAndNeighborsOf) {
    constexpr std::size_t n = 1000;
    constexpr std::size_t dim = 8;
    const auto data = randomVectors(n, dim, 111);
    const auto query = randomVectors(1, dim, 222)[0];

    HnswParams p;
    p.M = 16;
    p.efConstruction = 100;
    p.efSearch = 50;

    HnswIndex index(dim, Metric::Euclidean, p);
    for (std::size_t i = 0; i < n; ++i) {
        index.insert(static_cast<VectorId>(i + 1), data[i]);
    }

    HnswSearchStats stats;
    std::vector<HnswTraceStep> trace;
    const auto results = index.searchWithStats(query, 10, stats, &trace);

    CHECK(results.size() == 10);
    CHECK(stats.distanceComputations > 0);
    CHECK(stats.distanceComputations < n);
    CHECK(stats.nodesVisited > 0);

    const auto info = index.graphInfo();
    CHECK(stats.visitedPerLayer.size() == static_cast<std::size_t>(info.maxLevel + 1));

    // Trace checks
    CHECK(!trace.empty());
    CHECK(trace.front().layer == info.maxLevel);
    CHECK(trace.size() == stats.nodesVisited);

    // Consistency of neighborsOf and levelOf
    VectorId sampleId = 1;
    int sampleLevel = index.levelOf(sampleId);
    CHECK(sampleLevel >= 0);
    for (int l = 0; l <= sampleLevel; ++l) {
        auto nbrs = index.neighborsOf(sampleId, l);
        CHECK(!nbrs.empty());
    }

    // Out of range throw checks
    CHECK_THROWS(index.levelOf(999999), std::out_of_range);
    CHECK_THROWS(index.neighborsOf(999999, 0), std::out_of_range);
    CHECK_THROWS(index.neighborsOf(sampleId, sampleLevel + 1), std::out_of_range);
    CHECK_THROWS(index.neighborsOf(sampleId, -1), std::out_of_range);
}
