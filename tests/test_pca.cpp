#include "test_harness.hpp"
#include "vectordb/pca.hpp"

#include <chrono>
#include <cmath>
#include <random>
#include <vector>

using namespace vectordb;

namespace {

double l2Norm(const std::vector<float>& vec) {
    double sum = 0.0;
    for (float v : vec) {
        sum += static_cast<double>(v) * static_cast<double>(v);
    }
    return std::sqrt(sum);
}

double dotProduct(const std::vector<float>& a, const std::vector<float>& b) {
    double sum = 0.0;
    for (std::size_t i = 0; i < a.size(); ++i) {
        sum += static_cast<double>(a[i]) * static_cast<double>(b[i]);
    }
    return sum;
}

} // namespace

TEST(PcaTest, KnownStretchedAxisRecovery) {
    // Generate 3D data stretched along axis (1, 0, 0)
    // Points have large variation along x, small along y, zero along z
    std::size_t n = 200;
    std::size_t dim = 3;
    std::vector<float> data(n * dim);

    std::mt19937 rng(12345);
    std::normal_distribution<float> distX(0.0f, 10.0f); // std = 10 -> var = 100
    std::normal_distribution<float> distY(0.0f, 1.0f);  // std = 1  -> var = 1

    for (std::size_t i = 0; i < n; ++i) {
        data[i * dim + 0] = distX(rng);
        data[i * dim + 1] = distY(rng);
        data[i * dim + 2] = 0.0f;
    }

    PcaResult res = fitPca(data.data(), n, dim, 2);

    CHECK(res.dim == 3);
    CHECK(res.components == 2);
    CHECK(res.axes.size() == 2);

    // Axis 0 should align with (1, 0, 0)
    // Absolute cosine should be > 0.99
    double cos0 = std::abs(res.axes[0][0]);
    CHECK(cos0 > 0.99);

    // Axis 1 should align with (0, 1, 0)
    double cos1 = std::abs(res.axes[1][1]);
    CHECK(cos1 > 0.99);

    // First explained ratio must be dominant
    CHECK(res.explainedRatio[0] > res.explainedRatio[1]);
    CHECK(res.explainedRatio[0] > 0.90);
    CHECK(res.variance[0] > res.variance[1]);
}

TEST(PcaTest, OrthonormalityAndSignConvention) {
    std::size_t n = 100;
    std::size_t dim = 8;
    std::vector<float> data(n * dim);

    std::mt19937 rng(42);
    std::normal_distribution<float> dist(0.0f, 2.0f);
    for (float& v : data) {
        v = dist(rng);
    }

    PcaResult res = fitPca(data.data(), n, dim, 2);

    // Check unit length of each axis
    for (std::size_t c = 0; c < 2; ++c) {
        double norm = l2Norm(res.axes[c]);
        CHECK(std::abs(norm - 1.0) < 1e-4);
    }

    // Check orthogonality: dot(a0, a1) == 0
    double dot = dotProduct(res.axes[0], res.axes[1]);
    CHECK(std::abs(dot) < 1e-4);

    // Check sign convention: argmax element must be positive
    for (std::size_t c = 0; c < 2; ++c) {
        std::size_t argmax = 0;
        float maxAbs = std::abs(res.axes[c][0]);
        for (std::size_t j = 1; j < dim; ++j) {
            float absVal = std::abs(res.axes[c][j]);
            if (absVal > maxAbs) {
                maxAbs = absVal;
                argmax = j;
            }
        }
        CHECK(res.axes[c][argmax] >= 0.0f);
    }
}

TEST(PcaTest, Determinism) {
    std::size_t n = 80;
    std::size_t dim = 16;
    std::vector<float> data(n * dim);

    std::mt19937 rng(999);
    std::normal_distribution<float> dist(1.0f, 3.0f);
    for (float& v : data) {
        v = dist(rng);
    }

    PcaResult r1 = fitPca(data.data(), n, dim, 2, false, 42);
    PcaResult r2 = fitPca(data.data(), n, dim, 2, false, 42);

    for (std::size_t j = 0; j < dim; ++j) {
        CHECK(r1.mean[j] == r2.mean[j]);
    }

    for (std::size_t c = 0; c < 2; ++c) {
        CHECK(r1.variance[c] == r2.variance[c]);
        CHECK(r1.explainedRatio[c] == r2.explainedRatio[c]);
        for (std::size_t j = 0; j < dim; ++j) {
            CHECK(r1.axes[c][j] == r2.axes[c][j]);
        }
    }

    // Projections must also be bitwise identical
    std::vector<float> proj1 = projectPca(r1, data.data());
    std::vector<float> proj2 = projectPca(r2, data.data());
    CHECK(proj1[0] == proj2[0]);
    CHECK(proj1[1] == proj2[1]);
}

TEST(PcaTest, DegenerateAndEdgeCases) {
    std::size_t dim = 4;

    // 1. n = 0
    PcaResult r0 = fitPca(nullptr, 0, dim, 2);
    CHECK(r0.totalVariance == 0.0);
    CHECK(r0.variance[0] == 0.0);
    CHECK(r0.explainedRatio[0] == 0.0);
    std::vector<float> dummy(dim, 1.0f);
    std::vector<float> p0 = projectPca(r0, dummy.data());
    CHECK(!std::isnan(p0[0]));
    CHECK(!std::isnan(p0[1]));

    // 2. n = 1
    std::vector<float> single = {1.0f, 2.0f, 3.0f, 4.0f};
    PcaResult r1 = fitPca(single.data(), 1, dim, 2);
    CHECK(r1.totalVariance == 0.0);
    CHECK(r1.mean[0] == 1.0f);
    CHECK(r1.mean[3] == 4.0f);

    // 3. Constant dataset (all points identical -> zero variance)
    std::vector<float> constantData = {
        2.0f, 3.0f, 4.0f, 5.0f,
        2.0f, 3.0f, 4.0f, 5.0f,
        2.0f, 3.0f, 4.0f, 5.0f
    };
    PcaResult rc = fitPca(constantData.data(), 3, dim, 2);
    CHECK(rc.totalVariance == 0.0);
    CHECK(rc.variance[0] == 0.0);
    CHECK(rc.variance[1] == 0.0);
    CHECK(rc.explainedRatio[0] == 0.0);
    CHECK(rc.explainedRatio[1] == 0.0);

    // 4. Projecting the dataset mean yields (0, 0)
    std::vector<float> pts = {
        1.0f, 0.0f, 0.0f, 0.0f,
        3.0f, 2.0f, 0.0f, 0.0f,
        5.0f, 4.0f, 0.0f, 0.0f
    };
    PcaResult rMean = fitPca(pts.data(), 3, dim, 2);
    std::vector<float> pMean = projectPca(rMean, rMean.mean.data());
    CHECK(std::abs(pMean[0]) < 1e-5f);
    CHECK(std::abs(pMean[1]) < 1e-5f);

    // 5. Invalid arguments
    CHECK_THROWS(fitPca(pts.data(), 3, 2, 3), std::invalid_argument); // dim < components
}

TEST(PcaTest, VarianceRatiosBounds) {
    std::size_t n = 50;
    std::size_t dim = 10;
    std::vector<float> data(n * dim);

    std::mt19937 rng(777);
    std::uniform_real_distribution<float> dist(-5.0f, 5.0f);
    for (float& v : data) {
        v = dist(rng);
    }

    PcaResult res = fitPca(data.data(), n, dim, 2);

    CHECK(res.totalVariance > 0.0);
    CHECK(res.variance[0] >= 0.0);
    CHECK(res.variance[1] >= 0.0);
    CHECK(res.explainedRatio[0] >= 0.0);
    CHECK(res.explainedRatio[1] >= 0.0);
    CHECK(res.explainedRatio[0] + res.explainedRatio[1] <= 1.0 + 1e-9);
}

TEST(PcaTest, RowNormalizationScaleInvariance) {
    // If normalizeRows is true, scaling an input vector by scalar factor c > 0
    // must result in the exact same PCA projection coordinates.
    std::size_t n = 20;
    std::size_t dim = 4;
    std::vector<float> data(n * dim);

    std::mt19937 rng(888);
    std::normal_distribution<float> dist(1.0f, 2.0f);
    for (float& v : data) {
        v = dist(rng);
    }

    PcaResult resNorm = fitPca(data.data(), n, dim, 2, true);
    CHECK(resNorm.normalized == true);

    std::vector<float> testVec = {1.5f, -2.0f, 3.2f, 0.5f};
    std::vector<float> scaledVec = {15.0f, -20.0f, 32.0f, 5.0f}; // scaled by 10

    std::vector<float> proj1 = projectPca(resNorm, testVec.data());
    std::vector<float> proj2 = projectPca(resNorm, scaledVec.data());

    CHECK(std::abs(proj1[0] - proj2[0]) < 1e-4f);
    CHECK(std::abs(proj1[1] - proj2[1]) < 1e-4f);
}

TEST(PcaTest, PerformanceDim768N500) {
    std::size_t n = 500;
    std::size_t dim = 768;
    std::vector<float> data(n * dim);

    std::mt19937 rng(1337);
    std::normal_distribution<float> dist(0.0f, 1.0f);
    for (float& v : data) {
        v = dist(rng);
    }

    auto start = std::chrono::steady_clock::now();
    PcaResult res = fitPca(data.data(), n, dim, 2, true);
    auto end = std::chrono::steady_clock::now();

    auto elapsedMs = std::chrono::duration_cast<std::chrono::milliseconds>(end - start).count();

    CHECK(res.dim == 768);
    CHECK(res.components == 2);
    // Must finish well under 3000 ms (typically < 100ms)
    CHECK(elapsedMs < 3000);
}

