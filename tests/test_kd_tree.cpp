#include "test_harness.hpp"
#include "vectordb/kd_tree.hpp"
#include "vectordb/brute_force.hpp"
#include "vectordb/dataset.hpp"
#include "vectordb/evaluation.hpp"
#include <cmath>
#include <vector>
#include <algorithm>

using namespace vectordb;

TEST(KdTreeTest, SmallHandMadeDatasetAllMetrics) {
    // 2D dataset:
    // id 1: [1.0, 0.0]
    // id 2: [0.0, 1.0]
    // id 3: [1.0, 1.0]
    // id 4: [2.0, 0.0]
    // id 5: [0.0, 2.0]
    const std::vector<std::pair<VectorId, std::vector<float>>> dataset = {
        {1, {1.0f, 0.0f}},
        {2, {0.0f, 1.0f}},
        {3, {1.0f, 1.0f}},
        {4, {2.0f, 0.0f}},
        {5, {0.0f, 2.0f}}
    };

    // 1. Euclidean Metric (Query [0.0, 0.0], k = 3)
    {
        KdTreeIndex kdIndex(2, Metric::Euclidean, 2);
        BruteForceIndex bruteIndex(2, Metric::Euclidean);

        for (const auto& item : dataset) {
            kdIndex.insert(item.first, item.second);
            bruteIndex.insert(item.first, item.second);
        }

        const std::vector<float> query = {0.0f, 0.0f};
        const auto kdResults = kdIndex.search(query, 3);
        const auto bruteResults = bruteIndex.search(query, 3);

        CHECK(kdResults.size() == 3);
        CHECK(bruteResults.size() == 3);
        CHECK_NEAR(recallAtK(bruteResults, kdResults), 1.0, 1e-6);

        CHECK(kdResults[0].id == 1);
        CHECK_NEAR(kdResults[0].distance, 1.0f, 1e-6f);
        CHECK(kdResults[1].id == 2);
        CHECK_NEAR(kdResults[1].distance, 1.0f, 1e-6f);
        CHECK(kdResults[2].id == 3);
        CHECK_NEAR(kdResults[2].distance, std::sqrt(2.0f), 1e-6f);
    }

    // 2. Manhattan Metric (Query [0.0, 0.0], k = 3)
    {
        KdTreeIndex kdIndex(2, Metric::Manhattan, 2);
        BruteForceIndex bruteIndex(2, Metric::Manhattan);

        for (const auto& item : dataset) {
            kdIndex.insert(item.first, item.second);
            bruteIndex.insert(item.first, item.second);
        }

        const std::vector<float> query = {0.0f, 0.0f};
        const auto kdResults = kdIndex.search(query, 3);
        const auto bruteResults = bruteIndex.search(query, 3);

        CHECK(kdResults.size() == 3);
        CHECK_NEAR(recallAtK(bruteResults, kdResults), 1.0, 1e-6);
        CHECK(kdResults[0].id == 1);
        CHECK_NEAR(kdResults[0].distance, 1.0f, 1e-6f);
        CHECK(kdResults[1].id == 2);
        CHECK_NEAR(kdResults[1].distance, 1.0f, 1e-6f);
        CHECK(kdResults[2].id == 3);
        CHECK_NEAR(kdResults[2].distance, 2.0f, 1e-6f);
    }

    // 3. Cosine Metric (Query [3.0, 0.0], k = 2)
    {
        KdTreeIndex kdIndex(2, Metric::Cosine, 2);
        BruteForceIndex bruteIndex(2, Metric::Cosine);

        for (const auto& item : dataset) {
            kdIndex.insert(item.first, item.second);
            bruteIndex.insert(item.first, item.second);
        }

        const std::vector<float> query = {3.0f, 0.0f};
        const auto kdResults = kdIndex.search(query, 2);
        const auto bruteResults = bruteIndex.search(query, 2);

        CHECK(kdResults.size() == 2);
        CHECK_NEAR(recallAtK(bruteResults, kdResults), 1.0, 1e-6);
        CHECK(kdResults[0].id == 1);
        CHECK_NEAR(kdResults[0].distance, 0.0f, 1e-6f);
        CHECK(kdResults[1].id == 4);
        CHECK_NEAR(kdResults[1].distance, 0.0f, 1e-6f);
    }
}

TEST(KdTreeTest, EdgeCasesAndValidation) {
    // Constructor validations
    CHECK_THROWS(KdTreeIndex(0, Metric::Euclidean, 8), std::invalid_argument);
    CHECK_THROWS(KdTreeIndex(2, Metric::Euclidean, 0), std::invalid_argument);

    KdTreeIndex index(3, Metric::Euclidean, 2);
    const std::vector<float> q = {1.0f, 2.0f, 3.0f};

    // Empty index search returns empty
    CHECK(index.search(q, 5).empty());

    // Single vector insertion and search
    index.insert(42, {1.0f, 0.0f, 0.0f});
    CHECK(index.size() == 1);
    CHECK(index.dimension() == 3);
    CHECK(index.name() == "KD-Tree");

    auto singleRes = index.search(q, 1);
    CHECK(singleRes.size() == 1);
    CHECK(singleRes[0].id == 42);

    // k = 0 returns empty
    CHECK(index.search(q, 0).empty());

    // k > size() returns all vectors (1 vector)
    auto allRes = index.search(q, 10);
    CHECK(allRes.size() == 1);

    // Wrong dimension on insert throws
    CHECK_THROWS(index.insert(43, {1.0f, 2.0f}), std::invalid_argument);
    CHECK_THROWS(index.insert(44, {1.0f, 2.0f, 3.0f, 4.0f}), std::invalid_argument);

    // Duplicate ID on insert throws
    CHECK_THROWS(index.insert(42, {0.0f, 1.0f, 0.0f}), std::invalid_argument);

    // Wrong dimension on search throws
    CHECK_THROWS(index.search({1.0f, 2.0f}, 1), std::invalid_argument);
    CHECK_THROWS(index.search({1.0f, 2.0f, 3.0f, 4.0f}, 1), std::invalid_argument);
}

TEST(KdTreeTest, AllIdenticalVectorsAndTieStress) {
    KdTreeIndex index(2, Metric::Euclidean, 2);

    // Insert 6 points with identical coordinates in arbitrary ID order
    index.insert(50, {2.0f, 2.0f});
    index.insert(10, {2.0f, 2.0f});
    index.insert(30, {2.0f, 2.0f});
    index.insert(20, {2.0f, 2.0f});
    index.insert(60, {2.0f, 2.0f});
    index.insert(40, {2.0f, 2.0f});

    const std::vector<float> query = {2.0f, 2.0f};
    const auto results = index.search(query, 4);

    CHECK(results.size() == 4);
    // Must be deterministically ordered by smaller ID on distance ties
    CHECK(results[0].id == 10);
    CHECK(results[1].id == 20);
    CHECK(results[2].id == 30);
    CHECK(results[3].id == 40);
    for (const auto& r : results) {
        CHECK_NEAR(r.distance, 0.0f, 1e-6f);
    }
}

TEST(KdTreeTest, InsertAfterSearchTriggersLazyRebuild) {
    KdTreeIndex index(2, Metric::Euclidean, 2);
    index.insert(1, {10.0f, 10.0f});
    index.insert(2, {20.0f, 20.0f});

    const std::vector<float> query = {0.0f, 0.0f};
    auto res1 = index.search(query, 1);
    CHECK(res1.size() == 1);
    CHECK(res1[0].id == 1); // ID 1 is closer

    // Now insert a much closer point at [1.0, 1.0]
    CHECK(!index.isDirty());
    index.insert(3, {1.0f, 1.0f});
    CHECK(index.isDirty());

    // Search again: must lazily rebuild and return ID 3
    auto res2 = index.search(query, 1);
    CHECK(!index.isDirty());
    CHECK(res2.size() == 1);
    CHECK(res2[0].id == 3);
    CHECK_NEAR(res2[0].distance, std::sqrt(2.0f), 1e-5f);
}

TEST(KdTreeTest, CosineWithZeroVectorsMixed) {
    KdTreeIndex kdIndex(3, Metric::Cosine, 2);
    BruteForceIndex bruteIndex(3, Metric::Cosine);

    // Mix of non-zero and zero vectors
    const std::vector<std::pair<VectorId, std::vector<float>>> items = {
        {10, {1.0f, 0.0f, 0.0f}},
        {20, {0.0f, 0.0f, 0.0f}}, // Zero vector
        {30, {0.0f, 1.0f, 0.0f}},
        {40, {0.0f, 0.0f, 0.0f}}, // Zero vector
        {50, {0.0f, 0.0f, 1.0f}}
    };

    for (const auto& it : items) {
        kdIndex.insert(it.first, it.second);
        bruteIndex.insert(it.first, it.second);
    }

    // Query 1: non-zero query [1.0, 0.0, 0.0], k = 5
    {
        const std::vector<float> q = {1.0f, 0.0f, 0.0f};
        auto kdRes = kdIndex.search(q, 5);
        auto bruteRes = bruteIndex.search(q, 5);

        CHECK(kdRes.size() == 5);
        CHECK_NEAR(recallAtK(bruteRes, kdRes), 1.0, 1e-6);

        // ID 10 is identical (dist = 0)
        CHECK(kdRes[0].id == 10);
        CHECK_NEAR(kdRes[0].distance, 0.0f, 1e-6f);

        // Zero vectors must have distance 1.0f
        for (std::size_t i = 0; i < 5; ++i) {
            CHECK_NEAR(kdRes[i].distance, bruteRes[i].distance, 1e-5f);
        }
    }

    // Query 2: all-zero query vector [0.0, 0.0, 0.0]
    {
        const std::vector<float> zeroQuery = {0.0f, 0.0f, 0.0f};
        auto kdRes = kdIndex.search(zeroQuery, 3);
        auto bruteRes = bruteIndex.search(zeroQuery, 3);

        CHECK(kdRes.size() == 3);
        CHECK_NEAR(recallAtK(bruteRes, kdRes), 1.0, 1e-6);
        for (std::size_t i = 0; i < 3; ++i) {
            CHECK(kdRes[i].id == bruteRes[i].id);
            CHECK_NEAR(kdRes[i].distance, 1.0f, 1e-6f);
        }
    }
}

TEST(KdTreeTest, MainCorrectnessAgainstBruteForce) {
    constexpr std::size_t n = 2000;
    constexpr std::size_t numQueries = 50;
    constexpr std::size_t k = 10;
    const std::vector<std::size_t> testDims = {2, 3, 8, 16};
    const std::vector<Metric> metrics = {
        Metric::Cosine,
        Metric::Euclidean,
        Metric::Manhattan
    };

    for (Metric metric : metrics) {
        for (std::size_t dim : testDims) {
            const auto data = randomVectors(n, dim, 100 + static_cast<unsigned>(dim));
            const auto queries = randomVectors(numQueries, dim, 500 + static_cast<unsigned>(dim));

            KdTreeIndex kdTree(dim, metric, 8);
            BruteForceIndex brute(dim, metric);

            for (std::size_t i = 0; i < n; ++i) {
                const VectorId id = static_cast<VectorId>(i + 1);
                kdTree.insert(id, data[i]);
                brute.insert(id, data[i]);
            }

            for (std::size_t q = 0; q < numQueries; ++q) {
                const auto kdRes = kdTree.search(queries[q], k);
                const auto bruteRes = brute.search(queries[q], k);

                CHECK(kdRes.size() == k);
                CHECK(bruteRes.size() == k);

                // Recall@10 must be strictly 1.0
                const double recall = recallAtK(bruteRes, kdRes);
                CHECK_NEAR(recall, 1.0, 1e-6);

                // Compare distances and ids at every rank
                for (std::size_t r = 0; r < k; ++r) {
                    CHECK_NEAR(kdRes[r].distance, bruteRes[r].distance, 1e-4f);
                    // If distances match strictly, IDs must match
                    if (std::fabs(kdRes[r].distance - bruteRes[r].distance) < 1e-6f) {
                        CHECK(kdRes[r].id == bruteRes[r].id);
                    }
                }
            }
        }
    }
}

TEST(KdTreeTest, LeafSizeVariationsGiveIdenticalResults) {
    constexpr std::size_t n = 500;
    constexpr std::size_t dim = 4;
    constexpr std::size_t k = 10;

    const auto data = randomVectors(n, dim, 777);
    const auto query = randomVectors(1, dim, 888)[0];

    const std::vector<std::size_t> leafSizes = {1, 4, 8, 64};
    std::vector<SearchResult> referenceResults;

    for (std::size_t i = 0; i < leafSizes.size(); ++i) {
        KdTreeIndex index(dim, Metric::Euclidean, leafSizes[i]);
        for (std::size_t j = 0; j < n; ++j) {
            index.insert(static_cast<VectorId>(j + 1), data[j]);
        }

        const auto res = index.search(query, k);
        CHECK(res.size() == k);

        if (i == 0) {
            referenceResults = res;
        } else {
            CHECK_NEAR(recallAtK(referenceResults, res), 1.0, 1e-6);
            for (std::size_t r = 0; r < k; ++r) {
                CHECK(res[r].id == referenceResults[r].id);
                CHECK_NEAR(res[r].distance, referenceResults[r].distance, 1e-5f);
            }
        }
    }
}

TEST(KdTreeTest, SearchStatsAndPruningProof) {
    constexpr std::size_t n = 1000;
    constexpr std::size_t dim = 2; // Low dimension (2D)
    constexpr std::size_t k = 5;

    // In 2D, KD-tree pruning is highly effective
    const auto data = randomVectors(n, dim, 999);
    const auto query = randomVectors(1, dim, 111)[0];

    KdTreeIndex index(dim, Metric::Euclidean, 8);
    for (std::size_t i = 0; i < n; ++i) {
        index.insert(static_cast<VectorId>(i + 1), data[i]);
    }

    SearchStats stats;
    const auto res = index.searchWithStats(query, k, stats);

    CHECK(res.size() == k);
    CHECK(stats.nodesVisited > 0);

    // Distance computations must be substantially less than n = 1000 in 2D
    CHECK(stats.distanceComputations < n);
    CHECK(stats.distanceComputations > 0);
}
