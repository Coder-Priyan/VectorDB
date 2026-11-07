#include "vectordb/pca.hpp"

#include <algorithm>
#include <cmath>
#include <numeric>
#include <random>
#include <stdexcept>

namespace vectordb {

namespace {

/**
 * @brief Computes Euclidean (L2) norm of a vector.
 */
double l2Norm(const float* vec, std::size_t dim) {
    double sum = 0.0;
    for (std::size_t j = 0; j < dim; ++j) {
        sum += static_cast<double>(vec[j]) * static_cast<double>(vec[j]);
    }
    return std::sqrt(sum);
}

/**
 * @brief Computes dot product of two vectors using double precision.
 */
double dotProduct(const float* a, const float* b, std::size_t dim) {
    double sum = 0.0;
    for (std::size_t j = 0; j < dim; ++j) {
        sum += static_cast<double>(a[j]) * static_cast<double>(b[j]);
    }
    return sum;
}

} // namespace

PcaResult fitPca(const float* data,
                 std::size_t n,
                 std::size_t dim,
                 std::size_t components,
                 bool normalizeRows,
                 unsigned seed,
                 std::size_t maxIter,
                 double tol) {
    if (dim < components) {
        throw std::invalid_argument("components cannot exceed dim");
    }

    PcaResult result;
    result.dim = dim;
    result.components = components;
    result.normalized = normalizeRows;
    result.mean.assign(dim, 0.0f);
    result.axes.resize(components, std::vector<float>(dim, 0.0f));
    result.variance.assign(components, 0.0);
    result.explainedRatio.assign(components, 0.0);
    result.totalVariance = 0.0;

    if (components == 0 || dim == 0) {
        return result;
    }

    // Handle degenerate cases: n == 0 or n == 1
    // Sample variance cannot be estimated with fewer than 2 points (n - 1 = 0).
    // In this case, return canonical basis vectors and zero variance.
    if (n < 2) {
        if (n == 1 && data != nullptr) {
            if (normalizeRows) {
                double norm = l2Norm(data, dim);
                if (norm > 1e-12) {
                    for (std::size_t j = 0; j < dim; ++j) {
                        result.mean[j] = static_cast<float>(static_cast<double>(data[j]) / norm);
                    }
                } else {
                    result.mean.assign(data, data + dim);
                }
            } else {
                result.mean.assign(data, data + dim);
            }
        }
        for (std::size_t c = 0; c < components; ++c) {
            result.axes[c][c] = 1.0f;
        }
        return result;
    }

    // Copy and optionally row-normalize data
    // Working dataset X is stored row-major of size n x dim
    std::vector<float> X(n * dim);
    if (normalizeRows) {
        for (std::size_t i = 0; i < n; ++i) {
            const float* row = data + i * dim;
            double norm = l2Norm(row, dim);
            float* dest = X.data() + i * dim;
            if (norm > 1e-12) {
                for (std::size_t j = 0; j < dim; ++j) {
                    dest[j] = static_cast<float>(static_cast<double>(row[j]) / norm);
                }
            } else {
                std::fill(dest, dest + dim, 0.0f);
            }
        }
    } else {
        std::copy(data, data + n * dim, X.begin());
    }

    // Compute column means
    std::vector<double> colSums(dim, 0.0);
    for (std::size_t i = 0; i < n; ++i) {
        const float* row = X.data() + i * dim;
        for (std::size_t j = 0; j < dim; ++j) {
            colSums[j] += static_cast<double>(row[j]);
        }
    }
    for (std::size_t j = 0; j < dim; ++j) {
        result.mean[j] = static_cast<float>(colSums[j] / static_cast<double>(n));
    }

    // Center the data in-place: Xc = X - mean
    // Also compute total variance: sum of sample variances across all dimensions
    // totalVariance = sum_{i, j} (Xc[i, j])^2 / (n - 1)
    double sumSqDiff = 0.0;
    for (std::size_t i = 0; i < n; ++i) {
        float* row = X.data() + i * dim;
        for (std::size_t j = 0; j < dim; ++j) {
            row[j] -= result.mean[j];
            sumSqDiff += static_cast<double>(row[j]) * static_cast<double>(row[j]);
        }
    }
    result.totalVariance = sumSqDiff / static_cast<double>(n - 1);

    // If total variance is zero (all points identical), return canonical basis vectors
    if (result.totalVariance <= 1e-15) {
        result.totalVariance = 0.0;
        for (std::size_t c = 0; c < components; ++c) {
            result.axes[c][c] = 1.0f;
        }
        return result;
    }

    // Power iteration with deflation
    // To extract component c:
    // We compute the dominant eigenvector of the deflated sample covariance matrix C.
    // Notice that C * v = (1 / (n - 1)) * Xc^T * (Xc * v).
    // This allows matrix-vector multiplication in O(n * dim) without allocating dim x dim matrix.
    std::vector<float> y(n, 0.0f);     // Intermediate product Xc * v
    std::vector<float> w(dim, 0.0f);   // Intermediate product Xc^T * y / (n - 1)
    std::vector<float> v(dim, 0.0f);   // Candidate eigenvector

    for (std::size_t c = 0; c < components; ++c) {
        // Initialize random vector deterministically
        std::mt19937 rng(seed + static_cast<unsigned>(c) * 1013u);
        std::normal_distribution<float> dist(0.0f, 1.0f);
        for (std::size_t j = 0; j < dim; ++j) {
            v[j] = dist(rng);
        }

        // Deflate initial vector against already computed principal components
        for (std::size_t prev = 0; prev < c; ++prev) {
            double dot = dotProduct(v.data(), result.axes[prev].data(), dim);
            for (std::size_t j = 0; j < dim; ++j) {
                v[j] -= static_cast<float>(dot * static_cast<double>(result.axes[prev][j]));
            }
        }

        // Normalize initial vector
        double vNorm = l2Norm(v.data(), dim);
        if (vNorm > 1e-12) {
            for (std::size_t j = 0; j < dim; ++j) {
                v[j] = static_cast<float>(static_cast<double>(v[j]) / vNorm);
            }
        } else {
            // Fallback to canonical basis if random vector collapsed
            std::fill(v.begin(), v.end(), 0.0f);
            v[c] = 1.0f;
        }

        // Power iterations
        for (std::size_t iter = 0; iter < maxIter; ++iter) {
            // Step 1: y = Xc * v  (size n)
            for (std::size_t i = 0; i < n; ++i) {
                const float* row = X.data() + i * dim;
                y[i] = static_cast<float>(dotProduct(row, v.data(), dim));
            }

            // Step 2: w = Xc^T * y / (n - 1)  (size dim)
            std::fill(w.begin(), w.end(), 0.0f);
            for (std::size_t i = 0; i < n; ++i) {
                const float* row = X.data() + i * dim;
                const double yi = static_cast<double>(y[i]);
                for (std::size_t j = 0; j < dim; ++j) {
                    w[j] += static_cast<float>(static_cast<double>(row[j]) * yi);
                }
            }
            const double invNMinus1 = 1.0 / static_cast<double>(n - 1);
            for (std::size_t j = 0; j < dim; ++j) {
                w[j] = static_cast<float>(static_cast<double>(w[j]) * invNMinus1);
            }

            // Step 3: Deflate against previously found components (Gram-Schmidt orthogonalization)
            for (std::size_t prev = 0; prev < c; ++prev) {
                double proj = dotProduct(w.data(), result.axes[prev].data(), dim);
                for (std::size_t j = 0; j < dim; ++j) {
                    w[j] -= static_cast<float>(proj * static_cast<double>(result.axes[prev][j]));
                }
            }

            // Step 4: Check norm and convergence
            double wNorm = l2Norm(w.data(), dim);
            if (wNorm < 1e-12) {
                // Remaining variance along this subspace is effectively zero
                break;
            }

            // Compute cosine similarity between current v and new direction w / wNorm
            double dotWithPrev = 0.0;
            for (std::size_t j = 0; j < dim; ++j) {
                dotWithPrev += static_cast<double>(v[j]) * (static_cast<double>(w[j]) / wNorm);
            }

            for (std::size_t j = 0; j < dim; ++j) {
                v[j] = static_cast<float>(static_cast<double>(w[j]) / wNorm);
            }

            // Convergence check: absolute dot product close to 1
            if (1.0 - std::abs(dotWithPrev) < tol) {
                break;
            }
        }

        // Re-orthogonalize against all previous axes to prevent numerical drift
        for (std::size_t prev = 0; prev < c; ++prev) {
            double dot = dotProduct(v.data(), result.axes[prev].data(), dim);
            for (std::size_t j = 0; j < dim; ++j) {
                v[j] -= static_cast<float>(dot * static_cast<double>(result.axes[prev][j]));
            }
        }
        double finalNorm = l2Norm(v.data(), dim);
        if (finalNorm > 1e-12) {
            for (std::size_t j = 0; j < dim; ++j) {
                v[j] = static_cast<float>(static_cast<double>(v[j]) / finalNorm);
            }
        } else {
            // Subspace exhausted, choose canonical unit vector orthogonal to previous
            std::fill(v.begin(), v.end(), 0.0f);
            v[c] = 1.0f;
        }

        // Sign convention: the coordinate with the largest absolute value must be positive
        std::size_t argmax = 0;
        float maxAbs = std::abs(v[0]);
        for (std::size_t j = 1; j < dim; ++j) {
            float absVal = std::abs(v[j]);
            if (absVal > maxAbs) {
                maxAbs = absVal;
                argmax = j;
            }
        }
        if (v[argmax] < 0.0f) {
            for (std::size_t j = 0; j < dim; ++j) {
                v[j] = -v[j];
            }
        }

        result.axes[c] = v;

        // Compute variance along this component: var_c = (1 / (n - 1)) * ||Xc * v||^2
        double varSum = 0.0;
        for (std::size_t i = 0; i < n; ++i) {
            const float* row = X.data() + i * dim;
            double dot = dotProduct(row, v.data(), dim);
            varSum += dot * dot;
        }
        double var = varSum / static_cast<double>(n - 1);
        result.variance[c] = var;
        if (result.totalVariance > 1e-15) {
            result.explainedRatio[c] = std::min(1.0, std::max(0.0, var / result.totalVariance));
        } else {
            result.explainedRatio[c] = 0.0;
        }
    }

    return result;
}

std::vector<float> projectPca(const PcaResult& pca, const float* vec) {
    if (pca.dim == 0 || pca.components == 0 || vec == nullptr) {
        return std::vector<float>(pca.components, 0.0f);
    }

    std::vector<float> centered(pca.dim);
    if (pca.normalized) {
        double norm = l2Norm(vec, pca.dim);
        if (norm > 1e-12) {
            for (std::size_t j = 0; j < pca.dim; ++j) {
                centered[j] = static_cast<float>(static_cast<double>(vec[j]) / norm) - pca.mean[j];
            }
        } else {
            for (std::size_t j = 0; j < pca.dim; ++j) {
                centered[j] = -pca.mean[j];
            }
        }
    } else {
        for (std::size_t j = 0; j < pca.dim; ++j) {
            centered[j] = vec[j] - pca.mean[j];
        }
    }

    std::vector<float> proj(pca.components, 0.0f);
    for (std::size_t c = 0; c < pca.components; ++c) {
        proj[c] = static_cast<float>(dotProduct(centered.data(), pca.axes[c].data(), pca.dim));
    }

    return proj;
}

} // namespace vectordb
