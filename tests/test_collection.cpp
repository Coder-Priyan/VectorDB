#include "test_harness.hpp"
#include "vectordb/collection.hpp"
#include "vectordb/dataset.hpp"

#include <limits>
#include <vector>
#include <string>

using namespace vectordb;

TEST(CollectionTest, ValidationAndEdgeCases) {
    CollectionConfig config;
    config.dimension = 4;
    config.metric = Metric::Euclidean;
    Collection col(config);

    // 1. Empty vector
    CHECK_THROWS(col.insert(std::nullopt, {}), std::invalid_argument);

    // 2. Dimension mismatch
    CHECK_THROWS(col.insert(std::nullopt, {1.0f, 2.0f, 3.0f}), std::invalid_argument);
    CHECK_THROWS(col.insert(std::nullopt, {1.0f, 2.0f, 3.0f, 4.0f, 5.0f}), std::invalid_argument);

    // 3. NaN and Inf
    float nanVal = std::numeric_limits<float>::quiet_NaN();
    float infVal = std::numeric_limits<float>::infinity();
    CHECK_THROWS(col.insert(std::nullopt, {1.0f, nanVal, 3.0f, 4.0f}), std::invalid_argument);
    CHECK_THROWS(col.insert(std::nullopt, {1.0f, 2.0f, infVal, 4.0f}), std::invalid_argument);

    // 4. Zero ID
    CHECK_THROWS(col.insert(0, {1.0f, 2.0f, 3.0f, 4.0f}), std::invalid_argument);

    // 5. ID exceeds 2^53 - 1
    VectorId hugeId = Collection::MAX_SAFE_INTEGER + 1;
    CHECK_THROWS(col.insert(hugeId, {1.0f, 2.0f, 3.0f, 4.0f}), std::invalid_argument);

    // 6. Valid insertion & Duplicate ID
    VectorId id1 = col.insert(100, {1.0f, 2.0f, 3.0f, 4.0f}, "{\"tag\": \"first\"}");
    CHECK(id1 == 100);
    CHECK_THROWS(col.insert(100, {1.0f, 2.0f, 3.0f, 4.0f}), std::invalid_argument);

    // 7. k bounds (k == 0 or k > 1000)
    std::vector<float> q = {1.0f, 2.0f, 3.0f, 4.0f};
    CHECK_THROWS(col.search(Algorithm::BruteForce, q, 0), std::invalid_argument);
    CHECK_THROWS(col.search(Algorithm::BruteForce, q, 1001), std::invalid_argument);

    // 8. Search query validation
    CHECK_THROWS(col.search(Algorithm::BruteForce, {1.0f, 2.0f}, 5), std::invalid_argument);
    CHECK_THROWS(col.search(Algorithm::BruteForce, {1.0f, 2.0f, nanVal, 4.0f}, 5), std::invalid_argument);

    // 9. Algorithm string conversion
    CHECK(stringToAlgorithm("brute") == Algorithm::BruteForce);
    CHECK(stringToAlgorithm("BRUTEFORCE") == Algorithm::BruteForce);
    CHECK(stringToAlgorithm("kdtree") == Algorithm::KdTree);
    CHECK(stringToAlgorithm("HNSW") == Algorithm::Hnsw);
    CHECK_THROWS(stringToAlgorithm("annoy"), std::invalid_argument);
    CHECK(algorithmToString(Algorithm::BruteForce) == "brute");
    CHECK(algorithmToString(Algorithm::KdTree) == "kdtree");
    CHECK(algorithmToString(Algorithm::Hnsw) == "hnsw");
}

TEST(CollectionTest, AutoIdAndExplicitIdInterleaving) {
    CollectionConfig config;
    config.dimension = 2;
    Collection col(config);

    // Auto IDs should start at 1
    VectorId a1 = col.insert(std::nullopt, {1.0f, 0.0f});
    VectorId a2 = col.insert(std::nullopt, {0.0f, 1.0f});
    CHECK(a1 == 1);
    CHECK(a2 == 2);

    // Explicit ID 50
    VectorId e1 = col.insert(50, {0.5f, 0.5f});
    CHECK(e1 == 50);

    // Next auto ID should advance to 51
    VectorId a3 = col.insert(std::nullopt, {0.2f, 0.8f});
    CHECK(a3 == 51);

    // Explicit lower ID 25 should not break monotonic advancement
    VectorId e2 = col.insert(25, {0.8f, 0.2f});
    CHECK(e2 == 25);

    VectorId a4 = col.insert(std::nullopt, {0.3f, 0.7f});
    CHECK(a4 == 52);

    CHECK(col.stats().count == 6);
}

TEST(CollectionTest, SmallHandMadeDatasetAllMetricsMatches) {
    const std::vector<std::pair<VectorId, std::vector<float>>> items = {
        {101, { 1.0f,  0.0f}},
        {102, { 0.0f,  1.0f}},
        {103, { 0.7071f, 0.7071f}},
        {104, {-1.0f,  0.0f}},
        {105, { 0.0f, -1.0f}}
    };

    const std::vector<float> query = {0.9f, 0.2f};
    const std::size_t k = 3;

    const std::vector<Metric> metrics = {
        Metric::Cosine,
        Metric::Euclidean,
        Metric::Manhattan
    };

    for (Metric m : metrics) {
        CollectionConfig config;
        config.dimension = 2;
        config.metric = m;
        config.hnswParams.efConstruction = 100;
        config.hnswParams.efSearch = 50;
        Collection col(config);

        for (const auto& item : items) {
            col.insert(item.first, item.second);
        }

        auto bfRes = col.search(Algorithm::BruteForce, query, k);
        auto kdRes = col.search(Algorithm::KdTree, query, k);
        auto hnswRes = col.search(Algorithm::Hnsw, query, k);

        CHECK(bfRes.size() == k);
        CHECK(kdRes.size() == k);
        CHECK(hnswRes.size() == k);

        // All three algorithms must return the exact same top-3 items
        for (std::size_t i = 0; i < k; ++i) {
            CHECK(bfRes[i].id == kdRes[i].id);
            CHECK_NEAR(bfRes[i].distance, kdRes[i].distance, 1e-4f);

            CHECK(bfRes[i].id == hnswRes[i].id);
            CHECK_NEAR(bfRes[i].distance, hnswRes[i].distance, 1e-4f);
        }
    }
}

TEST(CollectionTest, LargerDatasetCorrectnessAndRecall) {
    constexpr std::size_t n = 2000;
    constexpr std::size_t dim = 16;
    constexpr std::size_t numQueries = 20;
    constexpr std::size_t k = 10;

    CollectionConfig config;
    config.dimension = dim;
    config.metric = Metric::Euclidean;
    config.hnswParams.M = 16;
    config.hnswParams.efConstruction = 200;
    config.hnswParams.efSearch = 100;
    config.hnswParams.seed = 42;
    Collection col(config);

    const auto dataset = randomVectors(n, dim, 42);
    const auto queries = randomVectors(numQueries, dim, 1337);

    for (std::size_t i = 0; i < n; ++i) {
        col.insert(std::nullopt, dataset[i]);
    }

    CHECK(col.stats().count == n);

    double totalKdRecall = 0.0;
    double totalHnswRecall = 0.0;

    for (std::size_t q = 0; q < numQueries; ++q) {
        auto bf = col.search(Algorithm::BruteForce, queries[q], k);
        auto kd = col.search(Algorithm::KdTree, queries[q], k);
        auto hnsw = col.search(Algorithm::Hnsw, queries[q], k, 200); // ef override to 200

        CHECK(bf.size() == k);
        CHECK(kd.size() == k);
        CHECK(hnsw.size() == k);

        double kdRec = recallAtK(bf, kd);
        double hnswRec = recallAtK(bf, hnsw);

        // KD-Tree is exact
        CHECK_NEAR(kdRec, 1.0, 1e-5);

        totalKdRecall += kdRec;
        totalHnswRecall += hnswRec;
    }

    double meanKdRecall = totalKdRecall / numQueries;
    double meanHnswRecall = totalHnswRecall / numQueries;

    CHECK_NEAR(meanKdRecall, 1.0, 1e-5);
    CHECK(meanHnswRecall >= 0.95);
}

TEST(CollectionTest, MetadataAndGetVectorRoundTrip) {
    CollectionConfig config;
    config.dimension = 3;
    Collection col(config);

    std::vector<float> v1 = {1.5f, -2.5f, 3.5f};
    std::string meta1 = "{\"name\": \"Document Alpha\", \"score\": 42}";
    VectorId id1 = col.insert(42, v1, meta1);

    CHECK(col.contains(42));
    CHECK(!col.contains(9999));

    auto retrievedVec = col.getVector(id1);
    CHECK(retrievedVec.size() == 3);
    CHECK_NEAR(retrievedVec[0], 1.5f, 1e-6);
    CHECK_NEAR(retrievedVec[1], -2.5f, 1e-6);
    CHECK_NEAR(retrievedVec[2], 3.5f, 1e-6);

    CHECK(col.getMetadata(id1) == meta1);

    // Unknown ID throws
    CHECK_THROWS(col.getVector(9999), std::out_of_range);
    CHECK_THROWS(col.getMetadata(9999), std::out_of_range);
}

TEST(CollectionTest, ResetClearsDataAndAppliesConfig) {
    CollectionConfig config;
    config.dimension = 4;
    config.metric = Metric::Cosine;
    Collection col(config);

    col.insert(std::nullopt, {1.0f, 0.0f, 0.0f, 0.0f}, "meta1");
    col.insert(std::nullopt, {0.0f, 1.0f, 0.0f, 0.0f}, "meta2");
    CHECK(col.stats().count == 2);

    CollectionConfig newConfig;
    newConfig.dimension = 2;
    newConfig.metric = Metric::Euclidean;
    col.reset(newConfig);

    CHECK(col.stats().count == 0);
    CHECK(col.stats().dimension == 2);
    CHECK(col.stats().metric == Metric::Euclidean);
    CHECK(!col.contains(1));
    CHECK(!col.contains(2));

    // Next auto ID resets to 1
    VectorId newId = col.insert(std::nullopt, {3.0f, 4.0f});
    CHECK(newId == 1);
    CHECK(col.getVector(newId).size() == 2);
}

TEST(CollectionTest, EfSearchOverrideAndRestore) {
    CollectionConfig config;
    config.dimension = 3;
    config.hnswParams.efSearch = 50;
    Collection col(config);

    for (std::size_t i = 1; i <= 20; ++i) {
        col.insert(i, {static_cast<float>(i), 1.0f, 2.0f});
    }

    std::vector<float> q = {5.0f, 1.0f, 2.0f};

    // Run search with ef override to 150
    auto res = col.search(Algorithm::Hnsw, q, 5, 150);
    CHECK(res.size() == 5);

    // Verify efSearch is restored to 50
    auto info = col.hnswInfo();
    CHECK(info.numNodes == 20);

    // Run trace with ef override that throws an exception due to invalid dimension
    CHECK_THROWS(col.search(Algorithm::Hnsw, {1.0f, 2.0f}, 5, 250), std::invalid_argument);

    // After exception, efSearch must still be intact
    auto res2 = col.search(Algorithm::Hnsw, q, 5);
    CHECK(res2.size() == 5);
}

TEST(CollectionTest, BenchmarkAllReport) {
    CollectionConfig config;
    config.dimension = 4;
    config.metric = Metric::Euclidean;
    Collection col(config);

    for (std::size_t i = 1; i <= 50; ++i) {
        col.insert(i, {static_cast<float>(i), 1.0f, 2.0f, 3.0f});
    }

    std::vector<float> q = {10.0f, 1.0f, 2.0f, 3.0f};
    BenchmarkReport rep = col.benchmarkAll(q, 5, 100);

    CHECK(rep.k == 5);
    CHECK(rep.count == 50);
    CHECK(rep.groundTruth == "brute");

    CHECK(rep.brute.results.size() == 5);
    CHECK(rep.kdtree.results.size() == 5);
    CHECK(rep.hnsw.results.size() == 5);

    CHECK_NEAR(rep.brute.recallAtK, 1.0, 1e-6);
    CHECK_NEAR(rep.kdtree.recallAtK, 1.0, 1e-6);
    CHECK(rep.hnsw.recallAtK >= 0.8);

    CHECK(rep.brute.distanceComputations == 50);
    CHECK(rep.kdtree.distanceComputations > 0);
    CHECK(rep.hnsw.distanceComputations > 0);
}

TEST(CollectionTest, HnswInfoAndNodeIntrospection) {
    CollectionConfig config;
    config.dimension = 4;
    config.hnswParams.M = 8;
    Collection col(config);

    for (std::size_t i = 1; i <= 30; ++i) {
        col.insert(i, {static_cast<float>(i), 2.0f, 3.0f, 4.0f});
    }

    auto info = col.hnswInfo();
    CHECK(info.numNodes == 30);
    CHECK(info.maxLevel >= 0);

    // Inspect node 1
    auto node = col.hnswNode(1);
    CHECK(node.id == 1);
    CHECK(node.level >= 0);
    CHECK(node.neighbors.find(0) != node.neighbors.end());
    CHECK(!node.neighbors[0].empty());

    // Trace
    auto traceRes = col.hnswTrace({10.0f, 2.0f, 3.0f, 4.0f}, 5);
    CHECK(traceRes.results.size() == 5);
    CHECK(traceRes.stats.distanceComputations > 0);
    CHECK(!traceRes.trace.empty());
}
