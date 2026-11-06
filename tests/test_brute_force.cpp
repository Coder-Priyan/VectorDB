#include "test_harness.hpp"
#include "vectordb/brute_force.hpp"
#include "vectordb/distance.hpp"
#include "vectordb/types.hpp"
#include <random>
#include <vector>
#include <algorithm>

using namespace vectordb;

TEST(BruteForceTest, SmallHandMadeDatasetAllMetrics) {
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

    // 1. Euclidean Metric
    {
        BruteForceIndex index(2, Metric::Euclidean);
        for (const auto& item : dataset) {
            index.insert(item.first, item.second);
        }
        CHECK(index.size() == 5);
        CHECK(index.dimension() == 2);
        CHECK(index.name() == "BruteForce");

        // Query: [0.0, 0.0], k = 3
        // Distances: id 1 -> 1.0, id 2 -> 1.0, id 3 -> sqrt(2) ≈ 1.414, id 4 -> 2.0, id 5 -> 2.0
        // Ties between id 1 and id 2 broken by smaller ID (1 < 2)
        const std::vector<float> query = {0.0f, 0.0f};
        const auto results = index.search(query, 3);

        CHECK(results.size() == 3);
        CHECK(results[0].id == 1);
        CHECK_NEAR(results[0].distance, 1.0f, 1e-6f);
        CHECK(results[1].id == 2);
        CHECK_NEAR(results[1].distance, 1.0f, 1e-6f);
        CHECK(results[2].id == 3);
        CHECK_NEAR(results[2].distance, std::sqrt(2.0f), 1e-6f);

        // Verify sorted ascending order
        for (std::size_t i = 1; i < results.size(); ++i) {
            CHECK(results[i].distance >= results[i - 1].distance);
        }
    }

    // 2. Manhattan Metric
    {
        BruteForceIndex index(2, Metric::Manhattan);
        for (const auto& item : dataset) {
            index.insert(item.first, item.second);
        }
        const std::vector<float> query = {0.0f, 0.0f};
        const auto results = index.search(query, 3);

        CHECK(results.size() == 3);
        CHECK(results[0].id == 1);
        CHECK_NEAR(results[0].distance, 1.0f, 1e-6f);
        CHECK(results[1].id == 2);
        CHECK_NEAR(results[1].distance, 1.0f, 1e-6f);
        CHECK(results[2].id == 3);
        CHECK_NEAR(results[2].distance, 2.0f, 1e-6f); // |1-0| + |1-0| = 2.0
    }

    // 3. Cosine Metric
    {
        BruteForceIndex index(2, Metric::Cosine);
        for (const auto& item : dataset) {
            index.insert(item.first, item.second);
        }
        // Query along x-axis: [3.0, 0.0]
        // Cosine distance to [1.0, 0.0] and [2.0, 0.0] is 0.0
        // Tie-breaker: id 1 < id 4
        const std::vector<float> query = {3.0f, 0.0f};
        const auto results = index.search(query, 2);

        CHECK(results.size() == 2);
        CHECK(results[0].id == 1);
        CHECK_NEAR(results[0].distance, 0.0f, 1e-6f);
        CHECK(results[1].id == 4);
        CHECK_NEAR(results[1].distance, 0.0f, 1e-6f);
    }
}

TEST(BruteForceTest, EdgeCasesAndSizes) {
    BruteForceIndex index(3, Metric::Euclidean);

    // Empty index search returns empty
    const std::vector<float> q = {1.0f, 2.0f, 3.0f};
    CHECK(index.search(q, 5).empty());

    // Insert 2 vectors
    index.insert(100, {1.0f, 0.0f, 0.0f});
    index.insert(200, {0.0f, 1.0f, 0.0f});
    CHECK(index.size() == 2);

    // k = 0 returns empty
    CHECK(index.search(q, 0).empty());

    // k > size() returns all elements
    auto allResults = index.search(q, 10);
    CHECK(allResults.size() == 2);
}

TEST(BruteForceTest, ValidationAndExceptions) {
    // Dimension 0 constructor throws
    CHECK_THROWS(BruteForceIndex(0, Metric::Cosine), std::invalid_argument);

    BruteForceIndex index(3, Metric::Euclidean);
    index.insert(1, {1.0f, 2.0f, 3.0f});

    // Wrong dimension on insert throws
    CHECK_THROWS(index.insert(2, {1.0f, 2.0f}), std::invalid_argument);
    CHECK_THROWS(index.insert(3, {1.0f, 2.0f, 3.0f, 4.0f}), std::invalid_argument);

    // Duplicate ID on insert throws
    CHECK_THROWS(index.insert(1, {4.0f, 5.0f, 6.0f}), std::invalid_argument);

    // Wrong dimension on search throws
    CHECK_THROWS(index.search({1.0f, 2.0f}, 5), std::invalid_argument);
    CHECK_THROWS(index.search({1.0f, 2.0f, 3.0f, 4.0f}, 5), std::invalid_argument);
}

TEST(BruteForceTest, DeterministicTieBreaking) {
    BruteForceIndex index(2, Metric::Euclidean);

    // Multiple equidistant points (distance 0 from query [1.0, 1.0])
    // Inserted in arbitrary order
    index.insert(50, {1.0f, 1.0f});
    index.insert(10, {1.0f, 1.0f});
    index.insert(30, {1.0f, 1.0f});
    index.insert(20, {1.0f, 1.0f});
    index.insert(40, {1.0f, 1.0f});

    const std::vector<float> query = {1.0f, 1.0f};
    const auto results = index.search(query, 3);

    CHECK(results.size() == 3);
    // Must be tie-broken deterministically by smaller ID: 10, 20, 30
    CHECK(results[0].id == 10);
    CHECK(results[1].id == 20);
    CHECK(results[2].id == 30);
    CHECK_NEAR(results[0].distance, 0.0f, 1e-6f);
    CHECK_NEAR(results[1].distance, 0.0f, 1e-6f);
    CHECK_NEAR(results[2].distance, 0.0f, 1e-6f);
}

TEST(BruteForceTest, CrossCheckWithNaiveFullSort1000Vectors) {
    constexpr std::size_t n = 1000;
    constexpr std::size_t dim = 16;
    constexpr std::size_t k = 15;

    std::mt19937 rng(42);
    std::normal_distribution<float> dist(0.0f, 1.0f);

    std::vector<std::vector<float>> vectors(n, std::vector<float>(dim));
    for (std::size_t i = 0; i < n; ++i) {
        for (std::size_t d = 0; d < dim; ++d) {
            vectors[i][d] = dist(rng);
        }
    }

    std::vector<float> query(dim);
    for (std::size_t d = 0; d < dim; ++d) {
        query[d] = dist(rng);
    }

    const std::vector<Metric> metricsToTest = {
        Metric::Cosine,
        Metric::Euclidean,
        Metric::Manhattan
    };

    for (Metric metric : metricsToTest) {
        BruteForceIndex index(dim, metric);
        for (std::size_t i = 0; i < n; ++i) {
            index.insert(static_cast<VectorId>(i + 1), vectors[i]);
        }

        // 1. Search via BruteForceIndex (max-heap implementation)
        const auto indexResults = index.search(query, k);

        // 2. Naive full sort implementation inside the test
        std::vector<SearchResult> naiveResults;
        naiveResults.reserve(n);
        for (std::size_t i = 0; i < n; ++i) {
            const float d = distance(metric, query.data(), vectors[i].data(), dim);
            naiveResults.push_back({static_cast<VectorId>(i + 1), d});
        }

        std::sort(naiveResults.begin(), naiveResults.end(), [](const SearchResult& a, const SearchResult& b) {
            if (a.distance != b.distance) {
                return a.distance < b.distance;
            }
            return a.id < b.id;
        });
        naiveResults.resize(k);

        // 3. Strict verification of equality
        CHECK(indexResults.size() == k);
        CHECK(naiveResults.size() == k);

        for (std::size_t j = 0; j < k; ++j) {
            CHECK(indexResults[j].id == naiveResults[j].id);
            CHECK_NEAR(indexResults[j].distance, naiveResults[j].distance, 1e-5f);
        }
    }
}
