#include "test_harness.hpp"
#include "vectordb/distance.hpp"
#include "vectordb/types.hpp"
#include <cmath>
#include <vector>

using namespace vectordb;

TEST(DistanceTest, KnownHandComputedValues) {
    // 2D orthogonal unit vectors: [1, 0] and [0, 1]
    const std::vector<float> a = {1.0f, 0.0f};
    const std::vector<float> b = {0.0f, 1.0f};

    // Cosine: dot=0 => sim=0 => distance = 1 - 0 = 1.0
    CHECK_NEAR(cosineDistance(a.data(), b.data(), 2), 1.0f, 1e-6f);

    // Euclidean: sqrt((1-0)^2 + (0-1)^2) = sqrt(2) ≈ 1.41421356
    CHECK_NEAR(euclideanDistance(a.data(), b.data(), 2), std::sqrt(2.0f), 1e-6f);
    CHECK_NEAR(euclideanSquared(a.data(), b.data(), 2), 2.0f, 1e-6f);

    // Manhattan: |1-0| + |0-1| = 2.0
    CHECK_NEAR(manhattanDistance(a.data(), b.data(), 2), 2.0f, 1e-6f);

    // 3D vector pair: [1, 2, 3] and [4, 5, 6]
    const std::vector<float> u = {1.0f, 2.0f, 3.0f};
    const std::vector<float> v = {4.0f, 5.0f, 6.0f};
    // dot = 4 + 10 + 18 = 32
    // ||u|| = sqrt(1+4+9) = sqrt(14) ≈ 3.741657
    // ||v|| = sqrt(16+25+36) = sqrt(77) ≈ 8.774964
    // denom = sqrt(1078) ≈ 32.83291
    // sim = 32 / 32.83291 ≈ 0.9746318
    // cosine dist = 1 - sim ≈ 0.025368
    const float expectedCos = 1.0f - (32.0f / std::sqrt(14.0f * 77.0f));
    CHECK_NEAR(cosineDistance(u.data(), v.data(), 3), expectedCos, 1e-5f);

    // Euclidean: sqrt(3^2 + 3^2 + 3^2) = sqrt(27) ≈ 5.1961524
    CHECK_NEAR(euclideanDistance(u.data(), v.data(), 3), std::sqrt(27.0f), 1e-5f);
    CHECK_NEAR(euclideanSquared(u.data(), v.data(), 3), 27.0f, 1e-5f);

    // Manhattan: |1-4| + |2-5| + |3-6| = 3 + 3 + 3 = 9.0
    CHECK_NEAR(manhattanDistance(u.data(), v.data(), 3), 9.0f, 1e-5f);
}

TEST(DistanceTest, IdenticalVectorsYieldZero) {
    const std::vector<float> vec = {3.14f, -2.71f, 42.0f, 0.5f};
    const std::size_t dim = vec.size();

    CHECK_NEAR(cosineDistance(vec.data(), vec.data(), dim), 0.0f, 1e-6f);
    CHECK_NEAR(euclideanDistance(vec.data(), vec.data(), dim), 0.0f, 1e-6f);
    CHECK_NEAR(euclideanSquared(vec.data(), vec.data(), dim), 0.0f, 1e-6f);
    CHECK_NEAR(manhattanDistance(vec.data(), vec.data(), dim), 0.0f, 1e-6f);
}

TEST(DistanceTest, Symmetry) {
    const std::vector<float> a = {1.5f, -3.2f, 4.8f, 0.1f};
    const std::vector<float> b = {-0.4f, 2.1f, 1.9f, -5.3f};
    const std::size_t dim = a.size();

    CHECK_NEAR(cosineDistance(a.data(), b.data(), dim), cosineDistance(b.data(), a.data(), dim), 1e-6f);
    CHECK_NEAR(euclideanDistance(a.data(), b.data(), dim), euclideanDistance(b.data(), a.data(), dim), 1e-6f);
    CHECK_NEAR(euclideanSquared(a.data(), b.data(), dim), euclideanSquared(b.data(), a.data(), dim), 1e-6f);
    CHECK_NEAR(manhattanDistance(a.data(), b.data(), dim), manhattanDistance(b.data(), a.data(), dim), 1e-6f);
}

TEST(DistanceTest, ZeroVectorHandlingInCosine) {
    const std::vector<float> zero = {0.0f, 0.0f, 0.0f};
    const std::vector<float> nonZero = {1.0f, 2.0f, 3.0f};
    const std::size_t dim = 3;

    // Zero vector as first operand
    const float d1 = cosineDistance(zero.data(), nonZero.data(), dim);
    CHECK(!std::isnan(d1));
    CHECK_NEAR(d1, 1.0f, 1e-6f);

    // Zero vector as second operand
    const float d2 = cosineDistance(nonZero.data(), zero.data(), dim);
    CHECK(!std::isnan(d2));
    CHECK_NEAR(d2, 1.0f, 1e-6f);

    // Both vectors are zero
    const float d3 = cosineDistance(zero.data(), zero.data(), dim);
    CHECK(!std::isnan(d3));
    CHECK_NEAR(d3, 1.0f, 1e-6f);
}

TEST(DistanceTest, ScalingInvarianceForCosine) {
    const std::vector<float> a = {1.0f, 2.0f, 3.0f};
    const std::vector<float> b = {-2.0f, 1.0f, 4.0f};
    const std::vector<float> aScaled = {10.0f, 20.0f, 30.0f};
    const std::vector<float> bScaled = {-0.2f, 0.1f, 0.4f};
    const std::size_t dim = 3;

    const float distOriginal = cosineDistance(a.data(), b.data(), dim);
    const float distScaledA = cosineDistance(aScaled.data(), b.data(), dim);
    const float distScaledB = cosineDistance(a.data(), bScaled.data(), dim);
    const float distBothScaled = cosineDistance(aScaled.data(), bScaled.data(), dim);

    CHECK_NEAR(distOriginal, distScaledA, 1e-5f);
    CHECK_NEAR(distOriginal, distScaledB, 1e-5f);
    CHECK_NEAR(distOriginal, distBothScaled, 1e-5f);
}

TEST(DistanceTest, MetricDispatcherAndStringConversion) {
    const std::vector<float> a = {1.0f, 0.0f};
    const std::vector<float> b = {0.0f, 1.0f};
    const std::size_t dim = 2;

    CHECK_NEAR(distance(Metric::Cosine, a.data(), b.data(), dim), 1.0f, 1e-6f);
    CHECK_NEAR(distance(Metric::Euclidean, a.data(), b.data(), dim), std::sqrt(2.0f), 1e-6f);
    CHECK_NEAR(distance(Metric::Manhattan, a.data(), b.data(), dim), 2.0f, 1e-6f);

    // Unknown metric enum
    CHECK_THROWS(distance(static_cast<Metric>(999), a.data(), b.data(), dim), std::invalid_argument);

    // String conversions
    CHECK(metricToString(Metric::Cosine) == "cosine");
    CHECK(metricToString(Metric::Euclidean) == "euclidean");
    CHECK(metricToString(Metric::Manhattan) == "manhattan");
    CHECK_THROWS(metricToString(static_cast<Metric>(999)), std::invalid_argument);

    CHECK(metricFromString("cosine") == Metric::Cosine);
    CHECK(metricFromString("Cosine") == Metric::Cosine);
    CHECK(metricFromString("COSINE") == Metric::Cosine);
    CHECK(metricFromString("euclidean") == Metric::Euclidean);
    CHECK(metricFromString("Euclidean") == Metric::Euclidean);
    CHECK(metricFromString("manhattan") == Metric::Manhattan);
    CHECK(metricFromString("MANHATTAN") == Metric::Manhattan);
    CHECK_THROWS(metricFromString("invalid_metric"), std::invalid_argument);
}
